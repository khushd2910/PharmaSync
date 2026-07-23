const AppError = require('../utils/AppError');

// Translate common Mongoose/JWT errors into clean AppErrors
const handleCastError = (err) => new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateFieldError = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const value = err.keyValue?.[field];
  // Generic phrasing — this fires for any unique-index collision (user
  // email, invoice number, medicine barcode, ...), not just accounts.
  return new AppError(`A record with this ${field} (${value}) already exists`, 409);
};

const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError(`Invalid input: ${messages.join('. ')}`, 400);
};

const handleJWTError = () => new AppError('Invalid or expired session. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Your session has expired. Please log in again.', 401);

// Turns any thrown error — ours (AppError, already clean) or one of
// Mongoose/JWT's raw error types — into a clean, safe-to-show AppError.
// This used to only run in production, which meant every raw Mongoose/JWT
// error (including a bare "jwt expired") went straight to the client with
// a full stack trace any time NODE_ENV was left at its default of
// "development" — which, for a project like this, is most of the time.
// Translation now always runs first; only whether the *stack trace* gets
// attached afterward depends on environment.
const translateError = (err) => {
  if (err.isOperational) return err; // already one of our own clean AppErrors

  if (err.name === 'CastError') return handleCastError(err);
  if (err.code === 11000) return handleDuplicateFieldError(err);
  if (err.name === 'ValidationError') return handleValidationError(err);
  if (err.name === 'JsonWebTokenError') return handleJWTError();
  if (err.name === 'TokenExpiredError') return handleJWTExpiredError();

  // Genuinely unexpected (programming) error — log it server-side either way.
  console.error('UNEXPECTED ERROR 💥', err);
  return new AppError('Something went wrong. Please try again later.', 500);
};

// eslint-disable-next-line no-unused-vars
const globalErrorHandler = (err, req, res, next) => {
  const cleaned = translateError(err);
  const isDev = process.env.NODE_ENV === 'development';

  const body = {
    status: cleaned.status || 'error',
    message: cleaned.message,
  };
  // Stack trace is a debugging aid, not something a client should ever
  // need — attach it only outside production, and only the *original*
  // error's stack (the translated AppError's own stack just points at
  // this file, which isn't useful for tracking down what actually broke).
  if (isDev) {
    body.stack = err.stack;
  }

  return res.status(cleaned.statusCode || 500).json(body);
};

module.exports = globalErrorHandler;
