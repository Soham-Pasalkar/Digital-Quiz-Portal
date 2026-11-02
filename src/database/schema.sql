-- ============================================================================
-- Digital Quiz Portal Relational Schema DDL
-- Database Engine: sql.js (WebAssembly SQLite)
-- [Category A]: Users, Quizzes, Questions, Submissions entities & attributes
-- [Category B]: Configurable duration, attempt timestamps, timeout flag, indexes
-- [Category C]: Cryptographic salt column for scrypt hashing
-- ============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'student')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 10 CHECK(duration_minutes > 0),
    created_by INTEGER NOT NULL,
    is_published INTEGER DEFAULT 0 CHECK(is_published IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- 3. Questions Table (Four options per question, 0-indexed correct option)
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option INTEGER NOT NULL CHECK(correct_option IN (0, 1, 2, 3)),
    order_num INTEGER DEFAULT 1,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- 4. Submissions / Attempts Table
CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    total_questions INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0 CHECK(score >= 0),
    percentage REAL DEFAULT 0.0 CHECK(percentage >= 0.0 AND percentage <= 100.0),
    status TEXT CHECK(status IN ('IN_PROGRESS', 'PASSED', 'FAILED')) DEFAULT 'IN_PROGRESS',
    is_timed_out INTEGER DEFAULT 0 CHECK(is_timed_out IN (0, 1)),
    started_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    submitted_at DATETIME,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- 5. Submission Answers Audit Table
CREATE TABLE IF NOT EXISTS submission_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    selected_option INTEGER NOT NULL CHECK(selected_option IN (-1, 0, 1, 2, 3)), -- 0..3 or -1 for unattempted
    is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE RESTRICT,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT,
    UNIQUE(submission_id, question_id)
);

-- ============================================================================
-- Triggers for Advanced Relational Integrity
-- ============================================================================
-- Ensure an answer can only reference a question belonging to the submission's quiz
CREATE TRIGGER IF NOT EXISTS trg_validate_submission_question_quiz
BEFORE INSERT ON submission_answers
FOR EACH ROW
WHEN (SELECT quiz_id FROM questions WHERE id = NEW.question_id) != (SELECT quiz_id FROM submissions WHERE id = NEW.submission_id)
BEGIN
    SELECT RAISE(ABORT, 'Cross-quiz question reference: Question does not belong to the submission quiz.');
END;

-- ============================================================================
-- Indexes for Query Performance and Relational Constraints
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);
CREATE INDEX IF NOT EXISTS idx_quizzes_is_published ON quizzes(is_published);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_submissions_quiz_user ON submissions(quiz_id, user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submission_answers_sub ON submission_answers(submission_id);

-- Partial Unique Index: Guarantees at most ONE active ('IN_PROGRESS') attempt per student per quiz
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_attempt_unique ON submissions(user_id, quiz_id) WHERE status = 'IN_PROGRESS';
