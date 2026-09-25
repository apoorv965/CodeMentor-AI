require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const crypto = require('crypto');

const connectDB = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { generalLimiter } = require('./middleware/rateLimiter');

const authRoutes = require('./routes/authRoutes');
const compilerRoutes = require('./routes/compilerRoutes');
const programRoutes = require('./routes/programRoutes');
const mentorRoutes = require('./routes/mentorRoutes');
const problemRoutes = require('./routes/problemRoutes');
const { getOverview } = require('./controllers/analyticsController');
const { protect } = require('./middleware/authMiddleware');

const app = express();
app.disable('x-powered-by');
// The deployed workspace sits behind a reverse proxy. Trust the first proxy
// hop so rate limiting and request logging use the real client address.
app.set('trust proxy', 1);

// ---------- Database ----------
connectDB();

// ---------- Global middleware ----------
app.use(helmet());
app.use((req, res, next) => {
  req.id = req.get('X-Request-ID') || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000,https://apoorv965.github.io')
  .split(',').map(v => v.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Allow non-browser clients (curl/Postman) and explicitly configured browser origins.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    // Manus preview/public workspaces use a rotating subdomain under this host.
    // The frontend and API can be same-product deployments on different ports,
    // so allow only the trusted Manus computer origin pattern here.
    if (/^https:\/\/[^/]+\.manus\.computer$/.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(generalLimiter);

// ---------- Health check ----------
app.get('/', (req, res) => {
  res.status(200).json({ success: true, service: 'CodeMentor backend', health: '/health' });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    persistence: process.env.PERSISTENCE_MODE || 'memory',
    execution: process.env.EXECUTION_MODE || 'auto',
    mentor: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.get('/api/capabilities', (_req, res) => res.json({
  success: true,
  persistence: process.env.PERSISTENCE_MODE || 'memory',
  execution: process.env.EXECUTION_MODE || 'auto',
  mentor: Boolean(process.env.GEMINI_API_KEY),
  analytics: true,
  requestTracing: true,
  languages: ['python', 'cpp', 'java'],
}));

// ---------- Routes ----------
app.use('/api/auth', authRoutes);
app.use('/api', compilerRoutes); // -> POST /api/execute
app.use('/api/programs', programRoutes);
app.use('/api/mentor', mentorRoutes); // -> POST /api/mentor/explain | /find-bug | /hint
app.use('/api/problems', problemRoutes); // -> GET /, GET /:id, POST /:id/submit
app.get('/api/analytics/overview', protect, getOverview);

// ---------- Error handling (must be last) ----------
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
