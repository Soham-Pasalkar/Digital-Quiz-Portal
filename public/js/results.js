/**
 * Digital Quiz Portal - Examination Results & Performance Breakdown
 * [Category A]: Score computation, percentage, pass/fail status (STQA §1, Page 3, Page 8)
 * [Category B]: Full post-submission answer breakdown, correct answer reveal, grace-period notices
 */

const Results = {
  currentSubmission: null,

  /**
   * Initialize results view on routing.
   */
  init() {
    if (!Auth.isAuthenticated()) {
      App.navigateTo('login');
      return;
    }

    if (Results.currentSubmission) {
      Results.render();
    } else {
      // If no active submission in memory, return to appropriate dashboard
      App.navigateTo(Auth.isAdmin() ? 'admin' : 'student');
    }
  },

  /**
   * Set submission directly (e.g. immediately after submitting an exam).
   * @param {Object} submission
   */
  display(submission) {
    Results.currentSubmission = submission;
    App.navigateTo('results');
    Results.render();
  },

  /**
   * Fetch a specific submission record by ID.
   * @param {number} submissionId
   */
  async loadSubmission(submissionId) {
    try {
      const res = await API.get(`/api/attempts/${submissionId}/results`);
      if (res && res.submission) {
        Results.currentSubmission = res.submission;
        App.navigateTo('results');
        Results.render();
      }
    } catch (e) {
      console.error('[Results] Failed to load submission results:', e);
      alert(`Unable to load examination results: ${e.message}`);
    }
  },

  /**
   * Render the score summary card and question-by-question breakdown.
   */
  render() {
    const s = Results.currentSubmission;
    if (!s) return;

    const quizTitle = s.quizTitle || s.quiz_title || 'Examination';
    const totalQuestions = s.totalQuestions !== undefined ? s.totalQuestions : (s.total_questions || 0);
    const score = s.score !== undefined ? s.score : 0;
    const percentage = s.percentage !== undefined ? s.percentage : 0;
    const status = s.status || (percentage >= 50 ? 'PASSED' : 'FAILED');
    const isPassed = status === 'PASSED';
    const isTimedOut = s.isTimedOut === true || s.is_timed_out === 1;
    const timestamp = s.submittedAt || s.submission_time;

    // 1. Populate summary card elements
    const titleEl = document.getElementById('results-quiz-title');
    const scoreEl = document.getElementById('results-score-display');
    const pctEl = document.getElementById('results-pct-display');
    const badgeEl = document.getElementById('results-status-badge');
    const timeEl = document.getElementById('results-timestamp');

    if (titleEl) titleEl.textContent = quizTitle;
    if (scoreEl) scoreEl.textContent = `${score} / ${totalQuestions}`;
    if (pctEl) pctEl.textContent = `${percentage}% Academic Score`;

    if (badgeEl) {
      const statusBadge = isPassed
        ? `<span class="badge badge-passed" style="font-size: 1rem; padding: 0.35rem 0.85rem;">PASSED</span>`
        : `<span class="badge badge-failed" style="font-size: 1rem; padding: 0.35rem 0.85rem;">FAILED</span>`;

      const timeoutBadge = isTimedOut
        ? ` <span class="badge badge-timeout" style="font-size: 0.85rem; padding: 0.35rem 0.65rem;" title="Answers received within the 30-second post-expiry grace period">Grace Period Submission</span>`
        : '';

      badgeEl.innerHTML = `${statusBadge}${timeoutBadge}`;
    }

    if (timeEl) {
      timeEl.textContent = timestamp ? `Submitted: ${Utils.formatDate(timestamp)}` : '';
    }

    // 2. Populate question-by-question audit breakdown
    const breakdownContainer = document.getElementById('results-breakdown-container');
    if (!breakdownContainer) return;

    const breakdown = s.breakdown || [];
    if (breakdown.length === 0) {
      breakdownContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          Detailed question audit breakdown is not available for this record.
        </div>
      `;
      return;
    }

    breakdownContainer.innerHTML = breakdown.map((item, idx) => {
      const isCorrect = item.isCorrect === true;
      const cardClass = isCorrect ? 'correct' : 'incorrect';

      const studentLetter = item.selectedOptionLetter || Utils.indexToLetter(item.selectedOption);
      const correctLetter = item.correctOptionLetter || Utils.indexToLetter(item.correctOption);

      const statusTag = isCorrect
        ? `<span class="badge badge-passed">Correct (+1)</span>`
        : (item.selectedOption === -1
            ? `<span class="badge badge-draft">Unattempted (0)</span>`
            : `<span class="badge badge-failed">Incorrect (0)</span>`);

      // Extract options dictionary
      const optA = item.options ? item.options.A : '';
      const optB = item.options ? item.options.B : '';
      const optC = item.options ? item.options.C : '';
      const optD = item.options ? item.options.D : '';

      const options = [
        { index: 0, letter: 'A', text: optA },
        { index: 1, letter: 'B', text: optB },
        { index: 2, letter: 'C', text: optC },
        { index: 3, letter: 'D', text: optD }
      ];

      return `
        <div class="breakdown-card results-breakdown-card ${cardClass}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">
              QUESTION ${idx + 1}
            </span>
            ${statusTag}
          </div>

          <div style="font-size: 1.05rem; font-weight: 500; color: var(--text-primary); margin-bottom: 1rem; line-height: 1.4;">
            ${Utils.escapeHTML(item.questionText)}
          </div>

          <div class="options-list" style="gap: 0.5rem;">
            ${options.map(opt => {
              const isSelected = item.selectedOption === opt.index;
              const isTheCorrect = item.correctOption === opt.index;

              let choiceStyle = 'border: 1px solid var(--color-border);';
              let badgeStyle = '';
              let mark = '';

              if (isTheCorrect) {
                choiceStyle = 'border: 1px solid var(--color-success); background-color: var(--color-success-bg);';
                badgeStyle = 'background-color: var(--color-success); color: #fff; border-color: var(--color-success);';
                mark = '<span class="badge badge-passed" style="margin-left: auto;">Correct Answer</span>';
              } else if (isSelected && !isCorrect) {
                choiceStyle = 'border: 1px solid var(--color-danger); background-color: var(--color-danger-bg);';
                badgeStyle = 'background-color: var(--color-danger); color: #fff; border-color: var(--color-danger);';
                mark = '<span class="badge badge-failed" style="margin-left: auto;">Your Selection</span>';
              }

              return `
                <div class="option-choice" style="${choiceStyle} cursor: default;">
                  <div class="option-letter-badge" style="${badgeStyle}">${opt.letter}</div>
                  <div class="option-choice-text">${Utils.escapeHTML(opt.text)}</div>
                  ${mark}
                </div>
              `;
            }).join('')}
          </div>

          <div class="breakdown-answer-row">
            <div>
              <span class="text-muted">Your Selection:</span>
              <strong>${studentLetter}</strong>
            </div>
            <div>
              <span class="text-muted">Correct Key:</span>
              <strong style="color: var(--color-success);">${correctLetter}</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Return to appropriate dashboard based on user role.
   */
  backToDashboard() {
    if (Auth.isAdmin()) {
      App.navigateTo('admin');
    } else {
      App.navigateTo('student');
    }
  }
};

window.Results = Results;

