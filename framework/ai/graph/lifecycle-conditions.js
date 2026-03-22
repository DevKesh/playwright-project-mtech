/**
 * Lifecycle Conditions: routing functions for the 6-phase lifecycle graph.
 */

/**
 * Route after the checkpoint node.
 * If mode is 'pre', stop here. Otherwise continue to synthesis.
 */
function routeAfterCheckpoint(state) {
  if (state.mode === 'pre') {
    return '__end__';
  }
  return 'synthesis';
}

/**
 * Route at graph start based on mode.
 * 'post' mode skips directly to synthesis.
 * 'pre' and 'full' start from discovery.
 */
function routeFromStart(state) {
  if (state.mode === 'post') {
    return 'synthesis';
  }
  return 'discovery';
}

module.exports = { routeAfterCheckpoint, routeFromStart };
