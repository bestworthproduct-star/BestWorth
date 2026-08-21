const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { getRole, serializeUser } = require('../utils/permissions');
const { recordAccessAudit } = require('../utils/access-audit');
const { signAuthToken, setSessionCookie, clearSessionCookie } = require('../utils/auth-token');
const { rateLimit, consume, clientIp } = require('../utils/rate-limit');
const { escapeRegex } = require('../utils/validation');

const MAX_LOGIN_ATTEMPTS = 5;
const MAX_LOGIN_REQUESTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH = '$2b$10$7EqJtq98hPqEX7fNZaFWoO5h1HIYFQmMtYaHjZQ5S5rZ6YzYF7x7u';

function isAdminPasswordChangeAllowed() {
  return process.env.ALLOW_ADMIN_PASSWORD_CHANGE !== 'false';
}

function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim().toLowerCase() : '';
}

function exactCaseInsensitive(value) {
  return new RegExp(`^${escapeRegex(value, 80)}$`, 'i');
}

function normalizeNotificationEmails(value) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/)
      : [];

  return [...new Set(rawValues.filter((entry) => typeof entry === 'string').map((entry) => entry.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
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

const loginRequestLimit = rateLimit({ scope: 'auth-login-ip', limit: MAX_LOGIN_REQUESTS, windowMs: LOGIN_WINDOW_MS });
const sensitiveAuthLimit = rateLimit({ scope: 'auth-sensitive', limit: 10, windowMs: LOGIN_WINDOW_MS, key: (req) => `${clientIp(req)}:${req.user?.id || 'anonymous'}` });

router.post('/login', loginRequestLimit, async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  try {
    if (!username || username.length > 80 || !password || password.length > 200) return res.status(400).json({ message: 'Invalid username or password' });

    const user = await User.findOne({ username: exactCaseInsensitive(username) });
    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      const failed = await consume('auth-login-account', `${clientIp(req)}:${username}`, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
      if (!failed.allowed) return res.status(429).json({ message: 'Too many failed login attempts. Please wait before trying again.', retryAfterSeconds: failed.retryAfterSeconds });
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      const failed = await consume('auth-login-account', `${clientIp(req)}:${username}`, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
      if (!failed.allowed) return res.status(429).json({ message: 'Too many failed login attempts. Please wait before trying again.', retryAfterSeconds: failed.retryAfterSeconds });
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    if (user.active === false) {
      return res.status(403).json({ message: 'This account has been disabled.', code: 'ACCOUNT_DISABLED' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signAuthToken(user);
    setSessionCookie(res, token);

    res.json({
      user: serializeUser(user)
    });
    void recordAccessAudit(req, 'auth.login', { actor: user._id });
  } catch (err) {
    console.error('[auth] login failed:', err.message);
    res.status(500).json({ message: 'Sign-in could not be completed.' });
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
    console.error('[auth] profile lookup failed:', err.message);
    res.status(500).json({ message: 'Account details could not be loaded.' });
  }
});

router.post('/settings', auth, sensitiveAuthLimit, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const confirmNewPassword = typeof req.body?.confirmNewPassword === 'string' ? req.body.confirmNewPassword : '';
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

    const validCurrentPassword = await bcrypt.compare(currentPassword || '', user.password);
    if (!validCurrentPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (!nextUsername || nextUsername.length > 80 || !/^[a-z0-9._-]+$/.test(nextUsername)) {
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

      if (newPassword.length < 12 || newPassword.length > 200) {
        return res.status(400).json({ message: 'New password must be between 12 and 200 characters' });
      }

      if (await hasUsedPassword(user, newPassword)) {
        return res.status(400).json({ message: 'You cannot reuse a current or past password' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.passwordHistory = [...(user.passwordHistory || []), user.password].slice(-5);
      user.password = hashedPassword;
      user.sessionVersion = Number(user.sessionVersion || 0) + 1;
      passwordChanged = true;
    }

    user.username = nextUsername;
    if (getRole(user) === 'admin') {
      user.notificationEmails = notificationEmails;
    }
    user.mustChangePassword = false;
    await user.save();

    const token = signAuthToken(user);
    setSessionCookie(res, token);

    res.json({
      message: passwordChanged
        ? 'Username and password updated successfully'
        : 'Account settings updated successfully',
      user: {
        ...serializeUser(user),
        notificationEmails: user.notificationEmails || [],
        passwordChangeLocked: getRole(user) === 'admin' && !isAdminPasswordChangeAllowed()
      }
    });
    if (passwordChanged) void recordAccessAudit(req, 'auth.password_changed', { targetUser: user._id });
    if (usernameChanged) void recordAccessAudit(req, 'auth.username_changed', { targetUser: user._id });
  } catch (err) {
    console.error('[auth] settings update failed:', err.message);
    res.status(500).json({ message: 'Account settings could not be updated.' });
  }
});

router.post('/change-password', auth, sensitiveAuthLimit, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const confirmNewPassword = typeof req.body?.confirmNewPassword === 'string' ? req.body.confirmNewPassword : '';

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Account not found' });
    if (getRole(user) === 'admin' && !isAdminPasswordChangeAllowed()) {
      return res.status(403).json({ message: 'Password changes are temporarily disabled during preview.' });
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Temporary password is incorrect' });
    }
    if (newPassword.length < 12 || newPassword.length > 200) {
      return res.status(400).json({ message: 'New password must be between 12 and 200 characters' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }
    if (await hasUsedPassword(user, newPassword)) {
      return res.status(400).json({ message: 'You cannot reuse a current or past password' });
    }

    user.passwordHistory = [...(user.passwordHistory || []), user.password].slice(-5);
    user.password = await bcrypt.hash(newPassword, 10);
    user.sessionVersion = Number(user.sessionVersion || 0) + 1;
    user.mustChangePassword = false;
    await user.save();
    void recordAccessAudit(req, 'auth.temporary_password_changed', { targetUser: user._id });

    const token = signAuthToken(user);
    setSessionCookie(res, token);
    res.json({ message: 'Password changed successfully', user: serializeUser(user) });
  } catch (err) {
    console.error('[auth] password change failed:', err.message);
    res.status(500).json({ message: 'Password could not be changed.' });
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ message: 'Signed out successfully' });
});

module.exports = router;
