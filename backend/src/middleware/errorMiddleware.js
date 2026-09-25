/**
 * Catches requests to routes that don't exist and forwards a 404 error
 * into the central error handler below.
 */
const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found - ${req.method} ${req.originalUrl}`));
};

/**
 * Central error handler. Any error passed to next(err) anywhere in the
 * app (including inside async controllers) ends up here.
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.message?.startsWith('CORS blocked') ? 403 : (err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500));

  console.error(`[ERROR] ${req.id || 'no-request-id'} ${req.method} ${req.originalUrl} -> ${err.message}`);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    requestId: req.id,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
