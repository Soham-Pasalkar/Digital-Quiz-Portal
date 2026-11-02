/**
 * Digital Quiz Portal - Selenium WebDriver Spec: Authentication & Session Lifecycle
 * [SEL-01 .. SEL-04]: Valid logins, invalid credentials rejection, role assignment, and logout invalidation.
 */

const assert = require('assert');
const LoginPage = require('../pages/LoginPage');
const AdminDashboardPage = require('../pages/AdminDashboardPage');
const StudentDashboardPage = require('../pages/StudentDashboardPage');

module.exports = {
  suiteName: 'Authentication & Session Lifecycle',
  tests: [
    {
      id: 'SEL-01',
      name: 'Admin login with valid credentials redirects to Admin Dashboard with metrics',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const adminPage = new AdminDashboardPage(driver, baseUrl);

        await loginPage.open();
        assert.strictEqual(await loginPage.isDisplayed(), true, 'Login view should be displayed initially');

        await loginPage.login('admin', 'admin123');
        await adminPage.waitForLoaded();

        assert.strictEqual(await adminPage.isDisplayed(), true, 'Admin view should be displayed after valid admin login');
        const greeting = await adminPage.getGreetingText();
        assert.match(greeting, /admin/i, 'Admin greeting should reference admin account');

        // Cleanup: logout
        await adminPage.logout();
      }
    },
    {
      id: 'SEL-02',
      name: 'Invalid credentials display appropriate alert and keep user unauthenticated',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('admin', 'incorrectPassword999');

        const errorMsg = await loginPage.getErrorMessage();
        assert.match(errorMsg, /invalid username or password|invalid credentials/i, 'Error message should clearly state Invalid credentials');
        assert.strictEqual(await loginPage.isDisplayed(), true, 'User should remain on login view after failed attempt');
      }
    },
    {
      id: 'SEL-03',
      name: 'Student login with valid credentials redirects to Student Dashboard',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const studentPage = new StudentDashboardPage(driver, baseUrl);

        await loginPage.open();
        await loginPage.login('student1', 'student123');
        await studentPage.waitForLoaded();

        assert.strictEqual(await studentPage.isDisplayed(), true, 'Student view should be displayed after valid student login');
        const welcome = await studentPage.getWelcomeName();
        assert.match(welcome, /student1/i, 'Student welcome header should display student username');

        // Cleanup: logout
        await studentPage.logout();
      }
    },
    {
      id: 'SEL-04',
      name: 'Logout invalidates active session and redirects to login view',
      async run(driver, baseUrl) {
        const loginPage = new LoginPage(driver, baseUrl);
        const adminPage = new AdminDashboardPage(driver, baseUrl);

        // Login as admin
        await loginPage.open();
        await loginPage.login('admin', 'admin123');
        await adminPage.waitForLoaded();

        // Perform logout
        await adminPage.logout();

        assert.strictEqual(await loginPage.isDisplayed(), true, 'Login view should be visible after logout');

        // Verify session token is removed from sessionStorage
        const token = await driver.executeScript("return sessionStorage.getItem('quiz_portal_session_token') || sessionStorage.getItem('dqp_token');");
        assert.strictEqual(token, null, 'Session token should be completely evicted from sessionStorage');
      }
    }
  ]
};

