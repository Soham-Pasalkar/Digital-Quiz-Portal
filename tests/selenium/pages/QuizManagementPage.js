/**
 * Digital Quiz Portal - Page Object Model: QuizManagementPage
 * Encapsulates quiz authoring, question management, publishing lifecycle, and audit modals.
 */

const { By, until } = require('selenium-webdriver');
const { waitForVisible, waitForHidden } = require('../utils/testHelpers');

class QuizManagementPage {
  /**
   * @param {import('selenium-webdriver').WebDriver} driver
   * @param {string} baseUrl
   */
  constructor(driver, baseUrl) {
    this.driver = driver;
    this.baseUrl = baseUrl;

    // Locators
    this.createQuizBtn = By.id('admin-btn-create-quiz');
    this.modalCreateQuiz = By.id('modal-create-quiz');
    this.inputNewQuizTitle = By.id('new-quiz-title');
    this.inputNewQuizDuration = By.id('new-quiz-duration');
    this.btnSubmitCreateQuiz = By.id('create-quiz-submit-btn');

    this.quizzesTbody = By.id('admin-quizzes-tbody');

    // Questions Manager Modal
    this.modalQuestionsManager = By.id('modal-questions-manager');
    this.btnAddQuestion = By.id('qm-add-question-btn');
    this.modalQuestionForm = By.id('modal-question-form');
    this.inputQText = By.id('qform-text');
    this.inputOptA = By.id('qform-opt-a');
    this.inputOptB = By.id('qform-opt-b');
    this.inputOptC = By.id('qform-opt-c');
    this.inputOptD = By.id('qform-opt-d');
    this.selectCorrect = By.id('qform-correct');
    this.btnSubmitQuestion = By.id('qform-submit-btn');
    this.btnCloseQuestionsManager = By.css('#modal-questions-manager .modal-footer button');

    this.adminAlert = By.id('admin-alert-container');

    // Submissions Audit Tab & Modal
    this.tabBtnSubs = By.id('tab-btn-subs');
    this.subsTbody = By.id('admin-submissions-tbody');
    this.modalSubmissionDetail = By.id('modal-submission-detail');
    this.submissionDetailBody = By.id('modal-submission-detail-body');
    this.btnCloseSubmissionDetail = By.css('#modal-submission-detail .modal-footer button');
  }

  /**
   * Navigate or scroll to the Quiz Management table in Admin view.
   */
  async openManagementView() {
    const navBtn = await waitForVisible(this.driver, By.id('admin-nav-quizzes'), 5000);
    await navBtn.click();
    await waitForVisible(this.driver, this.quizzesTbody, 5000);
  }

  /**
   * Open the Create Quiz dialog.
   */
  async openCreateQuizModal() {
    const btn = await waitForVisible(this.driver, this.createQuizBtn, 5000);
    await this.driver.executeScript("arguments[0].click();", btn);
    await waitForVisible(this.driver, this.modalCreateQuiz, 5000);
  }

  /**
   * Author and persist a new quiz through the modal.
   * @param {string} title
   * @param {number} durationMinutes
   */
  async createQuiz(title, durationMinutes = 10) {
    await this.openCreateQuizModal();
    const titleInput = await waitForVisible(this.driver, this.inputNewQuizTitle, 5000);
    await this.driver.executeScript(`
      arguments[0].value = arguments[1];
      arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
      arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
    `, titleInput, title);

    const durInput = await waitForVisible(this.driver, this.inputNewQuizDuration, 5000);
    await this.driver.executeScript(`
      arguments[0].value = arguments[1];
      arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
      arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
    `, durInput, String(durationMinutes));

    const submitBtn = await waitForVisible(this.driver, this.btnSubmitCreateQuiz, 5000);
    await this.driver.executeScript("arguments[0].click();", submitBtn);
    await waitForHidden(this.driver, this.modalCreateQuiz, 5000);
  }

  /**
   * Find a quiz table row by title and return its column data and action buttons.
   * @param {string} title
   * @returns {Promise<import('selenium-webdriver').WebElement|null>}
   */
  async findQuizRow(title) {
    await waitForVisible(this.driver, this.quizzesTbody, 5000);
    const rows = await this.driver.findElements(By.css('#admin-quizzes-tbody tr'));
    for (const r of rows) {
      const text = await r.getText();
      if (text.includes(title)) {
        return r;
      }
    }
    return null;
  }

  /**
   * Retrieve the status text of a specific quiz in the table (e.g. Published / Draft).
   * @param {string} title
   * @returns {Promise<string>}
   */
  async getQuizStatus(title) {
    const row = await this.findQuizRow(title);
    if (!row) throw new Error(`Quiz '${title}' not found in table`);
    const statusCell = await row.findElement(By.css('td:nth-child(4)'));
    return await statusCell.getText();
  }

  /**
   * Open the Questions Manager modal for a specific quiz.
   * @param {string} title
   */
  async openQuestionsManager(title) {
    const row = await this.findQuizRow(title);
    if (!row) throw new Error(`Quiz '${title}' not found in table`);
    const qBtn = await row.findElement(By.xpath(".//button[contains(text(), 'Questions')]"));
    await this.driver.executeScript("arguments[0].click();", qBtn);
    await waitForVisible(this.driver, this.modalQuestionsManager, 5000);
  }

  /**
   * Author and save a question through the Question Form modal.
   * @param {{ prompt: string, optA: string, optB: string, optC: string, optD: string, correctIndex: number|string }} data
   */
  async addQuestion({ prompt, optA, optB, optC, optD, correctIndex = 0 }) {
    const addBtn = await waitForVisible(this.driver, this.btnAddQuestion, 5000);
    await this.driver.executeScript("arguments[0].click();", addBtn);
    await waitForVisible(this.driver, this.modalQuestionForm, 5000);

    const promptInput = await waitForVisible(this.driver, this.inputQText, 5000);
    await this.driver.executeScript(`
      arguments[0].value = arguments[1];
      arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
      arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
    `, promptInput, prompt);

    const aInput = await waitForVisible(this.driver, this.inputOptA, 5000);
    await this.driver.executeScript(`
      arguments[0].value = arguments[1];
      arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
      arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
    `, aInput, optA);

    const bInput = await waitForVisible(this.driver, this.inputOptB, 5000);
    await this.driver.executeScript(`
      arguments[0].value = arguments[1];
      arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
      arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
    `, bInput, optB);

    const cInput = await waitForVisible(this.driver, this.inputOptC, 5000);
    await this.driver.executeScript(`
      arguments[0].value = arguments[1];
      arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
      arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
    `, cInput, optC);

    const dInput = await waitForVisible(this.driver, this.inputOptD, 5000);
    await this.driver.executeScript(`
      arguments[0].value = arguments[1];
      arguments[0].dispatchEvent(new Event('input', { bubbles: true }));
      arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
    `, dInput, optD);

    const sel = await waitForVisible(this.driver, this.selectCorrect, 5000);
    await this.driver.executeScript(`
      arguments[0].value = arguments[1];
      arguments[0].dispatchEvent(new Event('change', { bubbles: true }));
    `, sel, String(correctIndex));

    const submitBtn = await waitForVisible(this.driver, this.btnSubmitQuestion, 5000);
    await this.driver.executeScript("arguments[0].click();", submitBtn);
    await waitForHidden(this.driver, this.modalQuestionForm, 5000);
  }

  /**
   * Close the Questions Manager modal.
   */
  async closeQuestionsManager() {
    const btn = await waitForVisible(this.driver, this.btnCloseQuestionsManager, 5000);
    await this.driver.executeScript("arguments[0].click();", btn);
    await waitForHidden(this.driver, this.modalQuestionsManager, 5000);
  }

  /**
   * Publish a quiz from the table.
   * @param {string} title
   */
  async publishQuiz(title) {
    const row = await this.findQuizRow(title);
    if (!row) throw new Error(`Quiz '${title}' not found in table`);
    const pubBtn = await row.findElement(By.xpath(".//button[contains(text(), 'Publish')]"));
    await this.driver.executeScript("arguments[0].click();", pubBtn);
  }

  /**
   * Retrieve any alert message displayed in the Admin section.
   * Explicitly waits until alert container is visible and text is non-empty.
   * @returns {Promise<string>}
   */
  async getAlertMessage() {
    const el = await waitForVisible(this.driver, this.adminAlert, 5000);
    await this.driver.wait(async () => {
      const text = await el.getText();
      return text.trim().length > 0;
    }, 5000, 'Admin alert text remained empty');
    return await el.getText();
  }

  /**
   * Switch tab to Student Submissions Audit.
   */
  async openSubmissionsTab() {
    const btn = await waitForVisible(this.driver, this.tabBtnSubs, 5000);
    await this.driver.executeScript("arguments[0].click();", btn);
    await waitForVisible(this.driver, this.subsTbody, 5000);
  }

  /**
   * Open the detailed audit modal for a student's submission.
   * @param {string} studentName
   */
  async viewSubmissionAudit(studentName) {
    await this.openSubmissionsTab();
    const rows = await this.driver.findElements(By.css('#admin-submissions-tbody tr'));
    for (const r of rows) {
      const text = await r.getText();
      if (text.includes(studentName)) {
        const viewBtn = await r.findElement(By.xpath(".//button[contains(text(), 'View')]"));
        await this.driver.executeScript("arguments[0].click();", viewBtn);
        await waitForVisible(this.driver, this.modalSubmissionDetail, 5000);
        return;
      }
    }
    throw new Error(`Submission for student '${studentName}' not found`);
  }

  /**
   * Retrieve the audit detail content from the modal.
   * @returns {Promise<string>}
   */
  async getSubmissionAuditDetails() {
    const body = await waitForVisible(this.driver, this.submissionDetailBody, 5000);
    return await body.getText();
  }

  /**
   * Close the student submission audit modal.
   */
  async closeSubmissionAudit() {
    const btn = await waitForVisible(this.driver, this.btnCloseSubmissionDetail, 5000);
    await this.driver.executeScript("arguments[0].click();", btn);
    await waitForHidden(this.driver, this.modalSubmissionDetail, 5000);
  }
}

module.exports = QuizManagementPage;

