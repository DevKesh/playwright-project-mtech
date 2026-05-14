/**
 * Healing Cache: persists successfully healed selectors so they can be
 * reused on the NEXT test run without needing another GPT call.
 *
 * Storage: ai-reports/healing-cache.json
 * Format: { "originalSelector": { healedSelector, type, confidence, healedAt, successCount } }
 *
 * On test startup, the cache is loaded into memory. When a locator is created
 * via page.locator/getByRole/etc., the cache is checked first — if a healed
 * replacement is found, it's substituted transparently.
 *
 * The cache has a TTL (default 7 days) and a success threshold (must have
 * been healed successfully at least once to be trusted).
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.resolve(__dirname, '../../../ai-reports');
const CACHE_FILE = path.join(REPORTS_DIR, 'healing-cache.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_SUCCESS_COUNT = 2; // Must succeed at least twice before being trusted from cache

let _cache = null;

/**
 * Load the healing cache from disk (lazy, singleton).
 * @returns {object} Map of originalSelector → healing entry
 */
function loadCache() {
  if (_cache !== null) return _cache;

  try {
    if (fs.existsSync(CACHE_FILE)) {
      _cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      // Prune expired entries
      const now = Date.now();
      for (const key of Object.keys(_cache)) {
        const entry = _cache[key];
        if (now - new Date(entry.healedAt).getTime() > CACHE_TTL_MS) {
          delete _cache[key];
        }
      }
    } else {
      _cache = {};
    }
  } catch {
    _cache = {};
  }

  return _cache;
}

/**
 * Persist the cache to disk.
 */
function saveCache() {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(_cache || {}, null, 2), 'utf-8');
  } catch { /* best-effort */ }
}

/**
 * Record a successful healing in the cache.
 * @param {string} originalSelector - The selector description that failed (e.g., "page.locator('#old-id')")
 * @param {string} healedSelector - The working replacement (e.g., "getByRole('button', { name: 'Submit' })")
 * @param {string} type - Locator type (locator, getByRole, getByText, etc.)
 * @param {number} confidence - GPT confidence score
 */
function cacheHealedSelector(originalSelector, healedSelector, type, confidence) {
  const cache = loadCache();
  const existing = cache[originalSelector];

  if (existing) {
    existing.healedSelector = healedSelector;
    existing.type = type;
    existing.confidence = confidence;
    existing.healedAt = new Date().toISOString();
    existing.successCount = (existing.successCount || 0) + 1;
  } else {
    cache[originalSelector] = {
      healedSelector,
      type,
      confidence,
      healedAt: new Date().toISOString(),
      successCount: 1,
    };
  }

  saveCache();
}

/**
 * Look up a previously healed selector from the cache.
 * Only returns entries that have been validated at least MIN_SUCCESS_COUNT times.
 * @param {string} originalSelector - The selector description to look up.
 * @returns {{ healedSelector: string, type: string, confidence: number } | null}
 */
function getCachedHealing(originalSelector) {
  const cache = loadCache();
  const entry = cache[originalSelector];
  if (!entry) return null;

  // Only trust entries that haven't expired
  const age = Date.now() - new Date(entry.healedAt).getTime();
  if (age > CACHE_TTL_MS) {
    delete cache[originalSelector];
    saveCache();
    return null;
  }

  // Only trust entries validated multiple times to prevent bad heals from being cached
  if ((entry.successCount || 0) < MIN_SUCCESS_COUNT) {
    return null;
  }

  return {
    healedSelector: entry.healedSelector,
    type: entry.type,
    confidence: entry.confidence,
  };
}

/**
 * Invalidate a cached entry (e.g., if the healed selector also broke).
 * @param {string} originalSelector
 */
function invalidateCachedHealing(originalSelector) {
  const cache = loadCache();
  if (cache[originalSelector]) {
    delete cache[originalSelector];
    saveCache();
  }
}

module.exports = {
  loadCache,
  cacheHealedSelector,
  getCachedHealing,
  invalidateCachedHealing,
};
