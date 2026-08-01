const crypto = require('crypto');

const ADMIN_MFA_SECRET = process.env.ADMIN_MFA_SECRET || null;
const OTP_TTL_MS = 5 * 60 * 1000;

const getAdminMfaEnabled = () => process.env.ADMIN_MFA_ENABLED !== 'false';
const getAdminOtpRecipient = () => process.env.ADMIN_OTP_EMAIL || 'khushdesai2910@gmail.com';

const createAdminOtpChallenge = (user) => {
  if (!getAdminMfaEnabled()) {
    return { enabled: false, challengeId: null, code: null, recipient: null };
  }

  const challengeId = crypto.randomBytes(16).toString('hex');
  const code = crypto.randomInt(100000, 999999).toString().padStart(6, '0');
  user.adminMfaChallengeId = challengeId;
  user.adminMfaCodeHash = crypto.createHash('sha256').update(code).digest('hex');
  user.adminMfaCodeExpiresAt = Date.now() + OTP_TTL_MS;

  return {
    enabled: true,
    challengeId,
    code,
    recipient: getAdminOtpRecipient(),
  };
};

const verifyAdminOtpCode = async (user, code) => {
  if (!getAdminMfaEnabled()) {
    return true;
  }

  if (!user.adminMfaChallengeId || !user.adminMfaCodeHash || !user.adminMfaCodeExpiresAt) {
    return false;
  }

  if (user.adminMfaCodeExpiresAt < Date.now()) {
    user.adminMfaChallengeId = undefined;
    user.adminMfaCodeHash = undefined;
    user.adminMfaCodeExpiresAt = undefined;
    if (typeof user.save === 'function') {
      await user.save({ validateBeforeSave: false });
    }
    return false;
  }

  const hashed = crypto.createHash('sha256').update(String(code).trim()).digest('hex');
  const matched = hashed === user.adminMfaCodeHash;

  if (matched) {
    user.adminMfaChallengeId = undefined;
    user.adminMfaCodeHash = undefined;
    user.adminMfaCodeExpiresAt = undefined;
    if (typeof user.save === 'function') {
      await user.save({ validateBeforeSave: false });
    }
  }

  return matched;
};

const createAdminMfaChallenge = (user) => createAdminOtpChallenge(user);
const verifyAdminMfaCode = async (user, code) => verifyAdminOtpCode(user, code);

module.exports = {
  getAdminMfaEnabled,
  createAdminMfaChallenge,
  verifyAdminMfaCode,
  createAdminOtpChallenge,
  verifyAdminOtpCode,
  getAdminOtpRecipient,
  ADMIN_MFA_SECRET,
};
