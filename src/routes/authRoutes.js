/**
 * Authentication Route Definitions
 * Base Path: /api/auth
 */

const express = require('express');

function createAuthRoutes({ authController, authMiddleware }) {
  const router = express.Router();

  router.post('/login', authController.login);
  router.post('/logout', authMiddleware, authController.logout);
  router.get('/me', authMiddleware, authController.me);

  return router;
}

module.exports = createAuthRoutes;

