/**
 * Authentication REST API Controller
 * [Category A]: User authentication & session state routes (STQA §1, §2)
 * [Category B]: Session issuance, token extraction, logout invalidation
 * [Category C]: Constant-time verification, zero credential leakage in responses
 */

class AuthController {
  /**
   * @param {import('../services/authService')} authService
   */
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * POST /api/auth/login
   */
  login = async (req, res, next) => {
    try {
      const { username, password } = req.body || {};

      if (!username || typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ error: 'Username is required.' });
      }
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password is required.' });
      }

      const result = await this.authService.login(username.trim(), password);
      return res.status(200).json({
        success: true,
        user: result.user,
        token: result.token
      });
    } catch (err) {
      if (err.message && err.message.includes('Invalid username or password')) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }
      next(err);
    }
  };

  /**
   * POST /api/auth/logout
   */
  logout = (req, res, next) => {
    try {
      const token = req.token;
      if (token) {
        this.authService.logout(token);
      }
      return res.status(200).json({
        success: true,
        message: 'Logged out successfully.'
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/auth/me
   */
  me = (req, res) => {
    return res.status(200).json({
      success: true,
      user: req.user
    });
  };
}

module.exports = AuthController;

