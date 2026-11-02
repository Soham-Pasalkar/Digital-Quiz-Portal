/**
 * Digital Quiz Portal - Centralized Fetch API Client
 * [Category B]: Automatic Bearer authorization, 401 handling, error normalization
 */

const API = {
  /**
   * Core request dispatcher
   * @param {string} url
   * @param {Object} [options={}]
   * @param {boolean} [requiresAuth=true]
   * @returns {Promise<any>}
   */
  async request(url, options = {}, requiresAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (requiresAuth && window.Auth) {
      const token = window.Auth.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const config = {
      ...options,
      headers
    };

    let response;
    try {
      response = await fetch(url, config);
    } catch (networkError) {
      throw new Error(`Network connection error: ${networkError.message}. Please check your connection.`);
    }

    // Automatic session expiration / unauthenticated interception
    if (response.status === 401 && requiresAuth) {
      console.warn('[API] Session expired or unauthorized (401). Triggering local logout.');
      if (window.Auth && window.Auth.isAuthenticated()) {
        window.Auth.clearStorage();
        if (window.App) {
          window.App.renderNav();
          window.App.navigateTo('login');
          Utils.showAlert('login-alert-container', 'Your session has expired. Please sign in again.', 'warning');
        }
      }
      throw new Error('Authentication required. Session expired.');
    }

    let payload = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const errorMessage = (payload && payload.error)
        ? payload.error
        : `Request failed with status ${response.status}: ${response.statusText}`;
      const err = new Error(errorMessage);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  },

  get(url, requiresAuth = true) {
    return API.request(url, { method: 'GET' }, requiresAuth);
  },

  post(url, body = {}, requiresAuth = true) {
    return API.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    }, requiresAuth);
  },

  put(url, body = {}, requiresAuth = true) {
    return API.request(url, {
      method: 'PUT',
      body: JSON.stringify(body)
    }, requiresAuth);
  },

  delete(url, requiresAuth = true) {
    return API.request(url, { method: 'DELETE' }, requiresAuth);
  }
};

window.API = API;

