const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 },
  category: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  image: { type: String, required: true, maxlength: 2048 }, // URL
  featured: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
