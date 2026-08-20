const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { getRole, serializeUser } = require('../utils/permissions');
const { recordAccessAudit } = require('../utils/access-audit');

const MAX_LOGIN_ATTEMPTS = 5;
const MAX_LOGIN_REQUESTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttemptStore = new Map();
const loginRequestStore = new Map();

function isAdminPasswordChangeAllowed() {
  return process.env.ALLOW_ADMIN_PASSWORD_CHANGE !== 'false';
}

function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim().toLowerCase() : '';
}

function exactCaseInsensitive(value) {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}

function normalizeNotificationEmails(value) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  return [...new Set(rawValues.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean))];
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function hasUsedPassword(user, plainPassword) {
  const hashes = [user.password, ...(user.passwordHistory || [])].filter(Boolean);

  for (const hash of hashes) {
    const matches = await bcrypt.compare(plainPassword, hash);
    if (matches) {
      return true;
    }
  }

  return false;
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getClientLoginKey(req, username) {
  return `${getClientIp(req)}:${username || 'unknown'}`;
}

function getAttemptRecord(key) {
  const now = Date.now();
  const existingRecord = loginAttemptStore.get(key);

  if (!existingRecord || existingRecord.expiresAt <= now) {
    const freshRecord = { attempts: 0, expiresAt: now + LOGIN_WINDOW_MS };
    loginAttemptStore.set(key, freshRecord);
    return freshRecord;
  }

  return existingRecord;
}

function enforceLoginRateLimit(req, res, next) {
  const now = Date.now();
  const clientIp = getClientIp(req);
  const existingRecord = loginRequestStore.get(clientIp);
  const record = !existingRecord || existingRecord.expiresAt <= now
    ? { requests: 0, expiresAt: now + LOGIN_WINDOW_MS }
    : existingRecord;

  record.requests += 1;
  loginRequestStore.set(clientIp, record);

  const retryAfterSeconds = Math.max(Math.ceil((record.expiresAt - now) / 1000), 1);
  res.setHeader('RateLimit-Limit', MAX_LOGIN_REQUESTS);
  res.setHeader('RateLimit-Remaining', Math.max(MAX_LOGIN_REQUESTS - record.requests, 0));
  res.setHeader('RateLimit-Reset', retryAfterSeconds);

  if (record.requests > MAX_LOGIN_REQUESTS) {
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      message: 'Too many login requests. Please wait before trying again.',
      retryAfterSeconds
    });
  }

  return next();
}

router.post('/login', enforceLoginRateLimit, async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  const loginKey = getClientLoginKey(req, username);
  const attemptRecord = getAttemptRecord(loginKey);

  try {
    if (attemptRecord.attempts >= MAX_LOGIN_ATTEMPTS) {
      const retryAfterSeconds = Math.max(Math.ceil((attemptRecord.expiresAt - Date.now()) / 1000), 1);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        message: 'Too many failed login attempts. Please wait before trying again.',
        retryAfterSeconds
      });
    }

    const user = await User.findOne({ username: exactCaseInsensitive(username) });
    if (!user) {
      attemptRecord.attempts += 1;
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      attemptRecord.attempts += 1;
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    if (user.active === false) {
      return res.status(403).json({ message: 'This account has been disabled.', code: 'ACCOUNT_DISABLED' });
    }

    loginAttemptStore.delete(loginKey);
    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: serializeUser(user)
    });
    void recordAccessAudit(req, 'auth.login', { actor: user._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Admin account not found' });
    }
    res.json({
      ...serializeUser(user),
      notificationEmails: user.notificationEmails || [],
      passwordChangeLocked: getRole(user) === 'admin' && !isAdminPasswordChangeAllowed()
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/settings', auth, async (req, res) => {
  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;
  const confirmNewPassword = req.body?.confirmNewPassword;
  const nextUsername = normalizeUsername(req.body?.username);
  const notificationEmails = normalizeNotificationEmails(req.body?.notificationEmails);

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Admin account not found' });
    }
    if (user.mustChangePassword) {
      return res.status(403).json({
        message: 'Change your temporary password before updating account settings.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }

    const passwordChangesAllowed = getRole(user) === 'worker' || isAdminPasswordChangeAllowed();

    if (passwordChangesAllowed) {
      const validCurrentPassword = await bcrypt.compare(currentPassword || '', user.password);
      if (!validCurrentPassword) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
    }

    if (!nextUsername) {
      return res.status(400).json({ message: 'Username is required' });
    }

    if (getRole(user) === 'admin' && notificationEmails.some((email) => !isValidEmail(email))) {
      return res.status(400).json({ message: 'Enter only valid company email addresses' });
    }

    const usernameChanged = nextUsername !== user.username;
    if (usernameChanged) {
      const existingUser = await User.findOne({ username: nextUsername, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: 'That username is already in use' });
      }
    }

    let passwordChanged = false;
    if (newPassword || confirmNewPassword) {
      if (!passwordChangesAllowed) {
        return res.status(403).json({ message: 'Password changes are temporarily disabled during preview.' });
      }

      if (!newPassword || !confirmNewPassword) {
        return res.status(400).json({ message: 'Enter and confirm the new password' });
      }

      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ message: 'New passwords do not match' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters' });
      }

      if (await hasUsedPassword(user, newPassword)) {
        return res.status(400).json({ message: 'You cannot reuse a current or past password' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.passwordHistory = [...(user.passwordHistory || []), user.password].slice(-5);
      user.password = hashedPassword;
      passwordChanged = true;
    }

    user.username = nextUsername;
    if (getRole(user) === 'admin') {
      user.notificationEmails = notificationEmails;
    }
    user.mustChangePassword = false;
    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '8h' }
    );

    res.json({
      message: passwordChanged
        ? 'Username and password updated successfully'
        : 'Account settings updated successfully',
      token,
      user: {
        ...serializeUser(user),
        notificationEmails: user.notificationEmails || [],
        passwordChangeLocked: getRole(user) === 'admin' && !isAdminPasswordChangeAllowed()
      }
    });
    if (passwordChanged) void recordAccessAudit(req, 'auth.password_changed', { targetUser: user._id });
    if (usernameChanged) void recordAccessAudit(req, 'auth.username_changed', { targetUser: user._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/change-password', auth, async (req, res) => {
  const currentPassword = req.body?.currentPassword || '';
  const newPassword = req.body?.newPassword || '';
  const confirmNewPassword = req.body?.confirmNewPassword || '';

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Account not found' });
    if (getRole(user) === 'admin' && !isAdminPasswordChangeAllowed()) {
      return res.status(403).json({ message: 'Password changes are temporarily disabled during preview.' });
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Temporary password is incorrect' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }
    if (await hasUsedPassword(user, newPassword)) {
      return res.status(400).json({ message: 'You cannot reuse a current or past password' });
    }

    user.passwordHistory = [...(user.passwordHistory || []), user.password].slice(-5);
    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();
    void recordAccessAudit(req, 'auth.temporary_password_changed', { targetUser: user._id });

    res.json({ message: 'Password changed successfully', user: serializeUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
