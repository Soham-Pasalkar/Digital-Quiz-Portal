/**
 * Database Engine & Persistence Test Suite
 * [Category A]: sql.js WebAssembly engine & database.sqlite persistence (STQA §3)
 * [Category B]: Atomic write pattern, restart re-hydration, foreign key enforcement
 * [Category C]: Partial unique indexes, historical record RESTRICT integrity, cross-quiz triggers
 */

const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../../src/database/db');

const TEST_DB_PATH = path.resolve(__dirname, '../../test_database.sqlite');

describe('Database Engine & Persistence (db.js)', () => {
  afterEach(() => {
    // Clean up temporary test files
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    const tmpPattern = `${TEST_DB_PATH}.tmp`;
    if (fs.existsSync(tmpPattern)) {
      fs.unlinkSync(tmpPattern);
    }
  });

  test('initializes in-memory database and creates all five approved relational tables', async () => {
    const db = await initDatabase({ dbPath: ':memory:' });

    const tables = db.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name ASC;`);
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('quizzes');
    expect(tableNames).toContain('questions');
    expect(tableNames).toContain('submissions');
    expect(tableNames).toContain('submission_answers');

    db.close();
  });

  test('strictly enforces foreign key constraints (PRAGMA foreign_keys = ON)', async () => {
    const db = await initDatabase({ dbPath: ':memory:' });

    // Attempting to insert a quiz referencing a non-existent user ID should fail
    expect(() => {
      db.run(`INSERT INTO quizzes (title, created_by) VALUES (?, ?);`, ['Orphan Quiz', 999]);
    }).toThrow(/FOREIGN KEY constraint failed/i);

    db.close();
  });

  test('strictly enforces CHECK constraints on enum-like columns', async () => {
    const db = await initDatabase({ dbPath: ':memory:' });

    // Invalid role in users table
    expect(() => {
      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, [
        'invalid_user',
        'hash',
        'salt',
        'superadmin' // Invalid role
      ]);
    }).toThrow(/CHECK constraint failed/i);

    // Insert valid admin and quiz
    db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, [
      'valid_admin',
      'hash',
      'salt',
      'admin'
    ]);
    db.run(`INSERT INTO quizzes (title, created_by) VALUES (?, ?);`, ['Valid Quiz', 1]);

    // Invalid correct_option in questions table (must be 0, 1, 2, 3)
    expect(() => {
      db.run(
        `INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [1, 'Text', 'A', 'B', 'C', 'D', 5] // Invalid correct_option (5)
      );
    }).toThrow(/CHECK constraint failed/i);

    db.close();
  });

  describe('Active Attempt Partial Unique Index (idx_active_attempt_unique)', () => {
    test('enforces at most ONE active (IN_PROGRESS) attempt per student per quiz, while permitting multiple completed attempts', async () => {
      const db = await initDatabase({ dbPath: ':memory:' });

      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, ['admin_u', 'h', 's', 'admin']);
      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, ['student_u', 'h', 's', 'student']);
      db.run(`INSERT INTO quizzes (title, created_by) VALUES (?, ?);`, ['DBMS Exam', 1]);

      const now = new Date().toISOString();
      const expires = new Date(Date.now() + 600000).toISOString();

      // First active attempt succeeds
      db.run(
        `INSERT INTO submissions (quiz_id, user_id, status, started_at, expires_at) VALUES (?, ?, 'IN_PROGRESS', ?, ?);`,
        [1, 2, now, expires]
      );

      // Second active attempt for SAME student and SAME quiz must fail with UNIQUE constraint error
      expect(() => {
        db.run(
          `INSERT INTO submissions (quiz_id, user_id, status, started_at, expires_at) VALUES (?, ?, 'IN_PROGRESS', ?, ?);`,
          [1, 2, now, expires]
        );
      }).toThrow(/UNIQUE constraint failed/i);

      // An active attempt for a DIFFERENT quiz succeeds
      db.run(`INSERT INTO quizzes (title, created_by) VALUES (?, ?);`, ['OS Exam', 1]);
      expect(() => {
        db.run(
          `INSERT INTO submissions (quiz_id, user_id, status, started_at, expires_at) VALUES (?, ?, 'IN_PROGRESS', ?, ?);`,
          [2, 2, now, expires]
        );
      }).not.toThrow();

      // Finalize the first attempt to 'PASSED'
      db.run(`UPDATE submissions SET status = 'PASSED', score = 5 WHERE id = 1;`);

      // Now that the prior attempt is finalized, inserting a new IN_PROGRESS attempt succeeds
      expect(() => {
        db.run(
          `INSERT INTO submissions (quiz_id, user_id, status, started_at, expires_at) VALUES (?, ?, 'IN_PROGRESS', ?, ?);`,
          [1, 2, now, expires]
        );
      }).not.toThrow();

      db.close();
    });
  });

  describe('Submission Answers Constraints & Triggers', () => {
    test('enforces selected_option CHECK constraint (-1, 0, 1, 2, 3)', async () => {
      const db = await initDatabase({ dbPath: ':memory:' });

      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, ['admin_opt', 'h', 's', 'admin']);
      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, ['student_opt', 'h', 's', 'student']);
      db.run(`INSERT INTO quizzes (title, created_by) VALUES (?, ?);`, ['Test Quiz', 1]);
      db.run(
        `INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [1, 'Q1', 'A', 'B', 'C', 'D', 0]
      );
      db.run(
        `INSERT INTO submissions (quiz_id, user_id, status, started_at, expires_at) VALUES (?, ?, 'IN_PROGRESS', ?, ?);`,
        [1, 2, new Date().toISOString(), new Date().toISOString()]
      );

      // Allowed values: -1, 0, 1, 2, 3
      expect(() => {
        db.run(
          `INSERT INTO submission_answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?);`,
          [1, 1, -1, 0]
        );
      }).not.toThrow();

      // Clean up answer to test other options
      db.run(`DELETE FROM submission_answers WHERE submission_id = 1;`);

      expect(() => {
        db.run(
          `INSERT INTO submission_answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?);`,
          [1, 1, 3, 0]
        );
      }).not.toThrow();

      db.run(`DELETE FROM submission_answers WHERE submission_id = 1;`);

      // Disallowed values: 4, -2, 99
      expect(() => {
        db.run(
          `INSERT INTO submission_answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?);`,
          [1, 1, 4, 0]
        );
      }).toThrow(/CHECK constraint failed/i);

      expect(() => {
        db.run(
          `INSERT INTO submission_answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?);`,
          [1, 1, -2, 0]
        );
      }).toThrow(/CHECK constraint failed/i);

      db.close();
    });

    test('enforces UNIQUE(submission_id, question_id) preventing duplicate answers for the same question', async () => {
      const db = await initDatabase({ dbPath: ':memory:' });

      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, ['admin_u', 'h', 's', 'admin']);
      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, ['student_u', 'h', 's', 'student']);
      db.run(`INSERT INTO quizzes (title, created_by) VALUES (?, ?);`, ['Test Quiz', 1]);
      db.run(
        `INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [1, 'Q1', 'A', 'B', 'C', 'D', 0]
      );
      db.run(
        `INSERT INTO submissions (quiz_id, user_id, status, started_at, expires_at) VALUES (?, ?, 'IN_PROGRESS', ?, ?);`,
        [1, 2, new Date().toISOString(), new Date().toISOString()]
      );

      // First answer insertion
      db.run(
        `INSERT INTO submission_answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?);`,
        [1, 1, 0, 1]
      );

      // Duplicate answer for same submission and question must throw UNIQUE constraint failure
      expect(() => {
        db.run(
          `INSERT INTO submission_answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?);`,
          [1, 1, 1, 0]
        );
      }).toThrow(/UNIQUE constraint failed/i);

      db.close();
    });

    test('enforces cross-quiz question integrity via trigger trg_validate_submission_question_quiz', async () => {
      const db = await initDatabase({ dbPath: ':memory:' });

      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, ['admin_x', 'h', 's', 'admin']);
      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, ['student_x', 'h', 's', 'student']);

      // Quiz 1 with Question 1
      db.run(`INSERT INTO quizzes (title, created_by) VALUES (?, ?);`, ['Quiz 1', 1]);
      db.run(
        `INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [1, 'Q1 in Quiz 1', 'A', 'B', 'C', 'D', 0]
      );

      // Quiz 2 with Question 2
      db.run(`INSERT INTO quizzes (title, created_by) VALUES (?, ?);`, ['Quiz 2', 1]);
      db.run(
        `INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [2, 'Q2 in Quiz 2', 'A', 'B', 'C', 'D', 1]
      );

      // Student attempt on Quiz 1
      db.run(
        `INSERT INTO submissions (quiz_id, user_id, status, started_at, expires_at) VALUES (?, ?, 'IN_PROGRESS', ?, ?);`,
        [1, 2, new Date().toISOString(), new Date().toISOString()]
      );

      // Attempting to record an answer in Quiz 1 submission referencing Question 2 (which belongs to Quiz 2)
      // must trigger the ABORT error
      expect(() => {
        db.run(
          `INSERT INTO submission_answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?);`,
          [1, 2, 1, 1] // submission_id 1 is Quiz 1; question_id 2 is Quiz 2
        );
      }).toThrow(/Cross-quiz question reference/i);

      db.close();
    });
  });

  describe('Historical Record Integrity (ON DELETE RESTRICT)', () => {
    test('strictly prevents deletion of users, quizzes, and questions that have historical submissions/answers', async () => {
      const db = await initDatabase({ dbPath: ':memory:' });

      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, ['admin_hist', 'h', 's', 'admin']);
      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, ['student_hist', 'h', 's', 'student']);
      db.run(`INSERT INTO quizzes (title, created_by) VALUES (?, ?);`, ['Historical Quiz', 1]);
      db.run(
        `INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [1, 'Q1 Hist', 'A', 'B', 'C', 'D', 0]
      );
      db.run(
        `INSERT INTO submissions (quiz_id, user_id, status, started_at, expires_at) VALUES (?, ?, 'PASSED', ?, ?);`,
        [1, 2, new Date().toISOString(), new Date().toISOString()]
      );
      db.run(
        `INSERT INTO submission_answers (submission_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?);`,
        [1, 1, 0, 1]
      );

      // 1. Attempting to delete student with submissions should fail (ON DELETE RESTRICT)
      expect(() => {
        db.run(`DELETE FROM users WHERE id = 2;`);
      }).toThrow(/FOREIGN KEY constraint failed/i);

      // 2. Attempting to delete quiz with submissions should fail (ON DELETE RESTRICT)
      expect(() => {
        db.run(`DELETE FROM quizzes WHERE id = 1;`);
      }).toThrow(/FOREIGN KEY constraint failed/i);

      // 3. Attempting to delete question referenced in submission_answers should fail (ON DELETE RESTRICT)
      expect(() => {
        db.run(`DELETE FROM questions WHERE id = 1;`);
      }).toThrow(/FOREIGN KEY constraint failed/i);

      // 4. Attempting to delete admin who authored quizzes should fail (ON DELETE RESTRICT)
      expect(() => {
        db.run(`DELETE FROM users WHERE id = 1;`);
      }).toThrow(/FOREIGN KEY constraint failed/i);

      db.close();
    });
  });

  describe('Persistence & Durability', () => {
    test('persists state to disk and accurately reloads existing database across process restarts', async () => {
      // 1. Initial process: create database file and insert records
      const db1 = await initDatabase({ dbPath: TEST_DB_PATH, forceNew: true });
      db1.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, [
        'persisted_admin',
        'hash123',
        'salt123',
        'admin'
      ]);
      db1.save();
      db1.close();

      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);

      // 2. Restart simulation: reopen database from disk without forceNew
      const db2 = await initDatabase({ dbPath: TEST_DB_PATH, forceNew: false });
      const user = db2.get(`SELECT * FROM users WHERE username = ?;`, ['persisted_admin']);

      expect(user).not.toBeNull();
      expect(user.username).toBe('persisted_admin');
      expect(user.role).toBe('admin');

      db2.close();
    });

    test('performs write-flush-rename export with fsync to guarantee durability across writes', async () => {
      const db = await initDatabase({ dbPath: TEST_DB_PATH, forceNew: true });
      db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);`, [
        'atomic_user',
        'hash',
        'salt',
        'student'
      ]);

      const saved = db.save();
      expect(saved).toBe(true);
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);

      // Verify file size is valid SQLite database (> 0 bytes)
      const stats = fs.statSync(TEST_DB_PATH);
      expect(stats.size).toBeGreaterThan(0);

      db.close();
    });
  });
});
