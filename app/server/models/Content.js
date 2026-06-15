const mongoose = require('mongoose');

const ContentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // e.g., 'hero', 'about', 'values', 'contact', 'footer'
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Content', ContentSchema);
