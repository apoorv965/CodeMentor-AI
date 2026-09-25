const express = require('express');
const router = express.Router();

const { explain, findBug, hint } = require('../controllers/mentorController');
const { mentorLimiter } = require('../middleware/rateLimiter');
const { optionalAuth } = require('../middleware/authMiddleware');

// Public (guests can use the mentor too), but tightly rate-limited since
// every call is a paid Anthropic API request.
router.post('/explain', mentorLimiter, optionalAuth, explain);
router.post('/find-bug', mentorLimiter, optionalAuth, findBug);
router.post('/hint', mentorLimiter, optionalAuth, hint);

module.exports = router;
