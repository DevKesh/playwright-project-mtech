/**
 * Graph Conditions: edge routing functions that determine which
 * node to execute next based on the current graph state.
 *
 * Each function receives the state and returns the name of the
 * next node (matching the node names registered in the graph).
 */

// Failure categories that indicate locator issues
const LOCATOR_CATEGORIES = new Set(['locator_broken', 'element_not_found']);

// Failure categories that indicate test logic issues
const LOGIC_CATEGORIES = new Set(['assertion_mismatch', 'data_issue', 'app_bug']);

// Failure categories where healing is not applicable
const INFRA_CATEGORIES = new Set(['network_error', 'timeout', 'unknown']);

/**
 * Route after failure classification.
 * Determines which healing path to take based on the failure category.
 */
function routeAfterClassification(state) {
  const category = state.failureCategory;

  if (LOCATOR_CATEGORIES.has(category)) {
    // Locator issues already have runtime healing via the proxy.
    // If we reach post-mortem, runtime healing didn't work.
    // Route to test case healer — maybe the flow itself changed.
    return 'healTestCase';
  }

  if (LOGIC_CATEGORIES.has(category)) {
    return 'healTestCase';
  }

  if (INFRA_CATEGORIES.has(category)) {
    return 'reportOnly';
  }

  // Default: try test case healing for anything unclassified
  return 'healTestCase';
}

/**
 * Route after a locator healing attempt in the runtime graph.
 * Determines whether to try again, switch strategy, or give up.
 */
function routeAfterHealAttempt(state) {
  // If healed successfully, we're done
  if (state.healed) {
    return '__end__';
  }

  // If we've exhausted all attempts, give up
  if (state.attemptCount >= state.maxAttempts) {
    return '__end__';
  }

  // If current strategy is exhausted, give up
  if (state.currentStrategy === 'exhausted') {
    return '__end__';
  }

  // Try the next strategy
  return 'nextStrategy';
}

module.exports = {
  routeAfterClassification,
  routeAfterHealAttempt,
  LOCATOR_CATEGORIES,
  LOGIC_CATEGORIES,
  INFRA_CATEGORIES,
};
