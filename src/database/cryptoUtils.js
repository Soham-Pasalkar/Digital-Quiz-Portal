/**
 * Cryptographic Utility Module
 * [Category C]: Security & Robustness Enhancements
 * 
 * Implements asynchronous password hashing via Node.js native crypto.scrypt()
 * and constant-time password verification via crypto.timingSafeEqual().
 * Synchronous hashing inside request lifecycles is strictly avoided.
 */

const crypto = require('crypto');
const { CRYPTO } = require('../config/constants');

/**
 * Generate a cryptographically random salt.
 * @param {number} [byteLength=16]
 * @returns {string} Hexadecimal salt string
 */
function generateSalt(byteLength = CRYPTO.SALT_BYTE_LENGTH) {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Asynchronously hash a plaintext password with a salt using scrypt.
 * @param {string} password - Plaintext password
 * @param {string} salt - Hexadecimal salt string
 * @param {number} [keyLength=64] - Desired derived key length in bytes
 * @returns {Promise<string>} Hexadecimal hash string
 */
function hashPassword(password, salt, keyLength = CRYPTO.KEY_BYTE_LENGTH) {
  return new Promise((resolve, reject) => {
    if (typeof password !== 'string' || password.length === 0) {
      return reject(new Error('Password must be a non-empty string'));
    }
    if (typeof salt !== 'string' || salt.length === 0) {
      return reject(new Error('Salt must be a non-empty string'));
    }

    crypto.scrypt(password, salt, keyLength, CRYPTO.SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString('hex'));
    });
  });
}

/**
 * Asynchronously verify a plaintext candidate password against a stored hash and salt
 * using constant-time comparison to prevent timing side-channel attacks.
 * @param {string} candidatePassword - Plaintext candidate
 * @param {string} storedHash - Stored hexadecimal hash
 * @param {string} storedSalt - Stored hexadecimal salt
 * @returns {Promise<boolean>} True if matching, false otherwise
 */
async function verifyPassword(candidatePassword, storedHash, storedSalt) {
  if (!candidatePassword || !storedHash || !storedSalt) {
    return false;
  }

  try {
    const candidateHashHex = await hashPassword(candidatePassword, storedSalt);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    const candidateBuffer = Buffer.from(candidateHashHex, 'hex');

    if (storedBuffer.length !== candidateBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(storedBuffer, candidateBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Generate an opaque cryptographically secure 32-byte session token.
 * @returns {string}
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateSalt,
  hashPassword,
  verifyPassword,
  generateSessionToken
};

