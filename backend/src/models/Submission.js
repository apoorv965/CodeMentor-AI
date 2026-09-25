const mongoose = require('mongoose');

/**
 * One record per graded submit (mode: 'submit') or practice run
 * (mode: 'run') against a problem. Stores the backend's judged result —
 * the frontend never gets to set `status` itself.
 */
const submissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    problemId: { type: String, required: true }, // denormalized slug, cheap to read for history lists
    language: { type: String, required: true },
    code: { type: String, required: true },
    mode: { type: String, enum: ['run', 'submit'], default: 'submit' },
    status: {
      type: String,
      enum: [
        'Accepted',
        'Wrong Answer',
        'Compilation Error',
        'Runtime Error',
        'Time Limit Exceeded',
        'No Judge Tests',
      ],
      required: true,
    },
    passed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    executionTime: { type: String, default: null },
    // Sanitized message about the user's OWN code failing (their stderr) —
    // never the hidden test's input/expected values.
    error: { type: String, default: null },
  },
  { timestamps: true }
);

submissionSchema.index({ user: 1, problem: 1, createdAt: -1 });
submissionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Submission', submissionSchema);
