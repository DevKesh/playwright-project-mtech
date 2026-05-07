/**
 * Graph State Schema: defines the shared state that flows through
 * all nodes in the LangGraph healing workflows.
 *
 * LangGraph uses "channels" to define how state is updated.
 * Each property has a reducer: 'replace' (last write wins) or 'append' (array accumulation).
 */

const { Annotation } = require('@langchain/langgraph');

/**
 * Post-mortem healing graph state.
 * Flows through: classifyFailure → route → healLocator/healTestCase/reportOnly → report
 */
const HealingState = Annotation.Root({
  // -- Input fields (set at graph entry) --
  testFile: Annotation({ reducer: (_, b) => b, default: () => '' }),
  testTitle: Annotation({ reducer: (_, b) => b, default: () => '' }),
  errorMessage: Annotation({ reducer: (_, b) => b, default: () => '' }),
  errorStack: Annotation({ reducer: (_, b) => b, default: () => '' }),
  steps: Annotation({ reducer: (_, b) => b, default: () => [] }),
  screenshotPath: Annotation({ reducer: (_, b) => b, default: () => null }),

  // -- Audit trail (correlation tracking) --
  correlationId: Annotation({ reducer: (_, b) => b, default: () => null }),
  runId: Annotation({ reducer: (_, b) => b, default: () => null }),

  // -- Classification (set by classifyFailure node) --
  failureCategory: Annotation({ reducer: (_, b) => b, default: () => '' }),
  failureAnalysis: Annotation({ reducer: (_, b) => b, default: () => null }),

  // -- Healing results (set by healing nodes) --
  healingAttempted: Annotation({ reducer: (_, b) => b, default: () => false }),
  healingResult: Annotation({ reducer: (_, b) => b, default: () => null }),
  testCaseHealResult: Annotation({ reducer: (_, b) => b, default: () => null }),

  // -- Decision tracking --
  decision: Annotation({ reducer: (_, b) => b, default: () => '' }),
  confidence: Annotation({ reducer: (_, b) => b, default: () => 0 }),

  // -- Final output --
  reports: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),
});

/**
 * Runtime locator healing graph state.
 * Flows through: tryHeal (with strategy cycling) → validate → succeed/fail
 */
const RuntimeHealingState = Annotation.Root({
  // -- Input fields --
  page: Annotation({ reducer: (_, b) => b, default: () => null }),
  failedSelector: Annotation({ reducer: (_, b) => b, default: () => '' }),
  errorName: Annotation({ reducer: (_, b) => b, default: () => '' }),
  errorMessage: Annotation({ reducer: (_, b) => b, default: () => '' }),
  action: Annotation({ reducer: (_, b) => b, default: () => '' }),
  actionArgs: Annotation({ reducer: (_, b) => b, default: () => [] }),

  // -- Strategy tracking --
  currentStrategy: Annotation({ reducer: (_, b) => b, default: () => 'css' }),
  attemptCount: Annotation({ reducer: (_, b) => b, default: () => 0 }),
  maxAttempts: Annotation({ reducer: (_, b) => b, default: () => 3 }),

  // -- Results from each attempt --
  attempts: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),

  // -- Final outcome --
  healed: Annotation({ reducer: (_, b) => b, default: () => false }),
  healedSelector: Annotation({ reducer: (_, b) => b, default: () => null }),
  confidence: Annotation({ reducer: (_, b) => b, default: () => 0 }),
  actionResult: Annotation({ reducer: (_, b) => b, default: () => undefined }),
});

module.exports = { HealingState, RuntimeHealingState };
