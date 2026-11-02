/**
 * Database Seed Test Suite
 * [Category A]: Demo users & sample quizzes from reports/screenshots
 * [Category C]: Async scrypt password verification on seeded accounts
 */

const { initDatabase } = require('../../src/database/db');
const { seedDatabase } = require('../../src/database/seed');
const { verifyPassword } = require('../../src/database/cryptoUtils');
const UserRepository = require('../../src/dal/userRepository');
const QuizRepository = require('../../src/dal/quizRepository');
const SubmissionRepository = require('../../src/dal/submissionRepository');

describe('Database Seeder (seed.js)', () => {
  let db;

  beforeEach(async () => {
    db = await initDatabase({ dbPath: ':memory:' });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  test('successfully seeds demonstration users with verifiable async scrypt hashes', async () => {
    const { usersSeeded } = await seedDatabase(db);
    expect(usersSeeded).toBe(3);

    const userRepo = new UserRepository(db);

    // Verify Admin Account
    const admin = userRepo.findByUsername('admin');
    expect(admin).not.toBeNull();
    expect(admin.role).toBe('admin');
    expect(admin.password_hash).toHaveLength(128);
    expect(admin.salt).toHaveLength(32);
    expect(await verifyPassword('admin123', admin.password_hash, admin.salt)).toBe(true);
    expect(await verifyPassword('wrongpassword', admin.password_hash, admin.salt)).toBe(false);

    // Verify Student 1 Account
    const student1 = userRepo.findByUsername('student1');
    expect(student1).not.toBeNull();
    expect(student1.role).toBe('student');
    expect(await verifyPassword('student123', student1.password_hash, student1.salt)).toBe(true);

    // Verify Student 2 Account
    const student2 = userRepo.findByUsername('student2');
    expect(student2).not.toBeNull();
    expect(student2.role).toBe('student');
    expect(await verifyPassword('student123', student2.password_hash, student2.salt)).toBe(true);
  });

  test('successfully seeds the two authoritative sample quizzes and their questions', async () => {
    await seedDatabase(db);

    const quizRepo = new QuizRepository(db);
    const quizzes = quizRepo.findAll();

    expect(quizzes).toHaveLength(2);

    // Verify Quiz 1: Database Management Systems
    const dbmsQuiz = quizzes.find(q => q.title === 'Database Management Systems');
    expect(dbmsQuiz).toBeDefined();
    expect(dbmsQuiz.is_published).toBe(1);
    expect(dbmsQuiz.duration_minutes).toBe(10);
    expect(Number(dbmsQuiz.question_count)).toBe(3);

    const dbmsQuestions = quizRepo.findQuestionsByQuizId(dbmsQuiz.id);
    expect(dbmsQuestions).toHaveLength(3);
    expect(dbmsQuestions[0].question_text).toContain('level of database abstraction');
    expect(dbmsQuestions[0].correct_option).toBe(1); // Option B
    expect(dbmsQuestions[1].question_text).toContain('minimal super key');
    expect(dbmsQuestions[1].correct_option).toBe(1); // Option B
    expect(dbmsQuestions[2].question_text).toContain('SQL command is used to remove a table');
    expect(dbmsQuestions[2].correct_option).toBe(2); // Option C

    // Verify Quiz 2: Software Testing & Quality Assurance Mid-Term
    const stqaQuiz = quizzes.find(q => q.title.includes('Software Testing'));
    expect(stqaQuiz).toBeDefined();
    expect(stqaQuiz.is_published).toBe(1);
    expect(Number(stqaQuiz.question_count)).toBe(2);

    const stqaQuestions = quizRepo.findQuestionsByQuizId(stqaQuiz.id);
    expect(stqaQuestions).toHaveLength(2);
    expect(stqaQuestions[0].correct_option).toBe(1); // BVA
    expect(stqaQuestions[1].correct_option).toBe(2); // 50%
  });

  test('seeds initial demonstration submission matching STQA Report Results Page 8', async () => {
    await seedDatabase(db);

    const subRepo = new SubmissionRepository(db);
    const submissions = subRepo.findAllWithDetails();

    expect(submissions).toHaveLength(1);
    expect(submissions[0].student).toBe('student1');
    expect(submissions[0].quiz_title).toBe('Database Management Systems');
    expect(submissions[0].score).toBe(3);
    expect(submissions[0].total_questions).toBe(3);
    expect(submissions[0].percentage).toBe(100.0);
    expect(submissions[0].status).toBe('PASSED');
    expect(submissions[0].is_timed_out).toBe(0);
  });

  test('is completely idempotent when executed repeatedly', async () => {
    // First run
    const result1 = await seedDatabase(db);
    expect(result1.usersSeeded).toBe(3);
    expect(result1.quizzesSeeded).toBe(2);

    // Second run: should detect existing data and not duplicate
    const result2 = await seedDatabase(db);
    expect(result2.usersSeeded).toBe(0);
    expect(result2.quizzesSeeded).toBe(0);

    const userRepo = new UserRepository(db);
    const quizRepo = new QuizRepository(db);

    expect(userRepo.count()).toBe(3);
    expect(quizRepo.countQuizzes()).toBe(2);
  });
});

