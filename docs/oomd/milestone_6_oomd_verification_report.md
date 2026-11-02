# Milestone 6: OOMD UML Verification & Final Architecture Documentation Report

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Object-Oriented Modeling and Design (OOMD) & Software Testing and Quality Assurance (STQA)  
**Authoritative Sources:** OOMD Project Report (`docs/OOMD_Report.pdf`) & STQA Project Report (`docs/STQA_Report.pdf`)  
**Verification Date:** November 2, 2026  
**Auditor / Architect Role:** Senior Software Architect, OOMD Specialist & Full-Stack Engineer  
**Status:** **ALL 7 UML DIAGRAMS VERIFIED, RECONCILED & DOCUMENTED**

---

## 1. Executive Summary

Milestone 6 represents the formal Object-Oriented Modeling and Design (OOMD) verification and architectural synthesis for the **Digital Quiz Portal**.

This milestone aligns the conceptual and structural UML diagrams from the authoritative academic report (`docs/OOMD_Report.pdf`) with the actual software architecture implemented across Milestones 1 through 5.1. Every diagram has been updated using valid GitHub-compatible Mermaid code, accompanied by detailed element explanations, source traceability, and architectural reconciliation notes.

All OOMD deliverables are cataloged in [`docs/oomd/`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd):

| # | UML Diagram | Document Path | Focus & Modeled Architecture | Status |
| :-: | :--- | :--- | :--- | :---: |
| 1 | **Use Case Diagram** | [`use_case_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/use_case_diagram.md) | Actor goals (`Admin`, `Student`), `<<include>>`/`<<extend>>` validations | **VERIFIED** |
| 2 | **Class Diagram** | [`class_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/class_diagram.md) | Domain entities, services, DAL repositories, WASM database client | **VERIFIED** |
| 3 | **Sequence Diagrams** | [`sequence_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/sequence_diagram.md) | Flow 3A: Student Exam Lifecycle; Flow 3B: Admin Quiz Management | **VERIFIED** |
| 4 | **Activity Diagram** | [`activity_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/activity_diagram.md) | Operational branching, credential check, immutability, timer grace | **VERIFIED** |
| 5 | **State Machine Diagram** | [`state_machine_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/state_machine_diagram.md) | `LoggedOut` $\leftrightarrow$ `LoggedIn` $\to$ `ExamInProgress` $\to$ `Grace` $\to$ `Evaluated` | **VERIFIED** |
| 6 | **Component Diagram** | [`component_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/component_diagram.md) | Browser UI, REST router, controllers, domain services, DAL, `sql.js` | **VERIFIED** |
| 7 | **Deployment Diagram** | [`deployment_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/deployment_diagram.md) | Browser, Node.js V8 host, `sql.js` WASM engine, `database.sqlite` | **VERIFIED** |
| 8 | **Verification Matrix** | [`oomd_verification_matrix.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/oomd_verification_matrix.md) | Comprehensive report-to-code traceability and discrepancy resolution | **VERIFIED** |

---

## 2. Documents & Artifacts Inspected

The verification was conducted against the following authoritative specifications and project code:
1. **Academic Reports:**
   - `docs/OOMD_Report.pdf` (Pages 1–4, Diagrams 1 through 7, and image extracts in `docs/oomd_images/`).
   - `docs/STQA_Report.pdf` (Algorithms, test methodologies, Test Cases TC-01 to TC-06, Results Pages 4–8).
2. **Architectural Baselines:**
   - [`docs/phase1_inception_and_requirements.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/phase1_inception_and_requirements.md) (Approved architectural decisions, FR/NFR catalogs).
   - [`docs/stqa/requirement_traceability_matrix.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/requirement_traceability_matrix.md) (Reconciled 28-requirement matrix).
3. **Application Source Code & Test Harness:**
   - Domain Services: [`src/services/`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/) (`AuthService`, `QuizManagementService`, `ExamService`, `ScoringService`, `AnalyticsService`).
   - Data Access Layer: [`src/dal/`](file:///Users/soham/Github/Digital-Quiz-Portal/src/dal/) (`UserRepository`, `QuizRepository`, `SubmissionRepository`).
   - Database Subsystem: [`src/database/db.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/database/db.js), [`cryptoUtils.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/database/cryptoUtils.js), `database.sqlite`.
   - REST Controllers & Middleware: [`src/controllers/`](file:///Users/soham/Github/Digital-Quiz-Portal/src/controllers/), [`src/routes/`](file:///Users/soham/Github/Digital-Quiz-Portal/src/routes/), [`src/middleware/authMiddleware.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/middleware/authMiddleware.js).
   - Client Frontend: [`public/index.html`](file:///Users/soham/Github/Digital-Quiz-Portal/public/index.html), [`public/css/styles.css`](file:///Users/soham/Github/Digital-Quiz-Portal/public/css/styles.css), [`public/js/`](file:///Users/soham/Github/Digital-Quiz-Portal/public/js/).

---

## 3. Discrepancies Found & Corrected Across the 7 Diagrams

### 3.1 Diagram 1: Use Case Diagram
- **Discrepancies in Report:** Primary use cases conflated actor goals with internal technical routines; "Take Quiz" was treated as a monolithic operation.
- **Applied Corrections:**
  - Refined primary use cases to focus strictly on actor goals: `Authenticate`, `View Available Quizzes`, `Start or Resume Examination`, `Answer Questions`, `Submit Examination`, `View Results`, `View Submission History`, `Manage Quizzes`, `Manage Questions`, `Publish Quizzes`, `View Analytics & Student Submissions`.
  - Documented technical routines (Scrypt hashing, DTO key concealment, TC-06 empty quiz check, 30s timer grace period, deterministic grading) as business rules and use-case constraints rather than synthetic use-case bubbles.

### 3.2 Diagram 2: Class Diagram
- **Discrepancies in Report:** Conceptual entities were modeled without Data Access Layer repositories; database interactions were implied as direct or JDBC-bound; single-table inheritance for `User` was unspecified.
- **Applied Corrections:**
  - Modeled the concrete DAL layer: `UserRepository`, `QuizRepository`, `SubmissionRepository`, and `DatabaseClient`.
  - Documented `User` specialization into `Admin` and `Student` via the `role` discriminator column.
  - Formally distinguished composition (e.g. `Quiz` *-- `Question`, `Submission` *-- `SubmissionAnswer`) from associations and service dependencies.

### 3.3 Diagram 3: Sequence Diagrams
- **Discrepancies in Report:** A single sequence diagram showed a generic student interaction, omitting the administrator's quiz curating and reporting workflows, answer-key concealment, and timer expiry handling.
- **Applied Corrections:**
  - Developed two distinct sequence diagrams: **3A (Student Exam Lifecycle)** and **3B (Administrator Quiz Management)**.
  - Modeled the complete security pipeline: Scrypt token generation, answer-key stripping, server clock evaluation (`serverNow = clock()`), 30s grace period marking, deterministic scoring, atomic `fsyncSync` persistence, and the quiz immutability check.

### 3.4 Diagram 4: Activity Diagram
- **Discrepancies in Report:** Omitted decision diamonds for quiz immutability, TC-06 empty quiz publishing rejection, and timer expiration boundaries.
- **Applied Corrections:**
  - Incorporated decision diamonds for credential validation, role checking, immutability assertions, question count check ($N \ge 1$), and three-way timer receipt evaluation ($T_{\text{receipt}} \le T_{\text{expiry}}$, grace window, post-grace rejection).

### 3.5 Diagram 5: State Machine Diagram
- **Discrepancies in Report:** Conflated session authentication and examination attempt lifecycles into a single state machine; invented non-persisted states; treated grace period as an independent state rather than a time condition.
- **Applied Corrections:**
  - Separated into two distinct, independent state machines: **5A (Authentication Session Lifecycle: LoggedOut, Authenticating, LoggedIn)** and **5B (Persisted Attempt Lifecycle: IN_PROGRESS, PASSED, FAILED)**.
  - Eliminated artificial `GracePeriodActive` state, modeling the 30s grace window strictly as a guarded time condition on submission transitions.
  - Modeled post-grace expiration finalization to `FAILED` (HTTP 400) and idempotent self-loop on terminal states (`PASSED`/`FAILED`).

### 3.6 Diagram 6: Component Diagram
- **Discrepancies in Report:** Suggested external machine learning and JDBC components, while omitting modular client controllers.
- **Applied Corrections:**
  - Modeled actual architectural tiers: Client Browser SPA, Express REST Router & Middleware, Controllers, Business Domain Services, DAL Repositories, `sql.js` WebAssembly Engine, and `database.sqlite`.
  - Eliminated all machine learning and JDBC artifacts.

### 3.7 Diagram 7: Deployment Diagram
- **Discrepancies in Report:** Depicted an external Python/PyTorch `ML Server`, `JDBC Protocol`, and a multi-server distributed cluster.
- **Applied Corrections:**
  - **Eliminated ML Server:** Replaced with deterministic SQL aggregations in `AnalyticsService`.
  - **Eliminated JDBC Protocol:** Replaced with in-process `sql.js` WebAssembly engine calls.
  - **Consolidated into Unified Single-Process Deployment:** Modeled the Node.js V8 host process communicating with client browsers over HTTP/1.1 (port 3000) and writing to local `database.sqlite` via POSIX `fsyncSync`.

---

## 4. Actual Architecture Represented

The finalized OOMD diagrams faithfully represent the approved, implemented Digital Quiz Portal architecture:
- **Frontend Tier:** Semantic HTML5 views (`#auth-view`, `#admin-view`, `#student-view`, `#exam-view`, `#results-view`), CSS3 stylesheet with academic ivory/charcoal/forest green palette (`#F7F6F2`, `#242621`, `#345647`), and modular Vanilla JavaScript controllers using native `window.fetch`. Zero frontend frameworks.
- **Backend Tier:** Node.js v25.x and Express.js REST application monolith. Modular router, authentication middleware enforcing role-based access, and isolated controllers.
- **Business Domain Services:**
  - `AuthService`: Scrypt password hashing (16,384 iterations), constant-time verification, 24-hour TTL session registry.
  - `QuizManagementService`: Quiz authoring, question CRUD, TC-06 empty quiz check, and immutability lock.
  - `ExamService`: Attempt lifecycle, server clock timer evaluation, 30s grace window, answer-key concealment, and idempotency.
  - `ScoringService`: Deterministic indicator function $f(S_i, C_i)$, unrounded percentage pass evaluation ($P \ge 50.0\%$), and audit feedback generation.
  - `AnalyticsService`: Deterministic SQL aggregation engine delivering cohort statistics and student submissions tables.
- **Data Access & Persistence:** DAL repositories (`UserRepository`, `QuizRepository`, `SubmissionRepository`) executing parameterized SQL queries on `sql.js` (WebAssembly SQLite), persisting state atomically to `database.sqlite` via `fsyncSync`.

---

## 5. Remaining Modeling Limitations & Technical Boundaries

In accordance with academic engineering standards, the following architectural boundaries are acknowledged:
1. **Single-Process Scaling Ceiling:** All services, routing, cryptographic hashing, and the WebAssembly database engine execute inside a single Node.js process. In high-concurrency enterprise settings, horizontal scaling would require external session stores (Redis) and sticky session load balancing.
2. **WebAssembly Memory Ceiling:** The SQLite database resides inside an allocated in-memory WASM `ArrayBuffer`. Large multi-gigabyte datasets cannot fit inside 32-bit WebAssembly heap allocations.
3. **Synchronous Write Amplification:** Every mutating transaction exports the entire in-memory database to disk via `db.save()` using POSIX `fsyncSync`. While ensuring crash resilience for classroom use, it imposes I/O overhead on high-frequency write workloads.
4. **Client Session Storage Exposure:** Session tokens are stored in `sessionStorage` for SPA routing. While mitigated by strict `textContent` and `replaceChildren` DOM rendering, an enterprise implementation would prefer `HttpOnly`, `SameSite=Strict` cookies.

---

## 6. Deliverables Index

All Milestone 6 documentation deliverables have been created and committed under [`docs/oomd/`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd):

1. [`docs/oomd/use_case_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/use_case_diagram.md) — Verified Use Case Diagram & Actor Specifications
2. [`docs/oomd/class_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/class_diagram.md) — Verified Class Diagram, DAL Repositories & Domain Services
3. [`docs/oomd/sequence_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/sequence_diagram.md) — Verified Sequence Diagrams (3A: Student Exam Flow, 3B: Admin Quiz Management)
4. [`docs/oomd/activity_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/activity_diagram.md) — Verified Activity Diagram & Decision Workflows
5. [`docs/oomd/state_machine_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/state_machine_diagram.md) — Verified State Machine Diagram & Exam Lifecycle
6. [`docs/oomd/component_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/component_diagram.md) — Verified Component Diagram & Software Tiers
7. [`docs/oomd/deployment_diagram.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/deployment_diagram.md) — Verified Deployment Diagram & Physical Execution Nodes
8. [`docs/oomd/oomd_verification_matrix.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/oomd_verification_matrix.md) — Full Traceability & Discrepancy Verification Matrix
9. [`docs/oomd/milestone_6_oomd_verification_report.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/oomd/milestone_6_oomd_verification_report.md) — Authoritative Milestone 6 Completion Report *(This document)*

---

## 7. Verification Certification

All seven UML diagrams have been generated in valid Mermaid syntax, thoroughly checked against the implementation source code, reconciled with the authoritative academic specifications, and verified to contain zero obsolete ML or JDBC artifacts.

Milestone 6 is complete. No application code has been modified. Awaiting final review.

