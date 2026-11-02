/**
 * Admin Analytics REST API Integration Tests (Supertest)
 * [Category A]: Overall statistics, scores report table (STQA §1, Page 8)
 * [Category B]: Pure SQL deterministic aggregations
 * [Category C]: Role-based authorization guard (Admin only, 403 for students)
 */

const request = require('supertest');
const { initDatabase } = require('../../src/database/db');
const { seedDatabase } = require('../../src/database/seed');
const { createApp } = require('../../src/app');

describe('Admin Analytics API (/api/admin/analytics)', () => {
  let db;
  let app;
  let adminToken;
  let studentToken;

  beforeEach(async () => {
    db = await initDatabase({ dbPath: ':memory:' });
    await seedDatabase(db);
    app = createApp({ dbClient: db });

    // Login Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.token;

    // Login Student
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'student1', password: 'student123' });
    studentToken = studentLogin.body.token;
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('GET /api/admin/analytics/overview', () => {
    test('admin retrieves high-level overview metrics (HTTP 200)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.overview).toBeDefined();

      const o = res.body.overview;
      expect(o.totalStudents).toBe(2);
      expect(o.totalQuizzes).toBe(2);
      expect(o.publishedQuizzes).toBe(2);
      expect(o.totalSubmissions).toBe(1);
      expect(o.passCount).toBe(1);
      expect(o.failCount).toBe(0);
      expect(o.passPercentage).toBe(100.0);
      expect(o.averageScore).toBe(3.0);
    });

    test('strictly forbids student from accessing analytics overview (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overview')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    test('rejects unauthenticated requests with HTTP 401', async () => {
      const res = await request(app).get('/api/admin/analytics/overview');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/analytics/quizzes', () => {
    test('admin retrieves quiz-wise aggregated metrics (HTTP 200)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/quizzes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.quizzes)).toBe(true);
      expect(res.body.quizzes).toHaveLength(2);

      const q1 = res.body.quizzes.find(q => q.quizId === 1);
      expect(q1).toBeDefined();
      expect(q1.title).toBe('Database Management Systems');
      expect(q1.totalAttempts).toBe(1);
      expect(q1.passCount).toBe(1);
      expect(q1.passRate).toBe(100.0);
    });

    test('strictly forbids student from accessing quiz-wise analytics (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/quizzes')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/analytics/submissions', () => {
    test('admin retrieves student submissions table matching STQA Report Results Page 8 (HTTP 200)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/submissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.submissions)).toBe(true);
      expect(res.body.submissions.length).toBeGreaterThan(0);

      const sub = res.body.submissions[0];
      expect(sub.student).toBe('student1');
      expect(sub.quiz_title).toBe('Database Management Systems');
      expect(sub.score).toBe(3);
      expect(sub.total_questions).toBe(3);
      expect(sub.percentage).toBe(100.0);
      expect(sub.status).toBe('PASSED');
      expect(sub.submission_time).toBeDefined();
    });

    test('strictly forbids student from accessing submissions audit table (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/submissions')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });
  });
});

