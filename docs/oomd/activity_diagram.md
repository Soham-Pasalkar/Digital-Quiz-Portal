# OOMD Diagram 4: Activity Diagram

**Project:** Digital Quiz Portal (Online Exam & Assessment Portal)  
**Academic Subject:** Object-Oriented Modeling and Design (OOMD)  
**Authoritative Source:** OOMD Project Report (`docs/OOMD_Report.pdf`, Page 3, Diagram 4)  
**Implementation Source:** Application Controllers, Domain Services, State Machine  
**Status:** **VERIFIED & RECONCILED WITH IMPLEMENTATION**

---

## 1. Diagram Purpose

The Activity Diagram models the dynamic operational workflows, algorithmic decision logic, and conditional branching across user authentication, administrator quiz curating, and student examination execution.

It details:
1. Authentication verification and error looping.
2. Role-based routing distinguishing the `Administrator` workflow from the `Student Candidate` workflow.
3. Administrator quiz creation, immutability assertion, question building, and empty quiz validation ([STQA TC-06](file:///Users/soham/Github/Digital-Quiz-Portal/tests/integration/quiz.api.test.js#L30)).
4. Student exam player lifecycle, timer countdown, grace window evaluation, deterministic scoring, and feedback review.

---

## 2. Mermaid UML Diagram

```mermaid
flowchart TD
    %% Initial Node
    Start([● Start: User Opens Portal]) --> EnterCreds[User Enters Username & Password]
    EnterCreds --> PostLogin[Dispatch POST /api/auth/login]
    PostLogin --> VerifyScrypt{Credentials Valid?\nScrypt Hash Matches?}

    %% Authentication Decision
    VerifyScrypt -- No --> DisplayAuthError[Display HTTP 401 Unauthorized Alert]
    DisplayAuthError --> EnterCreds
    VerifyScrypt -- Yes --> IssueToken[Issue 256-bit Token & Store in sessionStorage]
    IssueToken --> RoleCheck{User Role?}

    %% =========================================================================
    %% ADMIN WORKFLOW
    %% =========================================================================
    RoleCheck -- "role == 'admin'" --> AdminDash[Render Admin Dashboard]

    AdminDash --> AdminActionChoice{Select Admin Action}
    
    %% Admin Branch 1: Create Quiz
    AdminActionChoice -- "Create Quiz" --> InputQuizMeta[Enter Quiz Title & Duration]
    InputQuizMeta --> DispatchCreateQuiz[Dispatch POST /api/quizzes]
    DispatchCreateQuiz --> DraftCreated[Persist Quiz Draft: is_published = 0]
    DraftCreated --> AdminDash

    %% Admin Branch 2: Add Question
    AdminActionChoice -- "Add Question" --> CheckAttemptsExist{Attempts Exist\nfor Quiz?}
    CheckAttemptsExist -- Yes --> LockRejection[Throw HTTP 400: Quiz Immutability Lock]
    LockRejection --> AdminDash
    CheckAttemptsExist -- No --> InputQuestionData[Input Text, 4 Options A-D, Correct Letter]
    InputQuestionData --> ValidateOptions{Exactly 4 Options\n& Non-Empty?}
    ValidateOptions -- No --> ShowOptionError[Display HTTP 400 Bad Request]
    ShowOptionError --> InputQuestionData
    ValidateOptions -- Yes --> NormalizeKey[Normalize Letter to Index 0..3]
    NormalizeKey --> PersistQuestion[Save Question to SQLite]
    PersistQuestion --> AdminDash

    %% Admin Branch 3: Publish Quiz
    AdminActionChoice -- "Publish Quiz" --> CheckQuestionCount{Question Count\nN >= 1?}
    CheckQuestionCount -- "No (N == 0)" --> RejectEmptyPublish[Throw HTTP 400: TC-06 Rejection\n'Cannot publish empty quiz']
    RejectEmptyPublish --> AdminDash
    CheckQuestionCount -- "Yes (N >= 1)" --> SetPublished[UPDATE quizzes SET is_published = 1]
    SetPublished --> AdminDash

    %% Admin Branch 4: View Analytics
    AdminActionChoice -- "View Analytics" --> FetchAnalytics[Dispatch GET /api/analytics/overview & /submissions]
    FetchAnalytics --> RenderReportingTable[Render STQA Page 8 Submissions Table & Pass Rates]
    RenderReportingTable --> AdminActionChoice

    %% Admin Logout
    AdminActionChoice -- "Logout" --> AdminLogout[Dispatch POST /api/auth/logout]
    AdminLogout --> EndSession([● End: Session Terminated])

    %% =========================================================================
    %% STUDENT WORKFLOW
    %% =========================================================================
    RoleCheck -- "role == 'student'" --> StudentDash[Render Student Dashboard]
    StudentDash --> FetchCatalog[GET /api/quizzes/available]
    FetchCatalog --> DisplayQuizzes[Display Published Quizzes Catalog]
    DisplayQuizzes --> SelectQuiz[Student Selects Quiz & Clicks 'Start Exam']

    SelectQuiz --> RegisterAttempt[POST /api/quizzes/:id/attempts]
    RegisterAttempt --> ActiveAttemptCheck{Active Attempt\nAlready Exists?}
    ActiveAttemptCheck -- Yes --> ResumeAttempt[Resume Existing Attempt: Return Remaining Time]
    ActiveAttemptCheck -- No --> CreateAttempt[Create New Attempt: Set started_at & expires_at]
    ResumeAttempt --> FetchAttemptQuestions[GET /api/attempts/:id/questions]
    CreateAttempt --> FetchAttemptQuestions

    FetchAttemptQuestions --> StripKeys[Strip correct_option to Protect Answer Key]
    StripKeys --> RenderPlayer[Render Exam Player View & Start Countdown Timer]

    RenderPlayer --> ExamSolving[Student Navigates Questions & Selects Options A-D]
    
    ExamSolving --> TerminationCheck{Exam Termination Event?}
    TerminationCheck -- "Manual Submit" --> SubmitPayload[Dispatch POST /api/attempts/:id/submit]
    TerminationCheck -- "Timer 00:00" --> AutoSubmit[Auto-Dispatch Current Answers]
    AutoSubmit --> SubmitPayload

    SubmitPayload --> ServerClockEval{Server Receipt Time\nvs Expiry?}
    
    %% Timer Decisions
    ServerClockEval -- "Past Grace Window\n(> expiresAt + 30s)" --> AutoFailExpired[Auto-Finalize Attempt as FAILED 0%\nThrow HTTP 400 Bad Request]
    AutoFailExpired --> RenderFailureView[Display Attempt Expired Alert]
    RenderFailureView --> StudentDash

    ServerClockEval -- "Within 30s Grace\n(expiresAt < Receipt <= expiresAt + 30s)" --> FlagGrace[Set is_timed_out = 1\nProceed to Full Grading]
    ServerClockEval -- "On-Time\n(Receipt <= expiresAt)" --> FlagOnTime[Set is_timed_out = 0\nProceed to Full Grading]

    FlagGrace --> EvaluateAnswers[ScoringService: Compute Raw Score S = sum f(Si, Ci)]
    FlagOnTime --> EvaluateAnswers

    EvaluateAnswers --> ComputePercentage[Compute Percentage P = (S / N) * 100]
    ComputePercentage --> PassThresholdCheck{Pass Threshold:\nP >= 50.0%?}
    
    PassThresholdCheck -- Yes --> SetPassed[Assign Status: 'PASSED']
    PassThresholdCheck -- No --> SetFailed[Assign Status: 'FAILED']

    SetPassed --> PersistResults[Record Answers & Finalize in SQLite via db.save fsyncSync]
    SetFailed --> PersistResults

    PersistResults --> RenderFeedbackView[Render Detailed Results View:\nScore, Percentage, Audit Badges]
    RenderFeedbackView --> StudentDash
    
    StudentDash --> StudentLogout[Dispatch POST /api/auth/logout]
    StudentLogout --> EndSession
```

---

## 3. Explanation of Operational Workflows & Decision Nodes

### 3.1 Authentication & Role-Based Routing
- Every user flow initiates with credential entry (`POST /api/auth/login`).
- `VerifyScrypt`: Rejection is processed in constant time using `crypto.timingSafeEqual` to defeat timing attacks; invalid credentials loop back without leaking user existence.
- Successful verification issues a 256-bit cryptographically secure session token stored in browser `sessionStorage`, followed by routing to the `#admin-view` or `#student-view`.

### 3.2 Administrator Quiz Authoring & Publishing Workflow
1. **Creation:** Draft quizzes are created with title and duration.
2. **Question Authoring & Immutability:** Before any modification, `_assertQuizMutable` checks `SubmissionRepository.countAttemptsByQuizId`. If student attempts exist, modifications are strictly rejected with HTTP 400.
3. **Empty Quiz Publishing Rejection (`STQA TC-06`):** When the administrator attempts to publish, `countQuestions(quizId)` is checked. If $N = 0$, the request is rejected with HTTP 400 (`"Cannot publish an empty quiz without questions"`).

### 3.3 Student Examination & Timer Integrity Workflow
1. **Attempt Registration:** Attempt creation is initiated explicitly via `POST /api/quizzes/:id/attempts`. A partial unique index on `(user_id, quiz_id) WHERE status = 'IN_PROGRESS'` prevents duplicate active attempts.
2. **Key Concealment:** Questions are retrieved via `GET /api/attempts/:id/questions`, which projects only `question_text`, `option_a`–`option_d`, and `order_num`, omitting `correct_option`.
3. **Timer Expiration & Grace Window:**
   - On-time receipt ($T_{\text{receipt}} \le T_{\text{expiry}}$) grades normally (`is_timed_out = 0`).
   - Grace period receipt ($T_{\text{expiry}} < T_{\text{receipt}} \le T_{\text{expiry}} + 30\text{s}$) awards full score with `is_timed_out = 1`.
   - Post-grace receipt ($T_{\text{receipt}} > T_{\text{expiry}} + 30\text{s}$) auto-finalizes the attempt as `FAILED` (0% score) and rejects with HTTP 400.
4. **Deterministic Grading:** Evaluates indicator function $f(S_i, C_i)$ (+1 for match, 0 for incorrect/unattempted; no negative marking), determines status based on unrounded percentage ($P \ge 50.0\%$), commits state atomically to `database.sqlite` via `fsyncSync`, and renders question-by-question audit badges.

---

## 4. Source & Report Traceability

| Activity Flow | OOMD Report Source | STQA Report Reference | Implementation Source File |
| :--- | :--- | :--- | :--- |
| **Authentication Branching** | Diagram 4 (Login branch) | STQA §1, TC-01, TC-02 | [`authService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/authService.js) |
| **Question Validation** | Diagram 4 (Question builder) | STQA §1, Page 4–5 | [`QuizManagementService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/QuizManagementService.js#L225) |
| **Empty Quiz Guard (TC-06)** | Diagram 4 (Publish check) | STQA TC-06 ($N \ge 1$) | [`QuizManagementService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/QuizManagementService.js#L363) |
| **Active Attempt Resolution** | Diagram 4 (Start exam) | Milestone 1 Review | [`examService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/examService.js#L130) |
| **Timer Expiration & Grace** | Diagram 4 (Timer handling) | Milestone 3 Prereq 2 | [`examService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/examService.js#L280-L302) |
| **Grading & Pass Threshold** | Diagram 4 (Score evaluation)| STQA §1 (Eq 1–3, TC-03..05) | [`scoringService.js`](file:///Users/soham/Github/Digital-Quiz-Portal/src/services/scoringService.js#L85-L163) |

---

## 5. Architectural Reconciliation & Modeling Assumptions

1. **Explicit Post-Grace Rejection:** The original OOMD activity diagram did not detail post-grace handling. The implemented system defines an explicit activity branch that finalizes the attempt as `FAILED` (0% score) and returns HTTP 400 Bad Request.
2. **Auto-Submission Trigger:** Client countdown timer reaching `00:00` automatically triggers form dispatch without requiring explicit student click.
3. **Deterministic SQL Cohort Analytics:** Analytics activities execute deterministic SQL aggregations rather than external statistical or machine learning inference scripts.

