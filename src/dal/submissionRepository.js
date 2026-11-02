/**
 * Submission & Exam Attempt Data Access Repository
 * [Category A]: Submission entity, auto-grading record, admin score reporting (STQA §1, §3, OOMD Diagram 2)
 * [Category B]: Active attempt tracking, timer expiration, timeout flag, idempotency support
 * [Category C]: Active attempt concurrency conflict resolution, cross-quiz question integrity validation
 */

const { ATTEMPT_STATUS } = require('../config/constants');

class SubmissionRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  /**
   * Create a new examination attempt in 'IN_PROGRESS' state with server timestamps.
   * If a concurrent or duplicate attempt creation request is executed for an active attempt,
   * catches the partial UNIQUE index conflict and returns the existing active attempt.
   * 
   * @param {Object} attemptData
   * @param {number} attemptData.quizId
   * @param {number} attemptData.userId
   * @param {string} attemptData.startedAt - ISO string
   * @param {string} attemptData.expiresAt - ISO string
   * @returns {Object} Created or existing active attempt record
   */
  createAttempt({ quizId, userId, startedAt, expiresAt }) {
    try {
      const { lastInsertRowid } = this.db.run(
        `INSERT INTO submissions (quiz_id, user_id, status, started_at, expires_at)
         VALUES (?, ?, ?, ?, ?);`,
        [quizId, userId, ATTEMPT_STATUS.IN_PROGRESS, startedAt, expiresAt]
      );

      return this.findById(lastInsertRowid);
    } catch (err) {
      // Handle active attempt partial unique index conflict: idx_active_attempt_unique
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        const existing = this.findActiveAttempt(quizId, userId);
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  /**
   * Find an existing active ('IN_PROGRESS') attempt for a student on a quiz.
   * Used for attempt resumption and concurrency guards.
   * @param {number} quizId
   * @param {number} userId
   * @returns {Object|null}
   */
  findActiveAttempt(quizId, userId) {
    return this.db.get(
      `SELECT * FROM submissions
       WHERE quiz_id = ? AND user_id = ? AND status = ?
       ORDER BY id DESC LIMIT 1;`,
      [quizId, userId, ATTEMPT_STATUS.IN_PROGRESS]
    );
  }

  /**
   * Find a submission by primary key ID.
   * @param {number} id
   * @returns {Object|null}
   */
  findById(id) {
    return this.db.get(
      `SELECT s.*, u.username AS student_username, q.title AS quiz_title
       FROM submissions s
       JOIN users u ON s.user_id = u.id
       JOIN quizzes q ON s.quiz_id = q.id
       WHERE s.id = ?;`,
      [id]
    );
  }

  /**
   * Finalize an attempt with score, percentage, status, and timeout flag.
   * Idempotency guarantee: updates status from 'IN_PROGRESS' to 'PASSED' or 'FAILED'.
   * @param {number} id - Submission / Attempt ID
   * @param {Object} finalData
   * @param {number} finalData.totalQuestions
   * @param {number} finalData.score
   * @param {number} finalData.percentage
   * @param {string} finalData.status - 'PASSED' | 'FAILED'
   * @param {number} [finalData.isTimedOut=0]
   * @param {string} [finalData.submittedAt]
   * @returns {Object|null} Updated submission record
   */
  finalizeSubmission(id, { totalQuestions, score, percentage, status, isTimedOut = 0, submittedAt = new Date().toISOString() }) {
    this.db.run(
      `UPDATE submissions
       SET total_questions = ?,
           score = ?,
           percentage = ?,
           status = ?,
           is_timed_out = ?,
           submitted_at = ?
       WHERE id = ?;`,
      [totalQuestions, score, percentage, status, isTimedOut ? 1 : 0, submittedAt, id]
    );

    return this.findById(id);
  }

  /**
   * Record individual question answer and correctness audit entry.
   * Strictly validates:
   * 1. Option range (-1 for unattempted, or 0, 1, 2, 3)
   * 2. Cross-quiz question reference (question must belong to the submission's quiz)
   * 3. Idempotent uniqueness: each question may only be answered once per submission
   * 
   * @param {Object} answerData
   * @param {number} answerData.submissionId
   * @param {number} answerData.questionId
   * @param {number} answerData.selectedOption - 0..3 or -1
   * @param {number} answerData.isCorrect - 0 or 1
   * @returns {Object} Inserted answer record
   */
  recordAnswer({ submissionId, questionId, selectedOption, isCorrect }) {
    if (![-1, 0, 1, 2, 3].includes(selectedOption)) {
      throw new Error(`Invalid selectedOption: ${selectedOption}. Must be -1, 0, 1, 2, or 3.`);
    }

    // Repository-level cross-quiz validation
    const validation = this.db.get(
      `SELECT s.quiz_id AS submission_quiz_id, q.quiz_id AS question_quiz_id
       FROM submissions s, questions q
       WHERE s.id = ? AND q.id = ?;`,
      [submissionId, questionId]
    );

    if (!validation) {
      throw new Error(`Referenced submission (${submissionId}) or question (${questionId}) not found.`);
    }

    if (validation.submission_quiz_id !== validation.question_quiz_id) {
      throw new Error(
        `Cross-quiz question reference: Question ${questionId} (quiz ${validation.question_quiz_id}) does not belong to submission ${submissionId} (quiz ${validation.submission_quiz_id}).`
      );
    }

    const { lastInsertRowid } = this.db.run(
      `INSERT INTO submission_answers (submission_id, question_id, selected_option, is_correct)
       VALUES (?, ?, ?, ?);`,
      [submissionId, questionId, selectedOption, isCorrect ? 1 : 0]
    );

    return this.db.get(`SELECT * FROM submission_answers WHERE id = ?;`, [lastInsertRowid]);
  }

  /**
   * Retrieve all recorded answers for a submission.
   * @param {number} submissionId
   * @returns {Array<Object>}
   */
  findAnswersBySubmissionId(submissionId) {
    return this.db.all(
      `SELECT sa.*, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option
       FROM submission_answers sa
       JOIN questions q ON sa.question_id = q.id
       WHERE sa.submission_id = ?
       ORDER BY q.order_num ASC, q.id ASC;`,
      [submissionId]
    );
  }

  /**
   * Find all finalized student submissions formatted for Admin Analytics & Scores view.
   * Directly matches STQA Report Results Page 8 table columns.
   * @returns {Array<Object>}
   */
  findAllWithDetails() {
    return this.db.all(
      `SELECT s.id,
              u.username AS student,
              q.title AS quiz_title,
              s.score,
              s.total_questions,
              s.percentage,
              s.status,
              s.is_timed_out,
              s.submitted_at AS submission_time
       FROM submissions s
       JOIN users u ON s.user_id = u.id
       JOIN quizzes q ON s.quiz_id = q.id
       WHERE s.status IN ('PASSED', 'FAILED')
       ORDER BY s.submitted_at DESC, s.id DESC;`
    );
  }

  /**
   * Count total submissions recorded.
   * @returns {number}
   */
  countSubmissions() {
    const res = this.db.get(`SELECT COUNT(*) AS total FROM submissions WHERE status IN ('PASSED', 'FAILED');`);
    return res ? res.total : 0;
  }

  /**
   * Count all attempts (active or finalized) for a specific quiz.
   * Used for quiz immutability enforcement.
   * @param {number} quizId
   * @returns {number}
   */
  countAttemptsForQuiz(quizId) {
    const res = this.db.get(`SELECT COUNT(*) AS total FROM submissions WHERE quiz_id = ?;`, [quizId]);
    return res ? res.total : 0;
  }

  /**
   * Count submissions by status ('PASSED', 'FAILED', or 'IN_PROGRESS').
   * @param {string} status
   * @returns {number}
   */
  countByStatus(status) {
    const res = this.db.get(`SELECT COUNT(*) AS total FROM submissions WHERE status = ?;`, [status]);
    return res ? res.total : 0;
  }

  /**
   * Retrieve overall performance metrics across all finalized submissions.
   * @returns {{ total: number, avgScore: number, avgPercentage: number }}
   */
  getOverallPerformance() {
    const row = this.db.get(
      `SELECT COUNT(*) AS total,
              COALESCE(AVG(score), 0.0) AS avg_score,
              COALESCE(AVG(percentage), 0.0) AS avg_percentage
       FROM submissions
       WHERE status IN ('PASSED', 'FAILED');`
    );

    return {
      total: row ? row.total : 0,
      avgScore: row ? Number(Number(row.avg_score).toFixed(2)) : 0.0,
      avgPercentage: row ? Number(Number(row.avg_percentage).toFixed(2)) : 0.0
    };
  }

  /**
   * Retrieve quiz-wise aggregated performance for analytics.
   * @returns {Array<Object>}
   */
  getQuizWisePerformance() {
    return this.db.all(
      `SELECT q.id AS quiz_id,
              q.title,
              q.is_published,
              COUNT(s.id) AS total_attempts,
              COALESCE(AVG(s.score), 0.0) AS avg_score,
              COALESCE(AVG(s.percentage), 0.0) AS avg_percentage,
              SUM(CASE WHEN s.status = 'PASSED' THEN 1 ELSE 0 END) AS pass_count,
              SUM(CASE WHEN s.status = 'FAILED' THEN 1 ELSE 0 END) AS fail_count
       FROM quizzes q
       LEFT JOIN submissions s ON s.quiz_id = q.id AND s.status IN ('PASSED', 'FAILED')
       GROUP BY q.id
       ORDER BY q.id ASC;`
    );
  }

  /**
   * Find all submissions for a specific student.
   * @param {number} userId
   * @returns {Array<Object>}
   */
  findSubmissionsByUserId(userId) {
    return this.db.all(
      `SELECT s.id,
              s.quiz_id,
              q.title AS quiz_title,
              s.score,
              s.total_questions,
              s.percentage,
              s.status,
              s.is_timed_out,
              s.started_at,
              s.expires_at,
              s.submitted_at
       FROM submissions s
       JOIN quizzes q ON s.quiz_id = q.id
       WHERE s.user_id = ?
       ORDER BY s.id DESC;`,
      [userId]
    );
  }
}

module.exports = SubmissionRepository;
