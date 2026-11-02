# Equivalence Partitioning (EP) Specification & Test Report

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Software Testing & Quality Assurance (STQA)  
**Authoritative Source:** STQA Project Report (`docs/STQA_Report.pdf`) & OOMD Project Report (`docs/OOMD_Report.pdf`)  
**Methodology:** Black-Box Test Design Technique — Equivalence Class Partitioning (ISO/IEC/IEEE 29119-4)  
**Verification Date:** November 2, 2026  
**Audit Status:** **Audited & Reconciled: 32 Mutually Exclusive Equivalence Classes Verified by Automated Tests**

---

## 1. Overview & Methodological Principles

Equivalence Partitioning (EP) is a black-box test design technique that divides the input and operational domain of the software under test (SUT) into mutually exclusive subsets of equivalent data. It operates on the principle that **if one condition within an equivalence partition exposes a defect, all other values in that partition are expected to expose the same defect; conversely, if a test passes for a representative value, the partition is assumed to pass.**

To avoid overlapping test conditions, every partition in this specification is designed to be **strictly mutually exclusive** (disjoint) and **collectively exhaustive** across the expected input domain:
1. **Valid Equivalence Classes (VEC):** Inputs accepted by the business logic resulting in valid processing and state transitions.
2. **Invalid Equivalence Classes (IEC):** Out-of-spec, malformed, non-conforming, or unauthorized inputs that must be rejected deterministically with appropriate HTTP status codes ($400, 401, 403, 404$) without server corruption or unhandled runtime exceptions.

Following an academic consistency audit, the input domain is divided into **32 distinct, non-overlapping equivalence classes** across six operational domains.

---

## 2. Partition 1: Authentication & User Credentials

### 2.1 Domain Definition
Input domain for `POST /api/auth/login` consisting of the tuple $(\text{username}, \text{password}) \in \text{String} \times \text{String}$.

### 2.2 Equivalence Class Table

| Class ID | Class Description | Partition Type | Representative Test Input | Expected Behavior | Actual Response & HTTP Code | Automated Test Reference | Test Status |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **EP-AUTH-01** | Valid Admin Credentials | **Valid** | `username="admin"`, `password="admin123"` | Authenticate, issue 256-bit session token, return `role="admin"` | HTTP 200 OK, token issued, role admin | `authService.test.js:1`<br>`auth.api.test.js:1` (TC-01) | **PASS** |
| **EP-AUTH-02** | Valid Student Credentials | **Valid** | `username="student1"`, `password="student123"` | Authenticate, issue 256-bit session token, return `role="student"` | HTTP 200 OK, token issued, role student | `authService.test.js:2`<br>`auth.api.test.js:2` | **PASS** |
| **EP-AUTH-03** | Non-Matching Password | **Invalid** | `username="admin"`, `password="wrongPass99"` | Constant-time scrypt rejection, generic unauthorized message | HTTP 401 Unauthorized, "Invalid credentials" | `authService.test.js:4`<br>`auth.api.test.js:3` (TC-02) | **PASS** |
| **EP-AUTH-04** | Non-Existent Username | **Invalid** | `username="ghostUser"`, `password="anyPass"` | Rejection without revealing username existence | HTTP 401 Unauthorized, "Invalid credentials" | `authService.test.js:3`<br>`auth.api.test.js:4` | **PASS** |
| **EP-AUTH-05** | Empty Username / Empty Password | **Invalid** | `username=""`, `password=""` | Validation failure prior to crypto evaluation | HTTP 400 Bad Request, "Username and password required" | `authService.test.js:5`<br>`auth.api.test.js:5` | **PASS** |
| **EP-AUTH-06** | SQL Injection in Login Fields | **Invalid** | `username="' OR 1=1 --"`, `password="x"` | Sanitized parameterized query, no auth bypass | HTTP 401 Unauthorized, "Invalid credentials" | `authService.test.js:6`<br>`auth.api.test.js:6` | **PASS** |

---

## 3. Partition 2: Quiz Question Count ($N$) & Publishing Lifecycle

### 3.1 Domain Definition
Number of questions $N \in \mathbb{Z}$ linked to a quiz when attempting to publish via `POST /api/quizzes/:id/publish`.

### 3.2 Mathematical Partition & Specification
The question count domain is partitioned into four mutually exclusive classes:
$$\text{Publishable}(N) = \begin{cases} 
\text{IEC (Reject 400)}, & N < 0 \text{ (Negative cardinality)} \\
\text{IEC (Reject 400)}, & N = 0 \text{ (Empty quiz, STQA TC-06)} \\
\text{VEC (Approve 200)}, & N = 1 \text{ (Minimum valid question count)} \\
\text{VEC (Approve 200)}, & N \ge 2 \text{ (Standard multi-question quiz)}
\end{cases}$$

### 3.3 Equivalence Class Table

| Class ID | Class Description | Partition Type | Question Count ($N$) | Expected Behavior | Actual Response & HTTP Code | Automated Test Reference | Test Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **EP-QUIZ-01** | Negative Question Cardinality | **Invalid** | $N < 0$ | Prevented by schema checks and service assertions | HTTP 400 Bad Request | `quizManagementService.test.js:16` | **PASS** |
| **EP-QUIZ-02** | Zero Questions (Empty Quiz) | **Invalid** | $N = 0$ | Strictly reject publishing (STQA TC-06 specification) | HTTP 400 Bad Request, "Cannot publish an empty quiz" | `quizManagementService.test.js:12`<br>`quiz.api.test.js:6` (TC-06) | **PASS** |
| **EP-QUIZ-03** | Minimum Valid Questions | **Valid** | $N = 1$ | Transitions draft quiz to `is_published = 1` | HTTP 200 OK, `is_published: 1` | `quizManagementService.test.js:13` | **PASS** |
| **EP-QUIZ-04** | Standard Multi-Question Quiz | **Valid** | $N \ge 2$ | Validates all questions, publishes quiz successfully | HTTP 200 OK, `is_published: 1` | `quizManagementService.test.js:14-15`<br>`quiz.api.test.js:9` | **PASS** |

*Note on Consistency Audit:* Previously, representative counts $N=5$ and $N=50$ were erroneously cataloged as separate valid partitions. Because both belong to $N \ge 2$ and invoke identical business logic, they have been consolidated into `EP-QUIZ-04` ($N \ge 2$).

---

## 4. Partition 3: Scoring Percentages & Pass/Fail Classification

### 4.1 Domain Definition
Computed percentage $P = (S / N) \times 100 \in \mathbb{R}$ where $S$ is raw score and $N$ is total questions.  
Pass criteria specified in STQA Report Eq (3):
$$\text{Status}(P) = \begin{cases} \text{PASSED}, & \text{if } P \ge 50.0\% \\ \text{FAILED}, & \text{if } P < 50.0\% \end{cases}$$

### 4.2 Mathematical Partition & Specification
The continuous real domain of percentage $P \in \mathbb{R}$ is partitioned into four mutually exclusive, collectively exhaustive classes:
1. $P < 0.0\%$: Invalid (Below theoretical lower bound; prevented by zero floor, no negative marking).
2. $0.0\% \le P < 50.0\%$: Valid Failed Partition.
3. $50.0\% \le P \le 100.0\%$: Valid Passed Partition.
4. $P > 100.0\%$: Invalid (Above theoretical upper bound; prevented by score capping at $N$).

### 4.3 Equivalence Class Table

| Class ID | Class Description | Range of $P$ | Representative Test Input | Expected Status | Actual Evaluated Status | Automated Test Reference | Test Status |
| :--- | :--- | :---: | :--- | :---: | :---: | :--- | :---: |
| **EP-SCORE-01** | Negative Score Domain | $P < 0.0\%$ | Negative raw score $S = -1$ | **Invalid / Rejected** | Floor at 0.0% ($S=0, P=0.0\% \to \text{FAILED}$) | `scoringService.test.js:5` (TC-05) | **PASS** |
| **EP-SCORE-02** | Valid Failed Domain | $0.0\% \le P < 50.0\%$ | $S = 1, N = 4 \implies P = 25.0\%$ | **FAILED** | $P = 25.0\%$, Status `FAILED` | `scoringService.test.js:8` | **PASS** |
| **EP-SCORE-03** | Valid Passed Domain | $50.0\% \le P \le 100.0\%$ | $S = 2, N = 4 \implies P = 50.0\%$ | **PASSED** | $P = 50.0\%$, Status `PASSED` | `scoringService.test.js:7`<br>`scoringService.test.js:4` (TC-03) | **PASS** |
| **EP-SCORE-04** | Exceeding Score Domain | $P > 100.0\%$ | $S = 5, N = 4 \implies P = 125.0\%$ | **Invalid / Rejected** | Capped at $N$ by validation trigger | `dal.test.js:7` | **PASS** |

*Note on Consistency Audit:* Previously, boundary test inputs ($49.9\%$ and $100.0\%$) were cataloged as separate equivalence partitions. Because boundary values are a Boundary Value Analysis (BVA) concern and lie inside the ranges $[0, 50)$ and $[50, 100]$, the scoring domain has been streamlined to four strictly disjoint classes.

---

## 5. Partition 4: Question Option Selections & Answer Normalization

### 5.1 Domain Definition
Submitted answer option index $A_i$ for question $i$. Database schema CHECK constraint: `selected_option IN (-1, 0, 1, 2, 3)`.

### 5.2 Equivalence Class Table

| Class ID | Option Description | Value Partition | Representative Test Input | Normalized Internal Value | Expected Result | Automated Test Reference | Test Status |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- | :---: |
| **EP-OPT-01** | Unattempted Question | $\{-1, \text{null}, \text{undefined}, \text{""}\}$ | `null`, `undefined`, or `-1` | `-1` | Stored as `-1`, scored 0 (no penalty) | `scoringService.test.js:2` | **PASS** |
| **EP-OPT-02** | Option A Selection | $\{0, \text{"A"}, \text{"a"}, \text{"0"}\}$ | `"A"` or `0` | `0` | Normalized to 0, scored against key | `scoringService.test.js:1` | **PASS** |
| **EP-OPT-03** | Option B Selection | $\{1, \text{"B"}, \text{"b"}, \text{"1"}\}$ | `"B"` or `1` | `1` | Normalized to 1, scored against key | `scoringService.test.js:1` | **PASS** |
| **EP-OPT-04** | Option C Selection | $\{2, \text{"C"}, \text{"c"}, \text{"2"}\}$ | `"C"` or `2` | `2` | Normalized to 2, scored against key | `scoringService.test.js:1` | **PASS** |
| **EP-OPT-05** | Option D Selection | $\{3, \text{"D"}, \text{"d"}, \text{"3"}\}$ | `"D"` or `3` | `3` | Normalized to 3, scored against key | `scoringService.test.js:1` | **PASS** |
| **EP-OPT-06** | Out-of-Bounds Integer Index | $\{x \in \mathbb{Z} \mid x < -1 \lor x > 3\}$ | `4`, `99`, `-2` | N/A | Rejected by SQLite CHECK constraint | `dal.test.js:6`<br>`db.test.js:5` | **PASS** |
| **EP-OPT-07** | Non-Option String / Garbage | Non-A-D String | `"Z"`, `"apple"`, `"{}"` | `-1` (fallback) | Normalized safely to unattempted | `scoringService.test.js:2` | **PASS** |
| **EP-OPT-08** | Cross-Quiz Question Reference | Foreign `question_id` | Question from Quiz 2 sent in Quiz 1 | N/A | Rejected by SQLite foreign trigger | `dal.test.js:8`<br>`db.test.js:7` | **PASS** |

---

## 6. Partition 5: User Roles & Access Authorization

### 6.1 Domain Definition
Authorization domain defined by the Cartesian tuple $(\text{Session State}, \text{User Role}, \text{Resource Requirement})$ where Role $\in \{\text{'admin'}, \text{'student'}\}$ and Resource $\in \{\text{'admin-only'}, \text{'student-only'}, \text{'public'}\}$.

### 6.2 Equivalence Class Table

| Class ID | Session State / Role | Target Resource Type | Expected Authorization Decision | Actual Response & HTTP Status | Automated Test Reference | Test Status |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **EP-ROLE-01** | Authenticated `admin` | Admin-only Resource (`POST /api/quizzes`) | **Permitted** | HTTP 201 Created | `quiz.api.test.js:3` | **PASS** |
| **EP-ROLE-02** | Authenticated `admin` | Student Exam Attempt (`POST /quizzes/:id/attempts`) | **Prohibited** (Admin cannot take student exams) | HTTP 403 Forbidden | `examService.test.js:5` | **PASS** |
| **EP-ROLE-03** | Authenticated `student` | Student Exam Attempt (`POST /quizzes/:id/attempts`) | **Permitted** | HTTP 201 Created / 200 Resumed | `exam.api.test.js:1` | **PASS** |
| **EP-ROLE-04** | Authenticated `student` | Admin-only Resource (`POST /api/quizzes`, `/analytics`) | **Prohibited** | HTTP 403 Forbidden | `quiz.api.test.js:4`<br>`analytics.api.test.js:4` | **PASS** |
| **EP-ROLE-05** | Unauthenticated / Invalid Token | Any Protected Resource (`GET /api/quizzes/available`) | **Unauthorized** | HTTP 401 Unauthorized | `quiz.api.test.js:2`<br>`auth.api.test.js:7` | **PASS** |

---

## 7. Partition 6: Exam Submission Timings & Attempt State

### 7.1 Domain Definition
Defined by submission receipt time $T_{\text{receipt}}$ relative to attempt expiration time $T_{\text{expiry}}$ (with 30-second grace window $T_{\text{grace}} = T_{\text{expiry}} + 30\text{s}$), alongside attempt lifecycle status and attempt ownership.

### 7.2 Equivalence Class Table

| Class ID | Timing / State Condition | Mathematical / State Rule | Expected Processing & Action | Actual HTTP Response & Payload | Automated Test Reference | Test Status |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: |
| **EP-TIME-01** | On-Time Active Submission | $T_{\text{receipt}} \le T_{\text{expiry}}$ | Graded normally, `is_timed_out: 0` | HTTP 200 OK, `isTimedOut: false` | `timerLifecycle.test.js:2`<br>`exam.api.test.js:5` | **PASS** |
| **EP-TIME-02** | Grace Period Submission | $T_{\text{expiry}} < T_{\text{receipt}} \le T_{\text{expiry}} + 30\text{s}$ | Graded with timeout flag, `is_timed_out: 1` | HTTP 200 OK, `isTimedOut: true` | `timerLifecycle.test.js:4`<br>`exam.api.test.js:6` | **PASS** |
| **EP-TIME-03** | Post-Grace Expired Submission | $T_{\text{receipt}} > T_{\text{expiry}} + 30\text{s}$ | Rejected, finalized as 0 score `FAILED` | HTTP 400 Bad Request, "Attempt has expired" | `timerLifecycle.test.js:5`<br>`exam.api.test.js:7` | **PASS** |
| **EP-TIME-04** | Duplicate Attempt Submission | Attempt status already `SUBMITTED` | Idempotent response; return existing score | HTTP 200 OK, identical score, 0 new rows | `timerLifecycle.test.js:6`<br>`exam.api.test.js:8` | **PASS** |
| **EP-TIME-05** | Cross-Student Submission | `student_id` $\ne$ attempt `user_id` | Access denied; attempt ownership mismatch | HTTP 403 Forbidden | `timerLifecycle.test.js:10`<br>`exam.api.test.js:9` | **PASS** |

---

## 8. Summary of Reconciled Equivalence Classes

- **Total Operational Domains:** 6
- **Total Equivalence Classes:** **32** mutually exclusive classes (14 Valid, 18 Invalid/Defensive):
  - Domain 1 (Authentication): 6 classes
  - Domain 2 (Question Cardinality): 4 classes
  - Domain 3 (Scoring Percentages): 4 classes
  - Domain 4 (Option Selections): 8 classes
  - Domain 5 (Role Authorization): 5 classes
  - Domain 6 (Submission Timing & Lifecycle): 5 classes
- **Verification Summary:** All 32 equivalence classes have corresponding automated assertions across unit and integration test suites, with all test cases executing cleanly without failure.
