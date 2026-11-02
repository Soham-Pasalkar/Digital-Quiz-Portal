/**
 * Data Access Layer (DAL) Unit Tests
 * [Category A]: User, Quiz, Question, Submission entity repositories
 * [Category B]: Active attempt lookup, idempotency support, query isolation
 * [Category C]: Active attempt concurrency resolution, cross-quiz question validation, historical record integrity
 */

const { initDatabase } = require('../../src/database/db');
const { ROLES, ATTEMPT_STATUS } = require('../../src/config/constants');
const UserRepository = require('../../src/dal/userRepository');
const QuizRepository = require('../../src/dal/quizRepository');
const SubmissionRepository = require('../../src/dal/submissionRepository');

describe('Data Access Layer (DAL) Repositories', () => {
  let db;
  let userRepo;
  let quizRepo;
  let subRepo;

  beforeEach(async () => {
    // Isolated in-memory database per test run
    db = await initDatabase({ dbPath: ':memory:' });
    userRepo = new UserRepository(db);
    quizRepo = new QuizRepository(db);
    subRepo = new SubmissionRepository(db);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('UserRepository', () => {
    test('creates a user and retrieves by primary key ID and username', () => {
      const created = userRepo.createUser({
        username: 'TestAdmin',
        passwordHash: 'hash123',
        salt: 'salt123',
        role: ROLES.ADMIN
      });

      expect(created).toBeDefined();
      expect(created.id).toBeGreaterThan(0);
      expect(created.username).toBe('testadmin'); // Normalized lowercase
      expect(created.role).toBe('admin');

      // Find by username (case-insensitive)
      const found = userRepo.findByUsername('TESTADMIN');
      expect(found).not.toBeNull();
      expect(found.id).toBe(created.id);
      expect(found.password_hash).toBe('hash123');
      expect(found.salt).toBe('salt123');

      // Find by ID
      const byId = userRepo.findById(created.id);
      expect(byId.username).toBe('testadmin');
    });

    test('enforces UNIQUE constraint on usernames', () => {
      userRepo.createUser({
        username: 'unique_user',
        passwordHash: 'h1',
        salt: 's1',
        role: ROLES.STUDENT
      });

      expect(() => {
        userRepo.createUser({
          username: 'unique_user',
          passwordHash: 'h2',
          salt: 's2',
          role: ROLES.STUDENT
        });
      }).toThrow(/UNIQUE constraint failed/i);
    });

    test('counts total users accurately', () => {
      expect(userRepo.count()).toBe(0);
      userRepo.createUser({ username: 'u1', passwordHash: 'h', salt: 's', role: ROLES.ADMIN });
      userRepo.createUser({ username: 'u2', passwordHash: 'h', salt: 's', role: ROLES.STUDENT });
      expect(userRepo.count()).toBe(2);
    });
  });

  describe('QuizRepository', () => {
    let adminUser;

    beforeEach(() => {
      adminUser = userRepo.createUser({
        username: 'quiz_author',
        passwordHash: 'h',
        salt: 's',
        role: ROLES.ADMIN
      });
    });

    test('creates a quiz and persists questions with 4 options and 0-indexed correct answer', () => {
      const quiz = quizRepo.createQuiz({
        title: 'Operating Systems',
        durationMinutes: 15,
        createdBy: adminUser.id,
        isPublished: 0
      });

      expect(quiz.id).toBeGreaterThan(0);
      expect(quiz.title).toBe('Operating Systems');
      expect(quiz.duration_minutes).toBe(15);
      expect(quiz.is_published).toBe(0);
      expect(quiz.author).toBe('quiz_author');

      const q1 = quizRepo.addQuestion({
        quizId: quiz.id,
        questionText: 'What is a semaphore?',
        optionA: 'Hardware signal',
        optionB: 'Synchronization variable',
        optionC: 'Compiler directive',
        optionD: 'Memory cache',
        correctOption: 1, // Option B
        orderNum: 1
      });

      expect(q1.id).toBeGreaterThan(0);
      expect(q1.correct_option).toBe(1);

      const questions = quizRepo.findQuestionsByQuizId(quiz.id);
      expect(questions).toHaveLength(1);
      expect(questions[0].question_text).toBe('What is a semaphore?');
      expect(questions[0].option_b).toBe('Synchronization variable');
      expect(quizRepo.countQuestions(quiz.id)).toBe(1);
    });

    test('publishes an existing quiz, toggling is_published to 1', () => {
      const quiz = quizRepo.createQuiz({
        title: 'Networking Basics',
        durationMinutes: 10,
        createdBy: adminUser.id,
        isPublished: 0
      });

      expect(quiz.is_published).toBe(0);

      const published = quizRepo.publishQuiz(quiz.id);
      expect(published.is_published).toBe(1);
    });

    test('filters published quizzes from draft quizzes in catalog queries', () => {
      const draft = quizRepo.createQuiz({ title: 'Draft Exam', createdBy: adminUser.id, isPublished: 0 });
      const live = quizRepo.createQuiz({ title: 'Live Exam', createdBy: adminUser.id, isPublished: 1 });

      const all = quizRepo.findAll({ publishedOnly: false });
      const published = quizRepo.findAll({ publishedOnly: true });

      expect(all.length).toBe(2);
      expect(published.length).toBe(1);
      expect(published[0].id).toBe(live.id);
      expect(published[0].title).toBe('Live Exam');
    });
  });

  describe('SubmissionRepository', () => {
    let student;
    let quiz;

    beforeEach(() => {
      const admin = userRepo.createUser({ username: 'admin_sub', passwordHash: 'h', salt: 's', role: ROLES.ADMIN });
      student = userRepo.createUser({ username: 'student_sub', passwordHash: 'h', salt: 's', role: ROLES.STUDENT });
      quiz = quizRepo.createQuiz({ title: 'STQA Assessment', createdBy: admin.id, isPublished: 1 });
    });

    test('creates an in-progress attempt with server timestamps and finds active attempt', () => {
      const startedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const attempt = subRepo.createAttempt({
        quizId: quiz.id,
        userId: student.id,
        startedAt,
        expiresAt
      });

      expect(attempt.id).toBeGreaterThan(0);
      expect(attempt.status).toBe(ATTEMPT_STATUS.IN_PROGRESS);
      expect(attempt.started_at).toBe(startedAt);
      expect(attempt.expires_at).toBe(expiresAt);

      // Verify active attempt lookup for duplicate prevention
      const active = subRepo.findActiveAttempt(quiz.id, student.id);
      expect(active).not.toBeNull();
      expect(active.id).toBe(attempt.id);
    });

    test('handles duplicate and concurrent attempt creation gracefully by returning existing active attempt', () => {
      const startedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // First attempt creation
      const attempt1 = subRepo.createAttempt({
        quizId: quiz.id,
        userId: student.id,
        startedAt,
        expiresAt
      });

      // Second attempt creation for the same student and quiz (duplicate/concurrent)
      const attempt2 = subRepo.createAttempt({
        quizId: quiz.id,
        userId: student.id,
        startedAt,
        expiresAt
      });

      // Must return the exact same active attempt without throwing an error
      expect(attempt2).toBeDefined();
      expect(attempt2.id).toBe(attempt1.id);
      expect(attempt2.status).toBe(ATTEMPT_STATUS.IN_PROGRESS);
    });

    test('finalizes an examination attempt and records answers audit trail', () => {
      const startedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const attempt = subRepo.createAttempt({
        quizId: quiz.id,
        userId: student.id,
        startedAt,
        expiresAt
      });

      const q = quizRepo.addQuestion({
        quizId: quiz.id,
        questionText: 'Test question',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
        correctOption: 2
      });

      // Record answer
      subRepo.recordAnswer({
        submissionId: attempt.id,
        questionId: q.id,
        selectedOption: 2,
        isCorrect: 1
      });

      // Finalize submission
      const finalized = subRepo.finalizeSubmission(attempt.id, {
        totalQuestions: 1,
        score: 1,
        percentage: 100.0,
        status: ATTEMPT_STATUS.PASSED,
        isTimedOut: 0,
        submittedAt: new Date().toISOString()
      });

      expect(finalized.status).toBe('PASSED');
      expect(finalized.score).toBe(1);
      expect(finalized.percentage).toBe(100.0);
      expect(finalized.is_timed_out).toBe(0);

      // Verify that after finalization, there is NO longer an active attempt in-progress
      const active = subRepo.findActiveAttempt(quiz.id, student.id);
      expect(active).toBeNull();

      // Retrieve answers breakdown
      const answers = subRepo.findAnswersBySubmissionId(attempt.id);
      expect(answers).toHaveLength(1);
      expect(answers[0].is_correct).toBe(1);
      expect(answers[0].selected_option).toBe(2);
      expect(answers[0].question_text).toBe('Test question');
    });

    test('strictly validates selectedOption range (-1, 0, 1, 2, 3) in recordAnswer', () => {
      const attempt = subRepo.createAttempt({
        quizId: quiz.id,
        userId: student.id,
        startedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString()
      });

      const q = quizRepo.addQuestion({
        quizId: quiz.id,
        questionText: 'Validation question',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
        correctOption: 0
      });

      // Invalid option 4
      expect(() => {
        subRepo.recordAnswer({
          submissionId: attempt.id,
          questionId: q.id,
          selectedOption: 4,
          isCorrect: 0
        });
      }).toThrow(/Invalid selectedOption: 4/i);

      // Invalid option -2
      expect(() => {
        subRepo.recordAnswer({
          submissionId: attempt.id,
          questionId: q.id,
          selectedOption: -2,
          isCorrect: 0
        });
      }).toThrow(/Invalid selectedOption: -2/i);

      // Valid option -1 (unattempted)
      expect(() => {
        subRepo.recordAnswer({
          submissionId: attempt.id,
          questionId: q.id,
          selectedOption: -1,
          isCorrect: 0
        });
      }).not.toThrow();
    });

    test('strictly prevents duplicate answer recording for the same question in a submission', () => {
      const attempt = subRepo.createAttempt({
        quizId: quiz.id,
        userId: student.id,
        startedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString()
      });

      const q = quizRepo.addQuestion({
        quizId: quiz.id,
        questionText: 'Single answer question',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
        correctOption: 0
      });

      subRepo.recordAnswer({
        submissionId: attempt.id,
        questionId: q.id,
        selectedOption: 0,
        isCorrect: 1
      });

      // Second attempt to record answer for same question must throw UNIQUE constraint failure
      expect(() => {
        subRepo.recordAnswer({
          submissionId: attempt.id,
          questionId: q.id,
          selectedOption: 1,
          isCorrect: 0
        });
      }).toThrow(/UNIQUE constraint failed/i);
    });

    test('strictly rejects cross-quiz question references in recordAnswer', () => {
      // Quiz 1 (quiz) belongs to admin_sub
      const q1 = quizRepo.addQuestion({
        quizId: quiz.id,
        questionText: 'Quiz 1 Question',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
        correctOption: 0
      });

      // Quiz 2
      const quiz2 = quizRepo.createQuiz({ title: 'Second Quiz', createdBy: quiz.created_by, isPublished: 1 });
      const q2 = quizRepo.addQuestion({
        quizId: quiz2.id,
        questionText: 'Quiz 2 Question',
        optionA: 'A',
        optionB: 'B',
        optionC: 'C',
        optionD: 'D',
        correctOption: 1
      });

      // Attempt for Quiz 1
      const attempt1 = subRepo.createAttempt({
        quizId: quiz.id,
        userId: student.id,
        startedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString()
      });

      // Attempting to record an answer in attempt1 (Quiz 1) for q2 (Quiz 2) must be rejected
      expect(() => {
        subRepo.recordAnswer({
          submissionId: attempt1.id,
          questionId: q2.id,
          selectedOption: 1,
          isCorrect: 1
        });
      }).toThrow(/Cross-quiz question reference/i);
    });

    test('retrieves all submissions with joined student username and quiz title for admin reporting', () => {
      const attempt = subRepo.createAttempt({
        quizId: quiz.id,
        userId: student.id,
        startedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString()
      });

      subRepo.finalizeSubmission(attempt.id, {
        totalQuestions: 5,
        score: 4,
        percentage: 80.0,
        status: ATTEMPT_STATUS.PASSED,
        isTimedOut: 0,
        submittedAt: '2026-10-16T10:00:00.000Z'
      });

      const list = subRepo.findAllWithDetails();
      expect(list).toHaveLength(1);
      expect(list[0].student).toBe('student_sub');
      expect(list[0].quiz_title).toBe('STQA Assessment');
      expect(list[0].score).toBe(4);
      expect(list[0].percentage).toBe(80.0);
      expect(list[0].status).toBe('PASSED');
    });
  });
});
