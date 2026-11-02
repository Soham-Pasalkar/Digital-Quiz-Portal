/**
 * Administrator Analytics REST API Controller
 * [Category A]: Overall performance metrics, scores report table (STQA §1, Page 8)
 * [Category B]: Pure SQL deterministic aggregations; zero machine learning
 * [Category C]: Role-based authorization guard (Admin only)
 */

class AnalyticsController {
  /**
   * @param {import('../services/analyticsService')} analyticsService
   */
  constructor(analyticsService) {
    this.analyticsService = analyticsService;
  }

  /**
   * GET /api/admin/analytics/overview
   * Retrieve high-level system summary metrics.
   */
  getOverview = (req, res, next) => {
    try {
      const overview = this.analyticsService.getOverview(req.user.id);
      return res.status(200).json({ success: true, overview });
    } catch (err) {
      if (err.message && err.message.includes('Access denied')) {
        return res.status(403).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * GET /api/admin/analytics/quizzes
   * Retrieve quiz-wise performance statistics.
   */
  getQuizWisePerformance = (req, res, next) => {
    try {
      const quizzes = this.analyticsService.getQuizWisePerformance(req.user.id);
      return res.status(200).json({ success: true, quizzes });
    } catch (err) {
      if (err.message && err.message.includes('Access denied')) {
        return res.status(403).json({ error: err.message });
      }
      next(err);
    }
  };

  /**
   * GET /api/admin/analytics/submissions
   * Retrieve student submissions audit table matching STQA Report Results Page 8.
   */
  getSubmissionsTable = (req, res, next) => {
    try {
      const submissions = this.analyticsService.getStudentSubmissionsTable(req.user.id);
      return res.status(200).json({ success: true, submissions });
    } catch (err) {
      if (err.message && err.message.includes('Access denied')) {
        return res.status(403).json({ error: err.message });
      }
      next(err);
    }
  };
}

module.exports = AnalyticsController;

