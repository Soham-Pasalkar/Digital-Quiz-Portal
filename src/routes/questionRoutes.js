/**
 * Individual Question Route Definitions
 * Base Path: /api/questions
 */

const express = require('express');
const { requireAdmin } = require('../middleware/authMiddleware');

function createQuestionRoutes({ quizController, authMiddleware }) {
  const router = express.Router();

  // Admin Question Modification & Deletion
  router.put('/:id', authMiddleware, requireAdmin, quizController.updateQuestion);
  router.delete('/:id', authMiddleware, requireAdmin, quizController.deleteQuestion);

  return router;
}

module.exports = createQuestionRoutes;

