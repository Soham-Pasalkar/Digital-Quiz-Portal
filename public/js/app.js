/**
 * Digital Quiz Portal - Main Application Controller & Hash Router
 * [Category B]: Vanilla JS single-page application router, session restoration, view mounting
 */

const App = {
  currentRoute: 'login',

  /**
   * Bootstraps the application on DOMContentLoaded.
   */
  async init() {
    // 1. Set up hash change listener
    window.addEventListener('hashchange', () => App.handleRouting());

    // 2. Set up global event listeners (login form, logout, etc.)
    App.bindEvents();

    // 3. Restore session from browser storage
    const hasSession = Auth.init();
    if (hasSession) {
      // Asynchronously verify with backend in background
      Auth.verifySession().then(isValid => {
        if (!isValid) {
          App.renderNav();
          App.navigateTo('login');
        } else {
          App.renderNav();
        }
      });
    }

    // 4. Initial route resolution
    App.handleRouting();
  },

  /**
   * Bind DOM event listeners.
   */
  bindEvents() {
    // Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => App.handleLoginSubmit(e));
    }

    // Navbar logout button
    const logoutBtn = document.getElementById('btn-nav-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => Auth.logout());
    }

    // Admin quiz creation form
    const createQuizForm = document.getElementById('create-quiz-form');
    if (createQuizForm) {
      createQuizForm.addEventListener('submit', (e) => Admin.handleCreateQuizSubmit(e));
    }

    // Admin quiz edit form
    const editQuizForm = document.getElementById('edit-quiz-form');
    if (editQuizForm) {
      editQuizForm.addEventListener('submit', (e) => Admin.handleEditQuizSubmit(e));
    }

    // Admin question form
    const questionForm = document.getElementById('question-form');
    if (questionForm) {
      questionForm.addEventListener('submit', (e) => Admin.handleQuestionFormSubmit(e));
    }
  },

  /**
   * Handle hash-based route changes.
   */
  handleRouting() {
    const rawHash = window.location.hash.replace(/^#\/?/, '').trim();
    const route = rawHash.split('?')[0] || (Auth.isAuthenticated() ? (Auth.isAdmin() ? 'admin' : 'student') : 'login');

    App.navigateTo(route);
  },

  /**
   * Navigate to a designated application view.
   * @param {string} targetRoute
   */
  navigateTo(targetRoute) {
    const route = targetRoute || 'login';

    // Route Guards
    if (!Auth.isAuthenticated() && route !== 'login') {
      window.location.hash = '#login';
      App.showView('login');
      App.renderNav();
      return;
    }

    if (Auth.isAuthenticated()) {
      if (route === 'login') {
        const dest = Auth.isAdmin() ? 'admin' : 'student';
        window.location.hash = `#${dest}`;
        App.navigateTo(dest);
        return;
      }

      if (route === 'admin' && !Auth.isAdmin()) {
        window.location.hash = '#student';
        App.navigateTo('student');
        return;
      }

      if ((route === 'student' || route === 'exam') && Auth.isAdmin()) {
        window.location.hash = '#admin';
        App.navigateTo('admin');
        return;
      }
    }

    App.currentRoute = route;
    if (window.location.hash !== `#${route}`) {
      window.location.hash = `#${route}`;
    }

    App.showView(route);
    App.renderNav();

    // Trigger view-specific initialization
    switch (route) {
      case 'login':
        Utils.clearAlert('login-alert-container');
        break;
      case 'admin':
        Admin.init();
        break;
      case 'student':
        Student.init();
        break;
      case 'exam':
        Exam.init();
        break;
      case 'results':
        Results.init();
        break;
      default:
        App.navigateTo(Auth.isAdmin() ? 'admin' : 'student');
    }
  },

  /**
   * Show specified view element and hide all others.
   * @param {string} viewName
   */
  showView(viewName) {
    const views = ['login', 'admin', 'student', 'exam', 'results'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        if (v === viewName) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    });

    // Scroll to top on view transition
    window.scrollTo(0, 0);
  },

  /**
   * Render top navigation bar state based on user role.
   */
  renderNav() {
    const userNav = document.getElementById('user-nav-container');
    const usernameEl = document.getElementById('nav-user-name');
    const roleEl = document.getElementById('nav-user-role');

    if (!userNav) return;

    if (Auth.isAuthenticated()) {
      userNav.classList.remove('hidden');
      const user = Auth.getUser();
      if (user) {
        if (usernameEl) usernameEl.textContent = user.username;
        const avatarEl = document.getElementById('nav-user-avatar');
        if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase();
        if (roleEl) {
          roleEl.textContent = user.role === 'admin' ? 'Administrator' : 'Student';
          roleEl.className = `badge ${user.role === 'admin' ? 'badge-locked' : 'badge-published'}`;
        }
      }
    } else {
      userNav.classList.add('hidden');
    }
  },

  /**
   * Handle login form submission.
   * @param {Event} event
   */
  async handleLoginSubmit(event) {
    event.preventDefault();
    Utils.clearAlert('login-alert-container');

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('login-submit-btn');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
      Utils.showAlert('login-alert-container', 'Please provide both username and password.', 'danger');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';
    }

    try {
      const res = await Auth.login(username, password);
      if (passwordInput) passwordInput.value = '';
      App.renderNav();

      if (res.user.role === 'admin') {
        App.navigateTo('admin');
      } else {
        App.navigateTo('student');
      }
    } catch (e) {
      Utils.showAlert('login-alert-container', e.message || 'Login failed. Please verify credentials.', 'danger');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In \u2192';
      }
    }
  },

  /**
   * Helper to quickly fill credentials for evaluation demo.
   * @param {string} username
   * @param {string} password
   */
  fillDemoCredentials(username, password) {
    const u = document.getElementById('login-username');
    const p = document.getElementById('login-password');
    if (u) u.value = username;
    if (p) p.value = password;
  }
};

window.App = App;

// Bootstrap application once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
