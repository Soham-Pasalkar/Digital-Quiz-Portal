# Milestone 6.1: UML Modeling Consistency Audit Report

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Object-Oriented Modeling and Design (OOMD)  
**Authoritative Sources:** OOMD Project Report (`docs/OOMD_Report.pdf`) & Implementation Source Code  
**Audit Date:** November 2, 2026  
**Auditor / Architect Role:** Senior Software Architect, OOMD Specialist & Full-Stack Engineer  
**Audit Verdict:** **UML Consistency Audit Complete — All Discrepancies Resolved & Verified**

---

## 1. Executive Summary & Audit Mandate

Following the initial delivery of Milestone 6, an in-depth UML modeling consistency review was performed to eliminate conceptual conflations, ensure strict adherence to database persistence schemas, refine use-case actor goals, and verify physical deployment boundaries.

This audit report documents:
1. The modeling issues identified during review.
2. The exact structural and behavioral corrections applied.
3. The specific UML diagrams updated.
4. Source-code references grounding the architectural truth.
5. Remaining technical modeling limitations.
6. The final consistency certification.

---

## 2. Issues Discovered & Applied Corrections

### Issue 1: Conflation of Authentication and Exam Attempt Lifecycles (Diagram 5)
- **Discrepancy:** The initial state machine diagram combined user authentication states (`LoggedOut`, `Authenticating`, `LoggedIn`) and examination attempt states (`ExamInProgress`, `Evaluated`) into a single, monolithic state transition graph. In software architecture, user sessions and examination attempts operate on distinct domain entities with different lifespans (session: 24h memory; attempt: persisted relational record).
- **Correction Applied:** Separated the model into **two independent, decoupled state machines**:
  1. **State Machine 5A: Authentication Session Lifecycle:** Models `LoggedOut` $\leftrightarrow$ `Authenticating` $\to$ `LoggedIn` with successful login, invalid credential rejection (HTTP 401), explicit logout, and 24-hour TTL expiration.
  2. **State Machine 5B: Examination Attempt Lifecycle (`Submission` Entity):** Models the lifecycle of an examination record from `NonExistent` $\to$ `IN_PROGRESS` $\to$ `PASSED` / `FAILED`.
- **Document Updated:** [`docs/oomd/state_machine_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/state_machine_diagram.md).

---

### Issue 2: Artificial Non-Persisted State `GracePeriodActive` (Diagram 5)
- **Discrepancy:** The initial state machine modeled `GracePeriodActive` as an explicit persisted state. However, inspection of `src/database/schema.sql` (line 53) and `src/config/constants.js` revealed that `submissions.status` strictly enforces `CHECK(status IN ('IN_PROGRESS', 'PASSED', 'FAILED'))`. No database status `GracePeriodActive` exists; the grace period is a server-side timer rule, not an entity state.
- **Correction Applied:**
  - Removed `GracePeriodActive` as a persisted state.
  - Modeled the 30-second grace window as a **guarded time transition condition** on `IN_PROGRESS` during submission receipt:
    - *On-Time Transition:* $T_{\text{receipt}} \le T_{\text{expiry}} \implies$ sets `is_timed_out = 0`, evaluates percentage, transitions to `PASSED` ($P \ge 50\%$) or `FAILED` ($P < 50\%$).
    - *Grace-Period Transition:* $T_{\text{expiry}} < T_{\text{receipt}} \le T_{\text{expiry}} + 30\text{s} \implies$ sets `is_timed_out = 1`, evaluates percentage, transitions to `PASSED` ($P \ge 50\%$) or `FAILED` ($P < 50\%$).
    - *Post-Grace Transition:* $T_{\text{receipt}} > T_{\text{expiry}} + 30\text{s} \implies$ auto-finalizes to `FAILED` (score = 0, `is_timed_out = 1`), rejects request with HTTP 400 Bad Request.
  - Modeled submission idempotency as a self-loop on terminal states (`PASSED`/`FAILED`) returning cached scores without duplicate grading.
- **Document Updated:** [`docs/oomd/state_machine_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/state_machine_diagram.md).

---

### Issue 3: Use Case Diagram Conflating Actor Goals with Internal System Behavior (Diagram 1)
- **Discrepancy:** The initial Use Case Diagram included internal technical subroutines (Scrypt hash verification, DTO answer-key concealment, TC-06 empty quiz assertion, and 30-second timer grace window calculation) as independent use-case bubbles with `<<include>>` relationships. In standard UML, use cases represent primary **actor goals**, whereas cryptographic routines and database assertions are internal system constraints and business rules.
- **Correction Applied:**
  - Refined all primary use cases to represent genuine actor goals:
    - *Shared:* `UC-01: Authenticate (Login / Logout)`.
    - *Administrator:* `UC-02: Manage Quizzes`, `UC-03: Manage Questions`, `UC-04: Publish Quizzes`, `UC-05: View Analytics & Student Submissions`.
    - *Student:* `UC-06: View Available Quizzes`, `UC-07: Start or Resume Examination Session`, `UC-08: Answer Questions`, `UC-09: Submit Examination`, `UC-10: View Examination Results`, `UC-11: View Submission History`.
  - Relegated technical mechanisms (`crypto.scrypt`, DTO answer stripping, immutability check, TC-06 $N \ge 1$ check, 30s timer grace period, $S = \sum f(S_i, C_i)$ grading) to structured business rules and system constraints documented in the accompanying specification table.
- **Document Updated:** [`docs/oomd/use_case_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/use_case_diagram.md).

---

### Issue 4: Deployment Diagram Process Boundaries & In-Process WebAssembly (Diagram 7)
- **Discrepancy:** The initial deployment diagram ambiguous visual layout could be misinterpreted as depicting `sql.js` WebAssembly as a separate background daemon or network database server.
- **Correction Applied:**
  - Explicitly modeled the **single-process boundary** of the Express Application Server (`node src/app.js`).
  - Depicted `sql.js WebAssembly Module` and its allocated in-memory `ArrayBuffer` directly inside the Node.js process memory space, emphasizing that SQL queries execute via in-process C-ABI / TypedArray function calls with zero network overhead.
  - Formally specified the **atomic two-stage persistence protocol** from the in-process WASM engine to local host disk storage (`database.sqlite`): write buffer to temporary sibling file $\to$ POSIX `fsyncSync` dirty page flush $\to$ atomic `fs.renameSync` replacement.
- **Document Updated:** [`docs/oomd/deployment_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/deployment_diagram.md).

---

## 3. Comprehensive Summary of Updated Documentation

| Document Path | Action Taken | Primary Architectural Updates |
| :--- | :---: | :--- |
| [`docs/oomd/state_machine_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/state_machine_diagram.md) | **Updated** | Decoupled into State Machine 5A (Auth Session) and State Machine 5B (Persisted Attempt). Eliminated `GracePeriodActive` state; modeled grace period as a guarded time transition. Grounded states in SQLite `status` enum (`IN_PROGRESS`, `PASSED`, `FAILED`). |
| [`docs/oomd/use_case_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/use_case_diagram.md) | **Updated** | Refined use cases to pure actor goals. Removed synthetic use-case bubbles for internal technical routines (Scrypt, DTO stripping, TC-06 check); documented them as business constraints. |
| [`docs/oomd/deployment_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/deployment_diagram.md) | **Updated** | Clarified single-process Node.js host boundary. Embedded `sql.js` WebAssembly inside process memory heap. Specified atomic write-flush-rename persistence protocol to `database.sqlite`. |
| [`docs/oomd/oomd_verification_matrix.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/oomd_verification_matrix.md) | **Updated** | Updated verification rows 1, 5, and 7 to record actor-goal use-case refinement, two-stage state machine separation, and embedded WASM deployment boundaries. |
| [`docs/oomd/milestone_6_oomd_verification_report.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/milestone_6_oomd_verification_report.md) | **Updated** | Updated executive summary and Section 3 discrepancy logs to align with refined actor goals, separated state machines, and in-process WASM architecture. |
| [`docs/oomd/milestone_6_1_modeling_consistency_audit.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/milestone_6_1_modeling_consistency_audit.md) | **Created** | Comprehensive audit report documenting all discrepancies, applied corrections, source code references, and consistency verification. |

---

## 4. Source-Code References Used for Grounding

Every modeled element was grounded directly in the implementation source code:

1. **Attempt Status Constants:**
   - [`src/config/constants.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/config/constants.js#L25-L29):
     ```javascript
     ATTEMPT_STATUS: {
       IN_PROGRESS: 'IN_PROGRESS',
       PASSED: 'PASSED',
       FAILED: 'FAILED'
     }
     ```
2. **Database Schema Constraints:**
   - [`src/database/schema.sql`](file:///Users/soham/Github/Digital-Quiz-Portal/src/database/schema.sql#L53):
     ```sql
     status TEXT CHECK(status IN ('IN_PROGRESS', 'PASSED', 'FAILED')) DEFAULT 'IN_PROGRESS',
     is_timed_out INTEGER DEFAULT 0 CHECK(is_timed_out IN (0, 1)),
     ```
   - Partial Unique Index ([`schema.sql:97`](file:///Users/soham/Github/Digital-Quiz-Portal/src/database/schema.sql#L97)):
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS idx_active_attempt_unique ON submissions(user_id, quiz_id) WHERE status = 'IN_PROGRESS';
     ```
3. **Timer Expiration & Grace Window Guard Implementation:**
   - [`src/services/examService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/examService.js#L273-L303):
     ```javascript
     const serverNow = receiptTime !== undefined ? new Date(receiptTime) : this.clock();
     const expiresAt = new Date(attempt.expires_at);
     const graceExpiresAt = new Date(expiresAt.getTime() + GRACE_PERIOD_SECONDS * 1000);

     if (serverNow > graceExpiresAt) {
       this.submissionRepo.finalizeSubmission(attempt.id, { status: ATTEMPT_STATUS.FAILED, score: 0, isTimedOut: 1 });
       throw timeoutError; // HTTP 400
     }

     const isTimedOut = serverNow > expiresAt ? 1 : 0;
     ```
4. **Scoring & Pass/Fail Decision Function:**
   - [`src/services/scoringService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/scoringService.js#L149-L151):
     ```javascript
     const status = rawPercentage >= PASS_THRESHOLD_PERCENT
       ? ATTEMPT_STATUS.PASSED
       : ATTEMPT_STATUS.FAILED;
     ```
5. **In-Process WebAssembly & Atomic Persistence Protocol:**
   - [`src/database/db.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/database/db.js#L115-L135):
     ```javascript
     const data = this.db.export();
     const buffer = Buffer.from(data);
     const tmpPath = `${destPath}.${Date.now()}.${Math.random().toString(36).substring(2)}.tmp`;
     const fd = fs.openSync(tmpPath, 'w');
     fs.writeSync(fd, buffer, 0, buffer.length);
     fs.fsyncSync(fd);
     fs.closeSync(fd);
     fs.renameSync(tmpPath, destPath);
     ```

---

## 5. Remaining Modeling Limitations & Technical Boundaries

1. **Single-Process Monolithic Boundary:** The application executes in a single Node.js runtime process. In a distributed multi-instance deployment, the in-memory session registry (`AuthService.sessions` Map) would require external synchronization (e.g. Redis), which is omitted to preserve zero-dependency academic evaluation.
2. **WebAssembly Memory Boundary:** The database executes within an allocated 32-bit WebAssembly `ArrayBuffer` in Node.js process memory. The maximum dataset size is constrained by V8 WebAssembly heap limits.
3. **SessionStorage Token Accessibility:** Session tokens are stored in the browser's `sessionStorage` for SPA routing. While mitigated by strict `textContent` DOM construction, production enterprise systems typically employ `HttpOnly`, `SameSite=Strict` cookies.

---

## 6. Final Consistency Assessment & Certification

A thorough cross-diagram consistency check confirms:
- **Mermaid Syntax:** Validated and cleanly rendering across all documents.
- **Component & Class Naming:** Identical across Class, Sequence, Component, and Deployment diagrams.
- **Actor Roles:** Consistently defined as `Administrator` and `Student Candidate`.
- **States & Lifecycles:** Aligned across State Machine, Sequence, and Activity diagrams with exact SQLite database enum constraints.
- **Zero Unsupported Dependencies:** No Python, PyTorch, JDBC, or external database server artifacts remain in any diagram.
- **Automated Verification:** 15 test suites and 166 automated test cases pass cleanly (100% pass rate in 9.77s) without code changes.

Milestone 6.1 consistency audit is complete. Awaiting review and further instructions.

