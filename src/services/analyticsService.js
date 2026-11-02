/**
 * Deterministic Administrative Analytics Domain Service
 * [Category A]: Student performance tracking, scores reporting, STQA Report Page 8 table
 * [Category B]: Pure SQL aggregation via sql.js; zero machine learning or external runtime
 * [Category C]: Role validation ensuring analytics are restricted to Admin users
 */

const { ROLES, ATTEMPT_STATUS } = require('../config/constants');

class AnalyticsService {
  /**
   * @param {Object} dependencies
   * @param {import('../dal/submissionRepository')} dependencies.submissionRepo
   * @param {import('../dal/quizRepository')} dependencies.quizRepo
   * @param {import('../dal/userRepository')} dependencies.userRepo
   */
  constructor({ submissionRepo, quizRepo, userRepo }) {
    if (!submissionRepo) throw new Error('AnalyticsService requires SubmissionRepository.');
    if (!quizRepo) throw new Error('AnalyticsService requires QuizRepository.');
    if (!userRepo) throw new Error('AnalyticsService requires UserRepository.');

    this.submissionRepo = submissionRepo;
    this.quizRepo = quizRepo;
    this.userRepo = userRepo;
  }

  /**
   * Validate that the requesting user possesses Admin privileges.
   * @param {number} adminUserId
   * @private
   */
  _assertAdmin(adminUserId) {
    const user = this.userRepo.findById(adminUserId);
    if (!user || user.role !== ROLES.ADMIN) {
      throw new Error('Access denied: Analytics reporting requires Administrator privileges.');
    }
  }

  /**
   * Retrieve high-level overall system statistics.
   * Handles empty database state gracefully without division by zero.
   * 
   * @param {number} adminUserId
   * @returns {{
   *   totalStudents: number,
   *   totalQuizzes: number,
   *   publishedQuizzes: number,
   *   totalSubmissions: number,
   *   passCount: number,
   *   failCount: number,
   *   passPercentage: number,
   *   averageScore: number,
   *   averagePercentage: number
   * }}
   */
  getOverview(adminUserId) {
    this._assertAdmin(adminUserId);

    const totalStudents = this.userRepo.countStudents();
    const totalQuizzes = this.quizRepo.countQuizzes();
    const publishedQuizzes = this.quizRepo.countPublishedQuizzes();

    const passCount = this.submissionRepo.countByStatus(ATTEMPT_STATUS.PASSED);
    const failCount = this.submissionRepo.countByStatus(ATTEMPT_STATUS.FAILED);
    const totalSubmissions = passCount + failCount;

    const overallPerf = this.submissionRepo.getOverallPerformance();

    const passPercentage = totalSubmissions > 0
      ? Number(((passCount / totalSubmissions) * 100).toFixed(2))
      : 0.0;

    return {
      totalStudents,
      totalQuizzes,
      publishedQuizzes,
      totalSubmissions,
      passCount,
      failCount,
      passPercentage,
      averageScore: overallPerf.avgScore,
      averagePercentage: overallPerf.avgPercentage
    };
  }

  /**
   * Retrieve performance metrics aggregated per quiz.
   * 
   * @param {number} adminUserId
   * @returns {Array<{
   *   quizId: number,
   *   title: string,
   *   isPublished: boolean,
   *   totalAttempts: number,
   *   avgScore: number,
   *   avgPercentage: number,
   *   passCount: number,
   *   failCount: number,
   *   passRate: number
   * }>}
   */
  getQuizWisePerformance(adminUserId) {
    this._assertAdmin(adminUserId);

    const rows = this.submissionRepo.getQuizWisePerformance();

    return rows.map(r => {
      const total = Number(r.total_attempts) || 0;
      const pass = Number(r.pass_count) || 0;
      const passRate = total > 0 ? Number(((pass / total) * 100).toFixed(2)) : 0.0;

      return {
        quizId: r.quiz_id,
        title: r.title,
        isPublished: r.is_published === 1,
        totalAttempts: total,
        avgScore: Number(Number(r.avg_score).toFixed(2)),
        avgPercentage: Number(Number(r.avg_percentage).toFixed(2)),
        passCount: pass,
        failCount: Number(r.fail_count) || 0,
        passRate
      };
    });
  }

  /**
   * Retrieve student submissions table matching STQA Report Results Page 8.
   * Columns: Submission ID, Student, Quiz Title, Score, Total Questions, Percentage, Status, Submission Time.
   * 
   * @param {number} adminUserId
   * @returns {Array<Object>}
   */
  getStudentSubmissionsTable(adminUserId) {
    this._assertAdmin(adminUserId);
    return this.submissionRepo.findAllWithDetails();
  }
}

module.exports = AnalyticsService;

