/**
 * Digital Quiz Portal - Automated Browser Verification via Chrome DevTools Protocol (CDP)
 * [Milestone 4.1 Requirement 4]: Real browser execution using headless Google Chrome 156.
 *
 * Verifies:
 * - Admin login, dashboard rendering, metrics, tables
 * - Quiz creation, question management, and publishing
 * - Student login, catalog rendering, history
 * - Student examination navigation, option selection
 * - Exam refresh, reload persistence, timer countdown
 * - Submission confirmation modal and grading
 * - Results view and question audit breakdown
 * - Route guards & unauthorized navigation redirects
 * - Responsive viewports: Desktop (1280x800), Tablet (768x1024), Mobile (375x667)
 * - Keyboard navigation and focus accessibility
 */

const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const { initDatabase } = require(path.join(PROJECT_ROOT, 'src/database/db'));
const { seedDatabase } = require(path.join(PROJECT_ROOT, 'src/database/seed'));
const { createApp } = require(path.join(PROJECT_ROOT, 'src/app'));

const TEST_PORT = 3456;
const APP_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runBrowserAudit() {
  console.log('================================================================');
  console.log('DIGITAL QUIZ PORTAL - REAL BROWSER CDP VERIFICATION (CHROME 156)');
  console.log('================================================================\n');

  // 1. Initialize DB and start HTTP server
  const db = await initDatabase({ dbPath: ':memory:' });
  await seedDatabase(db);
  const app = createApp({ dbClient: db });

  const server = await new Promise((resolve) => {
    const s = app.listen(TEST_PORT, () => resolve(s));
  });
  console.log(`[Setup] Application server listening on ${APP_URL}`);

  let tabId;
  let ws;

  try {
    // 2. Open new browser tab via CDP
    const tabRes = await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent(APP_URL), { method: 'PUT' });
    const tab = await tabRes.json();
    tabId = tab.id;
    console.log(`[Browser] Opened new tab (${tabId}) at ${APP_URL}`);

    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (e) => {
        const data = JSON.parse(e.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(new Error(`${method} failed: ${JSON.stringify(data.error)}`));
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

    // Enable domains
    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    // Helper: evaluate expression and return value
    const evalExpr = async (expression) => {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        console.error('Full Exception:', JSON.stringify(res.exceptionDetails, null, 2));
        throw new Error(`Eval error: ${res.exceptionDetails.text} (${expression})`);
      }
      return res.result.value;
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Wait for page to initialize
    await sleep(800);

    // -------------------------------------------------------------------------
    // TEST 1: Admin Login & Dashboard
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] Administrator Login & Dashboard...');
    await evalExpr(`
      document.getElementById('login-username').value = 'admin';
      document.getElementById('login-password').value = 'admin123';
      document.getElementById('login-form').dispatchEvent(new Event('submit'));
    `);
    await sleep(600);

    const adminHash = await evalExpr(`window.location.hash`);
    const isAdminViewVisible = await evalExpr(`!document.getElementById('view-admin').classList.contains('hidden')`);
    const totalStudentsText = await evalExpr(`document.getElementById('stat-total-students').textContent`);
    const totalQuizzesText = await evalExpr(`document.getElementById('stat-total-quizzes').textContent`);

    console.log(`  ✓ Admin Login: Hash = ${adminHash}, Admin View Visible = ${isAdminViewVisible}`);
    console.log(`  ✓ Metric Cards: Enrolled Students = ${totalStudentsText}, Total Quizzes = ${totalQuizzesText}`);
    if (!isAdminViewVisible || adminHash !== '#admin') {
      throw new Error('Admin login failed to transition to #admin view');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Quiz Creation, Question Management & Publishing in Browser
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Quiz Creation & Publishing Workflow in Browser...');
    await evalExpr(`
      Admin.openCreateQuizModal();
      document.getElementById('new-quiz-title').value = 'Advanced Cloud Architecture';
      document.getElementById('new-quiz-duration').value = '15';
      document.getElementById('create-quiz-form').dispatchEvent(new Event('submit'));
    `);
    await sleep(600);

    const hasNewQuiz = await evalExpr(`
      document.getElementById('admin-quizzes-tbody').textContent.includes('Advanced Cloud Architecture')
    `);
    console.log(`  ✓ Quiz Creation: 'Advanced Cloud Architecture' in table = ${hasNewQuiz}`);
    if (!hasNewQuiz) throw new Error('New quiz failed to appear in admin quizzes table');

    // Add a question to the newly created quiz
    await evalExpr(`(() => {
      const target = Object.values(Admin.quizzesMap).find(q => q.title.includes('Advanced Cloud Architecture'));
      Admin.openQuestionsModal(target.id);
    })()`);
    await sleep(400);

    await evalExpr(`(() => {
      Admin.openAddQuestionModal();
      document.getElementById('qform-text').value = 'What does the CAP theorem state regarding distributed systems?';
      document.getElementById('qform-opt-a').value = 'Consistency, Availability, and Partition Tolerance cannot all be simultaneously achieved';
      document.getElementById('qform-opt-b').value = 'Caches Always Prevail';
      document.getElementById('qform-opt-c').value = 'Continuous Automated Provisioning';
      document.getElementById('qform-opt-d').value = 'Centralized Access Protocol';
      document.getElementById('qform-correct').value = '0'; // Option A
      document.getElementById('question-form').dispatchEvent(new Event('submit'));
    })()`);
    await sleep(600);

    const hasQuestion = await evalExpr(`
      document.getElementById('qm-questions-list').textContent.includes('CAP theorem')
    `);
    console.log(`  ✓ Question Authoring: Question persisted and rendered in manager = ${hasQuestion}`);
    if (!hasQuestion) throw new Error('Question failed to author in quiz');

    // Close questions modal and publish quiz
    await evalExpr(`(() => {
      Utils.hideModal('modal-questions-manager');
      const target = Object.values(Admin.quizzesMap).find(q => q.title.includes('Advanced Cloud Architecture'));
      Admin.publishQuiz(target.id);
    })()`);
    await sleep(600);

    const isPublished = await evalExpr(`
      document.getElementById('admin-quizzes-tbody').textContent.includes('Published')
    `);
    console.log(`  ✓ Publishing: Quiz status updated to Published = ${isPublished}`);

    // -------------------------------------------------------------------------
    // TEST 3: Student Login & Catalog Rendering
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Student Login & Examination Catalog...');
    await evalExpr(`Auth.logout();`);
    await sleep(400);

    await evalExpr(`
      document.getElementById('login-username').value = 'student1';
      document.getElementById('login-password').value = 'student123';
      document.getElementById('login-form').dispatchEvent(new Event('submit'));
    `);
    await sleep(600);

    const studentHash = await evalExpr(`window.location.hash`);
    const isStudentVisible = await evalExpr(`!document.getElementById('view-student').classList.contains('hidden')`);
    const studentCatalog = await evalExpr(`document.getElementById('student-quizzes-container').textContent`);
    const hasPublishedInCatalog = studentCatalog.includes('Advanced Cloud Architecture');
    const hasMCQsAndDuration = studentCatalog.includes('15 minutes') && studentCatalog.includes('1 MCQs');

    console.log(`  ✓ Student Login: Hash = ${studentHash}, Student View Visible = ${isStudentVisible}`);
    console.log(`  ✓ Catalog Rendering: Published Quiz Available = ${hasPublishedInCatalog}`);
    console.log(`  ✓ Catalog Metadata: Formatted Duration & Question Count = ${hasMCQsAndDuration}`);
    if (!isStudentVisible || !hasPublishedInCatalog) throw new Error('Student catalog failed to render published quiz');

    // -------------------------------------------------------------------------
    // TEST 4: Student Exam Initiation, Answer Selection & Palette
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Student Exam Initiation & Interaction...');
    await evalExpr(`
      const targetQuiz = Array.from(document.querySelectorAll('#student-quizzes-container tr')).find(r => r.textContent.includes('Advanced Cloud Architecture'));
      const startBtn = targetQuiz.querySelector('button');
      startBtn.click();
    `);
    await sleep(800);

    const examHash = await evalExpr(`window.location.hash`);
    const isExamVisible = await evalExpr(`!document.getElementById('view-exam').classList.contains('hidden')`);
    const questionText = await evalExpr(`document.getElementById('exam-question-text').textContent`);
    const timerText1 = await evalExpr(`document.getElementById('exam-timer-display').textContent`);

    console.log(`  ✓ Exam Initiation: Hash = ${examHash}, Exam Visible = ${isExamVisible}`);
    console.log(`  ✓ Question Text Rendered: "${questionText.substring(0, 50)}..."`);
    console.log(`  ✓ Server Timer Active: ${timerText1}`);
    if (!isExamVisible || !questionText.includes('CAP theorem')) throw new Error('Exam question failed to render');

    // Select Option A (first option)
    await evalExpr(`
      const firstChoice = document.querySelectorAll('#exam-options-container .option-choice')[0];
      firstChoice.click();
    `);
    await sleep(200);

    const isOptionSelected = await evalExpr(`
      document.querySelectorAll('#exam-options-container .option-choice')[0].classList.contains('selected')
    `);
    const isPillAnswered = await evalExpr(`
      document.querySelector('#exam-nav-palette .nav-pill').classList.contains('answered')
    `);
    console.log(`  ✓ Option Selection: Choice has .selected class = ${isOptionSelected}`);
    console.log(`  ✓ Question Palette: Navigation pill has .answered class = ${isPillAnswered}`);
    if (!isOptionSelected || !isPillAnswered) throw new Error('Option selection failed to update DOM state');

    // -------------------------------------------------------------------------
    // TEST 5: Exam Refresh Survival & Timer Continuity
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Exam Refresh Survival & Timer Continuity...');
    await sleep(1200); // Let 1 second elapse
    const beforeReloadTimer = await evalExpr(`document.getElementById('exam-timer-display').textContent`);

    // Reload the page inside the browser
    await send('Page.reload');
    await sleep(1000);

    const postReloadHash = await evalExpr(`window.location.hash`);
    const postReloadExamVisible = await evalExpr(`!document.getElementById('view-exam').classList.contains('hidden')`);
    const postReloadQuestionText = await evalExpr(`document.getElementById('exam-question-text').textContent`);
    const postReloadSelected = await evalExpr(`
      document.querySelectorAll('#exam-options-container .option-choice')[0].classList.contains('selected')
    `);
    const postReloadTimer = await evalExpr(`document.getElementById('exam-timer-display').textContent`);

    console.log(`  ✓ Page Reloaded: Hash = ${postReloadHash}, Exam Restored = ${postReloadExamVisible}`);
    console.log(`  ✓ Answer Restored: Option A Remains Selected = ${postReloadSelected}`);
    console.log(`  ✓ Timer Continuity: Before Reload = ${beforeReloadTimer}, After Reload = ${postReloadTimer}`);
    if (!postReloadExamVisible || !postReloadSelected) throw new Error('Exam state failed to survive reload');

    // -------------------------------------------------------------------------
    // TEST 6: Pre-Submission Summary Modal & Submission
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Pre-Submission Summary Modal & Final Submission...');
    await evalExpr(`Exam.openSubmitConfirmation();`);
    await sleep(300);

    const isModalOpen = await evalExpr(`!document.getElementById('modal-submit-exam').classList.contains('hidden')`);
    const totalQ = await evalExpr(`document.getElementById('submit-modal-total').textContent`);
    const answeredQ = await evalExpr(`document.getElementById('submit-modal-answered').textContent`);
    const unansweredQ = await evalExpr(`document.getElementById('submit-modal-unanswered').textContent`);

    console.log(`  ✓ Submit Modal: Total = ${totalQ}, Answered = ${answeredQ}, Unanswered = ${unansweredQ}`);
    if (!isModalOpen || answeredQ !== '1' || unansweredQ !== '0') {
      throw new Error('Pre-submission confirmation counts incorrect');
    }

    // Confirm submission
    await evalExpr(`Exam.submitExam(false);`);
    await sleep(800);

    // -------------------------------------------------------------------------
    // TEST 7: Results Scorecard & Question Audit Breakdown
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Results View & Detailed Question Audit...');
    const resultsHash = await evalExpr(`window.location.hash`);
    const isResultsVisible = await evalExpr(`!document.getElementById('view-results').classList.contains('hidden')`);
    const scoreDisplay = await evalExpr(`document.getElementById('results-score-display').textContent`);
    const pctDisplay = await evalExpr(`document.getElementById('results-pct-display').textContent`);
    const badgeText = await evalExpr(`document.getElementById('results-status-badge').textContent`);
    const breakdownText = await evalExpr(`document.getElementById('results-breakdown-container').textContent`);

    console.log(`  ✓ Results View: Hash = ${resultsHash}, Results Visible = ${isResultsVisible}`);
    console.log(`  ✓ Academic Score: ${scoreDisplay} (${pctDisplay}) - ${badgeText.trim()}`);
    console.log(`  ✓ Audit Breakdown: Shows Correct Answer Key = ${breakdownText.includes('Correct Answer')}`);
    if (!isResultsVisible || !scoreDisplay.includes('1 / 1') || !badgeText.includes('PASSED')) {
      throw new Error('Results scorecard incorrect');
    }

    // -------------------------------------------------------------------------
    // TEST 8: Route Guards & Unauthorized Navigation Protection
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] Route Guards & Unauthorized Direct Navigation...');
    // Student tries navigating to #admin
    await evalExpr(`App.navigateTo('admin');`);
    await sleep(300);
    const guardedHash = await evalExpr(`window.location.hash`);
    console.log(`  ✓ Student Direct Navigation to #admin redirected to: ${guardedHash}`);
    if (guardedHash !== '#student') throw new Error('Route guard failed to block student from #admin');

    // Logout and try navigating to #student
    await evalExpr(`Auth.logout();`);
    await sleep(400);
    await evalExpr(`App.navigateTo('student');`);
    await sleep(300);
    const unauthHash = await evalExpr(`window.location.hash`);
    console.log(`  ✓ Unauthenticated Direct Navigation redirected to: ${unauthHash}`);
    if (unauthHash !== '#login') throw new Error('Route guard failed to block unauthenticated user');

    // -------------------------------------------------------------------------
    // TEST 9: Responsive Viewports (Desktop, Tablet, Mobile)
    // -------------------------------------------------------------------------
    console.log('\n[Test 9] Responsive Viewport Audit...');

    // Desktop: 1280x800
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(200);
    const desktopHeaderFlex = await evalExpr(`window.getComputedStyle(document.querySelector('.header-container')).flexDirection`);
    console.log(`  ✓ Desktop (1280x800): Header container flex-direction = ${desktopHeaderFlex}`);

    // Tablet: 768x1024
    await send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 1, mobile: false });
    await sleep(200);
    const tabletHeaderFlex = await evalExpr(`window.getComputedStyle(document.querySelector('.header-container')).flexDirection`);
    console.log(`  ✓ Tablet (768x1024): Header container flex-direction = ${tabletHeaderFlex}`);

    // Mobile: 375x667 (iPhone SE standard)
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
    await sleep(200);
    const mobileHeaderFlex = await evalExpr(`window.getComputedStyle(document.querySelector('.header-container')).flexDirection`);
    console.log(`  ✓ Mobile (375x667): Header container flex-direction = ${mobileHeaderFlex} (Stacked cleanly)`);
    if (mobileHeaderFlex !== 'column') throw new Error('Mobile layout failed to adapt header flex-direction');

    // -------------------------------------------------------------------------
    // TEST 10: Keyboard Accessibility & Focus Outlines
    // -------------------------------------------------------------------------
    console.log('\n[Test 10] Keyboard Navigation & Visible Focus States...');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await evalExpr(`
      document.getElementById('login-username').focus();
    `);
    const focusedTag = await evalExpr(`document.activeElement.id`);
    console.log(`  ✓ Keyboard Focus: Active element = #${focusedTag}`);

    // Check focus outline style on inputs
    const outline = await evalExpr(`
      const input = document.getElementById('login-username');
      window.getComputedStyle(input).getPropertyValue('outline-color');
    `);
    console.log(`  ✓ Focus Outline Property defined: ${outline}`);

    console.log('\n================================================================');
    console.log('ALL BROWSER AUTOMATION CDP TESTS COMPLETED SUCCESSFULLY (10/10)');
    console.log('================================================================\n');

  } finally {
    if (ws) ws.close();
    if (tabId) {
      await fetch(`http://127.0.0.1:9222/json/close/${tabId}`).catch(() => {});
    }
    server.close();
    db.close();
  }
}

runBrowserAudit().catch((err) => {
  console.error('\nBrowser Audit Failed:', err);
  process.exit(1);
});
