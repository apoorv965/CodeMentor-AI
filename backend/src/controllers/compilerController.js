const Program = require('../models/Program');
const { executeCode } = require('../services/dockerExecutor');
const local = require('../services/localStore');
const useLocal = () => (process.env.PERSISTENCE_MODE || 'memory') !== 'mongo';
const userId = (user) => String(user?._id || user?.id || '');
const SUPPORTED_LANGUAGES = ['python', 'java', 'cpp'];
const MAX_CODE_LENGTH = parseInt(process.env.MAX_CODE_LENGTH || '20000', 10);
const MAX_INPUT_LENGTH = parseInt(process.env.MAX_INPUT_LENGTH || '5000', 10);

const execute = async (req, res, next) => {
  try {
    const { language, code, input } = req.body;
    if (!SUPPORTED_LANGUAGES.includes(language)) return res.status(400).json({ success: false, output: '', error: `Unsupported or missing language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}` });
    if (!code || typeof code !== 'string' || !code.trim()) return res.status(400).json({ success: false, output: '', error: 'Code is required' });
    if (code.length > MAX_CODE_LENGTH) return res.status(400).json({ success: false, output: '', error: `Code exceeds ${MAX_CODE_LENGTH} characters` });
    if (input && input.length > MAX_INPUT_LENGTH) return res.status(400).json({ success: false, output: '', error: `Input exceeds ${MAX_INPUT_LENGTH} characters` });
    const result = await executeCode(language, code, input || '');
    if (req.user) {
      const data = { user: userId(req.user), language, code, input: input || '', output: result.output, error: result.error, success: result.success, executionTime: result.executionTime, saved: false };
      if (useLocal()) local.createProgram(data.user, data); else Program.create({ user: req.user._id, ...data });
    }
    res.json({ success: result.success, output: result.output, error: result.error, executionTime: result.executionTime, mode: result.mode || 'docker' });
  } catch (err) { next(err); }
};
module.exports = { execute };
