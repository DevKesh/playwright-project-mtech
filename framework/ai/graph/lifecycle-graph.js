/**
 * Lifecycle Graph: 6-phase QA lifecycle orchestration via LangGraph.
 *
 * Graph flow:
 *   ENTRY → [route by mode]
 *     mode=pre:  discovery → strategy → preExecution → checkpoint → END
 *     mode=post: synthesis → END
 *     mode=full: discovery → strategy → preExecution → checkpoint → synthesis → END
 *
 * Phases 4 (Execution) and 5 (Post-Mortem) are external:
 *   Phase 4 = npx playwright test (runtime healing via locator-proxy + runtime-graph)
 *   Phase 5 = ai-healing-reporter.js (post-mortem healing via healing-graph)
 */

const { StateGraph, END } = require('@langchain/langgraph');
const { LifecycleState } = require('./lifecycle-state');
const { createLifecycleNodes } = require('./lifecycle-nodes');
const { routeAfterCheckpoint, routeFromStart } = require('./lifecycle-conditions');

/**
 * Build the lifecycle orchestration graph.
 * @param {object} config - AI config from ai.config.js
 * @returns {CompiledGraph}
 */
function createLifecycleGraph(config) {
  const nodes = createLifecycleNodes(config);

  const graph = new StateGraph(LifecycleState)
    // Register nodes
    .addNode('router', async (state) => state) // passthrough for routing
    .addNode('discovery', nodes.discovery)
    .addNode('strategy', nodes.strategy)
    .addNode('preExecution', nodes.preExecution)
    .addNode('checkpoint', nodes.checkpoint)
    .addNode('synthesis', nodes.synthesis)

    // Entry point routes based on mode
    .addEdge('__start__', 'router')
    .addConditionalEdges('router', routeFromStart, {
      discovery: 'discovery',
      synthesis: 'synthesis',
    })

    // Linear flow: discovery → strategy → preExecution → checkpoint
    .addEdge('discovery', 'strategy')
    .addEdge('strategy', 'preExecution')
    .addEdge('preExecution', 'checkpoint')

    // After checkpoint: either end (pre mode) or continue to synthesis
    .addConditionalEdges('checkpoint', routeAfterCheckpoint, {
      synthesis: 'synthesis',
      __end__: END,
    })

    // Synthesis → END
    .addEdge('synthesis', END);

  return graph.compile();
}

module.exports = { createLifecycleGraph };
