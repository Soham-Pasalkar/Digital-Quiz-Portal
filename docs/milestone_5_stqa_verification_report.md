# Milestone 5: Final STQA Verification & Academic Evidence Report

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Disciplines:** Software Testing & Quality Assurance (STQA) & Object-Oriented Modeling & Design (OOMD)  
**Authoritative Specifications:** STQA Project Report (`docs/STQA_Report.pdf`) & OOMD Project Report (`docs/OOMD_Report.pdf`)  
**Audit & Verification Date:** November 2, 2026  
**Final Status:** **Audited & Reconciled — 15 Automated Suites Passing (166/166 Tests) | 10 CDP Real-Browser Tests Passing**

---

## 1. Executive Summary & Verification Scope

This document represents the formal Milestone 5 verification synthesis for the Digital Quiz Portal. The verification demonstrates that the implementation satisfies the functional requirements, mathematical scoring models, and quality objectives mandated by the STQA and OOMD academic specifications.

All testing, verification, and empirical quality deliverables are maintained under [`docs/stqa/`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa):

| Deliverable Name | File Path | Scope & Methodological Focus | Key Metric / Verification Outcome |
| :--- | :--- | :--- | :--- |
| **1. Requirement Traceability Matrix** | [`requirement_traceability_matrix.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/requirement_traceability_matrix.md) | Bidirectional mapping from report specs to tests | 28/28 Requirements mapped (12 Cat A, 11 Cat B, 5 Cat C) |
| **2. Equivalence Partitioning** | [`equivalence_partitioning.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/equivalence_partitioning.md) | Disjoint black-box input domain partitioning | 32 Mutually exclusive classes across 6 domains |
| **3. Boundary Value Analysis** | [`boundary_value_analysis.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/boundary_value_analysis.md) | 2-point and 3-point threshold analysis | 24 Boundaries verified ($0\%, 49.9\%, 50.0\%, 100\%$, timers) |
| **4. Decision Table Testing** | [`decision_table_testing.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/decision_table_testing.md) | Cause-effect truth tables for compound states | 17 Decision rules (Auth, Immutability, Timer integrity) |
| **5. White-Box Testing & Coverage** | [`white_box_testing.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/white_box_testing.md) | Istanbul coverage & McCabe basis path analysis | Stmts 84.28%, Branch 70.04%; $V(G)_{\text{scoring}}=11, V(G)_{\text{submit}}=8$ |
| **6. Regression Testing Report** | [`regression_testing_report.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/regression_testing_report.md) | Full regression suite and viewport matrix | 166 backend tests (9.48s) + 10 CDP browser tests |
| **7. Defect Tracking Log** | [`defect_tracking_log.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/defect_tracking_log.md) | IEEE 1044 anomaly tracking & root-cause analysis | 10 Defects logged, investigated, and certified closed |
| **8. Performance & Quality Evaluation** | [`performance_and_quality_evaluation.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/performance_and_quality_evaluation.md) | ISO/IEC 25010 audit & empirical API benchmarks | Login: 22.4ms, Catalog: 2.8ms, Submit: 8.6ms |

---

## 2. Requirement Traceability & Categorization Summary

Following the Milestone 5.1 consistency audit, the portal requirements have been cataloged into three explicit categories:
1. **Category A (Report-Mandated, 12 Requirements):** Directly derived from the authoritative STQA and OOMD project reports:
   - Admin authentication ([TC-01](file:///Users/soham/Github/Digital-Quiz-Portal/tests/integration/auth.api.test.js#L30)), invalid password rejection ([TC-02](file:///Users/soham/Github/Digital-Quiz-Portal/tests/integration/auth.api.test.js#L54)), role separation (`admin` vs `student`).
   - Quiz creation and question authoring with exactly 4 options A–D.
   - Empty quiz publishing rejection ([TC-06](file:///Users/soham/Github/Digital-Quiz-Portal/tests/integration/quiz.api.test.js#L30)).
   - Single-question examination view with navigation palette.
   - Auto-submission on timer expiry.
   - Deterministic raw scoring ($S = \sum f(S_i, C_i)$) and 50% pass mark classification.
   - Post-submission answer audit breakdown and student submissions reporting table (Results Page 8).
2. **Category B (Implementation Assumptions, 11 Requirements):** Approved engineering decisions bridging specification ambiguities:
   - Session management (24h TTL), quiz immutability lock once attempts exist.
   - 10-minute duration and 30-second grace window operational rules.
   - Submission idempotency and session persistence across page reloads.
   - Unrounded floating-point percentage evaluation ($5000/10001 \to \text{FAILED}$).
   - Deterministic SQL analytics, sql.js WebAssembly persistence, partial unique active attempt index, cross-quiz question trigger, and academic ivory/forest green styling.
3. **Category C (Security & Integrity Enhancements, 5 Requirements):** Defensive controls hardening the portal:
   - `crypto.scrypt` password hashing with unique random salts and constant-time verification.
   - Active examination question answer-key concealment (`correct_option` stripped).
   - Cross-student attempt isolation and ownership validation.
   - Server-authoritative receipt timestamp integrity (client clocks strictly distrusted).
   - Safe DOM construction (`textContent`, `replaceChildren`) preventing DOM-based XSS.

**Category Reconciliation:** $12 (\text{Cat A}) + 11 (\text{Cat B}) + 5 (\text{Cat C}) = 28$ requirements. All 28 have verified automated test coverage in [`docs/stqa/requirement_traceability_matrix.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/requirement_traceability_matrix.md).

---

## 3. Black-Box Test Design Technique Outcomes

### 3.1 Equivalence Partitioning (EP)
- Detailed in [`docs/stqa/equivalence_partitioning.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/equivalence_partitioning.md).
- Formally divided into **32 mutually exclusive, collectively exhaustive classes** across 6 operational domains:
  - Authentication (6 classes: admin, student, wrong password, non-existent user, empty input, SQL injection payload).
  - Question Cardinality (4 classes: $N < 0$ invalid, $N = 0$ invalid empty quiz, $N = 1$ valid minimum, $N \ge 2$ valid standard).
  - Scoring Percentages (4 classes: $P < 0\%$, $0\% \le P < 50\%$, $50\% \le P \le 100\%$, $P > 100\%$).
  - Option Selections (8 classes: unattempted $-1$, options A–D, out-of-bounds integers, non-numeric strings, foreign quiz questions).
  - Role Authorization (5 classes: admin permitted, admin forbidden from student exam, student permitted, student forbidden from admin authoring, unauthenticated).
  - Submission Timing & State (5 classes: on-time, grace window, post-grace expired, terminal duplicate submitted, ownership mismatch).

### 3.2 Boundary Value Analysis (BVA)
- Detailed in [`docs/stqa/boundary_value_analysis.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/boundary_value_analysis.md).
- Evaluates 24 boundary conditions using two-point and three-point boundaries.
- **Unrounded Precision Proof:** Validates that an edge-case score of 5000 out of 10001 ($49.99500...\%$) rounds to `50.00%` on display but evaluates strictly to `status: "FAILED"`, defeating premature-rounding pass exploits.
- **Timer Expiration Boundaries:** Validates arrival at $T_{\text{expiry}} - 1\text{s}$, $T_{\text{expiry}}$, $T_{\text{expiry}} + 1\text{s}$, $T_{\text{expiry}} + 30\text{s}$ (grace), and $T_{\text{expiry}} + 31\text{s}$ (rejected).

### 3.3 Decision Table Testing
- Detailed in [`docs/stqa/decision_table_testing.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/decision_table_testing.md).
- Implements 17 cause-effect truth table rules across Authentication & RBAC, Quiz Publishing & Immutability, and Timer Integrity & Idempotency.

---

## 4. White-Box Testing, Coverage & Cyclomatic Complexity

### 4.1 Structural Code Coverage
- Detailed in [`docs/stqa/white_box_testing.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/white_box_testing.md).
- **Global Coverage Metrics:**
  - **Statements:** 84.28%
  - **Branches:** 70.04%
  - **Functions:** 95.13% (100.0% across all 5 domain services and middleware)
  - **Lines:** 85.74%
- **Route Registration vs. Branch Coverage:** 100% of declared Express route definitions are registered and exercised by integration tests. However, branch coverage within controllers is 52.29%, reflecting 29.96% unexercised branches primarily composed of defensive outer `try/catch` 500 handlers, CLI execution guards (`seed.js`), and fallback ternary conditions.

### 4.2 McCabe's Cyclomatic Complexity & Basis Path Analysis
1. [`ScoringService.evaluateSubmission`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/scoringService.js#L85-L163):
   - 10 decision predicates $\implies V(G) = 10 + 1 = 11$.
   - **11 Independent Basis Paths** (`PATH-S1` through `PATH-S11`), all executed by unit tests in [`scoringService.test.js`](file:///Users/soham/Github/Digital-Quiz-Portal/tests/unit/scoringService.test.js).
2. [`ExamService.submitAttempt`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/examService.js#L227-L345):
   - 7 decision predicates $\implies V(G) = 7 + 1 = 8$.
   - **8 Independent Basis Paths** (`PATH-E1` through `PATH-E8`), all executed by unit and integration tests in [`examService.test.js`](file:///Users/soham/Github/Digital-Quiz-Portal/tests/unit/examService.test.js) and [`timerLifecycle.test.js`](file:///Users/soham/Github/Digital-Quiz-Portal/tests/integration/timerLifecycle.test.js).

---

## 5. Performance Benchmarks & Quality Evaluation

- Detailed in [`docs/stqa/performance_and_quality_evaluation.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/performance_and_quality_evaluation.md).
- **Latency Distribution (50 samples, 5 warm-up runs):**
  - `/api/auth/login`: Mean **22.4 ms** ($p_{95} = 28.1\text{ms}$) due to scrypt work factor (16,384 iterations).
  - `/api/quizzes/available`: Mean **2.8 ms** ($p_{95} = 4.2\text{ms}$).
  - `/api/attempts/:id/submit`: Mean **8.6 ms** ($p_{95} = 12.4\text{ms}$).
- **Documented Measurement Context:** Benchmarks reflect local loopback execution on Apple Silicon Node.js v25.9.0; WAN network latency, TLS termination, and multi-user concurrent socket contention were not measured in this academic harness.
- **Architectural Limitations:** In-memory session registry (process-bound), single-threaded CPU contention during concurrent password hashing, and WebAssembly SQLite memory limits.
- **ISO/IEC 25010 Assessment:** Verified across Functional Suitability, Performance Efficiency, Compatibility, Usability, Reliability, Security, Maintainability, and Portability.

---

## 6. Defect Tracking & Regression Verification

- Detailed in [`docs/stqa/defect_tracking_log.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/defect_tracking_log.md) and [`docs/stqa/regression_testing_report.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/regression_testing_report.md).
- **Logged Defects:** 10 defects identified and resolved across Milestones 1 to 4.1:
  - 5 Critical (S1): Supertest loopback permission, concurrent attempt index, quiz immutability, receipt timestamp vulnerability, inline `onclick` XSS.
  - 3 High (S2): Floating-point score rounding, route collision (`/available` vs `/:id`), post-grace 500 error.
  - 2 Medium (S3): History response key mismatch, question projection aliases.
- **Resolution Status:** 10/10 defects resolved, covered by automated regression tests, and certified closed. Testing confirms absence of regressions across all 15 test suites and 166 test cases.

---

## 7. Deliverable Verification Index

The nine required deliverables are located at:
1. `docs/stqa/requirement_traceability_matrix.md`
2. `docs/stqa/equivalence_partitioning.md`
3. `docs/stqa/boundary_value_analysis.md`
4. `docs/stqa/decision_table_testing.md`
5. `docs/stqa/white_box_testing.md`
6. `docs/stqa/regression_testing_report.md`
7. `docs/stqa/defect_tracking_log.md`
8. `docs/stqa/performance_and_quality_evaluation.md`
9. `docs/milestone_5_stqa_verification_report.md`

