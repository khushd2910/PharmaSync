const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Verifies the access token JWT — read from the httpOnly cookie by default,
 * with an Authorization: Bearer fallback (useful for API testing tools like
 * Postman/curl that don't hold cookies) — and attaches the user to req.user
 */
const protect = catchAsync(async (req, res, next) => {
  let token = req.cookies?.accessToken;

  if (!token && req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Not authorized, please log in', 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await User.findById(decoded.id);

  if (!user || !user.isActive) {
    return next(new AppError('Not authorized, user not found or inactive', 401));
  }

  req.user = user;
  next();
});

/**
 * Restricts access to admin-role users only. Must be used AFTER `protect`.
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return next(new AppError('Access denied. Admins only.', 403));
};

/**
 * Like `protect`, but never blocks the request — attaches req.user if a
 * valid session exists, otherwise leaves it undefined and moves on. For
 * routes usable by guests and logged-in users alike (Module 9 chat, where
 * only some intents actually need to know who's asking).
 */
const optionalAuth = async (req, res, next) => {
  let token = req.cookies?.accessToken;
  if (!token && req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.isActive) req.user = user;
  } catch (err) {
    // Invalid/expired token on an optional route — just proceed as a guest
  }
  next();
};

module.exports = { protect, adminOnly, optionalAuth };
