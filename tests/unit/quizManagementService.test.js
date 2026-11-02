/**
 * QuizManagementService Unit Tests
 * [Category A]: Quiz creation, question authoring, empty quiz rejection (STQA §1, TC-06)
 * [Category B]: Option normalization, duration configuration
 * [Category C]: Answer key confidentiality (getQuizForAttempt projection)
 */

const { initDatabase } = require('../../src/database/db');
const UserRepository = require('../../src/dal/userRepository');
const QuizRepository = require('../../src/dal/quizRepository');
const SubmissionRepository = require('../../src/dal/submissionRepository');
const QuizManagementService = require('../../src/services/quizManagementService');
const { ROLES } = require('../../src/config/constants');

describe('QuizManagementService', () => {
  let db;
  let userRepo;
  let quizRepo;
  let subRepo;
  let quizService;
  let adminUser;
  let studentUser;

  beforeEach(async () => {
    db = await initDatabase({ dbPath: ':memory:' });
    userRepo = new UserRepository(db);
    quizRepo = new QuizRepository(db);
    subRepo = new SubmissionRepository(db);
    quizService = new QuizManagementService({
      quizRepo,
      userRepo,
      dbClient: db,
      submissionRepo: subRepo
    });

    adminUser = userRepo.createUser({
      username: 'admin_qm',
      passwordHash: 'h',
      salt: 's',
      role: ROLES.ADMIN
    });

    studentUser = userRepo.createUser({
      username: 'student_qm',
      passwordHash: 'h',
      salt: 's',
      role: ROLES.STUDENT
    });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('Option Normalization Helpers', () => {
    test('accurately normalizes letter options (A, B, C, D) to zero-indexed integers (0..3)', () => {
      expect(QuizManagementService.normalizeOptionIndex('A')).toBe(0);
      expect(QuizManagementService.normalizeOptionIndex('b')).toBe(1);
      expect(QuizManagementService.normalizeOptionIndex('C')).toBe(2);
      expect(QuizManagementService.normalizeOptionIndex('d')).toBe(3);
    });

    test('accurately normalizes integer and numeric string options', () => {
      expect(QuizManagementService.normalizeOptionIndex(0)).toBe(0);
      expect(QuizManagementService.normalizeOptionIndex(3)).toBe(3);
      expect(QuizManagementService.normalizeOptionIndex('1')).toBe(1);
    });

    test('rejects invalid option representations', () => {
      expect(() => QuizManagementService.normalizeOptionIndex('E')).toThrow(/Invalid correctOption/i);
      expect(() => QuizManagementService.normalizeOptionIndex(4)).toThrow(/Invalid correctOption/i);
      expect(() => QuizManagementService.normalizeOptionIndex(-1)).toThrow(/Invalid correctOption/i);
      expect(() => QuizManagementService.normalizeOptionIndex(null)).toThrow(/Invalid correctOption/i);
    });

    test('accurately maps internal indices to display letters', () => {
      expect(QuizManagementService.indexToLetter(0)).toBe('A');
      expect(QuizManagementService.indexToLetter(1)).toBe('B');
      expect(QuizManagementService.indexToLetter(2)).toBe('C');
      expect(QuizManagementService.indexToLetter(3)).toBe('D');
      expect(QuizManagementService.indexToLetter(-1)).toBe('Unattempted');
    });
  });

  describe('Quiz Creation & Editing', () => {
    test('creates a draft quiz successfully with admin privileges', () => {
      const quiz = quizService.createQuiz({
        title: 'Database Management Systems',
        durationMinutes: 15,
        createdBy: adminUser.id
      });

      expect(quiz).toBeDefined();
      expect(quiz.id).toBeGreaterThan(0);
      expect(quiz.title).toBe('Database Management Systems');
      expect(quiz.duration_minutes).toBe(15);
      expect(quiz.is_published).toBe(0); // Created in draft mode
      expect(quiz.author).toBe('admin_qm');
    });

    test('rejects quiz creation by a student user', () => {
      expect(() => {
        quizService.createQuiz({
          title: 'Unauthorized Quiz',
          durationMinutes: 10,
          createdBy: studentUser.id
        });
      }).toThrow(/Access denied: Action requires Administrator privileges/i);
    });

    test('rejects quiz creation with empty title or invalid duration', () => {
      expect(() => {
        quizService.createQuiz({ title: '', createdBy: adminUser.id });
      }).toThrow(/Quiz title is required/i);

      expect(() => {
        quizService.createQuiz({ title: 'Valid Title', durationMinutes: -5, createdBy: adminUser.id });
      }).toThrow(/Duration must be a positive integer/i);
    });

    test('updates quiz title and duration', () => {
      const quiz = quizService.createQuiz({
        title: 'Initial Title',
        durationMinutes: 10,
        createdBy: adminUser.id
      });

      const updated = quizService.updateQuiz(quiz.id, {
        title: 'Updated Title',
        durationMinutes: 20
      }, adminUser.id);

      expect(updated.title).toBe('Updated Title');
      expect(updated.duration_minutes).toBe(20);
    });
  });

  describe('Question Authoring & Management', () => {
    let quiz;

    beforeEach(() => {
      quiz = quizService.createQuiz({
        title: 'Software Testing Basics',
        durationMinutes: 10,
        createdBy: adminUser.id
      });
    });

    test('adds a valid multiple-choice question with 4 options and letter correctOption', () => {
      const q = quizService.addQuestion(quiz.id, {
        questionText: 'What is Equivalence Partitioning?',
        options: ['White-box technique', 'Black-box technique', 'Stress test', 'Security scan'],
        correctOption: 'B',
        orderNum: 1
      }, adminUser.id);

      expect(q).toBeDefined();
      expect(q.id).toBeGreaterThan(0);
      expect(q.correct_option).toBe(1); // Normalized from 'B' to 1
      expect(q.option_b).toBe('Black-box technique');
    });

    test('rejects question with missing text, not exactly 4 options, or blank options', () => {
      // Missing text
      expect(() => {
        quizService.addQuestion(quiz.id, {
          questionText: '',
          options: ['A', 'B', 'C', 'D'],
          correctOption: 0
        }, adminUser.id);
      }).toThrow(/Question text is required/i);

      // Only 3 options
      expect(() => {
        quizService.addQuestion(quiz.id, {
          questionText: 'Q Text',
          options: ['A', 'B', 'C'],
          correctOption: 0
        }, adminUser.id);
      }).toThrow(/Exactly four answer options/i);

      // Blank option
      expect(() => {
        quizService.addQuestion(quiz.id, {
          questionText: 'Q Text',
          options: ['A', '   ', 'C', 'D'],
          correctOption: 0
        }, adminUser.id);
      }).toThrow(/Option B cannot be empty/i);
    });

    test('updates and deletes existing questions', () => {
      const q = quizService.addQuestion(quiz.id, {
        questionText: 'Initial text',
        options: ['A', 'B', 'C', 'D'],
        correctOption: 0
      }, adminUser.id);

      const updated = quizService.updateQuestion(q.id, {
        questionText: 'Revised text',
        correctOption: 'C'
      }, adminUser.id);

      expect(updated.question_text).toBe('Revised text');
      expect(updated.correct_option).toBe(2);

      const deleted = quizService.deleteQuestion(q.id, adminUser.id);
      expect(deleted).toBe(true);
      expect(quizRepo.findQuestionById(q.id)).toBeNull();
    });
  });

  describe('Publishing Validation & Lifecycle', () => {
    test('strictly rejects publishing an empty quiz without questions [STQA TC-06]', () => {
      const emptyQuiz = quizService.createQuiz({
        title: 'Empty Quiz Scenario',
        createdBy: adminUser.id
      });

      expect(() => {
        quizService.publishQuiz(emptyQuiz.id, adminUser.id);
      }).toThrow(/Cannot publish an empty quiz without questions/i);

      // Verify quiz remains unpublished
      const fetched = quizRepo.findById(emptyQuiz.id);
      expect(fetched.is_published).toBe(0);
    });

    test('successfully publishes quiz once questions are added, and supports unpublishing', () => {
      const quiz = quizService.createQuiz({
        title: 'Publishable Quiz',
        createdBy: adminUser.id
      });

      quizService.addQuestion(quiz.id, {
        questionText: 'Question 1',
        options: ['1', '2', '3', '4'],
        correctOption: 'A'
      }, adminUser.id);

      const published = quizService.publishQuiz(quiz.id, adminUser.id);
      expect(published.is_published).toBe(1);

      const unpublished = quizService.unpublishQuiz(quiz.id, adminUser.id);
      expect(unpublished.is_published).toBe(0);
    });
  });

  describe('Student Catalog & Answer-Key Confidentiality (getQuizForAttempt)', () => {
    let publishedQuiz;
    let draftQuiz;

    beforeEach(() => {
      draftQuiz = quizService.createQuiz({ title: 'Draft Exam', createdBy: adminUser.id });
      quizService.addQuestion(draftQuiz.id, {
        questionText: 'Draft Q',
        options: ['A', 'B', 'C', 'D'],
        correctOption: 0
      }, adminUser.id);

      publishedQuiz = quizService.createQuiz({ title: 'Live Exam', createdBy: adminUser.id });
      quizService.addQuestion(publishedQuiz.id, {
        questionText: 'Live Q1',
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        correctOption: 'C'
      }, adminUser.id);
      quizService.publishQuiz(publishedQuiz.id, adminUser.id);
    });

    test('getPublishedQuizzes returns only published quizzes for student catalog', () => {
      const catalog = quizService.getPublishedQuizzes();
      expect(catalog).toHaveLength(1);
      expect(catalog[0].id).toBe(publishedQuiz.id);
      expect(catalog[0].title).toBe('Live Exam');
      expect(catalog[0].questionCount).toBe(1);
    });

    test('getQuizForAttempt strips correct_option completely from questions to protect answer key', () => {
      const attemptQuiz = quizService.getQuizForAttempt(publishedQuiz.id);

      expect(attemptQuiz.id).toBe(publishedQuiz.id);
      expect(attemptQuiz.title).toBe('Live Exam');
      expect(attemptQuiz.questions).toHaveLength(1);

      const q = attemptQuiz.questions[0];
      expect(q.questionText).toBe('Live Q1');
      expect(q.options).toEqual(['Opt A', 'Opt B', 'Opt C', 'Opt D']);

      // Confidentiality check: correct_option must NEVER be exposed
      expect(q.correct_option).toBeUndefined();
      expect(q.correctOption).toBeUndefined();
    });

    test('getQuizForAttempt rejects draft quizzes', () => {
      expect(() => {
        quizService.getQuizForAttempt(draftQuiz.id);
      }).toThrow(/Quiz is not published/i);
    });

    test('getAllQuizzesForAdmin and getQuizDetailsForAdmin provide full audit details to admin', () => {
      const all = quizService.getAllQuizzesForAdmin(adminUser.id);
      expect(all.length).toBe(2);

      const details = quizService.getQuizDetailsForAdmin(publishedQuiz.id, adminUser.id);
      expect(details.questions).toHaveLength(1);
      expect(details.questions[0].correctOption).toBe(2);
      expect(details.questions[0].correctOptionLetter).toBe('C');
    });
  });

  describe('Quiz Immutability Once Attempts Exist [Prerequisite 1]', () => {
    let quizWithAttempts;
    let question;

    beforeEach(() => {
      quizWithAttempts = quizService.createQuiz({
        title: 'Immutable Quiz',
        durationMinutes: 10,
        createdBy: adminUser.id
      });

      question = quizService.addQuestion(quizWithAttempts.id, {
        questionText: 'Initial Question',
        options: ['A', 'B', 'C', 'D'],
        correctOption: 0
      }, adminUser.id);

      quizService.publishQuiz(quizWithAttempts.id, adminUser.id);

      // Create an attempt on this quiz
      subRepo.createAttempt({
        quizId: quizWithAttempts.id,
        userId: studentUser.id,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 600000).toISOString()
      });
    });

    test('strictly prevents adding questions once attempts exist', () => {
      expect(() => {
        quizService.addQuestion(quizWithAttempts.id, {
          questionText: 'New Question',
          options: ['1', '2', '3', '4'],
          correctOption: 0
        }, adminUser.id);
      }).toThrow(/Cannot add questions: Quiz has existing examination attempts/i);
    });

    test('strictly prevents modifying questions once attempts exist', () => {
      expect(() => {
        quizService.updateQuestion(question.id, {
          questionText: 'Changed Question Text'
        }, adminUser.id);
      }).toThrow(/Cannot modify questions: Quiz has existing examination attempts/i);
    });

    test('strictly prevents deleting questions once attempts exist', () => {
      expect(() => {
        quizService.deleteQuestion(question.id, adminUser.id);
      }).toThrow(/Cannot delete questions: Quiz has existing examination attempts/i);
    });

    test('strictly prevents changing quiz duration once attempts exist', () => {
      expect(() => {
        quizService.updateQuiz(quizWithAttempts.id, {
          durationMinutes: 25
        }, adminUser.id);
      }).toThrow(/Cannot modify scoring configuration or duration: Quiz has existing examination attempts/i);
    });

    test('strictly prevents deleting a quiz once attempts exist', () => {
      expect(() => {
        quizService.deleteQuiz(quizWithAttempts.id, adminUser.id);
      }).toThrow(/Cannot delete quiz: Quiz has existing examination attempts/i);
    });
  });
});

