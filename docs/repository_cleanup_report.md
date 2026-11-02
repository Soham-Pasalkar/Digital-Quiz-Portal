# Digital Quiz Portal: Repository Cleanup Report

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Context:** Software Testing & Quality Assurance (STQA, LP-IV) & Object-Oriented Modeling & Design (OOMD)  
**Institution:** Department of Computer Engineering, Marathwada Mitra Mandal's College of Engineering (MMCOE), Pune  
**Date:** November 2, 2026  
**Auditor / Engineer:** Software Quality Assurance Engineer & System Architect  

---

## 1. Executive Summary & Cleanup Mandate

Following the successful implementation, testing, security audits, and formal UML modeling phases of the **Digital Quiz Portal**, this final repository cleanup was executed to transition the codebase from development state to a pristine, submission-ready academic repository.

### Primary Objectives Achieved:
1. **Preserved Working System:** Retained 100% of functional backend application code (`src/`), vanilla frontend assets (`public/`), automated test suites (`tests/`), database schemas, and pre-seeded SQLite database.
2. **Preserved Complete Academic Documentation:** Retained all authoritative academic reports, STQA verification artifacts (`docs/stqa/`), and OOMD UML architecture models (`docs/oomd/`).
3. **Eliminated Intermediate Clutter:** Purged 43 redundant extracted image files, obsolete PDF text dumps, and ephemeral test coverage directories.
4. **Verified Post-Cleanup System Integrity:** Confirmed all 15 automated test suites (166 tests) pass, executed a 7-step end-to-end smoke verification, and validated zero application regressions.

---

## 2. Inventory of Retained Files & Directories

### 2.1. Backend Application Code (`src/`) — 17 Files Retained
- **Core Server & Bootstrap:**
  - `src/server.js` — HTTP listener and database bootstrapping entrypoint.
  - `src/app.js` — Express application factory, middleware pipeline, and route configuration.
- **Configuration & Constants:**
  - `src/config/constants.js` — System status enums, user roles, token TTLs, and grace period constants.
- **REST API Controllers:**
  - `src/controllers/authController.js` — User authentication, session issuance, and logout.
  - `src/controllers/quizController.js` — Quiz authoring, question management, publishing lifecycle.
  - `src/controllers/attemptController.js` — Attempt creation, question projection, submission grading.
  - `src/controllers/analyticsController.js` — Overview metrics, quiz summaries, student submissions.
- **Data Access Layer (DAL):**
  - `src/dal/userRepository.js` — User entity CRUD and username lookup.
  - `src/dal/quizRepository.js` — Quiz entity, question authoring, and published catalog filtering.
  - `src/dal/submissionRepository.js` — Attempt lifecycle, answer recording, and scoring updates.
- **Database Subsystem & Security:**
  - `src/database/schema.sql` — Relational schema DDL with check and uniqueness constraints.
  - `src/database/seed.js` — Deterministic seeder for admin, students, and sample quizzes.
  - `src/database/db.js` — `sql.js` (WebAssembly SQLite) wrapper with atomic write-flush-rename.
  - `src/database/cryptoUtils.js` — Asynchronous `scrypt` hashing and 256-bit token generator.
- **Middleware:**
  - `src/middleware/authMiddleware.js` — Bearer token authentication and role-based route guards.
- **Express Routes:**
  - `src/routes/authRoutes.js` (`/api/auth`)
  - `src/routes/quizRoutes.js` (`/api/quizzes`)
  - `src/routes/questionRoutes.js` (`/api/questions`)
  - `src/routes/attemptRoutes.js` (`/api/attempts`)
  - `src/routes/analyticsRoutes.js` (`/api/admin/analytics`)
- **Domain Business Services:**
  - `src/services/authService.js` — Session registry with 24-hour TTL and timing-safe authentication.
  - `src/services/quizManagementService.js` — Quiz validation, immutability guards, and question projection.
  - `src/services/examService.js` — Attempt lifecycle, server timer validation, and 30s grace handling.
  - `src/services/scoringService.js` — Objective grading, option normalization, and unrounded threshold logic.
  - `src/services/analyticsService.js` — Cohort score aggregations, completion rates, and audit tables.

### 2.2. Frontend Single Page Application (`public/`) — 10 Files Retained
- `public/index.html` — Accessible SPA markup with semantic views (`#login`, `#admin`, `#student`, `#exam`, `#results`) and dialog modals.
- `public/css/styles.css` — Institutional academic stylesheet with warm ivory background, forest green actions, responsive grid, and accessible focus states.
- `public/js/utils.js` — DOM manipulation helpers, safe text injection, XSS prevention, and countdown formatting.
- `public/js/api.js` — Centralized Fetch wrapper with automated Bearer authorization header injection.
- `public/js/auth.js` — Client session state management, `sessionStorage` token caching, and role helpers.
- `public/js/admin.js` — Administrator dashboard, quiz authoring modal, question manager, and analytics rendering.
- `public/js/student.js` — Student dashboard, published quiz catalog, and past submission history table.
- `public/js/exam.js` — Single-question exam runner, countdown timer, question palette navigation, and submit dialog.
- `public/js/results.js` — Final exam scorecard, pass/fail badge, score percentage, and question review audit.
- `public/js/app.js` — Client-side hash routing and authentication guard orchestration.

### 2.3. Automated Test Suites (`tests/`) — 16 Files Retained
- **Unit Test Suites (`tests/unit/`):**
  - `tests/unit/authService.test.js` (Authentication, token issuance, TTL expiration)
  - `tests/unit/quizManagementService.test.js` (Validation, $N \ge 1$ publishing guard, immutability)
  - `tests/unit/examService.test.js` (Attempt lifecycle, timer checks, grace period evaluation)
  - `tests/unit/scoringService.test.js` (BVA formulations, threshold rounding checks)
  - `tests/unit/analyticsService.test.js` (Aggregation maths, divide-by-zero resilience)
  - `tests/unit/cryptoUtils.test.js` (Scrypt key derivation, salt generation, token uniqueness)
  - `tests/unit/dal.test.js` (Relational constraints, partial indices, answer bounds)
  - `tests/unit/db.test.js` (WASM query execution, transaction rollback, atomic file durability)
  - `tests/unit/seed.test.js` (Seeder execution and deterministic accounts verification)
- **Integration Test Suites (`tests/integration/`):**
  - `tests/integration/auth.api.test.js` (Login, logout, session check HTTP endpoints)
  - `tests/integration/quiz.api.test.js` (Quiz authoring, question CRUD, catalog routing)
  - `tests/integration/exam.api.test.js` (Attempt creation, question delivery, on-time and grace submit)
  - `tests/integration/timerLifecycle.test.js` (10 Timer lifecycle, refresh, and grace period scenarios)
  - `tests/integration/analytics.api.test.js` (Admin analytics endpoints and access controls)
  - `tests/integration/frontend.test.js` (Static asset delivery, MIME types, SPA fallbacks)
- **Browser Automation Suite (`tests/browser/`):**
  - `tests/browser/browser_automation.js` (CDP-based headless Chrome user journeys)

### 2.4. STQA Academic Testing Evidence (`docs/stqa/`) — 8 Documents Retained
1. `docs/stqa/requirement_traceability_matrix.md` — 100% bidirectional RTM mapping STQA requirements to test cases.
2. `docs/stqa/equivalence_partitioning.md` — 28 mutually exclusive input classes across 6 functional domains.
3. `docs/stqa/boundary_value_analysis.md` — 3-point boundary analysis (min-, min, min+, nom, max-, max, max+).
4. `docs/stqa/decision_table_testing.md` — Cause-effect decision tables for timer evaluation and access control.
5. `docs/stqa/white_box_testing.md` — Control flow graphs, basis paths, and McCabe cyclomatic complexity ($V(G)=10$).
6. `docs/stqa/regression_testing_report.md` — Regression test categorization, priority tiers, and execution matrices.
7. `docs/stqa/defect_tracking_log.md` — IEEE 829 defect tracking log (DEF-01 through DEF-10) with verified resolutions.
8. `docs/stqa/performance_and_quality_evaluation.md` — Sub-second latency, security controls, and browser compatibility.

### 2.5. OOMD Academic UML Models & Analysis (`docs/oomd/`) — 10 Documents Retained
1. `docs/oomd/use_case_diagram.md` — Diagram 1: Formal use cases, actor goals (`Admin`, `Student`), and system boundary.
2. `docs/oomd/class_diagram.md` — Diagram 2: Domain entities, repositories, services, and WASM database client.
3. `docs/oomd/sequence_diagram.md` — Diagram 3: Flows 3A (Student Exam Lifecycle) and 3B (Admin Quiz Management).
4. `docs/oomd/activity_diagram.md` — Diagram 4: Operational workflows with 3-way server receipt timer evaluation.
5. `docs/oomd/state_machine_diagram.md` — Diagram 5: Decoupled lifecycles (5A: Session Auth, 5B: Exam Attempt).
6. `docs/oomd/component_diagram.md` — Diagram 6: Tiered subsystems, REST controllers, DAL, and WASM database engine.
7. `docs/oomd/deployment_diagram.md` — Diagram 7: Physical single-process Node.js runtime and SQLite persistence.
8. `docs/oomd/oomd_verification_matrix.md` — Traceability from OOMD specification pages 1–4 to code.
9. `docs/oomd/milestone_6_oomd_verification_report.md` — Authoritative Milestone 6 synthesis.
10. `docs/oomd/milestone_6_1_modeling_consistency_audit.md` — Modeling consistency audit report.

### 2.6. Essential Configuration, Manifests & Persistence
- `package.json` — Manifest with project dependencies, Jest test runners, and coverage scripts.
- `package-lock.json` — Deterministic dependency tree lockfile.
- `.gitignore` — Standard git exclusions (`node_modules/`, `coverage/`, temporary database files).
- `README.md` — Comprehensive project overview, installation, testing, credentials, and architecture guide.
- `database.sqlite` — Seeded binary SQLite database with sample quizzes and accounts.

---

## 3. Inventory of Deleted Files & Directories

The following files and directories were identified as development clutter, intermediate dumps, or redundant artifacts and were safely purged:

| Path Deleted | Type | Size / Items | Justification for Deletion |
| :--- | :--- | :--- | :--- |
| `coverage/` | Directory | 6 files (~280 KB) | Ephemeral Jest code coverage build directory. Generated dynamically via `npm run test:coverage`. Excluded via `.gitignore`. |
| `docs/oomd_images/` | Directory | 7 PNG files (~3.4 MB) | Raw PDF page raster image dumps extracted via `pdfimages` during Phase 1 onboarding. Fully superseded by verified, semantic Mermaid diagrams in `docs/oomd/`. |
| `docs/stqa_images/` | Directory | 36 image files (~2.1 MB) | Raw image extracts from `STQA_Report.pdf` generated during initial document inspection. Superseded by formal markdown documents in `docs/stqa/`. |
| `docs/OOMD_Report_text.txt` | File | 463 bytes | Crude initial text dump from `pdftotext`. Superseded by `docs/OOMD_Report.pdf` and `docs/phase1_inception_and_requirements.md`. |
| `docs/STQA_Report_text.txt` | File | ~10 KB | Crude initial text dump from `pdftotext`. Superseded by `docs/STQA_Report.pdf` and formal STQA testing suite. |

---

## 4. Deliberately Preserved Files (Classification & Justification)

In strict accordance with the preservation rules, several files with names that might resemble intermediate reports were individually inspected and deliberately preserved:

1. **`docs/STQA_Report.pdf` & `docs/OOMD_Report.pdf` (Preserved):**
   - *Reason:* These are the primary, authoritative academic course project reports issued for STQA and OOMD. They represent the foundational requirements baseline against which all verification was evaluated.
2. **`docs/phase1_inception_and_requirements.md` (Preserved):**
   - *Reason:* Contains the formal architecture decision log, technology trade-off evaluations (e.g., `sql.js` WASM vs `better-sqlite3`, Vanilla JS vs React), and inception scope baseline.
3. **`docs/milestone_4_1_frontend_verification_report.md` (Preserved):**
   - *Reason:* Documents the frontend security audit (zero frameworks, safe DOM XSS audit, and real-browser headless Chrome testing), providing complete milestone progression evidence alongside Milestone 5 and 6 reports.
4. **`docs/milestone_5_stqa_verification_report.md` & `docs/milestone_5_1_consistency_audit.md` (Preserved):**
   - *Reason:* Formally mandated milestone reports certifying the STQA test suite execution, RTM synthesis, and the mathematical consistency of equivalence classes.
5. **`database.sqlite` (Preserved):**
   - *Reason:* Provides an out-of-the-box working database with pre-configured quizzes and user accounts for immediate evaluation, testing, and demonstrations without requiring a fresh seed step.

---

## 5. Final Verified Repository Structure

```text
Digital-Quiz-Portal/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   └── constants.js
│   ├── controllers/
│   │   ├── analyticsController.js
│   │   ├── attemptController.js
│   │   ├── authController.js
│   │   └── quizController.js
│   ├── dal/
│   │   ├── quizRepository.js
│   │   ├── submissionRepository.js
│   │   └── userRepository.js
│   ├── database/
│   │   ├── cryptoUtils.js
│   │   ├── db.js
│   │   ├── schema.sql
│   │   └── seed.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── routes/
│   │   ├── analyticsRoutes.js
│   │   ├── attemptRoutes.js
│   │   ├── authRoutes.js
│   │   ├── questionRoutes.js
│   │   └── quizRoutes.js
│   └── services/
│       ├── analyticsService.js
│       ├── authService.js
│       ├── examService.js
│       ├── quizManagementService.js
│       └── scoringService.js
├── public/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── admin.js
│       ├── api.js
│       ├── app.js
│       ├── auth.js
│       ├── exam.js
│       ├── results.js
│       ├── student.js
│       └── utils.js
├── tests/
│   ├── unit/
│   │   ├── analyticsService.test.js
│   │   ├── authService.test.js
│   │   ├── cryptoUtils.test.js
│   │   ├── dal.test.js
│   │   ├── db.test.js
│   │   ├── examService.test.js
│   │   ├── quizManagementService.test.js
│   │   ├── scoringService.test.js
│   │   └── seed.test.js
│   ├── integration/
│   │   ├── analytics.api.test.js
│   │   ├── auth.api.test.js
│   │   ├── exam.api.test.js
│   │   ├── frontend.test.js
│   │   ├── quiz.api.test.js
│   │   └── timerLifecycle.test.js
│   └── browser/
│       └── browser_automation.js
├── docs/
│   ├── OOMD_Report.pdf
│   ├── STQA_Report.pdf
│   ├── phase1_inception_and_requirements.md
│   ├── milestone_4_1_frontend_verification_report.md
│   ├── milestone_5_stqa_verification_report.md
│   ├── milestone_5_1_consistency_audit.md
│   ├── repository_cleanup_report.md
│   ├── oomd/
│   │   ├── activity_diagram.md
│   │   ├── class_diagram.md
│   │   ├── component_diagram.md
│   │   ├── deployment_diagram.md
│   │   ├── milestone_6_1_modeling_consistency_audit.md
│   │   ├── milestone_6_oomd_verification_report.md
│   │   ├── oomd_verification_matrix.md
│   │   ├── sequence_diagram.md
│   │   ├── state_machine_diagram.md
│   │   └── use_case_diagram.md
│   └── stqa/
│       ├── boundary_value_analysis.md
│       ├── decision_table_testing.md
│       ├── defect_tracking_log.md
│       ├── equivalence_partitioning.md
│       ├── performance_and_quality_evaluation.md
│       ├── regression_testing_report.md
│       ├── requirement_traceability_matrix.md
│       └── white_box_testing.md
├── database.sqlite
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

---

## 6. Post-Cleanup Verification Evidence

### 6.1. Automated Jest Test Suite Execution
The complete test suite was executed post-cleanup:
```bash
npm test
```
**Results:**
- **Test Suites:** 15 passed, 15 total
- **Tests:** 166 passed, 166 total
- **Snapshots:** 0 total
- **Execution Time:** 9.591 seconds
- **Exit Code:** 0 (Clean exit)

### 6.2. Code Coverage Audit
Code coverage verification was executed post-cleanup (`npm run test:coverage`):
- **Statements:** 84.28%
- **Branches:** 70.04%
- **Functions:** 95.13%
- **Lines:** 85.74%
*(All application services and core database logic exceed academic thresholds).*

### 6.3. Comprehensive End-to-End Application Smoke Verification
A 7-point live integration smoke test was conducted against the running application instance and database:

```text
--- DIGITAL QUIZ PORTAL POST-CLEANUP SMOKE TEST ---
✔ 1. Application initialized & database bootstrapped cleanly
✔ 2. HTTP Server listening on dynamic port
✔ 3. Administrator login verified: admin (256-bit token issued)
✔ 4. Student login verified: student1 (256-bit token issued)
✔ 5. Quiz creation, question authoring & publishing verified (Quiz ID: 3)
✔ 6. Exam attempt, question loading & submission verified (Status: PASSED, Score: 100%)
✔ 7. Results lookup and Admin Analytics overview verified
===============================================================
ALL 7 POST-CLEANUP VERIFICATION CHECKS PASSED SUCCESSFULLY!
===============================================================
```

---

## 7. Clutter Assessment & Final Verdict

- **Temporary Artifacts Remaining:** **0**
- **Unused Dumps / Drafts Remaining:** **0**
- **Framework Inclusions:** **0** (Pure semantic HTML5/CSS3/Vanilla JS)
- **Application Regressions:** **0**
- **Academic Compliance:** **100%** (STQA & OOMD requirements fully satisfied and verified)

**Final Verdict:** The Digital Quiz Portal repository is clean, complete, fully tested, and ready for institutional academic submission.

