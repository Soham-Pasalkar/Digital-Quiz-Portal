/**
 * Digital Quiz Portal - Page Object Model: StudentDashboardPage
 * Encapsulates Student home view, featured assessment hero, and quiz catalog.
 */

const { By, until } = require('selenium-webdriver');
const { waitForVisible } = require('../utils/testHelpers');

class StudentDashboardPage {
  /**
   * @param {import('selenium-webdriver').WebDriver} driver
   * @param {string} baseUrl
   */
  constructor(driver, baseUrl) {
    this.driver = driver;
    this.baseUrl = baseUrl;

    // Locators
    this.viewContainer = By.id('view-student');
    this.welcomeName = By.id('student-welcome-name');
    this.heroTitle = By.id('hero-quiz-title');
    this.heroDuration = By.id('hero-quiz-duration');
    this.heroQuestions = By.id('hero-quiz-questions');
    this.heroStartBtn = By.css('#hero-action-container button');
    this.catalogTbody = By.id('student-catalog-tbody');
    this.historyTbody = By.id('student-history-tbody');
    this.logoutButton = By.css('[data-testid="logout-button"]');
  }

  /**
   * Wait for student view container to become active and visible.
   */
  async waitForLoaded() {
    await waitForVisible(this.driver, this.viewContainer, 6000);
  }

  /**
   * Check if student view is currently visible.
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
   * Retrieve student name rendered in the welcome greeting.
   * @returns {Promise<string>}
   */
  async getWelcomeName() {
    const el = await waitForVisible(this.driver, this.welcomeName, 5000);
    return await el.getText();
  }

  /**
   * Retrieve metadata displayed on the featured assessment hero card.
   * @returns {Promise<{ title: string, duration: string, questions: string }>}
   */
  async getHeroDetails() {
    const titleEl = await waitForVisible(this.driver, this.heroTitle, 5000);
    const durEl = await waitForVisible(this.driver, this.heroDuration, 5000);
    const qEl = await waitForVisible(this.driver, this.heroQuestions, 5000);
    return {
      title: await titleEl.getText(),
      duration: await durEl.getText(),
      questions: await qEl.getText()
    };
  }

  /**
   * Retrieve list of published quizzes available in the catalog table.
   * @returns {Promise<Array<{ title: string, duration: string, questions: string }>>}
   */
  async getAvailableQuizzes() {
    await waitForVisible(this.driver, this.catalogTbody, 5000);
    const rows = await this.driver.findElements(By.css('#student-catalog-tbody tr'));
    const quizzes = [];
    for (const r of rows) {
      const cells = await r.findElements(By.tagName('td'));
      if (cells.length >= 4) {
        quizzes.push({
          title: await cells[0].getText(),
          duration: await cells[1].getText(),
          questions: await cells[2].getText()
        });
      }
    }
    return quizzes;
  }

  /**
   * Initiate examination attempt for a published quiz.
   * @param {string} [quizTitle]
   */
  async startQuiz(quizTitle) {
    if (quizTitle) {
      await waitForVisible(this.driver, this.catalogTbody, 5000);
      const rows = await this.driver.findElements(By.css('#student-catalog-tbody tr'));
      for (const r of rows) {
        const text = await r.getText();
        if (text.includes(quizTitle)) {
          const btn = await r.findElement(By.tagName('button'));
          await this.driver.executeScript("arguments[0].click();", btn);
          await this.driver.wait(until.urlContains('#exam'), 6000);
          return;
        }
      }
    }

    // Default to hero action button
    const heroBtn = await waitForVisible(this.driver, this.heroStartBtn, 5000);
    await this.driver.executeScript("arguments[0].click();", heroBtn);
    await this.driver.wait(until.urlContains('#exam'), 6000);
  }

  /**
   * Retrieve student's historical attempts from the history table.
   * @returns {Promise<Array<{ quiz: string, score: string, percentage: string, status: string }>>}
   */
  async getHistoryRecords() {
    await waitForVisible(this.driver, this.historyTbody, 5000);
    const rows = await this.driver.findElements(By.css('#student-history-tbody tr'));
    const records = [];
    for (const r of rows) {
      const cells = await r.findElements(By.tagName('td'));
      if (cells.length >= 5) {
        records.push({
          quiz: await cells[0].getText(),
          score: await cells[1].getText(),
          percentage: await cells[2].getText(),
          status: await cells[3].getText()
        });
      }
    }
    return records;
  }

  /**
   * Execute student sign out.
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

module.exports = StudentDashboardPage;

