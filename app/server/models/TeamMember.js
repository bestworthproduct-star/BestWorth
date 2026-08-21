const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 140 },
  role: { type: String, required: true, trim: true, maxlength: 140 },
  bio: { type: String, maxlength: 5000 },
  image: { type: String, required: true, maxlength: 2048 }, // URL
  order: { type: Number, default: 0, min: -10000, max: 10000 }
}, { timestamps: true });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
