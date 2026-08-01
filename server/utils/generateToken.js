const jwt = require('jsonwebtoken');

const isSecureSecret = (value) => typeof value === 'string' && value.length >= 32 && !/^(changeme|replace-me|example|secret)$/i.test(value);

// Exported (not just used locally) so cookieOptions.js can derive its
// maxAge from the exact same value instead of hardcoding a separate copy —
// see the note there about the cookie/token drift bug this fixes.
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';

if (process.env.NODE_ENV === 'production') {
  if (!isSecureSecret(process.env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be set to a strong 32+ character value in production.');
  }
  if (!isSecureSecret(process.env.REFRESH_TOKEN_SECRET)) {
    throw new Error('REFRESH_TOKEN_SECRET must be set to a strong 32+ character value in production.');
  }
}

/**
 * Short-lived token used to authenticate normal API requests.
 * Sent to the client as an httpOnly cookie.
 */
const generateAccessToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
};

/**
 * Long-lived token used only to silently obtain a new access token once it
 * expires. Signed with a separate secret so a leaked access token can't be
 * used to forge a refresh token. Also stored (hashed) on the User document
 * so it can be revoked server-side on logout.
 */
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
};
