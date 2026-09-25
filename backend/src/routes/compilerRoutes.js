const express = require('express');
const router = express.Router();

const { execute } = require('../controllers/compilerController');
const { optionalAuth } = require('../middleware/authMiddleware');
const { executeLimiter } = require('../middleware/rateLimiter');

// Guests can execute code too; logged-in users additionally get the run
// saved to their history (handled inside the controller via req.user).
router.post('/execute', executeLimiter, optionalAuth, execute);

module.exports = router;
