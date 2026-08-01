const test = require('node:test');
const assert = require('node:assert/strict');

const { isPasswordStrong, getPasswordPolicyMessage } = require('../utils/passwordHardening');

test('accepts strong passwords with mixed case, numbers, and symbols', () => {
  assert.equal(isPasswordStrong('StrongPass!23'), true);
  assert.equal(isPasswordStrong('weakpass123'), false);
});

test('returns a clear policy message for weaker passwords', () => {
  assert.match(getPasswordPolicyMessage(), /12 characters/i);
  assert.match(getPasswordPolicyMessage(), /uppercase/i);
});
