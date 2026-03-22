/**
 * Runtime Healing Graph: multi-strategy locator healing during test execution.
 *
 * When a locator action fails, this graph tries multiple healing strategies
 * in sequence (CSS → role-based → text-based) before giving up.
 *
 * Graph flow:
 *   LOCATOR FAILED → tryHealLocator → healed?
 *     yes → END (success)
 *     no  → attempts left? → nextStrategy → tryHealLocator (loop)
 *     no  → exhausted → END (failure)
 *
 * Usage:
 *   const graph = createRuntimeHealingGraph(config);
 *   const result = await graph.invoke({ page, failedSelector, error, ... });
 *   if (result.healed) { retry action with result.healedSelector }
 */

const { StateGraph, END } = require('@langchain/langgraph');
const { RuntimeHealingState } = require('./state');
const { createNodes } = require('./nodes');
const { routeAfterHealAttempt } = require('./conditions');

/**
 * Build the runtime locator healing graph.
 * @param {object} config - AI config from ai.config.js
 * @returns {CompiledGraph} A compiled LangGraph ready to invoke.
 */
function createRuntimeHealingGraph(config) {
  const nodes = createNodes(config);

  const graph = new StateGraph(RuntimeHealingState)
    // Register nodes
    .addNode('tryHealLocator', nodes.tryHealLocator)
    .addNode('nextStrategy', nodes.nextStrategy)

    // Entry point
    .addEdge('__start__', 'tryHealLocator')

    // After each attempt: route based on success/exhaustion
    .addConditionalEdges('tryHealLocator', routeAfterHealAttempt, {
      nextStrategy: 'nextStrategy',
      __end__: END,
    })

    // After switching strategy, try again (this creates the retry loop)
    .addEdge('nextStrategy', 'tryHealLocator');

  return graph.compile();
}

module.exports = { createRuntimeHealingGraph };
