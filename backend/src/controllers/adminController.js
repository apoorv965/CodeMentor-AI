const User = require('../models/User');
const Project = require('../models/Project');
const Program = require('../models/Program');
const local = require('../services/localStore');
const useLocal = () => (process.env.PERSISTENCE_MODE || 'memory') !== 'mongo';

const safe = (user) => (user.toSafeObject ? user.toSafeObject() : local.safeUser(user));
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

async function listUsers(req, res, next) {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    if (useLocal()) {
      const users = local.adminUsers().filter((u) => !search || `${u.name} ${u.email}`.toLowerCase().includes(search));
      return res.json({ success: true, users: users.map((user) => ({ ...user, projectCount: local.listProjects(user.id).length })) });
    }
    const filter = search ? { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] } : {};
    const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
    const rows = await Promise.all(users.map(async (user) => ({ ...safe(user), projectCount: await Project.countDocuments({ user: user._id }), activityCount: await Program.countDocuments({ user: user._id }) })));
    res.json({ success: true, users: rows });
  } catch (err) { next(err); }
}

async function overview(req, res, next) {
  try {
    if (useLocal()) {
      const users = local.adminUsers();
      return res.json({ success: true, metrics: { totalUsers: users.length, activeUsers: users.filter((u) => u.status === 'active').length, newUsers: users.filter((u) => Date.now() - new Date(u.createdAt).getTime() < 30 * 86400000).length, totalProjects: users.reduce((sum, user) => sum + local.listProjects(user.id).length, 0) } });
    }
    const [totalUsers, activeUsers, newUsers, totalProjects, totalPrograms] = await Promise.all([
      User.countDocuments(), User.countDocuments({ status: 'active' }), User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }), Project.countDocuments(), Program.countDocuments(),
    ]);
    res.json({ success: true, metrics: { totalUsers, activeUsers, newUsers, totalProjects, totalPrograms } });
  } catch (err) { next(err); }
}

async function userProjects(req, res, next) {
  try {
    if (useLocal()) return res.json({ success: true, projects: local.listProjects(req.params.userId) });
    const projects = await Project.find({ user: req.params.userId }).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, projects: projects.map((p) => ({ ...p, id: String(p._id) })) });
  } catch (err) { next(err); }
}

async function setUserStatus(req, res, next) {
  try {
    const status = req.body.status === 'suspended' ? 'suspended' : 'active';
    if (String(req.params.userId) === String(req.user._id || req.user.id)) return res.status(400).json({ success: false, message: 'You cannot suspend your own admin account' });
    if (useLocal()) { const user = local.adminSetUserStatus(req.params.userId, status); return user ? res.json({ success: true, user }) : res.status(404).json({ success: false, message: 'User not found' }); }
    const user = await User.findByIdAndUpdate(req.params.userId, { status }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: safe(user) });
  } catch (err) { next(err); }
}

async function deleteUser(req, res, next) {
  try {
    if (String(req.params.userId) === String(req.user._id || req.user.id)) return res.status(400).json({ success: false, message: 'You cannot delete your own admin account' });
    if (useLocal()) return local.adminDeleteUser(req.params.userId) ? res.json({ success: true }) : res.status(404).json({ success: false, message: 'User not found' });
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await Promise.all([Project.deleteMany({ user: req.params.userId }), Program.deleteMany({ user: req.params.userId })]);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function exportUsers(req, res, next) {
  try {
    const users = useLocal() ? local.adminUsers() : (await User.find().sort({ createdAt: -1 })).map(safe);
    const lines = [['id', 'name', 'email', 'role', 'status', 'createdAt', 'lastLoginAt'].join(','), ...users.map((u) => [u.id, u.name, u.email, u.role, u.status, u.createdAt, u.lastLoginAt].map(csvCell).join(','))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="codementor-users.csv"'); res.send(lines.join('\n'));
  } catch (err) { next(err); }
}

module.exports = { listUsers, overview, userProjects, setUserStatus, deleteUser, exportUsers };
