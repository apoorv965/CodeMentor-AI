const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const problems = require('../seed/problems.raw.json');

const users = new Map();
const programs = [];
const progress = new Map();
const events = [];

function id(prefix = '') {
  return `${prefix}${crypto.randomBytes(8).toString('hex')}`;
}

function now() {
  return new Date();
}

function safeUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}

function createUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = { id: id('usr_'), name: name.trim(), email: normalizedEmail, password: bcrypt.hashSync(password, 10), createdAt: now() };
  users.set(user.id, user);
  return user;
}

function findUserByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return [...users.values()].find((user) => user.email === normalizedEmail) || null;
}

function findUserById(userId) {
  return users.get(String(userId)) || null;
}

function verifyPassword(user, password) {
  return Boolean(user && bcrypt.compareSync(password, user.password));
}

function createProgram(userId, data) {
  const program = {
    _id: id('run_'),
    user: userId,
    title: data.title || 'Untitled Program',
    language: data.language,
    code: data.code,
    input: data.input || '',
    output: data.output || '',
    error: data.error || null,
    success: Boolean(data.success),
    executionTime: data.executionTime || null,
    saved: Boolean(data.saved),
    createdAt: now(),
    updatedAt: now(),
  };
  programs.unshift(program);
  events.push({ user: userId, type: 'execution', language: program.language, success: program.success, executionTime: program.executionTime, createdAt: program.createdAt });
  return program;
}

function listPrograms(userId, { saved = false, page = 1, limit = 20 } = {}) {
  const owned = programs.filter((program) => program.user === userId && (!saved || program.saved));
  const start = (page - 1) * limit;
  return { items: owned.slice(start, start + limit), total: owned.length };
}

function getProgram(userId, programId) {
  return programs.find((program) => program.user === userId && program._id === programId) || null;
}

function updateProgram(userId, programId, patch) {
  const program = getProgram(userId, programId);
  if (!program) return null;
  Object.assign(program, patch, { saved: true, updatedAt: now() });
  return program;
}

function deleteProgram(userId, programId) {
  const index = programs.findIndex((program) => program.user === userId && program._id === programId);
  if (index === -1) return null;
  return programs.splice(index, 1)[0];
}

function publicProblem(problem) {
  return {
    id: problem.id,
    title: problem.title,
    description: problem.description,
    difficulty: problem.difficulty,
    tags: problem.tags || [],
    starter: problem.starter || '',
    fnName: problem.fnName,
    paramTypes: problem.paramTypes || [],
    returnType: problem.returnType,
    tests: problem.tests || [],
    publicTests: problem.tests || [],
    hasJudge: Boolean(problem.tests?.length),
    needsManualTests: false,
  };
}

function listProblems({ page = 1, limit = 20, difficulty, tag, search, hasJudge } = {}) {
  let result = problems;
  if (difficulty) result = result.filter((problem) => problem.difficulty === difficulty);
  if (tag) result = result.filter((problem) => (problem.tags || []).includes(tag));
  if (hasJudge === true) result = result.filter((problem) => problem.tests?.length);
  if (search) {
    const query = String(search).toLowerCase();
    result = result.filter((problem) => problem.title.toLowerCase().includes(query));
  }
  const start = (page - 1) * limit;
  return { problems: result.slice(start, start + limit).map(publicProblem), total: result.length };
}

function getProblem(problemId) {
  return problems.find((problem) => problem.id === problemId) || null;
}

function getProgress(userId) {
  const userProgress = {};
  for (const [key, value] of progress.entries()) {
    if (key.startsWith(`${userId}:`)) userProgress[key.slice(userId.length + 1)] = value;
  }
  return userProgress;
}

function recordProgress(userId, problemId, result) {
  const key = `${userId}:${problemId}`;
  const current = progress.get(key) || { solved: false, attempts: 0, hintsUsed: 0, bestExecutionTimeMs: null };
  current.attempts += 1;
  current.lastAttemptAt = Date.now();
  if (result.status === 'Accepted') {
    current.solved = true;
    const ms = parseInt(result.executionTime, 10);
    if (Number.isFinite(ms) && (current.bestExecutionTimeMs === null || ms < current.bestExecutionTimeMs)) current.bestExecutionTimeMs = ms;
  }
  progress.set(key, current);
  events.push({ user: userId, type: 'submission', problemId, status: result.status, createdAt: now() });
  return current;
}

function incrementHints(userId, problemId) {
  const key = `${userId}:${problemId}`;
  const current = progress.get(key) || { solved: false, attempts: 0, hintsUsed: 0, bestExecutionTimeMs: null };
  current.hintsUsed += 1;
  progress.set(key, current);
  events.push({ user: userId, type: 'hint', problemId, createdAt: now() });
  return current;
}

function getAnalytics(userId) {
  const userEvents = events.filter((event) => event.user === userId);
  const userProgress = getProgress(userId);
  const solved = Object.values(userProgress).filter((item) => item.solved).length;
  const attempts = Object.values(userProgress).reduce((sum, item) => sum + (item.attempts || 0), 0);
  const hints = Object.values(userProgress).reduce((sum, item) => sum + (item.hintsUsed || 0), 0);
  const executions = userEvents.filter((event) => event.type === 'execution');
  const successfulExecutions = executions.filter((event) => event.success).length;
  const executionTimes = executions.map((event) => parseInt(event.executionTime, 10)).filter(Number.isFinite);
  const nowDate = new Date();
  const dayKey = (date) => new Date(date).toISOString().slice(0, 10);
  const trend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(nowDate); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const key = dayKey(date); const dayEvents = userEvents.filter((event) => dayKey(event.createdAt) === key);
    return { date: key, label: date.toLocaleDateString('en-US', { weekday: 'short' }), attempts: dayEvents.filter((event) => event.type === 'submission').length, executions: dayEvents.filter((event) => event.type === 'execution').length, hints: dayEvents.filter((event) => event.type === 'hint').length };
  });
  const difficulty = ['easy', 'medium', 'hard'].map((level) => {
    const rows = problems.filter((problem) => problem.difficulty === level);
    return { level, total: rows.length, solved: rows.filter((problem) => userProgress[problem.id]?.solved).length, attempts: rows.reduce((sum, problem) => sum + (userProgress[problem.id]?.attempts || 0), 0) };
  });
  const topicMap = new Map();
  problems.forEach((problem) => (problem.tags || []).forEach((tag) => {
    const row = topicMap.get(tag) || { topic: tag, total: 0, solved: 0, attempts: 0 };
    row.total += 1; row.solved += userProgress[problem.id]?.solved ? 1 : 0; row.attempts += userProgress[problem.id]?.attempts || 0; topicMap.set(tag, row);
  }));
  const activity = userEvents.slice(-12).reverse().map((event) => ({ ...event, createdAt: new Date(event.createdAt).toISOString() }));
  return { solved, totalProblems: problems.length, attempts, hints, executions: executions.length, successfulExecutions, successRate: executions.length ? Math.round((successfulExecutions / executions.length) * 100) : 0, averageExecutionMs: executionTimes.length ? Math.round(executionTimes.reduce((sum, value) => sum + value, 0) / executionTimes.length) : null, trend, difficulty, topics: [...topicMap.values()].sort((a, b) => b.attempts - a.attempts || b.total - a.total).slice(0, 10), activity };
}

module.exports = {
  users,
  safeUser,
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  createProgram,
  listPrograms,
  getProgram,
  updateProgram,
  deleteProgram,
  publicProblem,
  listProblems,
  getProblem,
  getProgress,
  recordProgress,
  incrementHints,
  getAnalytics,
};
