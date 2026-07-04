/**
 * Custom error class for expected/operational errors (bad input, not found,
 * unauthorized, etc.) as opposed to programming bugs. The global error
 * handler uses `isOperational` to decide whether it's safe to show the
 * message directly to the client.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
