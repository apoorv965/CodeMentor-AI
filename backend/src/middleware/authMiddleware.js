const jwt = require('jsonwebtoken');
const User = require('../models/User');
const local = require('../services/localStore');
const useLocal = () => (process.env.PERSISTENCE_MODE || 'memory') !== 'mongo';

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  return authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

async function resolveUser(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-only-secret');
  return useLocal() ? local.findUserById(decoded.id) : await User.findById(decoded.id);
}

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
    const user = await resolveUser(token);
    if (!user) return res.status(401).json({ success: false, message: 'Not authorized, user no longer exists' });
    req.user = user;
    return next();
  } catch (_err) {
    return res.status(401).json({ success: false, message: 'Not authorized, invalid or expired token' });
  }
};

const optionalAuth = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const user = await resolveUser(token);
      if (user) req.user = user;
    }
  } catch (_err) { /* optional auth intentionally falls back to guest */ }
  next();
};

module.exports = { protect, optionalAuth };
