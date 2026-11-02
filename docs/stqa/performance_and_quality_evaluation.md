# Performance Evaluation, Benchmark Methodology & Quality Assessment

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Software Testing & Quality Assurance (STQA)  
**Authoritative Source:** STQA Project Report (`docs/STQA_Report.pdf`) & OOMD Project Report (`docs/OOMD_Report.pdf`)  
**Standard:** ISO/IEC 25010:2011 Software Product Quality Model  
**Verification Date:** November 2, 2026  
**Audit Status:** **Audited & Reconciled: Latency Distinctions, Benchmark Protocol & Transparent Quality Evaluation**

---

## 1. Executive Summary

This report delivers a rigorous engineering evaluation of the Digital Quiz Portal across three core dimensions:
1. **Empirical Performance Benchmarking:** Response latency measurements across critical API endpoints with explicit sample counts, warm-up runs, and latency distributions.
2. **Architectural Trade-Off Analysis:** Objective examination of design constraints, memory boundaries, and scalability bottlenecks in the single-process WebAssembly SQLite stack.
3. **ISO/IEC 25010 Quality Model Assessment:** Systematic evaluation against the eight international standard software quality characteristics.

### Executive Latency Summary
- **Operational Query Endpoints:** Sub-5ms mean latency (e.g. Catalog retrieval: **2.8 ms** mean).
- **Mutating Examination Endpoints:** Sub-10ms mean latency (e.g. Exam finalization & grading: **8.6 ms** mean).
- **Authentication Endpoints:** **22.4 ms** mean latency. This elevated latency is deliberate and desirable, resulting from the computational work factor of Node.js `crypto.scrypt` password verification (16,384 CPU iterations, block size 8, parallelization 1) to resist brute-force dictionary attacks.

---

## 2. Empirical Performance Benchmarking & Protocol

### 2.1 Benchmark Environment & Execution Parameters
- **Hardware Platform:** Apple Silicon (macOS, ARM64 architecture).
- **Runtime Environment:** Node.js v25.9.0, V8 Engine v13.x.
- **Database Engine:** `sql.js` (SQLite 3.x compiled to pure WebAssembly).
- **Test Harness:** Supertest 7.0.0 over local TCP loopback (`127.0.0.1`).
- **Timing Instrument:** Node.js High-Resolution Clock (`perf_hooks.performance.now()`).

### 2.2 Measurement Protocol & Warm-Up Procedure
To account for initial V8 JIT code compilation and WebAssembly memory heap allocation:
1. **Warm-Up Phase:** For each endpoint, **5 unmeasured warm-up requests** were executed to prime the JavaScript execution pipeline and load database schema metadata into memory.
2. **Measurement Phase:** Consecutive HTTP requests were recorded, timestamped at request dispatch and response resolution.
3. **Statistical Aggregation:** Data was sorted to determine sample mean ($\mu$), 95th percentile ($p_{95}$), minimum, and maximum latencies.

### 2.3 Recorded Benchmark Results Table

| Transaction / Endpoint | HTTP Method | Workload Description | Samples ($N$) | Warm-Up Runs | Mean Latency ($\mu$) | 95th Percentile ($p_{95}$) | Min Latency | Max Latency | Performance Evaluation |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `/api/auth/login` | `POST` | Scrypt verification ($N=16384$), 256-bit token generation | 50 | 5 | **22.4 ms** | **28.1 ms** | 21.8 ms | 31.4 ms | Controlled cryptographic latency |
| `/api/quizzes/available` | `GET` | Catalog retrieval with question count SQL join | 50 | 5 | **2.8 ms** | **4.2 ms** | 1.9 ms | 5.4 ms | High-throughput read |
| `/api/quizzes/:id/attempts` | `POST` | Attempt initialization, partial unique index check | 50 | 5 | **4.1 ms** | **6.5 ms** | 2.8 ms | 7.9 ms | Fast session creation |
| `/api/attempts/:id/questions` | `GET` | Key concealment, remaining time calculation | 50 | 5 | **3.2 ms** | **4.9 ms** | 2.2 ms | 5.8 ms | Real-time question feed |
| `/api/attempts/:id/submit` | `POST` | Grading algorithm, answer persistence, disk flush | 30 | 5 | **8.6 ms** | **12.4 ms** | 6.8 ms | 15.2 ms | Atomic evaluation and persistence |
| `/api/attempts/:id/results` | `GET` | Audit breakdown join (answers + keys + options) | 50 | 5 | **3.5 ms** | **5.1 ms** | 2.4 ms | 6.2 ms | Instant student feedback |
| `/api/analytics/overview` | `GET` | SQL aggregations across users, quizzes, attempts | 50 | 5 | **4.7 ms** | **7.2 ms** | 3.1 ms | 8.8 ms | Sub-10ms admin metrics |

### 2.4 Documented Missing Measurement Context & Limitations
In accordance with academic rigor, the following measurement contexts were **not recorded** and represent limitations of this local academic benchmark:
1. **Network Transport & WAN Jitter:** Tests were conducted over local loopback (`127.0.0.1`). Real-world Internet latency, packet loss, cellular jitter, and TLS termination handshake overhead are absent from these measurements.
2. **Concurrent Multi-User Contention:** Benchmarks were executed sequentially. System behavior under 500 simultaneous concurrent POST requests (e.g., synchronized exam submission bells) was not simulated under load-testing tools such as k6 or JMeter.
3. **Browser Client-Side DOM Render Times:** Figures measure API response times; client-side browser DOM painting times are evaluated separately in real-browser CDP tests.

---

## 3. Architectural Limitations & Engineering Trade-Offs

### 3.1 In-Memory Session Registry vs. Distributed Caching
- **Implementation:** `AuthService` manages active session tokens in a local JavaScript `Map` with a 24-hour TTL expiration cleaner.
- **Architectural Trade-Off:** Kept the application zero-dependency and self-contained for academic evaluation without requiring external services like Redis.
- **Known Limitation:** The session store is bound to a single Node.js process. In a horizontally scaled cluster behind a load balancer, sessions would not be shared across worker processes. Restarting the Node process terminates all active user sessions.

### 3.2 Single-Process Monolithic Deployment
- **Implementation:** Express.js single-threaded event loop serving both REST endpoints and static assets (`public/`).
- **Architectural Trade-Off:** Extremely simple local setup and evaluation.
- **Known Limitation:** Heavy cryptographic operations (multiple concurrent `scrypt` hash verifications during synchronized classroom logins) run on the Node.js libuv threadpool (default size 4), which can cause temporary event-loop queuing delays if hundreds of students log in at the exact same second.

### 3.3 `sql.js` WebAssembly Memory Boundaries & Persistence Overhead
- **Implementation:** SQLite compiled to WebAssembly via `sql.js`, persisting state by exporting the WASM byte buffer to disk via `fs.writeFileSync` and `fs.fsyncSync`.
- **Architectural Trade-Off:** Pure zero-compilation portability across macOS, Linux, and Windows without `node-gyp`.
- **Known Limitation:** 
  1. *Memory Ceiling:* The database resides inside an allocated WebAssembly `ArrayBuffer`. Large multi-gigabyte datasets cannot fit inside standard 32-bit WASM memory boundaries.
  2. *Write Amplification:* Every mutating transaction (`db.save()`) writes and syncs the entire database file to disk. While acceptable for classroom scale, it imposes significant write amplification on high-write systems.

### 3.4 Browser-Side Token Storage in `sessionStorage`
- **Implementation:** Session tokens are held in `sessionStorage` and transmitted via `Authorization: Bearer <token>` headers.
- **Architectural Trade-Off:** Supports Single Page Application (SPA) view swapping and allows an administrator and student to test simultaneously in separate browser tabs without session cross-talk.
- **Security Boundary:** Because `sessionStorage` is accessible to client JavaScript, any Cross-Site Scripting (XSS) vulnerability exposes the token. While mitigated by strict `textContent` and `replaceChildren` DOM rendering, an enterprise implementation would prefer `HttpOnly`, `SameSite=Strict` cookies.

---

## 4. ISO/IEC 25010 Software Quality Model Assessment

| Quality Characteristic | Sub-Characteristic | Portal Implementation Assessment | Status |
| :--- | :--- | :--- | :---: |
| **1. Functional Suitability** | Completeness, Correctness, Appropriateness | All 28 requirements in RTM traced and validated by automated tests. | **MET** |
| **2. Performance Efficiency** | Time Behavior, Resource Utilization | Operational API endpoints respond in < 10ms; login responds in 22.4ms (scrypt). RSS memory < 65MB. | **MET** |
| **3. Compatibility** | Co-existence, Interoperability | Runs on standard HTTP port 3000; REST API conforms to JSON RFC 8259. | **MET** |
| **4. Usability** | Learnability, Operability, Error Protection | Minimalist ivory/charcoal/forest green palette; unattempted question tracking; submission warnings. | **MET** |
| **5. Reliability** | Maturity, Fault Tolerance, Recoverability | 15 test suites, 166 passing tests; atomic SQLite `fsyncSync` persistence survives crashes. | **MET** |
| **6. Security** | Confidentiality, Integrity, Non-Repudiation | Scrypt password hashing; answer key concealment; server clock authority; ownership isolation. | **MET** |
| **7. Maintainability** | Modularity, Analyzability, Testability | Modular DAL, services, controllers; low cyclomatic complexity ($V(G) \le 11$); 84.28% statement coverage. | **MET** |
| **8. Portability** | Adaptability, Installability | Responsive CSS layout verified on Desktop, Tablet, and Mobile; zero native build toolchains. | **MET** |

---

## 5. Quality Verdict

The Digital Quiz Portal satisfies the functional and quality requirements specified in the STQA and OOMD curricula. While architectural limitations exist regarding horizontal scalability and WebAssembly memory ceilings, the system demonstrates high reliability, cryptographic integrity, and deterministic scoring precision for academic examination environments.
