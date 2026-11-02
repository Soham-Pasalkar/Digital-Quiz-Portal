/**
 * Authentication & Session Management Domain Service
 * [Category A]: User authentication and Role-Based Access Control (STQA §1, §2, OOMD Diagram 1, 2)
 * [Category B]: In-memory session registry with 24-hour TTL
 * [Category C]: Asynchronous scrypt verification with constant-time equality; zero credential leakage
 */

const { verifyPassword, generateSessionToken } = require('../database/cryptoUtils');
const { SESSION, ROLES } = require('../config/constants');

class AuthService {
  /**
   * @param {Object} dependencies
   * @param {import('../dal/userRepository')} dependencies.userRepo
   * @param {number} [dependencies.sessionTtlMs=SESSION.DEFAULT_TTL_MS]
   */
  constructor({ userRepo, sessionTtlMs = SESSION.DEFAULT_TTL_MS }) {
    if (!userRepo) {
      throw new Error('AuthService requires a UserRepository instance.');
    }
    this.userRepo = userRepo;
    this.sessionTtlMs = sessionTtlMs;

    // In-memory session store: token -> { userId, username, role, expiresAt, createdAt }
    this.sessions = new Map();
  }

  /**
   * Authenticate a user by username and password.
   * Derives scrypt hash asynchronously and performs constant-time comparison.
   * Issues a cryptographically secure 256-bit session token upon success.
   * 
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ user: { id: number, username: string, role: string }, token: string }>}
   */
  async login(username, password) {
    if (!username || typeof username !== 'string' || !username.trim()) {
      throw new Error('Username is required.');
    }
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required.');
    }

    const user = this.userRepo.findByUsername(username.trim());
    if (!user) {
      // Safe generic authentication error to prevent user enumeration
      throw new Error('Invalid username or password.');
    }

    const isMatch = await verifyPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      throw new Error('Invalid username or password.');
    }

    const token = generateSessionToken();
    const now = Date.now();
    const expiresAt = now + this.sessionTtlMs;

    const sessionData = {
      userId: user.id,
      username: user.username,
      role: user.role,
      createdAt: now,
      expiresAt
    };

    this.sessions.set(token, sessionData);

    // Sanitize user object: NEVER expose password_hash or salt
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      token
    };
  }

  /**
   * Validate a session token.
   * Returns sanitized user information if session is active and not expired; null otherwise.
   * 
   * @param {string} token
   * @returns {{ id: number, username: string, role: string }|null}
   */
  validateSession(token) {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }

    // Check expiration
    if (Date.now() >= session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    return {
      id: session.userId,
      username: session.username,
      role: session.role
    };
  }

  /**
   * Logout and invalidate an active session token.
   * 
   * @param {string} token
   * @returns {boolean} True if session was found and invalidated, false otherwise
   */
  logout(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }
    return this.sessions.delete(token);
  }

  /**
   * Retrieve the role for a specific user ID.
   * 
   * @param {number} userId
   * @returns {string|null} 'admin' | 'student' | null
   */
  getUserRole(userId) {
    if (!userId || typeof userId !== 'number') {
      return null;
    }
    const user = this.userRepo.findById(userId);
    return user ? user.role : null;
  }

  /**
   * Check if a given session token possesses Admin authorization.
   * 
   * @param {string} token
   * @returns {boolean}
   */
  isAdmin(token) {
    const user = this.validateSession(token);
    return user !== null && user.role === ROLES.ADMIN;
  }

  /**
   * Check if a given session token possesses Student authorization.
   * 
   * @param {string} token
   * @returns {boolean}
   */
  isStudent(token) {
    const user = this.validateSession(token);
    return user !== null && user.role === ROLES.STUDENT;
  }

  /**
   * Sweep and remove all expired sessions from memory.
   * @returns {number} Count of pruned sessions
   */
  cleanExpiredSessions() {
    const now = Date.now();
    let pruned = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (now >= session.expiresAt) {
        this.sessions.delete(token);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Count currently active in-memory sessions.
   * @returns {number}
   */
  getActiveSessionCount() {
    this.cleanExpiredSessions();
    return this.sessions.size;
  }
}

module.exports = AuthService;

