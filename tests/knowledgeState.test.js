/**
 * knowledgeState.test.js
 * 16 test cases covering initial state, upward/downward transitions,
 * boundary precision, hysteresis stability, and integration with confidence scoring.
 */

const {
  STATES,
  getState,
  KnowledgeStateMachine,
  buildPromptForState,
} = require('../server/lib/knowledgeState');
const { calculateScore } = require('../server/lib/confidenceScore');

describe('knowledgeState', () => {
  // ── 2.1 Initial State ──────────────────────────────────────────────

  describe('Initial State', () => {
    test('TC-1: new user with no interactions defaults to NOVICE', () => {
      const machine = new KnowledgeStateMachine();
      expect(machine.getCurrentState()).toBe(STATES.NOVICE);
    });

    test('TC-2: getState(0.0) returns NOVICE', () => {
      expect(getState(0.0)).toBe(STATES.NOVICE);
    });
  });

  // ── 2.2 Upward Transitions ─────────────────────────────────────────

  describe('Upward Transitions', () => {
    test('TC-3: score 0.35 → 0.42 transitions NOVICE → INFORMED', () => {
      const machine = new KnowledgeStateMachine();
      machine.evaluate(0.35);
      expect(machine.getCurrentState()).toBe(STATES.NOVICE);

      const result = machine.evaluate(0.42);
      expect(result.state).toBe(STATES.INFORMED);
      expect(result.changed).toBe(true);
      expect(result.previousState).toBe(STATES.NOVICE);
    });

    test('TC-4: score 0.65 → 0.75 transitions INFORMED → POLICY_WONK', () => {
      const machine = new KnowledgeStateMachine();
      machine.evaluate(0.65);
      expect(machine.getCurrentState()).toBe(STATES.INFORMED);

      const result = machine.evaluate(0.75);
      expect(result.state).toBe(STATES.POLICY_WONK);
      expect(result.changed).toBe(true);
    });

    test('TC-5: score jumps 0.10 → 0.85 transitions NOVICE → POLICY_WONK directly', () => {
      const machine = new KnowledgeStateMachine();
      machine.evaluate(0.10);
      expect(machine.getCurrentState()).toBe(STATES.NOVICE);

      const result = machine.evaluate(0.85);
      expect(result.state).toBe(STATES.POLICY_WONK);
      expect(result.changed).toBe(true);
      expect(result.previousState).toBe(STATES.NOVICE);
    });
  });

  // ── 2.3 Downward Transitions (Score Decay) ─────────────────────────

  describe('Downward Transitions (Score Decay)', () => {
    test('TC-6: score 0.75 → 0.60 transitions POLICY_WONK → INFORMED', () => {
      const machine = new KnowledgeStateMachine();
      machine.evaluate(0.75);
      expect(machine.getCurrentState()).toBe(STATES.POLICY_WONK);

      const result = machine.evaluate(0.60);
      expect(result.state).toBe(STATES.INFORMED);
      expect(result.changed).toBe(true);
    });

    test('TC-7: score 0.50 → 0.30 transitions INFORMED → NOVICE', () => {
      const machine = new KnowledgeStateMachine();
      machine.evaluate(0.50);
      expect(machine.getCurrentState()).toBe(STATES.INFORMED);

      const result = machine.evaluate(0.30);
      expect(result.state).toBe(STATES.NOVICE);
      expect(result.changed).toBe(true);
    });

    test('TC-8: score 0.80 → 0.20 transitions POLICY_WONK → NOVICE directly', () => {
      const machine = new KnowledgeStateMachine();
      machine.evaluate(0.80);
      expect(machine.getCurrentState()).toBe(STATES.POLICY_WONK);

      const result = machine.evaluate(0.20);
      expect(result.state).toBe(STATES.NOVICE);
      expect(result.changed).toBe(true);
      expect(result.previousState).toBe(STATES.POLICY_WONK);
    });
  });

  // ── 2.4 Boundary Precision ─────────────────────────────────────────

  describe('Boundary Precision (exact thresholds)', () => {
    test('TC-9: getState(0.39) returns NOVICE', () => {
      expect(getState(0.39)).toBe(STATES.NOVICE);
    });

    test('TC-10: getState(0.40) returns INFORMED', () => {
      expect(getState(0.40)).toBe(STATES.INFORMED);
    });

    test('TC-11: getState(0.69) returns INFORMED', () => {
      expect(getState(0.69)).toBe(STATES.INFORMED);
    });

    test('TC-12: getState(0.70) returns POLICY_WONK', () => {
      expect(getState(0.70)).toBe(STATES.POLICY_WONK);
    });
  });

  // ── 2.5 Stability & Hysteresis ─────────────────────────────────────

  describe('Stability & Hysteresis', () => {
    test('TC-13: oscillation 0.38 → 0.41 → 0.39 with hysteresis prevents rapid flapping', () => {
      const machine = new KnowledgeStateMachine({ hysteresisBuffer: 0.03 });
      machine.evaluate(0.38);
      expect(machine.getCurrentState()).toBe(STATES.NOVICE);

      // 0.41 is within buffer of 0.40 + 0.03 = 0.43, so should NOT transition
      machine.evaluate(0.41);
      expect(machine.getCurrentState()).toBe(STATES.NOVICE);

      // 0.39 stays NOVICE
      machine.evaluate(0.39);
      expect(machine.getCurrentState()).toBe(STATES.NOVICE);
    });

    test('TC-14: score stays at 0.40 across 10 evaluations, state remains INFORMED', () => {
      const machine = new KnowledgeStateMachine();
      for (let i = 0; i < 10; i++) {
        machine.evaluate(0.40);
      }
      expect(machine.getCurrentState()).toBe(STATES.INFORMED);
      // No transitions after the first one
      expect(machine.getHistory()).toHaveLength(1); // only the initial NOVICE → INFORMED
    });
  });

  // ── 2.6 Integration with Confidence Score ──────────────────────────

  describe('Integration with Confidence Score', () => {
    test('TC-15: full pipeline: raw interaction data → calculateScore → getState returns valid state', () => {
      const score = calculateScore({ correctAnswers: 4, totalQuestions: 5 });
      const state = getState(score);
      expect([STATES.NOVICE, STATES.INFORMED, STATES.POLICY_WONK]).toContain(state);
      // 4/5 = 0.8 → should be POLICY_WONK
      expect(state).toBe(STATES.POLICY_WONK);
    });

    test('TC-16: prompt template adapts based on state', () => {
      const novicePrompt = buildPromptForState(STATES.NOVICE, 'Voter Registration');
      expect(novicePrompt).toMatch(/simple language/i);

      const wonkPrompt = buildPromptForState(STATES.POLICY_WONK, 'Voter Registration');
      expect(wonkPrompt).toMatch(/legal/i);
    });
  });
});
