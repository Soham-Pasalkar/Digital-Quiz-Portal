/**
 * Digital Quiz Portal - Student Dashboard Controller
 * [Category A]: Catalog of published quizzes, test initiation (STQA §1, Page 3)
 * [Category B]: Active attempt resumption, historical submissions audit
 * [UI Redesign]: Featured assessment hero, student performance KPIs & score progression chart
 */

const Student = {
  /**
   * Initialize and load Student Dashboard view.
   */
  async init() {
    if (!Auth.isStudent()) {
      App.navigateTo('login');
      return;
    }

    Utils.clearAlert('student-alert-container');

    const user = Auth.getUser();
    const nameEl = document.getElementById('student-welcome-name');
    if (nameEl && user) {
      nameEl.textContent = user.username;
    }

    await Promise.all([
      Student.loadAvailableQuizzes(),
      Student.loadSubmissionsHistory()
    ]);
  },

  /**
   * Load published quizzes available for students and populate featured hero card.
   */
  async loadAvailableQuizzes() {
    const container = document.getElementById('student-quizzes-container');
    const heroTitle = document.getElementById('hero-quiz-title');
    const heroDur = document.getElementById('hero-quiz-duration');
    const heroQ = document.getElementById('hero-quiz-questions');
    const heroAction = document.getElementById('hero-action-container');

    if (!container) return;

    try {
      const res = await API.get('/api/quizzes/available');
      const quizzes = (res && res.quizzes) ? res.quizzes : [];

      if (quizzes.length === 0) {
        if (heroTitle) heroTitle.textContent = 'No active assessments scheduled';
        if (heroDur) heroDur.textContent = '-- mins';
        if (heroQ) heroQ.textContent = '-- questions';
        if (heroAction) {
          heroAction.innerHTML = `
            <button class="btn btn-secondary btn-lg" disabled>
              No Assessment Open
            </button>
          `;
        }

        container.innerHTML = `
          <div class="card" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
            <p style="margin-bottom: 0.5rem; font-size: 1.05rem; font-weight: 600; color: var(--text-primary);">No published examinations are currently scheduled.</p>
            <p class="text-muted" style="margin: 0;">Please check back later or consult your course instructor.</p>
          </div>
        `;
        return;
      }

      // Check if student has an active saved session
      const savedSession = Exam.getSavedSession ? Exam.getSavedSession() : null;
      const isResumed = savedSession && savedSession.quizId;
      const featuredQuiz = isResumed
        ? (quizzes.find(q => q.id === savedSession.quizId) || quizzes[0])
        : quizzes[0];

      const duration = featuredQuiz.durationMinutes || featuredQuiz.duration_minutes || 10;
      const qCount = featuredQuiz.questionCount !== undefined ? featuredQuiz.questionCount : (featuredQuiz.question_count || 0);

      // Populate Featured Hero Card
      if (heroTitle) heroTitle.textContent = featuredQuiz.title;
      if (heroDur) heroDur.textContent = `${duration} mins`;
      if (heroQ) heroQ.textContent = `${qCount} MCQs`;
      if (heroAction) {
        heroAction.innerHTML = `
          <button class="btn btn-primary btn-lg" id="hero-start-btn" onclick="Student.startExam(${featuredQuiz.id})">
            ${isResumed ? 'Resume Assessment &rarr;' : 'Begin Assessment &rarr;'}
          </button>
        `;
      }

      // Render full catalog table
      container.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Examination Title</th>
                <th>Duration</th>
                <th>Questions</th>
                <th>Academic Standard</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="student-catalog-tbody">
              ${quizzes.map(q => {
                const dur = q.durationMinutes || q.duration_minutes || 10;
                const count = q.questionCount !== undefined ? q.questionCount : (q.question_count || 0);
                const isCurrentActive = isResumed && q.id === savedSession.quizId;

                return `
                  <tr>
                    <td>
                      <strong>${Utils.escapeHTML(q.title)}</strong>
                      ${isCurrentActive ? `<span class="badge badge-locked" style="margin-left: 0.4rem;">In Progress</span>` : ''}
                    </td>
                    <td>${dur} minutes</td>
                    <td>${count} MCQs</td>
                    <td><span class="badge badge-published">50% Pass Threshold</span></td>
                    <td style="text-align: right;">
                      <button class="btn btn-primary btn-sm" onclick="Student.startExam(${q.id})">
                        ${isCurrentActive ? 'Resume Exam &rarr;' : 'Start Exam &rarr;'}
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      console.error('[Student] Failed to load available quizzes:', e);
      Utils.showAlert('student-alert-container', `Failed to load available examinations: ${e.message}`, 'danger');
    }
  },

  /**
   * Load student's past examination submission records, calculate KPIs, and render progression chart.
   */
  async loadSubmissionsHistory() {
    const tbody = document.getElementById('student-history-tbody');
    if (!tbody) return;

    try {
      const res = await API.get('/api/attempts/history');
      const history = (res && (res.history || res.submissions)) ? (res.history || res.submissions) : [];

      // Calculate Student Performance KPI Metrics
      const totalCompleted = history.length;
      let totalPctSum = 0;
      let passedCount = 0;

      history.forEach(h => {
        totalPctSum += Number(h.percentage) || 0;
        if (h.status === 'PASSED') passedCount++;
      });

      const avgScore = totalCompleted > 0 ? (totalPctSum / totalCompleted).toFixed(1) : '0.00';
      const passRate = totalCompleted > 0 ? ((passedCount / totalCompleted) * 100).toFixed(1) : '0.00';

      const statCompEl = document.getElementById('student-stat-completed');
      const statAvgEl = document.getElementById('student-stat-avg-score');
      const statPassEl = document.getElementById('student-stat-passed');
      const statRateEl = document.getElementById('student-stat-pass-rate');

      if (statCompEl) statCompEl.textContent = String(totalCompleted);
      if (statAvgEl) statAvgEl.textContent = `${avgScore}%`;
      if (statPassEl) statPassEl.textContent = String(passedCount);
      if (statRateEl) statRateEl.textContent = `${passRate}%`;

      // Render Student Score Progression Chart
      Utils.renderStudentProgression('student-chart-progression', history);

      if (history.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-muted" style="text-align: center; padding: 2.5rem;">
              You have not finalized any examination attempts yet.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = history.map(h => {
        const isPassed = h.status === 'PASSED';
        const statusBadge = isPassed
          ? `<span class="badge badge-passed">PASSED</span>`
          : `<span class="badge badge-failed">FAILED</span>`;
        const timeoutBadge = h.is_timed_out === 1
          ? ` <span class="badge badge-timeout" title="Submitted during 30s grace period">Grace Period</span>`
          : '';

        return `
          <tr>
            <td><strong>${Utils.escapeHTML(h.quiz_title)}</strong></td>
            <td><strong>${h.score}</strong> / ${h.total_questions}</td>
            <td>${h.percentage}%</td>
            <td>${statusBadge}${timeoutBadge}</td>
            <td>${Utils.formatDate(h.submission_time)}</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-sm" onclick="Student.viewResult(${h.id})">
                View Breakdown
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error('[Student] Failed to load submission history:', e);
    }
  },

  /**
   * Initiate or resume an examination attempt.
   * @param {number} quizId
   */
  async startExam(quizId) {
    try {
      await Exam.start(quizId);
    } catch (e) {
      Utils.showAlert('student-alert-container', `Unable to start examination: ${e.message}`, 'danger');
    }
  },

  /**
   * View details of a past submission.
   * @param {number} submissionId
   */
  async viewResult(submissionId) {
    try {
      await Results.loadSubmission(submissionId);
    } catch (e) {
      Utils.showAlert('student-alert-container', `Unable to load submission: ${e.message}`, 'danger');
    }
  }
};

window.Student = Student;
