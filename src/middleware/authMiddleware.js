/**
 * Authentication and Role-Based Authorization Middleware
 * [Category A]: Enforces Admin and Student RBAC access policies (STQA §1, §2, OOMD Diagram 1, 2)
 * [Category B]: Bearer token extraction and session resolution via AuthService
 * [Category C]: Constant-time validation, sanitized req.user, no credential exposure
 */

const { ROLES } = require('../config/constants');

/**
 * Creates authentication middleware bound to an AuthService instance.
 * 
 * @param {import('../services/authService')} authService
 * @returns {import('express').RequestHandler}
 */
function createAuthMiddleware(authService) {
  if (!authService) {
    throw new Error('createAuthMiddleware requires an AuthService instance.');
  }

  return function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({
        error: 'Authentication required. Missing Authorization header.'
      });
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({
        error: 'Invalid Authorization header format. Expected "Bearer <token>".'
      });
    }

    const token = parts[1];
    const user = authService.validateSession(token);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication required. Invalid or expired session token.'
      });
    }

    // Attach sanitized user context to request
    req.user = user;
    req.token = token;
    next();
  };
}

/**
 * Role-Based Access Control (RBAC) middleware generator.
 * Enforces that authenticated req.user matches the required role.
 * 
 * @param {string} requiredRole - 'admin' | 'student'
 * @returns {import('express').RequestHandler}
 */
function requireRole(requiredRole) {
  return function authorize(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.'
      });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        error: `Forbidden: Access requires ${requiredRole} privileges.`
      });
    }

    next();
  };
}

const requireAdmin = requireRole(ROLES.ADMIN);
const requireStudent = requireRole(ROLES.STUDENT);

module.exports = {
  createAuthMiddleware,
  requireRole,
  requireAdmin,
  requireStudent
};

