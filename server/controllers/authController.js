const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const sendEmail = require('../utils/sendEmail');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateToken');
const { accessTokenCookieOptions, refreshTokenCookieOptions } = require('../utils/cookieOptions');

const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0];
const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

// Issues a fresh access+refresh token pair for a user, stores the hashed
// refresh token on the document, and sets both as httpOnly cookies.
const issueTokens = async (user, res) => {
  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshTokenHash = user.hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  res.cookie('accessToken', accessToken, accessTokenCookieOptions);
  res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isVerified: user.isVerified,
});

// @desc    Register a new user (role: user) and email a verification link
// @route   POST /api/auth/register
// @access  Public
const registerUser = catchAsync(async (req, res, next) => {
  const { name, email, password, phone, address } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('An account with this email already exists', 409));
  }

  const user = new User({ name, email, password, phone, address, role: 'user' });
  const rawVerificationToken = user.createVerificationToken();
  await user.save();

  const verifyUrl = `${CLIENT_URL}/verify-email/${rawVerificationToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your Pharma Management account',
    text: `Welcome ${user.name}! Verify your email by visiting: ${verifyUrl} (expires in 24 hours)`,
    html: `<p>Welcome ${user.name}!</p><p>Verify your email by clicking below (expires in 24 hours):</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });

  await issueTokens(user, res);

  return res.status(201).json({
    message: REQUIRE_EMAIL_VERIFICATION
      ? 'Registration successful. Please check your email to verify your account.'
      : 'Registration successful',
    user: publicUser(user),
  });
});

// @desc    Login user (or admin) with email & password
// @route   POST /api/auth/login
// @access  Public
const loginUser = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    return next(new AppError('Invalid email or password', 401));
  }

  if (!user.isActive) {
    return next(new AppError('This account has been deactivated', 403));
  }

  if (REQUIRE_EMAIL_VERIFICATION && !user.isVerified) {
    return next(new AppError('Please verify your email before logging in', 403));
  }

  await issueTokens(user, res);

  return res.status(200).json({
    message: 'Login successful',
    user: publicUser(user),
  });
});

// @desc    Login restricted to admin accounts only
// @route   POST /api/auth/admin/login
// @access  Public
const loginAdmin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    return next(new AppError('Invalid email or password', 401));
  }

  if (user.role !== 'admin') {
    return next(new AppError('Access denied. Not an admin account.', 403));
  }

  if (!user.isActive) {
    return next(new AppError('This account has been deactivated', 403));
  }

  await issueTokens(user, res);

  return res.status(200).json({
    message: 'Admin login successful',
    user: publicUser(user),
  });
});

// @desc    Exchange a valid refresh-token cookie for a new access token
//          (and rotate the refresh token for better security)
// @route   POST /api/auth/refresh
// @access  Public (requires refreshToken cookie)
const refreshAccessToken = catchAsync(async (req, res, next) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return next(new AppError('No refresh token provided, please log in', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch (err) {
    return next(new AppError('Invalid or expired session, please log in again', 401));
  }

  const user = await User.findById(decoded.id).select('+refreshTokenHash');

  if (!user || !user.refreshTokenHash || user.hashToken(token) !== user.refreshTokenHash) {
    return next(new AppError('Session no longer valid, please log in again', 401));
  }

  await issueTokens(user, res);

  return res.status(200).json({ message: 'Session refreshed', user: publicUser(user) });
});

// @desc    Get currently logged-in user's profile
// @route   GET /api/auth/me
// @access  Private
const getMe = catchAsync(async (req, res) => {
  return res.status(200).json({ user: publicUser(req.user) });
});

// @desc    Logout user — clears cookies and invalidates the stored refresh token
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = catchAsync(async (req, res) => {
  if (req.user) {
    req.user.refreshTokenHash = undefined;
    await req.user.save({ validateBeforeSave: false });
  }
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  return res.status(200).json({ message: 'Logged out successfully' });
});

// @desc    Verify email using the token emailed at registration
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = catchAsync(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    verificationToken: hashedToken,
    verificationExpires: { $gt: Date.now() },
  }).select('+verificationToken +verificationExpires');

  if (!user) {
    return next(new AppError('Verification link is invalid or has expired', 400));
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json({ message: 'Email verified successfully' });
});

// @desc    Request a password-reset email
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  // Always respond the same way whether or not the account exists,
  // so attackers can't use this endpoint to enumerate registered emails
  const genericResponse = {
    message: 'If an account with that email exists, a password reset link has been sent.',
  };

  if (!user) {
    return res.status(200).json(genericResponse);
  }

  const rawToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${CLIENT_URL}/reset-password/${rawToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your Pharma Management password',
    text: `Reset your password by visiting: ${resetUrl} (expires in 1 hour). If you didn't request this, ignore this email.`,
    html: `<p>Reset your password by clicking below (expires in 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });

  return res.status(200).json(genericResponse);
});

// @desc    Reset password using the token emailed by forgotPassword
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    return next(new AppError('Reset link is invalid or has expired', 400));
  }

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokenHash = undefined; // force re-login everywhere
  await user.save();

  return res.status(200).json({ message: 'Password reset successful. Please log in with your new password.' });
});

module.exports = {
  registerUser,
  loginUser,
  loginAdmin,
  refreshAccessToken,
  getMe,
  logoutUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
};
