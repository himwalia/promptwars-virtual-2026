/**
 * knowledgeState.coverage.test.js
 * Supplementary tests to cover the _applyHysteresis branches and
 * edge paths in the KnowledgeStateMachine.
 */

const {
  STATES,
  getState,
  KnowledgeStateMachine,
  buildPromptForState,
} = require('../server/lib/knowledgeState');

describe('knowledgeState — coverage supplements', () => {
  // Cover the _applyHysteresis INFORMED → POLICY_WONK with buffer
  test('hysteresis: INFORMED state, score exceeds POLICY_WONK threshold + buffer', () => {
    const machine = new KnowledgeStateMachine({ hysteresisBuffer: 0.05 });
    machine.evaluate(0.50); // INFORMED
    expect(machine.getCurrentState()).toBe(STATES.INFORMED);

    // 0.75 >= 0.70 + 0.05 → should promote to POLICY_WONK
    machine.evaluate(0.75);
    expect(machine.getCurrentState()).toBe(STATES.POLICY_WONK);
  });

  // Cover the _applyHysteresis INFORMED → stays INFORMED (below buffer for demotion)
  test('hysteresis: INFORMED state, score slightly below INFORMED threshold but within buffer', () => {
    const machine = new KnowledgeStateMachine({ hysteresisBuffer: 0.05 });
    machine.evaluate(0.50); // INFORMED
    expect(machine.getCurrentState()).toBe(STATES.INFORMED);

    // 0.38 is < 0.40 but not < 0.40 - 0.05 = 0.35, so stays INFORMED
    machine.evaluate(0.38);
    expect(machine.getCurrentState()).toBe(STATES.INFORMED);
  });

  // Cover the _applyHysteresis INFORMED → NOVICE (below buffer for demotion)
  test('hysteresis: INFORMED state, score drops well below INFORMED threshold - buffer', () => {
    const machine = new KnowledgeStateMachine({ hysteresisBuffer: 0.05 });
    machine.evaluate(0.50); // INFORMED
    expect(machine.getCurrentState()).toBe(STATES.INFORMED);

    // 0.30 < 0.40 - 0.05 = 0.35 → demote to NOVICE
    machine.evaluate(0.30);
    expect(machine.getCurrentState()).toBe(STATES.NOVICE);
  });

  // Cover the _applyHysteresis POLICY_WONK → INFORMED with buffer
  test('hysteresis: POLICY_WONK state, score drops below POLICY_WONK threshold - buffer', () => {
    const machine = new KnowledgeStateMachine({ hysteresisBuffer: 0.05 });
    machine.evaluate(0.80); // POLICY_WONK
    expect(machine.getCurrentState()).toBe(STATES.POLICY_WONK);

    // 0.60 < 0.70 - 0.05 = 0.65 → demote to INFORMED
    machine.evaluate(0.60);
    expect(machine.getCurrentState()).toBe(STATES.INFORMED);
  });

  // Cover the _applyHysteresis POLICY_WONK stays POLICY_WONK within buffer
  test('hysteresis: POLICY_WONK state, score within buffer range stays POLICY_WONK', () => {
    const machine = new KnowledgeStateMachine({ hysteresisBuffer: 0.05 });
    machine.evaluate(0.80); // POLICY_WONK
    expect(machine.getCurrentState()).toBe(STATES.POLICY_WONK);

    // 0.67 >= 0.70 - 0.05 = 0.65 → stays POLICY_WONK
    machine.evaluate(0.67);
    expect(machine.getCurrentState()).toBe(STATES.POLICY_WONK);
  });

  // Cover the _applyHysteresis POLICY_WONK → NOVICE with buffer
  test('hysteresis: POLICY_WONK state, score drops below INFORMED threshold - buffer → NOVICE', () => {
    const machine = new KnowledgeStateMachine({ hysteresisBuffer: 0.05 });
    machine.evaluate(0.80); // POLICY_WONK
    expect(machine.getCurrentState()).toBe(STATES.POLICY_WONK);

    // 0.30 < 0.40 - 0.05 = 0.35 → NOVICE
    machine.evaluate(0.30);
    expect(machine.getCurrentState()).toBe(STATES.NOVICE);
  });

  // Cover the _applyHysteresis NOVICE → POLICY_WONK with buffer
  test('hysteresis: NOVICE state, score jumps to exceed POLICY_WONK threshold + buffer', () => {
    const machine = new KnowledgeStateMachine({ hysteresisBuffer: 0.05 });
    machine.evaluate(0.20); // NOVICE
    expect(machine.getCurrentState()).toBe(STATES.NOVICE);

    // 0.80 >= 0.70 + 0.05 = 0.75 → POLICY_WONK
    machine.evaluate(0.80);
    expect(machine.getCurrentState()).toBe(STATES.POLICY_WONK);
  });

  // Cover history trimming when maxHistoryLength is exceeded
  test('history is trimmed when maxHistoryLength is exceeded', () => {
    const machine = new KnowledgeStateMachine({ maxHistoryLength: 2 });
    machine.evaluate(0.50); // NOVICE → INFORMED (history: 1)
    machine.evaluate(0.80); // INFORMED → POLICY_WONK (history: 2)
    machine.evaluate(0.30); // POLICY_WONK → NOVICE (history: 3, trimmed to 2)
    expect(machine.getHistory()).toHaveLength(2);
  });

  // Cover buildPromptForState with INFORMED state
  test('buildPromptForState for INFORMED includes "balanced"', () => {
    const prompt = buildPromptForState(STATES.INFORMED, 'Campaigning');
    expect(prompt).toMatch(/balanced/i);
    expect(prompt).toContain('Campaigning');
  });

  // Cover buildPromptForState with unknown state (fallback)
  test('buildPromptForState with unknown state falls back to NOVICE template', () => {
    const prompt = buildPromptForState('UNKNOWN_STATE', 'Primaries');
    expect(prompt).toMatch(/simple language/i);
  });

  // Cover evaluate with no state change (changed = false)
  test('evaluate returns changed=false when state does not change', () => {
    const machine = new KnowledgeStateMachine();
    machine.evaluate(0.10); // stays NOVICE
    const result = machine.evaluate(0.15); // still NOVICE
    expect(result.changed).toBe(false);
    expect(result.state).toBe(STATES.NOVICE);
  });
});
