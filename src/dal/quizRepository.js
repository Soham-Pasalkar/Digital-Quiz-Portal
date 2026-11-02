/**
 * Quiz & Question Data Access Repository
 * [Category A]: Quiz, Question entities, composition, publishing (OOMD Diagram 2, STQA §2)
 * [Category B]: Configurable duration, 0-indexed correct option
 */

const { DEFAULT_QUIZ_DURATION_MINUTES } = require('../config/constants');

class QuizRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  /**
   * Create a new quiz.
   * @param {Object} quizData
   * @param {string} quizData.title
   * @param {number} [quizData.durationMinutes=10]
   * @param {number} quizData.createdBy - User ID of Admin
   * @param {number} [quizData.isPublished=0]
   * @returns {Object} Created quiz record
   */
  createQuiz({ title, durationMinutes = DEFAULT_QUIZ_DURATION_MINUTES, createdBy, isPublished = 0 }) {
    const { lastInsertRowid } = this.db.run(
      `INSERT INTO quizzes (title, duration_minutes, created_by, is_published) VALUES (?, ?, ?, ?);`,
      [title.trim(), durationMinutes, createdBy, isPublished ? 1 : 0]
    );

    return this.findById(lastInsertRowid);
  }

  /**
   * Add a question to an existing quiz.
   * @param {Object} qData
   * @param {number} qData.quizId
   * @param {string} qData.questionText
   * @param {string} qData.optionA
   * @param {string} qData.optionB
   * @param {string} qData.optionC
   * @param {string} qData.optionD
   * @param {number} qData.correctOption - 0=A, 1=B, 2=C, 3=D
   * @param {number} [qData.orderNum=1]
   * @returns {Object} Inserted question record
   */
  addQuestion({
    quizId,
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    orderNum = 1
  }) {
    const { lastInsertRowid } = this.db.run(
      `INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_num)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        quizId,
        questionText.trim(),
        optionA.trim(),
        optionB.trim(),
        optionC.trim(),
        optionD.trim(),
        Number(correctOption),
        orderNum
      ]
    );

    return this.db.get(`SELECT * FROM questions WHERE id = ?;`, [lastInsertRowid]);
  }

  /**
   * Set is_published to 1 for a quiz.
   * @param {number} quizId
   * @returns {Object|null} Updated quiz record
   */
  publishQuiz(quizId) {
    this.db.run(
      `UPDATE quizzes SET is_published = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [quizId]
    );

    return this.findById(quizId);
  }

  /**
   * Set is_published to 0 for a quiz.
   * @param {number} quizId
   * @returns {Object|null} Updated quiz record
   */
  unpublishQuiz(quizId) {
    this.db.run(
      `UPDATE quizzes SET is_published = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [quizId]
    );

    return this.findById(quizId);
  }

  /**
   * Update quiz title and duration.
   * @param {number} quizId
   * @param {Object} updateData
   * @param {string} [updateData.title]
   * @param {number} [updateData.durationMinutes]
   * @returns {Object|null}
   */
  updateQuiz(quizId, { title, durationMinutes }) {
    const existing = this.findById(quizId);
    if (!existing) return null;

    const newTitle = title !== undefined ? title.trim() : existing.title;
    const newDuration = durationMinutes !== undefined ? durationMinutes : existing.duration_minutes;

    this.db.run(
      `UPDATE quizzes SET title = ?, duration_minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [newTitle, newDuration, quizId]
    );

    return this.findById(quizId);
  }

  /**
   * Delete quiz by primary key ID.
   * @param {number} quizId
   * @returns {boolean}
   */
  deleteQuiz(quizId) {
    const { changes } = this.db.run(`DELETE FROM quizzes WHERE id = ?;`, [quizId]);
    return changes > 0;
  }

  /**
   * Find a specific question by primary key ID.
   * @param {number} questionId
   * @returns {Object|null}
   */
  findQuestionById(questionId) {
    return this.db.get(`SELECT * FROM questions WHERE id = ?;`, [questionId]);
  }

  /**
   * Update question text, options, or correct option.
   * @param {number} questionId
   * @param {Object} qData
   * @returns {Object|null}
   */
  updateQuestion(questionId, { questionText, optionA, optionB, optionC, optionD, correctOption, orderNum }) {
    const existing = this.findQuestionById(questionId);
    if (!existing) return null;

    const newText = questionText !== undefined ? questionText.trim() : existing.question_text;
    const newA = optionA !== undefined ? optionA.trim() : existing.option_a;
    const newB = optionB !== undefined ? optionB.trim() : existing.option_b;
    const newC = optionC !== undefined ? optionC.trim() : existing.option_c;
    const newD = optionD !== undefined ? optionD.trim() : existing.option_d;
    const newCorrect = correctOption !== undefined ? Number(correctOption) : existing.correct_option;
    const newOrder = orderNum !== undefined ? orderNum : existing.order_num;

    this.db.run(
      `UPDATE questions
       SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, order_num = ?
       WHERE id = ?;`,
      [newText, newA, newB, newC, newD, newCorrect, newOrder, questionId]
    );

    return this.findQuestionById(questionId);
  }

  /**
   * Delete a question by primary key ID.
   * @param {number} questionId
   * @returns {boolean}
   */
  deleteQuestion(questionId) {
    const { changes } = this.db.run(`DELETE FROM questions WHERE id = ?;`, [questionId]);
    return changes > 0;
  }

  /**
   * Find quiz by primary key ID.
   * @param {number} id
   * @returns {Object|null}
   */
  findById(id) {
    return this.db.get(
      `SELECT q.id, q.title, q.duration_minutes, q.created_by, q.is_published, q.created_at, q.updated_at,
              u.username AS author
       FROM quizzes q
       JOIN users u ON q.created_by = u.id
       WHERE q.id = ?;`,
      [id]
    );
  }

  /**
   * Find all quizzes, optionally filtering to published-only for student catalog.
   * Includes question count per quiz.
   * @param {Object} [options={}]
   * @param {boolean} [options.publishedOnly=false]
   * @returns {Array<Object>}
   */
  findAll({ publishedOnly = false } = {}) {
    let sql = `
      SELECT q.id, q.title, q.duration_minutes, q.created_by, q.is_published, q.created_at, q.updated_at,
             u.username AS author,
             COUNT(qn.id) AS question_count
      FROM quizzes q
      JOIN users u ON q.created_by = u.id
      LEFT JOIN questions qn ON qn.quiz_id = q.id
    `;

    const params = [];
    if (publishedOnly) {
      sql += ` WHERE q.is_published = 1 `;
    }

    sql += ` GROUP BY q.id ORDER BY q.id DESC;`;

    return this.db.all(sql, params);
  }

  /**
   * Retrieve all questions for a given quiz ID.
   * Note: Contains correct_option. Service layer projection DTO is responsible
   * for stripping correct_option for active student exams.
   * @param {number} quizId
   * @returns {Array<Object>}
   */
  findQuestionsByQuizId(quizId) {
    return this.db.all(
      `SELECT id, quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, order_num
       FROM questions
       WHERE quiz_id = ?
       ORDER BY order_num ASC, id ASC;`,
      [quizId]
    );
  }

  /**
   * Count questions for a given quiz ID.
   * @param {number} quizId
   * @returns {number}
   */
  countQuestions(quizId) {
    const res = this.db.get(`SELECT COUNT(*) AS total FROM questions WHERE quiz_id = ?;`, [quizId]);
    return res ? res.total : 0;
  }

  /**
   * Count total quizzes in system.
   * @returns {number}
   */
  countQuizzes() {
    const res = this.db.get(`SELECT COUNT(*) AS total FROM quizzes;`);
    return res ? res.total : 0;
  }

  /**
   * Count total published quizzes in system.
   * @returns {number}
   */
  countPublishedQuizzes() {
    const res = this.db.get(`SELECT COUNT(*) AS total FROM quizzes WHERE is_published = 1;`);
    return res ? res.total : 0;
  }
}

module.exports = QuizRepository;

