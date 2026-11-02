/**
 * Digital Quiz Portal - Shared Utility Functions & Native SVG Chart Engine
 * [Category A & C]: Safe DOM rendering, XSS prevention, date/timer formatting
 * [UI Redesign]: Lightweight native SVG charting engine (Zero external chart libraries)
 */

const Utils = {
  /**
   * Safely escapes string to prevent HTML/XSS injection.
   * @param {string|null|undefined} str
   * @returns {string} Escaped HTML string
   */
  escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * Format ISO date string into readable academic format: YYYY-MM-DD HH:mm:ss
   * @param {string} isoString
   * @returns {string}
   */
  formatDate(isoString) {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const pad = (n) => String(n).padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const mins = pad(d.getMinutes());
      const secs = pad(d.getSeconds());
      return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
    } catch {
      return isoString;
    }
  },

  /**
   * Format short date string: e.g. Oct 16, 10:05
   * @param {string} isoString
   * @returns {string}
   */
  formatShortDate(isoString) {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const pad = (n) => String(n).padStart(2, '0');
      return `${months[d.getMonth()]} ${d.getDate()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return isoString;
    }
  },

  /**
   * Formats remaining seconds as MM:SS.
   * @param {number} totalSeconds
   * @returns {string}
   */
  formatTimer(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  /**
   * Returns a time-of-day greeting: "Good morning", "Good afternoon", or "Good evening".
   * @param {string} name
   * @returns {string}
   */
  getGreeting(name) {
    const hour = new Date().getHours();
    let prefix = 'Good morning';
    if (hour >= 12 && hour < 17) {
      prefix = 'Good afternoon';
    } else if (hour >= 17) {
      prefix = 'Good evening';
    }
    return name ? `${prefix}, ${name}` : prefix;
  },

  /**
   * Convert zero-indexed option (0..3) to option letter (A..D).
   * @param {number|string} index
   * @returns {string}
   */
  indexToLetter(index) {
    const n = Number(index);
    switch (n) {
      case 0: return 'A';
      case 1: return 'B';
      case 2: return 'C';
      case 3: return 'D';
      default: return 'Unattempted';
    }
  },

  /**
   * Render an alert banner in a container element safely without innerHTML.
   * [Category C Security]: Safe textContent construction prevents DOM XSS.
   * @param {HTMLElement|string} container
   * @param {string} message
   * @param {'danger'|'warning'|'success'|'info'} type
   */
  showAlert(container, message, type = 'danger') {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.replaceChildren();

    const alertDiv = document.createElement('div');
    const safeType = ['danger', 'warning', 'success', 'info'].includes(type) ? type : 'danger';
    alertDiv.className = `alert alert-${safeType}`;
    alertDiv.setAttribute('role', 'alert');
    alertDiv.textContent = message || '';

    el.appendChild(alertDiv);
    el.classList.remove('hidden');
  },

  /**
   * Clear an alert container.
   * @param {HTMLElement|string} container
   */
  clearAlert(container) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    el.replaceChildren();
    el.classList.add('hidden');
  },

  /**
   * Show a modal dialog by element ID.
   * Sets scroll lock on body, handles focus management, and presents dialog.
   * @param {string} modalId
   */
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('modal-open');
      }
      const firstInput = modal.querySelector('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not(.modal-close-btn)');
      if (firstInput) {
        firstInput.focus();
      } else {
        const anyBtn = modal.querySelector('button');
        if (anyBtn) anyBtn.focus();
      }
    }
  },

  /**
   * Hide a modal dialog by element ID.
   * Releases body scroll lock when no modals remain visible.
   * @param {string} modalId
   */
  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      if (typeof document !== 'undefined' && document.body) {
        const remainingOpen = document.querySelectorAll('.modal-overlay:not(.hidden)');
        if (remainingOpen.length === 0) {
          document.body.classList.remove('modal-open');
        }
      }
    }
  },

  // =========================================================================
  // Native SVG Charting Engine (Pure Vanilla JS, Zero External Libraries)
  // Palette: Cream (#F3EBDD), Espresso (#33251E), Brown (#765239), Caramel (#B88A55), Gold (#D7B56D)
  // =========================================================================

  /**
   * Helper to create an SVG element with given namespace and attributes.
   * @param {string} tag
   * @param {Object} attrs
   * @returns {SVGElement}
   */
  createSVG(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  },

  /**
   * Renders a native SVG Donut Chart showing Passed vs Failed submissions.
   * @param {string} containerId
   * @param {{ passCount: number, failCount: number, total: number }} data
   */
  renderDonutChart(containerId, { passCount = 0, failCount = 0, total = 0 }) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.replaceChildren();

    if (total === 0) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <div class="empty-icon">📊</div>
          <p class="empty-title">No assessment submissions yet</p>
          <p class="empty-subtext">Submission distribution will appear here once students finalize tests.</p>
        </div>
      `;
      return;
    }

    const passPct = total > 0 ? ((passCount / total) * 100) : 0;
    const failPct = total > 0 ? ((failCount / total) * 100) : 0;

    const size = 180;
    const strokeWidth = 22;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    const passDash = (passPct / 100) * circumference;
    const failDash = (failPct / 100) * circumference;

    const svg = Utils.createSVG('svg', {
      viewBox: `0 0 ${size} ${size}`,
      class: 'donut-svg',
      width: '100%',
      height: '100%'
    });

    // Background track ring
    const bgRing = Utils.createSVG('circle', {
      cx: center,
      cy: center,
      r: radius,
      fill: 'none',
      stroke: '#EDE2D1',
      'stroke-width': strokeWidth
    });
    svg.appendChild(bgRing);

    // Failed arc (Terracotta #9C3E32)
    if (failDash > 0) {
      const failCircle = Utils.createSVG('circle', {
        cx: center,
        cy: center,
        r: radius,
        fill: 'none',
        stroke: '#9C3E32',
        'stroke-width': strokeWidth,
        'stroke-dasharray': `${failDash} ${circumference}`,
        'stroke-dashoffset': 0,
        transform: `rotate(-90 ${center} ${center})`,
        class: 'chart-arc'
      });
      svg.appendChild(failCircle);
    }

    // Passed arc (Warm Brown #765239)
    if (passDash > 0) {
      const passCircle = Utils.createSVG('circle', {
        cx: center,
        cy: center,
        r: radius,
        fill: 'none',
        stroke: '#765239',
        'stroke-width': strokeWidth,
        'stroke-dasharray': `${passDash} ${circumference}`,
        'stroke-dashoffset': `-${failDash}`,
        transform: `rotate(-90 ${center} ${center})`,
        class: 'chart-arc'
      });
      svg.appendChild(passCircle);
    }

    // Center total label
    const textTotal = Utils.createSVG('text', {
      x: center,
      y: center - 4,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      class: 'donut-center-total'
    });
    textTotal.textContent = String(total);
    svg.appendChild(textTotal);

    const textSub = Utils.createSVG('text', {
      x: center,
      y: center + 18,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      class: 'donut-center-label'
    });
    textSub.textContent = total === 1 ? 'Submission' : 'Submissions';
    svg.appendChild(textSub);

    // Legend container
    const legendDiv = document.createElement('div');
    legendDiv.className = 'chart-legend';
    legendDiv.innerHTML = `
      <div class="legend-item">
        <span class="legend-swatch swatch-passed"></span>
        <div class="legend-info">
          <span class="legend-title">Passed (&ge; 50%)</span>
          <span class="legend-metric"><strong>${passCount}</strong> (${passPct.toFixed(1)}%)</span>
        </div>
      </div>
      <div class="legend-item">
        <span class="legend-swatch swatch-failed"></span>
        <div class="legend-info">
          <span class="legend-title">Failed (&lt; 50%)</span>
          <span class="legend-metric"><strong>${failCount}</strong> (${failPct.toFixed(1)}%)</span>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'donut-layout';
    const svgWrap = document.createElement('div');
    svgWrap.className = 'donut-graphic-wrap';
    svgWrap.appendChild(svg);

    wrapper.appendChild(svgWrap);
    wrapper.appendChild(legendDiv);
    container.appendChild(wrapper);
  },

  /**
   * Renders a native SVG Horizontal Bar Chart for Quiz Performance Comparison.
   * @param {string} containerId
   * @param {Array<{ title: string, avgPercentage: number, passRate: number, totalAttempts: number }>} quizzes
   */
  renderQuizBars(containerId, quizzes = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.replaceChildren();

    if (!quizzes || quizzes.length === 0) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <div class="empty-icon">📈</div>
          <p class="empty-title">No quiz performance data</p>
          <p class="empty-subtext">Quiz comparison metrics will render once assessments have recorded attempts.</p>
        </div>
      `;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'quiz-bars-wrapper';

    quizzes.forEach(q => {
      const avg = Math.min(100, Math.max(0, Number(q.avgPercentage) || 0));
      const passRate = Math.min(100, Math.max(0, Number(q.passRate) || 0));
      const attempts = q.totalAttempts || 0;

      const item = document.createElement('div');
      item.className = 'quiz-bar-item';
      item.innerHTML = `
        <div class="quiz-bar-header">
          <span class="quiz-bar-title" title="${Utils.escapeHTML(q.title)}">${Utils.escapeHTML(q.title)}</span>
          <span class="quiz-bar-metrics">
            <span class="bar-tag">${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}</span>
            <strong>${avg.toFixed(1)}% Avg</strong>
            <span class="bar-pass-rate">(${passRate.toFixed(1)}% pass)</span>
          </span>
        </div>
        <div class="quiz-bar-track">
          <div class="quiz-bar-fill" style="width: ${avg}%;"></div>
          <div class="quiz-bar-threshold" title="50% Academic Pass Standard"></div>
        </div>
      `;
      wrapper.appendChild(item);
    });

    // Reference legend
    const note = document.createElement('div');
    note.className = 'chart-threshold-note';
    note.innerHTML = `<span class="threshold-line-indicator"></span> 50% Academic Passing Standard`;
    wrapper.appendChild(note);

    container.appendChild(wrapper);
  },

  /**
   * Renders a Cohort Grade Band Distribution Bar Chart.
   * Bands: Distinction (85-100%), Merit (70-84%), Pass (50-69%), Fail (<50%)
   * @param {string} containerId
   * @param {Array<Object>} submissions
   */
  renderGradeBands(containerId, submissions = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.replaceChildren();

    if (!submissions || submissions.length === 0) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <div class="empty-icon">🎯</div>
          <p class="empty-title">No grade distribution records</p>
          <p class="empty-subtext">Academic score bands will calculate automatically from submission results.</p>
        </div>
      `;
      return;
    }

    let fail = 0;
    let pass = 0;
    let merit = 0;
    let dist = 0;

    submissions.forEach(s => {
      const p = Number(s.percentage) || 0;
      if (p < 50) fail++;
      else if (p < 70) pass++;
      else if (p < 85) merit++;
      else dist++;
    });

    const total = submissions.length;
    const bands = [
      { label: 'Excellence (85-100%)', count: dist, color: '#765239' },
      { label: 'Merit (70-84%)', count: merit, color: '#B88A55' },
      { label: 'Pass (50-69%)', count: pass, color: '#D7B56D' },
      { label: 'Needs Improvement (<50%)', count: fail, color: '#9C3E32' }
    ];

    const wrapper = document.createElement('div');
    wrapper.className = 'grade-bands-wrapper';

    bands.forEach(b => {
      const pct = total > 0 ? (b.count / total) * 100 : 0;
      const row = document.createElement('div');
      row.className = 'grade-band-row';
      row.innerHTML = `
        <div class="grade-band-header">
          <span class="grade-band-label">${b.label}</span>
          <span class="grade-band-count"><strong>${b.count}</strong> (${pct.toFixed(1)}%)</span>
        </div>
        <div class="grade-band-track">
          <div class="grade-band-fill" style="width: ${pct}%; background-color: ${b.color};"></div>
        </div>
      `;
      wrapper.appendChild(row);
    });

    container.appendChild(wrapper);
  },

  /**
   * Renders a native SVG Score Progression Line Chart for student's past attempts.
   * @param {string} containerId
   * @param {Array<Object>} history
   */
  renderStudentProgression(containerId, history = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.replaceChildren();

    if (!history || history.length === 0) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <div class="empty-icon">📈</div>
          <p class="empty-title">No assessment history yet</p>
          <p class="empty-subtext">Your academic score trajectory across assessments will be visualized here.</p>
        </div>
      `;
      return;
    }

    // Sort chronologically ascending for progression
    const sorted = [...history].sort((a, b) => new Date(a.submission_time).getTime() - new Date(b.submission_time).getTime());

    const width = 500;
    const height = 180;
    const padX = 40;
    const padY = 25;
    const chartW = width - (padX * 2);
    const chartH = height - (padY * 2);

    const svg = Utils.createSVG('svg', {
      viewBox: `0 0 ${width} ${height}`,
      class: 'progression-svg',
      width: '100%',
      height: '100%'
    });

    // Grid lines for 0%, 50%, 100%
    [0, 50, 100].forEach(val => {
      const y = padY + chartH - ((val / 100) * chartH);
      const line = Utils.createSVG('line', {
        x1: padX,
        y1: y,
        x2: width - padX,
        y2: y,
        stroke: val === 50 ? '#D5C5B0' : '#EFE8DE',
        'stroke-width': val === 50 ? 1.5 : 1,
        'stroke-dasharray': val === 50 ? '4 3' : 'none'
      });
      svg.appendChild(line);

      const label = Utils.createSVG('text', {
        x: padX - 8,
        y: y + 3,
        'text-anchor': 'end',
        class: 'chart-axis-label'
      });
      label.textContent = `${val}%`;
      svg.appendChild(label);
    });

    // Compute coordinate points
    const points = sorted.map((item, idx) => {
      const x = sorted.length === 1
        ? width / 2
        : padX + (idx / (sorted.length - 1)) * chartW;
      const scorePct = Math.min(100, Math.max(0, Number(item.percentage) || 0));
      const y = padY + chartH - ((scorePct / 100) * chartH);
      return { x, y, scorePct, item };
    });

    // Connecting polyline (Warm Brown #765239)
    if (points.length > 1) {
      const pointsAttr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      const polyline = Utils.createSVG('polyline', {
        points: pointsAttr,
        fill: 'none',
        stroke: '#765239',
        'stroke-width': 2.5,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round'
      });
      svg.appendChild(polyline);
    }

    // Interactive circular dots and value badges
    points.forEach(p => {
      // Glow/border ring
      const dotBg = Utils.createSVG('circle', {
        cx: p.x,
        cy: p.y,
        r: 6,
        fill: '#FFFDF8',
        stroke: '#765239',
        'stroke-width': 2.5
      });
      svg.appendChild(dotBg);

      // Score text above point
      const scoreText = Utils.createSVG('text', {
        x: p.x,
        y: p.y - 10,
        'text-anchor': 'middle',
        class: 'progression-point-label'
      });
      scoreText.textContent = `${p.scorePct.toFixed(0)}%`;
      svg.appendChild(scoreText);
    });

    container.appendChild(svg);
  }
};

window.Utils = Utils;

// Attach global modal keyboard (Escape) and backdrop click listeners
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      const openModals = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)'));
      if (openModals.length > 0) {
        const topModal = openModals[openModals.length - 1];
        Utils.hideModal(topModal.id);
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('modal-overlay') && !e.target.classList.contains('hidden')) {
      Utils.hideModal(e.target.id);
    }
  });
}
