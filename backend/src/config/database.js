const mongoose = require('mongoose');

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
    return true;
  } catch (err) {
    console.error(`[DB] MongoDB connection error: ${err.message}`);
    if (process.env.NODE_ENV === 'production') process.exit(1);
    console.warn('[DB] Continuing in local-first mode for development. Set PERSISTENCE_MODE=memory to silence this warning.');
    return false;
  }
};
module.exports = connectDB;
