const jwt = require('jsonwebtoken');

/**
 * Generates a signed JWT containing the user's id and role.
 * @param {string} id - MongoDB user _id
 * @param {string} role - 'user' | 'admin'
 * @returns {string} signed JWT
 */
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

module.exports = generateToken;
