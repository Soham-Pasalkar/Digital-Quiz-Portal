/**
 * Quiz & Question REST API Controller
 * [Category A]: Quiz authoring, publishing, catalog, question management (STQA §1, §2, OOMD Diagram 1, 2)
 * [Category B]: Option normalization, empty quiz rejection (TC-06)
 * [Category C]: Answer key isolation, quiz immutability enforcement
 */

class QuizController {
  /**
   * @param {import('../services/quizManagementService')} quizService
   */
  constructor(quizService) {
    this.quizService = quizService;
  }

  /**
   * GET /api/quizzes/available
   * Student endpoint: lists published quizzes only.
   */
  getAvailableQuizzes = (req, res, next) => {
    try {
      const quizzes = this.quizService.getPublishedQuizzes();
      return res.status(200).json({ success: true, quizzes });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/quizzes
   * Admin endpoint: creates a new quiz.
   */
  createQuiz = (req, res, next) => {
    try {
      const { title, durationMinutes, questions } = req.body || {};
      const quiz = this.quizService.createQuiz({
        title,
        durationMinutes,
        createdBy: req.user.id,
        questions
      });
      return res.status(201).json({ success: true, quiz });
    } catch (err) {
      if (this._isValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * GET /api/quizzes
   * Admin endpoint: lists all quizzes (draft & published).
   */
  getAllQuizzes = (req, res, next) => {
    try {
      const quizzes = this.quizService.getAllQuizzesForAdmin(req.user.id);
      return res.status(200).json({ success: true, quizzes });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/quizzes/:id
   * Admin endpoint: retrieves full quiz details including answer keys.
   */
  getQuizById = (req, res, next) => {
    try {
      const quizId = parseInt(req.params.id, 10);
      if (isNaN(quizId)) {
        return res.status(400).json({ error: 'Invalid quiz ID.' });
      }

      const quiz = this.quizService.getQuizDetailsForAdmin(quizId, req.user.id);
      return res.status(200).json({ success: true, quiz });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * PUT /api/quizzes/:id
   * Admin endpoint: updates quiz metadata.
   */
  updateQuiz = (req, res, next) => {
    try {
      const quizId = parseInt(req.params.id, 10);
      if (isNaN(quizId)) {
        return res.status(400).json({ error: 'Invalid quiz ID.' });
      }

      const { title, durationMinutes } = req.body || {};
      const updated = this.quizService.updateQuiz(quizId, { title, durationMinutes }, req.user.id);
      return res.status(200).json({ success: true, quiz: updated });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (this._isValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * DELETE /api/quizzes/:id
   * Admin endpoint: deletes a quiz.
   */
  deleteQuiz = (req, res, next) => {
    try {
      const quizId = parseInt(req.params.id, 10);
      if (isNaN(quizId)) {
        return res.status(400).json({ error: 'Invalid quiz ID.' });
      }

      const success = this.quizService.deleteQuiz(quizId, req.user.id);
      return res.status(200).json({ success, message: 'Quiz deleted successfully.' });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (this._isValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * POST /api/quizzes/:id/questions
   * Admin endpoint: adds a question to an existing quiz.
   */
  addQuestion = (req, res, next) => {
    try {
      const quizId = parseInt(req.params.id, 10);
      if (isNaN(quizId)) {
        return res.status(400).json({ error: 'Invalid quiz ID.' });
      }

      const { questionText, text, options, correctOption, orderNum } = req.body || {};
      const question = this.quizService.addQuestion(quizId, {
        questionText: questionText || text,
        options,
        correctOption,
        orderNum
      }, req.user.id);

      return res.status(201).json({ success: true, question });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (this._isValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * PUT /api/questions/:id
   * Admin endpoint: updates a question.
   */
  updateQuestion = (req, res, next) => {
    try {
      const questionId = parseInt(req.params.id, 10);
      if (isNaN(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID.' });
      }

      const { questionText, text, options, correctOption, orderNum } = req.body || {};
      const updated = this.quizService.updateQuestion(questionId, {
        questionText: questionText || text,
        options,
        correctOption,
        orderNum
      }, req.user.id);

      return res.status(200).json({ success: true, question: updated });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (this._isValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * DELETE /api/questions/:id
   * Admin endpoint: deletes a question.
   */
  deleteQuestion = (req, res, next) => {
    try {
      const questionId = parseInt(req.params.id, 10);
      if (isNaN(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID.' });
      }

      const success = this.quizService.deleteQuestion(questionId, req.user.id);
      return res.status(200).json({ success, message: 'Question deleted successfully.' });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (this._isValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * POST /api/quizzes/:id/publish
   * Admin endpoint: publishes a quiz.
   */
  publishQuiz = (req, res, next) => {
    try {
      const quizId = parseInt(req.params.id, 10);
      if (isNaN(quizId)) {
        return res.status(400).json({ error: 'Invalid quiz ID.' });
      }

      const published = this.quizService.publishQuiz(quizId, req.user.id);
      return res.status(200).json({ success: true, quiz: published });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (this._isValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * POST /api/quizzes/:id/unpublish
   * Admin endpoint: unpublishes a quiz.
   */
  unpublishQuiz = (req, res, next) => {
    try {
      const quizId = parseInt(req.params.id, 10);
      if (isNaN(quizId)) {
        return res.status(400).json({ error: 'Invalid quiz ID.' });
      }

      const unpublished = this.quizService.unpublishQuiz(quizId, req.user.id);
      return res.status(200).json({ success: true, quiz: unpublished });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      next(err);
    }
  };

  _isValidationError(err) {
    if (!err || !err.message) return false;
    const msg = err.message.toLowerCase();
    return (
      msg.includes('required') ||
      msg.includes('empty') ||
      msg.includes('cannot') ||
      msg.includes('exactly four') ||
      msg.includes('invalid') ||
      msg.includes('positive integer')
    );
  }
}

module.exports = QuizController;

