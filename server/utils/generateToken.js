const jwt = require('jsonwebtoken');

/**
 * Short-lived token used to authenticate normal API requests.
 * Sent to the client as an httpOnly cookie.
 */
const generateAccessToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
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
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  });
};

module.exports = { generateAccessToken, generateRefreshToken };
