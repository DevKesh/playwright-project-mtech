/**
 * Lifecycle State Schema: defines the shared state for the 6-phase
 * QA lifecycle orchestration graph.
 *
 * Phases: Discovery → Strategy → Pre-Execution → [Test Run] → [Post-Mortem] → Synthesis
 */

const { Annotation } = require('@langchain/langgraph');

const LifecycleState = Annotation.Root({
  // -- Control flow --
  currentPhase: Annotation({ reducer: (_, b) => b, default: () => 'discovery' }),
  mode: Annotation({ reducer: (_, b) => b, default: () => 'full' }), // 'pre', 'post', 'full'

  // -- Phase 1: Discovery outputs --
  pageObjects: Annotation({ reducer: (_, b) => b, default: () => [] }),
  testSpecs: Annotation({ reducer: (_, b) => b, default: () => [] }),
  flowFiles: Annotation({ reducer: (_, b) => b, default: () => [] }),
  coverageMap: Annotation({ reducer: (_, b) => b, default: () => ({}) }),

  // -- Phase 2: Strategy outputs --
  riskAssessment: Annotation({ reducer: (_, b) => b, default: () => [] }),
  driftCandidates: Annotation({ reducer: (_, b) => b, default: () => [] }),
  prioritizedActions: Annotation({ reducer: (_, b) => b, default: () => [] }),

  // -- Phase 3: Pre-Execution outputs --
  driftReports: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),
  preHealingActions: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),
  preExecutionComplete: Annotation({ reducer: (_, b) => b, default: () => false }),

  // -- Phase 6: Synthesis inputs (populated from storage after test run) --
  healingLog: Annotation({ reducer: (_, b) => b, default: () => [] }),
  runHistory: Annotation({ reducer: (_, b) => b, default: () => [] }),
  failureReports: Annotation({ reducer: (_, b) => b, default: () => [] }),

  // -- Phase 6: Synthesis outputs --
  metrics: Annotation({ reducer: (_, b) => b, default: () => ({}) }),
  knowledgeBaseUpdated: Annotation({ reducer: (_, b) => b, default: () => false }),
  synthesisReport: Annotation({ reducer: (_, b) => b, default: () => null }),

  // -- Error tracking --
  errors: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),
});

module.exports = { LifecycleState };
