/**
 * Digital Quiz Portal - Selenium WebDriver Test Runner
 * [STQA Academic Demonstration]: Executes 18 End-to-End Page Object Model Specs.
 */

const fs = require('fs');
const path = require('path');
const { createDriver } = require('./config/driver');
const { startTestServer, stopTestServer, takeScreenshot } = require('./utils/testHelpers');

// Spec Suites
const authSpec = require('./specs/authentication.test');
const adminSpec = require('./specs/adminQuizManagement.test');
const studentSpec = require('./specs/studentExamination.test');
const accessSpec = require('./specs/accessControl.test');

// Page Object Models for Evidence Screenshots
const LoginPage = require('./pages/LoginPage');
const AdminDashboardPage = require('./pages/AdminDashboardPage');
const StudentDashboardPage = require('./pages/StudentDashboardPage');
const ExamPage = require('./pages/ExamPage');
const QuizManagementPage = require('./pages/QuizManagementPage');

const SUITES = [authSpec, adminSpec, studentSpec, accessSpec];
const TEST_PORT = 3500;

async function runSeleniumSuite() {
  console.log('================================================================');
  console.log('DIGITAL QUIZ PORTAL - SELENIUM 4 WEBDRIVER AUTOMATION SUITE');
  console.log('Framework: Selenium WebDriver (W3C Standard) | Browser: Chrome');
  console.log('Design Pattern: Page Object Model (POM) | Database: In-Memory');
  console.log('================================================================\n');

  let server;
  let db;
  let driver;
  let totalPassed = 0;
  let totalFailed = 0;
  const testResults = [];
  const startTime = Date.now();

  try {
    // 1. Boot isolated test server
    console.log(`[1/3] Initializing isolated in-memory test environment...`);
    const env = await startTestServer(TEST_PORT);
    server = env.server;
    db = env.db;
    const baseUrl = env.url;
    console.log(`      ✓ Test server listening at ${baseUrl} with isolated in-memory database.`);

    // 2. Initialize Chrome WebDriver
    console.log(`[2/3] Launching Selenium 4 Chrome WebDriver...`);
    driver = await createDriver();
    const capabilities = await driver.getCapabilities();
    const browserName = capabilities.getBrowserName();
    const browserVersion = capabilities.getBrowserVersion();
    console.log(`      ✓ WebDriver session active: ${browserName} v${browserVersion}\n`);

    // 3. Execute Suites
    console.log(`[3/3] Executing 18 Selenium Test Scenarios across 4 Spec Suites...\n`);

    for (const suite of SUITES) {
      console.log(`----------------------------------------------------------------`);
      console.log(`Suite: ${suite.suiteName}`);
      console.log(`----------------------------------------------------------------`);

      for (const t of suite.tests) {
        process.stdout.write(`  [${t.id}] ${t.name} ... `);
        const testStart = Date.now();
        try {
          await t.run(driver, baseUrl);
          const elapsed = Date.now() - testStart;
          console.log(`✓ PASS (${elapsed} ms)`);
          totalPassed++;
          testResults.push({ id: t.id, name: t.name, passed: true, elapsed });
        } catch (err) {
          const elapsed = Date.now() - testStart;
          console.log(`✗ FAIL (${elapsed} ms)`);
          console.error(`      Error: ${err.message}`);
          totalFailed++;
          testResults.push({ id: t.id, name: t.name, passed: false, elapsed, error: err.message });

          // Capture failure screenshot
          try {
            const failPath = await takeScreenshot(driver, `failure_${t.id}.png`);
            console.log(`      📸 Failure screenshot captured: ${failPath}`);
          } catch (ssErr) {
            console.error(`      Failed to capture screenshot: ${ssErr.message}`);
          }
        }
      }
      console.log();
    }

    // 4. Capture Academic Demonstration Screenshots
    console.log(`[Evidence] Capturing canonical Selenium academic demonstration screenshots...`);
    try {
      const loginPage = new LoginPage(driver, baseUrl);
      const adminPage = new AdminDashboardPage(driver, baseUrl);
      const studentPage = new StudentDashboardPage(driver, baseUrl);
      const examPage = new ExamPage(driver, baseUrl);
      const quizPage = new QuizManagementPage(driver, baseUrl);

      // Admin Dashboard Screenshot
      await loginPage.open();
      await loginPage.login('admin', 'admin123');
      await adminPage.waitForLoaded();
      await takeScreenshot(driver, 'selenium_admin_dashboard.png');

      // Quiz Management Screenshot
      await quizPage.openManagementView();
      await takeScreenshot(driver, 'selenium_quiz_management.png');

      // Logout Admin
      await adminPage.logout();

      // Student Dashboard Screenshot
      await loginPage.open();
      await loginPage.login('student1', 'student123');
      await studentPage.waitForLoaded();
      await takeScreenshot(driver, 'selenium_student_dashboard.png');

      // Exam View Screenshot
      await studentPage.startQuiz();
      await examPage.waitForLoaded();
      await takeScreenshot(driver, 'selenium_exam_session.png');

      console.log(`      ✓ 4 canonical screenshots captured in docs/stqa/screenshots/\n`);
    } catch (e) {
      console.warn(`      (Screenshot capture warning: ${e.message})`);
    }

  } finally {
    // 5. Cleanup
    if (driver) {
      try {
        await driver.quit();
      } catch (e) {
        console.error('Error closing driver:', e.message);
      }
    }
    await stopTestServer(server, db);
  }

  // 6. Print Report Summary
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('================================================================');
  console.log('SELENIUM WEBDRIVER EXECUTION SUMMARY');
  console.log('================================================================');
  console.log(`Total Scenarios Executed: ${testResults.length}`);
  console.log(`Passed:                   ${totalPassed}`);
  console.log(`Failed:                   ${totalFailed}`);
  console.log(`Total Suite Duration:     ${totalElapsed} s`);
  console.log('----------------------------------------------------------------');

  if (totalFailed > 0) {
    console.error(`\n❌ SELENIUM SUITE FAILED with ${totalFailed} defect(s).`);
    process.exit(1);
  } else {
    console.log(`\n✅ ALL 18 SELENIUM WEBDRIVER SCENARIOS PASSED SUCCESSFULLY.`);
    process.exit(0);
  }
}

runSeleniumSuite().catch(err => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});

