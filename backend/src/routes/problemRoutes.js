const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { submitLimiter } = require('../middleware/rateLimiter');

const isLocal = (process.env.PERSISTENCE_MODE || 'memory') !== 'mongo';
const handlers = isLocal ? require('../controllers/localProblemController') : require('../controllers/problemController');

router.get('/', handlers.listProblems);
router.get('/progress/me', protect, handlers.getMyProgress);
router.get('/:id', optionalAuth, handlers.getProblem);
router.post('/:id/submit', protect, submitLimiter, handlers.submitSolution);
module.exports = router;
