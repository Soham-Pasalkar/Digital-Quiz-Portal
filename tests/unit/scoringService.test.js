/**
 * ScoringService Unit Tests
 * [Category A]: Automated score calculation & feedback algorithm (STQA Report Page 1)
 *               Mathematical formulations: Raw Score, Percentage, Pass/Fail (50.0% threshold)
 *               Boundary Value Analysis: 0%, 49.9%, 50%, 100%
 * [Category B]: Option letter normalization and breakdown formatting
 * [Category C]: Complete backend calculation verification
 */

const ScoringService = require('../../src/services/scoringService');
const { ATTEMPT_STATUS } = require('../../src/config/constants');

describe('ScoringService', () => {
  let scoringService;
  let sampleQuestions;

  beforeEach(() => {
    scoringService = new ScoringService();

    sampleQuestions = [
      {
        id: 1,
        question_text: 'What is DBMS?',
        option_a: 'Software',
        option_b: 'Hardware',
        option_c: 'Cable',
        option_d: 'Protocol',
        correct_option: 0 // Option A
      },
      {
        id: 2,
        question_text: 'What is SQL?',
        option_a: 'Sequential Query Language',
        option_b: 'Structured Query Language',
        option_c: 'Simple Query Language',
        option_d: 'Standard Query Language',
        correct_option: 1 // Option B
      },
      {
        id: 3,
        question_text: 'What is a Primary Key?',
        option_a: 'Duplicate column',
        option_b: 'Foreign link',
        option_c: 'Unique identifier',
        option_d: 'Nullable key',
        correct_option: 2 // Option C
      },
      {
        id: 4,
        question_text: 'Which command removes a table schema?',
        option_a: 'DELETE',
        option_b: 'REMOVE',
        option_c: 'CLEAR',
        option_d: 'DROP',
        correct_option: 3 // Option D
      }
    ];
  });

  describe('Option Normalization', () => {
    test('normalizes student answer values to integer indices (-1..3)', () => {
      expect(ScoringService.normalizeStudentAnswer('A')).toBe(0);
      expect(ScoringService.normalizeStudentAnswer('b')).toBe(1);
      expect(ScoringService.normalizeStudentAnswer('C')).toBe(2);
      expect(ScoringService.normalizeStudentAnswer('d')).toBe(3);
      expect(ScoringService.normalizeStudentAnswer(0)).toBe(0);
      expect(ScoringService.normalizeStudentAnswer(3)).toBe(3);
      expect(ScoringService.normalizeStudentAnswer('2')).toBe(2);
    });

    test('treats null, undefined, empty string, and -1 as unattempted (-1)', () => {
      expect(ScoringService.normalizeStudentAnswer(null)).toBe(-1);
      expect(ScoringService.normalizeStudentAnswer(undefined)).toBe(-1);
      expect(ScoringService.normalizeStudentAnswer('')).toBe(-1);
      expect(ScoringService.normalizeStudentAnswer(-1)).toBe(-1);
      expect(ScoringService.normalizeStudentAnswer('invalid_value')).toBe(-1);
    });

    test('maps indices to letters A..D', () => {
      expect(ScoringService.indexToLetter(0)).toBe('A');
      expect(ScoringService.indexToLetter(1)).toBe('B');
      expect(ScoringService.indexToLetter(2)).toBe('C');
      expect(ScoringService.indexToLetter(3)).toBe('D');
      expect(ScoringService.indexToLetter(-1)).toBe('Unattempted');
    });
  });

  describe('Mathematical Formulations & BVA Boundaries (STQA Report Page 1)', () => {
    test('TC-03: 100% Score Boundary (All answers correct) -> PASSED', () => {
      const studentAnswers = {
        1: 'A', // Q1 correct
        2: 'B', // Q2 correct
        3: 'C', // Q3 correct
        4: 'D'  // Q4 correct
      };

      const result = scoringService.evaluateSubmission(sampleQuestions, studentAnswers);

      expect(result.totalQuestions).toBe(4);
      expect(result.score).toBe(4);
      expect(result.percentage).toBe(100.0);
      expect(result.status).toBe(ATTEMPT_STATUS.PASSED);

      // Verify each breakdown entry
      expect(result.breakdown).toHaveLength(4);
      result.breakdown.forEach(item => {
        expect(item.isCorrect).toBe(true);
        expect(item.selectedOption).toBe(item.correctOption);
        expect(item.selectedOptionLetter).toBe(item.correctOptionLetter);
      });
    });

    test('TC-04: 0% Score Boundary (All answers incorrect) -> FAILED', () => {
      const studentAnswers = {
        1: 'B', // Q1 wrong (correct is A)
        2: 'A', // Q2 wrong (correct is B)
        3: 'A', // Q3 wrong (correct is C)
        4: 'A'  // Q4 wrong (correct is D)
      };

      const result = scoringService.evaluateSubmission(sampleQuestions, studentAnswers);

      expect(result.totalQuestions).toBe(4);
      expect(result.score).toBe(0);
      expect(result.percentage).toBe(0.0);
      expect(result.status).toBe(ATTEMPT_STATUS.FAILED);

      result.breakdown.forEach(item => {
        expect(item.isCorrect).toBe(false);
      });
    });

    test('TC-05: Empty Exam Submission (Unattempted) -> 0% Score, FAILED, No negative marking', () => {
      const result = scoringService.evaluateSubmission(sampleQuestions, {});

      expect(result.totalQuestions).toBe(4);
      expect(result.score).toBe(0);
      expect(result.percentage).toBe(0.0);
      expect(result.status).toBe(ATTEMPT_STATUS.FAILED);

      result.breakdown.forEach(item => {
        expect(item.selectedOption).toBe(-1);
        expect(item.selectedOptionLetter).toBe('Unattempted');
        expect(item.isCorrect).toBe(false);
      });
    });

    test('Exact 50.0% Pass Threshold Boundary -> PASSED', () => {
      // 2 correct out of 4 = 50.0%
      const studentAnswers = {
        1: 'A', // Q1 correct (A)
        2: 'B', // Q2 correct (B)
        3: 'A', // Q3 incorrect (C)
        4: 'A'  // Q4 incorrect (D)
      };

      const result = scoringService.evaluateSubmission(sampleQuestions, studentAnswers);

      expect(result.score).toBe(2);
      expect(result.percentage).toBe(50.0);
      expect(result.status).toBe(ATTEMPT_STATUS.PASSED);
    });

    test('49.9% Just Below Pass Boundary -> FAILED', () => {
      // Construct a 1000-question set to test exact 49.9% boundary: 499 / 1000 = 49.9%
      const thousandQuestions = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        question_text: `Question ${i + 1}`,
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        option_d: 'D',
        correct_option: 0
      }));

      // Answer 499 correctly, remaining 501 incorrectly
      const answers = {};
      for (let i = 1; i <= 499; i++) {
        answers[i] = 0; // Correct
      }
      for (let i = 500; i <= 1000; i++) {
        answers[i] = 1; // Incorrect
      }

      const result = scoringService.evaluateSubmission(thousandQuestions, answers);

      expect(result.totalQuestions).toBe(1000);
      expect(result.score).toBe(499);
      expect(result.percentage).toBe(49.9);
      expect(result.status).toBe(ATTEMPT_STATUS.FAILED);
    });

    test('strictly evaluates PASSED/FAILED on unrounded percentage: below-50% that rounds to 50.00% is FAILED', () => {
      // 5000 / 10001 = 49.99500049995...% which rounds to 50.00% via toFixed(2)
      // But unrounded, 49.995% < 50.0%, so status MUST be FAILED
      const questions = Array.from({ length: 10001 }, (_, i) => ({
        id: i + 1,
        question_text: `Q${i + 1}`,
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        option_d: 'D',
        correct_option: 0
      }));

      const answers = {};
      for (let i = 1; i <= 5000; i++) {
        answers[i] = 0; // 5000 correct
      }
      for (let i = 5001; i <= 10001; i++) {
        answers[i] = 1; // 5001 incorrect
      }

      const result = scoringService.evaluateSubmission(questions, answers);

      expect(result.totalQuestions).toBe(10001);
      expect(result.score).toBe(5000);
      expect(result.percentage).toBe(50.00); // Displayed rounded percentage is 50.00%
      expect(result.status).toBe(ATTEMPT_STATUS.FAILED); // Status is strictly FAILED based on unrounded precision
    });

    test('handles partially attempted exams with mixed answers correctly', () => {
      // 3 answered (2 correct, 1 wrong), 1 unattempted (Q4 omitted)
      const studentAnswers = {
        1: 'A', // correct
        2: 'B', // correct
        3: 'A'  // wrong
        // Q4 unattempted
      };

      const result = scoringService.evaluateSubmission(sampleQuestions, studentAnswers);

      expect(result.score).toBe(2);
      expect(result.percentage).toBe(50.0);
      expect(result.status).toBe(ATTEMPT_STATUS.PASSED);

      expect(result.breakdown[0].isCorrect).toBe(true);
      expect(result.breakdown[1].isCorrect).toBe(true);
      expect(result.breakdown[2].isCorrect).toBe(false);
      expect(result.breakdown[3].selectedOption).toBe(-1);
      expect(result.breakdown[3].selectedOptionLetter).toBe('Unattempted');
      expect(result.breakdown[3].isCorrect).toBe(false);
    });

    test('safely handles empty questions input', () => {
      const result = scoringService.evaluateSubmission([], { 1: 'A' });
      expect(result.totalQuestions).toBe(0);
      expect(result.score).toBe(0);
      expect(result.percentage).toBe(0.0);
      expect(result.status).toBe(ATTEMPT_STATUS.FAILED);
      expect(result.breakdown).toEqual([]);
    });
  });
});

