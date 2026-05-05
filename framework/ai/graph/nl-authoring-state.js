/**
 * NL Authoring State Schema: defines shared state for the natural language
 * test authoring LangGraph workflow.
 *
 * Flow: parseInstructions → launchBrowser → executeStep* → generateArtifacts → writeFiles → END
 */

const { Annotation } = require('@langchain/langgraph');

const NLAuthoringState = Annotation.Root({
  // -- Input fields --
  instructions: Annotation({ reducer: (_, b) => b, default: () => '' }),
  baseUrl: Annotation({ reducer: (_, b) => b, default: () => '' }),
  autoLogin: Annotation({ reducer: (_, b) => b, default: () => false }),
  headed: Annotation({ reducer: (_, b) => b, default: () => true }),

  // -- Suite-driven options --
  preferredLocators: Annotation({ reducer: (_, b) => b, default: () => [] }),
  outputDir: Annotation({ reducer: (_, b) => b, default: () => '' }),
  pagesDir: Annotation({ reducer: (_, b) => b, default: () => '' }),
  entryCriteria: Annotation({ reducer: (_, b) => b, default: () => '' }),
  exitCriteria: Annotation({ reducer: (_, b) => b, default: () => '' }),

  // -- Parsed instructions --
  parsedInstructions: Annotation({ reducer: (_, b) => b, default: () => null }),
  pendingSteps: Annotation({ reducer: (_, b) => b, default: () => [] }),
  currentStepIndex: Annotation({ reducer: (_, b) => b, default: () => 0 }),

  // -- Browser objects --
  browser: Annotation({ reducer: (_, b) => b, default: () => null }),
  page: Annotation({ reducer: (_, b) => b, default: () => null }),

  // -- Recording --
  recordedActions: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),
  pageSnapshots: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),

  // -- Generation results --
  generatedPageObjects: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),
  generatedTestSpecs: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),

  // -- Tracking --
  currentPhase: Annotation({ reducer: (_, b) => b, default: () => 'init' }),
  errors: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),
});

module.exports = { NLAuthoringState };
