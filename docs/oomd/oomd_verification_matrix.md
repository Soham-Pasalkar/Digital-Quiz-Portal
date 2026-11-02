# OOMD UML Diagrams Verification Matrix

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Object-Oriented Modeling and Design (OOMD)  
**Authoritative Source:** OOMD Project Report (`docs/OOMD_Report.pdf`, Pages 1–4, Diagrams 1 through 7)  
**Implementation Source:** Application Codebase (`src/`, `public/`, `tests/`)  
**Verification Date:** November 2, 2026  
**Final Status:** **ALL 7 UML DIAGRAMS VERIFIED & RECONCILED WITH IMPLEMENTATION**

---

## 1. Overview & Verification Methodology

This Verification Matrix establishes formal traceability between the seven original UML diagrams in the authoritative OOMD Project Report and the actual software architecture of the implemented Digital Quiz Portal.

Each diagram was evaluated under a two-stage verification protocol:
1. **Report Fidelity Assessment:** Verifying that all core academic requirements, actors, operational flows, and entities from the OOMD and STQA reports are preserved.
2. **Implementation Truth Alignment:** Reconciling conceptual or legacy diagram elements (such as monolithic operations, external ML servers, and JDBC connections) with the approved, implemented technology stack (Node.js, Express, `sql.js` WebAssembly, vanilla JS SPA).

---

## 2. Comprehensive OOMD Verification Matrix

| # | Diagram Title | Authoritative OOMD Report Source | Implemented Modules & APIs | Identified Discrepancies | Applied Corrections & Architectural Reconciliations | Verification Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | **Use Case Diagram** | Report Page 1, Diagram 1: Actors (`Admin`, `Student`), Use Cases (`Login`, `Manage Quizzes`, `Take Quiz`, `View Analytics`) | `authController.js`, `quizController.js`, `attemptController.js`, `analyticsController.js` | 1. Use cases combined actor goals with internal technical routines.<br>2. "Take Quiz" was treated as monolithic without separating attempt registration from answering questions. | 1. Refined all primary use cases to represent genuine actor goals (Authenticate, View Catalog, Start/Resume Exam, Answer Questions, Submit, View Results/History, Manage Quizzes, Manage Questions, Publish, View Analytics).<br>2. Documented Scrypt verification, answer-key concealment, TC-06 empty quiz check, and grace period rules as internal constraints and business logic rather than synthetic use cases. | **VERIFIED** |
| **2** | **Class Diagram** | Report Page 1, Diagram 2: Conceptual classes `User`, `Admin`, `Student`, `Quiz`, `Question`, `Submission`, `AuthService`, `ScoringService` | `src/dal/*Repository.js`, `src/services/*Service.js`, `src/database/db.js` | 1. Relational tables were represented without explicit Data Access Layer repositories.<br>2. Single-table inheritance for `User` was unstated. | 1. Modeled DAL Repositories (`UserRepository`, `QuizRepository`, `SubmissionRepository`) and `DatabaseClient`.<br>2. Documented `role` discriminator for `Admin` and `Student` specializations.<br>3. Mapped dependencies from services to repositories and database client. | **VERIFIED** |
| **3** | **Sequence Diagram** | Report Page 2, Diagram 3: Chronological message sequence for quiz taking | `authRoutes.js`, `quizRoutes.js`, `attemptRoutes.js`, `examService.js`, `scoringService.js` | 1. Single sequence diagram only showed a generic examination flow.<br>2. Admin quiz authoring and immutability checking flows were omitted.<br>3. Answer-key concealment was not modeled. | 1. Created two distinct sequence diagrams: **3A (Student Exam Flow)** and **3B (Admin Quiz Management Flow)**.<br>2. Explicitly modeled server clock authority, answer-key stripping, timer grace window, deterministic grading, and atomic disk persistence. | **VERIFIED** |
| **4** | **Activity Diagram** | Report Page 3, Diagram 4: Operational workflows with decision branching | `public/js/*.js`, `src/services/*.js`, `src/controllers/*.js` | 1. Timer expiration and grace window branches were missing.<br>2. Immutability lock decision and TC-06 empty quiz check were unmodeled. | 1. Incorporated decision diamonds for credential verification, role-based routing, immutability check, $N \ge 1$ publish validation, and timer receipt intervals ($T_{\text{receipt}} \le T_{\text{expiry}}$, grace window, post-grace). | **VERIFIED** |
| **5** | **State Machine Diagram** | Report Page 3, Diagram 5: User and examination lifecycle states | `src/config/constants.js`, `src/services/examService.js`, `public/js/exam.js` | 1. Combined user authentication and exam attempt states into a single lifecycle.<br>2. Evaluated state was generic.<br>3. Grace period was conflated as a state instead of a transition guard. | 1. Separated into two independent state machines: **5A (Authentication Session Lifecycle: LoggedOut, Authenticating, LoggedIn)** and **5B (Persisted Attempt Lifecycle: IN_PROGRESS, PASSED, FAILED)**.<br>2. Eliminated artificial `GracePeriodActive` state, modeling the 30s grace window strictly as a guarded time condition.<br>3. Modeled post-grace expiration finalization to `FAILED` (HTTP 400) and idempotent self-loop on terminal states. | **VERIFIED** |
| **6** | **Component Diagram** | Report Page 3, Diagram 6: System components, UI, services, database | `public/`, `src/routes/`, `src/controllers/`, `src/services/`, `src/dal/`, `src/database/` | 1. The original diagram suggested external machine learning and JDBC components.<br>2. Client-side SPA controllers were unmodeled. | 1. Modeled actual tiers: Client Browser SPA, Express REST Router & Middleware, Controllers, Business Domain Services, DAL Repositories, `sql.js` WebAssembly Engine, and `database.sqlite` persistence.<br>2. Eliminated ML and JDBC references. | **VERIFIED** |
| **7** | **Deployment Diagram** | Report Page 4, Diagram 7: Multi-tier deployment with external ML Server & JDBC | `src/app.js`, `src/database/db.js`, `database.sqlite`, `public/` | 1. Depicted an external Python/PyTorch `ML Server`.<br>2. Depicted `JDBC` protocol.<br>3. Depicted multi-server distributed cluster.<br>4. WebAssembly SQLite was ambiguous regarding process boundaries. | 1. **Eliminated ML Server**; replaced with deterministic SQL aggregations in `AnalyticsService`.<br>2. **Eliminated JDBC**; replaced with in-process `sql.js` WebAssembly engine.<br>3. Modeled single-process Node.js host server with `sql.js` executing strictly inside process memory.<br>4. Represented atomic two-stage persistence protocol writing to local `database.sqlite` via `fsyncSync`. | **VERIFIED** |

---

## 3. Key Architectural Alignments Confirmed

1. **Technology Stack Purity:** All seven diagrams reflect the approved, implemented technology stack: HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and `sql.js` WebAssembly SQLite.
2. **Deterministic Domain Logic:** Scoring algorithms ($S = \sum f(S_i, C_i)$), percentage calculations ($P = (S / N) \times 100$), and 50% pass thresholding are faithfully represented in Class, Sequence, Activity, and State Machine diagrams.
3. **Security & Integrity Controls:** Answer-key concealment during active attempts, server-authoritative timer validation, 30-second submission grace window, quiz immutability locks, and Scrypt password verification are embedded across behavioral and structural models.
4. **Zero Obsolete Dependencies:** No machine-learning runtimes, Python daemons, PyTorch scripts, JDBC drivers, or external database servers remain in any diagram.

