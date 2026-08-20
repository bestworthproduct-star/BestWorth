const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { requireSessionReady } = require('../middleware/authorize');
const { getRole, hasPermission } = require('../utils/permissions');
const { getRequestOrigin } = require('../utils/public-url');
const MediaAsset = require('../models/MediaAsset');

const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024;

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_VIDEO_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|svg|mp4|webm|ogg|mov)$/i;
    const allowedMimeTypes = /^(image\/(jpeg|jpg|png|gif|webp|svg\+xml)|video\/(mp4|webm|ogg|quicktime))$/i;
    const extname = allowedExtensions.test(extension);
    const mimetype = allowedMimeTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Images and videos only'));
    }
  }
});

// @route   POST api/upload
// @desc    Upload a file
// @access  Private
router.post('/', auth, requireSessionReady, (req, res) => {
  upload.single('file')(req, res, async (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Video files must be 50MB or less' });
    }

    if (error) {
      return res.status(400).json({ message: error.message || 'Upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const isVideo = req.file.mimetype.startsWith('video/');
    if (!isVideo && req.file.size > MAX_IMAGE_FILE_SIZE) {
      return res.status(400).json({ message: 'Image files must be 10MB or less' });
    }

    const scope = String(req.body?.scope || '').trim();
    const moduleName = scope === 'product'
      ? 'catalog'
      : scope === 'team'
        ? 'leadership'
        : scope === 'media'
          ? 'media'
        : scope === 'cms'
          ? 'cms'
          : null;

    if (getRole(req.user) === 'worker' && (!moduleName || !hasPermission(req.user, moduleName, 'manage'))) {
      return res.status(403).json({ message: 'You do not have permission to upload media here.', code: 'ACCESS_DENIED' });
    }

    try {
      const extension = path.extname(req.file.originalname);
      const baseName = path.basename(req.file.originalname, extension).replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-');
      const filename = `${baseName || 'file'}-${Date.now()}${extension}`;

      if (isVideo) {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'mediaVideos' });
        const videoUpload = bucket.openUploadStream(filename, {
          contentType: req.file.mimetype,
          metadata: {
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploadedBy: req.user.id
          }
        });

        await new Promise((resolve, reject) => {
          videoUpload.once('finish', resolve);
          videoUpload.once('error', reject);
          videoUpload.end(req.file.buffer);
        });

        const fileUrl = `/api/media/video/${videoUpload.id}`;
        return res.json({
          url: fileUrl,
          absoluteUrl: `${getRequestOrigin(req)}${fileUrl}`,
          filename,
          mimetype: req.file.mimetype,
          size: req.file.size,
          id: videoUpload.id
        });
      }

      const asset = await MediaAsset.create({
        filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        data: req.file.buffer
      });

      const fileUrl = `/api/media/${asset._id}`;
      return res.json({ 
        url: fileUrl,
        absoluteUrl: `${getRequestOrigin(req)}${fileUrl}`,
        filename: asset.filename,
        mimetype: asset.mimetype,
        size: asset.size,
        id: asset._id
      });
    } catch (uploadError) {
      console.error('Failed to store uploaded file:', uploadError.message);
      return res.status(500).json({ message: 'Failed to store uploaded file' });
    }
  });
});

module.exports = router;
