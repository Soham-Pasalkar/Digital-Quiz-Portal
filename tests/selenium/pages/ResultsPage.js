/**
 * Digital Quiz Portal - Page Object Model: ResultsPage
 * Encapsulates examination results scorecard, pass/fail status, and question audits.
 */

const { By, until } = require('selenium-webdriver');
const { waitForVisible } = require('../utils/testHelpers');

class ResultsPage {
  /**
   * @param {import('selenium-webdriver').WebDriver} driver
   * @param {string} baseUrl
   */
  constructor(driver, baseUrl) {
    this.driver = driver;
    this.baseUrl = baseUrl;

    // Locators
    this.viewContainer = By.id('view-results');
    this.quizTitle = By.id('results-quiz-title');
    this.scoreDisplay = By.id('results-score-display');
    this.percentageDisplay = By.id('results-pct-display');
    this.statusBadge = By.id('results-status-badge');
    this.breakdownContainer = By.id('results-breakdown-container');
    this.returnButton = By.xpath("//button[contains(text(), 'Return to Student Dashboard')]");
  }

  /**
   * Wait for results view container to become active and visible.
   */
  async waitForLoaded() {
    await waitForVisible(this.driver, this.viewContainer, 6000);
  }

  /**
   * Check if results view is currently visible.
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
   * Retrieve numerical score string (e.g. "1 / 1" or "2 / 4").
   * @returns {Promise<string>}
   */
  async getScore() {
    const el = await waitForVisible(this.driver, this.scoreDisplay, 5000);
    return await el.getText();
  }

  /**
   * Retrieve academic percentage text (e.g. "100.00% Academic Score").
   * @returns {Promise<string>}
   */
  async getPercentage() {
    const el = await waitForVisible(this.driver, this.percentageDisplay, 5000);
    return await el.getText();
  }

  /**
   * Retrieve academic outcome status badge text (PASSED / FAILED).
   * @returns {Promise<string>}
   */
  async getStatus() {
    const el = await waitForVisible(this.driver, this.statusBadge, 5000);
    return await el.getText();
  }

  /**
   * Retrieve number of question audit breakdown cards rendered on the scorecard.
   * @returns {Promise<number>}
   */
  async getBreakdownCount() {
    await waitForVisible(this.driver, this.breakdownContainer, 5000);
    const cards = await this.driver.findElements(By.css('.breakdown-card, .results-breakdown-card'));
    return cards.length;
  }

  /**
   * Check if a specific question in the breakdown was marked correct.
   * @param {number} index 0-indexed question card
   * @returns {Promise<boolean>}
   */
  async isQuestionCorrect(index = 0) {
    const cards = await this.driver.findElements(By.css('.breakdown-card, .results-breakdown-card'));
    if (index >= 0 && index < cards.length) {
      const cls = await cards[index].getAttribute('class');
      return cls.includes('correct');
    }
    return false;
  }

  /**
   * Click Return to Student Dashboard button and wait for #student view.
   */
  async returnToDashboard() {
    const btn = await waitForVisible(this.driver, this.returnButton, 5000);
    await btn.click();
    await this.driver.wait(until.urlContains('#student'), 5000);
  }
}

module.exports = ResultsPage;

