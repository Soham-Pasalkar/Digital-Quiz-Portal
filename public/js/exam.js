/**
 * Digital Quiz Portal - Examination Interface & Timer Controller
 * [Category A]: Test-taking interface, 1 question at a time, A-D selection (STQA §1, Page 3)
 * [Category B]: Server-derived countdown timer, refresh resilience, auto-submit on expiry,
 *               30-second grace period handling, idempotent submission
 */

const Exam = {
  attemptId: null,
  quizId: null,
  quizTitle: '',
  expiresAt: null,
  questions: [],
  currentIndex: 0,
  answers: {}, // questionId -> selectedOption index (0..3, or -1)
  timerInterval: null,
  isSubmitting: false,

  STORAGE_KEY: 'active_exam_session',

  /**
   * Initialize exam view (called on routing to #exam or page reload).
   */
  async init() {
    if (!Auth.isStudent()) {
      App.navigateTo('login');
      return;
    }

    Utils.clearAlert('exam-alert-container');

    // Try to restore from sessionStorage
    const saved = Exam.getSavedSession();
    if (saved && saved.attemptId) {
      Exam.attemptId = saved.attemptId;
      Exam.quizId = saved.quizId;
      Exam.quizTitle = saved.quizTitle || 'Academic Examination';
      Exam.expiresAt = saved.expiresAt;
      Exam.answers = saved.answers || {};
      Exam.currentIndex = saved.currentIndex || 0;

      // Check if already expired well past grace period (> 40s past expiry)
      const msRemaining = new Date(Exam.expiresAt).getTime() - Date.now();
      if (msRemaining < -35000) {
        sessionStorage.removeItem(Exam.STORAGE_KEY);
        Utils.showAlert('student-alert-container', 'Your previous examination session expired.', 'warning');
        App.navigateTo('student');
        return;
      }

      await Exam.loadQuestionsAndStart();
    } else {
      // No active exam in progress
      App.navigateTo('student');
    }
  },

  /**
   * Start a new exam attempt or resume an existing active attempt.
   * @param {number} quizId
   */
  async start(quizId) {
    Exam.isSubmitting = false;
    Exam.answers = {};
    Exam.currentIndex = 0;

    // 1. Create or resume attempt via backend
    const attemptRes = await API.post(`/api/quizzes/${quizId}/attempts`, {});
    if (!attemptRes || (!attemptRes.attemptId && !attemptRes.attempt)) {
      throw new Error('Failed to initialize examination attempt.');
    }

    Exam.attemptId = attemptRes.attemptId || attemptRes.attempt.id;
    Exam.quizId = attemptRes.quizId || quizId;
    Exam.quizTitle = attemptRes.quizTitle || (attemptRes.attempt && attemptRes.attempt.quiz_title) || 'Academic Examination';
    Exam.expiresAt = attemptRes.expiresAt || (attemptRes.attempt && attemptRes.attempt.expires_at);

    // 2. Persist initial exam state in sessionStorage
    Exam.saveSession();

    // 3. Navigate to exam view and start
    App.navigateTo('exam');
  },

  /**
   * Fetch questions for the active attempt and start the exam session.
   */
  async loadQuestionsAndStart() {
    try {
      const qRes = await API.get(`/api/attempts/${Exam.attemptId}/questions`);
      Exam.questions = (qRes && qRes.questions) ? qRes.questions : [];

      if (Exam.questions.length === 0) {
        throw new Error('This examination does not contain any questions.');
      }

      // Set header quiz title
      const titleEl = document.getElementById('exam-quiz-title-display');
      if (titleEl) {
        titleEl.textContent = Exam.quizTitle;
      }

      // Start countdown timer
      Exam.startTimer();

      // Render navigation palette and initial question
      Exam.renderNavPalette();
      Exam.renderQuestion();
    } catch (e) {
      console.error('[Exam] Failed to load examination questions:', e);
      Utils.showAlert('exam-alert-container', `Error loading examination: ${e.message}`, 'danger');
    }
  },

  /**
   * Start server-derived countdown timer.
   */
  startTimer() {
    if (Exam.timerInterval) {
      clearInterval(Exam.timerInterval);
    }

    Exam.tickTimer();
    Exam.timerInterval = setInterval(() => {
      Exam.tickTimer();
    }, 1000);
  },

  /**
   * Timer tick evaluated against server-provided expiresAt.
   */
  tickTimer() {
    if (!Exam.expiresAt) return;

    const expiresTime = new Date(Exam.expiresAt).getTime();
    const nowTime = Date.now();
    const remainingMs = expiresTime - nowTime;
    const remainingSec = Math.floor(remainingMs / 1000);

    const timerBox = document.getElementById('exam-timer-box');
    const timerDisplay = document.getElementById('exam-timer-display');

    if (remainingSec <= 0) {
      // Expiry reached
      if (timerDisplay) timerDisplay.textContent = '00:00';
      if (timerBox) timerBox.classList.add('timer-warning');

      if (Exam.timerInterval) {
        clearInterval(Exam.timerInterval);
        Exam.timerInterval = null;
      }

      // Inform student and trigger auto-submission
      Utils.showAlert(
        'exam-alert-container',
        'Official examination time has expired. Submitting answers to server within the grace window...',
        'warning'
      );
      Exam.submitExam(true);
      return;
    }

    if (timerDisplay) {
      timerDisplay.textContent = Utils.formatTimer(remainingSec);
    }

    // Urgency styling when under 120 seconds (2 minutes)
    if (remainingSec < 120) {
      if (timerBox) timerBox.classList.add('timer-warning');
    } else {
      if (timerBox) timerBox.classList.remove('timer-warning');
    }
  },

  /**
   * Render question navigation palette (pill buttons 1..N) safely via DOM API.
   * [Category C Security]: No innerHTML or string event handler evaluation.
   */
  renderNavPalette() {
    const palette = document.getElementById('exam-nav-palette');
    if (!palette) return;

    palette.replaceChildren();
    Exam.questions.forEach((q, idx) => {
      const isCurrent = idx === Exam.currentIndex;
      const isAnswered = Exam.answers[q.id] !== undefined && Exam.answers[q.id] !== -1;

      const btn = document.createElement('button');
      btn.type = 'button';
      let classes = 'nav-pill';
      if (isCurrent) classes += ' current';
      if (isAnswered) classes += ' answered';
      btn.className = classes;
      btn.title = `Question ${idx + 1}${isAnswered ? ' (Answered)' : ' (Unattempted)'}`;
      btn.textContent = String(idx + 1);
      btn.addEventListener('click', () => Exam.goToQuestion(idx));

      palette.appendChild(btn);
    });
  },

  /**
   * Render the currently selected question (single-question presentation).
   * Uses safe textContent to prevent XSS.
   */
  renderQuestion() {
    if (Exam.currentIndex < 0 || Exam.currentIndex >= Exam.questions.length) {
      Exam.currentIndex = 0;
    }

    const q = Exam.questions[Exam.currentIndex];
    if (!q) return;

    // 1. Update meta progress & progress bar
    const metaEl = document.getElementById('exam-question-meta');
    if (metaEl) {
      metaEl.textContent = `Question ${Exam.currentIndex + 1} of ${Exam.questions.length}`;
    }
    const progressBar = document.getElementById('exam-progress-bar');
    if (progressBar && Exam.questions.length > 0) {
      const pct = ((Exam.currentIndex + 1) / Exam.questions.length) * 100;
      progressBar.style.width = `${pct}%`;
    }

    // 2. Update question text safely via textContent
    const textEl = document.getElementById('exam-question-text');
    if (textEl) {
      textEl.textContent = q.questionText || q.question_text || '';
    }

    // 3. Render 4 option choices (A, B, C, D) safely via DOM construction
    const optionsContainer = document.getElementById('exam-options-container');
    if (optionsContainer) {
      optionsContainer.replaceChildren();

      const optA = q.options ? q.options[0] : (q.option_a || '');
      const optB = q.options ? q.options[1] : (q.option_b || '');
      const optC = q.options ? q.options[2] : (q.option_c || '');
      const optD = q.options ? q.options[3] : (q.option_d || '');

      const options = [
        { index: 0, letter: 'A', text: optA },
        { index: 1, letter: 'B', text: optB },
        { index: 2, letter: 'C', text: optC },
        { index: 3, letter: 'D', text: optD }
      ];

      const currentSelected = Exam.answers[q.id];

      options.forEach(opt => {
        const isSelected = currentSelected === opt.index;

        const choiceDiv = document.createElement('div');
        choiceDiv.className = `option-choice ${isSelected ? 'selected' : ''}`;
        choiceDiv.setAttribute('role', 'radio');
        choiceDiv.setAttribute('aria-checked', isSelected ? 'true' : 'false');
        choiceDiv.tabIndex = 0;

        const badge = document.createElement('div');
        badge.className = 'option-letter option-letter-badge';
        badge.textContent = opt.letter;

        const textDiv = document.createElement('div');
        textDiv.className = 'option-choice-text';
        textDiv.textContent = opt.text;

        choiceDiv.appendChild(badge);
        choiceDiv.appendChild(textDiv);

        choiceDiv.addEventListener('click', () => Exam.selectOption(q.id, opt.index));
        choiceDiv.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            Exam.selectOption(q.id, opt.index);
          }
        });

        optionsContainer.appendChild(choiceDiv);
      });
    }

    // 4. Update Previous / Next / Submit buttons
    const prevBtn = document.getElementById('exam-btn-prev');
    const nextBtn = document.getElementById('exam-btn-next');
    const clearBtn = document.getElementById('exam-btn-clear');

    if (prevBtn) {
      prevBtn.disabled = Exam.currentIndex === 0;
    }

    if (nextBtn) {
      const isLast = Exam.currentIndex === Exam.questions.length - 1;
      nextBtn.textContent = isLast ? 'Review & Submit \u2192' : 'Next \u2192';
    }

    if (clearBtn) {
      const hasAnswer = Exam.answers[q.id] !== undefined && Exam.answers[q.id] !== -1;
      clearBtn.style.visibility = hasAnswer ? 'visible' : 'hidden';
    }

    // Refresh nav palette styling for current pill
    Exam.renderNavPalette();
  },

  /**
   * Handle student selecting an option (0..3).
   * @param {number} questionId
   * @param {number} optionIndex
   */
  selectOption(questionId, optionIndex) {
    Exam.answers[questionId] = optionIndex;
    Exam.saveSession();
    Exam.renderQuestion();
  },

  /**
   * Clear selection for the current question.
   */
  clearSelection() {
    const q = Exam.questions[Exam.currentIndex];
    if (!q) return;
    delete Exam.answers[q.id];
    Exam.saveSession();
    Exam.renderQuestion();
  },

  /**
   * Navigate to previous question.
   */
  prevQuestion() {
    if (Exam.currentIndex > 0) {
      Exam.currentIndex--;
      Exam.saveSession();
      Exam.renderQuestion();
    }
  },

  /**
   * Navigate to next question, or open submission confirmation if on last.
   */
  nextQuestion() {
    if (Exam.currentIndex < Exam.questions.length - 1) {
      Exam.currentIndex++;
      Exam.saveSession();
      Exam.renderQuestion();
    } else {
      Exam.openSubmitConfirmation();
    }
  },

  /**
   * Jump directly to a question by index.
   * @param {number} index
   */
  goToQuestion(index) {
    if (index >= 0 && index < Exam.questions.length) {
      Exam.currentIndex = index;
      Exam.saveSession();
      Exam.renderQuestion();
    }
  },

  /**
   * Open the submit exam confirmation dialog.
   */
  openSubmitConfirmation() {
    const total = Exam.questions.length;
    let answered = 0;
    Exam.questions.forEach(q => {
      if (Exam.answers[q.id] !== undefined && Exam.answers[q.id] !== -1) {
        answered++;
      }
    });
    const unanswered = total - answered;

    const totalEl = document.getElementById('submit-modal-total');
    const answeredEl = document.getElementById('submit-modal-answered');
    const unansweredEl = document.getElementById('submit-modal-unanswered');
    const warningEl = document.getElementById('submit-modal-warning');

    if (totalEl) totalEl.textContent = total;
    if (answeredEl) answeredEl.textContent = answered;
    if (unansweredEl) unansweredEl.textContent = unanswered;

    if (warningEl) {
      if (unanswered > 0) {
        warningEl.textContent = `Warning: You have ${unanswered} unattempted question(s). Unattempted questions receive zero marks.`;
        warningEl.classList.remove('hidden');
      } else {
        warningEl.classList.add('hidden');
      }
    }

    Utils.clearAlert('submit-modal-error');
    Utils.showModal('modal-submit-exam');
  },

  /**
   * Execute submission of the examination.
   * @param {boolean} [isAuto=false]
   */
  async submitExam(isAuto = false) {
    if (Exam.isSubmitting) return;
    Exam.isSubmitting = true;

    if (Exam.timerInterval) {
      clearInterval(Exam.timerInterval);
      Exam.timerInterval = null;
    }

    const submitConfirmBtn = document.getElementById('btn-confirm-submit');
    if (submitConfirmBtn) {
      submitConfirmBtn.disabled = true;
      submitConfirmBtn.textContent = 'Submitting & Grading...';
    }

    // Build answer payload
    const formattedAnswers = Exam.questions.map(q => ({
      questionId: q.id,
      selectedOption: (Exam.answers[q.id] !== undefined ? Exam.answers[q.id] : -1)
    }));

    try {
      const res = await API.post(`/api/attempts/${Exam.attemptId}/submit`, {
        answers: formattedAnswers
      });

      // Clear session persistence
      sessionStorage.removeItem(Exam.STORAGE_KEY);
      Utils.hideModal('modal-submit-exam');

      // Display results view
      const sub = (res && res.submission) ? res.submission : res;
      if (sub && (sub.score !== undefined || sub.breakdown)) {
        Results.display(sub);
        App.navigateTo('results');
      } else {
        App.navigateTo('student');
      }
    } catch (e) {
      console.error('[Exam] Submission failed:', e);
      Exam.isSubmitting = false;
      if (submitConfirmBtn) {
        submitConfirmBtn.disabled = false;
        submitConfirmBtn.textContent = 'Confirm & Submit Exam';
      }

      if (isAuto) {
        Utils.showAlert('exam-alert-container', `Submission error: ${e.message}. Please click Submit Exam manually.`, 'danger');
      } else {
        Utils.showAlert('submit-modal-error', e.message, 'danger');
      }
    }
  },

  /**
   * Save active exam state to sessionStorage for refresh survival.
   */
  saveSession() {
    try {
      const state = {
        attemptId: Exam.attemptId,
        quizId: Exam.quizId,
        quizTitle: Exam.quizTitle,
        expiresAt: Exam.expiresAt,
        answers: Exam.answers,
        currentIndex: Exam.currentIndex
      };
      sessionStorage.setItem(Exam.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Exam] Storage save failed:', e);
    }
  },

  /**
   * Retrieve saved exam session from sessionStorage.
   * @returns {Object|null}
   */
  getSavedSession() {
    try {
      const str = sessionStorage.getItem(Exam.STORAGE_KEY);
      return str ? JSON.parse(str) : null;
    } catch {
      return null;
    }
  }
};

window.Exam = Exam;
