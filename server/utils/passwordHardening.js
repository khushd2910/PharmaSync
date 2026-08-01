const crypto = require('crypto');
const https = require('https');

const PASSWORD_POLICY = {
  minLength: 12,
  minUppercase: 1,
  minLowercase: 1,
  minNumbers: 1,
  minSymbols: 1,
};

const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  'qwerty',
  'qwerty123',
  'welcome',
  'welcome123',
  'admin',
  'admin123',
  'letmein',
  'letmein123',
  'secret',
  'secret123',
  'changeme',
  'changeme123',
  'pharma',
  'pharmacy',
  'pharma123',
  'drugstore',
  'drugstore123',
]);

const isPasswordStrong = (password) => {
  if (typeof password !== 'string') return false;
  const trimmed = password.trim();
  if (!trimmed || trimmed.length < PASSWORD_POLICY.minLength) return false;
  if (trimmed !== password) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return false;
  return true;
};

const getPasswordPolicyMessage = () =>
  'Password must be at least 12 characters long and include uppercase, lowercase, a number, and a symbol.';

const checkPasswordExposure = async (password) => {
  if (process.env.PWNED_PASSWORDS_ENABLED !== 'true') {
    return { isCompromised: false, count: null, message: 'Breach check is disabled.' };
  }

  if (typeof password !== 'string' || !password) {
    return { isCompromised: false, count: null, message: 'No password provided.' };
  }

  const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  return new Promise((resolve) => {
    const req = https.get(
      {
        hostname: 'api.pwnedpasswords.com',
        path: `/range/${prefix}`,
        method: 'GET',
        timeout: 4000,
        headers: { 'Add-Padding': 'true' },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const matches = body.split(/\r?\n/);
          const hit = matches.find((line) => line.toUpperCase().startsWith(suffix));
          if (!hit) {
            resolve({ isCompromised: false, count: 0, message: 'Password not found in known breaches.' });
            return;
          }

          const count = Number(hit.split(':')[1] || '0');
          resolve({
            isCompromised: true,
            count,
            message: `Password has been exposed ${count} times in known breaches. Please choose a different one.`,
          });
        });
      }
    );

    req.on('error', () => {
      resolve({ isCompromised: false, count: null, message: 'Breach check could not be completed right now.' });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ isCompromised: false, count: null, message: 'Breach check timed out.' });
    });
  });
};

module.exports = {
  PASSWORD_POLICY,
  isPasswordStrong,
  getPasswordPolicyMessage,
  checkPasswordExposure,
};
