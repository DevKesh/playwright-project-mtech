/**
 * Post-Mortem Healing Graph: orchestrates failure analysis and healing
 * after a test has failed, replacing the simple sequential calls in the reporter.
 *
 * Graph flow:
 *   TEST FAILED → classifyFailure → route by category:
 *     locator_broken/assertion_mismatch → healTestCase → summarize
 *     network_error/timeout             → reportOnly   → summarize
 *
 * Usage:
 *   const graph = createHealingGraph(config);
 *   const result = await graph.invoke({ testFile, testTitle, errorMessage, ... });
 */

const { StateGraph, END } = require('@langchain/langgraph');
const { HealingState } = require('./state');
const { createNodes } = require('./nodes');
const { routeAfterClassification } = require('./conditions');

/**
 * Build the post-mortem healing graph.
 * @param {object} config - AI config from ai.config.js
 * @returns {CompiledGraph} A compiled LangGraph ready to invoke.
 */
function createHealingGraph(config) {
  const nodes = createNodes(config);

  const graph = new StateGraph(HealingState)
    // Register nodes
    .addNode('classifyFailure', nodes.classifyFailure)
    .addNode('healTestCase', nodes.healTestCase)
    .addNode('reportOnly', nodes.reportOnly)
    .addNode('summarize', nodes.summarize)

    // Entry point
    .addEdge('__start__', 'classifyFailure')

    // Conditional routing after classification
    .addConditionalEdges('classifyFailure', routeAfterClassification, {
      healTestCase: 'healTestCase',
      reportOnly: 'reportOnly',
    })

    // Both paths converge to summarize
    .addEdge('healTestCase', 'summarize')
    .addEdge('reportOnly', 'summarize')

    // Exit
    .addEdge('summarize', END);

  return graph.compile();
}

module.exports = { createHealingGraph };
