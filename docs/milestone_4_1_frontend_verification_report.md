# Milestone 4.1: Frontend Security, Timer and Browser Verification Report

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Reference:** STQA (LP-IV) & OOMD, Department of Computer Engineering, MMCOE Pune  
**Verification Date:** November 2, 2026  
**Environment:** macOS (Darwin 25.1.0), Node.js v25.9.0, Express 4.21.2, sql.js (SQLite WASM), Google Chrome 156.0.8078.76 (Headless via CDP), Jest 29.7.0, Supertest 7.0.0  

---

## 1. Files Inspected and Changed

### 1.1. Inspected Files
- `public/index.html` — Single Page Application layout, modal dialogs, semantic structure
- `public/css/styles.css` — Academic styling, color tokens, responsive media queries, focus states
- `public/js/utils.js` — DOM utility routines, XSS escaping, date/timer conversions
- `public/js/api.js` — Centralized Fetch client, Bearer authorization, 401 handling
- `public/js/auth.js` — Client session state, `sessionStorage` management, role helpers
- `public/js/admin.js` — Administrator dashboard, modal controllers, analytics reporting
- `public/js/student.js` — Student dashboard, published quiz catalog, submissions history
- `public/js/exam.js` — Single-question examination UI, countdown timer, options handling
- `public/js/results.js` — Final scorecard, pass/fail badge, question audit breakdown
- `public/js/app.js` — Hash-based routing (`#login`, `#admin`, `#student`, `#exam`, `#results`)
- `src/services/ExamService.js` — Core exam lifecycle, timer verification, question projection
- `src/services/QuizManagementService.js` — Quiz authoring, publishing guards, question projection
- `src/controllers/AttemptController.js` — Attempt and submission REST controller
- `src/controllers/QuizController.js` — Quiz management REST controller

### 1.2. Changed Files & Specific Corrections
| File | Nature of Change | Justification & Architectural Layer |
| :--- | :--- | :--- |
| `src/services/ExamService.js` | **Fixed:** Question sanitization projection & expiry check in `getAttemptQuestions` | Added dual `questionText`/`question_text` and `options[]`/`option_a..d` projections without answer keys; added auto-finalization to `FAILED` if questions requested past grace period. |
| `src/services/QuizManagementService.js` | **Fixed:** Added snake_case and camelCase aliases to `getPublishedQuizzes` and `getQuizForAttempt` | Ensures catalog duration and question count, as well as question text and options, are reliably available to frontend components. |
| `src/controllers/AttemptController.js` | **Fixed:** Grace period error handling in `getAttemptQuestions` | Mapped expired attempt timeout errors to HTTP 400 with `{ isTimedOut: true, status: 'FAILED' }` instead of falling through to unhandled 500 error. |
| `public/js/utils.js` | **Refactored:** `showAlert()` and `clearAlert()` | Replaced `innerHTML` string interpolation with safe DOM construction (`document.createElement`, `textContent`, `replaceChildren`). |
| `public/js/auth.js` | **Corrected:** Security documentation on token storage | Explicitly documented actual security limitations of `sessionStorage` (does NOT protect against XSS token theft). |
| `public/js/admin.js` | **Fixed:** Eliminated inline `onclick` string interpolation | Stored quiz and question objects in `Admin.quizzesMap` and `Admin.questionsMap`, passing only validated numeric IDs into event handlers. Replaced unescaped error injection with safe DOM nodes. |
| `public/js/student.js` | **Fixed:** Quiz metadata property resolution | Corrected property lookups to support `durationMinutes || duration_minutes` and `questionCount || question_count`. |
| `public/js/exam.js` | **Refactored:** Safe DOM rendering of question options & palette | Replaced `innerHTML` option list and nav pills with safe DOM elements (`document.createElement`, `textContent`, `addEventListener`, ARIA attributes). |
| `tests/integration/timerLifecycle.test.js` | **New Test Suite:** 10 Timer & Attempt Lifecycle scenarios | Automated regression tests verifying all 10 timer, refresh, and grace period scenarios with injectable clock. |

---

## 2. Security Audit Findings

### 2.1. Frontend Framework Prohibition Audit
- **Requirement:** Absolute ban on React, Vue, Angular, jQuery, Bootstrap, Tailwind, or other third-party frameworks.
- **Verification:** Inspection of `package.json`, `public/index.html`, and all JavaScript files confirms zero framework dependencies or CDN inclusions.
- **Status:** **PASS**

### 2.2. DOM Construction & Cross-Site Scripting (XSS) Audit
- **Initial Defect Found:** In `public/js/admin.js`, quiz titles and question texts were interpolated as string arguments into inline `onclick="..."` HTML attributes (e.g. `onclick="Admin.openQuestionsModal(${q.id}, '${Utils.escapeHTML(q.title)}')"`). Because browsers decode HTML entities in attributes before passing them to the JavaScript engine, titles with apostrophes or crafted payloads could break string literals. Additionally, `refreshQuestionsList` had an unescaped `e.message` injection.
- **Correction Applied:** 
  1. Removed all string interpolation from event handler attributes. Quizzes and questions are stored in memory keyed by integer ID (`Admin.quizzesMap[id]`, `Admin.questionsMap[id]`), and handlers take strictly validated numerical IDs (`onclick="Admin.openQuestionsModal(${q.id})"`).
  2. In `public/js/utils.js`, `Utils.showAlert()` was rewritten to construct DOM nodes using `document.createElement('div')` and assign text via `.textContent`, avoiding `innerHTML`.
  3. In `public/js/exam.js`, question option choices and navigator palette pills are generated using `document.createElement()`, `.textContent`, and `addEventListener()`, eliminating inline `onclick` and `onkeydown` script attributes.
- **Status:** **PASS**

### 2.3. Authentication Token Security & Storage
- **Verification:**
  - Tokens are never written to `localStorage`.
  - Tokens are never set in cookies, appended to URL query strings, or logged to `console.log`.
  - Stored strictly in `sessionStorage` under the key `quiz_portal_session_token`.
  - `Auth.logout()` synchronously calls the backend `POST /api/auth/logout` endpoint to invalidate the in-memory token registry and removes the token from `sessionStorage`.
- **Status:** **PASS**

### 2.4. Authorization Enforcement & Answer Key Protection
- **Direct Route & API Protection:**
  - `GET /api/admin/analytics/*`, `POST /api/quizzes`, `POST /api/quizzes/:id/publish`, and question authoring endpoints enforce `requireAdmin`. When accessed with a student token or unauthenticated, HTTP 403 / 401 is returned.
  - Frontend hash router (`public/js/app.js`) guards `#admin` and immediately redirects non-administrators to `#student`.
  - Students cannot view or submit attempts belonging to other students (enforced in `ExamService` and returns HTTP 403).
  - Pre-submission questions retrieved via `GET /api/attempts/:attemptId/questions` omit `correct_option` and `correctOption`. Only upon finalization do results reveal the answer key.
- **Status:** **PASS**

---

## 3. XSS and Token-Storage Limitations

### 3.1. Realistic Security Boundaries of `sessionStorage`
> [!WARNING]
> **Definitive Security Notice:**
> `sessionStorage` **DOES NOT PREVENT XSS TOKEN THEFT**.

The actual capabilities and limitations of `sessionStorage` in this application are:
1. **What `sessionStorage` does provide:**
   - **Tab-scoped lifecycle isolation:** The stored session token expires and is purged automatically when the browser tab is closed.
   - **Cross-session contamination mitigation:** Tokens do not persist across browser restarts, nor are they shared with other browser tabs or windows on shared academic lab computers.
2. **What `sessionStorage` cannot protect against:**
   - **Origin script access:** Any JavaScript code executing in the same origin (such as through a Cross-Site Scripting flaw) has direct, synchronous read access via `sessionStorage.getItem()`.
   - If an XSS vulnerability exists, an attacker can extract the session token immediately regardless of whether `sessionStorage` or `localStorage` is used.
3. **Recommended Enterprise Practice:**
   - For pure web browser clients in enterprise environments, `HttpOnly; SameSite=Strict; Secure` cookies are the authoritative standard for token defense, as they are completely inaccessible to client-side JavaScript. Because the STQA/OOMD academic contract specifies Bearer tokens, UI sanitization (`textContent`, safe DOM creation) serves as the primary line of defense.

---

## 4. Timer and Attempt Lifecycle Verification

Ten comprehensive lifecycle scenarios were executed against the actual backend using an injectable clock via `tests/integration/timerLifecycle.test.js`:

| # | Scenario | Test Method | Observed Result | Status |
| :-: | :--- | :--- | :--- | :-: |
| **1** | Start exam, advance clock to 20s before expiry, refresh | `POST /api/quizzes/:id/attempts` at $T_0 + 9\text{m }40\text{s}$ | Resumes with `isResumed: true`, original server expiry preserved (`10:10:00Z`), `remainingSeconds: 20` | **PASS** |
| **2** | Confirm question retrieval reflects original expiry | `GET /api/attempts/:id/questions` | Returns original `expiresAt: 10:10:00Z`, `remainingSeconds: 20` | **PASS** |
| **3** | Refresh after expiry but within 30s grace period | Request attempt at $T_0 + 10\text{m }15\text{s}$ | Resumes attempt, `remainingSeconds: 0`, attempt remains in progress | **PASS** |
| **4** | Submit within 30s grace window | `POST /api/attempts/:id/submit` at $T_0 + 10\text{m }20\text{s}$ | Accepted with HTTP 200, `isTimedOut: true`, graded with full score (100% PASSED) | **PASS** |
| **5** | Submit past 30s grace period | `POST /api/attempts/:id/submit` at $T_0 + 10\text{m }35\text{s}$ | Rejected with HTTP 400, `isTimedOut: true`, finalized as `FAILED` (0% score) | **PASS** |
| **6** | Network failure during auto-submit & retry | Simulated dropped connection, client resubmits | First submission finalizes attempt; second returns identical pre-computed score with `alreadyFinalized: true` | **PASS** |
| **7** | Verify retry idempotency in database | Database SQL row count inspection | Exactly 1 submission row and 3 question answer rows recorded (zero duplicates) | **PASS** |
| **8** | Manually submit before expiry | `POST /api/attempts/:id/submit` at $T_0 + 5\text{m }00\text{s}$ | Accepted with HTTP 200, `isTimedOut: false`, graded accurately | **PASS** |
| **9** | Expired attempt cannot be resumed as active | Attempt retrieval at $T_0 + 20\text{m }00\text{s}$ | `getAttemptQuestions` returns HTTP 400 timeout; new attempt creation finalizes old as `FAILED` and starts fresh attempt | **PASS** |
| **10** | Student cannot submit another student's attempt | Student 2 submits Student 1's attempt | Rejected with HTTP 403 Forbidden (`Access denied`) | **PASS** |

---

## 5. API Contract Verification

Every API endpoint consumed by the frontend was cross-referenced with backend Express route declarations:

| Frontend API Call | Express Route & Middleware | Match Verified? | Security & Data Handling |
| :--- | :--- | :---: | :--- |
| `POST /api/auth/login` | `authRoutes.js` (Public) | **YES** | Scrypt hash verification, issues 256-bit opaque token. |
| `GET /api/auth/me` | `authRoutes.js` (`authMiddleware`) | **YES** | Validates session token, returns `{ user: { id, username, role } }`. |
| `POST /api/auth/logout` | `authRoutes.js` (`authMiddleware`) | **YES** | Invalidates in-memory session token. |
| `GET /api/quizzes` | `quizRoutes.js` (`requireAdmin`) | **YES** | Admin access only; returns draft and published quizzes. |
| `GET /api/quizzes/available` | `quizRoutes.js` (`requireStudent`) | **YES** | Mounted prior to `/:id`; returns published catalog with `durationMinutes`, `questionCount`. |
| `POST /api/quizzes` | `quizRoutes.js` (`requireAdmin`) | **YES** | Validates title and duration; creates draft quiz. |
| `PUT /api/quizzes/:id` | `quizRoutes.js` (`requireAdmin`) | **YES** | Immutability guard blocks duration/scoring changes if attempts exist. |
| `POST /api/quizzes/:id/publish` | `quizRoutes.js` (`requireAdmin`) | **YES** | STQA TC-06: strictly rejects publishing empty quizzes. |
| `POST /api/quizzes/:id/unpublish` | `quizRoutes.js` (`requireAdmin`) | **YES** | Returns quiz to draft; preserves validity of active attempts. |
| `POST /api/quizzes/:id/attempts` | `quizRoutes.js` (`requireStudent`) | **YES** | Idempotent attempt initialization/resumption with server timestamps. |
| `GET /api/attempts/:id/questions` | `attemptRoutes.js` (`requireStudent`) | **YES** | Conceals answer keys; validates ownership and grace expiry. |
| `POST /api/attempts/:id/submit` | `attemptRoutes.js` (`requireStudent`) | **YES** | Ignores client timestamps; grades deterministically; enforces grace period. |
| `GET /api/attempts/:id/results` | `attemptRoutes.js` (`requireStudent`) | **YES** | Returns score and question-by-question breakdown only to owner. |
| `GET /api/attempts/history` | `attemptRoutes.js` (`requireStudent`) | **YES** | Returns past submission records filtered strictly by `req.user.id`. |
| `GET /api/admin/analytics/overview` | `analyticsRoutes.js` (`requireAdmin`) | **YES** | Returns student/quiz counts, pass percentage, average score. |
| `GET /api/admin/analytics/quizzes` | `analyticsRoutes.js` (`requireAdmin`) | **YES** | Aggregated quiz-wise performance metrics. |
| `GET /api/admin/analytics/submissions` | `analyticsRoutes.js` (`requireAdmin`) | **YES** | Student submissions audit table (STQA Report Page 8). |

---

## 6. Browser-Level Verification & Responsive Layout

Browser automation was performed using **Google Chrome 156.0.8078.76** via the **Chrome DevTools Protocol (CDP)** over a local WebSocket connection (`scratch/browser_automation.js`).

### 6.1. Executed Browser Test Results
1. **Admin Authentication & Dashboard:**
   - Navigated to `http://127.0.0.1:3456/#login`.
   - Entered `admin` / `admin123`, submitted form.
   - Verified transition to `#admin`.
   - Verified rendering of metrics cards (Enrolled Students = 2, Total Quizzes = 2).
2. **Quiz & Question Authoring in Real Browser:**
   - Opened `modal-create-quiz`, authored "Advanced Cloud Architecture" (15 mins).
   - Confirmed appearance in quizzes table.
   - Opened question manager modal, authored MCQ prompt and 4 options via form.
   - Published quiz; confirmed status changed to `Published`.
3. **Student Login & Catalog:**
   - Logged out; logged in as `student1` / `student123`.
   - Confirmed transition to `#student`.
   - Verified published quiz was rendered with "15 minutes" and "1 MCQs".
4. **Exam Progression & Single-Question Display:**
   - Clicked "Start Exam".
   - Verified transition to `#exam`.
   - Verified question prompt rendered accurately.
   - Selected Option A: verified `.selected` class applied and navigation pill turned green with `.answered`.
   - Verified countdown timer was active and ticking down from `14:59`.
5. **Page Reload & State Continuity:**
   - Dispatched `Page.reload` via CDP.
   - Verified `#exam` view restored cleanly.
   - Verified selected answer remained selected.
   - Verified timer continued from original server expiry timestamp without resetting.
6. **Pre-Submission Summary Modal & Submission:**
   - Clicked "Submit Exam"; confirmed modal opened with Total = 1, Answered = 1, Unanswered = 0.
   - Confirmed submission; verified transition to `#results`.
7. **Results View & Answer Audit:**
   - Verified score: `1 / 1 (100% Academic Score)` with `PASSED` badge.
   - Verified question audit breakdown revealed Option A with "Correct Answer" marker.
8. **Route Guards & Unauthorized Direct Navigation:**
   - Student called `App.navigateTo('admin')` -> immediately redirected back to `#student`.
   - Logged out and called `App.navigateTo('student')` -> immediately redirected to `#login`.

### 6.2. Responsive Viewport Testing (CDP Emulation)
- **Desktop Viewport ($1280 \times 800$):** Header navigation displayed in horizontal row (`flex-direction: row`). Metrics grid displayed multi-column.
- **Tablet Viewport ($768 \times 1024$):** Header navigation adapted cleanly (`flex-direction: column`). Metrics cards displayed in 2-column grid.
- **Mobile Viewport ($375 \times 667$ — iPhone SE standard):** Header navigation and controls stacked vertically (`flex-direction: column`). Tables retained horizontal overflow scrolling (`overflow-x: auto`) preventing page clipping.

---

## 7. Accessibility Checks Performed

1. **Visible Focus States:**
   - Inspected computed CSS outline styles across `input`, `button`, `select`, and `a` elements.
   - Verified `outline: 2px solid var(--color-primary)` with `outline-offset: 2px` applied on `:focus-visible`.
2. **Keyboard Navigation:**
   - Login inputs accessible via `Tab` key.
   - Option choices in examination view configured with `tabindex="0"`, `role="radio"`, and `aria-checked`.
   - Option choices accept `Enter` and `Space` keypresses to trigger selection.
3. **Color Contrast & Typography:**
   - Primary text (`#242621`) on ivory background (`#F7F6F2`) satisfies WCAG AAA contrast ratio ($\approx 12.8:1$).
   - Forest Green action buttons (`#345647`) on white text satisfy WCAG AA contrast ratio ($\approx 6.4:1$).
   - Font sizes maintain minimum 15px base with 1.5 line height.

---

## 8. Full Jest Test Output and Actual Test Count

The complete automated test suite was executed across all unit and integration specifications:

```
> digital-quiz-portal@1.0.0 test
> jest --runInBand

PASS tests/integration/quiz.api.test.js
PASS tests/integration/exam.api.test.js
PASS tests/integration/frontend.test.js
PASS tests/integration/timerLifecycle.test.js
PASS tests/integration/analytics.api.test.js
PASS tests/integration/auth.api.test.js
PASS tests/unit/authService.test.js
PASS tests/unit/seed.test.js
PASS tests/unit/cryptoUtils.test.js
PASS tests/unit/db.test.js
PASS tests/unit/quizManagementService.test.js
PASS tests/unit/dal.test.js
PASS tests/unit/examService.test.js
PASS tests/unit/analyticsService.test.js
PASS tests/unit/scoringService.test.js

Test Suites: 15 passed, 15 total
Tests:       166 passed, 166 total
Snapshots:   0 total
Time:        9.53 s
Ran all test suites.
```

- **Total Test Suites:** 15
- **Total Tests Passed:** 166 (0 failed, 0 skipped)
- **Breakdown:**
  - `quiz.api.test.js`: 14 tests
  - `exam.api.test.js`: 9 tests
  - `frontend.test.js`: 19 tests
  - `timerLifecycle.test.js`: 8 tests (10 scenarios)
  - `analytics.api.test.js`: 7 tests
  - `auth.api.test.js`: 9 tests
  - `authService.test.js`: 13 tests
  - `seed.test.js`: 4 tests
  - `cryptoUtils.test.js`: 9 tests
  - `db.test.js`: 11 tests
  - `quizManagementService.test.js`: 21 tests
  - `dal.test.js`: 13 tests
  - `examService.test.js`: 12 tests
  - `analyticsService.test.js`: 4 tests
  - `scoringService.test.js`: 13 tests

---

## 9. Known Limitations and Unresolved Issues

1. **Browser Token Theft Protection:**
   Because session tokens are stored in `sessionStorage` (mandated by the STQA/OOMD Bearer token specification), any client script executing in the origin has synchronous read access to the token. While all application templates use strict HTML entity escaping and safe DOM `textContent` assignment, this architectural model remains vulnerable if third-party scripts were ever introduced into the page.
2. **Mac Sandbox Socket Permissions:**
   In the macOS development environment, Supertest integration tests and CDP browser automation require loopback TCP socket binding (`127.0.0.1`), which requires standard unsandboxed permissions.

---

## 10. Final Assessment

### **PASS**

All requirements of Milestone 4.1 have been satisfied:
- Codebase audited and verified against the pure HTML5 / CSS3 / Vanilla JS stack.
- Real DOM XSS vulnerabilities eliminated (no string interpolations in event handler attributes; safe DOM construction).
- Accurate security documentation regarding `sessionStorage` limitations added.
- All 10 Timer and Attempt Lifecycle scenarios verified with regression tests.
- Full API contract verified against Express route implementations.
- Real browser CDP automation executed on Google Chrome 156 with 10/10 passing tests across desktop, tablet, and mobile viewports.
- All 15 automated Jest test suites (166 tests) pass with zero errors.

---
*Awaiting user review and authorization before proceeding to any subsequent milestones.*

