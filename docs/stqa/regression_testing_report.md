# Comprehensive Regression Testing Report

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Software Testing & Quality Assurance (STQA)  
**Authoritative Source:** STQA Project Report (`docs/STQA_Report.pdf`) & OOMD Project Report (`docs/OOMD_Report.pdf`)  
**Methodology:** Full-Suite Regression Verification & Defect Retest Validation  
**Execution Environment:** macOS, Node.js v25.9.0, Jest 29.7.0, Supertest 7.0.0, Chrome DevTools Protocol (CDP)  
**Verification Date:** November 2, 2026  
**Final Status:** **15/15 SUITES PASSING, 166/166 UNIT & API TESTS PASSING, 10/10 CDP BROWSER TESTS PASSING (100% SUCCESS)**

---

## 1. Executive Summary & Regression Scope

Regression testing verifies that software modifications, bug fixes, performance optimizations, and security patches do not inadvertently degrade, alter, or break previously established and verified functionality.

Following the completion of Milestones 1 through 4.1, a series of targeted architectural and security fixes were applied to the Digital Quiz Portal:
1. **Security Corrections (Milestone 4.1):** Removal of all inline `onclick` string interpolations; implementation of strict `replaceChildren` and `textContent` DOM nodes; removal of script injection vulnerabilities in modals and alert containers.
2. **Timer Grace Finalization Fix (Milestone 4.1):** Correction of `ExamService.getAttemptQuestions` to auto-finalize expired attempts beyond the 30-second grace window rather than throwing an unhandled internal error.
3. **Question Projection Alignment (Milestone 4.1):** Ensuring both camelCase and snake_case properties (`question_text`, `questionText`, `option_a` through `option_d`) are projected while strictly concealing `correct_option`.
4. **Scoring Precision Guard (Milestone 3):** Preserving unrounded floating-point percentages during `PASSED`/`FAILED` evaluations.

To ensure that none of these changes introduced regressions, the entire test suite—spanning unit, data access layer, integration, API controller, timer simulation, and real-browser CDP tests—was executed in sequence.

---

## 2. Test Execution Summary Matrix

| # | Test Suite Path | Architectural Focus | Total Tests | Passed | Failed | Execution Time |
| :-: | :--- | :--- | :-: | :-: | :-: | :-: |
| 1 | `tests/unit/scoringService.test.js` | Algorithmic scoring, option normalization, BVA boundaries (TC-03..05) | 11 | 11 | 0 | ~15 ms |
| 2 | `tests/unit/analyticsService.test.js` | Performance metrics, aggregations, empty dataset safety, report table | 5 | 5 | 0 | ~18 ms |
| 3 | `tests/unit/authService.test.js` | Session registry, TTL expiration, role checks, token issuance | 11 | 11 | 0 | ~25 ms |
| 4 | `tests/unit/cryptoUtils.test.js` | Scrypt password hashing, random salt generation, constant-time compare | 7 | 7 | 0 | ~45 ms |
| 5 | `tests/unit/db.test.js` | sql.js WebAssembly engine, schema DDL, triggers, constraints, atomic sync | 11 | 11 | 0 | ~35 ms |
| 6 | `tests/unit/dal.test.js` | UserRepository, QuizRepository, SubmissionRepository SQL transactions | 13 | 13 | 0 | ~40 ms |
| 7 | `tests/unit/seed.test.js` | Database initialization, idempotent seed insertion, reference integrity | 9 | 9 | 0 | ~30 ms |
| 8 | `tests/unit/quizManagementService.test.js` | Quiz & question CRUD, empty quiz check (TC-06), immutability lock | 21 | 21 | 0 | ~65 ms |
| 9 | `tests/unit/examService.test.js` | Attempt lifecycle, key concealment, grading trigger, timer logic | 14 | 14 | 0 | ~50 ms |
| 10 | `tests/integration/auth.api.test.js` | `/api/auth` login, logout, me, token auth, TC-01, TC-02 | 8 | 8 | 0 | ~1.1 s |
| 11 | `tests/integration/quiz.api.test.js` | `/api/quizzes` catalog, authoring, publishing, immutability API guards | 14 | 14 | 0 | ~1.6 s |
| 12 | `tests/integration/exam.api.test.js` | `/api/attempts` lifecycle, question fetching, submit, grading, ownership | 10 | 10 | 0 | ~1.4 s |
| 13 | `tests/integration/analytics.api.test.js` | `/api/analytics` overview, quiz summaries, student submissions table | 5 | 5 | 0 | ~650 ms |
| 14 | `tests/integration/timerLifecycle.test.js` | Injectable MockClock, on-time, grace period, post-grace, idempotency | 10 | 10 | 0 | ~1.3 s |
| 15 | `tests/integration/frontend.test.js` | Static asset delivery, CSS palette check, SPA fallback, modular JS | 17 | 17 | 0 | ~1.2 s |
| **—** | **Total Automated Test Suites** | **Backend & API Test Coverage** | **166** | **166** | **0** | **9.63 s** |
| 16 | `tests/browser/browser_automation.js` | Real Chrome CDP end-to-end user flows, view transitions, responsive viewports | 10 | 10 | 0 | ~12.4 s |
| **—** | **Grand Total (All Suites)** | **Full End-to-End System Verification** | **176** | **176** | **0** | **~22.0 s** |

---

## 3. Targeted Defect Retest & Regression Verification

### 3.1 Verification of Security & DOM Corrections (Milestone 4.1)
- **Defect Addressed:** Previous UI used string concatenation in inline `onclick` attributes (`onclick="Admin.deleteQuiz('${quiz.id}')"`), creating DOM XSS attack vectors if quiz titles or IDs contained quote escapes.
- **Applied Fix:** Refactored `admin.js` to store quiz and question entities in memory maps (`Admin.quizzesMap`, `Admin.questionsMap`) and pass only sanitized integer IDs; refactored `utils.js` `showAlert` to construct elements via `document.createElement` and `replaceChildren`.
- **Regression Retest:**
  - `tests/integration/frontend.test.js` Test 14: Confirmed zero occurrences of unescaped innerHTML or unsafe string concatenation.
  - `tests/browser/browser_automation.js` Tests 1–10: Admin dashboard renders quiz tables, question lists, and alert notifications smoothly without runtime script errors or syntax breaks.
  - **Verdict:** **PASS — Zero Regressions.**

### 3.2 Verification of Timer Expiration & Grace Window Handling
- **Defect Addressed:** If a student refreshed their browser or called `GET /api/attempts/:id/questions` after the 30-second grace window had elapsed, the server threw an unhandled 500 error instead of cleanly returning a 400 Bad Request with timeout finalization.
- **Applied Fix:** In `ExamService.getAttemptQuestions`, added an authoritative clock check against `graceExpiresAt`. If expired, it auto-finalizes the attempt to `status = 'FAILED'`, sets `is_timed_out = 1`, saves the database, and returns HTTP 400 with a structured timeout message.
- **Regression Retest:**
  - `tests/integration/timerLifecycle.test.js` Test 5: Post-grace submission verified to finalize as `FAILED` (0% score) with HTTP 400.
  - `tests/integration/exam.api.test.js` Test 7: Post-grace retrieval rejects with HTTP 400.
  - **Verdict:** **PASS — Zero Regressions.**

### 3.3 Verification of Dual Projection for Question Properties
- **Defect Addressed:** Examination frontend expected both snake_case (`question_text`, `option_a`–`option_d`) and camelCase (`questionText`, `options: []`) aliases depending on view render routines.
- **Applied Fix:** `ExamService.getAttemptQuestions` and `QuizRepository.findQuestionsByQuizId` project dual aliases while strictly ensuring `correct_option` is omitted.
- **Regression Retest:**
  - `tests/integration/exam.api.test.js` Test 3: Verified student payload contains question text and all four options without exposing the answer key.
  - `tests/browser/browser_automation.js` Test 4: Student exam view successfully renders single questions, option choices, and navigation palette in real Google Chrome.
  - **Verdict:** **PASS — Zero Regressions.**

### 3.4 Verification of Submission Idempotency
- **Defect Addressed:** Network retries or rapid double-clicking by students could trigger race conditions or duplicate rows in `submission_answers`.
- **Applied Fix:** Idempotency guard in `ExamService.submitAttempt` checks if attempt status is already `SUBMITTED`. If so, it retrieves the existing recorded score and answer breakdown and returns it with `alreadyFinalized: true`.
- **Regression Retest:**
  - `tests/integration/timerLifecycle.test.js` Test 6 & 7: Multiple consecutive submit calls return identical scores with zero additional rows created in SQLite.
  - **Verdict:** **PASS — Zero Regressions.**

---

## 4. Cross-Platform Responsive Viewport Regression Matrix

To verify that UI layout styling did not suffer visual regressions, real-browser headless Chrome testing was executed across three standardized device viewports:

| Test ID | Viewport Name | Dimensions ($W \times H$) | Target Form Factor | Verified Components | Layout Integrity | Result |
| :---: | :--- | :---: | :--- | :--- | :---: | :---: |
| **REG-UI-01** | Desktop High-Res | $1280 \times 800$ | Standard Academic Lab PC | Nav header, split admin panels, wide results table | Clean, no overflow | **PASS** |
| **REG-UI-02** | Tablet Portrait | $768 \times 1024$ | Apple iPad / Academic Tablet | Collapsed palette, responsive modal, stack cards | Fluid flexbox wrap | **PASS** |
| **REG-UI-03** | Mobile Viewport | $375 \times 667$ | Apple iPhone SE / Mobile | Single-column stack, full-width touch buttons | No horizontal scroll | **PASS** |

---

## 5. Regression Conclusion

The complete test execution run of 166 automated backend/API tests and 10 end-to-end browser tests achieved a **100% pass rate with zero failures and zero skipped tests**. All previously documented defects have been verified as resolved, and no existing functionality suffered regression.

