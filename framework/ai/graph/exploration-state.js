/**
 * Exploration State Schema: defines the shared state that flows through
 * all nodes in the LangGraph exploration workflow.
 *
 * The exploration graph crawls a web application, classifies pages,
 * identifies user flows, and generates page objects + test specs.
 */

const { Annotation } = require('@langchain/langgraph');

const ExplorationState = Annotation.Root({
  // -- Input fields (set at graph entry) --
  startUrl: Annotation({ reducer: (_, b) => b, default: () => '' }),
  maxPages: Annotation({ reducer: (_, b) => b, default: () => 10 }),
  maxDepth: Annotation({ reducer: (_, b) => b, default: () => 3 }),
  autoLogin: Annotation({ reducer: (_, b) => b, default: () => false }),

  // -- Browser objects (passed through state) --
  browser: Annotation({ reducer: (_, b) => b, default: () => null }),
  page: Annotation({ reducer: (_, b) => b, default: () => null }),

  // -- Crawl tracking --
  currentUrl: Annotation({ reducer: (_, b) => b, default: () => '' }),
  currentDepth: Annotation({ reducer: (_, b) => b, default: () => 0 }),
  visitedUrls: Annotation({ reducer: (_, b) => b, default: () => [] }),
  urlQueue: Annotation({ reducer: (_, b) => b, default: () => [] }),
  visitedPages: Annotation({
    reducer: (existing, newItems) => [...existing, ...newItems],
    default: () => [],
  }),

  // -- Analysis results --
  siteMap: Annotation({ reducer: (_, b) => b, default: () => null }),
  identifiedFlows: Annotation({ reducer: (_, b) => b, default: () => [] }),

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

module.exports = { ExplorationState };
