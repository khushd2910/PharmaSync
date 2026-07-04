/**
 * Wraps an async route handler so any thrown/rejected error is automatically
 * forwarded to Express's `next(err)` instead of needing a try/catch in
 * every single controller function.
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
