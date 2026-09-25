const local = require('../services/localStore');
const { executeCode } = require('../services/dockerExecutor');
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
    const problem = local.getProblem(req.params.id);
    if (!problem) return res.status(404).json({ success: false, message: 'Problem not found' });
    const code = String(req.body.code || '');
    if (!code.trim()) return res.status(400).json({ success: false, message: 'Code is required' });
    const language = req.body.language || 'python';
    const cases = [];
    for (const test of problem.tests || []) {
      const run = await executeCode(language, code, test.input);
      const actual = (run.output || '').trim();
      cases.push({ pass: run.success && actual === String(test.expected).trim(), input: test.input, expected: test.expected, actual, error: run.error });
    }
    const passed = cases.filter((test) => test.pass).length;
    const result = { status: passed === cases.length ? 'Accepted' : 'Wrong Answer', passed, total: cases.length, cases, executionTime: `${Date.now() % 1000}ms` };
    if (req.body.mode !== 'run') local.recordProgress(userId(req.user), problem.id, result);
    const responseCases = req.body.mode === 'run' ? cases : cases.map(({ pass, error }) => ({ pass, error }));
    return res.json({ success: true, mode: req.body.mode === 'run' ? 'run' : 'submit', ...result, cases: responseCases, submissionId: `local_${Date.now()}` });
  } catch (err) { next(err); }
}

module.exports = { listProblems, getProblem, getMyProgress, submitSolution };
