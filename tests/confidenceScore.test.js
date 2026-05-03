/**
 * confidenceScore.test.js
 * 14 test cases covering input validation, core calculation,
 * weighted scoring, and edge cases for the confidence score engine.
 */

const { calculateScore, InvalidInputError } = require('../server/lib/confidenceScore');

describe('confidenceScore', () => {
  // ── 1.1 Input Validation ────────────────────────────────────────────

  describe('Input Validation', () => {
    test('TC-1: empty object returns 0.0', () => {
      expect(calculateScore({})).toBe(0.0);
    });

    test('TC-2: null throws InvalidInputError', () => {
      expect(() => calculateScore(null)).toThrow(InvalidInputError);
    });

    test('TC-3: undefined throws InvalidInputError', () => {
      expect(() => calculateScore(undefined)).toThrow(InvalidInputError);
    });

    test('TC-4: negative correctAnswers throws InvalidInputError', () => {
      expect(() =>
        calculateScore({ correctAnswers: -1, totalQuestions: 5 })
      ).toThrow(InvalidInputError);
    });
  });

  // ── 1.2 Core Calculation ────────────────────────────────────────────

  describe('Core Calculation', () => {
    test('TC-5: 0 correct out of 5 returns 0.0', () => {
      expect(calculateScore({ correctAnswers: 0, totalQuestions: 5 })).toBe(0.0);
    });

    test('TC-6: 5 correct out of 5 returns 1.0', () => {
      expect(calculateScore({ correctAnswers: 5, totalQuestions: 5 })).toBe(1.0);
    });

    test('TC-7: 3 correct out of 5 returns 0.6', () => {
      expect(calculateScore({ correctAnswers: 3, totalQuestions: 5 })).toBeCloseTo(0.6);
    });

    test('TC-8: 1 correct out of 10 returns 0.1', () => {
      expect(calculateScore({ correctAnswers: 1, totalQuestions: 10 })).toBeCloseTo(0.1);
    });
  });

  // ── 1.3 Weighted Scoring ────────────────────────────────────────────

  describe('Weighted Scoring (time-decay & topic difficulty)', () => {
    const now = Date.now();
    const ONE_DAY = 86400000;

    test('TC-9: recent correct answers weighted higher than old ones', () => {
      const data = {
        totalQuestions: 4,
        correctAnswers: 2,
        details: [
          { correct: true, timestamp: now, difficulty: 1.0 },          // recent, correct
          { correct: true, timestamp: now, difficulty: 1.0 },          // recent, correct
          { correct: false, timestamp: now - 10 * ONE_DAY, difficulty: 1.0 }, // old, wrong
          { correct: false, timestamp: now - 10 * ONE_DAY, difficulty: 1.0 }, // old, wrong
        ],
      };
      const score = calculateScore(data);
      const simpleAverage = 2 / 4; // 0.5
      // Recent correct answers should push score above simple average
      expect(score).toBeGreaterThan(simpleAverage);
    });

    test('TC-10: hard-topic correct answers weighted higher', () => {
      const data = {
        totalQuestions: 2,
        correctAnswers: 1,
        details: [
          { correct: true, timestamp: now, difficulty: 3.0 },  // hard, correct
          { correct: false, timestamp: now, difficulty: 1.0 }, // easy, wrong
        ],
      };
      const score = calculateScore(data);
      const simpleAverage = 1 / 2; // 0.5
      expect(score).toBeGreaterThan(simpleAverage);
    });

    test('TC-11: all weights 1.0 (uniform) matches simple ratio', () => {
      const data = {
        totalQuestions: 4,
        correctAnswers: 2,
        details: [
          { correct: true, timestamp: now, difficulty: 1.0 },
          { correct: true, timestamp: now, difficulty: 1.0 },
          { correct: false, timestamp: now, difficulty: 1.0 },
          { correct: false, timestamp: now, difficulty: 1.0 },
        ],
      };
      const score = calculateScore(data);
      expect(score).toBeCloseTo(0.5, 1);
    });
  });

  // ── 1.4 Edge Cases & Boundaries ────────────────────────────────────

  describe('Edge Cases & Boundaries', () => {
    test('TC-12: score never exceeds 1.0 even with bonus multipliers', () => {
      const now = Date.now();
      const data = {
        totalQuestions: 3,
        correctAnswers: 3,
        details: [
          { correct: true, timestamp: now, difficulty: 3.0 },
          { correct: true, timestamp: now, difficulty: 3.0 },
          { correct: true, timestamp: now, difficulty: 3.0 },
        ],
      };
      const score = calculateScore(data);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    test('TC-13: score never drops below 0.0', () => {
      const now = Date.now();
      const data = {
        totalQuestions: 5,
        correctAnswers: 0,
        details: [
          { correct: false, timestamp: now, difficulty: 1.0 },
          { correct: false, timestamp: now, difficulty: 1.0 },
          { correct: false, timestamp: now, difficulty: 1.0 },
          { correct: false, timestamp: now, difficulty: 1.0 },
          { correct: false, timestamp: now, difficulty: 1.0 },
        ],
      };
      const score = calculateScore(data);
      expect(score).toBeGreaterThanOrEqual(0.0);
    });

    test('TC-14: very large input (1000 questions) completes in < 50ms', () => {
      const now = Date.now();
      const details = Array.from({ length: 1000 }, (_, i) => ({
        correct: i % 2 === 0,
        timestamp: now - i * 1000,
        difficulty: (i % 3) + 1,
      }));
      const data = { totalQuestions: 1000, correctAnswers: 500, details };

      const start = performance.now();
      const score = calculateScore(data);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
      expect(score).toBeGreaterThanOrEqual(0.0);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });
});
