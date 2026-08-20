const express = require('express');
const crypto = require('crypto');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');

const router = express.Router();
const subscribeAttempts = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function rateLimit(req, res, next) {
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const current = subscribeAttempts.get(key);
  const record = !current || current.expiresAt <= now ? { count: 0, expiresAt: now + WINDOW_MS } : current;
  record.count += 1;
  subscribeAttempts.set(key, record);
  if (record.count > MAX_ATTEMPTS) {
    return res.status(429).json({ message: 'Too many subscription attempts. Please try again later.' });
  }
  next();
}

router.post('/subscribe', rateLimit, async (req, res) => {
  try {
    if (String(req.body?.website || '').trim()) return res.json({ message: 'Subscription received.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (req.body?.policyAcknowledged !== true) {
      return res.status(400).json({ message: 'Please acknowledge the Privacy Policy before subscribing.' });
    }

    let subscriber = await NewsletterSubscriber.findOne({ email });
    if (subscriber) {
      subscriber.status = 'subscribed';
      subscriber.consentAt = new Date();
      subscriber.unsubscribedAt = undefined;
      subscriber.ipAddress = req.ip;
      subscriber.userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
      await subscriber.save();
    } else {
      subscriber = await NewsletterSubscriber.create({
        email,
        status: 'subscribed',
        consentAt: new Date(),
        unsubscribeToken: crypto.randomBytes(32).toString('hex'),
        ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500)
      });
    }
    res.status(201).json({ message: 'You are subscribed to Bestworth updates.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const subscriber = await NewsletterSubscriber.findOne({ unsubscribeToken: token });
    if (!subscriber) return res.status(404).json({ message: 'Subscription not found.' });
    subscriber.status = 'unsubscribed';
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();
    res.json({ message: 'You have been unsubscribed.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/admin/subscribers', auth, requireAdmin, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = { status: 'subscribed', ...(search ? { email: { $regex: search, $options: 'i' } } : {}) };
    const [subscribers, total] = await Promise.all([
      NewsletterSubscriber.find(query).select('email status consentAt createdAt').sort({ createdAt: -1 }).limit(200).lean(),
      NewsletterSubscriber.countDocuments({ status: 'subscribed' })
    ]);
    res.json({ subscribers, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
