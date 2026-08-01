const test = require('node:test');
const assert = require('node:assert/strict');
const sendEmail = require('../utils/sendEmail');

test('returns an explicit error when real email delivery is required but SMTP is not configured', async () => {
  delete process.env.SMTP_SERVICE;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  const result = await sendEmail({
    to: 'test@example.com',
    subject: 'Test',
    text: 'Hello',
    allowFallback: false,
  });

  assert.equal(result.success, false);
  assert.match(result.error, /SMTP/i);
});
