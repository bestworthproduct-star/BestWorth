const express = require('express');
const router = express.Router();
const MediaAsset = require('../models/MediaAsset');

function toBuffer(data) {
  if (!data) {
    return null;
  }

  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (data.buffer && Buffer.isBuffer(data.buffer)) {
    return data.buffer;
  }

  if (data.buffer && Array.isArray(data.buffer.data)) {
    return Buffer.from(data.buffer.data);
  }

  if (Array.isArray(data.data)) {
    return Buffer.from(data.data);
  }

  return null;
}

router.get('/:id', async (req, res) => {
  try {
    const asset = await MediaAsset.findById(req.params.id).select('filename mimetype size data');

    if (!asset) {
      return res.status(404).json({ message: 'Media asset not found' });
    }

    const fileBuffer = toBuffer(asset.data);

    if (!fileBuffer) {
      console.error('Media asset data could not be converted to Buffer:', req.params.id);
      return res.status(500).json({ message: 'Media asset is corrupted' });
    }

    res.setHeader('Content-Type', asset.mimetype);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.filename)}"`);
    return res.end(fileBuffer);
  } catch (error) {
    console.error('Failed to serve media asset:', error.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
