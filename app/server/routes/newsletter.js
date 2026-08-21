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
const { rateLimit: distributedRateLimit, clientIp } = require('../utils/rate-limit');
const { emailField, objectId, stringField } = require('../utils/validation');
const { createUnsubscribeToken, hashUnsubscribeToken, verifyUnsubscribeToken } = require('../utils/newsletter-token');

const router = express.Router();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const DELIVERY_BATCH_SIZE = Math.max(1, Number(process.env.NEWSLETTER_BATCH_SIZE || 5));

function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

const subscribeLimit = distributedRateLimit({ scope: 'newsletter-subscribe', limit: MAX_ATTEMPTS, windowMs: WINDOW_MS });
const unsubscribeLimit = distributedRateLimit({ scope: 'newsletter-unsubscribe', limit: 20, windowMs: WINDOW_MS });
const testLimit = distributedRateLimit({ scope: 'newsletter-test', limit: 10, windowMs: WINDOW_MS, key: (req) => `${clientIp(req)}:${req.user.id}` });
const sendLimit = distributedRateLimit({ scope: 'newsletter-send', limit: 5, windowMs: WINDOW_MS, key: (req) => `${clientIp(req)}:${req.user.id}` });

async function getCmsEmailData() {
  const docs = await Content.find({ key: { $in: ['contact', 'footer', 'branding'] } }).lean();
  return docs.reduce((result, document) => {
    result[document.key] = document.data;
    return result;
  }, {});
}

async function getEligiblePost(postId) {
  objectId(postId, 'News article ID');
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
  let subscriber = null;
  const signedId = String(token).split('.')[0];
  if (require('mongoose').isValidObjectId(signedId)) {
    const candidate = await NewsletterSubscriber.findById(signedId);
    if (candidate && verifyUnsubscribeToken(token, candidate)) subscriber = candidate;
  }
  // Backward compatibility for links sent before signed tokens were introduced.
  if (!subscriber) subscriber = await NewsletterSubscriber.findOne({ unsubscribeToken: token });
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
      NewsletterSubscriber.find({ status: 'subscribed' }).select('email').lean(),
      getCmsEmailData()
    ]);
    const brandingData = await buildEmailBranding(cmsData);
    let sentCount = 0; let failedCount = 0; let lastError = '';
    for (let start = 0; start < subscribers.length; start += DELIVERY_BATCH_SIZE) {
      const batch = subscribers.slice(start, start + DELIVERY_BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((subscriber) => sendNewsArticle({
        post, subscriber: { ...subscriber, unsubscribeToken: createUnsubscribeToken(subscriber) }, cmsData, brandingData, subject: campaign.subject, previewText: campaign.previewText
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
    }, { returnDocument: 'after' }).populate('post', 'title slug').lean();
    io?.to('owners').emit('newsletter_campaign_change', { action: 'complete', data: updated });
  } catch (error) {
    const updated = await NewsletterCampaign.findByIdAndUpdate(campaignId, {
      status: 'failed', lastError: String(error.message || 'Campaign failed').slice(0, 500), completedAt: new Date()
    }, { returnDocument: 'after' }).populate('post', 'title slug').lean();
    console.error('[newsletter] campaign failed', { campaignId: String(campaignId), message: error.message });
    io?.to('owners').emit('newsletter_campaign_change', { action: 'failed', data: updated });
  }
}

router.post('/subscribe', subscribeLimit, async (req, res) => {
  try {
    if (String(req.body?.website || '').trim()) return res.json({ message: 'Subscription received.' });
    const email = emailField(req.body?.email);
    if (req.body?.policyAcknowledged !== true) return res.status(400).json({ message: 'Please acknowledge the Privacy Policy before subscribing.' });
    let subscriber = await NewsletterSubscriber.findOne({ email });
    if (subscriber) {
      subscriber.status = 'subscribed'; subscriber.consentAt = new Date(); subscriber.unsubscribedAt = undefined;
      subscriber.unsubscribeToken = hashUnsubscribeToken(createUnsubscribeToken(subscriber));
      subscriber.ipAddress = req.ip; subscriber.userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
      await subscriber.save();
    } else {
      subscriber = new NewsletterSubscriber({ email, status: 'subscribed', consentAt: new Date(), ipAddress: req.ip,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500), unsubscribeToken: crypto.randomBytes(32).toString('hex') });
      subscriber.unsubscribeToken = hashUnsubscribeToken(createUnsubscribeToken(subscriber));
      await subscriber.save();
    }
    res.status(201).json({ message: 'You are subscribed to Bestworth news.' });
  } catch (error) {
    if (/invalid|required|characters/i.test(error.message)) return res.status(400).json({ message: error.message });
    console.error('[newsletter] subscribe failed:', error.message);
    res.status(500).json({ message: 'Subscription could not be completed.' });
  }
});

router.post('/unsubscribe', unsubscribeLimit, async (req, res) => {
  try {
    const subscriber = await unsubscribeByToken(String(req.body?.token || '').trim());
    if (!subscriber) return res.status(404).json({ message: 'This unsubscribe link is not valid.' });
    res.json({ message: 'You have been unsubscribed from Bestworth news.' });
  } catch (error) { console.error('[newsletter] unsubscribe failed:', error.message); res.status(500).json({ message: 'Unable to unsubscribe right now.' }); }
});

router.post('/unsubscribe/one-click', unsubscribeLimit, async (req, res) => {
  try {
    const subscriber = await unsubscribeByToken(String(req.query.token || req.body?.token || '').trim());
    if (!subscriber) return res.status(404).send('Subscription not found.');
    res.status(200).send('Unsubscribed');
  } catch { res.status(500).send('Unable to unsubscribe.'); }
});

router.get('/admin/subscribers', auth, requireAdmin, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = { status: 'subscribed', ...(search ? { email: { $regex: search, $options: 'i' } } : {}) };
    const [subscribers, total] = await Promise.all([
      NewsletterSubscriber.find(query).select('email status consentAt createdAt').sort({ createdAt: -1 }).limit(200).lean(),
      NewsletterSubscriber.countDocuments({ status: 'subscribed' })
    ]);
    res.json({ subscribers, total });
  } catch (error) { console.error('[newsletter] subscriber list failed:', error.message); res.status(500).json({ message: 'Subscribers could not be loaded.' }); }
});

router.get('/admin/news-options', auth, requireAdmin, async (_req, res) => {
  try {
    const [items, subscriberCount] = await Promise.all([
      NewsMediaPost.find({ type: 'news', status: 'published', publishedAt: { $lte: new Date() } })
        .select('title slug excerpt coverImage publishedAt').sort({ publishedAt: -1 }).limit(100).lean(),
      NewsletterSubscriber.countDocuments({ status: 'subscribed' })
    ]);
    res.json({ items, subscriberCount });
  } catch (error) { console.error('[newsletter] news options failed:', error.message); res.status(500).json({ message: 'News options could not be loaded.' }); }
});

router.get('/admin/campaigns', auth, requireAdmin, async (_req, res) => {
  try {
    const campaigns = await NewsletterCampaign.find().populate('post', 'title slug')
      .populate('initiatedBy', 'fullName username').sort({ createdAt: -1 }).limit(30).lean();
    res.json({ campaigns });
  } catch (error) { console.error('[newsletter] campaigns failed:', error.message); res.status(500).json({ message: 'Campaigns could not be loaded.' }); }
});

router.post('/admin/test', auth, requireAdmin, testLimit, async (req, res) => {
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

router.post('/admin/send', auth, requireAdmin, sendLimit, async (req, res) => {
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
