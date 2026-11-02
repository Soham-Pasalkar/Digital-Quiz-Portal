/**
 * Quiz & Question REST API Integration Tests (Supertest)
 * [Category A]: Quiz CRUD, questions authoring, publishing, TC-06 empty quiz rejection
 * [Category B]: Route ordering (/available before /:id), option normalization
 * [Category C]: Role-based authorization, answer key isolation, quiz immutability
 */

const request = require('supertest');
const { initDatabase } = require('../../src/database/db');
const { seedDatabase } = require('../../src/database/seed');
const { createApp } = require('../../src/app');

describe('Quiz & Question API (/api/quizzes & /api/questions)', () => {
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

  describe('Route Ordering: GET /api/quizzes/available', () => {
    test('student successfully retrieves published quizzes catalog without route collision with /:id', async () => {
      const res = await request(app)
        .get('/api/quizzes/available')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.quizzes)).toBe(true);
      expect(res.body.quizzes.length).toBeGreaterThan(0);

      const first = res.body.quizzes[0];
      expect(first.title).toBeDefined();
      expect(first.durationMinutes).toBeDefined();
      expect(first.questionCount).toBeDefined();

      // Ensure student cannot access internal answer keys
      expect(first.questions).toBeUndefined();
    });

    test('rejects unauthenticated requests to /api/quizzes/available with HTTP 401', async () => {
      const res = await request(app).get('/api/quizzes/available');
      expect(res.status).toBe(401);
    });
  });

  describe('Admin Quiz Creation & Validation', () => {
    test('admin creates a draft quiz successfully (HTTP 201)', async () => {
      const res = await request(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Computer Networks',
          durationMinutes: 15
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.quiz).toBeDefined();
      expect(res.body.quiz.title).toBe('Computer Networks');
      expect(res.body.quiz.duration_minutes).toBe(15);
      expect(res.body.quiz.is_published).toBe(0); // Created as draft
    });

    test('rejects student from creating quizzes with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Student Attempted Quiz' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    test('rejects invalid inputs on quiz creation with HTTP 400 Bad Request', async () => {
      const res1 = await request(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '' });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Valid', durationMinutes: -10 });
      expect(res2.status).toBe(400);
    });
  });

  describe('Question Authoring & Publishing Lifecycle', () => {
    let newQuizId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Compiler Design', durationMinutes: 10 });
      newQuizId = res.body.quiz.id;
    });

    test('TC-06: Strictly rejects publishing an empty quiz without questions (HTTP 400)', async () => {
      const res = await request(app)
        .post(`/api/quizzes/${newQuizId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot publish an empty quiz without questions/i);
    });

    test('admin adds questions with 4 options and letter correctOption (HTTP 201)', async () => {
      const res = await request(app)
        .post(`/api/quizzes/${newQuizId}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          questionText: 'What is Lexical Analysis?',
          options: ['Scanning tokens', 'Code optimization', 'Parsing syntax', 'Code generation'],
          correctOption: 'A'
        });

      expect(res.status).toBe(201);
      expect(res.body.question).toBeDefined();
      expect(res.body.question.correct_option).toBe(0); // Normalized to 0
    });

    test('rejects question with invalid option count or empty text (HTTP 400)', async () => {
      const res = await request(app)
        .post(`/api/quizzes/${newQuizId}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          questionText: 'Test Question',
          options: ['Only 2', 'Options'],
          correctOption: 0
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Exactly four answer options/i);
    });

    test('publishes quiz successfully once question is added, and supports unpublishing', async () => {
      // Add a question
      await request(app)
        .post(`/api/quizzes/${newQuizId}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          questionText: 'Valid Q',
          options: ['A', 'B', 'C', 'D'],
          correctOption: 2
        });

      // Publish
      const publishRes = await request(app)
        .post(`/api/quizzes/${newQuizId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(publishRes.status).toBe(200);
      expect(publishRes.body.quiz.is_published).toBe(1);

      // Unpublish
      const unpublishRes = await request(app)
        .post(`/api/quizzes/${newQuizId}/unpublish`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(unpublishRes.status).toBe(200);
      expect(unpublishRes.body.quiz.is_published).toBe(0);
    });
  });

  describe('Quiz Immutability Once Attempts Exist [Prerequisite 1]', () => {
    let quizId;
    let questionId;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/quizzes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Immutable Live Exam', durationMinutes: 10 });
      quizId = createRes.body.quiz.id;

      const qRes = await request(app)
        .post(`/api/quizzes/${quizId}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          questionText: 'Fixed Question',
          options: ['A', 'B', 'C', 'D'],
          correctOption: 0
        });
      questionId = qRes.body.question.id;

      // Publish quiz
      await request(app)
        .post(`/api/quizzes/${quizId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Student creates an attempt on this quiz
      await request(app)
        .post(`/api/quizzes/${quizId}/attempts`)
        .set('Authorization', `Bearer ${studentToken}`);
    });

    test('prevents adding new questions once attempts exist (HTTP 400)', async () => {
      const res = await request(app)
        .post(`/api/quizzes/${quizId}/questions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          questionText: 'Illegal Added Question',
          options: ['1', '2', '3', '4'],
          correctOption: 0
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot add questions: Quiz has existing examination attempts/i);
    });

    test('prevents updating questions once attempts exist (HTTP 400)', async () => {
      const res = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ questionText: 'Mutated Question Text' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot modify questions: Quiz has existing examination attempts/i);
    });

    test('prevents deleting questions once attempts exist (HTTP 400)', async () => {
      const res = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot delete questions: Quiz has existing examination attempts/i);
    });

    test('prevents changing duration/scoring configuration once attempts exist (HTTP 400)', async () => {
      const res = await request(app)
        .put(`/api/quizzes/${quizId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ durationMinutes: 20 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot modify scoring configuration or duration/i);
    });

    test('prevents deleting quiz once attempts exist (HTTP 400)', async () => {
      const res = await request(app)
        .delete(`/api/quizzes/${quizId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot delete quiz: Quiz has existing examination attempts/i);
    });
  });
});

