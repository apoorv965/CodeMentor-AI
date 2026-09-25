const Program = require('../models/Program');
const ProblemProgress = require('../models/ProblemProgress');
const Problem = require('../models/Problem');
const local = require('../services/localStore');
const useLocal = () => (process.env.PERSISTENCE_MODE || 'memory') !== 'mongo';

async function getOverview(req, res, next) {
  try {
    const userId = String(req.user?._id || req.user?.id);
    if (useLocal()) return res.json({ success: true, analytics: local.getAnalytics(userId) });
    const [programs, progressRows, problemCatalog] = await Promise.all([
      Program.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(200).lean(),
      ProblemProgress.find({ user: req.user._id }).populate('problem', 'problemId difficulty tags title').lean(),
      Problem.find({}).select('problemId difficulty tags title').lean(),
    ]);
    const solved = progressRows.filter((row) => row.solved).length;
    const attempts = progressRows.reduce((sum, row) => sum + row.attempts, 0);
    const hints = progressRows.reduce((sum, row) => sum + row.hintsUsed, 0);
    const executions = programs.filter((row) => row.executionTime);
    const successfulExecutions = executions.filter((row) => row.success).length;
    const executionTimes = executions.map((row) => parseInt(row.executionTime, 10)).filter(Number.isFinite);
    const dayKey = (date) => new Date(date).toISOString().slice(0, 10);
    const now = new Date();
    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
      const key = dayKey(date); const day = programs.filter((row) => dayKey(row.createdAt) === key);
      return { date: key, label: date.toLocaleDateString('en-US', { weekday: 'short' }), attempts: progressRows.filter((row) => row.lastSubmissionAt && dayKey(row.lastSubmissionAt) === key).length, executions: day.length, hints: 0 };
    });
    const difficulty = ['easy', 'medium', 'hard'].map((level) => { const total = problemCatalog.filter((problem) => problem.difficulty === level).length; const rows = progressRows.filter((row) => row.problem?.difficulty === level); return { level, total, solved: rows.filter((row) => row.solved).length, attempts: rows.reduce((sum, row) => sum + row.attempts, 0) }; });
    const topicMap = new Map();
    problemCatalog.forEach((problem) => (problem.tags || []).forEach((tag) => { const item = topicMap.get(tag) || { topic: tag, total: 0, solved: 0, attempts: 0 }; item.total += 1; topicMap.set(tag, item); }));
    progressRows.forEach((row) => (row.problem?.tags || []).forEach((tag) => { const item = topicMap.get(tag) || { topic: tag, total: 0, solved: 0, attempts: 0 }; item.solved += row.solved ? 1 : 0; item.attempts += row.attempts; topicMap.set(tag, item); }));
    const topics = [...topicMap.values()].sort((a, b) => b.attempts - a.attempts || b.total - a.total).slice(0, 10);
    res.json({ success: true, analytics: { solved, totalProblems: problemCatalog.length, attempts, hints, executions: executions.length, successfulExecutions, successRate: executions.length ? Math.round(successfulExecutions / executions.length * 100) : 0, averageExecutionMs: executionTimes.length ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length) : null, trend, difficulty, topics, activity: programs.slice(0, 12).map((row) => ({ type: 'execution', language: row.language, success: row.success, createdAt: row.createdAt })) } });
  } catch (err) { next(err); }
}
module.exports = { getOverview };
