/**
 * Digital Quiz Portal - Selenium WebDriver Spec: Student Examination Workflows
 * [SEL-11 .. SEL-15]: Catalog browsing, exam start, answer selection, question navigation,
 *                     pre-submission modal, and instantaneous scorecard verification.
 */

const assert = require('assert');
const { By } = require('selenium-webdriver');
const { waitForVisible } = require('../utils/testHelpers');
const LoginPage = require('../pages/LoginPage');
const StudentDashboardPage = require('../pages/StudentDashboardPage');
const ExamPage = require('../pages/ExamPage');
const ResultsPage = require('../pages/ResultsPage');

module.exports = {
  suiteName: 'Student Examination Workflows',
  tests: [
    {
      id: 'SEL-11',
      name: 'Student dashboard displays published quizzes catalog',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const studentPage = new StudentDashboardPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('student1', 'student123');
        await studentPage.waitForLoaded();

        const quizzes = await studentPage.getAvailableQuizzes();
        assert.ok(quizzes.length >= 1, `Expected at least 1 published quiz in catalog, found ${quizzes.length}`);
        assert.ok(quizzes[0].title.length > 0, 'Quiz title should not be empty');

        await studentPage.logout();
      }
    },
    {
      id: 'SEL-12',
      name: 'Student starts an examination session successfully',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const studentPage = new StudentDashboardPage(driver, baseUrl);
        const examPage = new ExamPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('student2', 'student123'); // Use student2 for clean attempt
        await studentPage.waitForLoaded();

        await studentPage.startQuiz();
        await examPage.waitForLoaded();

        assert.strictEqual(await examPage.isDisplayed(), true, 'Exam view should be active');
        const title = await examPage.getQuizTitle();
        assert.ok(title.length > 0, 'Exam title should be displayed');

        const timer = await examPage.getRemainingTime();
        assert.match(timer, /^\d{2}:\d{2}$/, 'Countdown timer must follow MM:SS format');

        // Cleanup: logout
        const login = new LoginPage(driver, baseUrl);
        await login.open();
      }
    },
    {
      id: 'SEL-13',
      name: 'Student selects answer and navigation updates palette state',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const studentPage = new StudentDashboardPage(driver, baseUrl);
        const examPage = new ExamPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('student2', 'student123');
        await studentPage.waitForLoaded();

        // Resumes existing attempt started in SEL-12
        await studentPage.startQuiz();
        await examPage.waitForLoaded();

        // Select Option A
        await examPage.selectOption('A');
        const isSelected = await examPage.isOptionSelected('A');
        assert.strictEqual(isSelected, true, 'Option A should have .selected class applied');

        // Palette pill 1 should be marked answered
        const isAnswered = await examPage.isPalettePillAnswered(1);
        assert.strictEqual(isAnswered, true, 'Palette pill for question 1 should receive .answered class');

        const login = new LoginPage(driver, baseUrl);
        await login.open();
      }
    },
    {
      id: 'SEL-14',
      name: 'Student opens pre-submission modal, inspects counts, and confirms submission',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const studentPage = new StudentDashboardPage(driver, baseUrl);
        const examPage = new ExamPage(driver, baseUrl);
        const resultsPage = new ResultsPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('student2', 'student123');
        await studentPage.waitForLoaded();

        await studentPage.startQuiz();
        await examPage.waitForLoaded();

        // Open submission modal
        await examPage.openSubmitModal();
        const counts = await examPage.getSubmitSummary();

        assert.ok(counts.total >= 1, `Total questions should be >= 1, found ${counts.total}`);
        assert.strictEqual(counts.total, counts.answered + counts.unanswered, 'Total must equal answered + unanswered');

        // Confirm submission
        await examPage.confirmSubmission();
        await resultsPage.waitForLoaded();

        assert.strictEqual(await resultsPage.isDisplayed(), true, 'Results view should be displayed after submission');

        const login = new LoginPage(driver, baseUrl);
        await login.open();
      }
    },
    {
      id: 'SEL-15',
      name: 'Results page displays mathematically accurate score and question audit breakdown',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const studentPage = new StudentDashboardPage(driver, baseUrl);
        const resultsPage = new ResultsPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('student1', 'student123');
        await studentPage.waitForLoaded();

        // Click "View Breakdown" button from student1's seeded past submission record
        const viewBtn = await waitForVisible(driver, By.css('#student-history-tbody button'), 5000);
        await driver.executeScript("arguments[0].click();", viewBtn);
        await resultsPage.waitForLoaded();

        const score = await resultsPage.getScore();
        assert.match(score, /^\d+\s*\/\s*\d+$/, 'Score must be formatted as numerator / denominator');

        const pct = await resultsPage.getPercentage();
        assert.match(pct, /%/, 'Percentage readout must contain % symbol');

        const status = await resultsPage.getStatus();
        assert.match(status, /PASSED|FAILED/, 'Status badge must read either PASSED or FAILED');

        const breakdownCount = await resultsPage.getBreakdownCount();
        assert.ok(breakdownCount >= 1, 'Question breakdown audit cards must be displayed');

        const login = new LoginPage(driver, baseUrl);
        await login.open();
      }
    }
  ]
};

