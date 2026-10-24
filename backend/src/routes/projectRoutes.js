const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const controller = require('../controllers/projectController');

router.use(protect);
router.get('/', controller.listProjects);
router.post('/', controller.createProject);
router.post('/:id/duplicate', controller.duplicateProject);
router.get('/:id', controller.getProject);
router.put('/:id', controller.updateProject);
router.delete('/:id', controller.deleteProject);

module.exports = router;
