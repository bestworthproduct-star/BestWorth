const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const AccessAudit = require('../models/AccessAudit');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');
const { normalizePermissions, serializeUser } = require('../utils/permissions');
const { recordAccessAudit } = require('../utils/access-audit');

const router = express.Router();
router.use(auth, requireAdmin);

const normalizeUsername = (value) => String(value || '').trim().toLowerCase();
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const makeTemporaryPassword = () => `${crypto.randomBytes(6).toString('base64url')}!7a`;

async function findWorker(id) {
  return User.findOne({ _id: id, role: 'worker' });
}

router.get('/', async (_req, res) => {
  try {
    const workers = await User.find({ role: 'worker' }).sort({ createdAt: -1 });
    res.json(workers.map(serializeUser));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || '').trim();
    const username = normalizeUsername(req.body?.username);
    const email = normalizeEmail(req.body?.email);
    if (!fullName || !username || !email) {
      return res.status(400).json({ message: 'Full name, username and email are required.' });
    }
    if (!validEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (await User.exists({ $or: [{ username }, { email }] })) {
      return res.status(409).json({ message: 'That username or email is already in use.' });
    }

    const temporaryPassword = makeTemporaryPassword();
    const worker = await User.create({
      fullName,
      username,
      email,
      password: await bcrypt.hash(temporaryPassword, 10),
      role: 'worker',
      permissions: normalizePermissions('worker', req.body?.permissions),
      active: true,
      mustChangePassword: true,
      createdBy: req.user.id
    });
    void recordAccessAudit(req, 'worker.created', { targetUser: worker._id });
    res.status(201).json({ worker: serializeUser(worker), temporaryPassword });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    const fullName = String(req.body?.fullName ?? worker.fullName).trim();
    const username = normalizeUsername(req.body?.username ?? worker.username);
    const email = normalizeEmail(req.body?.email ?? worker.email);
    if (!fullName || !username || !validEmail(email)) {
      return res.status(400).json({ message: 'Enter a full name, username and valid email.' });
    }
    if (await User.exists({ _id: { $ne: worker._id }, $or: [{ username }, { email }] })) {
      return res.status(409).json({ message: 'That username or email is already in use.' });
    }
    worker.fullName = fullName;
    worker.username = username;
    worker.email = email;
    await worker.save();
    void recordAccessAudit(req, 'worker.profile_updated', { targetUser: worker._id });
    res.json({ worker: serializeUser(worker) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/permissions', async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    worker.permissions = normalizePermissions('worker', req.body?.permissions);
    await worker.save();
    void recordAccessAudit(req, 'worker.permissions_updated', {
      targetUser: worker._id,
      metadata: { permissions: worker.permissions.toObject?.() || worker.permissions }
    });
    res.json({ worker: serializeUser(worker) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    if (typeof req.body?.active !== 'boolean') {
      return res.status(400).json({ message: 'An active status is required.' });
    }
    worker.active = req.body.active;
    await worker.save();
    void recordAccessAudit(req, req.body.active ? 'worker.enabled' : 'worker.disabled', { targetUser: worker._id });
    res.json({ worker: serializeUser(worker) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/reset-password', async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    const temporaryPassword = makeTemporaryPassword();
    worker.passwordHistory = [...(worker.passwordHistory || []), worker.password].slice(-5);
    worker.password = await bcrypt.hash(temporaryPassword, 10);
    worker.mustChangePassword = true;
    await worker.save();
    void recordAccessAudit(req, 'worker.password_reset', { targetUser: worker._id });
    res.json({ worker: serializeUser(worker), temporaryPassword });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/activity', async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);
    if (!worker) return res.status(404).json({ message: 'Worker not found.' });
    const activity = await AccessAudit.find({
      $or: [{ actor: worker._id }, { targetUser: worker._id }]
    }).sort({ createdAt: -1 }).limit(40).lean();
    res.json(activity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
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
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
