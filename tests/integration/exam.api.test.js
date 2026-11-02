/**
 * Examination Lifecycle REST API Integration Tests (Supertest)
 * [Category A]: Student exam initialization, grading, feedback, answer key reveal (STQA §1, §3)
 * [Category B]: Active attempt resumption, grace period flag, idempotency guarantee
 * [Category C]: Server clock integrity (Prerequisite 2), attempt ownership, answer key protection
 */

const request = require('supertest');
const { initDatabase } = require('../../src/database/db');
const { seedDatabase } = require('../../src/database/seed');
const { createApp } = require('../../src/app');

describe('Examination Attempt API (/api/attempts & /api/quizzes/:id/attempts)', () => {
  let db;
  let app;
  let student1Token;
  let student2Token;
  let adminToken;
  let publishedQuizId;
  let mockCurrentTime;

  beforeEach(async () => {
    mockCurrentTime = new Date('2026-10-16T10:00:00.000Z');

    db = await initDatabase({ dbPath: ':memory:' });
    await seedDatabase(db);

    // Inject mockable clock for deterministic timer testing
    app = createApp({
      dbClient: db,
      clock: () => mockCurrentTime
    });

    // Login Student 1
    const s1Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'student1', password: 'student123' });
    student1Token = s1Res.body.token;

    // Login Student 2
    const s2Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'student2', password: 'student123' });
    student2Token = s2Res.body.token;

    // Login Admin
    const aRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = aRes.body.token;

    // Quiz 1 from seed data is 'Database Management Systems' (ID = 1)
    publishedQuizId = 1;
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Attempt Initialization & Questions Retrieval', () => {
    test('student creates a fresh exam attempt with server timestamps (HTTP 201)', async () => {
      const res = await request(app)
        .post(`/api/quizzes/${publishedQuizId}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.attemptId).toBeGreaterThan(0);
      expect(res.body.startedAt).toBe('2026-10-16T10:00:00.000Z');
      expect(res.body.expiresAt).toBe('2026-10-16T10:10:00.000Z'); // 10m default
      expect(res.body.isResumed).toBe(false);
    });

    test('resumes existing active attempt when requested again before expiry (HTTP 200, isResumed: true)', async () => {
      const firstRes = await request(app)
        .post(`/api/quizzes/${publishedQuizId}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);

      // Advance clock 2 minutes
      mockCurrentTime = new Date('2026-10-16T10:02:00.000Z');

      const secondRes = await request(app)
        .post(`/api/quizzes/${publishedQuizId}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.attemptId).toBe(firstRes.body.attemptId);
      expect(secondRes.body.isResumed).toBe(true);
      expect(secondRes.body.remainingSeconds).toBe(480); // 8 minutes remaining
    });

    test('retrieves attempt questions and strictly conceals correct answer keys', async () => {
      const attemptRes = await request(app)
        .post(`/api/quizzes/${publishedQuizId}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);
      const attemptId = attemptRes.body.attemptId;

      const questionsRes = await request(app)
        .get(`/api/attempts/${attemptId}/questions`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(questionsRes.status).toBe(200);
      expect(questionsRes.body.success).toBe(true);
      expect(questionsRes.body.questions.length).toBeGreaterThan(0);

      // Verify answer key confidentiality: correct_option must NEVER be leaked
      questionsRes.body.questions.forEach(q => {
        expect(q.questionText).toBeDefined();
        expect(q.options).toHaveLength(4);
        expect(q.correct_option).toBeUndefined();
        expect(q.correctOption).toBeUndefined();
      });
    });

    test('strictly enforces attempt ownership: Student 2 cannot access Student 1 questions (HTTP 403)', async () => {
      const attemptRes = await request(app)
        .post(`/api/quizzes/${publishedQuizId}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);
      const attemptId = attemptRes.body.attemptId;

      const forbiddenRes = await request(app)
        .get(`/api/attempts/${attemptId}/questions`)
        .set('Authorization', `Bearer ${student2Token}`);

      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.error).toMatch(/Access denied/i);
    });
  });

  describe('Submission, Grading & Timer Integrity', () => {
    let attemptId;

    beforeEach(async () => {
      const attemptRes = await request(app)
        .post(`/api/quizzes/${publishedQuizId}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);
      attemptId = attemptRes.body.attemptId;
    });

    test('on-time submission grades answers accurately and returns question breakdown (HTTP 200, isTimedOut: false)', async () => {
      // 5 minutes in (on-time)
      mockCurrentTime = new Date('2026-10-16T10:05:00.000Z');

      // Submit answers for DBMS quiz questions: Q1: 1 (B), Q2: 1 (B), Q3: 2 (C)
      const submitRes = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          answers: {
            1: 'B', // Correct
            2: 'B', // Correct
            3: 'C'  // Correct
          }
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.score).toBe(3);
      expect(submitRes.body.percentage).toBe(100.0);
      expect(submitRes.body.status).toBe('PASSED');
      expect(submitRes.body.isTimedOut).toBe(false);
      expect(submitRes.body.alreadyFinalized).toBe(false);

      // Answer key feedback breakdown revealed post-submission
      expect(submitRes.body.breakdown).toHaveLength(3);
      expect(submitRes.body.breakdown[0].correctOptionLetter).toBe('B');
      expect(submitRes.body.breakdown[0].isCorrect).toBe(true);
    });

    test('grace period submission (within 30 seconds after expiry) is accepted with isTimedOut: true and full score', async () => {
      // Expiry is 10:10:00.000Z. Clock at 10:10:20.000Z (20s past expiry, within 30s grace)
      mockCurrentTime = new Date('2026-10-16T10:10:20.000Z');

      const submitRes = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          answers: { 1: 1, 2: 1, 3: 2 }
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.score).toBe(3);
      expect(submitRes.body.percentage).toBe(100.0);
      expect(submitRes.body.status).toBe('PASSED');
      expect(submitRes.body.isTimedOut).toBe(true); // Flagged as timed out
    });

    test('post-grace submission (past 30 seconds) is rejected with HTTP 400 and finalized as FAILED', async () => {
      // Expiry is 10:10:00.000Z. Clock at 10:10:45.000Z (45s past expiry, beyond 30s grace)
      mockCurrentTime = new Date('2026-10-16T10:10:45.000Z');

      const submitRes = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({
          answers: { 1: 'B', 2: 'B', 3: 'C' }
        });

      expect(submitRes.status).toBe(400);
      expect(submitRes.body.error).toMatch(/expired beyond the 30-second grace period/i);
      expect(submitRes.body.isTimedOut).toBe(true);
      expect(submitRes.body.status).toBe('FAILED');
      expect(submitRes.body.score).toBe(0);
    });

    test('guarantees idempotency on duplicate submit requests with zero duplicate records', async () => {
      mockCurrentTime = new Date('2026-10-16T10:05:00.000Z');

      const firstSubmit = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ answers: { 1: 'B', 2: 'A', 3: 'A' } });

      expect(firstSubmit.status).toBe(200);
      expect(firstSubmit.body.alreadyFinalized).toBe(false);

      // Second duplicate submit request
      const secondSubmit = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ answers: { 1: 'B', 2: 'A', 3: 'A' } });

      expect(secondSubmit.status).toBe(200);
      expect(secondSubmit.body.alreadyFinalized).toBe(true);
      expect(secondSubmit.body.score).toBe(firstSubmit.body.score);
      expect(secondSubmit.body.percentage).toBe(firstSubmit.body.percentage);
    });

    test('strictly enforces attempt ownership on submit: Student 2 cannot submit Student 1 attempt (HTTP 403)', async () => {
      const forbiddenSubmit = await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${student2Token}`)
        .send({ answers: {} });

      expect(forbiddenSubmit.status).toBe(403);
      expect(forbiddenSubmit.body.error).toMatch(/Access denied/i);
    });
  });

  describe('Retrieving Submission Results (GET /api/attempts/:attemptId/results)', () => {
    test('student retrieves past submission results and feedback breakdown', async () => {
      // 1. Start attempt
      const attemptRes = await request(app)
        .post(`/api/quizzes/${publishedQuizId}/attempts`)
        .set('Authorization', `Bearer ${student1Token}`);
      const attemptId = attemptRes.body.attemptId;

      // 2. Submit
      mockCurrentTime = new Date('2026-10-16T10:04:00.000Z');
      await request(app)
        .post(`/api/attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${student1Token}`)
        .send({ answers: { 1: 1 } });

      // 3. Get results
      const resultsRes = await request(app)
        .get(`/api/attempts/${attemptId}/results`)
        .set('Authorization', `Bearer ${student1Token}`);

      expect(resultsRes.status).toBe(200);
      expect(resultsRes.body.success).toBe(true);
      expect(resultsRes.body.submission).toBeDefined();
      expect(resultsRes.body.submission.breakdown.length).toBeGreaterThan(0);
    });
  });
});

