/**
 * confidenceScore.coverage.test.js
 * Supplementary tests to cover remaining branches in confidenceScore.js.
 */

const { calculateScore, InvalidInputError } = require('../server/lib/confidenceScore');

describe('confidenceScore — coverage supplements', () => {
  // Cover array input validation
  test('array input throws InvalidInputError', () => {
    expect(() => calculateScore([1, 2, 3])).toThrow(InvalidInputError);
  });

  // Cover weighted scoring with zero totalWeight edge case
  test('details with no entries falls back to simple mode', () => {
    const result = calculateScore({
      correctAnswers: 3,
      totalQuestions: 5,
      details: [],
    });
    expect(result).toBeCloseTo(0.6);
  });

  // Cover the details path where entry has no timestamp (defaults to now)
  test('details entry with no timestamp defaults to now (weight ≈ 1.0)', () => {
    const data = {
      totalQuestions: 2,
      correctAnswers: 1,
      details: [
        { correct: true, difficulty: 1.0 },
        { correct: false, difficulty: 1.0 },
      ],
    };
    const score = calculateScore(data);
    expect(score).toBeCloseTo(0.5, 1);
  });

  // Cover the details path where entry has no difficulty (defaults to 1.0)
  test('details entry with no difficulty defaults to 1.0', () => {
    const now = Date.now();
    const data = {
      totalQuestions: 2,
      correctAnswers: 1,
      details: [
        { correct: true, timestamp: now },
        { correct: false, timestamp: now },
      ],
    };
    const score = calculateScore(data);
    expect(score).toBeCloseTo(0.5, 1);
  });

  // Cover negative totalQuestions validation
  test('negative totalQuestions throws InvalidInputError', () => {
    expect(() =>
      calculateScore({ correctAnswers: 0, totalQuestions: -5 })
    ).toThrow(InvalidInputError);
  });
});
