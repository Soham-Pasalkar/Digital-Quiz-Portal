/**
 * Digital Quiz Portal - Administrative Interface Controller
 * [Category A]: Quiz authoring, 4 options, publishing lifecycle, scores reporting table (STQA §1, Page 8)
 * [Category B]: Analytics queries, empty quiz rejection notice, immutability notifications
 */

const Admin = {
  activeQuizId: null,
  activeQuizAttempts: 0,
  quizAttemptsMap: {},
  quizzesMap: {},
  questionsMap: {},

  /**
   * Initialize and load Admin Dashboard view.
   */
  async init() {
    if (!Auth.isAdmin()) {
      App.navigateTo('login');
      return;
    }

    Utils.clearAlert('admin-alert-container');

    const greetEl = document.getElementById('admin-greeting-text');
    if (greetEl) {
      greetEl.textContent = Utils.getGreeting('Admin');
    }

    await Admin.loadAnalyticsOverview();
    await Admin.loadQuizzes();
    await Admin.loadAnalyticsTables();
  },

  /**
   * Scroll smoothly to a designated section in Admin workspace and update active sidebar link.
   * @param {string} sectionId
   */
  scrollToSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(sectionId)) {
        item.classList.add('active');
      }
    });
  },

  /**
   * Load top overview metrics and render outcomes donut chart.
   */
  async loadAnalyticsOverview() {
    try {
      const res = await API.get('/api/admin/analytics/overview');
      if (res && res.overview) {
        const o = res.overview;
        document.getElementById('stat-total-students').textContent = o.totalStudents;
        document.getElementById('stat-total-quizzes').textContent = o.totalQuizzes;
        document.getElementById('stat-published-quizzes').textContent = o.publishedQuizzes;
        document.getElementById('stat-total-submissions').textContent = o.totalSubmissions;
        document.getElementById('stat-pass-rate').textContent = `${o.passPercentage}%`;
        document.getElementById('stat-avg-score').textContent = o.averageScore;

        // Render Native SVG Donut Chart for Results Distribution
        Utils.renderDonutChart('chart-results-donut', {
          passCount: o.passCount,
          failCount: o.failCount,
          total: o.totalSubmissions
        });
      }
    } catch (e) {
      console.error('[Admin] Failed to load overview analytics:', e);
    }
  },

  /**
   * Load and render list of quizzes for management.
   */
  async loadQuizzes() {
    const tbody = document.getElementById('admin-quizzes-tbody');
    if (!tbody) return;

    try {
      // First fetch quiz analytics to know which quizzes have attempts (immutability status)
      const analyticsRes = await API.get('/api/admin/analytics/quizzes');
      Admin.quizAttemptsMap = {};
      if (analyticsRes && analyticsRes.quizzes) {
        analyticsRes.quizzes.forEach(q => {
          Admin.quizAttemptsMap[q.quizId] = q.totalAttempts;
        });
      }

      const res = await API.get('/api/quizzes');
      const quizzes = (res && res.quizzes) ? res.quizzes : [];

      Admin.quizzesMap = {};
      quizzes.forEach(q => {
        Admin.quizzesMap[q.id] = q;
      });

      if (quizzes.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-muted" style="text-align: center; padding: 2rem;">
              No quizzes created yet. Click "Create New Quiz" to author your first assessment.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = quizzes.map(q => {
        const attempts = Admin.quizAttemptsMap[q.id] || 0;
        const isLocked = attempts > 0;
        const isPub = q.is_published === 1;

        const statusBadge = isPub
          ? `<span class="badge badge-published">Published</span>`
          : `<span class="badge badge-draft">Draft</span>`;

        const lockBadge = isLocked
          ? `<span class="badge badge-locked" title="Exam attempts exist. Question & scoring configuration locked for integrity.">Locked (${attempts})</span>`
          : '';

        return `
          <tr>
            <td>
              <strong>${Utils.escapeHTML(q.title)}</strong>
              ${lockBadge ? `<div style="margin-top: 0.2rem;">${lockBadge}</div>` : ''}
            </td>
            <td>${q.duration_minutes} mins</td>
            <td>${q.question_count || 0}</td>
            <td>${statusBadge}</td>
            <td>${Utils.formatDate(q.created_at)}</td>
            <td>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm" onclick="Admin.openQuestionsModal(${q.id})">
                  Questions
                </button>
                <button class="btn btn-secondary btn-sm" onclick="Admin.openEditQuizModal(${q.id})">
                  Edit
                </button>
                ${isPub
                  ? `<button class="btn btn-secondary btn-sm" onclick="Admin.unpublishQuiz(${q.id})">Unpublish</button>`
                  : `<button class="btn btn-outline btn-sm" onclick="Admin.publishQuiz(${q.id})">Publish</button>`
                }
                <button class="btn btn-danger-outline btn-sm" ${isLocked ? 'disabled title="Cannot delete quiz with recorded attempts"' : ''} onclick="Admin.deleteQuiz(${q.id})">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error('[Admin] Failed to load quizzes:', e);
      Utils.showAlert('admin-alert-container', `Failed to load quizzes: ${e.message}`, 'danger');
    }
  },

  /**
   * Load quiz performance, recent student submissions tables, and visual charts.
   */
  async loadAnalyticsTables() {
    // 1. Quiz-wise performance table & Chart
    const quizTbody = document.getElementById('admin-quiz-perf-tbody');
    if (quizTbody) {
      try {
        const res = await API.get('/api/admin/analytics/quizzes');
        const quizzes = (res && res.quizzes) ? res.quizzes : [];

        // Render Native SVG Quiz Bars Comparison
        Utils.renderQuizBars('chart-quiz-bars', quizzes);

        if (quizzes.length === 0) {
          quizTbody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align: center;">No assessment data available.</td></tr>`;
        } else {
          quizTbody.innerHTML = quizzes.map(q => `
            <tr>
              <td><strong>${Utils.escapeHTML(q.title)}</strong></td>
              <td>${q.isPublished ? '<span class="badge badge-published">Live</span>' : '<span class="badge badge-draft">Draft</span>'}</td>
              <td>${q.totalAttempts}</td>
              <td>${q.avgScore}</td>
              <td>${q.avgPercentage}%</td>
              <td>${q.passCount} / ${q.totalAttempts}</td>
              <td><strong>${q.passRate}%</strong></td>
            </tr>
          `).join('');
        }
      } catch (e) {
        console.error('[Admin] Quiz performance load failed:', e);
      }
    }

    // 2. Student submissions audit table & Grade Bands Chart
    const subTbody = document.getElementById('admin-submissions-tbody');
    if (subTbody) {
      try {
        const res = await API.get('/api/admin/analytics/submissions');
        const submissions = (res && res.submissions) ? res.submissions : [];

        // Render Native SVG Grade Bands Distribution
        Utils.renderGradeBands('chart-grade-bands', submissions);

        if (submissions.length === 0) {
          subTbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align: center;">No student examination records submitted yet.</td></tr>`;
        } else {
          subTbody.innerHTML = submissions.map(s => {
            const isPassed = s.status === 'PASSED';
            const statusBadge = isPassed
              ? `<span class="badge badge-passed">PASSED</span>`
              : `<span class="badge badge-failed">FAILED</span>`;
            const timeoutBadge = s.is_timed_out === 1
              ? ` <span class="badge badge-timeout" title="Submitted during 30s grace period">Timed Out</span>`
              : '';

            return `
              <tr>
                <td class="font-mono">#${s.id}</td>
                <td><strong>${Utils.escapeHTML(s.student)}</strong></td>
                <td>${Utils.escapeHTML(s.quiz_title)}</td>
                <td><strong>${s.score}</strong> / ${s.total_questions}</td>
                <td>${s.percentage}%</td>
                <td>${statusBadge}${timeoutBadge}</td>
                <td>${Utils.formatDate(s.submission_time)}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="Admin.viewSubmissionDetails(${s.id})">
                    View
                  </button>
                </td>
              </tr>
            `;
          }).join('');
        }
      } catch (e) {
        console.error('[Admin] Submissions table load failed:', e);
      }
    }
  },

  /**
   * Open modal to create a new quiz.
   */
  openCreateQuizModal() {
    document.getElementById('create-quiz-form').reset();
    Utils.clearAlert('create-quiz-error');
    Utils.showModal('modal-create-quiz');
  },

  /**
   * Submit new quiz creation form.
   */
  async handleCreateQuizSubmit(event) {
    event.preventDefault();
    const title = document.getElementById('new-quiz-title').value.trim();
    const duration = parseInt(document.getElementById('new-quiz-duration').value, 10);

    if (!title) {
      Utils.showAlert('create-quiz-error', 'Quiz title is required.', 'danger');
      return;
    }

    try {
      await API.post('/api/quizzes', { title, durationMinutes: duration });
      Utils.hideModal('modal-create-quiz');
      await Admin.loadQuizzes();
      await Admin.loadAnalyticsOverview();
    } catch (e) {
      Utils.showAlert('create-quiz-error', e.message, 'danger');
    }
  },

  /**
   * Open modal to edit existing quiz title/duration.
   * @param {number} quizId
   */
  openEditQuizModal(quizId) {
    const q = Admin.quizzesMap[quizId];
    if (!q) return;

    const attemptsCount = Admin.quizAttemptsMap[quizId] || 0;
    document.getElementById('edit-quiz-id').value = q.id;
    document.getElementById('edit-quiz-title').value = q.title;
    const durInput = document.getElementById('edit-quiz-duration');
    durInput.value = q.duration_minutes || q.durationMinutes || 10;

    const notice = document.getElementById('edit-quiz-immutable-notice');
    if (attemptsCount > 0) {
      durInput.disabled = true;
      notice.textContent = 'Note: Examination attempts exist for this quiz. Duration and scoring configuration cannot be modified.';
      notice.classList.remove('hidden');
    } else {
      durInput.disabled = false;
      notice.classList.add('hidden');
    }

    Utils.clearAlert('edit-quiz-error');
    Utils.showModal('modal-edit-quiz');
  },

  /**
   * Save quiz modifications.
   */
  async handleEditQuizSubmit(event) {
    event.preventDefault();
    const quizId = document.getElementById('edit-quiz-id').value;
    const title = document.getElementById('edit-quiz-title').value.trim();
    const durationMinutes = parseInt(document.getElementById('edit-quiz-duration').value, 10);

    try {
      await API.put(`/api/quizzes/${quizId}`, { title, durationMinutes });
      Utils.hideModal('modal-edit-quiz');
      await Admin.loadQuizzes();
    } catch (e) {
      Utils.showAlert('edit-quiz-error', e.message, 'danger');
    }
  },

  /**
   * Delete quiz confirmation and API call.
   */
  async deleteQuiz(quizId) {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await API.delete(`/api/quizzes/${quizId}`);
      await Admin.loadQuizzes();
      await Admin.loadAnalyticsOverview();
    } catch (e) {
      alert(`Deletion failed: ${e.message}`);
    }
  },

  /**
   * Publish a quiz (validating that questions exist).
   */
  async publishQuiz(quizId) {
    try {
      await API.post(`/api/quizzes/${quizId}/publish`);
      await Admin.loadQuizzes();
      await Admin.loadAnalyticsOverview();
    } catch (e) {
      Utils.showAlert('admin-alert-container', `Cannot publish quiz: ${e.message}`, 'danger');
    }
  },

  /**
   * Unpublish a quiz.
   */
  async unpublishQuiz(quizId) {
    try {
      await API.post(`/api/quizzes/${quizId}/unpublish`);
      await Admin.loadQuizzes();
      await Admin.loadAnalyticsOverview();
    } catch (e) {
      alert(`Unpublish failed: ${e.message}`);
    }
  },

  /**
   * Open questions management modal for a quiz.
   * @param {number} quizId
   */
  async openQuestionsModal(quizId) {
    const q = Admin.quizzesMap[quizId];
    const quizTitle = q ? q.title : '';
    const attemptsCount = Admin.quizAttemptsMap[quizId] || 0;

    Admin.activeQuizId = quizId;
    Admin.activeQuizAttempts = attemptsCount;

    document.getElementById('qm-modal-title').textContent = `Manage Questions: ${quizTitle}`;
    const addBtn = document.getElementById('qm-add-question-btn');
    const lockNotice = document.getElementById('qm-immutable-notice');

    if (attemptsCount > 0) {
      addBtn.disabled = true;
      lockNotice.textContent = 'This quiz has recorded examination attempts. Question content and options are locked for academic grading integrity.';
      lockNotice.classList.remove('hidden');
    } else {
      addBtn.disabled = false;
      lockNotice.classList.add('hidden');
    }

    await Admin.refreshQuestionsList(quizId);
    Utils.showModal('modal-questions-manager');
  },

  /**
   * Refresh question list in manager modal.
   * @param {number} quizId
   */
  async refreshQuestionsList(quizId) {
    const container = document.getElementById('qm-questions-list');
    container.innerHTML = `<p class="text-muted">Loading questions...</p>`;

    try {
      const res = await API.get(`/api/quizzes/${quizId}`);
      const questions = (res && res.quiz && res.quiz.questions) ? res.quiz.questions : [];

      Admin.questionsMap = {};
      questions.forEach(qn => {
        Admin.questionsMap[qn.id] = qn;
      });

      if (questions.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem;" class="text-muted">
            No questions added to this quiz yet.<br>Click "+ Add Question" above to begin.
          </div>
        `;
        return;
      }

      const isLocked = Admin.activeQuizAttempts > 0;

      container.innerHTML = questions.map((q, idx) => {
        const optA = q.options ? q.options[0] : (q.option_a || '');
        const optB = q.options ? q.options[1] : (q.option_b || '');
        const optC = q.options ? q.options[2] : (q.option_c || '');
        const optD = q.options ? q.options[3] : (q.option_d || '');
        const correctOpt = q.correctOption !== undefined ? q.correctOption : q.correct_option;

        return `
          <div class="card" style="margin-bottom: 1rem; padding: 1.15rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
              <strong style="font-size: 1rem;">Q${idx + 1}. ${Utils.escapeHTML(q.questionText || q.question_text)}</strong>
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn btn-secondary btn-sm" ${isLocked ? 'disabled' : ''} onclick="Admin.openEditQuestionModal(${q.id})">Edit</button>
                <button class="btn btn-danger-outline btn-sm" ${isLocked ? 'disabled' : ''} onclick="Admin.deleteQuestion(${q.id})">Delete</button>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; font-size: 0.875rem;">
              <div style="${correctOpt === 0 ? 'font-weight: 600; color: var(--color-success);' : ''}">
                A: ${Utils.escapeHTML(optA)} ${correctOpt === 0 ? '✓ (Correct)' : ''}
              </div>
              <div style="${correctOpt === 1 ? 'font-weight: 600; color: var(--color-success);' : ''}">
                B: ${Utils.escapeHTML(optB)} ${correctOpt === 1 ? '✓ (Correct)' : ''}
              </div>
              <div style="${correctOpt === 2 ? 'font-weight: 600; color: var(--color-success);' : ''}">
                C: ${Utils.escapeHTML(optC)} ${correctOpt === 2 ? '✓ (Correct)' : ''}
              </div>
              <div style="${correctOpt === 3 ? 'font-weight: 600; color: var(--color-success);' : ''}">
                D: ${Utils.escapeHTML(optD)} ${correctOpt === 3 ? '✓ (Correct)' : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      container.replaceChildren();
      const errDiv = document.createElement('div');
      errDiv.className = 'alert alert-danger';
      errDiv.textContent = `Failed to load questions: ${e.message}`;
      container.appendChild(errDiv);
    }
  },

  /**
   * Open Add Question modal.
   */
  openAddQuestionModal() {
    document.getElementById('question-form').reset();
    document.getElementById('qform-id').value = '';
    document.getElementById('qform-modal-title').textContent = 'Add Question';
    Utils.clearAlert('question-form-error');
    Utils.showModal('modal-question-form');
  },

  /**
   * Open Edit Question modal.
   * @param {number} qId
   */
  openEditQuestionModal(qId) {
    const q = Admin.questionsMap[qId];
    if (!q) return;

    const optA = q.options ? q.options[0] : (q.option_a || '');
    const optB = q.options ? q.options[1] : (q.option_b || '');
    const optC = q.options ? q.options[2] : (q.option_c || '');
    const optD = q.options ? q.options[3] : (q.option_d || '');
    const correctOpt = q.correctOption !== undefined ? q.correctOption : q.correct_option;

    document.getElementById('qform-id').value = q.id;
    document.getElementById('qform-modal-title').textContent = 'Edit Question';
    document.getElementById('qform-text').value = q.questionText || q.question_text || '';
    document.getElementById('qform-opt-a').value = optA;
    document.getElementById('qform-opt-b').value = optB;
    document.getElementById('qform-opt-c').value = optC;
    document.getElementById('qform-opt-d').value = optD;
    document.getElementById('qform-correct').value = correctOpt;

    Utils.clearAlert('question-form-error');
    Utils.showModal('modal-question-form');
  },

  /**
   * Save Question (either Add or Edit).
   */
  async handleQuestionFormSubmit(event) {
    event.preventDefault();
    const qId = document.getElementById('qform-id').value;
    const text = document.getElementById('qform-text').value.trim();
    const a = document.getElementById('qform-opt-a').value.trim();
    const b = document.getElementById('qform-opt-b').value.trim();
    const c = document.getElementById('qform-opt-c').value.trim();
    const d = document.getElementById('qform-opt-d').value.trim();
    const correctOption = parseInt(document.getElementById('qform-correct').value, 10);

    if (!text || !a || !b || !c || !d) {
      Utils.showAlert('question-form-error', 'Question text and all four options are required.', 'danger');
      return;
    }

    try {
      if (qId) {
        // Edit existing
        await API.put(`/api/questions/${qId}`, {
          questionText: text,
          options: [a, b, c, d],
          correctOption
        });
      } else {
        // Add new
        await API.post(`/api/quizzes/${Admin.activeQuizId}/questions`, {
          questionText: text,
          options: [a, b, c, d],
          correctOption
        });
      }

      Utils.hideModal('modal-question-form');
      await Admin.refreshQuestionsList(Admin.activeQuizId);
      await Admin.loadQuizzes();
    } catch (e) {
      Utils.showAlert('question-form-error', e.message, 'danger');
    }
  },

  /**
   * Delete a question.
   */
  async deleteQuestion(questionId) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await API.delete(`/api/questions/${questionId}`);
      await Admin.refreshQuestionsList(Admin.activeQuizId);
      await Admin.loadQuizzes();
    } catch (e) {
      alert(`Deletion failed: ${e.message}`);
    }
  },

  /**
   * Switch between Assessment Analytics and Student Submissions tabs.
   * @param {'perf'|'subs'} tab
   */
  switchTab(tab) {
    const btnPerf = document.getElementById('tab-btn-perf');
    const btnSubs = document.getElementById('tab-btn-subs');
    const panePerf = document.getElementById('tab-pane-perf');
    const paneSubs = document.getElementById('tab-pane-subs');

    if (btnPerf) btnPerf.classList.toggle('active', tab === 'perf');
    if (btnSubs) btnSubs.classList.toggle('active', tab === 'subs');
    if (panePerf) panePerf.classList.toggle('hidden', tab !== 'perf');
    if (paneSubs) paneSubs.classList.toggle('hidden', tab !== 'subs');
  },

  /**
   * View details of a specific submission in modal.
   */
  async viewSubmissionDetails(submissionId) {
    try {
      const res = await API.get('/api/admin/analytics/submissions');
      const sub = (res && res.submissions) ? res.submissions.find(s => s.id === submissionId) : null;
      if (!sub) return;

      const titleEl = document.getElementById('modal-submission-detail-title');
      const bodyEl = document.getElementById('modal-submission-detail-body');

      if (titleEl) {
        titleEl.textContent = `Submission Audit #${sub.id} — ${sub.student}`;
      }

      if (bodyEl) {
        const isPassed = sub.status === 'PASSED';
        const statusBadge = isPassed
          ? `<span class="badge badge-passed">PASSED</span>`
          : `<span class="badge badge-failed">FAILED</span>`;
        const timeoutBadge = sub.is_timed_out === 1
          ? ` <span class="badge badge-timeout" title="Submitted during 30s grace window">Grace Period Submission</span>`
          : '';

        bodyEl.innerHTML = `
          <div style="background-color: var(--bg-surface-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 1.25rem; margin-bottom: 1rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.9rem;">
              <div><span class="text-muted">Student Account:</span> <strong>${Utils.escapeHTML(sub.student)}</strong></div>
              <div><span class="text-muted">Examination:</span> <strong>${Utils.escapeHTML(sub.quiz_title)}</strong></div>
              <div><span class="text-muted">Final Score:</span> <strong>${sub.score} / ${sub.total_questions}</strong></div>
              <div><span class="text-muted">Academic Grade:</span> <strong>${sub.percentage}%</strong></div>
              <div><span class="text-muted">Assessment Result:</span> ${statusBadge}${timeoutBadge}</div>
              <div><span class="text-muted">Submission Time:</span> ${Utils.formatDate(sub.submission_time)}</div>
            </div>
          </div>
          <p class="text-muted" style="font-size: 0.85rem; margin: 0;">
            This audit record was finalized by the deterministic server grading engine.
          </p>
        `;
      }

      Utils.showModal('modal-submission-detail');
    } catch (e) {
      alert(`Error loading details: ${e.message}`);
    }
  }
};

window.Admin = Admin;
