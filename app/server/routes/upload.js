const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { requireSessionReady } = require('../middleware/authorize');
const { getRole, hasPermission } = require('../utils/permissions');
const { getRequestOrigin } = require('../utils/public-url');
const MediaAsset = require('../models/MediaAsset');
const { rateLimit, clientIp } = require('../utils/rate-limit');

const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_FILE_SIZE = 50 * 1024 * 1024;

const upload = multer({ 
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, os.tmpdir()),
    filename: (_req, _file, callback) => callback(null, `bestworth-${crypto.randomBytes(16).toString('hex')}.upload`)
  }),
  limits: {
    fileSize: MAX_VIDEO_FILE_SIZE,
    files: 1,
    fields: 4,
    parts: 5,
    fieldNameSize: 100,
    fieldSize: 1024
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|mp4|webm|ogg|mov)$/i;
    const allowedMimeTypes = /^(image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|webm|ogg|quicktime))$/i;
    const extname = allowedExtensions.test(extension);
    const mimetype = allowedMimeTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Images and videos only'));
    }
  }
});

async function detectFile(filePath) {
  const handle = await fs.promises.open(filePath, 'r');
  const buffer = Buffer.alloc(64);
  try { await handle.read(buffer, 0, buffer.length, 0); } finally { await handle.close(); }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimetype: 'image/jpeg', extension: '.jpg', kind: 'image' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimetype: 'image/png', extension: '.png', kind: 'image' };
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return { mimetype: 'image/gif', extension: '.gif', kind: 'image' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { mimetype: 'image/webp', extension: '.webp', kind: 'image' };
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { mimetype: 'video/webm', extension: '.webm', kind: 'video' };
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return { mimetype: 'video/ogg', extension: '.ogg', kind: 'video' };
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const quickTime = buffer.subarray(8, 12).toString('ascii') === 'qt  ';
    return { mimetype: quickTime ? 'video/quicktime' : 'video/mp4', extension: quickTime ? '.mov' : '.mp4', kind: 'video' };
  }
  return null;
}

const uploadLimit = rateLimit({ scope: 'media-upload', limit: 30, windowMs: 60 * 60 * 1000, key: (req) => `${clientIp(req)}:${req.user.id}` });

// @route   POST api/upload
// @desc    Upload a file
// @access  Private
router.post('/', auth, requireSessionReady, uploadLimit, (req, res) => {
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

    const scope = typeof req.body?.scope === 'string' ? req.body.scope.trim() : '';
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
      void fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ message: 'You do not have permission to upload media here.', code: 'ACCESS_DENIED' });
    }

    try {
      const detected = await detectFile(req.file.path);
      if (!detected) return res.status(400).json({ message: 'The uploaded file content is not a supported image or video.' });
      const isVideo = detected.kind === 'video';
      if (!isVideo && req.file.size > MAX_IMAGE_FILE_SIZE) return res.status(400).json({ message: 'Image files must be 10MB or less' });
      const originalExtension = path.extname(req.file.originalname);
      const baseName = path.basename(req.file.originalname, originalExtension).replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').slice(0, 100);
      const filename = `${baseName || 'file'}-${Date.now()}${detected.extension}`;

      if (isVideo) {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'mediaVideos' });
        const videoUpload = bucket.openUploadStream(filename, {
          contentType: detected.mimetype,
          metadata: {
            originalName: req.file.originalname,
            mimetype: detected.mimetype,
            size: req.file.size,
            uploadedBy: req.user.id
          }
        });

        await new Promise((resolve, reject) => {
          videoUpload.once('finish', resolve);
          videoUpload.once('error', reject);
          fs.createReadStream(req.file.path).on('error', reject).pipe(videoUpload);
        });

        const fileUrl = `/api/media/video/${videoUpload.id}`;
        return res.json({
          url: fileUrl,
          absoluteUrl: `${getRequestOrigin(req)}${fileUrl}`,
          filename,
          mimetype: detected.mimetype,
          size: req.file.size,
          id: videoUpload.id
        });
      }

      const fileBuffer = await fs.promises.readFile(req.file.path);
      const asset = await MediaAsset.create({
        filename,
        originalName: req.file.originalname,
        mimetype: detected.mimetype,
        size: req.file.size,
        data: fileBuffer
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
    } finally {
      if (req.file?.path) void fs.promises.unlink(req.file.path).catch(() => {});
    }
  });
});

module.exports = router;
