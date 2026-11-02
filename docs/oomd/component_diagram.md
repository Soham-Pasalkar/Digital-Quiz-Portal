# OOMD Diagram 6: Component Diagram

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Object-Oriented Modeling and Design (OOMD)  
**Authoritative Source:** OOMD Project Report (`docs/OOMD_Report.pdf`, Page 3, Diagram 6)  
**Implementation Source:** Application Source Structure (`src/`, `public/`)  
**Status:** **VERIFIED & RECONCILED WITH IMPLEMENTATION**

---

## 1. Diagram Purpose

The Component Diagram models the physical and logical software components of the Digital Quiz Portal, their provided and required interfaces, and the data dependencies connecting the client frontend, REST API routing, business domain services, data access repositories, and the WebAssembly SQLite database engine.

---

## 2. Mermaid UML Diagram

```mermaid
flowchart TD
    %% =========================================================================
    %% CLIENT TIER
    %% =========================================================================
    subgraph Client_Tier ["<<subsystem>> Client Browser Tier (Vanilla JS SPA)"]
        UI_Views["[Component] View Containers\n(HTML5 #auth-view, #admin-view, #student-view, #exam-view, #results-view)"]
        UI_Controllers["[Component] Client Controllers\n(app.js, auth.js, admin.js, student.js, exam.js, results.js)"]
        UI_API["[Component] API Client Wrapper\n(api.js via Fetch API)"]
        UI_Styles["[Component] Stylesheet\n(styles.css: Academic Palette #F7F6F2, #345647)"]
        UI_Storage["[Component] Client Storage\n(sessionStorage: Bearer Token, Attempt State)"]

        UI_Controllers --> UI_Views
        UI_Controllers --> UI_API
        UI_Controllers --> UI_Storage
    end

    %% Network Transport
    UI_API ===|HTTP/1.1 JSON (Port 3000)| API_Router

    %% =========================================================================
    %% APPLICATION / REST SERVER TIER
    %% =========================================================================
    subgraph Server_Tier ["<<subsystem>> Express Application Server Tier (Node.js)"]
        
        %% Presentation & Middleware
        subgraph Presentation_Layer ["Presentation & Routing Layer"]
            API_Router["[Component] Express REST Router\n(src/app.js & src/routes/*.js)"]
            Auth_Middleware["[Component] Auth Middleware\n(requireAuth, requireAdmin, requireStudent)"]
            Static_Handler["[Component] Static Asset Handler\n(express.static('public'))"]

            API_Router --> Auth_Middleware
            API_Router --> Static_Handler
        end

        %% Controller Layer
        subgraph Controller_Layer ["Controller Layer"]
            Auth_Ctrl["[Component] AuthController"]
            Quiz_Ctrl["[Component] QuizController"]
            Attempt_Ctrl["[Component] AttemptController"]
            Analytics_Ctrl["[Component] AnalyticsController"]

            API_Router --> Auth_Ctrl
            API_Router --> Quiz_Ctrl
            API_Router --> Attempt_Ctrl
            API_Router --> Analytics_Ctrl
        end

        %% Business Domain Services Layer
        subgraph Service_Layer ["Business Logic Tier (Domain Services)"]
            Auth_Service["[Component] AuthService\n(scrypt hashing, 256-bit token registry)"]
            Quiz_Service["[Component] QuizManagementService\n(CRUD, TC-06 publish guard, immutability)"]
            Exam_Service["[Component] ExamService\n(Attempt lifecycle, timer grace, key hiding)"]
            Scoring_Service["[Component] ScoringService\n(Deterministic grading, unrounded pass threshold)"]
            Analytics_Service["[Component] AnalyticsService\n(Deterministic SQL cohort aggregations)"]

            Auth_Ctrl --> Auth_Service
            Quiz_Ctrl --> Quiz_Service
            Attempt_Ctrl --> Exam_Service
            Analytics_Ctrl --> Analytics_Service

            Exam_Service --> Scoring_Service
            Quiz_Service -.->|Checks Attempt Count| Sub_Repo
        end

        %% Data Access Layer (DAL)
        subgraph DAL_Layer ["Data Access Layer (DAL Repositories)"]
            User_Repo["[Component] UserRepository\n(SQL parameterized queries)"]
            Quiz_Repo["[Component] QuizRepository\n(SQL parameterized queries)"]
            Sub_Repo["[Component] SubmissionRepository\n(SQL parameterized queries)"]

            Auth_Service --> User_Repo
            Quiz_Service --> Quiz_Repo
            Exam_Service --> Sub_Repo
            Exam_Service --> Quiz_Repo
            Analytics_Service --> Sub_Repo
        end

        %% Database Engine Subsystem
        subgraph DB_Subsystem ["<<subsystem>> WebAssembly Database Engine"]
            DB_Client["[Component] DatabaseClient (src/database/db.js)\n(sql.js WASM Engine Wrapper)"]
            WASM_Memory["[Component] In-Memory WASM Heap\n(Allocated ArrayBuffer SQLite DB)"]
            Persistence_Engine["[Component] Persistence Sync Engine\n(fs.writeFileSync & fs.fsyncSync)"]

            User_Repo --> DB_Client
            Quiz_Repo --> DB_Client
            Sub_Repo --> DB_Client
            Analytics_Service --> DB_Client

            DB_Client --> WASM_Memory
            DB_Client --> Persistence_Engine
        end
    end

    %% Physical Storage
    subgraph Storage_Tier ["<<subsystem>> Host File System"]
        DB_File[("<<file>> database.sqlite\n(Persisted Relational SQLite Database)")]
        Persistence_Engine ===|Atomic fsyncSync Write| DB_File
    end
```

---

## 3. Explanation of Components & Subsystems

### 3.1 Client Browser Tier
- **View Containers:** Dynamic DOM containers swapped via CSS class `.active-view` without full page reloads.
- **Client Controllers:** Modular Vanilla JavaScript controllers handling form events, navigation, countdown intervals, and DOM updates via safe `replaceChildren` and `textContent`.
- **API Client:** Thin wrapper around native `window.fetch`, injecting `Authorization: Bearer <token>` headers.
- **Client Storage:** `sessionStorage` maintains the session token and active exam attempt cache.

### 3.2 Presentation & Routing Layer
- **Express REST Router:** Maps HTTP verbs and URI patterns to controller methods.
- **Authentication Middleware (`authMiddleware.js`):** Intercepts requests, validates Bearer tokens against `AuthService.sessions`, and enforces role access rules (`requireAdmin`, `requireStudent`).

### 3.3 Domain Services Layer
- **`AuthService`:** Manages user authentication, `scrypt` hashing with unique random salts, and in-memory session lifecycles.
- **`QuizManagementService`:** Enforces quiz business rules, question validation (exactly 4 options), the **TC-06 empty quiz check**, and the **Immutability Lock**.
- **`ExamService`:** Controls attempt state transitions, server clock timer evaluations (30-second grace window), and answer key concealment.
- **`ScoringService`:** Pure mathematical scoring component implementing $S = \sum f(S_i, C_i)$ and evaluating status using unrounded floating-point percentages.
- **`AnalyticsService`:** Deterministic SQL aggregation service delivering cohort summaries and student submissions tables.

### 3.4 Data Access Layer (DAL) & WebAssembly SQLite
- **Repositories (`UserRepository`, `QuizRepository`, `SubmissionRepository`):** Encapsulate SQL queries and transactions with complete separation of concerns.
- **`DatabaseClient` & `sql.js`:** Pure WebAssembly SQLite engine executing in Node.js process memory. Commits mutations to disk atomically via `db.save()` using POSIX `fs.fsyncSync` to guarantee crash resilience.

---

## 4. Source & Report Traceability

| Component | OOMD Report Source | STQA Report Reference | Implementation Source File |
| :--- | :--- | :--- | :--- |
| **Browser UI** | Diagram 6 (`User Interface`) | STQA §1, Page 4–8 | [`public/index.html`](file:///Users/soham/Github/Digital-Quiz-Portal/public/index.html), [`styles.css`](file:///Users/soham/Github/Digital-Quiz-Portal/public/css/styles.css) |
| **REST Router & Middleware** | Diagram 6 (`Controller / Router`) | STQA §3 (`server.js`) | [`src/app.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/app.js), [`authMiddleware.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/middleware/authMiddleware.js) |
| **Authentication Service** | Diagram 6 (`Auth Service`) | STQA §1, TC-01, TC-02 | [`authService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/authService.js) |
| **Quiz Management Service** | Diagram 6 (`Quiz Service`) | STQA TC-06 | [`QuizManagementService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/QuizManagementService.js) |
| **Exam Management Service** | Diagram 6 (`Exam Service`) | STQA §1 (Attempt Player) | [`examService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/examService.js) |
| **Scoring Service** | Diagram 6 (`Scoring Service`) | STQA §1 (Eq 1–3, TC-03..05) | [`scoringService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/scoringService.js) |
| **Analytics Service** | Diagram 6 (`Analytics Service`) | STQA §1, Page 8 Table | [`analyticsService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/analyticsService.js) |
| **Data Access Layer** | Diagram 6 (`Data Access Layer`) | STQA §3 (DAL Repositories) | [`src/dal/`](file:///Users/soham/Github/Digital-Quiz-Portal/src/dal/) |
| **Quiz Database** | Diagram 6 (`Database`) | STQA §3 (`database.sqlite`) | [`db.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/database/db.js), `database.sqlite` |

---

## 5. Architectural Reconciliation & Modeling Assumptions

1. **Elimination of Machine Learning Server:** The original OOMD Report Diagram 6 hinted at external analytics/prediction services. The implemented architecture uses deterministic SQL aggregations via `AnalyticsService`, eliminating external Python/PyTorch dependencies.
2. **Zero Native Compilation:** Database access is provided by `sql.js` (WebAssembly), eliminating JDBC drivers, Spring Boot microservices, and native C++ binaries (`node-gyp`).
3. **In-Process Monolith:** All components run inside a single Node.js runtime process, communicating via asynchronous function calls and native memory bindings.

