# Requirement Traceability Matrix (RTM)

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Software Testing & Quality Assurance (STQA)  
**Authoritative Documents:** STQA Project Report (`docs/STQA_Report.pdf`) & OOMD Project Report (`docs/OOMD_Report.pdf`)  
**Verification Date:** November 2, 2026  
**Audit Status:** **Audited & Reconciled: 28 Requirements Formally Traced & Verified (All Associated Tests Passing)**

---

## 1. Classification Taxonomy

To ensure rigorous academic integrity and transparency, requirements are classified into three distinct categories:
- **Category A (Report-Mandated):** Explicitly specified in the authoritative STQA and OOMD project reports (e.g. Test Cases TC-01 to TC-06, mathematical scoring algorithms, 4 options A–D, 50% pass threshold, Results Page 8 table).
- **Category B (Implementation Assumptions):** Concrete design decisions approved during architectural reviews to bridge ambiguous gaps in the reports (e.g. Express REST API, sql.js WebAssembly SQLite engine, 10-minute exam duration, 30-second post-expiry submission grace period, unrounded precision rule, quiz immutability lock).
- **Category C (Security & Architectural Integrity Enhancements):** Production-grade defensive controls established to harden the academic portal (e.g. Scrypt password hashing with constant-time verification, pre-submission answer key concealment, server-receipt timestamp enforcement, XSS defense, cross-student attempt isolation).

---

## 2. Requirement Traceability Matrix Table

| Req ID | Category | Requirement Description | Report Source | Implemented Module / API | Automated Test References | Verification Method | Actual Test Result | Verification Status |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **REQ-AUTH-01** | **A** | Administrator authentication with valid credentials | STQA §1, TC-01 | `AuthService.login`, `POST /api/auth/login` | `authService.test.js:1`, `auth.api.test.js:1` | Unit & API Integration | Validated scrypt hash, issued 256-bit token, role=`admin` | **PASS** |
| **REQ-AUTH-02** | **A** | Rejection of invalid passwords with error feedback | STQA §1, TC-02 | `AuthService.login`, `POST /api/auth/login` | `authService.test.js:4`, `auth.api.test.js:3` | Unit & API Integration | Rejects with HTTP 401 Unauthorized; constant-time check | **PASS** |
| **REQ-AUTH-03** | **A** | Role-based authorization distinguishing Admin and Student | STQA §1, OOMD Diag 2 | `authMiddleware.js` (`requireAdmin`, `requireStudent`) | `authService.test.js:11`, `auth.api.test.js:2` | Middleware & API Tests | Students restricted to exam routes; Admins to authoring | **PASS** |
| **REQ-AUTH-04** | **B** | Session management, 24h TTL, logout invalidation | Phase 1 & 2 Spec | `AuthService`, `POST /api/auth/logout` | `authService.test.js:7-10`, `auth.api.test.js:8` | Unit & API Integration | Token stored in `sessionStorage`; remote logout purges registry | **PASS** |
| **REQ-AUTH-05** | **C** | Defensive password hashing and timing attack defense | Review §2 | `cryptoUtils.js` (`scrypt`, `timingSafeEqual`) | `cryptoUtils.test.js:3-7` | Cryptographic Unit Tests | 64-byte scrypt key, 16-byte random salt, zero hash leaks | **PASS** |
| **REQ-QUIZ-01** | **A** | Quiz authoring, editing title, and configuring duration | STQA §1, OOMD Diag 2 | `QuizManagementService`, `POST /api/quizzes` | `quizManagementService.test.js:5-8`, `quiz.api.test.js:3` | Unit & API Integration | Creates draft quiz with title and duration; persists in SQLite | **PASS** |
| **REQ-QUIZ-02** | **A** | Question authoring with exactly 4 options (A-D) & normalized key | STQA §1, Review §3 | `QuizManagementService.addQuestion`, `POST /api/quizzes/:id/questions` | `quizManagementService.test.js:9-11`, `quiz.api.test.js:7` | Unit & API Integration | Normalizes A-D to 0-3; enforces 4 non-empty options | **PASS** |
| **REQ-QUIZ-03** | **A** | Empty quiz publishing prevention | STQA TC-06 | `QuizManagementService.publishQuiz`, `POST /api/quizzes/:id/publish` | `quizManagementService.test.js:12`, `quiz.api.test.js:6` | Unit & API Integration | Rejects publishing quizzes with 0 questions (HTTP 400) | **PASS** |
| **REQ-QUIZ-04** | **B** | Quiz immutability once student examination attempts exist | Milestone 3 Prereq | `QuizManagementService._assertQuizMutable` | `quizManagementService.test.js:17-21`, `quiz.api.test.js:10-14` | Unit & API Integration | Blocks adding, editing, deleting questions or duration (HTTP 400) | **PASS** |
| **REQ-QUIZ-05** | **C** | Answer-key protection in active examination questions | Review §4 | `ExamService.getAttemptQuestions`, `QuizManagementService.getQuizForAttempt` | `examService.test.js:6`, `exam.api.test.js:3` | Unit, API & CDP Browser | `correct_option` stripped completely from student DTO | **PASS** |
| **REQ-EXAM-01** | **A** | Single-question presentation with A-D selection & palette | STQA §1, OOMD Diag 3 | `public/js/exam.js`, `Exam.renderQuestion` | `frontend.test.js:2`, `browser_automation.js:4` | Real Browser CDP Test | Renders 1 question at a time; options radio; palette pills | **PASS** |
| **REQ-EXAM-02** | **B** | 10-minute exam duration and 30-second grace window operational rules | Review §1 | `ExamService.startOrResumeAttempt`, `submitAttempt` | `timerLifecycle.test.js:1-4` | Injectable Clock Integration | Duration set to 600s; 30s grace window accepted with timeout flag | **PASS** |
| **REQ-EXAM-03** | **A** | Auto-submission on expiry & timer behavior | STQA §1, OOMD Diag 4 | `Exam.tickTimer`, `ExamService.submitAttempt` | `timerLifecycle.test.js:4-5` | Injectable Clock Integration | Submits at 00:00; grace accepted with `isTimedOut=true` | **PASS** |
| **REQ-EXAM-04** | **B** | Submission idempotency (duplicate/network retry resilience) | Review §1 | `ExamService.submitAttempt`, `submissionRepo` | `timerLifecycle.test.js:6-7` | Injectable Clock Integration | Duplicate submit returns pre-computed score; zero extra rows | **PASS** |
| **REQ-EXAM-05** | **B** | Exam state & timer survival across browser page reloads | Milestone 4 Spec | `public/js/exam.js`, `sessionStorage` | `browser_automation.js:5` | Real Browser CDP Test | Page reload restores question, selected answers, and countdown | **PASS** |
| **REQ-EXAM-06** | **C** | Cross-student attempt isolation & attempt ownership guard | Review §5 | `ExamService.getAttemptQuestions`, `submitAttempt` | `examService.test.js:7,12`, `timerLifecycle.test.js:10` | Unit & API Integration | Student cannot view or submit another student's attempt (403) | **PASS** |
| **REQ-EXAM-07** | **C** | Server-authoritative receipt timestamp integrity (client clock distrust) | Milestone 3 Prereq | `ExamService.submitAttempt`, `clock()` | `timerLifecycle.test.js:1-5` | Injectable Clock Integration | Submission uses server receipt time; client timestamp ignored | **PASS** |
| **REQ-SCORE-01** | **A** | Deterministic Raw Scoring Algorithm: $S = \sum f(S_i, C_i)$ | STQA §1 (Eq 1) | `ScoringService.evaluateSubmission` | `scoringService.test.js:4-10` | Unit Tests (STQA TC-03..05) | +1 for match, 0 for incorrect/unattempted; no negative marking | **PASS** |
| **REQ-SCORE-02** | **A** | Percentage Score: $P = (S / N) \times 100$ & 50% Pass Threshold | STQA §1 (Eq 2, 3) | `ScoringService.evaluateSubmission` | `scoringService.test.js:7-9` | Unit Boundary Tests | PASSED if $P \ge 50.0\%$, FAILED if $P < 50.0\%$ | **PASS** |
| **REQ-SCORE-03** | **B** | Unrounded precision boundary evaluation ($5000/10001 \to \text{FAILED}$) | Milestone 3 Prereq | `ScoringService.evaluateSubmission` | `scoringService.test.js:9` | Mathematical Edge Case | Raw unrounded percentage decides status; rounded only for UI | **PASS** |
| **REQ-SCORE-04** | **A** | Detailed post-submission answer audit breakdown | STQA §1, Page 3 | `Results.render`, `GET /api/attempts/:id/results` | `exam.api.test.js:9`, `browser_automation.js:7` | API & Browser CDP Test | Reveals student choice, correct key, green/red audit badges | **PASS** |
| **REQ-ANLT-01** | **A** | Student Examination Submissions Reporting Table | STQA §1 (Page 8) | `AnalyticsService.getStudentSubmissionsTable` | `analyticsService.test.js:3`, `analytics.api.test.js:3` | Unit & API Integration | Sub ID, Student, Quiz, Score, Pct, Status, Timestamp | **PASS** |
| **REQ-ANLT-02** | **B** | Deterministic SQL Analytics (Overview & Quiz-wise Aggregations) | Review §1 (No ML) | `AnalyticsService.getOverview`, `getQuizWisePerformance` | `analyticsService.test.js:1-2`, `analytics.api.test.js:1-2` | Unit & API Integration | Computes total students, quizzes, submissions, pass rates via SQL | **PASS** |
| **REQ-DATA-01** | **B** | Persistent SQLite WebAssembly Data Access Layer | Review §2 | `db.js`, `database.sqlite` (sql.js) | `db.test.js:1-11`, `dal.test.js:1-13` | Relational Schema Tests | PRAGMA foreign_keys=ON, partial unique index, atomic export | **PASS** |
| **REQ-DATA-02** | **B** | Active attempt partial unique index | Milestone 1 Spec | `db.js` (`idx_active_attempt_unique`) | `db.test.js:4`, `dal.test.js:5` | Concurrent Constraint Tests | Enforces at most 1 IN_PROGRESS attempt per (user, quiz) | **PASS** |
| **REQ-DATA-03** | **B** | Cross-quiz question submission validation trigger | Milestone 1 Spec | `db.js` (`trg_validate_submission_question_quiz`) | `db.test.js:7`, `dal.test.js:8` | SQLite Trigger Tests | Prevents recording answers for questions from foreign quizzes | **PASS** |
| **REQ-UI-01** | **B** | Minimalist Academic UI Theme (Ivory, Charcoal, Forest Green) | Milestone 4 Spec | `public/css/styles.css` | `frontend.test.js:5`, `browser_automation.js:9` | CSS Variable & CDP Tests | Verified #F7F6F2, #242621, #345647, #A0A58A, #E7E5DE, #FFFFFF | **PASS** |
| **REQ-UI-02** | **C** | Safe DOM textContent rendering & XSS prevention | Milestone 4.1 Spec | `public/js/utils.js`, `admin.js`, `exam.js` | `frontend.test.js:14`, `browser_automation.js:1-10` | Code Inspection & CDP Tests | Zero unescaped innerHTML; safe textContent & createElement | **PASS** |

---

## 3. Summary Assessment & Category Totals

Following reconciliation in Milestone 5.1:
- **Total Formally Tracked Requirements:** **28**
  - **Category A (Report-Mandated):** **12** (100% of mapped test assertions passing)
  - **Category B (Implementation Assumptions):** **11** (100% of mapped test assertions passing)
  - **Category C (Defensive Enhancements):** **5** (100% of mapped test assertions passing)
- **Reconciliation Detail:** 
  - Category A was corrected from the previously misstated count of 11 to the actual row count of 12.
  - Category C was expanded from 4 to 5 by explicitly disaggregating `REQ-EXAM-07` (Server-authoritative receipt timestamp integrity) from the operational timer rules in `REQ-EXAM-02`, aligning the table with the five security controls described in Section 1.
  - The sum of category totals ($12 + 11 + 5 = 28$) exactly matches the 28 rows of the traceability table.
- **Verification Evidence:** All 28 requirements have automated verification coverage across 15 Jest suites (166 test cases) and 10 Chrome DevTools Protocol end-to-end browser tests.
