/**
 * Administrator Analytics Route Definitions
 * Base Path: /api/admin/analytics
 */

const express = require('express');
const { requireAdmin } = require('../middleware/authMiddleware');

function createAnalyticsRoutes({ analyticsController, authMiddleware }) {
  const router = express.Router();

  // Admin Analytics & Scoring Reports
  router.get('/overview', authMiddleware, requireAdmin, analyticsController.getOverview);
  router.get('/quizzes', authMiddleware, requireAdmin, analyticsController.getQuizWisePerformance);
  router.get('/submissions', authMiddleware, requireAdmin, analyticsController.getSubmissionsTable);

  return router;
}

module.exports = createAnalyticsRoutes;

