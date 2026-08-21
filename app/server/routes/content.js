const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const auth = require('../middleware/auth');
const { requireSessionReady } = require('../middleware/authorize');
const { hasPermission } = require('../utils/permissions');
const {
  hydrateMediaFieldsForResponse,
  normalizeMediaFieldsForStorage
} = require('../utils/public-url');

const PUBLIC_KEYS = new Set(['hero', 'about', 'values', 'values_settings', 'contact', 'footer', 'branding', 'privacy_policy', 'cookie_policy', 'leadership', 'categories']);
const EDITABLE_KEYS = new Set([...PUBLIC_KEYS, 'email_templates']);
const MAX_CONTENT_BYTES = 350 * 1024;

function validateContentData(key, body) {
  if (key === 'privacy_policy' || key === 'cookie_policy') {
    if (typeof body.html !== 'string' || body.html.length > 300 * 1024) throw new Error('Policy HTML is invalid or too large.');
  }
  if (key === 'contact' && body.mapUrl) {
    let mapUrl;
    try { mapUrl = new URL(body.mapUrl); } catch { throw new Error('Map URL is invalid.'); }
    const allowedHost = mapUrl.hostname === 'google.com' || mapUrl.hostname === 'www.google.com' || mapUrl.hostname === 'maps.google.com';
    if (mapUrl.protocol !== 'https:' || !allowedHost || !mapUrl.pathname.startsWith('/maps')) throw new Error('Use a secure Google Maps embed URL.');
  }
  if (key === 'values' && (!Array.isArray(body) || body.length > 50)) throw new Error('Values content is invalid.');
  if (key === 'categories' && (!Array.isArray(body) || body.length > 100)) throw new Error('Categories content is invalid.');
  return body;
}

// @route   GET /api/content/:key
// @desc    Get content by key
// @access  Public
router.get('/:key', async (req, res) => {
  try {
    if (!PUBLIC_KEYS.has(req.params.key)) return res.status(404).json({ msg: 'Content not found' });
    const content = await Content.findOne({ key: req.params.key });
    if (!content) return res.status(404).json({ msg: 'Content not found' });
    res.json(hydrateMediaFieldsForResponse(req, content.data));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   GET /api/content
// @desc    Get all content
// @access  Public
router.get('/', auth, requireSessionReady, async (req, res) => {
  try {
    const contents = await Content.find();
    const result = {};
    contents.forEach(c => {
      result[c.key] = hydrateMediaFieldsForResponse(req, c.data);
    });
    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @route   POST /api/content/:key
// @desc    Update content by key
// @access  Private (Admin)
router.post('/:key', auth, requireSessionReady, (req, res, next) => {
  if (!EDITABLE_KEYS.has(req.params.key)) return res.status(400).json({ message: 'Unknown content section.' });
  let bodySize = 0;
  try { bodySize = Buffer.byteLength(JSON.stringify(req.body)); } catch { return res.status(400).json({ message: 'Invalid content data.' }); }
  const arrayAllowed = ['values', 'categories', 'email_templates'].includes(req.params.key);
  if (!req.body || typeof req.body !== 'object' || (Array.isArray(req.body) && !arrayAllowed) || bodySize > MAX_CONTENT_BYTES) {
    return res.status(400).json({ message: 'Content data is invalid or too large.' });
  }
  const moduleName = req.params.key === 'categories'
    ? 'catalog'
    : req.params.key === 'leadership'
      ? 'leadership'
      : req.params.key === 'email_templates'
        ? 'inquiries'
        : 'cms';

  if (!hasPermission(req.user, moduleName, 'manage')) {
    return res.status(403).json({ message: 'You do not have permission to update this content.', code: 'ACCESS_DENIED' });
  }
  next();
}, async (req, res) => {
  try {
    let content = await Content.findOne({ key: req.params.key });
    
    if (content) {
      content.data = normalizeMediaFieldsForStorage(validateContentData(req.params.key, req.body));
      content.updatedAt = Date.now();
    } else {
      content = new Content({
        key: req.params.key,
        data: normalizeMediaFieldsForStorage(validateContentData(req.params.key, req.body))
      });
    }

    await content.save();
    
    // Broadcast change via Socket.io
    const io = req.app.get('io');
    if (io) {
      const target = req.params.key === 'email_templates' ? io.to('module:inquiries') : io;
      target.emit('content_change', {
        key: req.params.key,
        data: hydrateMediaFieldsForResponse(req, content.data)
      });
    }

    res.json(hydrateMediaFieldsForResponse(req, content.data));
  } catch (err) {
    console.error(err.message);
    if (/invalid|too large|secure Google Maps/i.test(err.message)) return res.status(400).json({ message: err.message });
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
