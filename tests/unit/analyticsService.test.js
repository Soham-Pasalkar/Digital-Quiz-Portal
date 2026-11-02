/**
 * AnalyticsService Unit Tests
 * [Category A]: Administrative performance review and scores table (STQA §1, Page 8)
 * [Category B]: Deterministic SQL aggregation; empty dataset safety
 * [Category C]: Role restriction ensuring only Admins can query analytics
 */

const { initDatabase } = require('../../src/database/db');
const UserRepository = require('../../src/dal/userRepository');
const QuizRepository = require('../../src/dal/quizRepository');
const SubmissionRepository = require('../../src/dal/submissionRepository');
const AnalyticsService = require('../../src/services/analyticsService');
const { ROLES, ATTEMPT_STATUS } = require('../../src/config/constants');

describe('AnalyticsService', () => {
  let db;
  let userRepo;
  let quizRepo;
  let subRepo;
  let analyticsService;
  let adminUser;
  let student1;
  let student2;

  beforeEach(async () => {
    db = await initDatabase({ dbPath: ':memory:' });
    userRepo = new UserRepository(db);
    quizRepo = new QuizRepository(db);
    subRepo = new SubmissionRepository(db);
    analyticsService = new AnalyticsService({
      submissionRepo: subRepo,
      quizRepo,
      userRepo
    });

    adminUser = userRepo.createUser({ username: 'admin_ana', passwordHash: 'h', salt: 's', role: ROLES.ADMIN });
    student1 = userRepo.createUser({ username: 'student_1', passwordHash: 'h', salt: 's', role: ROLES.STUDENT });
    student2 = userRepo.createUser({ username: 'student_2', passwordHash: 'h', salt: 's', role: ROLES.STUDENT });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Empty Database Scenario', () => {
    test('handles empty dataset gracefully without NaN or divide-by-zero errors', () => {
      const overview = analyticsService.getOverview(adminUser.id);

      expect(overview).toBeDefined();
      expect(overview.totalStudents).toBe(2);
      expect(overview.totalQuizzes).toBe(0);
      expect(overview.publishedQuizzes).toBe(0);
      expect(overview.totalSubmissions).toBe(0);
      expect(overview.passCount).toBe(0);
      expect(overview.failCount).toBe(0);
      expect(overview.passPercentage).toBe(0.0);
      expect(overview.averageScore).toBe(0.0);
      expect(overview.averagePercentage).toBe(0.0);

      const quizWise = analyticsService.getQuizWisePerformance(adminUser.id);
      expect(quizWise).toEqual([]);

      const table = analyticsService.getStudentSubmissionsTable(adminUser.id);
      expect(table).toEqual([]);
    });
  });

  describe('Aggregated Metrics with Populated Submissions', () => {
    let quiz1;
    let quiz2;

    beforeEach(() => {
      // Quiz 1 (Published)
      quiz1 = quizRepo.createQuiz({
        title: 'Database Management Systems',
        durationMinutes: 10,
        createdBy: adminUser.id,
        isPublished: 1
      });
      quizRepo.addQuestion({
        quizId: quiz1.id,
        questionText: 'Q1',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
        correctOption: 0
      });

      // Quiz 2 (Draft)
      quiz2 = quizRepo.createQuiz({
        title: 'Draft Exam',
        durationMinutes: 10,
        createdBy: adminUser.id,
        isPublished: 0
      });

      // Submissions on Quiz 1
      // Student 1: PASSED (Score 5/5, 100%)
      const a1 = subRepo.createAttempt({
        quizId: quiz1.id,
        userId: student1.id,
        startedAt: '2026-10-16T10:00:00.000Z',
        expiresAt: '2026-10-16T10:10:00.000Z'
      });
      subRepo.finalizeSubmission(a1.id, {
        totalQuestions: 5,
        score: 5,
        percentage: 100.0,
        status: ATTEMPT_STATUS.PASSED,
        isTimedOut: 0,
        submittedAt: '2026-10-16T10:05:00.000Z'
      });

      // Student 2: FAILED (Score 1/5, 20%)
      const a2 = subRepo.createAttempt({
        quizId: quiz1.id,
        userId: student2.id,
        startedAt: '2026-10-16T10:00:00.000Z',
        expiresAt: '2026-10-16T10:10:00.000Z'
      });
      subRepo.finalizeSubmission(a2.id, {
        totalQuestions: 5,
        score: 1,
        percentage: 20.0,
        status: ATTEMPT_STATUS.FAILED,
        isTimedOut: 1,
        submittedAt: '2026-10-16T10:10:15.000Z'
      });
    });

    test('computes correct overview metrics across all quizzes and submissions', () => {
      const overview = analyticsService.getOverview(adminUser.id);

      expect(overview.totalStudents).toBe(2);
      expect(overview.totalQuizzes).toBe(2);
      expect(overview.publishedQuizzes).toBe(1);
      expect(overview.totalSubmissions).toBe(2);
      expect(overview.passCount).toBe(1);
      expect(overview.failCount).toBe(1);
      expect(overview.passPercentage).toBe(50.0); // 1 passed out of 2 = 50.0%
      expect(overview.averageScore).toBe(3.0); // (5 + 1) / 2 = 3.0
      expect(overview.averagePercentage).toBe(60.0); // (100 + 20) / 2 = 60.0%
    });

    test('computes quiz-wise performance summary accurately', () => {
      const quizWise = analyticsService.getQuizWisePerformance(adminUser.id);

      expect(quizWise).toHaveLength(2);

      const q1Stats = quizWise.find(q => q.quizId === quiz1.id);
      expect(q1Stats).toBeDefined();
      expect(q1Stats.title).toBe('Database Management Systems');
      expect(q1Stats.isPublished).toBe(true);
      expect(q1Stats.totalAttempts).toBe(2);
      expect(q1Stats.avgScore).toBe(3.0);
      expect(q1Stats.avgPercentage).toBe(60.0);
      expect(q1Stats.passCount).toBe(1);
      expect(q1Stats.failCount).toBe(1);
      expect(q1Stats.passRate).toBe(50.0);

      const q2Stats = quizWise.find(q => q.quizId === quiz2.id);
      expect(q2Stats).toBeDefined();
      expect(q2Stats.isPublished).toBe(false);
      expect(q2Stats.totalAttempts).toBe(0);
      expect(q2Stats.avgScore).toBe(0.0);
      expect(q2Stats.passRate).toBe(0.0);
    });

    test('retrieves student submissions table matching STQA Report Results Page 8', () => {
      const table = analyticsService.getStudentSubmissionsTable(adminUser.id);

      expect(table).toHaveLength(2);

      // Verify row structure and attributes
      const row1 = table[0];
      expect(row1.student).toBeDefined();
      expect(row1.quiz_title).toBe('Database Management Systems');
      expect(row1.score).toBeDefined();
      expect(row1.percentage).toBeDefined();
      expect(row1.status).toBeDefined();
      expect(row1.submission_time).toBeDefined();
    });

    test('strictly restricts analytics access to Administrator accounts', () => {
      expect(() => {
        analyticsService.getOverview(student1.id);
      }).toThrow(/Access denied: Analytics reporting requires Administrator privileges/i);

      expect(() => {
        analyticsService.getQuizWisePerformance(student1.id);
      }).toThrow(/Access denied: Analytics reporting requires Administrator privileges/i);

      expect(() => {
        analyticsService.getStudentSubmissionsTable(student1.id);
      }).toThrow(/Access denied: Analytics reporting requires Administrator privileges/i);
    });
  });
});

