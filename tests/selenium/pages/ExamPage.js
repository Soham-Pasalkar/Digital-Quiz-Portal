/**
 * Digital Quiz Portal - Page Object Model: ExamPage
 * Encapsulates examination view, active timer, question options, and submission modal.
 */

const { By, until } = require('selenium-webdriver');
const { waitForVisible, waitForHidden } = require('../utils/testHelpers');

class ExamPage {
  /**
   * @param {import('selenium-webdriver').WebDriver} driver
   * @param {string} baseUrl
   */
  constructor(driver, baseUrl) {
    this.driver = driver;
    this.baseUrl = baseUrl;

    // Locators
    this.viewContainer = By.id('view-exam');
    this.quizTitle = By.id('exam-quiz-title-display');
    this.timerDisplay = By.id('exam-timer-display');
    this.questionPrompt = By.id('exam-question-text');
    this.questionMeta = By.id('exam-question-meta');
    this.optionsContainer = By.id('exam-options-container');
    this.btnPrev = By.id('exam-btn-prev');
    this.btnNext = By.id('exam-btn-next');
    this.btnSubmit = By.id('exam-btn-submit');
    this.palette = By.id('exam-nav-palette');

    // Submit Confirmation Modal
    this.modalSubmit = By.id('modal-submit-exam');
    this.modalTotal = By.id('submit-modal-total');
    this.modalAnswered = By.id('submit-modal-answered');
    this.modalUnanswered = By.id('submit-modal-unanswered');
    this.btnConfirmSubmit = By.id('btn-confirm-submit');
  }

  /**
   * Wait for active examination view container to become active and visible.
   */
  async waitForLoaded() {
    await waitForVisible(this.driver, this.viewContainer, 6000);
    await waitForVisible(this.driver, this.questionPrompt, 6000);
    await this.driver.wait(async () => {
      try {
        const text = await (await this.driver.findElement(this.questionPrompt)).getText();
        return text.trim().length > 0 && !text.includes('Loading');
      } catch {
        return false;
      }
    }, 6000, 'Exam question text was not loaded');
  }

  /**
   * Check if examination view is currently visible.
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
   * Retrieve examination title displayed on the exam header.
   * @returns {Promise<string>}
   */
  async getQuizTitle() {
    const el = await waitForVisible(this.driver, this.quizTitle, 5000);
    return await el.getText();
  }

  /**
   * Retrieve active remaining countdown timer string (MM:SS).
   * @returns {Promise<string>}
   */
  async getRemainingTime() {
    const el = await waitForVisible(this.driver, this.timerDisplay, 5000);
    return await el.getText();
  }

  /**
   * Retrieve currently displayed question prompt text.
   * @returns {Promise<string>}
   */
  async getQuestionPrompt() {
    const el = await waitForVisible(this.driver, this.questionPrompt, 5000);
    return await el.getText();
  }

  /**
   * Select an option choice for the current question by option letter (A, B, C, D) or index (0..3).
   * @param {string|number} optionRef
   */
  async selectOption(optionRef) {
    await waitForVisible(this.driver, this.optionsContainer, 5000);
    const options = await this.driver.findElements(By.css('.option-choice'));
    let targetIndex = typeof optionRef === 'number' ? optionRef : (optionRef.toUpperCase().charCodeAt(0) - 65);
    if (targetIndex >= 0 && targetIndex < options.length) {
      await this.driver.executeScript("arguments[0].click();", options[targetIndex]);
      await this.driver.sleep(200);
      return;
    }
    throw new Error(`Invalid option reference '${optionRef}' (available count: ${options.length})`);
  }

  /**
   * Check if a specific option is currently selected (has .selected class).
   * @param {string|number} optionRef
   * @returns {Promise<boolean>}
   */
  async isOptionSelected(optionRef) {
    const options = await this.driver.findElements(By.css('.option-choice'));
    let targetIndex = typeof optionRef === 'number' ? optionRef : (optionRef.toUpperCase().charCodeAt(0) - 65);
    if (targetIndex >= 0 && targetIndex < options.length) {
      const cls = await options[targetIndex].getAttribute('class');
      return cls.includes('selected');
    }
    return false;
  }

  /**
   * Check if a question palette pill is marked as answered (has .answered class).
   * @param {number} questionNumber 1-indexed question number
   * @returns {Promise<boolean>}
   */
  async isPalettePillAnswered(questionNumber) {
    await waitForVisible(this.driver, this.palette, 5000);
    const pills = await this.driver.findElements(By.css('.nav-pill'));
    const idx = questionNumber - 1;
    if (idx >= 0 && idx < pills.length) {
      const cls = await pills[idx].getAttribute('class');
      return cls.includes('answered');
    }
    return false;
  }

  /**
   * Navigate to the next question.
   */
  async nextQuestion() {
    const btn = await waitForVisible(this.driver, this.btnNext, 5000);
    await this.driver.executeScript("arguments[0].click();", btn);
  }

  /**
   * Open the final submission confirmation modal.
   */
  async openSubmitModal() {
    const btn = await waitForVisible(this.driver, this.btnSubmit, 5000);
    await this.driver.executeScript("arguments[0].click();", btn);
    await waitForVisible(this.driver, this.modalSubmit, 5000);
  }

  /**
   * Retrieve summary metrics from the submission confirmation dialog.
   * @returns {Promise<{ total: number, answered: number, unanswered: number }>}
   */
  async getSubmitSummary() {
    const totalEl = await waitForVisible(this.driver, this.modalTotal, 5000);
    const ansEl = await waitForVisible(this.driver, this.modalAnswered, 5000);
    const unansEl = await waitForVisible(this.driver, this.modalUnanswered, 5000);
    return {
      total: parseInt(await totalEl.getText(), 10) || 0,
      answered: parseInt(await ansEl.getText(), 10) || 0,
      unanswered: parseInt(await unansEl.getText(), 10) || 0
    };
  }

  /**
   * Confirm final submission in the modal and wait for transition to #results.
   */
  async confirmSubmission() {
    const btn = await waitForVisible(this.driver, this.btnConfirmSubmit, 5000);
    await this.driver.executeScript("arguments[0].click();", btn);
    await waitForHidden(this.driver, this.modalSubmit, 5000);
    await this.driver.wait(until.urlContains('#results'), 6000);
  }

  /**
   * Refresh browser tab and wait for examination state restoration.
   */
  async refresh() {
    await this.driver.navigate().refresh();
    await this.waitForLoaded();
  }
}

module.exports = ExamPage;

