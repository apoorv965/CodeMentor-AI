const local = require('../services/localStore');
const { judgeSubmission } = require('../services/judgeService');
const userId = (user) => String(user?._id || user?.id || '');

async function listProblems(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 1000);
  const result = local.listProblems({ page, limit, difficulty: req.query.difficulty, tag: req.query.tag, search: req.query.search, hasJudge: req.query.hasJudge === 'true' });
  res.json({ success: true, page, limit, total: result.total, totalPages: Math.ceil(result.total / limit), problems: result.problems.map(({ description, starter, tests, ...meta }) => meta) });
}

function getProblem(req, res) {
  const problem = local.getProblem(req.params.id);
  if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
  const payload = { success: true, problem: local.publicProblem(problem) };
  if (req.user) payload.progress = local.getProgress(userId(req.user))[problem.id] || { solved: false, attempts: 0, bestExecutionTimeMs: null };
  return res.json(payload);
}

function getMyProgress(req, res) { return res.json({ success: true, progress: local.getProgress(userId(req.user)) }); }

async function submitSolution(req, res, next) {
  try {
    // Render preview/local-first mode has no durable account identity. Allow
    // the learning loop to grade hidden tests for guest/Google-local sessions;
    // Mongo mode remains protected by the production controller and auth route.
    if (req.body.mode !== 'run' && !req.user && (process.env.PERSISTENCE_MODE || 'memory') === 'mongo') {
      return res.status(401).json({ success: false, message: 'Sign in with an email/password account to submit hidden tests.' });
    }
    const problem = local.getProblem(req.params.id);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
    const code = String(req.body.code || '');
    if (!code.trim()) return res.status(400).json({ success: false, message: 'Code is required' });
    const language = req.body.language || 'python';
    // Practice metadata describes callable solutions (fnName + paramTypes).
    // The shared judge appends a secure test harness, parses each input line,
    // invokes the function, and normalizes list output before comparing it.
    const result = await judgeSubmission({ problem, code, language, tests: problem.tests || [] });
    const cases = result.cases.map((test, index) => ({
      ...test,
      input: problem.tests[index]?.input,
      expected: problem.tests[index]?.expected,
    }));
    result.cases = cases;
    if (req.body.mode !== 'run') local.recordProgress(userId(req.user) || 'guest', problem.id, result);
    const responseCases = req.body.mode === 'run' ? cases : cases.map(({ pass, error }) => ({ pass, error }));
    return res.json({ success: true, mode: req.body.mode === 'run' ? 'run' : 'submit', ...result, cases: responseCases, submissionId: `local_${Date.now()}` });
  } catch (err) { next(err); }
}

module.exports = { listProblems, getProblem, getMyProgress, submitSolution };
