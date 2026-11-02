/**
 * Student Examination Attempt Route Definitions
 * Base Path: /api/attempts
 */

const express = require('express');
const { requireStudent } = require('../middleware/authMiddleware');

function createAttemptRoutes({ attemptController, authMiddleware }) {
  const router = express.Router();

  // Student Attempt Lifecycle
  router.get('/history', authMiddleware, requireStudent, attemptController.getStudentHistory);
  router.get('/:attemptId/questions', authMiddleware, requireStudent, attemptController.getAttemptQuestions);
  router.post('/:attemptId/submit', authMiddleware, requireStudent, attemptController.submitAttempt);
  router.get('/:attemptId/results', authMiddleware, requireStudent, attemptController.getAttemptResults);

  return router;
}

module.exports = createAttemptRoutes;

