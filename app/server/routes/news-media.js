const express = require('express');
const NewsMediaPost = require('../models/NewsMediaPost');
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/authorize');
const { normalizeMediaFieldsForStorage, hydrateMediaFieldsForResponse } = require('../utils/public-url');
const { objectId, escapeRegex } = require('../utils/validation');

const router = express.Router();

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150) || `update-${Date.now()}`;
}

async function uniqueSlug(requestedSlug, title, excludeId) {
  const base = slugify(requestedSlug || title);
  let candidate = base;
  let suffix = 2;
  while (await NewsMediaPost.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}

function parsePage(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), max) : fallback;
}

function serialize(req, post) {
  const plain = typeof post.toObject === 'function' ? post.toObject() : post;
  return hydrateMediaFieldsForResponse(req, plain);
}

function validatePayload(body) {
  if (!String(body.title || '').trim()) return 'Title is required.';
  if (!['news', 'video'].includes(body.type)) return 'Choose News or Video.';
  if (!String(body.excerpt || '').trim()) return 'A short excerpt is required.';
  if (!String(body.body || '').trim()) return 'The article or video description is required.';
  if (body.type === 'news' && !String(body.coverImage || '').trim()) return 'A cover image is required for news posts.';
  if (body.type === 'video') {
    const value = String(body.videoUrl || '').trim();
    if (value.startsWith('/api/media/video/')) return null;
    if (value.length > 2048) return 'Video URL is too long.';
    try {
      const videoUrl = new URL(value);
      const protocols = process.env.NODE_ENV === 'production' ? ['https:'] : ['http:', 'https:'];
      if (!protocols.includes(videoUrl.protocol) || videoUrl.username || videoUrl.password) throw new Error('invalid');
    } catch {
      return 'Enter a valid YouTube, Vimeo or hosted video URL.';
    }
  }
  return null;
}

function buildPayload(req, existing) {
  const body = req.body || {};
  const status = body.status === 'published' ? 'published' : 'draft';
  const requestedDate = body.publishedAt ? new Date(body.publishedAt) : null;
  const publishedAt = requestedDate && !Number.isNaN(requestedDate.getTime())
    ? requestedDate
    : (status === 'published' ? existing?.publishedAt || new Date() : existing?.publishedAt || null);

  return normalizeMediaFieldsForStorage({
    title: String(body.title || '').trim().slice(0, 180),
    type: body.type,
    excerpt: String(body.excerpt || '').trim().slice(0, 500),
    body: String(body.body || '').trim().slice(0, 50000),
    coverImage: String(body.coverImage || '').trim().slice(0, 2048),
    videoUrl: body.type === 'video' ? String(body.videoUrl || '').trim().slice(0, 2048) : '',
    videoDuration: body.type === 'video' ? String(body.videoDuration || '').trim().slice(0, 20) : '',
    featured: body.featured === true,
    status,
    publishedAt,
    author: String(body.author || 'Bestworth Media').trim().slice(0, 100),
    seoTitle: String(body.seoTitle || '').trim().slice(0, 180),
    seoDescription: String(body.seoDescription || '').trim().slice(0, 320)
  });
}

router.get('/admin/list', auth, requirePermission('media', 'view'), async (req, res) => {
  try {
    const page = parsePage(req.query.page, 1, 100000);
    const limit = parsePage(req.query.limit, 20, 50);
    const query = {};
    if (['news', 'video'].includes(req.query.type)) query.type = req.query.type;
    if (['draft', 'published'].includes(req.query.status)) query.status = req.query.status;
    if (String(req.query.search || '').trim()) {
      const search = escapeRegex(req.query.search, 100);
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      NewsMediaPost.find(query).sort({ featured: -1, publishedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      NewsMediaPost.countDocuments(query)
    ]);
    res.json({ items: items.map((item) => serialize(req, item)), pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) } });
  } catch (error) {
    res.status(500).json({ message: 'Media updates could not be loaded.' });
  }
});

router.post('/admin', auth, requirePermission('media', 'manage'), async (req, res) => {
  try {
    const validationError = validatePayload(req.body || {});
    if (validationError) return res.status(400).json({ message: validationError });
    const payload = buildPayload(req);
    payload.slug = await uniqueSlug(req.body?.slug, payload.title);
    payload.createdBy = req.user.id;
    payload.updatedBy = req.user.id;
    if (payload.featured && payload.status === 'published') await NewsMediaPost.updateMany({}, { $set: { featured: false } });
    const post = await NewsMediaPost.create(payload);
    req.app.get('io')?.emit('news_media_change', { action: 'create', data: serialize(req, post) });
    res.status(201).json(serialize(req, post));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/admin/:id', auth, requirePermission('media', 'manage'), async (req, res) => {
  try {
    objectId(req.params.id, 'Post ID');
    const existing = await NewsMediaPost.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'News or media post not found.' });
    const validationError = validatePayload(req.body || {});
    if (validationError) return res.status(400).json({ message: validationError });
    const payload = buildPayload(req, existing);
    payload.slug = await uniqueSlug(req.body?.slug, payload.title, existing._id);
    payload.updatedBy = req.user.id;
    if (payload.featured && payload.status === 'published') await NewsMediaPost.updateMany({ _id: { $ne: existing._id } }, { $set: { featured: false } });
    Object.assign(existing, payload);
    await existing.save();
    req.app.get('io')?.emit('news_media_change', { action: 'update', data: serialize(req, existing) });
    res.json(serialize(req, existing));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/admin/:id', auth, requirePermission('media', 'manage'), async (req, res) => {
  try {
    objectId(req.params.id, 'Post ID');
    const deleted = await NewsMediaPost.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'News or media post not found.' });
    req.app.get('io')?.emit('news_media_change', { action: 'delete', id: req.params.id });
    res.json({ message: 'News or media post deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Media update could not be deleted.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parsePage(req.query.page, 1, 100000);
    const limit = parsePage(req.query.limit, 9, 24);
    const now = new Date();
    const query = { status: 'published', publishedAt: { $lte: now } };
    if (['news', 'video'].includes(req.query.type)) query.type = req.query.type;
    if (req.query.featured === 'true') query.featured = true;
    if (String(req.query.search || '').trim()) {
      const search = escapeRegex(req.query.search, 100);
      query.$or = [{ title: { $regex: search, $options: 'i' } }, { excerpt: { $regex: search, $options: 'i' } }];
    }
    const [items, total] = await Promise.all([
      NewsMediaPost.find(query).sort({ featured: -1, publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      NewsMediaPost.countDocuments(query)
    ]);
    res.json({ items: items.map((item) => serialize(req, item)), pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) } });
  } catch (error) {
    res.status(500).json({ message: 'Media updates could not be loaded.' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    if (typeof req.params.slug !== 'string' || !/^[a-z0-9-]{1,180}$/.test(req.params.slug)) return res.status(404).json({ message: 'News or media post not found.' });
    const post = await NewsMediaPost.findOne({ slug: req.params.slug, status: 'published', publishedAt: { $lte: new Date() } }).lean();
    if (!post) return res.status(404).json({ message: 'News or media post not found.' });
    const related = await NewsMediaPost.find({ _id: { $ne: post._id }, status: 'published', publishedAt: { $lte: new Date() } })
      .sort({ featured: -1, publishedAt: -1 }).limit(3).lean();
    res.json({ post: serialize(req, post), related: related.map((item) => serialize(req, item)) });
  } catch (error) {
    res.status(500).json({ message: 'Media update could not be loaded.' });
  }
});

module.exports = router;
