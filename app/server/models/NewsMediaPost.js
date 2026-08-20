const mongoose = require('mongoose');

const newsMediaPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  type: { type: String, required: true, enum: ['news', 'video'], index: true },
  excerpt: { type: String, required: true, trim: true, maxlength: 500 },
  body: { type: String, required: true, trim: true },
  coverImage: { type: String, trim: true, default: '' },
  videoUrl: { type: String, trim: true, default: '' },
  videoDuration: { type: String, trim: true, maxlength: 20, default: '' },
  featured: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  publishedAt: { type: Date, index: true },
  author: { type: String, trim: true, maxlength: 100, default: 'Bestworth Media' },
  seoTitle: { type: String, trim: true, maxlength: 180, default: '' },
  seoDescription: { type: String, trim: true, maxlength: 320, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

newsMediaPostSchema.index({ status: 1, publishedAt: -1 });
newsMediaPostSchema.index({ title: 'text', excerpt: 'text', body: 'text' });

module.exports = mongoose.model('NewsMediaPost', newsMediaPostSchema);
