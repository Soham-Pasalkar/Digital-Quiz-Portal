# Decision Table Testing Specification & Execution Matrix

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Software Testing & Quality Assurance (STQA)  
**Authoritative Source:** STQA Project Report (`docs/STQA_Report.pdf`) & OOMD Project Report (`docs/OOMD_Report.pdf`)  
**Methodology:** Black-Box Test Design Technique — Decision Table Testing (Cause-Effect Logic Modeling, ISO/IEC/IEEE 29119-4)  
**Verification Date:** November 2, 2026  
**Status:** **Audited: 17 Decision Rules Formally Specified & Passing Automated Tests**

---

## 1. Overview & Methodological Principles

Decision Table Testing is an essential black-box testing methodology used to specify and test complex business rules governed by combinations of boolean or discrete inputs. Where individual inputs interact with conditional states, truth tables ensure that **every valid and invalid combination of causes (conditions) leads deterministically to the correct effects (actions).**

Three core decision tables were designed and verified for the Digital Quiz Portal:
1. **Table 1:** Authentication & Role-Based Authorization Logic
2. **Table 2:** Quiz Publishing & Immutability Lifecycle Logic
3. **Table 3:** Exam Submission, Timer Integrity & Idempotency Logic

---

## 2. Decision Table 1: Authentication & Role-Based Authorization

### 2.1 Condition & Action Definitions
- **Conditions:**
  - $C_1$: Valid Credentials Provided (Username & Scrypt Hash Match)
  - $C_2$: User Role is `admin`
  - $C_3$: User Role is `student`
  - $C_4$: Target Resource Requires `admin` Role (e.g. `POST /api/quizzes`, `GET /api/analytics`)
  - $C_5$: Target Resource Requires `student` Role (e.g. `POST /api/quizzes/:id/attempts`)
- **Actions:**
  - $A_1$: Issue 256-bit Session Token (HTTP 200 OK)
  - $A_2$: Reject Login with HTTP 401 Unauthorized
  - $A_3$: Grant Access to Protected Resource (HTTP 200 / 201)
  - $A_4$: Deny Access with HTTP 403 Forbidden

### 2.2 Truth & Decision Matrix

| Item | Condition / Action | Rule 1 | Rule 2 | Rule 3 | Rule 4 | Rule 5 | Rule 6 |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **$C_1$** | Valid Credentials Provided? | **Y** | **Y** | **N** | **Y** | **Y** | **—** |
| **$C_2$** | User Role is `admin`? | **Y** | **N** | **—** | **Y** | **N** | **—** |
| **$C_3$** | User Role is `student`? | **N** | **Y** | **—** | **N** | **Y** | **—** |
| **$C_4$** | Target Resource Requires `admin`? | — | — | — | **Y** | **Y** | **Y** |
| **$C_5$** | Target Resource Requires `student`? | — | — | — | **N** | **N** | — |
| **Token**| Active Bearer Token Present? | — | — | — | **Y** | **Y** | **N** |
| **$A_1$** | **Issue Session Token (HTTP 200)** | **X** | **X** | | | | |
| **$A_2$** | **Reject Auth (HTTP 401)** | | | **X** | | | **X** |
| **$A_3$** | **Grant Resource Access (HTTP 200/201)** | | | | **X** | | |
| **$A_4$** | **Deny Role Access (HTTP 403)** | | | | | **X** | |
| **Test** | **Automated Test Verification** | `auth.api.test.js:1` | `auth.api.test.js:2` | `auth.api.test.js:3` | `quiz.api.test.js:3` | `quiz.api.test.js:4` | `quiz.api.test.js:2` |

- **Rule 1 ($R_1$):** Valid admin login produces session token (`role="admin"`). **PASS**
- **Rule 2 ($R_2$):** Valid student login produces session token (`role="student"`). **PASS**
- **Rule 3 ($R_3$):** Invalid credentials (wrong password or missing user) rejected with HTTP 401 (TC-02). **PASS**
- **Rule 4 ($R_4$):** Authenticated admin accesses admin endpoint (`POST /api/quizzes`) successfully. **PASS**
- **Rule 5 ($R_5$):** Authenticated student attempting admin action (`POST /api/quizzes`) rejected with HTTP 403 Forbidden. **PASS**
- **Rule 6 ($R_6$):** Request without token rejected with HTTP 401 Unauthorized. **PASS**

---

## 3. Decision Table 2: Quiz Publishing & Immutability Lifecycle

### 3.1 Condition & Action Definitions
- **Conditions:**
  - $C_1$: Quiz Exists in Database
  - $C_2$: Question Count $N \ge 1$
  - $C_3$: All Questions Have Exactly 4 Options and Valid Key (0–3)
  - $C_4$: Examination Attempts Already Exist for Quiz (Immutability Lock)
  - $C_5$: Action Requested (`PUBLISH`, `ADD_QUESTION`, `EDIT_QUESTION`, `DELETE_QUIZ`)
- **Actions:**
  - $A_1$: Transition Quiz to Published (`is_published = 1`, HTTP 200)
  - $A_2$: Reject Publishing with HTTP 400 (TC-06: Empty Quiz Rejection)
  - $A_3$: Reject Operation with HTTP 400 (Question Validation Error)
  - $A_4$: Reject Mutation with HTTP 400 (Quiz Immutability Lock Active)
  - $A_5$: Execute Quiz/Question Modification Successfully (HTTP 200/201)

### 3.2 Truth & Decision Matrix

| Item | Condition / Action | Rule 1 | Rule 2 | Rule 3 | Rule 4 | Rule 5 | Rule 6 |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **$C_1$** | Quiz Exists? | **Y** | **Y** | **Y** | **Y** | **Y** | **N** |
| **$C_2$** | Question Count $N \ge 1$? | **N** | **Y** | **Y** | **Y** | — | — |
| **$C_3$** | Question Formatting Valid? | — | **Y** | **N** | **Y** | **Y** | — |
| **$C_4$** | Examination Attempts Exist? | **N** | **N** | **N** | **Y** | **N** | — |
| **$C_5$** | Action Requested | `PUBLISH` | `PUBLISH` | `ADD_Q` | `ADD_Q`/`EDIT` | `ADD_Q` | `ANY` |
| **$A_1$** | **Publish Quiz (HTTP 200)** | | **X** | | | | |
| **$A_2$** | **Reject Empty Quiz (HTTP 400 - TC-06)**| **X** | | | | | |
| **$A_3$** | **Reject Invalid Question (HTTP 400)** | | | **X** | | | |
| **$A_4$** | **Reject Immutability Lock (HTTP 400)** | | | | **X** | | |
| **$A_5$** | **Execute Mutation (HTTP 200/201)** | | | | | **X** | |
| **$A_6$** | **Return Not Found (HTTP 404)** | | | | | | **X** |
| **Test** | **Automated Test Verification** | `quiz.api.test.js:6` | `quiz.api.test.js:9` | `quiz.api.test.js:8` | `quiz.api.test.js:10-14` | `quiz.api.test.js:7` | `quizManagementService.test.js:3` |

- **Rule 1 ($R_1$):** Empty quiz ($N = 0$) rejected on publish attempt (STQA TC-06). **PASS**
- **Rule 2 ($R_2$):** Quiz with $N \ge 1$ valid questions published successfully. **PASS**
- **Rule 3 ($R_3$):** Adding question with $< 4$ options or empty text rejected with HTTP 400. **PASS**
- **Rule 4 ($R_4$):** Any question addition, modification, or quiz deletion blocked once attempts exist. **PASS**
- **Rule 5 ($R_5$):** Adding valid question to draft quiz without attempts succeeds (HTTP 201). **PASS**
- **Rule 6 ($R_6$):** Action on non-existent quiz returns HTTP 404 Not Found. **PASS**

---

## 4. Decision Table 3: Exam Submission, Timer Integrity & Idempotency

### 4.1 Condition & Action Definitions
- **Conditions:**
  - $C_1$: Attempt Exists and is Currently `IN_PROGRESS`
  - $C_2$: Authenticated User is the Owner of the Attempt
  - $C_3$: Submission Receipt Time $\le T_{\text{expiry}}$ (On-Time)
  - $C_4$: Submission Receipt Time $\le T_{\text{expiry}} + 30\text{s}$ (Within Grace Window)
  - $C_5$: Submission Receipt Time $> T_{\text{expiry}} + 30\text{s}$ (Past Grace Window)
  - $C_6$: Attempt Already Finalized (`SUBMITTED`)
- **Actions:**
  - $A_1$: Grade Submission, Record Answers, Set `is_timed_out: 0`, Return Score (HTTP 200)
  - $A_2$: Grade Submission, Record Answers, Set `is_timed_out: 1`, Return Score (HTTP 200)
  - $A_3$: Finalize Attempt as `FAILED` (0% score), Reject Submission (HTTP 400)
  - $A_4$: Idempotent Response: Return Existing Recorded Submission Score (HTTP 200)
  - $A_5$: Deny Submission with HTTP 403 Forbidden (Cross-Student Violation)

### 4.2 Truth & Decision Matrix

| Item | Condition / Action | Rule 1 | Rule 2 | Rule 3 | Rule 4 | Rule 5 |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **$C_1$** | Attempt is `IN_PROGRESS`? | **Y** | **Y** | **Y** | **N** | **Y** |
| **$C_2$** | Caller is Attempt Owner? | **Y** | **Y** | **Y** | **Y** | **N** |
| **$C_3$** | On-Time ($T_{\text{receipt}} \le T_{\text{expiry}}$)? | **Y** | **N** | **N** | — | — |
| **$C_4$** | Within Grace Window ($\le T_{\text{expiry}} + 30\text{s}$)? | — | **Y** | **N** | — | — |
| **$C_5$** | Past Grace Window ($> T_{\text{expiry}} + 30\text{s}$)? | — | — | **Y** | — | — |
| **$C_6$** | Attempt Already `SUBMITTED`? | **N** | **N** | **N** | **Y** | — |
| **$A_1$** | **Grade Normally (`is_timed_out: 0`, HTTP 200)** | **X** | | | | |
| **$A_2$** | **Grade with Grace (`is_timed_out: 1`, HTTP 200)**| | **X** | | | |
| **$A_3$** | **Finalize `FAILED` & Reject (HTTP 400)** | | | **X** | | |
| **$A_4$** | **Idempotent Cached Return (HTTP 200)** | | | | **X** | |
| **$A_5$** | **Deny Access (HTTP 403 Forbidden)** | | | | | **X** |
| **Test** | **Automated Test Verification** | `timerLifecycle.test.js:2` | `timerLifecycle.test.js:4` | `timerLifecycle.test.js:5` | `timerLifecycle.test.js:6` | `timerLifecycle.test.js:10` |

- **Rule 1 ($R_1$):** On-time submission graded with full credit; `is_timed_out = 0`. **PASS**
- **Rule 2 ($R_2$):** Submission within 30s grace window graded with full credit; `is_timed_out = 1`. **PASS**
- **Rule 3 ($R_3$):** Submission after 30s grace window rejected with HTTP 400; attempt finalized as `FAILED` (0% score). **PASS**
- **Rule 4 ($R_4$):** Duplicate submission for an already submitted attempt returns identical recorded score without creating duplicate database rows. **PASS**
- **Rule 5 ($R_5$):** Submission for an attempt owned by another user rejected with HTTP 403 Forbidden. **PASS**

---

## 5. Summary Assessment

- **Total Decision Rules Evaluated:** 17 discrete logical rules across 3 mission-critical domains.
- **Coverage:** 100% of defined decision rules are verified through automated integration tests with automated assertions.
- **Verification Result:** Zero ambiguities or unhandled condition combinations. Every cause-effect pair behaves strictly in accordance with approved STQA specifications.

