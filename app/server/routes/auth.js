const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

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

router.post('/login', async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(400).json({ message: 'Invalid password' });

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
        notificationEmails: user.notificationEmails || []
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
