const express = require('express');
const router = express.Router();
const MediaAsset = require('../models/MediaAsset');

router.get('/:id', async (req, res) => {
  try {
    const asset = await MediaAsset.findById(req.params.id).lean();

    if (!asset) {
      return res.status(404).json({ message: 'Media asset not found' });
    }

    res.setHeader('Content-Type', asset.mimetype);
    res.setHeader('Content-Length', asset.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.filename)}"`);
    return res.send(asset.data);
  } catch (error) {
    console.error('Failed to serve media asset:', error.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
