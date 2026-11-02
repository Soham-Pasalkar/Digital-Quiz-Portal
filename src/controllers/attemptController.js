/**
 * Student Examination Attempt & Submission REST API Controller
 * [Category A]: Attempt initialization, questions retrieval, submission grading, results (STQA §1, §3)
 * [Category B]: Active attempt resumption, grace period flag, idempotency guarantee
 * [Category C]: Server receipt time integrity (Prerequisite 2), attempt ownership, answer key protection
 */

class AttemptController {
  /**
   * @param {import('../services/examService')} examService
   */
  constructor(examService) {
    this.examService = examService;
  }

  /**
   * POST /api/quizzes/:id/attempts
   * Start or resume an examination attempt for the authenticated student.
   */
  startOrResumeAttempt = (req, res, next) => {
    try {
      const quizId = parseInt(req.params.id, 10);
      if (isNaN(quizId)) {
        return res.status(400).json({ error: 'Invalid quiz ID.' });
      }

      const attempt = this.examService.startOrResumeAttempt({
        quizId,
        userId: req.user.id
      });

      const statusCode = attempt.isResumed ? 200 : 201;
      return res.status(statusCode).json({
        success: true,
        ...attempt,
        attempt: {
          id: attempt.attemptId,
          quiz_id: attempt.quizId,
          quiz_title: attempt.quizTitle,
          duration_minutes: attempt.durationMinutes,
          started_at: attempt.startedAt,
          expires_at: attempt.expiresAt,
          remaining_seconds: attempt.remainingSeconds,
          is_resumed: attempt.isResumed
        }
      });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message && (err.message.includes('not currently published') || err.message.includes('empty quiz'))) {
        return res.status(400).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * GET /api/attempts/:attemptId/questions
   * Retrieve questions for an in-progress attempt.
   * Answer keys (correct_option) are strictly hidden.
   */
  getAttemptQuestions = (req, res, next) => {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      if (isNaN(attemptId)) {
        return res.status(400).json({ error: 'Invalid attempt ID.' });
      }

      const data = this.examService.getAttemptQuestions(attemptId, req.user.id);
      return res.status(200).json({
        success: true,
        ...data
      });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message && err.message.includes('Access denied')) {
        return res.status(403).json({ error: err.message });
      }
      if (err.message && err.message.includes('already finalized')) {
        return res.status(400).json({ error: err.message });
      }
      if (err.isTimedOut || (err.message && err.message.includes('expired beyond the 30-second grace period'))) {
        return res.status(400).json({
          error: err.message,
          isTimedOut: true,
          status: 'FAILED'
        });
      }
      next(err);
    }
  };

  /**
   * POST /api/attempts/:attemptId/submit
   * Submit examination answers for grading.
   * [Prerequisite 2 Server Timestamp Integrity]:
   * NEVER accepts receiptTime from req.body; utilizes server clock exclusively.
   */
  submitAttempt = (req, res, next) => {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      if (isNaN(attemptId)) {
        return res.status(400).json({ error: 'Invalid attempt ID.' });
      }

      const { answers } = req.body || {};

      // Notice: receiptTime is deliberately omitted so ExamService uses its server clock
      const result = this.examService.submitAttempt({
        attemptId,
        userId: req.user.id,
        answers: answers || {}
      });

      return res.status(200).json({
        success: true,
        ...result,
        submission: result
      });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message && err.message.includes('Access denied')) {
        return res.status(403).json({ error: err.message });
      }
      if (err.isTimedOut || (err.message && err.message.includes('expired beyond the 30-second grace period'))) {
        return res.status(400).json({
          error: err.message,
          isTimedOut: true,
          status: 'FAILED',
          score: 0,
          percentage: 0.0
        });
      }
      next(err);
    }
  };

  /**
   * GET /api/attempts/:attemptId/results
   * Retrieve finalized submission results and question feedback for student.
   */
  getAttemptResults = (req, res, next) => {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      if (isNaN(attemptId)) {
        return res.status(400).json({ error: 'Invalid attempt ID.' });
      }

      const results = this.examService.getSubmissionDetails(attemptId, req.user.id);
      return res.status(200).json({
        success: true,
        submission: results
      });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message && err.message.includes('Access denied')) {
        return res.status(403).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * GET /api/attempts/history
   * Retrieve list of past examination submissions for authenticated student.
   */
  getStudentHistory = (req, res, next) => {
    try {
      const submissions = this.examService.getStudentHistory(req.user.id);
      return res.status(200).json({
        success: true,
        submissions,
        history: submissions
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AttemptController;

