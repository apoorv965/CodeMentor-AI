const Program = require('../models/Program');
const local = require('../services/localStore');
const useLocal = () => (process.env.PERSISTENCE_MODE || 'memory') !== 'mongo';
const userId = (user) => String(user?._id || user?.id || '');

const getHistory = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1); const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    if (useLocal()) { const result = local.listPrograms(userId(req.user), { page, limit }); return res.json({ success: true, page, limit, total: result.total, items: result.items }); }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([Program.find({ user: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit), Program.countDocuments({ user: req.user._id })]);
    res.json({ success: true, page, limit, total, items });
  } catch (err) { next(err); }
};

const getSavedPrograms = async (req, res, next) => {
  try { if (useLocal()) return res.json({ success: true, items: local.listPrograms(userId(req.user), { saved: true, page: 1, limit: 100 }).items }); res.json({ success: true, items: await Program.find({ user: req.user._id, saved: true }).sort({ createdAt: -1 }) }); }
  catch (err) { next(err); }
};

const saveProgram = async (req, res, next) => {
  try {
    const { language, code, input, title } = req.body;
    if (!language || !code) return res.status(400).json({ success: false, message: 'language and code are required' });
    if (!['python', 'java', 'cpp'].includes(language)) return res.status(400).json({ success: false, message: 'Unsupported language' });
    if (useLocal()) return res.status(201).json({ success: true, program: local.createProgram(userId(req.user), { language, code, input, title, saved: true }) });
    res.status(201).json({ success: true, program: await Program.create({ user: req.user._id, language, code, input: input || '', title: title || 'Untitled Program', saved: true }) });
  } catch (err) { next(err); }
};

const updateProgram = async (req, res, next) => {
  try {
    if (useLocal()) { const program = local.updateProgram(userId(req.user), req.params.id, req.body); return program ? res.json({ success: true, program }) : res.status(404).json({ success: false, message: 'Program not found' }); }
    const program = await Program.findOne({ _id: req.params.id, user: req.user._id }); if (!program) return res.status(404).json({ success: false, message: 'Program not found' });
    const { title, code, input } = req.body; if (title !== undefined) program.title = title; if (code !== undefined) program.code = code; if (input !== undefined) program.input = input; program.saved = true; await program.save(); res.json({ success: true, program });
  } catch (err) { next(err); }
};

const deleteProgram = async (req, res, next) => {
  try { if (useLocal()) return local.deleteProgram(userId(req.user), req.params.id) ? res.json({ success: true }) : res.status(404).json({ success: false, message: 'Program not found' }); const program = await Program.findOneAndDelete({ _id: req.params.id, user: req.user._id }); if (!program) return res.status(404).json({ success: false, message: 'Program not found' }); res.json({ success: true }); }
  catch (err) { next(err); }
};
module.exports = { getHistory, getSavedPrograms, saveProgram, updateProgram, deleteProgram };
