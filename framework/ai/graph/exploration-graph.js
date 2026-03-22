/**
 * Exploration Graph: LangGraph state machine for autonomous web app
 * exploration and test generation.
 *
 * Graph flow:
 *   __start__ → navigate → discoverPage → [routeAfterDiscover]
 *                                           ├→ crawlNext → discoverPage (loop)
 *                                           └→ analyzeApp → generatePageObjects
 *                                              → generateTests → writeFiles → END
 *
 * Usage:
 *   const graph = createExplorationGraph(config);
 *   const result = await graph.invoke({ startUrl: 'https://example.com', maxPages: 10 });
 */

const { StateGraph, END } = require('@langchain/langgraph');
const { ExplorationState } = require('./exploration-state');
const { createExplorationNodes } = require('./exploration-nodes');
const { routeAfterDiscover } = require('./exploration-conditions');

/**
 * Build the exploration graph.
 * @param {object} config - AI config from ai.config.js
 * @returns {CompiledGraph} A compiled LangGraph ready to invoke.
 */
function createExplorationGraph(config) {
  const nodes = createExplorationNodes(config);

  const graph = new StateGraph(ExplorationState)
    // Register all 7 nodes
    .addNode('navigate', nodes.navigate)
    .addNode('discoverPage', nodes.discoverPage)
    .addNode('crawlNext', nodes.crawlNext)
    .addNode('analyzeApp', nodes.analyzeApp)
    .addNode('generatePageObjects', nodes.generatePageObjects)
    .addNode('generateTests', nodes.generateTests)
    .addNode('writeFiles', nodes.writeFiles)

    // Entry point
    .addEdge('__start__', 'navigate')
    .addEdge('navigate', 'discoverPage')

    // Crawl loop: after discovering a page, either crawl more or analyze
    .addConditionalEdges('discoverPage', routeAfterDiscover, {
      crawlNext: 'crawlNext',
      analyzeApp: 'analyzeApp',
    })

    // Crawl loop back
    .addEdge('crawlNext', 'discoverPage')

    // Linear pipeline: analyze → generate POs → generate tests → write
    .addEdge('analyzeApp', 'generatePageObjects')
    .addEdge('generatePageObjects', 'generateTests')
    .addEdge('generateTests', 'writeFiles')

    // Exit
    .addEdge('writeFiles', END);

  return graph.compile();
}

module.exports = { createExplorationGraph };
