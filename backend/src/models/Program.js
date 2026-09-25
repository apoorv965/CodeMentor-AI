const mongoose = require('mongoose');

/**
 * A single collection serves two related features:
 *  - Execution history: every /api/execute call by a logged-in user is
 *    stored here automatically with saved=false.
 *  - Saved programs: when the user explicitly saves a program (via
 *    POST /api/programs), the same shape is stored with saved=true.
 */
const programSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Untitled Program',
      trim: true,
      maxlength: 100,
    },
    language: {
      type: String,
      enum: ['python', 'java', 'cpp'],
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    input: {
      type: String,
      default: '',
    },
    output: {
      type: String,
      default: '',
    },
    error: {
      type: String,
      default: null,
    },
    success: {
      type: Boolean,
      default: false,
    },
    executionTime: {
      type: String,
      default: null,
    },
    saved: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

programSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Program', programSchema);
