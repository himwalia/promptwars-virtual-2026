/**
 * confidenceScore.js
 * Calculates a normalized confidence score (0.0–1.0) representing how well
 * the user understands a given election topic, based on interaction signals.
 */

class InvalidInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

/**
 * @typedef {Object} InteractionData
 * @property {number} correctAnswers - Number of correct answers
 * @property {number} totalQuestions  - Total questions attempted
 * @property {Array<{correct: boolean, timestamp: number, difficulty: number}>} [details]
 *   Optional detailed interaction records for weighted scoring
 */

/**
 * Calculate a confidence score from interaction data.
 *
 * Supports two modes:
 *  1. Simple mode: uses `correctAnswers / totalQuestions`
 *  2. Weighted mode: when `details` array is provided, applies time-decay
 *     and difficulty weighting.
 *
 * @param {InteractionData} data
 * @returns {number} Score clamped to [0.0, 1.0]
 * @throws {InvalidInputError} if data is null, undefined, or contains negatives
 */
function calculateScore(data) {
  // ── Input Validation ──────────────────────────────────────────────────
  if (data === null || data === undefined) {
    throw new InvalidInputError('Interaction data must not be null or undefined');
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new InvalidInputError('Interaction data must be a plain object');
  }

  // Check for negative values
  if (data.correctAnswers < 0 || data.totalQuestions < 0) {
    throw new InvalidInputError('Interaction values must not be negative');
  }

  // ── Empty / zero-questions shortcut ───────────────────────────────────
  const total = data.totalQuestions || 0;
  if (total === 0) {
    return 0.0;
  }

  // ── Weighted mode (when details are provided) ─────────────────────────
  if (Array.isArray(data.details) && data.details.length > 0) {
    return _calculateWeightedScore(data.details);
  }

  // ── Simple mode ───────────────────────────────────────────────────────
  const correct = data.correctAnswers || 0;
  const raw = correct / total;
  return _clamp(raw);
}

/**
 * Weighted scoring with time-decay and difficulty multipliers.
 * @param {Array<{correct: boolean, timestamp: number, difficulty: number}>} details
 * @returns {number} Score clamped to [0.0, 1.0]
 * @private
 */
function _calculateWeightedScore(details) {
  const now = Date.now();
  const ONE_DAY_MS = 86400000;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const entry of details) {
    // Time decay: more recent = higher weight (1.0 if today, decays toward 0.1)
    const ageInDays = (now - (entry.timestamp || now)) / ONE_DAY_MS;
    const timeWeight = Math.max(0.1, 1.0 - ageInDays * 0.05);

    // Difficulty weight: scales from 1.0 (easy) to 3.0 (hard)
    const difficultyWeight = entry.difficulty || 1.0;

    const combinedWeight = timeWeight * difficultyWeight;
    totalWeight += combinedWeight;

    if (entry.correct) {
      weightedSum += combinedWeight;
    }
  }

  if (totalWeight === 0) return 0.0;

  return _clamp(weightedSum / totalWeight);
}

/**
 * Clamp a value to [0.0, 1.0].
 * @param {number} value
 * @returns {number}
 * @private
 */
function _clamp(value) {
  return Math.min(1.0, Math.max(0.0, value));
}

module.exports = { calculateScore, InvalidInputError };
