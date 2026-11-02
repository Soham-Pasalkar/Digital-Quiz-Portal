# Defect Tracking Log & Root Cause Analysis

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Software Testing & Quality Assurance (STQA)  
**Authoritative Source:** STQA Project Report (`docs/STQA_Report.pdf`) & OOMD Project Report (`docs/OOMD_Report.pdf`)  
**Standard:** IEEE 1044-2009 Standard for Software Anomaly Reporting  
**Verification Date:** November 2, 2026  
**Final Quality Status:** **10/10 DEFECTS RESOLVED & CLOSED (ZERO OPEN DEFECTS)**

---

## 1. Defect Classification & Severity Criteria

Defects identified during the iterative engineering of the Digital Quiz Portal (Milestones 1 through 4.1) are classified according to IEEE standard severity metrics:
- **Critical (S1):** System crash, data loss, security vulnerability, incorrect academic grading, or test execution blocker.
- **High (S2):** Major functional deviation, race conditions, timer integrity violation, or broken API contract.
- **Medium (S3):** Input formatting anomalies, boundary condition misbehavior, or UI rendering discrepancies without data loss.
- **Low (S4):** Minor visual styling inconsistencies, non-breaking telemetry omissions, or cosmetic defects.

---

## 2. Defect Summary Register

| Defect ID | Severity | Milestone | Category | Defect Title | Resolution Status |
| :---: | :---: | :---: | :--- | :--- | :---: |
| **DEF-01** | **S1 (Critical)** | M1 | Infrastructure | Supertest TCP loopback socket blocked under macOS sandboxed runner | **CLOSED** |
| **DEF-02** | **S1 (Critical)** | M1 Review | Concurrency / DB | Missing partial unique index allowing duplicate concurrent active attempts | **CLOSED** |
| **DEF-03** | **S1 (Critical)** | M2 | Data Integrity | Question and quiz deletion mutating or breaking historical submission records | **CLOSED** |
| **DEF-04** | **S1 (Critical)** | M2 Review | Security / Timer | Client-supplied receipt timestamp vulnerability in exam submission | **CLOSED** |
| **DEF-05** | **S2 (High)** | M2 Review | Scoring Logic | Pre-evaluation score rounding causing $<50.0\%$ results to falsely evaluate as `PASSED` | **CLOSED** |
| **DEF-06** | **S2 (High)** | M3 | API Routing | Route collision between `/api/quizzes/available` and `/api/quizzes/:id` | **CLOSED** |
| **DEF-07** | **S3 (Medium)** | M4 | API Contract | `AttemptController.getHistory` payload property mismatch (`submissions` vs `history`) | **CLOSED** |
| **DEF-08** | **S1 (Critical)** | M4.1 | Security (XSS) | Inline `onclick` string interpolation vulnerable to DOM-based XSS injection | **CLOSED** |
| **DEF-09** | **S3 (Medium)** | M4.1 | Data Mapping | Missing snake_case/camelCase option aliases in `ExamService` question projection | **CLOSED** |
| **DEF-10** | **S2 (High)** | M4.1 | Error Handling | Expired attempt question retrieval throwing unhandled 500 error instead of 400 | **CLOSED** |

---

## 3. Detailed Root Cause Analysis & Resolution Log

### DEF-01: Supertest TCP Loopback Socket Blocked under macOS Sandbox
- **Severity:** S1 (Critical)
- **Category:** Test Harness / Infrastructure
- **Steps to Reproduce:**
  1. Execute `npm test` with Supertest integration tests inside macOS sandbox without network elevation.
  2. Supertest attempts to bind an ephemeral local TCP socket at `127.0.0.1`.
- **Expected Behavior:** Supertest binds to local port and communicates with Express instance.
- **Actual Behavior:** Node runtime throws fatal `connect EPERM 127.0.0.1` and fails all 6 integration suites.
- **Root Cause:** macOS sandbox security policy restricts local TCP loopback binding without explicit bypass permissions.
- **Fix Implemented:** Documented execution protocol to run network-binding integration tests unsandboxed (`BypassSandbox: true`).
- **Regression Verification:** `tests/integration/quiz.api.test.js` passes 14/14 tests.

---

### DEF-02: Missing Partial Unique Index Allowing Duplicate Active Attempts
- **Severity:** S1 (Critical)
- **Category:** Concurrency / Relational Integrity
- **Steps to Reproduce:**
  1. Student sends two rapid concurrent `POST /api/quizzes/:id/attempts` requests simultaneously.
  2. In absence of a database constraint, two distinct attempts with status `IN_PROGRESS` were created for the same user and quiz.
- **Expected Behavior:** Concurrent requests return the single existing active attempt.
- **Actual Behavior:** Duplicate active examination sessions created, causing inconsistent exam states.
- **Root Cause:** SQLite table lacked a unique index filtered on `status = 'IN_PROGRESS'`.
- **Fix Implemented:** Added partial unique index to `src/database/db.js`:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_active_attempt_unique 
  ON submissions(user_id, quiz_id) 
  WHERE status = 'IN_PROGRESS';
  ```
  Handled `SQLITE_CONSTRAINT_UNIQUE` in `SubmissionRepository.createAttempt` by falling back to retrieving the active attempt.
- **Regression Verification:** `tests/unit/db.test.js:4` and `tests/unit/dal.test.js:5` verified.

---

### DEF-03: Question Deletion Mutating Historical Submission Integrity
- **Severity:** S1 (Critical)
- **Category:** Data Integrity & Immutability
- **Steps to Reproduce:**
  1. Admin creates a quiz with 4 questions.
  2. Student completes exam; answers recorded referencing question IDs.
  3. Admin deletes or edits Question 1.
  4. Student reviews submission results; question text or options are corrupt or missing.
- **Expected Behavior:** Historical submissions remain permanently immutable and auditable.
- **Actual Behavior:** Data corruption of historical grades and foreign key constraint violations.
- **Root Cause:** Quiz questions lacked an immutability guard once attempts existed.
- **Fix Implemented:** Added `_assertQuizMutable(quizId)` in `QuizManagementService`:
  ```javascript
  const attemptCount = this.submissionRepo.countAttemptsByQuizId(quizId);
  if (attemptCount > 0) {
    throw new Error('Cannot modify questions or scoring configuration for a quiz that has existing attempts.');
  }
  ```
  Prevents modifying, adding, or deleting questions or changing durations once attempts exist.
- **Regression Verification:** `tests/unit/quizManagementService.test.js:17-21` and `tests/integration/quiz.api.test.js:10-14` verified.

---

### DEF-04: Client-Supplied Receipt Timestamp Vulnerability
- **Severity:** S1 (Critical)
- **Category:** Security / Timer Integrity
- **Steps to Reproduce:**
  1. Student starts a 10-minute exam.
  2. Student takes 45 minutes to solve questions.
  3. Student sends `POST /api/attempts/:id/submit` with `{ receiptTime: "2026-11-01T10:05:00Z" }` forging client timestamp.
- **Expected Behavior:** Server rejects submission because 45 minutes have elapsed.
- **Actual Behavior:** In insecure design, server trusted client timestamp and accepted late submission as on-time.
- **Root Cause:** Submission validation relied on payload timestamps rather than authoritative server clock.
- **Fix Implemented:** Refactored `ExamService` to inject an authoritative server clock (`this.clock = clock || (() => new Date())`). In production, HTTP controllers never accept `receiptTime` from request bodies. Client timestamps are completely ignored.
- **Regression Verification:** `tests/integration/timerLifecycle.test.js:1-5` verified.

---

### DEF-05: Pre-Evaluation Score Rounding Causing False Pass
- **Severity:** S2 (High)
- **Category:** Algorithmic Grading Precision
- **Steps to Reproduce:**
  1. A student achieves 5000 correct answers out of 10001 questions.
  2. Unrounded percentage is $49.9950004999...\%$.
  3. Formatting with `.toFixed(2)` produces `"50.00"`.
  4. If status is evaluated as `Number("50.00") >= 50.0`, the system outputs `PASSED`.
- **Expected Behavior:** Student mathematically scored $< 50.0\%$; status must be `FAILED`.
- **Actual Behavior:** Student was falsely awarded `PASSED` due to premature rounding.
- **Root Cause:** Rounding was performed before evaluating the pass/fail boolean condition.
- **Fix Implemented:** Refactored `ScoringService.evaluateSubmission`:
  ```javascript
  const rawPercentage = (score / totalQuestions) * 100;
  const passed = rawPercentage >= PASS_THRESHOLD_PERCENT;
  const status = passed ? ATTEMPT_STATUS.PASSED : ATTEMPT_STATUS.FAILED;
  const percentage = Number(rawPercentage.toFixed(2));
  ```
- **Regression Verification:** `tests/unit/scoringService.test.js:9` verified.

---

### DEF-06: Route Collision Between `/api/quizzes/available` and `/:id`
- **Severity:** S2 (High)
- **Category:** Express REST Routing
- **Steps to Reproduce:**
  1. Express route `router.get('/:id', ...)` was registered before `router.get('/available', ...)`.
  2. Student calls `GET /api/quizzes/available`.
  3. Express matches `available` as an `:id` parameter and executes `QuizController.getById("available")`.
- **Expected Behavior:** `GET /api/quizzes/available` returns list of published quizzes.
- **Actual Behavior:** Express throws database casting error attempting to parse string `"available"` as an integer ID.
- **Root Cause:** Express evaluates routes in registration order; parameterized routes shadowed static paths.
- **Fix Implemented:** Reordered `src/routes/quizRoutes.js` so static route `/available` is declared before dynamic route `/:id`.
- **Regression Verification:** `tests/integration/quiz.api.test.js:1` verified.

---

### DEF-07: `AttemptController.getHistory` Payload Property Mismatch
- **Severity:** S3 (Medium)
- **Category:** API Contract & Frontend Integration
- **Steps to Reproduce:**
  1. Student navigates to past submissions page.
  2. Frontend script checks `data.history` or `data.submissions`.
  3. Controller previously returned only `{ success: true, submissions }`.
- **Expected Behavior:** Frontend renders student past attempts table without undefined errors.
- **Actual Behavior:** Frontend received undefined when checking `response.history`.
- **Root Cause:** Discrepancy between controller response key and frontend expectations.
- **Fix Implemented:** Updated `AttemptController.getHistory` to return dual aliases:
  ```javascript
  res.json({ success: true, submissions, history: submissions });
  ```
- **Regression Verification:** `tests/integration/frontend.test.js:15` verified.

---

### DEF-08: Inline `onclick` String Interpolation DOM XSS
- **Severity:** S1 (Critical)
- **Category:** Web Application Security (XSS)
- **Steps to Reproduce:**
  1. An admin creates a quiz with title: `Math Quiz " onload="alert(1)`.
  2. Table generation used string concatenation: `<button onclick="Admin.deleteQuiz('${quiz.title}')">`.
  3. The unescaped double quote escapes the attribute and injects arbitrary JavaScript into the DOM.
- **Expected Behavior:** Titles and IDs cannot execute malicious scripts.
- **Actual Behavior:** DOM-based script injection vulnerability.
- **Root Cause:** Interpolating untrusted database strings directly into inline HTML event handler attributes.
- **Fix Implemented:** Refactored `public/js/admin.js` to store entities in internal maps (`Admin.quizzesMap[id]`) and bind handlers only with sanitized numeric IDs: `onclick="Admin.deleteQuiz(${quiz.id})"`. Refactored `Utils.showAlert` to construct alert nodes using `replaceChildren` and `textContent`.
- **Regression Verification:** `tests/integration/frontend.test.js:14` and Chrome CDP browser suite verified.

---

### DEF-09: Missing Snake_case/CamelCase Option Aliases in Question Projection
- **Severity:** S3 (Medium)
- **Category:** Data Serialization & UI Compatibility
- **Steps to Reproduce:**
  1. Student loads active exam session.
  2. Examination view renders options expecting `q.option_a`, `q.option_b` or `q.options`.
  3. Service originally only returned `options: [optA, optB, optC, optD]`.
- **Expected Behavior:** Clean option rendering across all UI components.
- **Actual Behavior:** Options rendered as `undefined` in legacy template helpers.
- **Root Cause:** Single naming convention projected from `ExamService.getAttemptQuestions`.
- **Fix Implemented:** Projected both camelCase and snake_case properties while strictly stripping `correct_option`:
  ```javascript
  {
    id: q.id,
    questionText: q.question_text,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    options: [q.option_a, q.option_b, q.option_c, q.option_d]
  }
  ```
- **Regression Verification:** `tests/integration/exam.api.test.js:3` and `browser_automation.js:4` verified.

---

### DEF-10: Expired Attempt Question Retrieval Throwing 500
- **Severity:** S2 (High)
- **Category:** Exception Handling & Timer Lifecycle
- **Steps to Reproduce:**
  1. Student begins exam attempt.
  2. Student leaves browser open past 10 minutes + 30 seconds grace window.
  3. Student refreshes page; browser requests `GET /api/attempts/:id/questions`.
- **Expected Behavior:** Server returns HTTP 400 Bad Request informing student that the attempt has expired.
- **Actual Behavior:** Attempt questions retrieval threw unhandled Error leading to generic HTTP 500 crash.
- **Root Cause:** Missing grace expiration check in `getAttemptQuestions`.
- **Fix Implemented:** Added authoritative timer verification in `ExamService.getAttemptQuestions`. If current server time exceeds `expiresAt + 30s`, it automatically finalizes the attempt as `FAILED` (0% score) with `is_timed_out = 1`, saves the database, and returns HTTP 400.
- **Regression Verification:** `tests/integration/exam.api.test.js:7` and `timerLifecycle.test.js:5` verified.

---

## 4. Defect Metrics & Resolution Verification

- **Total Logged Defects:** 10
- **Defects by Severity:**
  - Critical (S1): 5 (100% Resolved)
  - High (S2): 3 (100% Resolved)
  - Medium (S3): 2 (100% Resolved)
  - Low (S4): 0
- **Current Open Defects:** 0
- **Mean Time to Resolution (MTTR):** < 1 development milestone iteration.
- **Conclusion:** All 10 discovered defects have associated automated regression tests in the repository and are certified CLOSED. In accordance with Dijkstra's testing axiom, testing demonstrates the presence of defects, not their absence; the closure of all logged defects confirms resolution of known issues within the verified test harness, but does not imply the software is defect-free across unmodeled operating environments.

