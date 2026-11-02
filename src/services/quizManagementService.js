/**
 * Quiz & Question Management Domain Service
 * [Category A]: Quiz authoring, 4 options, publishing validation, admin review (STQA §1, §2, OOMD Diagram 1, 2)
 * [Category B]: 0-indexed correct option normalization, configurable 10m duration, atomic persistence
 * [Category C]: Answer key projection isolation, quiz immutability once attempts exist
 */

const { DEFAULT_QUIZ_DURATION_MINUTES, ROLES } = require('../config/constants');

class QuizManagementService {
  /**
   * @param {Object} dependencies
   * @param {import('../dal/quizRepository')} dependencies.quizRepo
   * @param {import('../dal/userRepository')} dependencies.userRepo
   * @param {import('../database/db').DatabaseClient} dependencies.dbClient
   * @param {import('../dal/submissionRepository')} [dependencies.submissionRepo]
   */
  constructor({ quizRepo, userRepo, dbClient, submissionRepo }) {
    if (!quizRepo) throw new Error('QuizManagementService requires QuizRepository.');
    if (!userRepo) throw new Error('QuizManagementService requires UserRepository.');
    if (!dbClient) throw new Error('QuizManagementService requires DatabaseClient.');

    this.quizRepo = quizRepo;
    this.userRepo = userRepo;
    this.db = dbClient;
    this.submissionRepo = submissionRepo || null;
  }

  /**
   * Normalize an option representation to internal 0-indexed integer (0..3).
   * Supports 'A'..'D', 'a'..'d', and integers 0..3.
   * 
   * @param {string|number} option
   * @returns {number} 0, 1, 2, or 3
   */
  static normalizeOptionIndex(option) {
    if (typeof option === 'number' && Number.isInteger(option) && option >= 0 && option <= 3) {
      return option;
    }
    if (typeof option === 'string') {
      const upper = option.trim().toUpperCase();
      switch (upper) {
        case 'A': return 0;
        case 'B': return 1;
        case 'C': return 2;
        case 'D': return 3;
        case '0': return 0;
        case '1': return 1;
        case '2': return 2;
        case '3': return 3;
      }
    }
    throw new Error(`Invalid correctOption: "${option}". Must be 0, 1, 2, 3 or 'A', 'B', 'C', 'D'.`);
  }

  /**
   * Convert internal 0-indexed option to display letter (A..D).
   * @param {number} index
   * @returns {string}
   */
  static indexToLetter(index) {
    switch (index) {
      case 0: return 'A';
      case 1: return 'B';
      case 2: return 'C';
      case 3: return 'D';
      default: return 'Unattempted';
    }
  }

  /**
   * Validate that an admin user exists and holds the 'admin' role.
   * @param {number} userId
   * @private
   */
  _assertAdmin(userId) {
    const user = this.userRepo.findById(userId);
    if (!user || user.role !== ROLES.ADMIN) {
      throw new Error('Access denied: Action requires Administrator privileges.');
    }
  }

  /**
   * Guard: Prevent modification of published quiz questions or scoring/duration once attempts exist.
   * [Prerequisite 1: Quiz Immutability]
   * @param {number} quizId
   * @param {string} actionDescription
   * @private
   */
  _assertQuizMutable(quizId, actionDescription = 'modify quiz') {
    if (this.submissionRepo) {
      const attemptsCount = this.submissionRepo.countAttemptsForQuiz(quizId);
      if (attemptsCount > 0) {
        throw new Error(`Cannot ${actionDescription}: Quiz has existing examination attempts.`);
      }
    }
  }

  /**
   * Create a new draft or published quiz.
   * 
   * @param {Object} quizData
   * @param {string} quizData.title
   * @param {number} [quizData.durationMinutes=10]
   * @param {number} quizData.createdBy - Admin user ID
   * @param {Array<Object>} [quizData.questions=[]] - Initial questions array
   * @returns {Object} Created quiz record
   */
  createQuiz({ title, durationMinutes = DEFAULT_QUIZ_DURATION_MINUTES, createdBy, questions = [] }) {
    this._assertAdmin(createdBy);

    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new Error('Quiz title is required and cannot be empty.');
    }

    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration <= 0) {
      throw new Error('Duration must be a positive integer in minutes.');
    }

    const quiz = this.quizRepo.createQuiz({
      title: title.trim(),
      durationMinutes: duration,
      createdBy,
      isPublished: 0
    });

    // If initial questions provided, add and validate each
    if (Array.isArray(questions) && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        this.addQuestion(quiz.id, {
          questionText: q.questionText || q.text,
          options: q.options,
          correctOption: q.correctOption,
          orderNum: q.orderNum || i + 1
        }, createdBy);
      }
    }

    this.db.save();
    return this.quizRepo.findById(quiz.id);
  }

  /**
   * Update quiz metadata (title, duration).
   * Prevents duration/scoring modification if attempts exist.
   * 
   * @param {number} quizId
   * @param {Object} updateData
   * @param {string} [updateData.title]
   * @param {number} [updateData.durationMinutes]
   * @param {number} adminUserId
   * @returns {Object} Updated quiz record
   */
  updateQuiz(quizId, { title, durationMinutes }, adminUserId) {
    this._assertAdmin(adminUserId);

    const quiz = this.quizRepo.findById(quizId);
    if (!quiz) {
      throw new Error(`Quiz with ID ${quizId} not found.`);
    }

    if (durationMinutes !== undefined && durationMinutes !== quiz.duration_minutes) {
      this._assertQuizMutable(quizId, 'modify scoring configuration or duration');
      const dur = Number(durationMinutes);
      if (!Number.isInteger(dur) || dur <= 0) {
        throw new Error('Duration must be a positive integer in minutes.');
      }
    }

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        throw new Error('Quiz title cannot be empty.');
      }
    }

    const updated = this.quizRepo.updateQuiz(quizId, { title, durationMinutes });
    this.db.save();
    return updated;
  }

  /**
   * Delete quiz by ID.
   * Enforces that quizzes with attempts cannot be deleted.
   * 
   * @param {number} quizId
   * @param {number} adminUserId
   * @returns {boolean}
   */
  deleteQuiz(quizId, adminUserId) {
    this._assertAdmin(adminUserId);

    const quiz = this.quizRepo.findById(quizId);
    if (!quiz) {
      throw new Error(`Quiz with ID ${quizId} not found.`);
    }

    this._assertQuizMutable(quizId, 'delete quiz');

    const success = this.quizRepo.deleteQuiz(quizId);
    if (success) {
      this.db.save();
    }
    return success;
  }

  /**
   * Add a question to an existing quiz.
   * Enforces 4 non-empty options, validates correctOption, and guards immutability.
   * 
   * @param {number} quizId
   * @param {Object} questionData
   * @param {string} questionData.questionText
   * @param {Array<string>} questionData.options - Array of exactly 4 strings [A, B, C, D]
   * @param {string|number} questionData.correctOption - 'A'..'D' or 0..3
   * @param {number} [questionData.orderNum]
   * @param {number} adminUserId
   * @returns {Object} Created question record
   */
  addQuestion(quizId, { questionText, options, correctOption, orderNum }, adminUserId) {
    this._assertAdmin(adminUserId);

    const quiz = this.quizRepo.findById(quizId);
    if (!quiz) {
      throw new Error(`Quiz with ID ${quizId} not found.`);
    }

    this._assertQuizMutable(quizId, 'add questions');

    if (!questionText || typeof questionText !== 'string' || !questionText.trim()) {
      throw new Error('Question text is required and cannot be empty.');
    }

    if (!Array.isArray(options) || options.length !== 4) {
      throw new Error('Exactly four answer options (A, B, C, D) are required.');
    }

    for (let i = 0; i < options.length; i++) {
      if (!options[i] || typeof options[i] !== 'string' || !options[i].trim()) {
        throw new Error(`Option ${QuizManagementService.indexToLetter(i)} cannot be empty.`);
      }
    }

    const normalizedCorrect = QuizManagementService.normalizeOptionIndex(correctOption);
    const count = this.quizRepo.countQuestions(quizId);
    const order = orderNum !== undefined ? Number(orderNum) : count + 1;

    const question = this.quizRepo.addQuestion({
      quizId,
      questionText: questionText.trim(),
      optionA: options[0].trim(),
      optionB: options[1].trim(),
      optionC: options[2].trim(),
      optionD: options[3].trim(),
      correctOption: normalizedCorrect,
      orderNum: order
    });

    this.db.save();
    return question;
  }

  /**
   * Update an existing question.
   * Prevents question changes if attempts exist for the quiz.
   * 
   * @param {number} questionId
   * @param {Object} updateData
   * @param {number} adminUserId
   * @returns {Object} Updated question
   */
  updateQuestion(questionId, { questionText, options, correctOption, orderNum }, adminUserId) {
    this._assertAdmin(adminUserId);

    const existing = this.quizRepo.findQuestionById(questionId);
    if (!existing) {
      throw new Error(`Question with ID ${questionId} not found.`);
    }

    this._assertQuizMutable(existing.quiz_id, 'modify questions');

    let optA, optB, optC, optD;
    if (options !== undefined) {
      if (!Array.isArray(options) || options.length !== 4) {
        throw new Error('Exactly four answer options (A, B, C, D) are required.');
      }
      for (let i = 0; i < options.length; i++) {
        if (!options[i] || typeof options[i] !== 'string' || !options[i].trim()) {
          throw new Error(`Option ${QuizManagementService.indexToLetter(i)} cannot be empty.`);
        }
      }
      optA = options[0].trim();
      optB = options[1].trim();
      optC = options[2].trim();
      optD = options[3].trim();
    }

    let normalizedCorrect;
    if (correctOption !== undefined) {
      normalizedCorrect = QuizManagementService.normalizeOptionIndex(correctOption);
    }

    if (questionText !== undefined && (!questionText || typeof questionText !== 'string' || !questionText.trim())) {
      throw new Error('Question text cannot be empty.');
    }

    const updated = this.quizRepo.updateQuestion(questionId, {
      questionText,
      optionA: optA,
      optionB: optB,
      optionC: optC,
      optionD: optD,
      correctOption: normalizedCorrect,
      orderNum
    });

    this.db.save();
    return updated;
  }

  /**
   * Delete a question from a quiz.
   * Prevents question deletion if attempts exist for the quiz.
   * 
   * @param {number} questionId
   * @param {number} adminUserId
   * @returns {boolean}
   */
  deleteQuestion(questionId, adminUserId) {
    this._assertAdmin(adminUserId);

    const question = this.quizRepo.findQuestionById(questionId);
    if (!question) {
      throw new Error(`Question with ID ${questionId} not found.`);
    }

    this._assertQuizMutable(question.quiz_id, 'delete questions');

    const success = this.quizRepo.deleteQuestion(questionId);
    if (success) {
      this.db.save();
    }
    return success;
  }

  /**
   * Publish a quiz, making it accessible to students.
   * [Category A - STQA TC-06]: Strictly enforces that a quiz without questions cannot be published.
   * 
   * @param {number} quizId
   * @param {number} adminUserId
   * @returns {Object} Published quiz record
   */
  publishQuiz(quizId, adminUserId) {
    this._assertAdmin(adminUserId);

    const quiz = this.quizRepo.findById(quizId);
    if (!quiz) {
      throw new Error(`Quiz with ID ${quizId} not found.`);
    }

    const questionCount = this.quizRepo.countQuestions(quizId);
    if (questionCount === 0) {
      throw new Error('Cannot publish an empty quiz without questions.');
    }

    const published = this.quizRepo.publishQuiz(quizId);
    this.db.save();
    return published;
  }

  /**
   * Unpublish an active quiz, returning it to draft state.
   * Note: Existing examination attempts remain completely valid and can be finished.
   * 
   * @param {number} quizId
   * @param {number} adminUserId
   * @returns {Object} Unpublished quiz record
   */
  unpublishQuiz(quizId, adminUserId) {
    this._assertAdmin(adminUserId);

    const quiz = this.quizRepo.findById(quizId);
    if (!quiz) {
      throw new Error(`Quiz with ID ${quizId} not found.`);
    }

    const unpublished = this.quizRepo.unpublishQuiz(quizId);
    this.db.save();
    return unpublished;
  }

  /**
   * Retrieve all published quizzes for the student catalog.
   * [Category C]: Excludes all internal answer keys and draft items.
   * 
   * @returns {Array<Object>}
   */
  getPublishedQuizzes() {
    const list = this.quizRepo.findAll({ publishedOnly: true });
    return list.map(q => ({
      id: q.id,
      title: q.title,
      durationMinutes: q.duration_minutes,
      duration_minutes: q.duration_minutes,
      questionCount: q.question_count,
      question_count: q.question_count,
      createdAt: q.created_at
    }));
  }

  /**
   * Retrieve quiz questions for an active examination attempt.
   * [Category C Answer-Key Protection]: Strips correct_option completely.
   * 
   * @param {number} quizId
   * @returns {{ id: number, title: string, durationMinutes: number, questions: Array<Object> }}
   */
  getQuizForAttempt(quizId) {
    const quiz = this.quizRepo.findById(quizId);
    if (!quiz) {
      throw new Error(`Quiz with ID ${quizId} not found.`);
    }
    if (quiz.is_published !== 1) {
      throw new Error('Quiz is not published or currently unavailable.');
    }

    const rawQuestions = this.quizRepo.findQuestionsByQuizId(quizId);
    if (rawQuestions.length === 0) {
      throw new Error('Quiz has no questions configured.');
    }

    // Project DTO: Strip correct_option!
    const sanitizedQuestions = rawQuestions.map(q => ({
      id: q.id,
      questionText: q.question_text,
      question_text: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      orderNum: q.order_num
    }));

    return {
      id: quiz.id,
      title: quiz.title,
      durationMinutes: quiz.duration_minutes,
      questions: sanitizedQuestions
    };
  }

  /**
   * Retrieve all quizzes (draft and published) for Admin management.
   * 
   * @param {number} adminUserId
   * @returns {Array<Object>}
   */
  getAllQuizzesForAdmin(adminUserId) {
    this._assertAdmin(adminUserId);
    return this.quizRepo.findAll({ publishedOnly: false });
  }

  /**
   * Retrieve complete quiz details including full questions and correct answer keys for Admin review.
   * 
   * @param {number} quizId
   * @param {number} adminUserId
   * @returns {Object}
   */
  getQuizDetailsForAdmin(quizId, adminUserId) {
    this._assertAdmin(adminUserId);

    const quiz = this.quizRepo.findById(quizId);
    if (!quiz) {
      throw new Error(`Quiz with ID ${quizId} not found.`);
    }

    const questions = this.quizRepo.findQuestionsByQuizId(quizId).map(q => ({
      id: q.id,
      questionText: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      correctOption: q.correct_option,
      correctOptionLetter: QuizManagementService.indexToLetter(q.correct_option),
      orderNum: q.order_num
    }));

    return {
      ...quiz,
      questions
    };
  }
}

module.exports = QuizManagementService;
