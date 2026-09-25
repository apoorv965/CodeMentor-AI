const express = require('express');
const router = express.Router();

const {
  getHistory,
  getSavedPrograms,
  saveProgram,
  updateProgram,
  deleteProgram,
} = require('../controllers/programController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // every route below requires a logged-in user

router.get('/history', getHistory);
router.get('/saved', getSavedPrograms);
router.post('/', saveProgram);
router.put('/:id', updateProgram);
router.delete('/:id', deleteProgram);

module.exports = router;
