/**
 * NL Authoring Conditions: edge routing functions for the NL test authoring graph.
 */

/**
 * After executing a step, decide whether to execute the next step or move to generation.
 */
function routeAfterStep(state) {
  if (state.currentStepIndex < state.pendingSteps.length) {
    return 'executeStep';
  }
  return 'generateArtifacts';
}

module.exports = { routeAfterStep };
