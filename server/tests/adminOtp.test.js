const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminOtpChallenge, verifyAdminOtpCode, getAdminOtpRecipient } = require('../utils/adminMfa');

test('creates an admin OTP challenge for the configured email recipient and verifies it', async () => {
  process.env.ADMIN_MFA_ENABLED = 'true';
  process.env.ADMIN_OTP_EMAIL = 'khushdesai2910@gmail.com';

  const user = { email: 'admin@example.com' };
  const challenge = createAdminOtpChallenge(user);

  assert.equal(challenge.enabled, true);
  assert.equal(challenge.recipient, 'khushdesai2910@gmail.com');
  assert.equal(challenge.code.length, 6);

  const verified = await verifyAdminOtpCode(user, challenge.code);
  assert.equal(verified, true);
  assert.equal(user.adminMfaChallengeId, undefined);
});

test('returns the configured admin OTP recipient', () => {
  process.env.ADMIN_OTP_EMAIL = 'khushdesai2910@gmail.com';
  assert.equal(getAdminOtpRecipient(), 'khushdesai2910@gmail.com');
});
