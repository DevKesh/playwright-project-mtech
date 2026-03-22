/**
 * Exploration Conditions: routing functions for the exploration graph.
 */

/**
 * Route after page discovery.
 * If there are unvisited URLs in the queue and we haven't hit maxPages, crawl more.
 * Otherwise, proceed to app analysis.
 */
function routeAfterDiscover(state) {
  const hasMore = state.urlQueue && state.urlQueue.length > 0;
  const underLimit = state.visitedPages && state.visitedPages.length < state.maxPages;

  if (hasMore && underLimit) {
    return 'crawlNext';
  }
  return 'analyzeApp';
}

module.exports = { routeAfterDiscover };
