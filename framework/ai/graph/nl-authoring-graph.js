/**
 * NL Authoring Graph: LangGraph state machine for natural language
 * test authoring — describe tests in English, watch them execute in a
 * browser, get proper test scripts with page objects and fixtures.
 *
 * Graph flow:
 *   __start__ → parseInstructions → launchBrowser → executeStep → [routeAfterStep]
 *                                                                   ├→ executeStep (loop)
 *                                                                   └→ generateArtifacts → writeFiles → END
 */

const { StateGraph, END } = require('@langchain/langgraph');
const { NLAuthoringState } = require('./nl-authoring-state');
const { createNLAuthoringNodes } = require('./nl-authoring-nodes');
const { routeAfterStep } = require('./nl-authoring-conditions');

/**
 * Build the NL test authoring graph.
 * @param {object} config - AI config from ai.config.js
 * @returns {CompiledGraph} A compiled LangGraph ready to invoke.
 */
function createNLAuthoringGraph(config) {
  const nodes = createNLAuthoringNodes(config);

  const graph = new StateGraph(NLAuthoringState)
    // Register nodes
    .addNode('parseInstructions', nodes.parseInstructions)
    .addNode('launchBrowser', nodes.launchBrowser)
    .addNode('executeStep', nodes.executeStep)
    .addNode('generateArtifacts', nodes.generateArtifacts)
    .addNode('writeFiles', nodes.writeFiles)

    // Entry: parse NL instructions first
    .addEdge('__start__', 'parseInstructions')
    .addEdge('parseInstructions', 'launchBrowser')
    .addEdge('launchBrowser', 'executeStep')

    // Step execution loop
    .addConditionalEdges('executeStep', routeAfterStep, {
      executeStep: 'executeStep',
      generateArtifacts: 'generateArtifacts',
    })

    // Linear pipeline: generate → write → done
    .addEdge('generateArtifacts', 'writeFiles')
    .addEdge('writeFiles', END);

  return graph.compile();
}

module.exports = { createNLAuthoringGraph };
