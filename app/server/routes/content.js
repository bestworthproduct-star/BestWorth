const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const auth = require('../middleware/auth');
const {
  hydrateMediaFieldsForResponse,
  normalizeMediaFieldsForStorage
} = require('../utils/public-url');

// @route   GET /api/content/:key
// @desc    Get content by key
// @access  Public
router.get('/:key', async (req, res) => {
  try {
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
router.get('/', async (req, res) => {
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
router.post('/:key', auth, async (req, res) => {
  try {
    let content = await Content.findOne({ key: req.params.key });
    
    if (content) {
      content.data = normalizeMediaFieldsForStorage(req.body);
      content.updatedAt = Date.now();
    } else {
      content = new Content({
        key: req.params.key,
        data: normalizeMediaFieldsForStorage(req.body)
      });
    }

    await content.save();
    
    // Broadcast change via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('content_change', {
        key: req.params.key,
        data: hydrateMediaFieldsForResponse(req, content.data)
      });
    }

    res.json(hydrateMediaFieldsForResponse(req, content.data));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
