const jwt = require('jsonwebtoken');
const User = require('../models/User');
const local = require('../services/localStore');
const useLocal = () => (process.env.PERSISTENCE_MODE || 'memory') !== 'mongo';

const generateToken = (id) => jwt.sign({ id: String(id) }, process.env.JWT_SECRET || 'dev-only-secret', { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    if (useLocal()) {
      if (local.findUserByEmail(email)) return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      const user = local.createUser({ name, email, password });
      return res.status(201).json({ success: true, token: generateToken(user.id), user: local.safeUser(user) });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    const user = await User.create({ name, email, password });
    return res.status(201).json({ success: true, token: generateToken(user._id), user: user.toSafeObject() });
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });
    if (useLocal()) {
      const user = local.findUserByEmail(email);
      if (!local.verifyPassword(user, password)) return res.status(401).json({ success: false, message: 'Invalid email or password' });
      return res.json({ success: true, token: generateToken(user.id), user: local.safeUser(user) });
    }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    return res.json({ success: true, token: generateToken(user._id), user: user.toSafeObject() });
  } catch (err) { next(err); }
};

const logout = async (_req, res) => res.json({ success: true, message: 'Logged out successfully' });

const getProfile = async (req, res, next) => {
  try { res.json({ success: true, user: useLocal() ? local.safeUser(req.user) : req.user.toSafeObject() }); }
  catch (err) { next(err); }
};

module.exports = { register, login, logout, getProfile };
