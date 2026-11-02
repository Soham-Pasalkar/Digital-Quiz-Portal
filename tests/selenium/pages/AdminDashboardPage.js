/**
 * Digital Quiz Portal - Page Object Model: AdminDashboardPage
 * Encapsulates Administrator overview, KPI stat cards, charts, and logout navigation.
 */

const { By, until } = require('selenium-webdriver');
const { waitForVisible } = require('../utils/testHelpers');

class AdminDashboardPage {
  /**
   * @param {import('selenium-webdriver').WebDriver} driver
   * @param {string} baseUrl
   */
  constructor(driver, baseUrl) {
    this.driver = driver;
    this.baseUrl = baseUrl;

    // Locators
    this.viewContainer = By.id('view-admin');
    this.greetingText = By.id('admin-greeting-text');
    this.statStudents = By.id('stat-total-students');
    this.statQuizzes = By.id('stat-total-quizzes');
    this.statPublished = By.id('stat-published-quizzes');
    this.statSubmissions = By.id('stat-total-submissions');
    this.statPassRate = By.id('stat-pass-rate');
    this.statAvgScore = By.id('stat-avg-score');
    this.donutChart = By.id('chart-results-donut');
    this.logoutButton = By.css('[data-testid="logout-button"]');
    this.userRoleBadge = By.id('nav-user-role');
  }

  /**
   * Wait for admin view container to become active and visible.
   */
  async waitForLoaded() {
    await waitForVisible(this.driver, this.viewContainer, 6000);
  }

  /**
   * Check if admin view is currently visible.
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
   * Retrieve greeting banner text.
   * @returns {Promise<string>}
   */
  async getGreetingText() {
    const el = await waitForVisible(this.driver, this.greetingText, 5000);
    return await el.getText();
  }

  /**
   * Retrieve all numerical metrics from the 5 overview KPI cards.
   * @returns {Promise<{ students: number, quizzes: number, published: number, submissions: number, passRate: string, avgScore: string }>}
   */
  async getMetrics() {
    const studentsEl = await waitForVisible(this.driver, this.statStudents, 5000);
    const quizzesEl = await waitForVisible(this.driver, this.statQuizzes, 5000);
    const publishedEl = await waitForVisible(this.driver, this.statPublished, 5000);
    const subsEl = await waitForVisible(this.driver, this.statSubmissions, 5000);
    const passRateEl = await waitForVisible(this.driver, this.statPassRate, 5000);
    const avgScoreEl = await waitForVisible(this.driver, this.statAvgScore, 5000);

    return {
      students: parseInt(await studentsEl.getText(), 10) || 0,
      quizzes: parseInt(await quizzesEl.getText(), 10) || 0,
      published: parseInt(await publishedEl.getText(), 10) || 0,
      submissions: parseInt(await subsEl.getText(), 10) || 0,
      passRate: await passRateEl.getText(),
      avgScore: await avgScoreEl.getText()
    };
  }

  /**
   * Check if the native SVG outcomes donut chart has rendered.
   * @returns {Promise<boolean>}
   */
  async isOutcomesChartRendered() {
    try {
      const container = await waitForVisible(this.driver, this.donutChart, 5000);
      const svgs = await container.findElements(By.tagName('svg'));
      const text = await container.getText();
      return svgs.length > 0 || text.includes('Submissions');
    } catch {
      return false;
    }
  }

  /**
   * Execute user sign-out from the navigation header.
   */
  async logout() {
    const btn = await waitForVisible(this.driver, this.logoutButton, 5000);
    await this.driver.sleep(300);
    await this.driver.executeScript("arguments[0].click();", btn);
    await this.driver.wait(until.urlContains('#login'), 5000);
    const loginView = await this.driver.findElement(By.id('view-login'));
    await this.driver.wait(until.elementIsVisible(loginView), 5000);
    await this.driver.wait(async () => {
      const token = await this.driver.executeScript("return sessionStorage.getItem('quiz_portal_session_token');");
      return token === null;
    }, 5000);
    await this.driver.sleep(300);
  }
}

module.exports = AdminDashboardPage;

