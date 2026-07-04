const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  loginAdmin,
  refreshAccessToken,
  getMe,
  logoutUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { authLimiter, loginLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const {
  validate,
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
} = require('../middleware/validators');

// Public
router.post('/register', authLimiter, registerRules, validate, registerUser);
router.post('/login', loginLimiter, loginRules, validate, loginUser);
router.post('/admin/login', loginLimiter, loginRules, validate, loginAdmin);
router.post('/refresh', authLimiter, refreshAccessToken);
router.get('/verify-email/:token', authLimiter, verifyEmail);
router.post('/forgot-password', passwordResetLimiter, forgotPasswordRules, validate, forgotPassword);
router.post('/reset-password/:token', passwordResetLimiter, resetPasswordRules, validate, resetPassword);

// Private
router.get('/me', protect, getMe);
router.post('/logout', protect, logoutUser);

module.exports = router;
