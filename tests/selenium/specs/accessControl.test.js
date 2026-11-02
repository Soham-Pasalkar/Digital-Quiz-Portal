/**
 * Digital Quiz Portal - Selenium WebDriver Spec: Timer Integrity & Access Control
 * [SEL-16 .. SEL-18]: Timer persistence across page refresh, role-based route guard isolation,
 *                     and cross-student examination result access prevention.
 */

const assert = require('assert');
const LoginPage = require('../pages/LoginPage');
const StudentDashboardPage = require('../pages/StudentDashboardPage');
const ExamPage = require('../pages/ExamPage');
const AdminDashboardPage = require('../pages/AdminDashboardPage');

module.exports = {
  suiteName: 'Timer Integrity & Access Control Security',
  tests: [
    {
      id: 'SEL-16',
      name: 'Refreshing active examination preserves server-authoritative expiration without timer reset',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const studentPage = new StudentDashboardPage(driver, baseUrl);
        const examPage = new ExamPage(driver, baseUrl);

        // Login as student1
        await loginPage.open();
        await loginPage.login('student1', 'student123');
        await studentPage.waitForLoaded();

        // Start Quiz 2 (Cloud Architecture)
        await studentPage.startQuiz('Cloud Architecture');
        await examPage.waitForLoaded();

        // Read initial countdown timer
        const timerBefore = await examPage.getRemainingTime();
        assert.match(timerBefore, /^\d{2}:\d{2}$/, 'Timer should show valid countdown format');

        // Wait 2 seconds
        await driver.sleep(2000);

        // Execute browser refresh
        await examPage.refresh();

        // Read countdown timer after reload
        const timerAfter = await examPage.getRemainingTime();
        assert.match(timerAfter, /^\d{2}:\d{2}$/, 'Timer should still show valid countdown format after reload');

        // Parse seconds
        const [mBefore, sBefore] = timerBefore.split(':').map(Number);
        const [mAfter, sAfter] = timerAfter.split(':').map(Number);
        const totalBefore = mBefore * 60 + sBefore;
        const totalAfter = mAfter * 60 + sAfter;

        // Timer must strictly NOT reset to a higher initial time (e.g. 15:00)
        assert.ok(totalAfter <= totalBefore, `Timer reset detected! Before: ${timerBefore}, After: ${timerAfter}`);

        const login = new LoginPage(driver, baseUrl);
        await login.open();
      }
    },
    {
      id: 'SEL-17',
      name: 'Student cannot access administrator functionality (Route Guard redirects to #student)',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const studentPage = new StudentDashboardPage(driver, baseUrl);
        const adminPage = new AdminDashboardPage(driver, baseUrl);

        // Login as student1
        await loginPage.open();
        await loginPage.login('student1', 'student123');
        await studentPage.waitForLoaded();

        // Attempt direct URL tampering to #admin
        await driver.get(`${baseUrl}/#admin`);
        await driver.sleep(600); // Allow router guard to intercept

        // Must be redirected back to #student
        const currentUrl = await driver.getCurrentUrl();
        assert.ok(currentUrl.endsWith('#student'), `Route guard failed: Expected redirect to #student, current: ${currentUrl}`);

        // Admin view container must remain hidden
        const isAdminVisible = await adminPage.isDisplayed();
        assert.strictEqual(isAdminVisible, false, 'Admin view container must strictly remain hidden to students');

        await studentPage.logout();
      }
    },
    {
      id: 'SEL-18',
      name: 'Student cannot access another student examination records or results',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const studentPage = new StudentDashboardPage(driver, baseUrl);

        // Login as student2
        await loginPage.open();
        await loginPage.login('student2', 'student123');
        await studentPage.waitForLoaded();

        // Student 1 has seeded submission #1 in the database.
        // Student 2 attempts to fetch Student 1's submission details directly via API bridge
        const accessAttempt = await driver.executeAsyncScript((done) => {
          window.API.get('/api/attempts/1/results')
            .then(res => done({ success: true, res }))
            .catch(err => done({ success: false, error: err.message, status: err.status }));
        });

        // Must fail with access denied (HTTP 403)
        assert.strictEqual(accessAttempt.success, false, 'Student 2 must not be able to read Student 1 results');
        assert.match(accessAttempt.error, /Access denied|not authorized/i, 'Error message must confirm access denied');

        await studentPage.logout();
      }
    }
  ]
};

