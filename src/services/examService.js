/**
 * Examination Attempt & Timer Lifecycle Domain Service
 * [Category A]: Student exam flow, deterministic scoring, immediate results, answer key reveal (STQA §1, §3)
 * [Category B]: Server-generated timestamps, 10m default duration, 30s grace period, timeout flag, idempotent finalization
 * [Category C]: Strict attempt ownership validation, server receipt time enforcement, answer key projection
 */

const { GRACE_PERIOD_SECONDS, ATTEMPT_STATUS, ROLES } = require('../config/constants');
const ScoringService = require('./scoringService');

class ExamService {
  /**
   * @param {Object} dependencies
   * @param {import('../dal/submissionRepository')} dependencies.submissionRepo
   * @param {import('../dal/quizRepository')} dependencies.quizRepo
   * @param {import('../dal/userRepository')} dependencies.userRepo
   * @param {ScoringService} dependencies.scoringService
   * @param {import('../database/db').DatabaseClient} dependencies.dbClient
   * @param {() => Date} [dependencies.clock=() => new Date()] - Injectable server-side clock [Prerequisite 2]
   */
  constructor({ submissionRepo, quizRepo, userRepo, scoringService, dbClient, clock = () => new Date() }) {
    if (!submissionRepo) throw new Error('ExamService requires SubmissionRepository.');
    if (!quizRepo) throw new Error('ExamService requires QuizRepository.');
    if (!userRepo) throw new Error('ExamService requires UserRepository.');
    if (!scoringService) throw new Error('ExamService requires ScoringService.');
    if (!dbClient) throw new Error('ExamService requires DatabaseClient.');

    this.submissionRepo = submissionRepo;
    this.quizRepo = quizRepo;
    this.userRepo = userRepo;
    this.scoringService = scoringService;
    this.db = dbClient;
    this.clock = clock;
  }

  /**
   * Start a new examination attempt or resume an existing active ('IN_PROGRESS') attempt.
   * Server generates started_at and expires_at timestamps using server clock.
   * Note: If an active attempt already exists, student may resume even if the quiz is now unpublished.
   * 
   * @param {Object} params
   * @param {number} params.quizId
   * @param {number} params.userId
   * @param {Date} [params.now] - Optional override for testing
   * @returns {Object} Attempt record with timing metadata
   */
  startOrResumeAttempt({ quizId, userId, now }) {
    // 1. Validate user and role
    const user = this.userRepo.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found.`);
    }
    if (user.role !== ROLES.STUDENT) {
      throw new Error('Only registered students may attempt examinations.');
    }

    // 2. Validate quiz existence
    const quiz = this.quizRepo.findById(quizId);
    if (!quiz) {
      throw new Error(`Quiz with ID ${quizId} not found.`);
    }

    const currentTime = now !== undefined ? (now instanceof Date ? now : new Date(now)) : this.clock();

    // 3. Check for existing active attempt (Concurrency & Resumption guard)
    const existingAttempt = this.submissionRepo.findActiveAttempt(quizId, userId);
    if (existingAttempt) {
      const expiresAt = new Date(existingAttempt.expires_at);
      const graceExpiresAt = new Date(expiresAt.getTime() + GRACE_PERIOD_SECONDS * 1000);

      // If active attempt has already expired past the grace period without submission, finalize as FAILED
      if (currentTime > graceExpiresAt) {
        const questionCount = this.quizRepo.countQuestions(quizId);
        this.submissionRepo.finalizeSubmission(existingAttempt.id, {
          totalQuestions: questionCount,
          score: 0,
          percentage: 0.0,
          status: ATTEMPT_STATUS.FAILED,
          isTimedOut: 1,
          submittedAt: graceExpiresAt.toISOString()
        });
        this.db.save();
        // Proceed to attempt creation below
      } else {
        // Return existing attempt for resumption (valid even if quiz was unpublished in interim)
        const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - currentTime.getTime()) / 1000));
        return {
          attemptId: existingAttempt.id,
          quizId: existingAttempt.quiz_id,
          quizTitle: existingAttempt.quiz_title,
          durationMinutes: quiz.duration_minutes,
          startedAt: existingAttempt.started_at,
          expiresAt: existingAttempt.expires_at,
          remainingSeconds,
          isResumed: true
        };
      }
    }

    // 4. For new attempts: Verify quiz is published and has questions
    if (quiz.is_published !== 1) {
      throw new Error('This quiz is not currently published or available for examination.');
    }

    const questionCount = this.quizRepo.countQuestions(quizId);
    if (questionCount === 0) {
      throw new Error('Cannot attempt an empty quiz without questions.');
    }

    // 5. Create fresh attempt with server-side timestamps
    const startedAt = currentTime.toISOString();
    const expiresAt = new Date(currentTime.getTime() + quiz.duration_minutes * 60 * 1000).toISOString();

    const attempt = this.submissionRepo.createAttempt({
      quizId,
      userId,
      startedAt,
      expiresAt
    });

    this.db.save();

    return {
      attemptId: attempt.id,
      quizId: attempt.quiz_id,
      quizTitle: attempt.quiz_title,
      durationMinutes: quiz.duration_minutes,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      remainingSeconds: quiz.duration_minutes * 60,
      isResumed: false
    };
  }

  /**
   * Retrieve questions for an active examination attempt.
   * [Category C Answer Key Protection]: Ensures correct_option is NEVER returned.
   * 
   * @param {number} attemptId
   * @param {number} userId
   * @param {Date} [now]
   * @returns {Object} Attempt info and sanitized questions
   */
  getAttemptQuestions(attemptId, userId, now) {
    const attempt = this.submissionRepo.findById(attemptId);
    if (!attempt) {
      throw new Error(`Attempt with ID ${attemptId} not found.`);
    }

    // Attempt ownership validation
    if (attempt.user_id !== userId) {
      throw new Error('Access denied: You are not authorized to view this examination attempt.');
    }

    if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
      throw new Error(`Examination attempt is already finalized with status: ${attempt.status}.`);
    }

    const currentTime = now !== undefined ? (now instanceof Date ? now : new Date(now)) : this.clock();
    const expiresAt = new Date(attempt.expires_at);
    const graceExpiresAt = new Date(expiresAt.getTime() + GRACE_PERIOD_SECONDS * 1000);

    // If attempt has expired past the grace window, finalize as FAILED and reject question retrieval
    if (currentTime > graceExpiresAt) {
      const questionCount = this.quizRepo.countQuestions(attempt.quiz_id);
      this.submissionRepo.finalizeSubmission(attempt.id, {
        totalQuestions: questionCount,
        score: 0,
        percentage: 0.0,
        status: ATTEMPT_STATUS.FAILED,
        isTimedOut: 1,
        submittedAt: graceExpiresAt.toISOString()
      });
      this.db.save();

      const timeoutError = new Error('Examination attempt has expired beyond the 30-second grace period and cannot be accessed.');
      timeoutError.isTimedOut = true;
      timeoutError.status = ATTEMPT_STATUS.FAILED;
      throw timeoutError;
    }

    const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - currentTime.getTime()) / 1000));

    // Retrieve and sanitize questions (both camelCase and snake_case projections without answer keys)
    const rawQuestions = this.quizRepo.findQuestionsByQuizId(attempt.quiz_id);
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
      attemptId: attempt.id,
      quizId: attempt.quiz_id,
      quizTitle: attempt.quiz_title,
      startedAt: attempt.started_at,
      expiresAt: attempt.expires_at,
      remainingSeconds,
      totalQuestions: sanitizedQuestions.length,
      questions: sanitizedQuestions
    };
  }

  /**
   * Submit student answers for an examination attempt.
   * Implements strict server-side timer validation:
   * 1. On-time receipt (now <= expiresAt): Accepted normally (isTimedOut = 0).
   * 2. Grace period receipt (expiresAt < now <= expiresAt + 30s): Accepted with isTimedOut = 1, full score calculation.
   * 3. Post-grace expiration (now > expiresAt + 30s): Rejected with timeout finalization.
   * 4. Idempotency guarantee: finalized attempts return pre-computed scores without duplicate grading or persistence.
   * 
   * [Prerequisite 2]: Uses server clock exclusively; client-supplied receipt timestamps are NEVER accepted.
   * 
   * @param {Object} params
   * @param {number} params.attemptId
   * @param {number} params.userId
   * @param {Object} params.answers - Map of { [questionId]: selectedOption }
   * @param {Date} [params.receiptTime] - Optional clock override for testing
   * @returns {Object} Finalized examination results with detailed question feedback
   */
  submitAttempt({ attemptId, userId, answers = {}, receiptTime }) {
    const attempt = this.submissionRepo.findById(attemptId);
    if (!attempt) {
      throw new Error(`Attempt with ID ${attemptId} not found.`);
    }

    // Ownership check
    if (attempt.user_id !== userId) {
      throw new Error('Access denied: You are not authorized to submit this examination attempt.');
    }

    // Idempotency check: if already finalized, return existing recorded results
    if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
      const existingAnswers = this.submissionRepo.findAnswersBySubmissionId(attempt.id);
      const breakdown = existingAnswers.map(ans => ({
        questionId: ans.question_id,
        questionText: ans.question_text,
        selectedOption: ans.selected_option,
        selectedOptionLetter: ScoringService.indexToLetter(ans.selected_option),
        correctOption: ans.correct_option,
        correctOptionLetter: ScoringService.indexToLetter(ans.correct_option),
        isCorrect: ans.is_correct === 1,
        options: {
          A: ans.option_a,
          B: ans.option_b,
          C: ans.option_c,
          D: ans.option_d
        }
      }));

      return {
        attemptId: attempt.id,
        quizId: attempt.quiz_id,
        quizTitle: attempt.quiz_title,
        totalQuestions: attempt.total_questions,
        score: attempt.score,
        percentage: attempt.percentage,
        status: attempt.status,
        isTimedOut: attempt.is_timed_out === 1,
        submittedAt: attempt.submitted_at,
        alreadyFinalized: true,
        breakdown
      };
    }

    // Server-side receipt timestamp from injected clock (strictly ignoring client timestamps)
    const serverNow = receiptTime !== undefined
      ? (receiptTime instanceof Date ? receiptTime : new Date(receiptTime))
      : this.clock();

    const expiresAt = new Date(attempt.expires_at);
    const graceExpiresAt = new Date(expiresAt.getTime() + GRACE_PERIOD_SECONDS * 1000);

    // Timer Evaluation:
    // Case 1: Post-grace expiration
    if (serverNow > graceExpiresAt) {
      this.submissionRepo.finalizeSubmission(attempt.id, {
        totalQuestions: this.quizRepo.countQuestions(attempt.quiz_id),
        score: 0,
        percentage: 0.0,
        status: ATTEMPT_STATUS.FAILED,
        isTimedOut: 1,
        submittedAt: serverNow.toISOString()
      });
      this.db.save();

      const timeoutError = new Error('Examination attempt has expired beyond the 30-second grace period and cannot be accepted.');
      timeoutError.isTimedOut = true;
      timeoutError.status = ATTEMPT_STATUS.FAILED;
      timeoutError.score = 0;
      timeoutError.percentage = 0.0;
      throw timeoutError;
    }

    // Case 2 & 3: Valid submission (either on-time or within 30-second grace period)
    const isTimedOut = serverNow > expiresAt ? 1 : 0;

    // Retrieve authoritative questions with answer keys
    const questions = this.quizRepo.findQuestionsByQuizId(attempt.quiz_id);

    // Grade answers using deterministic ScoringService
    const evaluation = this.scoringService.evaluateSubmission(questions, answers);

    // Record each question answer into submission_answers audit table
    for (const item of evaluation.breakdown) {
      this.submissionRepo.recordAnswer({
        submissionId: attempt.id,
        questionId: item.questionId,
        selectedOption: item.selectedOption,
        isCorrect: item.isCorrect ? 1 : 0
      });
    }

    // Finalize submission record
    const finalized = this.submissionRepo.finalizeSubmission(attempt.id, {
      totalQuestions: evaluation.totalQuestions,
      score: evaluation.score,
      percentage: evaluation.percentage,
      status: evaluation.status,
      isTimedOut,
      submittedAt: serverNow.toISOString()
    });

    // Atomically persist state
    this.db.save();

    return {
      attemptId: finalized.id,
      quizId: finalized.quiz_id,
      quizTitle: finalized.quiz_title,
      totalQuestions: finalized.total_questions,
      score: finalized.score,
      percentage: finalized.percentage,
      status: finalized.status,
      isTimedOut: finalized.is_timed_out === 1,
      submittedAt: finalized.submitted_at,
      alreadyFinalized: false,
      breakdown: evaluation.breakdown
    };
  }

  /**
   * Retrieve finalized submission details and question breakdown for a student.
   * 
   * @param {number} submissionId
   * @param {number} userId
   * @returns {Object}
   */
  getSubmissionDetails(submissionId, userId) {
    const submission = this.submissionRepo.findById(submissionId);
    if (!submission) {
      throw new Error(`Submission with ID ${submissionId} not found.`);
    }

    if (submission.user_id !== userId) {
      throw new Error('Access denied: You are not authorized to view this submission.');
    }

    const answers = this.submissionRepo.findAnswersBySubmissionId(submissionId);
    const breakdown = answers.map(ans => ({
      questionId: ans.question_id,
      questionText: ans.question_text,
      selectedOption: ans.selected_option,
      selectedOptionLetter: ScoringService.indexToLetter(ans.selected_option),
      correctOption: ans.correct_option,
      correctOptionLetter: ScoringService.indexToLetter(ans.correct_option),
      isCorrect: ans.is_correct === 1,
      options: {
        A: ans.option_a,
        B: ans.option_b,
        C: ans.option_c,
        D: ans.option_d
      }
    }));

    return {
      ...submission,
      isTimedOut: submission.is_timed_out === 1,
      breakdown
    };
  }

  /**
   * Retrieve examination history for a specific student.
   * @param {number} userId
   * @returns {Array<Object>}
   */
  getStudentHistory(userId) {
    return this.submissionRepo.findSubmissionsByUserId(userId);
  }
}

module.exports = ExamService;
