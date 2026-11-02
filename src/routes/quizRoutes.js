/**
 * Quiz & Question Route Definitions
 * Base Path: /api/quizzes
 * 
 * Note: Route ordering is strictly preserved:
 * '/available' is mounted prior to '/:id' to avoid path parameter shadowing.
 */

const express = require('express');
const { requireAdmin, requireStudent } = require('../middleware/authMiddleware');

function createQuizRoutes({ quizController, attemptController, authMiddleware }) {
  const router = express.Router();

  // Student Available Quizzes Catalog (Mounted BEFORE /:id parameter)
  router.get('/available', authMiddleware, requireStudent, quizController.getAvailableQuizzes);

  // Admin Quiz Management
  router.post('/', authMiddleware, requireAdmin, quizController.createQuiz);
  router.get('/', authMiddleware, requireAdmin, quizController.getAllQuizzes);
  router.get('/:id', authMiddleware, requireAdmin, quizController.getQuizById);
  router.put('/:id', authMiddleware, requireAdmin, quizController.updateQuiz);
  router.delete('/:id', authMiddleware, requireAdmin, quizController.deleteQuiz);

  // Admin Question Addition & Publishing Lifecycle
  router.post('/:id/questions', authMiddleware, requireAdmin, quizController.addQuestion);
  router.post('/:id/publish', authMiddleware, requireAdmin, quizController.publishQuiz);
  router.post('/:id/unpublish', authMiddleware, requireAdmin, quizController.unpublishQuiz);

  // Student Examination Attempt Initialization / Resumption
  router.post('/:id/attempts', authMiddleware, requireStudent, attemptController.startOrResumeAttempt);

  return router;
}

module.exports = createQuizRoutes;

