/**
 * knowledgeState.js
 * Manages Civic Knowledge State transitions between tiers based on
 * the user's cumulative confidence score.
 *
 * States:
 *   NOVICE      (0.00 – 0.39)  Simple, friendly, analogies-heavy
 *   INFORMED    (0.40 – 0.69)  Balanced, factual, moderate depth
 *   POLICY_WONK (0.70 – 1.00)  Dense, nuanced, cites legal text
 */

const STATES = Object.freeze({
  NOVICE: 'NOVICE',
  INFORMED: 'INFORMED',
  POLICY_WONK: 'POLICY_WONK',
});

const THRESHOLDS = Object.freeze({
  INFORMED_MIN: 0.40,
  POLICY_WONK_MIN: 0.70,
});

/**
 * Derive the knowledge state from a raw confidence score.
 * @param {number} score - A value in [0.0, 1.0]
 * @returns {string} One of STATES values
 */
function getState(score) {
  if (score >= THRESHOLDS.POLICY_WONK_MIN) return STATES.POLICY_WONK;
  if (score >= THRESHOLDS.INFORMED_MIN) return STATES.INFORMED;
  return STATES.NOVICE;
}

/**
 * Tracks state history and manages transitions with optional hysteresis.
 */
class KnowledgeStateMachine {
  /**
   * @param {Object} [options]
   * @param {number} [options.hysteresisBuffer=0.0] - Score buffer to prevent rapid flapping
   * @param {number} [options.maxHistoryLength=100] - Max transition history entries
   */
  constructor(options = {}) {
    this.hysteresisBuffer = options.hysteresisBuffer || 0.0;
    this.maxHistoryLength = options.maxHistoryLength || 100;
    this.currentState = STATES.NOVICE;
    this.currentScore = 0.0;
    this.history = [];
  }

  /**
   * Evaluate a new score and potentially transition state.
   * With hysteresis, the score must exceed the threshold by the buffer
   * amount to transition *away* from the current state.
   *
   * @param {number} newScore
   * @returns {{ state: string, changed: boolean, previousState: string }}
   */
  evaluate(newScore) {
    const previousState = this.currentState;
    this.currentScore = newScore;

    let targetState = getState(newScore);

    // Apply hysteresis: require a buffer beyond the threshold to change
    if (this.hysteresisBuffer > 0 && targetState !== this.currentState) {
      const buffered = this._applyHysteresis(newScore, this.currentState);
      targetState = buffered;
    }

    const changed = targetState !== previousState;
    this.currentState = targetState;

    if (changed) {
      this.history.push({
        from: previousState,
        to: targetState,
        score: newScore,
        timestamp: Date.now(),
      });
      if (this.history.length > this.maxHistoryLength) {
        this.history.shift();
      }
    }

    return { state: this.currentState, changed, previousState };
  }

  /**
   * Apply hysteresis buffering to prevent rapid state oscillation.
   * @param {number} score
   * @param {string} currentState
   * @returns {string} Adjusted target state
   * @private
   */
  _applyHysteresis(score, currentState) {
    const buf = this.hysteresisBuffer;

    if (currentState === STATES.NOVICE) {
      // Must exceed INFORMED threshold by buffer to promote
      if (score >= THRESHOLDS.INFORMED_MIN + buf) {
        if (score >= THRESHOLDS.POLICY_WONK_MIN + buf) return STATES.POLICY_WONK;
        return STATES.INFORMED;
      }
      return STATES.NOVICE;
    }

    if (currentState === STATES.INFORMED) {
      // Must drop below INFORMED threshold minus buffer to demote
      if (score < THRESHOLDS.INFORMED_MIN - buf) return STATES.NOVICE;
      // Must exceed POLICY_WONK threshold by buffer to promote
      if (score >= THRESHOLDS.POLICY_WONK_MIN + buf) return STATES.POLICY_WONK;
      return STATES.INFORMED;
    }

    if (currentState === STATES.POLICY_WONK) {
      // Must drop below POLICY_WONK threshold minus buffer to demote
      if (score < THRESHOLDS.INFORMED_MIN - buf) return STATES.NOVICE;
      if (score < THRESHOLDS.POLICY_WONK_MIN - buf) return STATES.INFORMED;
      return STATES.POLICY_WONK;
    }

    return getState(score);
  }

  /** Get the current state. */
  getCurrentState() {
    return this.currentState;
  }

  /** Get the transition history. */
  getHistory() {
    return [...this.history];
  }
}

/**
 * Build the Gemini prompt template adapted to the user's knowledge state.
 * @param {string} state - One of STATES values
 * @param {string} topic - Election topic name
 * @returns {string} Prompt string
 */
function buildPromptForState(state, topic) {
  const prompts = {
    [STATES.NOVICE]: `You are a friendly civics tutor. Explain the topic "${topic}" using simple language, everyday analogies, and short sentences. Assume the reader has no prior knowledge of the electoral process.`,
    [STATES.INFORMED]: `You are a knowledgeable civics educator. Explain the topic "${topic}" with balanced factual depth. Use clear structure, provide context, and reference relevant processes. The reader has a moderate understanding of elections.`,
    [STATES.POLICY_WONK]: `You are an expert policy analyst. Explain the topic "${topic}" with dense, nuanced analysis. Include legal citations, reference specific statutes and legal framework, and discuss edge cases and precedents. The reader is highly knowledgeable about electoral policy.`,
  };

  return prompts[state] || prompts[STATES.NOVICE];
}

module.exports = {
  STATES,
  THRESHOLDS,
  getState,
  KnowledgeStateMachine,
  buildPromptForState,
};
