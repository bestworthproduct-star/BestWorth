const mongoose = require('mongoose');

const mediaAssetSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true }
}, { timestamps: true });

module.exports = mongoose.model('MediaAsset', mediaAssetSchema);
