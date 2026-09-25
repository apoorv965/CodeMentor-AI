const rateLimit = require('express-rate-limit');

// Applied to every request — a generous ceiling to stop abuse/scraping.
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Tighter limit specifically for POST /api/execute, since each request
// spins up a Docker container and is far more expensive than a normal
// CRUD call.
const executeLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.EXECUTE_RATE_LIMIT_MAX || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many code executions. Please wait a moment before running more code.' },
});

// Slows down brute-force attempts against login/register.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});

// Applied to the AI mentor endpoints (explain / find-bug / hint). Each call
// is a real, billed Anthropic API request, so this stays tighter than the
// general limiter to avoid runaway usage/cost.
const mentorLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.MENTOR_RATE_LIMIT_MAX || '15', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many mentor requests. Please wait a moment before asking again.' },
});

// Applied to POST /api/problems/:id/submit. Same cost profile as
// /api/execute (spins up Docker containers), potentially several per
// call (one per test case), so it gets its own tighter ceiling.
const submitLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.SUBMIT_RATE_LIMIT_MAX || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many submissions. Please wait a moment before submitting again.' },
});

module.exports = { generalLimiter, executeLimiter, authLimiter, mentorLimiter, submitLimiter };
