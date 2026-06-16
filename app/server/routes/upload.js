const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const { getRequestOrigin } = require('../utils/public-url');
const MediaAsset = require('../models/MediaAsset');

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE
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
router.post('/', auth, (req, res) => {
  upload.single('file')(req, res, async (error) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size must be 10MB or less' });
    }

    if (error) {
      return res.status(400).json({ message: error.message || 'Upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
      const extension = path.extname(req.file.originalname);
      const baseName = path.basename(req.file.originalname, extension).replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-');
      const filename = `${baseName || 'file'}-${Date.now()}${extension}`;

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
