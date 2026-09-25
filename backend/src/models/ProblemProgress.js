const mongoose = require('mongoose');

/**
 * Backend-authoritative solved/attempt tracking per (user, problem).
 * This is the single source of truth for "solved" — the frontend
 * never writes to this collection directly, it only reads the result
 * that /api/problems/:id/submit returns after judging server-side.
 */
const problemProgressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true, index: true },
    solved: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    bestExecutionTimeMs: { type: Number, default: null },
    lastSubmissionAt: { type: Date, default: null },
    firstSolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One progress row per user/problem pair.
problemProgressSchema.index({ user: 1, problem: 1 }, { unique: true });

module.exports = mongoose.model('ProblemProgress', problemProgressSchema);
