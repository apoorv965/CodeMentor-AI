const Project = require('../models/Project');
const local = require('../services/localStore');
const useLocal = () => (process.env.PERSISTENCE_MODE || 'memory') !== 'mongo';
const ownerId = (user) => String(user?._id || user?.id || '');
const cleanFiles = (files) => (Array.isArray(files) ? files : []).slice(0, 100).map((file) => ({
  path: String(file.path || 'main.py').trim().replace(/^\/+/, '').slice(0, 240),
  language: String(file.language || 'text').slice(0, 40),
  content: String(file.content || '').slice(0, 200000),
  updatedAt: file.updatedAt || new Date(),
}));
const publicMongo = (project) => ({ ...project.toObject(), id: String(project._id) });

async function listProjects(req, res, next) {
  try {
    if (useLocal()) return res.json({ success: true, projects: local.listProjects(ownerId(req.user), req.query.search) });
    const filter = { user: req.user._id };
    if (req.query.search) filter.name = { $regex: String(req.query.search).trim(), $options: 'i' };
    const projects = await Project.find(filter).sort({ updatedAt: -1 }).limit(100).lean();
    res.json({ success: true, projects: projects.map((project) => ({ ...project, id: String(project._id) })) });
  } catch (err) { next(err); }
}

async function createProject(req, res, next) {
  try {
    const name = String(req.body.name || 'Untitled Project').trim().slice(0, 100) || 'Untitled Project';
    const files = cleanFiles(req.body.files);
    const starterFiles = files.length ? files : [{ path: 'main.py', language: 'python', content: '' }];
    if (useLocal()) return res.status(201).json({ success: true, project: local.createProject(ownerId(req.user), { name, files: starterFiles }) });
    const project = await Project.create({ user: req.user._id, name, files: starterFiles });
    res.status(201).json({ success: true, project: publicMongo(project) });
  } catch (err) { next(err); }
}

async function getProject(req, res, next) {
  try {
    if (useLocal()) {
      const project = local.getProject(ownerId(req.user), req.params.id);
      return project ? res.json({ success: true, project: local.publicProject(project) }) : res.status(404).json({ success: false, message: 'Project not found' });
    }
    const project = await Project.findOne({ _id: req.params.id, user: req.user._id });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    project.lastOpenedAt = new Date(); await project.save();
    res.json({ success: true, project: publicMongo(project) });
  } catch (err) { next(err); }
}

async function updateProject(req, res, next) {
  try {
    const patch = {};
    if (req.body.name !== undefined) patch.name = String(req.body.name).trim().slice(0, 100);
    if (req.body.files !== undefined) patch.files = cleanFiles(req.body.files);
    if (useLocal()) {
      const project = local.updateProject(ownerId(req.user), req.params.id, patch);
      return project ? res.json({ success: true, project }) : res.status(404).json({ success: false, message: 'Project not found' });
    }
    const project = await Project.findOne({ _id: req.params.id, user: req.user._id });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    if (patch.name) project.name = patch.name;
    if (patch.files) project.files = patch.files;
    await project.save();
    res.json({ success: true, project: publicMongo(project) });
  } catch (err) { next(err); }
}

async function duplicateProject(req, res, next) {
  try {
    if (useLocal()) {
      const source = local.getProject(ownerId(req.user), req.params.id);
      if (!source) return res.status(404).json({ success: false, message: 'Project not found' });
      return res.status(201).json({ success: true, project: local.createProject(ownerId(req.user), { name: `${source.name} copy`, files: source.files }) });
    }
    const source = await Project.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!source) return res.status(404).json({ success: false, message: 'Project not found' });
    const project = await Project.create({ user: req.user._id, name: `${source.name} copy`.slice(0, 100), files: source.files });
    res.status(201).json({ success: true, project: publicMongo(project) });
  } catch (err) { next(err); }
}

async function deleteProject(req, res, next) {
  try {
    if (useLocal()) return local.deleteProject(ownerId(req.user), req.params.id) ? res.json({ success: true }) : res.status(404).json({ success: false, message: 'Project not found' });
    const project = await Project.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { listProjects, createProject, getProject, updateProject, duplicateProject, deleteProject };
