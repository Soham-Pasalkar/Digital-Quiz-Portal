/**
 * Timer & Attempt Lifecycle Integration Tests
 * [Milestone 4.1 Requirement 2]: Exhaustive verification of the 10 lifecycle and timer scenarios
 *                                using controlled server-side clock injection.
 */

const request = require('supertest');
const { initDatabase } = require('../../src/database/db');
const { seedDatabase } = require('../../src/database/seed');
const { createApp } = require('../../src/app');

describe('Timer & Attempt Lifecycle Verification (10 Scenarios)', () => {
  let db;
  let currentServerTime;
  let app;
  let student1Token;
  let student1Id;
  let student2Token;
  let quizId;
  let questionIds = [];

  const clock = () => new Date(currentServerTime);

  beforeEach(async () => {
    db = await initDatabase({ dbPath: ':memory:' });
    await seedDatabase(db);

    currentServerTime = new Date('2026-10-20T10:00:00.000Z').getTime();

    app = createApp({
      dbClient: db,
      clock
    });

    // Authenticate Student 1
    const s1Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'student1', password: 'student123' });
    student1Token = s1Res.body.token;
    student1Id = s1Res.body.user.id;

    // Authenticate Student 2
    const s2Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'student2', password: 'student123' });
    student2Token = s2Res.body.token;

    // Use Quiz 1 (Database Management Systems, 3 questions, 10 mins)
    const availRes = await request(app)
      .get('/api/quizzes/available')
      .set('Authorization', `Bearer ${student1Token}`);
    const targetQuiz = availRes.body.quizzes.find(q => q.title.includes('Database')) || availRes.body.quizzes[0];
    quizId = targetQuiz.id;

    // Retrieve questions for answer reference
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    const quizDetail = await request(app)
      .get(`/api/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`);
    questionIds = quizDetail.body.quiz.questions.map(q => q.id);
  });

  afterEach(() => {
    if (db) db.close();
  });

  // Scenario 1 & 2: Start exam, then refresh with 20 seconds remaining
  test('Scenario 1 & 2: Start exam, refresh with 20s remaining, confirm attempt resumes with original server expiry', async () => {
    // T0 = 10:00:00 (Starts attempt, expires at 10:10:00)
    currentServerTime = new Date('2026-10-20T10:00:00.000Z').getTime();

    const startRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    expect(startRes.status).toBe(201);
    const attemptId = startRes.body.attemptId;
    const originalExpiry = startRes.body.expiresAt;
    expect(originalExpiry).toBe('2026-10-20T10:10:00.000Z');

    // Advance clock to 10:09:40 (20 seconds before expiry)
    currentServerTime = new Date('2026-10-20T10:09:40.000Z').getTime();

    // Student refreshes / resumes attempt
    const resumeRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.isResumed).toBe(true);
    expect(resumeRes.body.attemptId).toBe(attemptId);
    expect(resumeRes.body.expiresAt).toBe(originalExpiry);
    expect(resumeRes.body.remainingSeconds).toBe(20);

    // Fetch questions: expiry must match original server timestamp
    const qRes = await request(app)
      .get(`/api/attempts/${attemptId}/questions`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(qRes.status).toBe(200);
    expect(qRes.body.expiresAt).toBe(originalExpiry);
    expect(qRes.body.remainingSeconds).toBe(20);
  });

  // Scenario 3: Refresh after expiry but within the 30-second grace period
  test('Scenario 3: Refresh after expiry but within the 30-second grace period', async () => {
    currentServerTime = new Date('2026-10-20T10:00:00.000Z').getTime();
    const startRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    const attemptId = startRes.body.attemptId;

    // Advance to 10:10:15 (15 seconds past 10:10:00 expiry, within 30s grace period)
    currentServerTime = new Date('2026-10-20T10:10:15.000Z').getTime();

    const resumeRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.isResumed).toBe(true);
    expect(resumeRes.body.attemptId).toBe(attemptId);
    expect(resumeRes.body.remainingSeconds).toBe(0); // Official time expired
  });

  // Scenario 4: Submission within the grace period follows approved backend rules
  test('Scenario 4: Submission within grace period follows approved backend rules (isTimedOut = true, full score)', async () => {
    currentServerTime = new Date('2026-10-20T10:00:00.000Z').getTime();
    const startRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    const attemptId = startRes.body.attemptId;

    // Advance to 10:10:20 (20 seconds past expiry, within 30s grace)
    currentServerTime = new Date('2026-10-20T10:10:20.000Z').getTime();

    // Submit answers
    const answers = [
      { questionId: questionIds[0], selectedOption: 1 },
      { questionId: questionIds[1], selectedOption: 1 },
      { questionId: questionIds[2], selectedOption: 2 }
    ];

    const submitRes = await request(app)
      .post(`/api/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({ answers });

    expect(submitRes.status).toBe(200);
    const sub = submitRes.body.submission || submitRes.body;
    expect(sub.isTimedOut).toBe(true);
    expect(sub.score).toBe(3);
    expect(sub.percentage).toBe(100);
    expect(sub.status).toBe('PASSED');
  });

  // Scenario 5: Attempt submission after the grace period
  test('Scenario 5: Attempt submission after the grace period is rejected and finalized as FAILED', async () => {
    currentServerTime = new Date('2026-10-20T10:00:00.000Z').getTime();
    const startRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    const attemptId = startRes.body.attemptId;

    // Advance to 10:10:35 (35 seconds past expiry, beyond 30s grace)
    currentServerTime = new Date('2026-10-20T10:10:35.000Z').getTime();

    const submitRes = await request(app)
      .post(`/api/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        answers: [{ questionId: questionIds[0], selectedOption: 2 }]
      });

    expect(submitRes.status).toBe(400);
    expect(submitRes.body.error).toContain('grace period');
    expect(submitRes.body.isTimedOut).toBe(true);
    expect(submitRes.body.status).toBe('FAILED');
  });

  // Scenario 6 & 7: Network failure simulation during auto-submission & retries idempotency
  test('Scenario 6 & 7: Network failure retry during auto-submit does not create duplicate submissions or attempts', async () => {
    currentServerTime = new Date('2026-10-20T10:00:00.000Z').getTime();
    const startRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    const attemptId = startRes.body.attemptId;

    // First submission succeeds on server
    const submitRes1 = await request(app)
      .post(`/api/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        answers: [{ questionId: questionIds[0], selectedOption: 1 }]
      });
    expect(submitRes1.status).toBe(200);

    // Simulate client dropped connection, client retries submitting the exact same attempt
    const submitRes2 = await request(app)
      .post(`/api/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        answers: [{ questionId: questionIds[0], selectedOption: 1 }]
      });
    expect(submitRes2.status).toBe(200);
    const sub2 = submitRes2.body.submission || submitRes2.body;
    expect(sub2.alreadyFinalized).toBe(true);
    expect(sub2.score).toBe(submitRes1.body.score);

    // Verify database row count: exactly one submission record for this attempt (idempotent)
    const subCount = db.get(`SELECT COUNT(*) as count FROM submissions WHERE id = ?;`, [attemptId]);
    expect(subCount.count).toBe(1);

    // Verify answer rows: exactly one answer row per quiz question (no duplicate answers recorded on retry)
    const ansCount = db.get(`SELECT COUNT(*) as count FROM submission_answers WHERE submission_id = ?;`, [attemptId]);
    expect(ansCount.count).toBe(questionIds.length);
  });

  // Scenario 8: Manually submit before expiry
  test('Scenario 8: Manually submit before expiry is accepted with isTimedOut = false', async () => {
    currentServerTime = new Date('2026-10-20T10:00:00.000Z').getTime();
    const startRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    const attemptId = startRes.body.attemptId;

    // Advance to 10:05:00 (5 minutes in, 5 minutes before expiry)
    currentServerTime = new Date('2026-10-20T10:05:00.000Z').getTime();

    const submitRes = await request(app)
      .post(`/api/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        answers: [
          { questionId: questionIds[0], selectedOption: 1 },
          { questionId: questionIds[1], selectedOption: 1 },
          { questionId: questionIds[2], selectedOption: 2 }
        ]
      });

    expect(submitRes.status).toBe(200);
    const sub = submitRes.body.submission || submitRes.body;
    expect(sub.isTimedOut).toBe(false);
    expect(sub.status).toBe('PASSED');
    expect(sub.score).toBe(3);
  });

  // Scenario 9: Confirm an expired attempt cannot be resumed as an active attempt
  test('Scenario 9: Confirm an expired attempt cannot be resumed as an active attempt', async () => {
    currentServerTime = new Date('2026-10-20T10:00:00.000Z').getTime();
    const startRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    const attemptId = startRes.body.attemptId;

    // Advance clock way past grace period (10:20:00 - 10 minutes past expiry)
    currentServerTime = new Date('2026-10-20T10:20:00.000Z').getTime();

    // Attempting to fetch questions for expired attempt fails
    const qRes = await request(app)
      .get(`/api/attempts/${attemptId}/questions`)
      .set('Authorization', `Bearer ${student1Token}`);
    expect(qRes.status).toBe(400);
    expect(qRes.body.error).toContain('expired beyond the 30-second grace period');

    // Attempting to resume or start new attempt automatically finalizes old as FAILED and creates a new one
    const newAttemptRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    expect(newAttemptRes.status).toBe(201);
    expect(newAttemptRes.body.isResumed).toBe(false);
    expect(newAttemptRes.body.attemptId).not.toBe(attemptId);

    // Verify old attempt in DB is status = 'FAILED'
    const oldRow = db.get(`SELECT status, is_timed_out FROM submissions WHERE id = ?;`, [attemptId]);
    expect(oldRow.status).toBe('FAILED');
    expect(oldRow.is_timed_out).toBe(1);
  });

  // Scenario 10: Confirm a student cannot submit another student's attempt
  test("Scenario 10: Confirm a student cannot submit another student's attempt (HTTP 403)", async () => {
    currentServerTime = new Date('2026-10-20T10:00:00.000Z').getTime();

    // Student 1 starts attempt
    const startRes = await request(app)
      .post(`/api/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${student1Token}`)
      .send({});
    const s1AttemptId = startRes.body.attemptId;

    // Student 2 attempts to submit Student 1's attempt
    const crossSubmitRes = await request(app)
      .post(`/api/attempts/${s1AttemptId}/submit`)
      .set('Authorization', `Bearer ${student2Token}`)
      .send({
        answers: [{ questionId: questionIds[0], selectedOption: 2 }]
      });

    expect(crossSubmitRes.status).toBe(403);
    expect(crossSubmitRes.body.error).toContain('Access denied');

    // Student 2 attempts to view Student 1's attempt questions
    const crossViewRes = await request(app)
      .get(`/api/attempts/${s1AttemptId}/questions`)
      .set('Authorization', `Bearer ${student2Token}`);
    expect(crossViewRes.status).toBe(403);
    expect(crossViewRes.body.error).toContain('Access denied');
  });
});
