/**
 * ExamService Unit Tests
 * [Category A]: Student exam lifecycle, question feedback, answer key reveal (STQA §1, §3)
 * [Category B]: Server-generated timestamps, 30s grace period, timeout flag, idempotency
 * [Category C]: Ownership verification, answer key projection, server receipt time enforcement
 */

const { initDatabase } = require('../../src/database/db');
const UserRepository = require('../../src/dal/userRepository');
const QuizRepository = require('../../src/dal/quizRepository');
const SubmissionRepository = require('../../src/dal/submissionRepository');
const ScoringService = require('../../src/services/scoringService');
const ExamService = require('../../src/services/examService');
const { ROLES, ATTEMPT_STATUS } = require('../../src/config/constants');

describe('ExamService', () => {
  let db;
  let userRepo;
  let quizRepo;
  let subRepo;
  let scoringService;
  let examService;
  let studentUser;
  let student2User;
  let adminUser;
  let publishedQuiz;
  let draftQuiz;
  let q1;
  let q2;

  beforeEach(async () => {
    db = await initDatabase({ dbPath: ':memory:' });
    userRepo = new UserRepository(db);
    quizRepo = new QuizRepository(db);
    subRepo = new SubmissionRepository(db);
    scoringService = new ScoringService();
    examService = new ExamService({
      submissionRepo: subRepo,
      quizRepo,
      userRepo,
      scoringService,
      dbClient: db
    });

    adminUser = userRepo.createUser({ username: 'admin_exam', passwordHash: 'h', salt: 's', role: ROLES.ADMIN });
    studentUser = userRepo.createUser({ username: 'student_exam', passwordHash: 'h', salt: 's', role: ROLES.STUDENT });
    student2User = userRepo.createUser({ username: 'student2_exam', passwordHash: 'h', salt: 's', role: ROLES.STUDENT });

    // Published Quiz with 2 questions
    publishedQuiz = quizRepo.createQuiz({
      title: 'Operating Systems Midterm',
      durationMinutes: 10,
      createdBy: adminUser.id,
      isPublished: 1
    });

    q1 = quizRepo.addQuestion({
      quizId: publishedQuiz.id,
      questionText: 'What is a deadlock?',
      optionA: 'Circular wait',
      optionB: 'Fast bus',
      optionC: 'RAM cache',
      optionD: 'Compiler flag',
      correctOption: 0, // Option A
      orderNum: 1
    });

    q2 = quizRepo.addQuestion({
      quizId: publishedQuiz.id,
      questionText: 'What is virtual memory?',
      optionA: 'Physical ROM',
      optionB: 'Abstraction of main memory',
      optionC: 'Network protocol',
      optionD: 'Screen buffer',
      correctOption: 1, // Option B
      orderNum: 2
    });

    // Draft Quiz
    draftQuiz = quizRepo.createQuiz({
      title: 'Draft Unreleased Exam',
      durationMinutes: 10,
      createdBy: adminUser.id,
      isPublished: 0
    });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Attempt Creation & Resumption (startOrResumeAttempt)', () => {
    test('creates a fresh attempt with server-side timestamps and remaining time', () => {
      const now = new Date('2026-10-16T10:00:00.000Z');
      const attempt = examService.startOrResumeAttempt({
        quizId: publishedQuiz.id,
        userId: studentUser.id,
        now
      });

      expect(attempt).toBeDefined();
      expect(attempt.attemptId).toBeGreaterThan(0);
      expect(attempt.quizId).toBe(publishedQuiz.id);
      expect(attempt.durationMinutes).toBe(10);
      expect(attempt.startedAt).toBe('2026-10-16T10:00:00.000Z');
      expect(attempt.expiresAt).toBe('2026-10-16T10:10:00.000Z'); // 10 minutes later
      expect(attempt.remainingSeconds).toBe(600);
      expect(attempt.isResumed).toBe(false);
    });

    test('resumes existing active attempt when called again before expiry', () => {
      const startTime = new Date('2026-10-16T10:00:00.000Z');
      const first = examService.startOrResumeAttempt({
        quizId: publishedQuiz.id,
        userId: studentUser.id,
        now: startTime
      });

      // Resume 2 minutes later
      const resumeTime = new Date('2026-10-16T10:02:00.000Z');
      const second = examService.startOrResumeAttempt({
        quizId: publishedQuiz.id,
        userId: studentUser.id,
        now: resumeTime
      });

      expect(second.attemptId).toBe(first.attemptId);
      expect(second.isResumed).toBe(true);
      expect(second.remainingSeconds).toBe(480); // 8 minutes remaining
    });

    test('preserves validity of existing active attempt even if quiz is unpublished by admin [Prerequisite 1]', () => {
      const startTime = new Date('2026-10-16T10:00:00.000Z');
      const attempt = examService.startOrResumeAttempt({
        quizId: publishedQuiz.id,
        userId: studentUser.id,
        now: startTime
      });

      // Admin unpublishes the quiz while student exam is in-progress
      quizRepo.unpublishQuiz(publishedQuiz.id);
      expect(quizRepo.findById(publishedQuiz.id).is_published).toBe(0);

      // Student resumes attempt: must succeed
      const resumed = examService.startOrResumeAttempt({
        quizId: publishedQuiz.id,
        userId: studentUser.id,
        now: new Date('2026-10-16T10:02:00.000Z')
      });
      expect(resumed.attemptId).toBe(attempt.attemptId);
      expect(resumed.isResumed).toBe(true);

      // Student gets questions: must succeed
      const questionsData = examService.getAttemptQuestions(attempt.attemptId, studentUser.id, new Date('2026-10-16T10:02:00.000Z'));
      expect(questionsData.questions).toHaveLength(2);

      // Student submits attempt: must succeed and finalize
      const submitResult = examService.submitAttempt({
        attemptId: attempt.attemptId,
        userId: studentUser.id,
        answers: { [q1.id]: 0, [q2.id]: 1 },
        receiptTime: new Date('2026-10-16T10:05:00.000Z')
      });
      expect(submitResult.status).toBe(ATTEMPT_STATUS.PASSED);
      expect(submitResult.score).toBe(2);
    });

    test('rejects attempt creation on unpublished draft quizzes', () => {
      expect(() => {
        examService.startOrResumeAttempt({
          quizId: draftQuiz.id,
          userId: studentUser.id
        });
      }).toThrow(/not currently published/i);
    });

    test('rejects attempt creation by non-student accounts', () => {
      expect(() => {
        examService.startOrResumeAttempt({
          quizId: publishedQuiz.id,
          userId: adminUser.id
        });
      }).toThrow(/Only registered students may attempt examinations/i);
    });
  });

  describe('Retrieving Attempt Questions (getAttemptQuestions)', () => {
    let attempt;

    beforeEach(() => {
      attempt = examService.startOrResumeAttempt({
        quizId: publishedQuiz.id,
        userId: studentUser.id
      });
    });

    test('returns sanitized questions and hides correct_option completely', () => {
      const examData = examService.getAttemptQuestions(attempt.attemptId, studentUser.id);

      expect(examData.attemptId).toBe(attempt.attemptId);
      expect(examData.totalQuestions).toBe(2);
      expect(examData.questions).toHaveLength(2);

      const firstQuestion = examData.questions[0];
      expect(firstQuestion.questionText).toBe('What is a deadlock?');
      expect(firstQuestion.options).toHaveLength(4);

      // Verify answer key confidentiality: NEVER exposed
      expect(firstQuestion.correct_option).toBeUndefined();
      expect(firstQuestion.correctOption).toBeUndefined();
    });

    test('enforces attempt ownership preventing other students from viewing questions', () => {
      expect(() => {
        examService.getAttemptQuestions(attempt.attemptId, student2User.id);
      }).toThrow(/Access denied: You are not authorized/i);
    });
  });

  describe('Examination Submission & Timer Integrity', () => {
    let attempt;
    const baseStartTime = new Date('2026-10-16T10:00:00.000Z');

    beforeEach(() => {
      attempt = examService.startOrResumeAttempt({
        quizId: publishedQuiz.id,
        userId: studentUser.id,
        now: baseStartTime
      });
    });

    test('accepts on-time submission normally with isTimedOut = false', () => {
      // 5 minutes into the 10-minute exam (on-time)
      const submitTime = new Date('2026-10-16T10:05:00.000Z');
      const answers = {
        [q1.id]: 'A', // Correct
        [q2.id]: 'B'  // Correct
      };

      const result = examService.submitAttempt({
        attemptId: attempt.attemptId,
        userId: studentUser.id,
        answers,
        receiptTime: submitTime
      });

      expect(result.score).toBe(2);
      expect(result.totalQuestions).toBe(2);
      expect(result.percentage).toBe(100.0);
      expect(result.status).toBe(ATTEMPT_STATUS.PASSED);
      expect(result.isTimedOut).toBe(false);
      expect(result.alreadyFinalized).toBe(false);

      // Answer key revealed only in results
      expect(result.breakdown[0].correctOptionLetter).toBe('A');
      expect(result.breakdown[1].correctOptionLetter).toBe('B');

      // Verify persisted status in database
      const saved = subRepo.findById(attempt.attemptId);
      expect(saved.status).toBe('PASSED');
      expect(saved.is_timed_out).toBe(0);
    });

    test('accepts submission within 30-second grace period with isTimedOut = true and full score', () => {
      // Expiry is 10:10:00.000Z. Submitted at 10:10:15.000Z (15s after expiry, within 30s grace)
      const graceSubmitTime = new Date('2026-10-16T10:10:15.000Z');
      const answers = {
        [q1.id]: 0, // Correct (A)
        [q2.id]: 1  // Correct (B)
      };

      const result = examService.submitAttempt({
        attemptId: attempt.attemptId,
        userId: studentUser.id,
        answers,
        receiptTime: graceSubmitTime
      });

      expect(result.score).toBe(2);
      expect(result.percentage).toBe(100.0);
      expect(result.status).toBe(ATTEMPT_STATUS.PASSED);
      expect(result.isTimedOut).toBe(true); // Flagged as timed out

      const saved = subRepo.findById(attempt.attemptId);
      expect(saved.is_timed_out).toBe(1);
    });

    test('rejects submission received past the 30-second grace period and finalizes as FAILED', () => {
      // Expiry is 10:10:00.000Z. Submitted at 10:10:35.000Z (35s after expiry, past 30s grace)
      const postGraceTime = new Date('2026-10-16T10:10:35.000Z');
      const answers = {
        [q1.id]: 0,
        [q2.id]: 1
      };

      expect(() => {
        examService.submitAttempt({
          attemptId: attempt.attemptId,
          userId: studentUser.id,
          answers,
          receiptTime: postGraceTime
        });
      }).toThrow(/expired beyond the 30-second grace period/i);

      // Verify that database attempt record is finalized as FAILED with score 0
      const saved = subRepo.findById(attempt.attemptId);
      expect(saved.status).toBe('FAILED');
      expect(saved.score).toBe(0);
      expect(saved.is_timed_out).toBe(1);
    });

    test('guarantees idempotency on duplicate submissions with zero repeated grading or duplicate rows', () => {
      const submitTime = new Date('2026-10-16T10:05:00.000Z');
      const answers = {
        [q1.id]: 'A', // Correct
        [q2.id]: 'C'  // Incorrect (correct is B)
      };

      // First submission
      const firstResult = examService.submitAttempt({
        attemptId: attempt.attemptId,
        userId: studentUser.id,
        answers,
        receiptTime: submitTime
      });

      expect(firstResult.score).toBe(1);
      expect(firstResult.percentage).toBe(50.0);
      expect(firstResult.status).toBe('PASSED');
      expect(firstResult.alreadyFinalized).toBe(false);

      // Verify 2 answers recorded in audit table
      const initialAnswers = subRepo.findAnswersBySubmissionId(attempt.attemptId);
      expect(initialAnswers).toHaveLength(2);

      // Second duplicate submission attempt (simulating network retry)
      const secondResult = examService.submitAttempt({
        attemptId: attempt.attemptId,
        userId: studentUser.id,
        answers,
        receiptTime: new Date('2026-10-16T10:06:00.000Z')
      });

      expect(secondResult.score).toBe(1);
      expect(secondResult.percentage).toBe(50.0);
      expect(secondResult.status).toBe('PASSED');
      expect(secondResult.alreadyFinalized).toBe(true);

      // Verify no duplicate rows were added to the answers table
      const finalAnswers = subRepo.findAnswersBySubmissionId(attempt.attemptId);
      expect(finalAnswers).toHaveLength(2);
    });

    test('enforces ownership check on submission preventing unauthorized student submissions', () => {
      expect(() => {
        examService.submitAttempt({
          attemptId: attempt.attemptId,
          userId: student2User.id,
          answers: {}
        });
      }).toThrow(/Access denied: You are not authorized to submit/i);
    });
  });
});

