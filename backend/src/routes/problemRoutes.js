const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { submitLimiter } = require('../middleware/rateLimiter');

const isLocal = (process.env.PERSISTENCE_MODE || 'memory') !== 'mongo';
const handlers = isLocal ? require('../controllers/localProblemController') : require('../controllers/problemController');

router.get('/', handlers.listProblems);
router.get('/progress/me', protect, handlers.getMyProgress);
router.get('/:id', optionalAuth, handlers.getProblem);
// Public sample runs do not read or mutate user progress. The controller keeps
// hidden-test submissions authenticated, so Google/local guest sessions can
// still use Run without weakening account-scoped solving and analytics.
router.post('/:id/submit', optionalAuth, submitLimiter, handlers.submitSolution);
module.exports = router;
