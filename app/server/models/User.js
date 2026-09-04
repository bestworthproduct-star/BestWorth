const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  overview: { type: String, enum: ['none', 'view', 'manage'], default: 'view' },
  catalog: { type: String, enum: ['none', 'view', 'manage'], default: 'none' },
  leadership: { type: String, enum: ['none', 'view', 'manage'], default: 'none' },
  inquiries: { type: String, enum: ['none', 'view', 'manage'], default: 'none' },
  media: { type: String, enum: ['none', 'view', 'manage'], default: 'none' },
  cms: { type: String, enum: ['none', 'view', 'manage'], default: 'none' },
  workers: { type: String, enum: ['none', 'view', 'manage'], default: 'none' }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  passwordHistory: [{ type: String }],
  notificationEmails: [{ type: String }],
  fullName: { type: String, trim: true, default: '' },
  jobTitle: { type: String, trim: true, maxlength: 100, default: '' },
  email: { type: String, trim: true, lowercase: true },
  // Intentionally no default: legacy accounts without a role are treated as the owner.
  role: { type: String, enum: ['admin', 'worker'] },
  permissions: { type: permissionSchema, default: () => ({}) },
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  sessionVersion: { type: Number, default: 0, min: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastLoginAt: { type: Date }
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ createdBy: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
