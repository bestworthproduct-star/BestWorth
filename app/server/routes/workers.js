const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const AccessAudit = require('../models/AccessAudit');
const auth = require('../middleware/auth');
const { requireAdmin, requirePermission } = require('../middleware/authorize');
const { canDelegatePermissions, getRole, isCreatorProtectedTarget, normalizePermissions, serializeUser } = require('../utils/permissions');
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

function sendWorkerAccountEmail(sendPromise, label, worker) {
  void sendPromise.catch((error) => {
    console.error(`[workers] ${label} email failed`, {
      workerId: String(worker?._id || worker?.id || ''),
      email: worker?.email || '',
      message: error.message
    });
  });
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

function rejectProtectedWorker(req, res, worker) {
  if (!isOwner(req) && isSelf(req, worker)) {
    res.status(403).json({
      message: 'Use your account settings to update your own account.',
      code: 'SELF_MANAGEMENT_DENIED'
    });
    return true;
  }
  if (isCreatorProtectedTarget(req.user, worker)) {
    res.status(403).json({
      message: 'The worker who created your account is protected from changes.',
      code: 'CREATOR_ACCOUNT_PROTECTED'
    });
    return true;
  }
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

router.get('/', requirePermission('workers', 'view'), async (_req, res) => {
  try {
    const workers = await User.find({ role: 'worker' }).sort({ createdAt: -1 });
    res.json(workers.map(serializeUser));
  } catch (error) {
    res.status(500).json({ message: 'Workers could not be loaded.' });
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
    sendWorkerAccountEmail(sendWorkerWelcomeEmail(worker, temporaryPassword, req.user), 'welcome', worker);
    res.status(201).json({ worker: serializeUser(worker), temporaryPassword });
  } catch (error) {
    res.status(500).json({ message: 'Worker account could not be created.' });
  }
});

router.patch('/:id', requirePermission('workers', 'manage'), async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    if (rejectProtectedWorker(req, res, worker)) return;
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
    if (rejectProtectedWorker(req, res, worker)) return;
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
    if (rejectProtectedWorker(req, res, worker)) return;
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
    if (rejectProtectedWorker(req, res, worker)) return;
    const temporaryPassword = makeTemporaryPassword();
    worker.passwordHistory = [...(worker.passwordHistory || []), worker.password].slice(-5);
    worker.password = await bcrypt.hash(temporaryPassword, 10);
    worker.sessionVersion = Number(worker.sessionVersion || 0) + 1;
    worker.mustChangePassword = true;
    await worker.save();
    void recordAccessAudit(req, 'worker.password_reset', { targetUser: worker._id });
    sendWorkerAccountEmail(sendWorkerPasswordResetEmail(worker, temporaryPassword, req.user), 'password reset', worker);
    res.json({ worker: serializeUser(worker), temporaryPassword });
  } catch (error) {
    res.status(500).json({ message: 'Worker password could not be reset.' });
  }
});

router.get('/:id/activity', requirePermission('workers', 'view'), async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
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

    const deletedWorker = await User.findOneAndDelete({ _id: worker._id, role: 'worker', active: false });
    if (!deletedWorker) {
      return res.status(409).json({ message: 'The worker account changed status. Disable it again before deleting.' });
    }
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
