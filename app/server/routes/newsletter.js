const express = require('express');
const crypto = require('crypto');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const NewsletterCampaign = require('../models/NewsletterCampaign');
const NewsMediaPost = require('../models/NewsMediaPost');
const Content = require('../models/Content');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');
const { sendNewsArticle } = require('../utils/newsletter-email');
const { buildEmailBranding } = require('../utils/email');

const router = express.Router();
const subscribeAttempts = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const DELIVERY_BATCH_SIZE = Math.max(1, Number(process.env.NEWSLETTER_BATCH_SIZE || 5));

function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

function rateLimit(req, res, next) {
  const key = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const current = subscribeAttempts.get(key);
  const record = !current || current.expiresAt <= now ? { count: 0, expiresAt: now + WINDOW_MS } : current;
  record.count += 1;
  subscribeAttempts.set(key, record);
  if (record.count > MAX_ATTEMPTS) return res.status(429).json({ message: 'Too many subscription attempts. Please try again later.' });
  next();
}

async function getCmsEmailData() {
  const docs = await Content.find({ key: { $in: ['contact', 'footer', 'branding'] } }).lean();
  return docs.reduce((result, document) => {
    result[document.key] = document.data;
    return result;
  }, {});
}

async function getEligiblePost(postId) {
  const post = await NewsMediaPost.findById(postId).lean();
  if (!post) { const error = new Error('News article not found.'); error.statusCode = 404; throw error; }
  if (post.type !== 'news') { const error = new Error('Video updates cannot be sent to newsletter subscribers.'); error.statusCode = 400; throw error; }
  if (post.status !== 'published' || !post.publishedAt || new Date(post.publishedAt) > new Date()) {
    const error = new Error('Publish this news article before preparing an email.'); error.statusCode = 400; throw error;
  }
  return post;
}

async function unsubscribeByToken(token) {
  if (!token) return null;
  const subscriber = await NewsletterSubscriber.findOne({ unsubscribeToken: token });
  if (!subscriber) return null;
  if (subscriber.status !== 'unsubscribed') {
    subscriber.status = 'unsubscribed'; subscriber.unsubscribedAt = new Date(); await subscriber.save();
  }
  return subscriber;
}

async function deliverCampaign(campaignId, io) {
  const campaign = await NewsletterCampaign.findById(campaignId).lean();
  if (!campaign) return;
  try {
    const [post, subscribers, cmsData] = await Promise.all([
      getEligiblePost(campaign.post),
      NewsletterSubscriber.find({ status: 'subscribed' }).select('email unsubscribeToken').lean(),
      getCmsEmailData()
    ]);
    const brandingData = await buildEmailBranding(cmsData);
    let sentCount = 0; let failedCount = 0; let lastError = '';
    for (let start = 0; start < subscribers.length; start += DELIVERY_BATCH_SIZE) {
      const batch = subscribers.slice(start, start + DELIVERY_BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((subscriber) => sendNewsArticle({
        post, subscriber, cmsData, brandingData, subject: campaign.subject, previewText: campaign.previewText
      })));
      results.forEach((result) => {
        if (result.status === 'fulfilled') sentCount += 1;
        else { failedCount += 1; lastError = String(result.reason?.message || 'Email delivery failed').slice(0, 500); }
      });
      await NewsletterCampaign.findByIdAndUpdate(campaignId, { sentCount, failedCount, lastError });
    }
    const status = failedCount === 0 ? 'sent' : sentCount > 0 ? 'partial' : 'failed';
    const updated = await NewsletterCampaign.findByIdAndUpdate(campaignId, {
      status, sentCount, failedCount, lastError, completedAt: new Date()
    }, { new: true }).populate('post', 'title slug').lean();
    io?.emit('newsletter_campaign_change', { action: 'complete', data: updated });
  } catch (error) {
    const updated = await NewsletterCampaign.findByIdAndUpdate(campaignId, {
      status: 'failed', lastError: String(error.message || 'Campaign failed').slice(0, 500), completedAt: new Date()
    }, { new: true }).populate('post', 'title slug').lean();
    console.error('[newsletter] campaign failed', { campaignId: String(campaignId), message: error.message });
    io?.emit('newsletter_campaign_change', { action: 'failed', data: updated });
  }
}

router.post('/subscribe', rateLimit, async (req, res) => {
  try {
    if (String(req.body?.website || '').trim()) return res.json({ message: 'Subscription received.' });
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (req.body?.policyAcknowledged !== true) return res.status(400).json({ message: 'Please acknowledge the Privacy Policy before subscribing.' });
    let subscriber = await NewsletterSubscriber.findOne({ email });
    if (subscriber) {
      subscriber.status = 'subscribed'; subscriber.consentAt = new Date(); subscriber.unsubscribedAt = undefined;
      subscriber.unsubscribeToken = subscriber.unsubscribeToken || crypto.randomBytes(32).toString('hex');
      subscriber.ipAddress = req.ip; subscriber.userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
      await subscriber.save();
    } else {
      subscriber = await NewsletterSubscriber.create({ email, status: 'subscribed', consentAt: new Date(),
        unsubscribeToken: crypto.randomBytes(32).toString('hex'), ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500) });
    }
    res.status(201).json({ message: 'You are subscribed to Bestworth news.' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const subscriber = await unsubscribeByToken(String(req.body?.token || '').trim());
    if (!subscriber) return res.status(404).json({ message: 'This unsubscribe link is not valid.' });
    res.json({ message: 'You have been unsubscribed from Bestworth news.' });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/unsubscribe/one-click', async (req, res) => {
  try {
    const subscriber = await unsubscribeByToken(String(req.query.token || req.body?.token || '').trim());
    if (!subscriber) return res.status(404).send('Subscription not found.');
    res.status(200).send('Unsubscribed');
  } catch { res.status(500).send('Unable to unsubscribe.'); }
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
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/admin/news-options', auth, requireAdmin, async (_req, res) => {
  try {
    const [items, subscriberCount] = await Promise.all([
      NewsMediaPost.find({ type: 'news', status: 'published', publishedAt: { $lte: new Date() } })
        .select('title slug excerpt coverImage publishedAt').sort({ publishedAt: -1 }).limit(100).lean(),
      NewsletterSubscriber.countDocuments({ status: 'subscribed' })
    ]);
    res.json({ items, subscriberCount });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/admin/campaigns', auth, requireAdmin, async (_req, res) => {
  try {
    const campaigns = await NewsletterCampaign.find().populate('post', 'title slug')
      .populate('initiatedBy', 'fullName username').sort({ createdAt: -1 }).limit(30).lean();
    res.json({ campaigns });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/admin/test', auth, requireAdmin, async (req, res) => {
  try {
    const post = await getEligiblePost(req.body?.postId);
    const email = String(req.body?.email || req.user.email || '').trim().toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ message: 'Enter a valid test email address.' });
    const subject = String(req.body?.subject || `${post.title} | Bestworth News`).trim().slice(0, 200);
    const previewText = String(req.body?.previewText || post.excerpt).trim().slice(0, 300);
    const campaign = await NewsletterCampaign.create({ post: post._id, subject, previewText, status: 'sending',
      isTest: true, testEmail: email, recipientCount: 1, initiatedBy: req.user.id });
    try {
      const cmsData = await getCmsEmailData();
      await sendNewsArticle({ post, subscriber: { email }, cmsData, brandingData: await buildEmailBranding(cmsData), subject, previewText, isTest: true });
      campaign.status = 'sent'; campaign.sentCount = 1;
    } catch (error) {
      campaign.status = 'failed'; campaign.failedCount = 1; campaign.lastError = String(error.message).slice(0, 500); throw error;
    } finally { campaign.completedAt = new Date(); await campaign.save(); }
    res.json({ message: `Test email sent to ${email}.` });
  } catch (error) { res.status(error.statusCode || 500).json({ message: error.message || 'Could not send test email.' }); }
});

router.post('/admin/send', auth, requireAdmin, async (req, res) => {
  try {
    const post = await getEligiblePost(req.body?.postId);
    const subject = String(req.body?.subject || `${post.title} | Bestworth News`).trim().slice(0, 200);
    const previewText = String(req.body?.previewText || post.excerpt).trim().slice(0, 300);
    if (!subject) return res.status(400).json({ message: 'An email subject is required.' });
    const prior = await NewsletterCampaign.findOne({ post: post._id, isTest: false, status: { $in: ['sending', 'sent', 'partial'] } });
    if (prior && req.body?.confirmResend !== true) return res.status(409).json({ message: 'This article has already been sent or is currently sending.', code: 'RESEND_CONFIRMATION_REQUIRED' });
    if (prior?.status === 'sending') return res.status(409).json({ message: 'This article is already being delivered.' });
    const recipientCount = await NewsletterSubscriber.countDocuments({ status: 'subscribed' });
    if (!recipientCount) return res.status(400).json({ message: 'There are no active subscribers to receive this article.' });
    const campaign = await NewsletterCampaign.create({ post: post._id, subject, previewText, status: 'sending',
      isTest: false, recipientCount, initiatedBy: req.user.id });
    res.status(202).json({ message: `Delivery started for ${recipientCount} subscriber${recipientCount === 1 ? '' : 's'}.`, campaign });
    setImmediate(() => void deliverCampaign(campaign._id, req.app.get('io')));
  } catch (error) { res.status(error.statusCode || 500).json({ message: error.message || 'Could not start newsletter delivery.' }); }
});

module.exports = router;
