const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const AccessAudit = require('../models/AccessAudit');
const WorkerAccessGrant = require('../models/WorkerAccessGrant');
const auth = require('../middleware/auth');
const { requireAdmin, requirePermission } = require('../middleware/authorize');
const { canDelegatePermissions, getRole, hasPermission, normalizePermissions, serializeUser } = require('../utils/permissions');
const { appearsInCreatorChain, collectDescendants, isDescendantOf } = require('../utils/worker-lineage');
const { grantAllowsLevel } = require('../utils/worker-access-grants');
const { recordAccessAudit } = require('../utils/access-audit');
const { objectId, stringField, emailField } = require('../utils/validation');
const { rateLimit, clientIp } = require('../utils/rate-limit');
const { sendWorkerWelcomeEmail, sendWorkerPasswordResetEmail } = require('../utils/email');

const router = express.Router();
router.use(auth);
router.use(rateLimit({ scope: 'workers-admin', limit: 120, windowMs: 15 * 60 * 1000, key: (req) => `${clientIp(req)}:${req.user.id}` }));

const normalizeUsername = (value) => String(value || '').trim().toLowerCase();
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const makeTemporaryPassword = () => `${crypto.randomBytes(12).toString('base64url')}!7a`;

async function deliverWorkerAccountEmail(sendPromise, label, worker) {
  if (!worker?.email) {
    return { status: 'skipped', message: 'No email address was available.' };
  }

  try {
    await sendPromise;
    return { status: 'sent', message: 'Password email sent to the user.' };
  } catch (error) {
    console.error(`[workers] ${label} email failed`, {
      workerId: String(worker?._id || worker?.id || ''),
      email: worker?.email || '',
      message: error.message
    });
    return { status: 'failed', message: 'Password email was not sent.' };
  }
}

async function findWorker(id) {
  objectId(id, 'Worker ID');
  return User.findOne({ _id: id, role: 'worker' });
}

function isOwner(req) {
  return getRole(req.user) === 'admin';
}

function isSelf(req, worker) {
  return String(req.user.id) === String(worker._id);
}

const findLineageUserById = (id) => User.findById(id).select('_id role createdBy').lean();

async function findActiveGrant(actor, target) {
  return WorkerAccessGrant.findOne({ actor, target, revokedAt: null }).lean();
}

async function hasWorkerScope(req, worker, requiredLevel = 'view') {
  if (isOwner(req)) return true;
  if (await isDescendantOf(req.user, worker, findLineageUserById)) return true;
  const grant = await findActiveGrant(req.user.id, worker._id);
  return grantAllowsLevel(grant, req.user.id, worker._id, requiredLevel);
}

async function rejectOutsideWorkerScope(req, res, worker, requiredLevel = 'view') {
  if (isOwner(req)) return false;
  const permitted = await hasWorkerScope(req, worker, requiredLevel);
  if (permitted) return false;

  // Return the same response as an unknown account to avoid exposing workers in another branch.
  res.status(404).json({ message: 'Worker not found.', code: 'WORKER_NOT_FOUND' });
  return true;
}

async function rejectProtectedWorker(req, res, worker) {
  if (!isOwner(req) && isSelf(req, worker)) {
    res.status(403).json({
      message: 'Use your account settings to update your own account.',
      code: 'SELF_MANAGEMENT_DENIED'
    });
    return true;
  }
  if (await rejectOutsideWorkerScope(req, res, worker, 'manage')) return true;
  if (!isOwner(req) && !canDelegatePermissions(req.user, worker.permissions, worker.permissions)) {
    res.status(403).json({
      message: 'This account has access above your management authority.',
      code: 'TARGET_ACCESS_PROTECTED'
    });
    return true;
  }
  return false;
}

function rejectPrivilegeEscalation(req, res, permissions, existingPermissions = null) {
  if (!canDelegatePermissions(req.user, permissions, existingPermissions)) {
    res.status(403).json({
      message: 'You cannot grant access above your own permissions or delegate Worker Access.',
      code: 'PERMISSION_ESCALATION_DENIED'
    });
    return true;
  }
  return false;
}

router.get('/', requirePermission('workers', 'view'), async (req, res) => {
  try {
    if (isOwner(req)) {
      const workers = await User.find({ role: 'worker' }).sort({ createdAt: -1 });
      return res.json(workers.map(serializeUser));
    }

    const descendants = await collectDescendants(req.user, (parentIds) => User.find({
      role: 'worker',
      createdBy: { $in: parentIds }
    }).sort({ createdAt: -1 }));
    const descendantIds = new Set(descendants.map((worker) => String(worker._id)));
    const grants = await WorkerAccessGrant.find({ actor: req.user.id, revokedAt: null }).lean();
    const grantByTarget = new Map(grants.map((grant) => [String(grant.target), grant]));
    const grantedTargetIds = [...grantByTarget.keys()].filter((id) => !descendantIds.has(id));
    const grantedWorkers = grantedTargetIds.length > 0
      ? await User.find({ _id: { $in: grantedTargetIds }, role: 'worker' })
      : [];
    const workers = [...descendants, ...grantedWorkers]
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));

    res.json(workers.map((worker) => {
      const serialized = serializeUser(worker);
      const grant = descendantIds.has(String(worker._id)) ? null : grantByTarget.get(String(worker._id));
      return grant ? { ...serialized, accessScope: 'exception', accessLevel: grant.level } : serialized;
    }));
  } catch (error) {
    res.status(500).json({ message: 'Workers could not be loaded.' });
  }
});

function serializeGrant(grant) {
  const grantedBy = grant.grantedBy || {};
  return {
    id: String(grant._id),
    actor: serializeUser(grant.actor),
    target: serializeUser(grant.target),
    level: grant.level,
    reason: grant.reason,
    grantedBy: {
      id: String(grantedBy._id || grantedBy.id || ''),
      fullName: grantedBy.fullName || '',
      username: grantedBy.username || ''
    },
    createdAt: grant.createdAt,
    updatedAt: grant.updatedAt
  };
}

router.get('/access-grants', requireAdmin, async (_req, res) => {
  try {
    const [workers, grants] = await Promise.all([
      User.find({ role: 'worker' }).sort({ createdAt: -1 }),
      WorkerAccessGrant.find({ revokedAt: null })
        .sort({ updatedAt: -1 })
        .populate('actor')
        .populate('target')
        .populate('grantedBy', '_id fullName username')
    ]);
    res.json({
      workers: workers.map(serializeUser),
      grants: grants.filter((grant) => grant.actor && grant.target).map(serializeGrant)
    });
  } catch (error) {
    res.status(500).json({ message: 'Advanced worker access could not be loaded.' });
  }
});

router.post('/access-grants', requireAdmin, async (req, res) => {
  try {
    const actorId = objectId(req.body?.actorId, 'Receiving worker');
    const requestedTargetIds = Array.isArray(req.body?.targetIds)
      ? req.body.targetIds
      : [req.body?.targetId];
    if (requestedTargetIds.length === 0 || requestedTargetIds.length > 1000) {
      return res.status(400).json({ message: 'Select between 1 and 1000 eligible workers.' });
    }
    const targetIds = [...new Set(requestedTargetIds.map((value) => objectId(value, 'Selected worker')))];
    const level = stringField(req.body?.level, { name: 'Access level', required: true, max: 10 });
    const reason = stringField(req.body?.reason, { name: 'Reason', required: true, min: 10, max: 300 });
    if (!['view', 'manage'].includes(level)) {
      return res.status(400).json({ message: 'Access level must be View or Manage.' });
    }
    if (targetIds.includes(actorId)) {
      return res.status(400).json({ message: 'A worker cannot receive an exception for their own account.' });
    }

    const [actor, targets] = await Promise.all([
      User.findOne({ _id: actorId, role: 'worker', active: true }),
      User.find({ _id: { $in: targetIds }, role: 'worker', active: true })
    ]);
    if (!actor || targets.length !== targetIds.length) {
      return res.status(404).json({ message: 'Every selected worker must exist and be active.' });
    }
    if (!hasPermission(actor, 'workers', level)) {
      return res.status(409).json({
        message: `Give ${actor.fullName || actor.username} Worker Access: ${level === 'manage' ? 'Manage' : 'View'} before creating this exception.`,
        code: 'WORKER_PERMISSION_REQUIRED'
      });
    }

    const eligibility = await Promise.all(targets.map(async (target) => ({
      target,
      isDescendant: await appearsInCreatorChain(actor, target, findLineageUserById),
      isAncestor: await appearsInCreatorChain(target, actor, findLineageUserById)
    })));
    if (eligibility.some(({ isDescendant }) => isDescendant)) {
      return res.status(409).json({
        message: 'A selected worker is already inside the receiving worker’s lineage.',
        code: 'LINEAGE_ACCESS_ALREADY_EXISTS'
      });
    }
    if (eligibility.some(({ isAncestor }) => isAncestor)) {
      return res.status(403).json({
        message: 'Access cannot be granted to a parent or ancestor account.',
        code: 'ANCESTOR_ACCESS_DENIED'
      });
    }
    if (level === 'manage' && targets.some((target) => !canDelegatePermissions(actor, target.permissions, target.permissions))) {
      return res.status(403).json({
        message: 'A selected account has permissions above the receiving worker’s management authority.',
        code: 'TARGET_ACCESS_PROTECTED'
      });
    }

    await WorkerAccessGrant.bulkWrite(targets.map((target) => ({
      updateOne: {
        filter: { actor: actor._id, target: target._id },
        update: {
          $set: { level, reason, grantedBy: req.user.id, revokedAt: null },
          $setOnInsert: { actor: actor._id, target: target._id }
        },
        upsert: true
      }
    })), { ordered: true });
    await recordAccessAudit(req, 'worker.access_exception_batch_granted', {
      metadata: {
        receivingWorker: String(actor._id),
        level,
        reason,
        targetCount: targets.length,
        targetUsers: targets.map((target) => String(target._id))
      }
    });
    const grants = await WorkerAccessGrant.find({
      actor: actor._id,
      target: { $in: targets.map((target) => target._id) },
      revokedAt: null
    })
      .populate('actor')
      .populate('target')
      .populate('grantedBy', '_id fullName username');
    res.status(201).json({ grants: grants.map(serializeGrant) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An access exception already exists for these workers.' });
    }
    if (/\b(required|invalid|must be|between)\b/i.test(error.message || '') || error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message || 'Advanced access details are invalid.' });
    }
    console.error('Advanced worker access grant failed:', error.message);
    res.status(500).json({ message: 'Advanced access could not be granted.' });
  }
});

router.delete('/access-grants/:id', requireAdmin, async (req, res) => {
  try {
    const grantId = objectId(req.params.id, 'Access exception');
    const grant = await WorkerAccessGrant.findOne({ _id: grantId, revokedAt: null });
    if (!grant) return res.status(404).json({ message: 'Active access exception not found.' });
    await WorkerAccessGrant.updateMany(
      { actor: grant.actor, target: grant.target, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    await recordAccessAudit(req, 'worker.access_exception_revoked', {
      targetUser: grant.target,
      metadata: { receivingWorker: String(grant.actor), level: grant.level }
    });
    res.json({ message: 'Advanced access revoked.' });
  } catch (error) {
    if (/\binvalid\b/i.test(error.message || '')) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Advanced worker access revocation failed:', error.message);
    res.status(500).json({ message: 'Advanced access could not be revoked.' });
  }
});

router.post('/', requirePermission('workers', 'manage'), async (req, res) => {
  try {
    const fullName = stringField(req.body?.fullName, { name: 'Full name', required: true, max: 120 });
    const jobTitle = stringField(req.body?.jobTitle, { name: 'Company role / job title', required: true, max: 100 });
    const username = stringField(normalizeUsername(req.body?.username), { name: 'Username', required: true, max: 80 });
    const email = emailField(req.body?.email);
    if (!fullName || !/^[a-z0-9._-]{3,80}$/.test(username) || !email) {
      return res.status(400).json({ message: 'Full name, username and email are required.' });
    }
    if (!validEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (await User.exists({ $or: [{ username }, { email }] })) {
      return res.status(409).json({ message: 'That username or email is already in use.' });
    }

    const permissions = normalizePermissions('worker', req.body?.permissions);
    if (rejectPrivilegeEscalation(req, res, permissions)) return;

    const temporaryPassword = makeTemporaryPassword();
    const worker = await User.create({
      fullName,
      jobTitle,
      username,
      email,
      password: await bcrypt.hash(temporaryPassword, 10),
      role: 'worker',
      permissions,
      active: true,
      mustChangePassword: true,
      createdBy: req.user.id
    });
    void recordAccessAudit(req, 'worker.created', { targetUser: worker._id });
    const emailDelivery = await deliverWorkerAccountEmail(
      sendWorkerWelcomeEmail(worker, temporaryPassword, req.user),
      'welcome',
      worker
    );
    res.status(201).json({ worker: serializeUser(worker), temporaryPassword, emailDelivery });
  } catch (error) {
    res.status(500).json({ message: 'Worker account could not be created.' });
  }
});

router.patch('/:id', requirePermission('workers', 'manage'), async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    if (await rejectProtectedWorker(req, res, worker)) return;
    const fullName = stringField(req.body?.fullName ?? worker.fullName, { name: 'Full name', required: true, max: 120 });
    const jobTitle = stringField(req.body?.jobTitle ?? worker.jobTitle, { name: 'Company role / job title', max: 100 });
    const username = normalizeUsername(req.body?.username ?? worker.username);
    const email = emailField(req.body?.email ?? worker.email);
    if (!fullName || !/^[a-z0-9._-]{3,80}$/.test(username) || !validEmail(email)) {
      return res.status(400).json({ message: 'Enter a full name, username and valid email.' });
    }
    if (await User.exists({ _id: { $ne: worker._id }, $or: [{ username }, { email }] })) {
      return res.status(409).json({ message: 'That username or email is already in use.' });
    }
    worker.fullName = fullName;
    worker.jobTitle = jobTitle;
    worker.username = username;
    worker.email = email;
    await worker.save();
    void recordAccessAudit(req, 'worker.profile_updated', { targetUser: worker._id });
    res.json({ worker: serializeUser(worker) });
  } catch (error) {
    res.status(500).json({ message: 'Worker profile could not be updated.' });
  }
});

router.patch('/:id/permissions', requirePermission('workers', 'manage'), async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    if (await rejectProtectedWorker(req, res, worker)) return;
    const permissions = normalizePermissions('worker', req.body?.permissions);
    if (rejectPrivilegeEscalation(req, res, permissions, worker.permissions)) return;
    worker.permissions = permissions;
    await worker.save();
    void recordAccessAudit(req, 'worker.permissions_updated', {
      targetUser: worker._id,
      metadata: { permissions: worker.permissions.toObject?.() || worker.permissions }
    });
    res.json({ worker: serializeUser(worker) });
  } catch (error) {
    res.status(500).json({ message: 'Worker permissions could not be updated.' });
  }
});

router.patch('/:id/status', requirePermission('workers', 'manage'), async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    if (await rejectProtectedWorker(req, res, worker)) return;
    if (typeof req.body?.active !== 'boolean') {
      return res.status(400).json({ message: 'An active status is required.' });
    }
    worker.active = req.body.active;
    worker.sessionVersion = Number(worker.sessionVersion || 0) + 1;
    await worker.save();
    void recordAccessAudit(req, req.body.active ? 'worker.enabled' : 'worker.disabled', { targetUser: worker._id });
    res.json({ worker: serializeUser(worker) });
  } catch (error) {
    res.status(500).json({ message: 'Worker status could not be updated.' });
  }
});

router.post('/:id/reset-password', requirePermission('workers', 'manage'), async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    if (await rejectProtectedWorker(req, res, worker)) return;
    const temporaryPassword = makeTemporaryPassword();
    worker.passwordHistory = [...(worker.passwordHistory || []), worker.password].slice(-5);
    worker.password = await bcrypt.hash(temporaryPassword, 10);
    worker.sessionVersion = Number(worker.sessionVersion || 0) + 1;
    worker.mustChangePassword = true;
    await worker.save();
    void recordAccessAudit(req, 'worker.password_reset', { targetUser: worker._id });
    const emailDelivery = await deliverWorkerAccountEmail(
      sendWorkerPasswordResetEmail(worker, temporaryPassword, req.user),
      'password reset',
      worker
    );
    res.json({ worker: serializeUser(worker), temporaryPassword, emailDelivery });
  } catch (error) {
    res.status(500).json({ message: 'Worker password could not be reset.' });
  }
});

router.get('/:id/activity', requirePermission('workers', 'view'), async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    if (await rejectOutsideWorkerScope(req, res, worker, 'view')) return;
    const activity = await AccessAudit.find({
      $or: [{ actor: worker._id }, { targetUser: worker._id }]
    }).sort({ createdAt: -1 }).limit(40).lean();
    res.json(activity);
  } catch (error) {
    res.status(500).json({ message: 'Worker activity could not be loaded.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    if (worker.active !== false) {
      return res.status(409).json({
        message: 'Disable this worker before permanently deleting the account.',
        code: 'WORKER_MUST_BE_DISABLED'
      });
    }
    if (await User.exists({ role: 'worker', createdBy: worker._id })) {
      return res.status(409).json({
        message: 'Delete this worker’s direct reports before deleting the account.',
        code: 'WORKER_HAS_DESCENDANTS'
      });
    }

    const deletedWorker = await User.findOneAndDelete({ _id: worker._id, role: 'worker', active: false });
    if (!deletedWorker) {
      return res.status(409).json({ message: 'The worker account changed status. Disable it again before deleting.' });
    }
    await WorkerAccessGrant.deleteMany({
      $or: [{ actor: deletedWorker._id }, { target: deletedWorker._id }]
    });
    await recordAccessAudit(req, 'worker.deleted', {
      targetUser: deletedWorker._id,
      metadata: { username: deletedWorker.username, fullName: deletedWorker.fullName || '' }
    });
    res.json({ message: 'Worker account permanently deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Worker account could not be deleted.' });
  }
});

module.exports = router;
