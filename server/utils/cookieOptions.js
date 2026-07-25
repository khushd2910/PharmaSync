const { ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } = require('./generateToken');

const isProd = process.env.NODE_ENV === 'production';

const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

// Parses a jsonwebtoken-style "expiresIn" value (e.g. '15m', '30d', '1h', or
// a bare number of seconds as jsonwebtoken itself accepts) into milliseconds
// for cookie maxAge. This used to be a second, hand-copied number in this
// file ("15 minutes, mirrors ACCESS_TOKEN_EXPIRES_IN default") — harmless as
// long as nobody ever changed the env var, but the moment someone set
// ACCESS_TOKEN_EXPIRES_IN=1h without knowing to also update this file, the
// browser would delete the cookie at 15 minutes while the token itself was
// still valid for the other 45, logging people out early for no visible
// reason. Deriving it from the same value generateToken.js signs with means
// there's nothing left to keep in sync by hand.
const parseDurationMs = (value, fallbackMs) => {
  if (/^\d+$/.test(String(value))) return Number(value) * 1000; // bare number = seconds
  const match = /^(\d+(?:\.\d+)?)\s*(s|m|h|d|w|y)$/i.exec(String(value).trim());
  if (!match) return fallbackMs; // unrecognized format — fall back rather than ship a broken cookie
  return Number(match[1]) * UNIT_MS[match[2].toLowerCase()];
};

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
  maxAge: parseDurationMs(ACCESS_TOKEN_EXPIRES_IN, 15 * 60 * 1000),
};

const refreshTokenCookieOptions = {
  ...baseCookieOptions,
  maxAge: parseDurationMs(REFRESH_TOKEN_EXPIRES_IN, 30 * 24 * 60 * 60 * 1000),
};

module.exports = { accessTokenCookieOptions, refreshTokenCookieOptions };
