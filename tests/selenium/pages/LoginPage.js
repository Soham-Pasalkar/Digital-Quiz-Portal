/**
 * Digital Quiz Portal - Page Object Model: LoginPage
 * Encapsulates authentication view locators, user actions, and error assertions.
 */

const { By, until } = require('selenium-webdriver');
const { waitForVisible } = require('../utils/testHelpers');

class LoginPage {
  /**
   * @param {import('selenium-webdriver').WebDriver} driver
   * @param {string} baseUrl
   */
  constructor(driver, baseUrl) {
    this.driver = driver;
    this.baseUrl = baseUrl;

    // Locators
    this.viewContainer = By.id('view-login');
    this.usernameInput = By.css('[data-testid="login-username"]');
    this.passwordInput = By.css('[data-testid="login-password"]');
    this.submitButton = By.css('[data-testid="login-submit"]');
    this.alertContainer = By.id('login-alert-container');
    this.logoutButton = By.css('[data-testid="logout-button"]');
  }

  /**
   * Navigate directly to the login hash route and guarantee clean session state.
   */
  async open() {
    await this.driver.get(`${this.baseUrl}/#login`);
    await this.driver.executeScript(`
      if (window.Auth && window.Auth.clearStorage) {
        window.Auth.clearStorage();
      }
      window.sessionStorage.clear();
      window.location.hash = '#login';
      if (window.App && window.App.handleRouting) {
        window.App.handleRouting();
      }
    `);
    await this.waitForLoaded();
  }

  /**
   * Wait for login container to become active and visible.
   */
  async waitForLoaded() {
    await waitForVisible(this.driver, this.viewContainer, 5000);
  }

  /**
   * Check if login view is currently visible.
   * @returns {Promise<boolean>}
   */
  async isDisplayed() {
    try {
      const el = await this.driver.findElement(this.viewContainer);
      const cls = await el.getAttribute('class');
      const isVisible = await el.isDisplayed();
      return isVisible && (!cls || !cls.includes('hidden'));
    } catch {
      return false;
    }
  }

  /**
   * Enter username into the credentials field.
   * @param {string} username
   */
  async enterUsername(username) {
    const input = await waitForVisible(this.driver, this.usernameInput, 5000);
    await this.driver.executeScript(`
      arguments[0].focus();
      arguments[0].value = arguments[1];
      arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
      arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
    `, input, username);
  }

  /**
   * Enter password into the credentials field.
   * @param {string} password
   */
  async enterPassword(password) {
    const input = await waitForVisible(this.driver, this.passwordInput, 5000);
    await this.driver.executeScript(`
      arguments[0].focus();
      arguments[0].value = arguments[1];
      arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
      arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
    `, input, password);
  }

  /**
   * Submit the authentication form.
   */
  async submit() {
    const btn = await waitForVisible(this.driver, this.submitButton, 5000);
    await this.driver.executeScript("arguments[0].click();", btn);
  }

  /**
   * Convenience workflow: enter credentials and submit form.
   * @param {string} username
   * @param {string} password
   */
  async login(username, password) {
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.submit();
    await this.driver.sleep(500);
  }

  /**
   * Retrieves displayed alert text from authentication errors.
   * Waits explicitly until error message text is populated.
   * @returns {Promise<string>}
   */
  async getErrorMessage() {
    const alert = await waitForVisible(this.driver, this.alertContainer, 5000);
    await this.driver.wait(async () => {
      const text = await alert.getText();
      return text.trim().length > 0;
    }, 5000, 'Alert text remained empty');
    return await alert.getText();
  }
}

module.exports = LoginPage;

