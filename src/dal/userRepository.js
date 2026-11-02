/**
 * User Data Access Repository
 * [Category A]: User, Admin, Student entity management (OOMD Diagram 2)
 * [Category C]: Salt and password hash storage isolation
 */

class UserRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  /**
   * Create a new user with salt and password hash.
   * @param {Object} userData
   * @param {string} userData.username
   * @param {string} userData.passwordHash
   * @param {string} userData.salt
   * @param {string} userData.role - 'admin' | 'student'
   * @returns {{ id: number, username: string, role: string, createdAt: string }}
   */
  createUser({ username, passwordHash, salt, role }) {
    const { lastInsertRowid } = this.db.run(
      `INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`,
      [username.trim().toLowerCase(), passwordHash, salt, role]
    );

    return this.findById(lastInsertRowid);
  }

  /**
   * Find a user by username (case-insensitive).
   * Note: Contains password_hash and salt for authentication verification.
   * Service layer is responsible for stripping sensitive credentials before API serialization.
   * @param {string} username
   * @returns {Object|null}
   */
  findByUsername(username) {
    if (!username || typeof username !== 'string') return null;
    return this.db.get(
      `SELECT id, username, password_hash, salt, role, created_at FROM users WHERE LOWER(username) = LOWER(?);`,
      [username.trim()]
    );
  }

  /**
   * Find user by primary key ID.
   * @param {number} id
   * @returns {Object|null}
   */
  findById(id) {
    return this.db.get(
      `SELECT id, username, role, created_at FROM users WHERE id = ?;`,
      [id]
    );
  }

  /**
   * Find all registered users.
   * @returns {Array<Object>}
   */
  findAll() {
    return this.db.all(
      `SELECT id, username, role, created_at FROM users ORDER BY id ASC;`
    );
  }

  /**
   * Count total registered users.
   * @returns {number}
   */
  count() {
    const res = this.db.get(`SELECT COUNT(*) AS total FROM users;`);
    return res ? res.total : 0;
  }

  /**
   * Count total registered students.
   * @returns {number}
   */
  countStudents() {
    const res = this.db.get(`SELECT COUNT(*) AS total FROM users WHERE role = 'student';`);
    return res ? res.total : 0;
  }
}

module.exports = UserRepository;

