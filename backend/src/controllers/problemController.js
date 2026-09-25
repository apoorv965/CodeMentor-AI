const Problem = require('../models/Problem');
const Submission = require('../models/Submission');
const ProblemProgress = require('../models/ProblemProgress');
const { judgeSubmission, SUPPORTED_JUDGE_LANGUAGES } = require('../services/judgeService');

const MAX_CODE_LENGTH = parseInt(process.env.MAX_CODE_LENGTH || '20000', 10);
// The dashboard and practice list need the full catalog (956 problems) to
// compute accurate totals/stats, and each row here is tiny (no hidden
// tests, no descriptions) — so the cap is generous rather than forcing
// the frontend to page through ~10 requests just to render a count.
const MAX_PAGE_SIZE = 1000;

// @route  GET /api/problems
// @access Public. Returns metadata + public examples only (Problem.hiddenTests
// is `select:false` on the schema, so it is never fetched here at all).
const listProblems = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), MAX_PAGE_SIZE);
    const filter = {};
    if (req.query.difficulty && ['easy', 'medium', 'hard'].includes(req.query.difficulty)) {
      filter.difficulty = req.query.difficulty;
    }
    if (req.query.tag) {
      filter.tags = req.query.tag;
    }
    if (req.query.hasJudge === 'true') {
      filter.hasJudge = true;
    }
    if (req.query.search) {
      filter.title = { $regex: String(req.query.search).slice(0, 100), $options: 'i' };
    }

    const [problems, total] = await Promise.all([
      Problem.find(filter)
        .select('problemId title difficulty tags hasJudge needsManualTests')
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Problem.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      problems: problems.map((p) => ({
        id: p.problemId,
        title: p.title,
        difficulty: p.difficulty,
        tags: p.tags,
        hasJudge: p.hasJudge,
        needsManualTests: p.needsManualTests,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/problems/:id
// @access Public (optionalAuth — logged-in users additionally get their
// own progress for this problem included in the response).
const getProblem = async (req, res, next) => {
  try {
    const problem = await Problem.findOne({ problemId: req.params.id });
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    const payload = { success: true, problem: problem.toPublicObject() };

    if (req.user) {
      const progress = await ProblemProgress.findOne({ user: req.user._id, problem: problem._id }).lean();
      payload.progress = progress
        ? {
            solved: progress.solved,
            attempts: progress.attempts,
            bestExecutionTimeMs: progress.bestExecutionTimeMs,
          }
        : { solved: false, attempts: 0, bestExecutionTimeMs: null };
    }

    res.status(200).json(payload);
  } catch (err) {
    next(err);
  }
};

// @route  GET /api/problems/progress/me
// @access Private — always scoped to req.user, so this can only ever
// return the caller's own progress, never another user's.
//
// Returns every ProblemProgress row for the current user, keyed by the
// problem's slug (problemId), in the same {solved, attempts, hintsUsed,
// lastSubmissionAt} shape the old browser-storage progress object used —
// so the dashboard/practice-list rendering code barely has to change,
// it just reads from the backend response instead of local storage now.
const getMyProgress = async (req, res, next) => {
  try {
    const rows = await ProblemProgress.find({ user: req.user._id })
      .populate('problem', 'problemId')
      .lean();

    const progress = {};
    for (const row of rows) {
      if (!row.problem) continue; // problem was deleted — skip orphaned rows
      progress[row.problem.problemId] = {
        solved: row.solved,
        attempts: row.attempts,
        hintsUsed: row.hintsUsed,
        lastAttemptAt: row.lastSubmissionAt ? new Date(row.lastSubmissionAt).getTime() : null,
        bestExecutionTimeMs: row.bestExecutionTimeMs,
      };
    }

    res.status(200).json({ success: true, progress });
  } catch (err) {
    next(err);
  }
};

// @route  POST /api/problems/:id/submit
// @access Private — grading and progress are always tied to req.user,
// so one user can never read or overwrite another user's submissions.
//
// mode: "run"    -> grades against the problem's PUBLIC examples only
//                    (same data already visible to the browser). Does
//                    NOT persist a Submission or touch ProblemProgress.
// mode: "submit" -> grades against the HIDDEN judge tests, server-side
//                    only. Persists a Submission and updates
//                    ProblemProgress.solved. THE FRONTEND'S `mode` VALUE
//                    NEVER DETERMINES `solved` — only judgeSubmission()'s
//                    result, computed from the backend's own test run, does.
const submitSolution = async (req, res, next) => {
  try {
    const { code, language, mode } = req.body;
    const runMode = mode === 'run' ? 'run' : 'submit';

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Code is required' });
    }
    if (code.length > MAX_CODE_LENGTH) {
      return res.status(400).json({ success: false, message: `Code exceeds the maximum allowed length of ${MAX_CODE_LENGTH} characters` });
    }
    const lang = language || 'python';
    if (!SUPPORTED_JUDGE_LANGUAGES.includes(lang)) {
      return res.status(400).json({ success: false, message: `Unsupported judge language. Supported: ${SUPPORTED_JUDGE_LANGUAGES.join(', ')}` });
    }

    let problem;
    if (runMode === 'submit') {
      // Explicitly pull hiddenTests — the only place in the codebase that does.
      problem = await Problem.findOne({ problemId: req.params.id }).select('+hiddenTests');
    } else {
      problem = await Problem.findOne({ problemId: req.params.id });
    }
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    const tests = runMode === 'submit' ? problem.hiddenTests : problem.publicTests;
    const result = await judgeSubmission({ problem, code, language: lang, tests });

    if (runMode === 'run') {
      // Practice run against PUBLIC tests only — safe to return full
      // per-case detail (input/actual/expected), since the user can
      // already see these examples on the problem page.
      const casesWithInput = result.cases.map((c, i) => ({ ...c, input: tests[i] ? tests[i].input : undefined }));
      return res.status(200).json({ success: true, mode: 'run', ...result, cases: casesWithInput });
    }

    // ---- mode === 'submit': grading happened against HIDDEN tests ----
    // Strip actual/expected from each case before this ever reaches the
    // response — only pass/fail + the user's own error message (if any)
    // are safe to expose. This is the one redaction step standing
    // between `problem.hiddenTests` and the network.
    const redactedCases = result.cases.map((c) => ({ pass: c.pass, error: c.error }));
    const responseResult = { ...result, cases: redactedCases };

    // ---- persist + update backend-authoritative progress ----
    const submission = await Submission.create({
      user: req.user._id,
      problem: problem._id,
      problemId: problem.problemId,
      language: lang,
      code,
      mode: 'submit',
      status: result.status,
      passed: result.passed,
      total: result.total,
      executionTime: result.executionTime,
      error: result.error,
    });

    if (result.status !== 'No Judge Tests') {
      const execMs = parseInt(result.executionTime, 10) || null;
      const progress = await ProblemProgress.findOneAndUpdate(
        { user: req.user._id, problem: problem._id },
        {
          $inc: { attempts: 1 },
          $set: { lastSubmissionAt: new Date() },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      if (result.status === 'Accepted') {
        progress.solved = true;
        if (!progress.firstSolvedAt) progress.firstSolvedAt = new Date();
        if (execMs !== null && (progress.bestExecutionTimeMs === null || execMs < progress.bestExecutionTimeMs)) {
          progress.bestExecutionTimeMs = execMs;
        }
        await progress.save();
      }
    }

    res.status(200).json({
      success: true,
      mode: 'submit',
      submissionId: submission._id,
      ...responseResult,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listProblems, getProblem, getMyProgress, submitSolution };
