const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttemptStore = new Map();

function isAdminPasswordChangeAllowed() {
  return process.env.ALLOW_ADMIN_PASSWORD_CHANGE !== 'false';
}

function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim() : '';
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

function getClientLoginKey(req, username) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ipAddress = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : req.ip;

  return `${ipAddress}:${username || 'unknown'}`;
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

router.post('/login', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  const loginKey = getClientLoginKey(req, username);
  const attemptRecord = getAttemptRecord(loginKey);

  try {
    if (attemptRecord.attempts >= MAX_LOGIN_ATTEMPTS) {
      return res.status(429).json({
        message: 'Too many failed login attempts. Please wait before trying again.'
      });
    }

    const user = await User.findOne({ username });
    if (!user) {
      attemptRecord.attempts += 1;
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      attemptRecord.attempts += 1;
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    loginAttemptStore.delete(loginKey);

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: String(user._id),
        username: user.username
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username notificationEmails createdAt updatedAt');
    if (!user) {
      return res.status(404).json({ message: 'Admin account not found' });
    }

    res.json({
      id: String(user._id),
      username: user.username,
      notificationEmails: user.notificationEmails || [],
      passwordChangeLocked: !isAdminPasswordChangeAllowed(),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
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

    const validCurrentPassword = await bcrypt.compare(currentPassword || '', user.password);
    if (!validCurrentPassword) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    if (!nextUsername) {
      return res.status(400).json({ message: 'Username is required' });
    }

    if (notificationEmails.some((email) => !isValidEmail(email))) {
      return res.status(400).json({ message: 'Enter only valid company email addresses' });
    }

    if (nextUsername !== user.username) {
      const existingUser = await User.findOne({ username: nextUsername, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: 'That username is already in use' });
      }
    }

    let passwordChanged = false;
    if (newPassword || confirmNewPassword) {
      if (!isAdminPasswordChangeAllowed()) {
        return res.status(403).json({ message: 'Password changes are temporarily disabled during preview.' });
      }

      if (!newPassword || !confirmNewPassword) {
        return res.status(400).json({ message: 'Enter and confirm the new password' });
      }

      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ message: 'New passwords do not match' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }

      if (await hasUsedPassword(user, newPassword)) {
        return res.status(400).json({ message: 'You cannot reuse a current or past password' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.passwordHistory = [...(user.passwordHistory || []), user.password];
      user.password = hashedPassword;
      passwordChanged = true;
    }

    user.username = nextUsername;
    user.notificationEmails = notificationEmails;
    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '8h' }
    );

    res.json({
      message: passwordChanged
        ? 'Admin username and password updated successfully'
        : 'Admin username updated successfully',
      token,
      user: {
        id: String(user._id),
        username: user.username,
        notificationEmails: user.notificationEmails || [],
        passwordChangeLocked: !isAdminPasswordChangeAllowed()
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
