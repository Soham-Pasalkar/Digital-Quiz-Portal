# Digital Quiz Portal (Online Exam & Assessment Portal)

[![Tests](https://img.shields.io/badge/tests-166%20passed-brightgreen.svg)](#testing--quality-assurance)
[![Coverage](https://img.shields.io/badge/statements-84.3%25-brightgreen.svg)](#testing--quality-assurance)
[![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20Express%20%7C%20sql.js%20(WASM)-blue.svg)](#technology-stack)
[![UI](https://img.shields.io/badge/frontend-Vanilla%20JS%20%7C%20HTML5%20%7C%20CSS3-orange.svg)](#technology-stack)
[![Academic](https://img.shields.io/badge/coursework-STQA%20%26%20OOMD-purple.svg)](#academic-context)

An institutional, single-page examination platform engineered for **Software Testing and Quality Assurance (STQA, LP-IV)** and **Object-Oriented Modeling and Design (OOMD)** academic curricula.

---

## Academic Context

- **Institution:** Department of Computer Engineering, Marathwada Mitra Mandal's College of Engineering (MMCOE), Pune
- **Affiliation:** Savitribai Phule Pune University (SPPU)
- **Courses:**
  - Software Testing & Quality Assurance (STQA / LP-IV)
  - Object-Oriented Modeling & Design (OOMD)
- **Project:** Digital Quiz Portal
- **Project Team:**
  - Soham Pasalkar
  - Anish Mule
  - Rohit Falke
  - Chandraprakash Pandey
- **Authoritative Specifications:**
  - [`docs/STQA_Report.pdf`](docs/STQA_Report.pdf) — Comprehensive Software Testing & QA Report
  - [`docs/OOMD_Report.pdf`](docs/OOMD_Report.pdf) — Object-Oriented Modeling & Design Analysis Report

---

## System Overview & Core Capabilities

The Digital Quiz Portal provides an end-to-end academic testing lifecycle with strict verification, security, and persistence:

1. **Role-Based Single Page Application (SPA):**
   - **Administrator Portal:** Author quizzes, manage question banks, toggle publishing status with question-count guards ($N \ge 1$), monitor per-quiz metrics, and analyze cohort pass rates.
   - **Student Portal:** Browse published quizzes, review test instructions, sit for timed examinations, review instant scorecards with question-by-question breakdowns, and view historical attempts.
2. **Zero Framework Frontend:**
   - Strict adherence to the approved STQA stack: semantic HTML5, modern CSS3, vanilla JavaScript (ES6+), and native Fetch API. Zero external CSS/JS runtime dependencies (no React, Angular, Vue, Bootstrap, or Tailwind).
   - Safe DOM construction using `document.createElement`, `textContent`, and `replaceChildren` to neutralize Cross-Site Scripting (XSS).
3. **Authoritative Server-Side Timer & Grace Period:**
   - Strict anti-cheating timer validation: remaining time is computed dynamically from the server start timestamp.
   - A 30-second network latency grace period handles legitimate transmission delays while strictly locking out late submissions with HTTP 400 (`EXAM_EXPIRED`).
4. **Relational Database & Atomic File Durability:**
   - Embedded relational database powered by `sql.js` (SQLite compiled to WebAssembly).
   - Zero native compilation toolchain required.
   - Atomic write-flush-rename (`database.sqlite.tmp` $\to$ `database.sqlite`) protects against partial writes and process crashes.
5. **Cryptographic Security & Session Registry:**
   - Asynchronous key derivation using Node.js `crypto.scrypt` with unique 16-byte random salts.
   - Cryptographically random 256-bit session tokens with 24-hour time-to-live (TTL).
   - Answer keys are stripped server-side prior to dispatching exam payloads to students.
6. **Quiz Immutability Guard:**
   - Prevents modifications to published quizzes or questions once student attempts exist, safeguarding academic scoring integrity.
7. **Premium Cream & Brown Academic Design System:**
   - Sophisticated educational SaaS aesthetic featuring warm cream (`#F3EBDD`), warm ivory (`#FFFDF8`), warm beige (`#EDE2D1`), rich walnut espresso (`#33251E`), and caramel accents (`#B88A55`).
   - Editorial serif headings paired with clean sans-serif body typography.
   - Persistent desktop dark espresso sidebar, prominent student featured assessment hero card, and real-time native SVG analytics charts (Outcomes Donut, Quiz Comparison Bars with 50% passing line, Grade Bands, and Student Score Progression).

---

## Technology Stack

| Layer | Technologies / Libraries | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, CSS3, Vanilla JavaScript (ES6+) | Institutional single-page exam interface, modal dialogs, and responsive layouts |
| **HTTP Client** | Native `window.fetch` | JSON communication with REST API using Bearer session tokens |
| **Application Server** | Node.js (v18+), Express 4.21.2 | Modular REST API routing, session middleware, input validation, and error handling |
| **Database Engine** | `sql.js` 1.12.0 (SQLite via WebAssembly) | In-memory relational query execution with disk snapshot synchronization |
| **Security & Auth** | Node.js `crypto` (`scrypt`, `randomBytes`) | Password hashing, timing-safe verification, token issuance |
| **Test Automation** | Jest 29.7.0, Supertest 7.0.0 | Unit tests, DAL tests, API integration tests, timer lifecycle suites |
| **Browser Audit** | Chrome DevTools Protocol (CDP) | Real-browser headless Chrome end-to-end user journeys |

---

## Repository Directory Structure

```text
digital-quiz-portal/
├── src/                          # Backend Application Source Code
│   ├── app.js                    # Express app initialization & middleware configuration
│   ├── server.js                 # HTTP listener & database bootstrapping entrypoint
│   ├── config/
│   │   └── constants.js          # System constants, roles, and status enums
│   ├── controllers/              # REST API Controllers (Request/Response handling)
│   │   ├── authController.js     # User login, logout, and session check
│   │   ├── quizController.js     # Admin quiz authoring & publishing
│   │   ├── attemptController.js  # Student exam start, questions, & submission
│   │   └── analyticsController.js# Admin metrics & performance summaries
│   ├── dal/                      # Data Access Layer (Repositories)
│   │   ├── userRepository.js     # User entity lookups
│   │   ├── quizRepository.js     # Quiz and question CRUD operations
│   │   └── submissionRepository.js # Attempt creation, answers, and scoring updates
│   ├── database/                 # Persistence Subsystem
│   │   ├── cryptoUtils.js        # Scrypt hashing and cryptographic token generation
│   │   ├── db.js                 # sql.js WebAssembly engine wrapper & atomic file sync
│   │   ├── schema.sql            # DDL schemas with relational & check constraints
│   │   └── seed.js               # Database seeder with sample accounts & quizzes
│   ├── middleware/
│   │   └── authMiddleware.js     # Bearer token authentication & role authorization
│   ├── routes/                   # Express REST Route Declarations
│   │   ├── authRoutes.js         # /api/auth endpoints
│   │   ├── quizRoutes.js         # /api/quizzes endpoints
│   │   ├── questionRoutes.js     # /api/quizzes/:id/questions endpoints
│   │   ├── attemptRoutes.js      # /api/attempts endpoints
│   │   └── analyticsRoutes.js    # /api/analytics endpoints
│   └── services/                 # Core Domain Business Logic
│       ├── authService.js        # Authentication & 24h session registry
│       ├── quizManagementService.js # Quiz validation, immutability & question projection
│       ├── examService.js        # Exam attempt lifecycle & timer validation
│       ├── scoringService.js     # Objective grading & threshold pass/fail computation
│       └── analyticsService.js   # Aggregate metrics, completion & score statistics
├── public/                       # Frontend Single Page Application (Static Assets)
│   ├── index.html                # Semantic SPA structure, headers, views & modals
│   ├── css/
│   │   └── styles.css            # Academic typography, color variables, & responsive grid
│   └── js/
│       ├── app.js                # Hash router (#login, #admin, #student, #exam, #results)
│       ├── api.js                # Centralized Fetch wrapper with Bearer token injection
│       ├── auth.js               # Client session state & role validation
│       ├── admin.js              # Admin dashboard, modal controllers, question editor
│       ├── student.js            # Student dashboard, quiz catalog, past attempts
│       ├── exam.js               # Active exam runner, countdown timer, question palette
│       ├── results.js            # Scorecard, pass/fail status, and question review
│       └── utils.js              # Safe DOM helpers, XSS sanitizer, timer formatting
├── tests/                        # Comprehensive Automated Verification Suite
│   ├── unit/                     # 9 Unit Test Suites (DAL, Services, Crypto, DB)
│   │   ├── authService.test.js
│   │   ├── quizManagementService.test.js
│   │   ├── examService.test.js
│   │   ├── scoringService.test.js
│   │   ├── analyticsService.test.js
│   │   ├── cryptoUtils.test.js
│   │   ├── dal.test.js
│   │   ├── db.test.js
│   │   └── seed.test.js
│   ├── integration/              # 6 Supertest Integration Suites (REST APIs & Timers)
│   │   ├── auth.api.test.js
│   │   ├── quiz.api.test.js
│   │   ├── exam.api.test.js
│   │   ├── timerLifecycle.test.js
│   │   ├── analytics.api.test.js
│   │   └── frontend.api.test.js
│   └── browser/                  # End-to-End Real Browser Automation
│       └── browser_automation.js # CDP-based automated browser audit
├── docs/                         # Academic Specifications & Verification Artifacts
│   ├── STQA_Report.pdf           # Primary STQA Academic Coursework Report
│   ├── OOMD_Report.pdf           # Primary OOMD Academic Coursework Report
│   ├── phase1_inception_and_requirements.md # Requirements & baseline specification
│   ├── milestone_4_1_frontend_verification_report.md # Frontend security & timer audit
│   ├── milestone_5_stqa_verification_report.md # STQA test execution & RTM synthesis
│   ├── milestone_5_1_consistency_audit.md # Verification of equivalence partitions
│   ├── repository_cleanup_report.md # Final cleanup audit & file classification
│   ├── ui_redesign_report.md     # UI Redesign: Premium Cream & Brown Academic Dashboard
│   ├── stqa/                     # STQA Academic Evidence Suite (8 Documents)
│   │   ├── requirement_traceability_matrix.md
│   │   ├── equivalence_partitioning.md
│   │   ├── boundary_value_analysis.md
│   │   ├── decision_table_testing.md
│   │   ├── white_box_testing.md
│   │   ├── regression_testing_report.md
│   │   ├── defect_tracking_log.md
│   │   └── performance_and_quality_evaluation.md
│   └── oomd/                     # OOMD UML Diagrams & Analysis Suite (10 Documents)
│       ├── use_case_diagram.md
│       ├── class_diagram.md
│       ├── sequence_diagram.md
│       ├── activity_diagram.md
│       ├── state_machine_diagram.md
│       ├── component_diagram.md
│       ├── deployment_diagram.md
│       ├── oomd_verification_matrix.md
│       ├── milestone_6_oomd_verification_report.md
│       └── milestone_6_1_modeling_consistency_audit.md
├── database.sqlite               # Local SQLite database file (generated via npm run seed, ignored)
├── package.json                  # Project manifest, dependencies, and execution scripts
├── package-lock.json             # Deterministic dependency lockfile
├── .gitignore                    # Git ignore file (excludes node_modules, temp files)
└── README.md                     # Project documentation & user guide
```

---

## Quick Start Guide

### Prerequisites
- **Node.js:** v18.0.0 or later (v20+ recommended)
- **npm:** v9.0.0 or later
- **Operating System:** macOS, Linux, or Windows (cross-platform pure JavaScript & WebAssembly)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/Soham-Pasalkar/Digital-Quiz-Portal.git
cd Digital-Quiz-Portal
npm install
```

### 2. Database Initialization & Seeding
Initialize or reset the SQLite database with default users and sample quizzes:
```bash
npm run seed
```
*(This creates `database.sqlite` with admin, student accounts, and sample published quizzes).*

### 3. Running the Server
Start the Express application:
```bash
npm start
```
The server will start listening on port `3000`:
```text
[Database] Loaded existing database: database.sqlite (65536 bytes)
Digital Quiz Portal server listening on http://localhost:3000
```

Open `http://localhost:3000` in any modern web browser to access the portal.

---

## Default User Accounts & Seed Data

The database comes pre-seeded with the following academic test accounts:

| Role | Username | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Full administrative control: quiz authoring, question editing, publishing, analytics |
| **Student 1** | `student1` | `student123` | Student portal: sit for exams, review instant scorecards, attempt history |
| **Student 2** | `student2` | `student123` | Secondary student account for concurrent attempt and analytics verification |

### Pre-configured Sample Quizzes
1. **Software Testing & QA Fundamentals (`ID: 1`):**
   - Duration: 15 minutes | Passing Score: 50% | Questions: 5
   - Topics: Black-box vs white-box, cyclomatic complexity, boundary value analysis, regression testing.
2. **Object-Oriented Analysis & Design (`ID: 2`):**
   - Duration: 10 minutes | Passing Score: 60% | Questions: 3
   - Topics: Inheritance vs composition, polymorphism, SOLID principles.

---

## Testing & Quality Assurance

The codebase includes an extensive automated verification suite satisfying STQA academic standards:

### Running Automated Test Suites
Execute all 15 automated test suites:
```bash
npm test
```
*Current test metrics:*
- **Total Test Suites:** 15 passed, 15 total
- **Total Automated Tests:** 166 passed, 166 total
- **Execution Time:** ~9.8 seconds

### Generating Test Coverage Report
Generate statement, branch, function, and line coverage metrics:
```bash
npm run test:coverage
```
*Academic Coverage Benchmark:*
- **Statements:** 84.3%
- **Branches:** 70.0%
- **Functions:** 95.1%
- **Lines:** 85.7%

### Running Real Browser CDP Verification
Execute automated browser test flows via Chrome DevTools Protocol:
```bash
npm run test:browser
```
*(Requires Google Chrome running with remote debugging port 9222: `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless --remote-debugging-port=9222`).*

---

## Academic Documentation & Evidence

Complete coursework documentation is provided in the [`docs/`](docs/) directory:

### 1. STQA Testing Evidence ([`docs/stqa/`](docs/stqa/))
- [Requirement Traceability Matrix](docs/stqa/requirement_traceability_matrix.md) — 100% bidirectional mapping of STQA requirements to test cases.
- [Equivalence Partitioning Analysis](docs/stqa/equivalence_partitioning.md) — 28 verified mutually exclusive input partitions across 6 domains.
- [Boundary Value Analysis](docs/stqa/boundary_value_analysis.md) — 3-point boundary analysis (min-, min, min+, nom, max-, max, max+).
- [Decision Table Testing](docs/stqa/decision_table_testing.md) — Cause-effect combinatorial tables for timer and authentication logic.
- [White-Box Basis Path Testing](docs/stqa/white_box_testing.md) — Control flow graphs, McCabe's cyclomatic complexity ($V(G)=10$).
- [Regression Test Suite](docs/stqa/regression_testing_report.md) — Suite classification, priority tiers, and execution matrices.
- [Defect Tracking Log](docs/stqa/defect_tracking_log.md) — Detailed defect reports (DEF-01 to DEF-10) with verified fixes.
- [Performance & Quality Assessment](docs/stqa/performance_and_quality_evaluation.md) — Response times, sub-second latency, security controls.

### 2. OOMD UML Architecture Models ([`docs/oomd/`](docs/oomd/))
- [Use Case Diagram](docs/oomd/use_case_diagram.md) — Formal actor goals and system boundary.
- [Class Diagram](docs/oomd/class_diagram.md) — Domain entities, repositories, services, and WASM database interface.
- [Sequence Diagram](docs/oomd/sequence_diagram.md) — Lifecycles for examination execution and quiz management.
- [Activity Diagram](docs/oomd/activity_diagram.md) — Operational workflows with 3-way server receipt timer evaluation.
- [State Machine Diagram](docs/oomd/state_machine_diagram.md) — Independent lifecycles for User Sessions and Examination Attempts.
- [Component Diagram](docs/oomd/component_diagram.md) — Logical subsystems, interfaces, and persistence abstraction.
- [Deployment Diagram](docs/oomd/deployment_diagram.md) — Physical single-process Node.js runtime and in-process WebAssembly SQLite.
- [OOMD Verification Matrix](docs/oomd/oomd_verification_matrix.md) — Traceability from academic specification to source code.

---

## License

This project is submitted as an academic coursework deliverable for Software Testing & Quality Assurance (STQA) and Object-Oriented Modeling & Design (OOMD) at MMCOE Pune. Released under the ISC License.
