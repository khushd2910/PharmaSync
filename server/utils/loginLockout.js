const loginAttempts = new Map();

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 5 * 60 * 1000;
const LOCKOUT_AFTER_FAILURES = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const getLoginAttemptKey = (req, email) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return `${String(ip)}:${normalizedEmail}`;
};

const getLoginFailureState = (attemptKey) => {
  const entry = loginAttempts.get(attemptKey);
  const now = Date.now();

  if (!entry) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
    };
  }

  if (entry.resetAt && entry.resetAt <= now) {
    loginAttempts.delete(attemptKey);
    return { blocked: false, retryAfterSeconds: 0 };
  }

  return { blocked: false, retryAfterSeconds: 0 };
};

const recordFailedLogin = (attemptKey) => {
  const now = Date.now();
  const existing = loginAttempts.get(attemptKey) || { failures: 0, lockedUntil: 0, resetAt: now + 15 * 60 * 1000 };

  existing.failures += 1;
  if (existing.failures >= LOCKOUT_AFTER_FAILURES) {
    existing.lockedUntil = now + LOCKOUT_DURATION_MS;
  } else {
    const delayMs = Math.min(BASE_DELAY_MS * 2 ** (existing.failures - 1), MAX_DELAY_MS);
    existing.lockedUntil = now + delayMs;
  }
  existing.resetAt = now + 15 * 60 * 1000;
  loginAttempts.set(attemptKey, existing);

  return {
    blocked: existing.failures >= LOCKOUT_AFTER_FAILURES,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.lockedUntil - now) / 1000)),
  };
};

const clearFailedLogin = (attemptKey) => {
  loginAttempts.delete(attemptKey);
};

module.exports = {
  getLoginAttemptKey,
  getLoginFailureState,
  recordFailedLogin,
  clearFailedLogin,
};
