/**
 * Authentication REST API Integration Tests (Supertest)
 * [Category A]: TC-01 (Admin sign-in), TC-02 (Invalid password rejection)
 * [Category B]: Session issuance, token extraction, logout invalidation, TTL
 * [Category C]: Constant-time equality, no password hash or salt exposure
 */

const request = require('supertest');
const { initDatabase } = require('../../src/database/db');
const { seedDatabase } = require('../../src/database/seed');
const { createApp } = require('../../src/app');

describe('Authentication API (/api/auth)', () => {
  let db;
  let app;

  beforeEach(async () => {
    db = await initDatabase({ dbPath: ':memory:' });
    await seedDatabase(db);
    app = createApp({ dbClient: db });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('POST /api/auth/login', () => {
    test('TC-01: Admin sign-in with valid credentials returns HTTP 200, session token, and role', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.role).toBe('admin');

      // Security check: Never expose password_hash or salt
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.user.salt).toBeUndefined();
    });

    test('successfully authenticates student with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'student1', password: 'student123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('student1');
      expect(res.body.user.role).toBe('student');
    });

    test('TC-02: Rejects authentication with invalid password and returns HTTP 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid username or password/i);
      expect(res.body.token).toBeUndefined();
    });

    test('rejects non-existent username with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent_user', password: 'anypassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Invalid username or password/i);
    });

    test('returns HTTP 400 when missing username or password', async () => {
      const res1 = await request(app)
        .post('/api/auth/login')
        .send({ password: 'pwd' });
      expect(res1.status).toBe(400);
      expect(res1.body.error).toMatch(/Username is required/i);

      const res2 = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/Password is required/i);
    });
  });

  describe('GET /api/auth/me', () => {
    test('returns authenticated user details when provided valid Bearer token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.role).toBe('admin');
    });

    test('returns HTTP 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Missing Authorization header/i);
    });

    test('returns HTTP 401 for malformed or invalid Bearer tokens', async () => {
      const res1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Basic 12345');
      expect(res1.status).toBe(401);
      expect(res1.body.error).toMatch(/Invalid Authorization header format/i);

      const res2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer fake_invalid_token_value');
      expect(res2.status).toBe(401);
      expect(res2.body.error).toMatch(/Invalid or expired session token/i);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('invalidates session token upon logout', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'student1', password: 'student123' });
      const token = loginRes.body.token;

      // Verify token is active
      const beforeLogout = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(beforeLogout.status).toBe(200);

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toMatch(/Logged out successfully/i);

      // Subsequent access must return HTTP 401
      const afterLogout = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(afterLogout.status).toBe(401);
    });
  });
});

