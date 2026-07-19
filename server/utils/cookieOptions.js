const isProd = process.env.NODE_ENV === 'production';

// `sameSite: 'lax'` works for same-site dev (localhost:5173 -> localhost:5000).
// If client and server end up on different domains in production, switch to
// 'none' and ensure `secure: true` (requires HTTPS).
const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
};

const accessTokenCookieOptions = {
  ...baseCookieOptions,
  maxAge: 15 * 60 * 1000, // 15 minutes, mirrors ACCESS_TOKEN_EXPIRES_IN default
};

const refreshTokenCookieOptions = {
  ...baseCookieOptions,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, mirrors REFRESH_TOKEN_EXPIRES_IN default
};

module.exports = { accessTokenCookieOptions, refreshTokenCookieOptions };
