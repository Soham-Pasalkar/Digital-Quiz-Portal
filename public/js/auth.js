/**
 * Digital Quiz Portal - Client Authentication & Session Management
 * [Category B & C]: Bearer token lifecycle, session restoration, role detection
 * 
 * ============================================================================
 * SECURITY BOUNDARY & TOKEN STORAGE DOCUMENTATION:
 * 1. Architecture: Opaque 256-bit cryptographically secure session tokens sent via
 *    the standard `Authorization: Bearer <token>` HTTP header.
 * 2. Storage Location: Browser `sessionStorage` (scoped to the active tab lifecycle).
 * 3. Strict Prohibitions: Tokens are NEVER written to `localStorage`, persistent cookies,
 *    query parameters / URLs, console logs, or analytics trackers.
 * 4. Actual Security Limitations of `sessionStorage`:
 *    - IMPORTANT: `sessionStorage` DOES NOT PREVENT XSS TOKEN THEFT. Any malicious script
 *      executing in the same origin has complete synchronous read access to `sessionStorage`.
 *    - The advantage of `sessionStorage` over `localStorage` is solely lifecycle scoping:
 *      it isolates tokens to a single tab and clears automatically when the tab is closed,
 *      mitigating token retention across browser restarts and preventing cross-tab leakage
 *      on shared academic lab workstations.
 *    - To defend against token exfiltration, the application enforces strict UI-level XSS
 *      defenses: safe DOM textContent construction, HTML character escaping, and zero
 *      evaluation of untrusted user input in executable script or event handler attributes.
 *    - In enterprise web applications where third-party scripts exist, `HttpOnly; SameSite=Strict`
 *      cookies are the authoritative defense against token theft via script access.
 * ============================================================================
 */

const Auth = {
  TOKEN_KEY: 'quiz_portal_session_token',
  USER_KEY: 'quiz_portal_user',

  /**
   * Current in-memory session state
   */
  state: {
    token: null,
    user: null
  },

  /**
   * Initialize session from browser sessionStorage on page load.
   * @returns {boolean} True if an active session was restored
   */
  init() {
    try {
      const token = sessionStorage.getItem(Auth.TOKEN_KEY);
      const userStr = sessionStorage.getItem(Auth.USER_KEY);
      if (token && userStr) {
        Auth.state.token = token;
        Auth.state.user = JSON.parse(userStr);
        return true;
      }
    } catch (e) {
      console.warn('[Auth] Failed to restore session from storage:', e);
      Auth.clearStorage();
    }
    return false;
  },

  /**
   * Save session to memory and sessionStorage.
   * @param {string} token
   * @param {Object} user - { id, username, role }
   */
  setSession(token, user) {
    Auth.state.token = token;
    Auth.state.user = user;
    try {
      sessionStorage.setItem(Auth.TOKEN_KEY, token);
      sessionStorage.setItem(Auth.USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('[Auth] Storage write failed:', e);
    }
  },

  /**
   * Clear all stored session data.
   */
  clearStorage() {
    Auth.state.token = null;
    Auth.state.user = null;
    try {
      sessionStorage.removeItem(Auth.TOKEN_KEY);
      sessionStorage.removeItem(Auth.USER_KEY);
    } catch (e) {
      console.warn('[Auth] Storage clear failed:', e);
    }
  },

  /**
   * Authenticate with backend API.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<Object>}
   */
  async login(username, password) {
    const res = await API.post('/api/auth/login', { username, password }, false);
    if (res && res.token && res.user) {
      Auth.setSession(res.token, res.user);
      return res;
    }
    throw new Error('Authentication failed. Missing token in response.');
  },

  /**
   * Invalidate session locally and call backend logout endpoint.
   */
  async logout() {
    try {
      if (Auth.state.token) {
        await API.post('/api/auth/logout', {}, true);
      }
    } catch (e) {
      console.warn('[Auth] Remote logout notification failed:', e);
    } finally {
      Auth.clearStorage();
      window.location.hash = '#login';
      window.App.renderNav();
      window.App.navigateTo('login');
    }
  },

  /**
   * Verify token validity against /api/auth/me.
   * @returns {Promise<boolean>}
   */
  async verifySession() {
    if (!Auth.state.token) return false;
    try {
      const res = await API.get('/api/auth/me', true);
      if (res && res.user) {
        Auth.state.user = res.user;
        sessionStorage.setItem(Auth.USER_KEY, JSON.stringify(res.user));
        return true;
      }
    } catch {
      Auth.clearStorage();
    }
    return false;
  },

  getToken() {
    return Auth.state.token;
  },

  getUser() {
    return Auth.state.user;
  },

  isAuthenticated() {
    return !!Auth.state.token && !!Auth.state.user;
  },

  isAdmin() {
    return Auth.isAuthenticated() && Auth.state.user.role === 'admin';
  },

  isStudent() {
    return Auth.isAuthenticated() && Auth.state.user.role === 'student';
  }
};

window.Auth = Auth;

