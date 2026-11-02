/**
 * Deterministic Automated Examination Scoring Domain Service
 * [Category A]: Exact mathematical formulations from STQA Report Page 1 Section 1
 *               f(Si, Ci) = 1 if Si == Ci, else 0.
 *               Score = sum of correct answers.
 *               Percentage = (Score / N) * 100.
 *               Pass threshold = 50.0%.
 * [Category B]: 0-indexed internal normalization, letters A-D feedback projection
 * [Category C]: Complete backend calculation; client calculations strictly distrusted
 */

const { PASS_THRESHOLD_PERCENT, ATTEMPT_STATUS } = require('../config/constants');

class ScoringService {
  /**
   * Normalize any input answer value into internal zero-indexed integer (-1..3).
   * Maps 'A'/'a' -> 0, 'B'/'b' -> 1, 'C'/'c' -> 2, 'D'/'d' -> 3.
   * Maps null, undefined, '', -1 -> -1 (unattempted).
   * 
   * @param {string|number|null|undefined} value
   * @returns {number} -1 for unattempted, or 0, 1, 2, 3
   */
  static normalizeStudentAnswer(value) {
    if (value === null || value === undefined || value === '' || value === -1 || value === '-1') {
      return -1;
    }
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3) {
      return value;
    }
    if (typeof value === 'string') {
      const upper = value.trim().toUpperCase();
      switch (upper) {
        case 'A': case '0': return 0;
        case 'B': case '1': return 1;
        case 'C': case '2': return 2;
        case 'D': case '3': return 3;
      }
    }
    // Invalid option formats are treated safely as unattempted (-1)
    return -1;
  }

  /**
   * Convert internal integer index (-1..3) to human-readable option letter.
   * @param {number} index
   * @returns {string} 'A', 'B', 'C', 'D', or 'Unattempted'
   */
  static indexToLetter(index) {
    switch (index) {
      case 0: return 'A';
      case 1: return 'B';
      case 2: return 'C';
      case 3: return 'D';
      default: return 'Unattempted';
    }
  }

  /**
   * Evaluates student answers against authoritative question answer keys.
   * Implements exact STQA Report Algorithm:
   * 
   * 1. Raw Score Formulation:
   *    Score = \sum_{i=1}^{N} f(S_i, C_i)
   *    f(S_i, C_i) = 1 if S_i == C_i, else 0 (zero marks for unattempted, no negative marking).
   * 
   * 2. Percentage Score Computation:
   *    Percentage (P) = (Score / N) * 100
   * 
   * 3. Pass / Fail Decision Function:
   *    Status = 'PASSED' if P >= 50.0% else 'FAILED'
   * 
   * 4. Question-by-Question Feedback Breakdown:
   *    Question text, options, student selected letter, correct answer letter, and isCorrect boolean.
   * 
   * @param {Array<Object>} questions - Questions from database with correct_option
   * @param {Object} studentAnswers - Key-value map of { [questionId]: selectedOption }
   * @returns {{
   *   totalQuestions: number,
   *   score: number,
   *   percentage: number,
   *   status: string,
   *   breakdown: Array<Object>
   * }}
   */
  evaluateSubmission(questions, studentAnswers = {}) {
    if (!Array.isArray(questions) || questions.length === 0) {
      return {
        totalQuestions: 0,
        score: 0,
        percentage: 0.0,
        status: ATTEMPT_STATUS.FAILED,
        breakdown: []
      };
    }

    const totalQuestions = questions.length;
    let score = 0;
    const breakdown = [];

    // Normalize studentAnswers into key-value map if passed as an array of { questionId, selectedOption }
    let answersMap = {};
    if (Array.isArray(studentAnswers)) {
      for (const item of studentAnswers) {
        if (item && item.questionId !== undefined) {
          answersMap[item.questionId] = item.selectedOption;
        }
      }
    } else if (studentAnswers && typeof studentAnswers === 'object') {
      answersMap = studentAnswers;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qId = q.id;

      // Extract raw student answer (handles numeric or string keys)
      const rawAns = answersMap[qId] !== undefined ? answersMap[qId] : answersMap[String(qId)];
      const studentOption = ScoringService.normalizeStudentAnswer(rawAns);
      const correctOption = Number(q.correct_option);

      // Indicator function f(Si, Ci):
      // 1 if Si == Ci, else 0 (unattempted Si = -1 evaluates to 0, no negative marking)
      const isCorrect = (studentOption !== -1 && studentOption === correctOption) ? 1 : 0;
      if (isCorrect === 1) {
        score += 1;
      }

      breakdown.push({
        questionId: qId,
        questionText: q.question_text,
        selectedOption: studentOption,
        selectedOptionLetter: ScoringService.indexToLetter(studentOption),
        correctOption: correctOption,
        correctOptionLetter: ScoringService.indexToLetter(correctOption),
        isCorrect: isCorrect === 1,
        options: {
          A: q.option_a,
          B: q.option_b,
          C: q.option_c,
          D: q.option_d
        }
      });
    }

    // Percentage calculation: P = (Score / N) * 100
    const rawPercentage = (score / totalQuestions) * 100;

    // Decision Function: Determined strictly using the UNROUNDED percentage [Prerequisite 3]
    const status = rawPercentage >= PASS_THRESHOLD_PERCENT
      ? ATTEMPT_STATUS.PASSED
      : ATTEMPT_STATUS.FAILED;

    // Display/storage percentage rounded to 2 decimal places
    const percentage = Number(rawPercentage.toFixed(2));

    return {
      totalQuestions,
      score,
      percentage,
      status,
      breakdown
    };
  }
}

module.exports = ScoringService;

