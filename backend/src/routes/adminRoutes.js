const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const controller = require('../controllers/adminController');

router.use(protect, requireAdmin);
router.get('/overview', controller.overview);
router.get('/users', controller.listUsers);
router.get('/users/export', controller.exportUsers);
router.get('/users/:userId/projects', controller.userProjects);
router.patch('/users/:userId/status', controller.setUserStatus);
router.delete('/users/:userId', controller.deleteUser);

module.exports = router;
