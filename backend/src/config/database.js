const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Problem = require('../models/Problem');

async function ensureProblemCatalog() {
  if (process.env.AUTO_SEED_PROBLEMS === 'false') return;
  const count = await Problem.estimatedDocumentCount();
  if (count > 0) { console.log(`[DB] Problem catalog ready: ${count} problems.`); return; }
  const sourcePath = path.join(__dirname, '..', 'seed', 'problems.raw.json');
  const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const seen = new Set();
  const ops = raw.filter((p) => p && p.id && !seen.has(p.id) && (seen.add(p.id))).map((p) => {
    const tests = (Array.isArray(p.tests) ? p.tests : []).filter((test) => test && typeof test.input === 'string' && typeof test.expected === 'string');
    return { updateOne: { filter: { problemId: p.id }, update: { $set: {
      problemId: p.id, title: p.title, description: p.description, difficulty: p.difficulty, tags: p.tags || [], starter: p.starter || '', fnName: p.fnName, paramTypes: p.paramTypes || [], returnType: p.returnType, publicTests: tests.length ? [tests[0]] : [], hiddenTests: tests, hasJudge: tests.length > 0, needsManualTests: tests.length === 0, sourceTestCount: tests.length,
    } }, upsert: true } };
  });
  if (ops.length) { const result = await Problem.bulkWrite(ops, { ordered: false }); console.log(`[DB] Seeded problem catalog: ${result.upsertedCount || 0} new / ${ops.length} source problems.`); }
}

const connectDB = async () => {
  const mode = process.env.PERSISTENCE_MODE || 'memory';
  if (mode !== 'mongo') {
    console.log('[DB] Local-first mode enabled; using in-memory persistence for this environment.');
    return false;
  }
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGO_URI is required when PERSISTENCE_MODE=mongo');
  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000, retryWrites: true });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    await ensureProblemCatalog();
    return true;
  } catch (err) {
    console.error(`[DB] MongoDB connection error: ${err.message}`);
    if (process.env.NODE_ENV === 'production') process.exit(1);
    console.warn('[DB] Continuing in local-first mode for development. Set PERSISTENCE_MODE=memory to silence this warning.');
    return false;
  }
};
module.exports = connectDB;
