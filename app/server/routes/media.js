const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MediaAsset = require('../models/MediaAsset');

// SVG is retained only for already-stored legacy assets. New SVG uploads are rejected,
// and the sandboxed response prevents script execution when an old asset is displayed.
const SAFE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);
const SAFE_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);

function mediaHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
}

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

router.get('/video/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'mediaVideos' });
    const [file] = await bucket.find({ _id: fileId }).limit(1).toArray();
    if (!file) return res.status(404).json({ message: 'Video not found' });

    const storedType = file.contentType || file.metadata?.mimetype;
    const contentType = SAFE_VIDEO_TYPES.has(storedType) ? storedType : 'application/octet-stream';
    const range = req.headers.range;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    mediaHeaders(res);

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) return res.status(416).setHeader('Content-Range', `bytes */${file.length}`).end();
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), file.length - 1) : file.length - 1;
      if (start > end || start >= file.length) return res.status(416).setHeader('Content-Range', `bytes */${file.length}`).end();
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${file.length}`);
      res.setHeader('Content-Length', end - start + 1);
      return bucket.openDownloadStream(fileId, { start, end: end + 1 }).pipe(res);
    }

    res.setHeader('Content-Length', file.length);
    return bucket.openDownloadStream(fileId).pipe(res);
  } catch (error) {
    console.error('Failed to serve uploaded video:', error.message);
    if (!res.headersSent) return res.status(500).json({ message: 'Server Error' });
    return res.end();
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Media asset not found' });
    const asset = await MediaAsset.findById(req.params.id).select('filename mimetype size data');

    if (!asset) {
      return res.status(404).json({ message: 'Media asset not found' });
    }

    const fileBuffer = toBuffer(asset.data);

    if (!fileBuffer) {
      console.error('Media asset data could not be converted to Buffer:', req.params.id);
      return res.status(500).json({ message: 'Media asset is corrupted' });
    }

    const contentType = SAFE_IMAGE_TYPES.has(asset.mimetype) ? asset.mimetype : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    mediaHeaders(res);
    res.setHeader('Content-Disposition', `${contentType === 'application/octet-stream' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(asset.filename)}"`);
    return res.end(fileBuffer);
  } catch (error) {
    console.error('Failed to serve media asset:', error.message);
    return res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
