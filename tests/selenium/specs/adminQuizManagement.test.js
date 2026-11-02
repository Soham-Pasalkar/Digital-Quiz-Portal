/**
 * Digital Quiz Portal - Selenium WebDriver Spec: Administrator Workflows
 * [SEL-05 .. SEL-10]: Metrics inspection, quiz creation, question authoring, publishing,
 *                     TC-06 empty quiz guard, and student submission audit verification.
 */

const assert = require('assert');
const LoginPage = require('../pages/LoginPage');
const AdminDashboardPage = require('../pages/AdminDashboardPage');
const QuizManagementPage = require('../pages/QuizManagementPage');

module.exports = {
  suiteName: 'Administrator Assessment Management',
  tests: [
    {
      id: 'SEL-05',
      name: 'Admin dashboard loads and renders actual overview KPI metrics and charts',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const adminPage = new AdminDashboardPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('admin', 'admin123');
        await adminPage.waitForLoaded();

        const metrics = await adminPage.getMetrics();
        assert.ok(metrics.students >= 2, `Expected at least 2 seeded students, found ${metrics.students}`);
        assert.ok(metrics.quizzes >= 2, `Expected at least 2 seeded quizzes, found ${metrics.quizzes}`);
        assert.ok(metrics.published >= 1, `Expected at least 1 published quiz, found ${metrics.published}`);

        const chartRendered = await adminPage.isOutcomesChartRendered();
        assert.strictEqual(chartRendered, true, 'Native SVG outcomes chart should be rendered in dashboard');

        await adminPage.logout();
      }
    },
    {
      id: 'SEL-06',
      name: 'Admin creates a draft quiz with custom title and duration',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const adminPage = new AdminDashboardPage(driver, baseUrl);
        const quizPage = new QuizManagementPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('admin', 'admin123');
        await adminPage.waitForLoaded();

        const uniqueTitle = `Selenium Architecture Evaluation ${Date.now()}`;
        await quizPage.createQuiz(uniqueTitle, 15);

        const status = await quizPage.getQuizStatus(uniqueTitle);
        assert.match(status, /draft/i, 'Newly created quiz should start in Draft state');

        await adminPage.logout();
      }
    },
    {
      id: 'SEL-07',
      name: 'Admin adds questions and options to a draft quiz',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const adminPage = new AdminDashboardPage(driver, baseUrl);
        const quizPage = new QuizManagementPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('admin', 'admin123');
        await adminPage.waitForLoaded();

        const testQuizTitle = `Selenium Question Bank Test ${Date.now()}`;
        await quizPage.createQuiz(testQuizTitle, 12);

        await quizPage.openQuestionsManager(testQuizTitle);
        await quizPage.addQuestion({
          prompt: 'What protocol does Selenium 4 WebDriver use natively for browser communication?',
          optA: 'W3C WebDriver Standard Specification',
          optB: 'Legacy JSON Wire Protocol over HTTP',
          optC: 'Direct Memory Manipulation (JNI)',
          optD: 'Flash Player NPAPI Bridge',
          correctIndex: 0
        });

        // Verify question item appears in list
        const listText = await driver.findElement(quizPage.modalQuestionsManager).getText();
        assert.ok(listText.includes('W3C WebDriver Standard Specification'), 'Added question option should appear in manager');

        await quizPage.closeQuestionsManager();
        await adminPage.logout();
      }
    },
    {
      id: 'SEL-08',
      name: 'Admin publishes a valid quiz with questions successfully',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const adminPage = new AdminDashboardPage(driver, baseUrl);
        const quizPage = new QuizManagementPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('admin', 'admin123');
        await adminPage.waitForLoaded();

        const publishQuizTitle = `Selenium Publish Test ${Date.now()}`;
        await quizPage.createQuiz(publishQuizTitle, 10);
        await quizPage.openQuestionsManager(publishQuizTitle);
        await quizPage.addQuestion({
          prompt: 'Which method in Selenium is used to close the browser session?',
          optA: 'driver.quit()',
          optB: 'driver.stop()',
          optC: 'driver.end()',
          optD: 'driver.kill()',
          correctIndex: 0
        });
        await quizPage.closeQuestionsManager();

        await quizPage.publishQuiz(publishQuizTitle);
        await driver.sleep(600); // Allow table refresh

        const status = await quizPage.getQuizStatus(publishQuizTitle);
        assert.match(status, /published/i, 'Quiz status should transition to Published');

        await adminPage.logout();
      }
    },
    {
      id: 'SEL-09',
      name: 'Admin cannot publish an empty quiz (TC-06 Empty Quiz Guard)',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const adminPage = new AdminDashboardPage(driver, baseUrl);
        const quizPage = new QuizManagementPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('admin', 'admin123');
        await adminPage.waitForLoaded();

        const emptyQuizTitle = `Empty Draft Quiz ${Date.now()}`;
        await quizPage.createQuiz(emptyQuizTitle, 10);

        // Attempt publishing without adding any questions
        await quizPage.publishQuiz(emptyQuizTitle);
        await driver.sleep(600);

        const alertText = await quizPage.getAlertMessage();
        assert.match(alertText, /at least one question|cannot publish.*empty/i, 'Should display alert rejecting empty quiz publication');

        const status = await quizPage.getQuizStatus(emptyQuizTitle);
        assert.match(status, /draft/i, 'Quiz status must strictly remain Draft');

        await adminPage.logout();
      }
    },
    {
      id: 'SEL-10',
      name: 'Admin can inspect student submission records and detailed answer audit trail',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const adminPage = new AdminDashboardPage(driver, baseUrl);
        const quizPage = new QuizManagementPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('admin', 'admin123');
        await adminPage.waitForLoaded();

        // Seeded submission exists for student1
        await quizPage.viewSubmissionAudit('student1');
        const auditText = await quizPage.getSubmissionAuditDetails();

        assert.ok(auditText.includes('student1'), 'Audit details must show student username');
        assert.match(auditText, /Assessment Result|PASSED|FAILED/i, 'Audit details must show outcome badge');
        assert.match(auditText, /Final Score/i, 'Audit details must show score');

        await quizPage.closeSubmissionAudit();
        await adminPage.logout();
      }
    }
  ]
};

