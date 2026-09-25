const mongoose = require('mongoose');

/**
 * A single practice problem. Public tests are shown to the browser as
 * worked examples; hiddenTests are the actual judge tests and are
 * `select: false` so they are NEVER returned unless a query explicitly
 * asks for them (see problemController.getProblemForJudging).
 *
 * hasJudge is true only when at least one hidden test exists. Problems
 * migrated with zero source tests are stored with hasJudge=false and
 * needsManualTests=true — they can be browsed, but POST /submit refuses
 * to grade them (see judgeService). This is the fix for the
 * `[].every(...) === true` empty-tests vulnerability: there is no longer
 * any code path where an empty test array can produce "Accepted".
 */
const testCaseSchema = new mongoose.Schema(
  {
    input: { type: String, required: true },
    expected: { type: String, required: true },
  },
  { _id: false }
);

const problemSchema = new mongoose.Schema(
  {
    problemId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
      index: true,
    },
    tags: { type: [String], default: [] },

    // Python-only judge harness metadata (matches the data-driven harness
    // format the project already used on the frontend).
    starter: { type: String, default: '' },
    fnName: { type: String, required: true },
    paramTypes: { type: [String], default: [] },
    returnType: { type: String, required: true },

    // Shown to the browser via GET /api/problems/:id.
    publicTests: { type: [testCaseSchema], default: [] },

    // NEVER selected by default. Only judgeService's internal query
    // (`.select('+hiddenTests')`) can read this field.
    hiddenTests: { type: [testCaseSchema], default: [], select: false },

    hasJudge: { type: Boolean, default: false, index: true },
    needsManualTests: { type: Boolean, default: false, index: true },

    // Migration bookkeeping — not shown to the frontend.
    sourceTestCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Never leak hidden tests even if a caller forgets to strip them.
problemSchema.methods.toPublicObject = function () {
  return {
    id: this.problemId,
    title: this.title,
    description: this.description,
    difficulty: this.difficulty,
    tags: this.tags,
    starter: this.starter,
    fnName: this.fnName,
    paramTypes: this.paramTypes,
    returnType: this.returnType,
    examples: this.publicTests,
    hasJudge: this.hasJudge,
    needsManualTests: this.needsManualTests,
  };
};

module.exports = mongoose.model('Problem', problemSchema);
