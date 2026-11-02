/**
 * Express Application Setup & Dependency Assembly
 * [Category A]: REST API engine, JSON serialization, centralized error handling
 * [Category B]: Pure separation of app creation from server network listening
 * [Category C]: Robust input parsing, safe error responses without stack trace leaks
 */

const express = require('express');
const path = require('path');

// Repositories
const UserRepository = require('./dal/userRepository');
const QuizRepository = require('./dal/quizRepository');
const SubmissionRepository = require('./dal/submissionRepository');

// Services
const AuthService = require('./services/authService');
const QuizManagementService = require('./services/quizManagementService');
const ScoringService = require('./services/scoringService');
const ExamService = require('./services/examService');
const AnalyticsService = require('./services/analyticsService');

// Controllers
const AuthController = require('./controllers/authController');
const QuizController = require('./controllers/quizController');
const AttemptController = require('./controllers/attemptController');
const AnalyticsController = require('./controllers/analyticsController');

// Middleware & Routes
const { createAuthMiddleware } = require('./middleware/authMiddleware');
const createAuthRoutes = require('./routes/authRoutes');
const createQuizRoutes = require('./routes/quizRoutes');
const createQuestionRoutes = require('./routes/questionRoutes');
const createAttemptRoutes = require('./routes/attemptRoutes');
const createAnalyticsRoutes = require('./routes/analyticsRoutes');

/**
 * Express application factory.
 * Accepts existing database client and services or instantiates defaults.
 * 
 * @param {Object} [options={}]
 * @param {import('./database/db').DatabaseClient} [options.dbClient]
 * @param {Object} [options.services] - Optional pre-configured service instances
 * @param {() => Date} [options.clock] - Optional server clock function
 * @returns {import('express').Application}
 */
function createApp(options = {}) {
  const app = express();

  // Core Middleware
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // Database Client & Repositories
  const dbClient = options.dbClient;
  const userRepo = options.userRepo || (dbClient ? new UserRepository(dbClient) : null);
  const quizRepo = options.quizRepo || (dbClient ? new QuizRepository(dbClient) : null);
  const submissionRepo = options.submissionRepo || (dbClient ? new SubmissionRepository(dbClient) : null);

  // Domain Services (with dependency injection)
  const scoringService = options.services?.scoringService || new ScoringService();
  const authService = options.services?.authService || new AuthService({ userRepo });
  const quizService = options.services?.quizService || new QuizManagementService({
    quizRepo,
    userRepo,
    dbClient,
    submissionRepo
  });
  const examService = options.services?.examService || new ExamService({
    submissionRepo,
    quizRepo,
    userRepo,
    scoringService,
    dbClient,
    clock: options.clock || (() => new Date())
  });
  const analyticsService = options.services?.analyticsService || new AnalyticsService({
    submissionRepo,
    quizRepo,
    userRepo
  });

  // Controllers
  const authController = new AuthController(authService);
  const quizController = new QuizController(quizService);
  const attemptController = new AttemptController(examService);
  const analyticsController = new AnalyticsController(analyticsService);

  // Authentication Middleware
  const authMiddleware = createAuthMiddleware(authService);

  // Mount API Routers
  app.use('/api/auth', createAuthRoutes({ authController, authMiddleware }));
  app.use('/api/quizzes', createQuizRoutes({ quizController, attemptController, authMiddleware }));
  app.use('/api/questions', createQuestionRoutes({ quizController, authMiddleware }));
  app.use('/api/attempts', createAttemptRoutes({ attemptController, authMiddleware }));
  app.use('/api/admin/analytics', createAnalyticsRoutes({ analyticsController, authMiddleware }));

  // 404 Route Handler for undefined /api routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Client-Side SPA Route Fallback (Serves index.html for non-API web navigation)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  // Centralized Error Handling Middleware
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Never leak stack traces to client
    res.status(status).json({
      error: message
    });
  });

  // Store references on app for programmatic test inspection
  app.locals = {
    dbClient,
    services: {
      authService,
      quizService,
      scoringService,
      examService,
      analyticsService
    }
  };

  return app;
}

module.exports = {
  createApp
};

