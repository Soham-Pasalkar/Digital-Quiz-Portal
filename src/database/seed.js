/**
 * Deterministic Demonstration Database Seeder
 * [Category A]: Demo users (admin/student1) & sample quizzes from reports/screenshots
 * [Category C]: Asynchronous scrypt password hashing with unique random salts
 */

const { ROLES, ATTEMPT_STATUS } = require('../config/constants');
const { generateSalt, hashPassword } = require('./cryptoUtils');
const UserRepository = require('../dal/userRepository');
const QuizRepository = require('../dal/quizRepository');
const SubmissionRepository = require('../dal/submissionRepository');

/**
 * Seed demonstration data into the database.
 * Uses asynchronous scrypt hashing with a unique random salt for each user.
 * 
 * @param {import('./db').DatabaseClient} dbClient
 * @returns {Promise<{ usersSeeded: number, quizzesSeeded: number }>}
 */
async function seedDatabase(dbClient) {
  const userRepo = new UserRepository(dbClient);
  const quizRepo = new QuizRepository(dbClient);
  const subRepo = new SubmissionRepository(dbClient);

  let usersSeeded = 0;
  let quizzesSeeded = 0;

  // 1. Seed Users if not already present
  let admin = userRepo.findByUsername('admin');
  if (!admin) {
    const salt = generateSalt();
    const passwordHash = await hashPassword('admin123', salt);
    admin = userRepo.createUser({
      username: 'admin',
      passwordHash,
      salt,
      role: ROLES.ADMIN
    });
    usersSeeded++;
  }

  let student1 = userRepo.findByUsername('student1');
  if (!student1) {
    const salt = generateSalt();
    const passwordHash = await hashPassword('student123', salt);
    student1 = userRepo.createUser({
      username: 'student1',
      passwordHash,
      salt,
      role: ROLES.STUDENT
    });
    usersSeeded++;
  }

  let student2 = userRepo.findByUsername('student2');
  if (!student2) {
    const salt = generateSalt();
    const passwordHash = await hashPassword('student123', salt);
    student2 = userRepo.createUser({
      username: 'student2',
      passwordHash,
      salt,
      role: ROLES.STUDENT
    });
    usersSeeded++;
  }

  // 2. Seed Quizzes if not already present
  if (quizRepo.countQuizzes() === 0) {
    // Sample Quiz 1: Database Management Systems (Matches screenshots on STQA Report Page 4, 5, 7, 8)
    const quiz1 = quizRepo.createQuiz({
      title: 'Database Management Systems',
      durationMinutes: 10,
      createdBy: admin.id,
      isPublished: 1
    });

    const q1_1 = quizRepo.addQuestion({
      quizId: quiz1.id,
      questionText: 'Which level of database abstraction describes how the data is actually stored on physical storage devices?',
      optionA: 'Conceptual Level',
      optionB: 'Physical / Internal Level',
      optionC: 'Logical Level',
      optionD: 'View / External Level',
      correctOption: 1, // Option B
      orderNum: 1
    });

    const q1_2 = quizRepo.addQuestion({
      quizId: quiz1.id,
      questionText: 'A minimal super key that uniquely identifies a record in a table and contains no redundant attributes is called a:',
      optionA: 'Foreign Key',
      optionB: 'Candidate Key',
      optionC: 'Secondary Key',
      optionD: 'Composite Key',
      correctOption: 1, // Option B
      orderNum: 2
    });

    const q1_3 = quizRepo.addQuestion({
      quizId: quiz1.id,
      questionText: 'Which SQL command is used to remove a table and all of its data completely from the database schema?',
      optionA: 'DELETE',
      optionB: 'TRUNCATE',
      optionC: 'DROP',
      optionD: 'REMOVE',
      correctOption: 2, // Option C
      orderNum: 3
    });

    quizzesSeeded++;

    // Sample Quiz 2: Software Testing & Quality Assurance Mid-Term (Matches screenshot on STQA Report Page 6)
    const quiz2 = quizRepo.createQuiz({
      title: 'Software Testing & Quality Assurance Mid-Term',
      durationMinutes: 10,
      createdBy: admin.id,
      isPublished: 1
    });

    quizRepo.addQuestion({
      quizId: quiz2.id,
      questionText: 'Which black-box testing technique tests values at the extreme boundaries of input domains?',
      optionA: 'State Transition',
      optionB: 'Boundary Value Analysis',
      optionC: 'Statement Testing',
      optionD: 'Path Analysis',
      correctOption: 1, // Option B
      orderNum: 1
    });

    quizRepo.addQuestion({
      quizId: quiz2.id,
      questionText: 'What is the passing percentage threshold in the Digital Quiz Portal?',
      optionA: '40%',
      optionB: '45%',
      optionC: '50%',
      optionD: '60%',
      correctOption: 2, // Option C
      orderNum: 2
    });

    quizzesSeeded++;

    // 3. Seed initial demonstration submission matching STQA Report Results Page 8
    const attempt = subRepo.createAttempt({
      quizId: quiz1.id,
      userId: student1.id,
      startedAt: '2026-10-16T04:22:43.000Z',
      expiresAt: '2026-10-16T04:32:43.000Z'
    });

    subRepo.recordAnswer({
      submissionId: attempt.id,
      questionId: q1_1.id,
      selectedOption: 1,
      isCorrect: 1
    });
    subRepo.recordAnswer({
      submissionId: attempt.id,
      questionId: q1_2.id,
      selectedOption: 1,
      isCorrect: 1
    });
    subRepo.recordAnswer({
      submissionId: attempt.id,
      questionId: q1_3.id,
      selectedOption: 2,
      isCorrect: 1
    });

    subRepo.finalizeSubmission(attempt.id, {
      totalQuestions: 3,
      score: 3,
      percentage: 100.0,
      status: ATTEMPT_STATUS.PASSED,
      isTimedOut: 0,
      submittedAt: '2026-10-16T04:32:43.000Z'
    });
  }

  // Atomically persist seeded state to disk
  dbClient.save();

  return { usersSeeded, quizzesSeeded };
}

// Standalone execution support
if (require.main === module) {
  const { initDatabase } = require('./db');
  (async () => {
    try {
      console.log('[Seed] Initializing database and applying schema...');
      const dbClient = await initDatabase({ forceNew: true });
      console.log('[Seed] Seeding demonstration records...');
      const result = await seedDatabase(dbClient);
      console.log(`[Seed] Successfully seeded: ${result.usersSeeded} users, ${result.quizzesSeeded} quizzes.`);
      dbClient.close();
      console.log('[Seed] Database saved and closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('[Seed Error]:', err);
      process.exit(1);
    }
  })();
}

module.exports = {
  seedDatabase
};
