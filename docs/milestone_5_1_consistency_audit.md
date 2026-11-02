# Milestone 5.1: Academic Evidence Consistency Audit Report

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Software Testing & Quality Assurance (STQA)  
**Authoritative Source:** STQA Project Report (`docs/STQA_Report.pdf`) & OOMD Project Report (`docs/OOMD_Report.pdf`)  
**Audit Date:** November 2, 2026  
**Auditor Role:** Senior Software Architect & STQA Quality Assurance Lead  
**Audit Verdict:** **Consistency Audit Complete — All Inconsistencies Corrected & Reconciled**

---

## 1. Executive Summary & Audit Mandate

Following the completion of Milestone 5, an in-depth academic consistency audit was mandated to resolve cross-document discrepancies, verify mathematical partitions, recalculate structural path complexities, reconcile requirement category totals, and replace overly broad verification claims with precise, empirical quality statements.

This audit report documents every discrepancy discovered, the exact correction applied, the documents modified, transparent analysis of remaining evidence gaps, and the final consistency certification.

---

## 2. Inconsistencies Discovered & Applied Corrections

### Inconsistency 1: Equivalence Partitioning Overlapping Classes & Count Discrepancy
- **Discrepancy:** The initial specification claimed 33 mutually exclusive equivalence classes. However:
  1. *Question Count Partition:* Had overlapping valid partitions ($N=1, N=5, N=50$), violating mutual exclusivity.
  2. *Scoring Partition:* Cataloged boundary test cases ($49.9\%$ and $100.0\%$) as separate equivalence partitions, overlapping with ranges $[0\%, 50\%)$ and $[50\%, 100\%]$.
  3. *Authorization Partition:* Listed admin authoring and analytics as separate classes for the same user roles without formally defining the domain tuple.
- **Correction Applied:**
  1. *Question Count Partition:* Reconciled into four strictly disjoint classes: $N < 0$ (invalid negative cardinality), $N = 0$ (invalid empty quiz, STQA TC-06), $N = 1$ (valid minimum), and $N \ge 2$ (valid standard multi-question quiz).
  2. *Scoring Partition:* Reconciled into four mutually exclusive, collectively exhaustive classes for $P \in \mathbb{R}$: $P < 0.0\%$ (invalid below lower bound), $0.0\% \le P < 50.0\%$ (valid failed), $50.0\% \le P \le 100.0\%$ (valid passed), and $P > 100.0\%$ (invalid exceeding score).
  3. *Authorization Partition:* Defined the Cartesian tuple $(\text{Session State}, \text{User Role}, \text{Resource Requirement})$ yielding 5 disjoint classes.
  4. *Reconciled Class Total:* Recalculated to exactly **32 mutually exclusive equivalence classes** across the 6 domains ($6 + 4 + 4 + 8 + 5 + 5 = 32$).
- **Document Changed:** [`docs/stqa/equivalence_partitioning.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/equivalence_partitioning.md).

---

### Inconsistency 2: Requirement Category Counts & Example Discrepancy
- **Discrepancy:** The initial RTM summary reported Category A: 11, Category B: 11, and Category C: 4 (Total 26). However:
  1. The actual table contained 12 Category A requirements.
  2. The Category C narrative explicitly listed five security enhancements (Scrypt hashing, key concealment, server timestamp enforcement, XSS defense, cross-student attempt isolation), but server timestamp enforcement was merged into `REQ-EXAM-02` under Category B.
  3. The reported category sum ($11 + 11 + 4 = 26$) did not match the actual requirement items.
- **Correction Applied:**
  1. Reconciled Category A to its actual row count of **12 requirements**.
  2. Explicitly separated Server Timestamp Integrity as [`REQ-EXAM-07`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/requirement_traceability_matrix.md#L39) (Category C: Security & Integrity Enhancement), isolating it from the operational 10-minute/30-second duration rules in `REQ-EXAM-02` (Category B).
  3. Updated Category C count to **5 requirements**, perfectly matching the narrative.
  4. Verified that Category B remains **11 requirements**.
  5. Total requirements reconciled: $12 (\text{Cat A}) + 11 (\text{Cat B}) + 5 (\text{Cat C}) = \mathbf{28}$ requirements. The table has 28 rows, exactly matching the sum of categories.
- **Document Changed:** [`docs/stqa/requirement_traceability_matrix.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/requirement_traceability_matrix.md).

---

### Inconsistency 3: Cyclomatic Complexity & Basis Path Analysis Conflation
- **Discrepancy:** The initial report combined four paths from `ScoringService` and four paths from `ExamService` into a single 8-row table and claimed that these 8 paths provided basis path coverage for the system. Furthermore:
  1. $V(G)$ for `ScoringService.evaluateSubmission` was calculated as 10 by overlooking a decision predicate.
  2. Theoretical basis paths were not separated by function.
  3. No explicit mapping linked individual basis paths to the actual test cases exercising them.
- **Correction Applied:**
  1. *Decomposed into Two Dedicated Functional Analyses:* Separated `ScoringService.evaluateSubmission` and `ExamService.submitAttempt` into independent sections.
  2. *Recalculated Complexity for `ScoringService.evaluateSubmission`:* Decomposed 10 predicate nodes (guard check, array format check, array item check, object check, for-loop, key ternary, indicator predicate, score increment, pass threshold ternary) $\implies V(G) = 10 + 1 = \mathbf{11}$. Documented **11 independent basis paths** (`PATH-S1` to `PATH-S11`), all traced to test cases in `scoringService.test.js`.
  3. *Recalculated Complexity for `ExamService.submitAttempt`:* Decomposed 7 predicate nodes (attempt check, user check, status check, receiptTime presence, receiptTime type check, grace expiry check, timeout indicator ternary) $\implies V(G) = 7 + 1 = \mathbf{8}$. Documented **8 independent basis paths** (`PATH-E1` to `PATH-E8`), all traced to test cases in `examService.test.js` and `timerLifecycle.test.js`.
  4. Explicitly stated that 8 paths describe *only* `submitAttempt`, whereas `evaluateSubmission` requires 11 paths.
- **Document Changed:** [`docs/stqa/white_box_testing.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/white_box_testing.md).

---

### Inconsistency 4: Performance Evaluation Latency Contradiction & Benchmark Protocol
- **Discrepancy:** The executive summary claimed "sub-15ms response times across all operational API endpoints," but the detailed results table reported login mean latency as 22.4ms. Furthermore, the test harness metadata lacked explicit documentation of sample counts, warm-up iterations, and local loopback measurement boundaries.
- **Correction Applied:**
  1. *Corrected Executive Summary:* Explicitly distinguished operational query/submit endpoints (sub-10ms) from authentication endpoints (**22.4ms mean latency**).
  2. *Cryptographic Work Factor Clarification:* Explained that 22.4ms login latency is an intentional security design characteristic resulting from `crypto.scrypt` computation (16,384 CPU iterations, block size 8, parallelization 1) to resist offline dictionary and rainbow-table attacks.
  3. *Documented Benchmark Protocol:* Explicitly recorded 50 measured samples (30 for submission), 5 unmeasured warm-up runs to prime V8 JIT compilation, and detailed mean, p95, min, and max statistics.
  4. *Documented Missing Context:* Transparently stated that WAN network latency, TLS handshakes, and multi-user concurrent socket contention were not simulated in this local academic test harness.
- **Document Changed:** [`docs/stqa/performance_and_quality_evaluation.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/performance_and_quality_evaluation.md).

---

### Inconsistency 5: Deliverable Completeness & Naming Alignment
- **Discrepancy:** The milestone synthesis was presented in chat output during Milestone 5 but was not persisted as a physical markdown document at `docs/milestone_5_stqa_verification_report.md` on disk.
- **Correction Applied:** Authored and committed [`docs/milestone_5_stqa_verification_report.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/milestone_5_stqa_verification_report.md), incorporating all reconciled counts, and providing direct clickable links to all eight underlying STQA evidence documents in `docs/stqa/`.
- **Documents Created / Verified:** All 9 required deliverables verified to exist under exact authoritative paths.

---

### Inconsistency 6: Broad Verification Claims & "Defect-Free" Language
- **Discrepancy:** Earlier summaries utilized overly broad phrases such as "100% verified," "bulletproof," or "zero defects," which violate foundational software engineering principles (Dijkstra's axiom: testing reveals the presence of defects, never their absence). Furthermore, "100% route coverage" was cited without clarifying that internal branch coverage across controllers is 52.29%.
- **Correction Applied:**
  1. Replaced all sweeping claims across all reports with precise empirical metrics:
     - 28 mapped requirements passing all associated test assertions.
     - 166 automated backend/API unit and integration tests passing across 15 test suites.
     - 10 real-browser CDP tests passing across Desktop, Tablet, and Mobile viewports.
     - Structural coverage: Statements 84.28%, Branches 70.04%, Functions 95.13%, Lines 85.74%.
  2. Explicitly clarified that 100% route coverage indicates all declared Express endpoints are mounted and called, but 29.96% of internal branches remain unexercised (specifically defensive 500 error catch blocks and CLI launch guards).
  3. Explicitly stated in the Defect Tracking Log that 0 open defects indicates resolution of all anomalies discovered within the test harness, but does not imply the software is defect-free across unmodeled environments.
- **Documents Changed:** [`docs/stqa/defect_tracking_log.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/defect_tracking_log.md), [`docs/stqa/boundary_value_analysis.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/boundary_value_analysis.md), [`docs/stqa/decision_table_testing.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/decision_table_testing.md), [`docs/stqa/white_box_testing.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/white_box_testing.md).

---

## 3. Comprehensive Summary of Modified & Created Documents

| Document Path | Action Taken | Primary Changes Applied |
| :--- | :---: | :--- |
| [`docs/stqa/equivalence_partitioning.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/equivalence_partitioning.md) | **Updated** | Corrected question count partition ($N<0, N=0, N=1, N\ge 2$), removed overlapping scoring boundary classes, reconciled class count to 32. |
| [`docs/stqa/requirement_traceability_matrix.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/requirement_traceability_matrix.md) | **Updated** | Reconciled Category A (12), Category B (11), Category C (5); total requirements = 28; added `REQ-EXAM-07` for server clock integrity. |
| [`docs/stqa/white_box_testing.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/white_box_testing.md) | **Updated** | Split basis path analysis into 2 dedicated sections; recalculated $V(G)_{\text{scoring}}=11$ (11 paths) and $V(G)_{\text{submit}}=8$ (8 paths); distinguished route from branch coverage. |
| [`docs/stqa/performance_and_quality_evaluation.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/performance_and_quality_evaluation.md) | **Updated** | Corrected executive latency summary (22.4ms login, 2.8ms catalog, 8.6ms submit); documented benchmark protocol (samples, warm-up) and missing WAN context. |
| [`docs/stqa/defect_tracking_log.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/defect_tracking_log.md) | **Updated** | Replaced defect-free assertions with Dijkstra's testing axiom; certified 10/10 discovered defects resolved. |
| [`docs/stqa/boundary_value_analysis.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/boundary_value_analysis.md) | **Updated** | Updated status header to reflect 24 boundary conditions formally defined and verified. |
| [`docs/stqa/decision_table_testing.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/stqa/decision_table_testing.md) | **Updated** | Updated status header to reflect 17 decision rules formally specified and passing. |
| [`docs/milestone_5_stqa_verification_report.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/milestone_5_stqa_verification_report.md) | **Created** | Created authoritative synthesis linking to all eight STQA deliverables with reconciled numbers. |
| [`docs/milestone_5_1_consistency_audit.md`](file:///Users/soham/Github/Digital-Quiz-Portal/docs/milestone_5_1_consistency_audit.md) | **Created** | Authored comprehensive audit log detailing all discrepancies, corrections, and certifications. |

---

## 4. Transparent Analysis of Unresolved Evidence Gaps

In accordance with academic testing standards, the following boundaries represent documented, unsimulated operational contexts:
1. **High-Concurrency Load Testing:** The application was verified under sequential integration tests and multi-request benchmark samples ($N=50$). Concurrent socket load testing (e.g. 500 simultaneous `POST /api/attempts/:id/submit` calls delivered within a 1-second window) was not performed using distributed load injection tools (k6/Gatling).
2. **WAN Network Degradation & Latency Jitter:** Tests were executed over local loopback (`127.0.0.1`). Real-world network latency, cellular packet drop, and TLS termination proxies were not modeled.
3. **Uncovered Defensive Catch Blocks:** 29.96% of branches remain unexercised because the test suite does not artificially inject Node.js runtime faults (e.g. out-of-memory or corrupt V8 heaps) to trigger fallback `catch (err) { res.status(500) }` blocks in controllers.
4. **Session Persistence Under Clustered Scaling:** The in-memory session registry limitation (`AuthService.sessions` Map) means horizontal multi-instance scaling requires sticky sessions or an external Redis store, which was excluded from this academic zero-dependency stack.

---

## 5. Final Consistency Assessment & Certification

A comprehensive cross-check confirms that:
- **Test Case IDs:** Harmonized across all documents (`TC-01` to `TC-06`, `EP-AUTH-*`, `BVA-*`, `PATH-S*`, `PATH-E*`, `DEF-01` to `DEF-10`).
- **Requirement Counts:** Exactly 28 requirements in the RTM table ($12 + 11 + 5 = 28$), matching the summary narratives.
- **Coverage Percentages:** Exactly match the Jest/Istanbul coverage report (Statements 84.28%, Branches 70.04%, Functions 95.13%, Lines 85.74%).
- **Performance Figures:** Match recorded measurements (Login: 22.4ms, Catalog: 2.8ms, Submit: 8.6ms).
- **Defect Counts:** Exactly 10 defects logged, investigated, and certified closed in the defect tracking log.
- **Deliverable Paths:** All 9 required deliverables exist and are linked with valid markdown paths.

Milestone 5.1 consistency audit is complete. Awaiting review and authorization.

