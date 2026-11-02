/**
 * AuthService Unit Tests
 * [Category A]: User authentication and RBAC verification (STQA §1, §2)
 * [Category B]: Session registry, TTL, and logout invalidation
 * [Category C]: Async scrypt verification, constant-time checks, zero credential leakage
 */

const { initDatabase } = require('../../src/database/db');
const { generateSalt, hashPassword } = require('../../src/database/cryptoUtils');
const UserRepository = require('../../src/dal/userRepository');
const AuthService = require('../../src/services/authService');
const { ROLES } = require('../../src/config/constants');

describe('AuthService', () => {
  let db;
  let userRepo;
  let authService;
  let adminUser;
  let studentUser;

  beforeEach(async () => {
    db = await initDatabase({ dbPath: ':memory:' });
    userRepo = new UserRepository(db);
    authService = new AuthService({ userRepo, sessionTtlMs: 50 }); // 50ms TTL for fast expiration tests

    // Seed test users
    const adminSalt = generateSalt();
    const adminHash = await hashPassword('AdminPass123', adminSalt);
    adminUser = userRepo.createUser({
      username: 'admin_test',
      passwordHash: adminHash,
      salt: adminSalt,
      role: ROLES.ADMIN
    });

    const studentSalt = generateSalt();
    const studentHash = await hashPassword('StudentPass123', studentSalt);
    studentUser = userRepo.createUser({
      username: 'student_test',
      passwordHash: studentHash,
      salt: studentSalt,
      role: ROLES.STUDENT
    });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('User Authentication (login)', () => {
    test('successfully authenticates admin with valid credentials and issues session token', async () => {
      const result = await authService.login('admin_test', 'AdminPass123');

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBe(64); // 32 bytes in hex

      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(adminUser.id);
      expect(result.user.username).toBe('admin_test');
      expect(result.user.role).toBe(ROLES.ADMIN);

      // Verify that neither password_hash nor salt is exposed
      expect(result.user.password_hash).toBeUndefined();
      expect(result.user.salt).toBeUndefined();
    });

    test('successfully authenticates student with valid credentials', async () => {
      const result = await authService.login('student_test', 'StudentPass123');

      expect(result.user.username).toBe('student_test');
      expect(result.user.role).toBe(ROLES.STUDENT);
      expect(authService.isStudent(result.token)).toBe(true);
      expect(authService.isAdmin(result.token)).toBe(false);
    });

    test('case-insensitively resolves username during login', async () => {
      const result = await authService.login('ADMIN_TEST', 'AdminPass123');
      expect(result.user.username).toBe('admin_test');
    });

    test('rejects authentication with incorrect password', async () => {
      await expect(authService.login('admin_test', 'WrongPassword')).rejects.toThrow(
        /Invalid username or password/i
      );
    });

    test('rejects authentication for non-existent username', async () => {
      await expect(authService.login('non_existent', 'SomePassword')).rejects.toThrow(
        /Invalid username or password/i
      );
    });

    test('rejects malformed or missing username/password inputs', async () => {
      await expect(authService.login('', 'Pass')).rejects.toThrow(/Username is required/i);
      await expect(authService.login(null, 'Pass')).rejects.toThrow(/Username is required/i);
      await expect(authService.login('admin_test', '')).rejects.toThrow(/Password is required/i);
      await expect(authService.login('admin_test', null)).rejects.toThrow(/Password is required/i);
    });
  });

  describe('Session Validation & Invalidation', () => {
    test('validates an active session token and returns sanitized user', async () => {
      const { token } = await authService.login('admin_test', 'AdminPass123');

      const validated = authService.validateSession(token);
      expect(validated).not.toBeNull();
      expect(validated.id).toBe(adminUser.id);
      expect(validated.username).toBe('admin_test');
      expect(validated.role).toBe(ROLES.ADMIN);
      expect(validated.password_hash).toBeUndefined();
      expect(validated.salt).toBeUndefined();
    });

    test('returns null for unknown or malformed session tokens', () => {
      expect(authService.validateSession('unknown_token_value')).toBeNull();
      expect(authService.validateSession('')).toBeNull();
      expect(authService.validateSession(null)).toBeNull();
      expect(authService.validateSession(undefined)).toBeNull();
    });

    test('expires sessions after the configured TTL', async () => {
      const { token } = await authService.login('student_test', 'StudentPass123');
      expect(authService.validateSession(token)).not.toBeNull();

      // Wait 70ms for TTL expiration (service initialized with 50ms TTL)
      await new Promise(resolve => setTimeout(resolve, 70));

      expect(authService.validateSession(token)).toBeNull();
    });

    test('invalidates session on logout', async () => {
      const { token } = await authService.login('student_test', 'StudentPass123');
      expect(authService.validateSession(token)).not.toBeNull();

      const loggedOut = authService.logout(token);
      expect(loggedOut).toBe(true);

      // After logout, token must be invalid
      expect(authService.validateSession(token)).toBeNull();

      // Second logout on same token returns false
      expect(authService.logout(token)).toBe(false);
    });

    test('prunes expired sessions accurately', async () => {
      const { token } = await authService.login('student_test', 'StudentPass123');
      expect(authService.getActiveSessionCount()).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 70));

      const pruned = authService.cleanExpiredSessions();
      expect(pruned).toBe(1);
      expect(authService.getActiveSessionCount()).toBe(0);
    });
  });

  describe('Role & Authorization Helpers', () => {
    test('retrieves user role by ID', () => {
      expect(authService.getUserRole(adminUser.id)).toBe(ROLES.ADMIN);
      expect(authService.getUserRole(studentUser.id)).toBe(ROLES.STUDENT);
      expect(authService.getUserRole(9999)).toBeNull();
      expect(authService.getUserRole(null)).toBeNull();
    });

    test('correctly distinguishes Admin and Student tokens', async () => {
      const adminLogin = await authService.login('admin_test', 'AdminPass123');
      const studentLogin = await authService.login('student_test', 'StudentPass123');

      expect(authService.isAdmin(adminLogin.token)).toBe(true);
      expect(authService.isStudent(adminLogin.token)).toBe(false);

      expect(authService.isAdmin(studentLogin.token)).toBe(false);
      expect(authService.isStudent(studentLogin.token)).toBe(true);
    });
  });
});
