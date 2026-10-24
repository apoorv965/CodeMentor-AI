const mongoose = require('mongoose');

const projectFileSchema = new mongoose.Schema({
  path: { type: String, required: true, trim: true, maxlength: 240 },
  language: { type: String, required: true, trim: true, maxlength: 40 },
  content: { type: String, default: '', maxlength: 200000 },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const projectSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  files: { type: [projectFileSchema], default: () => [{ path: 'main.py', language: 'python', content: '' }] },
  lastOpenedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

projectSchema.index({ user: 1, updatedAt: -1 });
projectSchema.index({ user: 1, name: 1 });

module.exports = mongoose.model('Project', projectSchema);
