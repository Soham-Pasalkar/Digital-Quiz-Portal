/**
 * Cryptographic Utilities Test Suite
 * [Category C]: Asynchronous scrypt hashing & constant-time verification
 */

const { generateSalt, hashPassword, verifyPassword, generateSessionToken } = require('../../src/database/cryptoUtils');

describe('Cryptographic Utilities (cryptoUtils)', () => {
  describe('generateSalt', () => {
    test('generates a 32-character hexadecimal string for default 16 bytes', () => {
      const salt = generateSalt();
      expect(typeof salt).toBe('string');
      expect(salt).toHaveLength(32);
      expect(/^[0-9a-f]+$/i.test(salt)).toBe(true);
    });

    test('generates unique salts across successive calls', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe('hashPassword & verifyPassword', () => {
    test('asynchronously derives a 128-character hexadecimal scrypt hash (64 bytes)', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('student123', salt);
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(128);
      expect(/^[0-9a-f]+$/i.test(hash)).toBe(true);
    });

    test('produces distinct hashes for identical passwords when using different salts', async () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      const hash1 = await hashPassword('admin123', salt1);
      const hash2 = await hashPassword('admin123', salt2);
      expect(hash1).not.toBe(hash2);
    });

    test('successfully verifies the correct password using constant-time comparison', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('correctPassword', salt);

      const isValid = await verifyPassword('correctPassword', hash, salt);
      expect(isValid).toBe(true);
    });

    test('strictly rejects an incorrect password', async () => {
      const salt = generateSalt();
      const hash = await hashPassword('correctPassword', salt);

      const isValid = await verifyPassword('wrongPassword', hash, salt);
      expect(isValid).toBe(false);
    });

    test('safely rejects empty or malformed inputs without throwing unexpected errors', async () => {
      expect(await verifyPassword('', 'hash', 'salt')).toBe(false);
      expect(await verifyPassword(null, 'hash', 'salt')).toBe(false);
      expect(await verifyPassword('pass', null, 'salt')).toBe(false);
      expect(await verifyPassword('pass', 'hash', null)).toBe(false);
    });

    test('rejects hashing empty passwords with a descriptive error', async () => {
      const salt = generateSalt();
      await expect(hashPassword('', salt)).rejects.toThrow('Password must be a non-empty string');
    });
  });

  describe('generateSessionToken', () => {
    test('generates a 64-character hexadecimal session token (32 bytes)', () => {
      const token = generateSessionToken();
      expect(typeof token).toBe('string');
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]+$/i.test(token)).toBe(true);
    });
  });
});

