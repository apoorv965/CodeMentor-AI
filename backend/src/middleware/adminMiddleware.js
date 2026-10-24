function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
  if (req.user.status === 'suspended') return res.status(403).json({ success: false, message: 'Admin account is suspended' });
  return next();
}

module.exports = { requireAdmin };
