/**
 * Append-only storage for healing events and run history.
 * Uses JSON files in the ai-reports/ directory.
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.resolve(__dirname, '../../../ai-reports');
const HEALING_LOG = path.join(REPORTS_DIR, 'healing-log.json');
const RUN_HISTORY = path.join(REPORTS_DIR, 'run-history.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJSONFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    // Corrupted file, start fresh
  }
  return [];
}

function writeJSONFile(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Append a healing event to the healing log.
 * @param {object} entry - Healing event data.
 */
function appendHealingEvent(entry) {
  const log = readJSONFile(HEALING_LOG);
  log.push({
    ...entry,
    correlationId: entry.correlationId || null,
    timestamp: entry.timestamp || new Date().toISOString(),
  });
  writeJSONFile(HEALING_LOG, log);
}

/**
 * Load the full healing log.
 * @returns {Array<object>}
 */
function loadHealingLog() {
  return readJSONFile(HEALING_LOG);
}

/**
 * Append a test run result to the run history.
 * @param {object} runData - { runId, tests: [{ testFile, testTitle, status, duration, error }] }
 */
function appendRunHistory(runData) {
  const history = readJSONFile(RUN_HISTORY);
  history.push({
    ...runData,
    timestamp: new Date().toISOString(),
  });
  // Keep last 50 runs
  if (history.length > 50) {
    history.splice(0, history.length - 50);
  }
  writeJSONFile(RUN_HISTORY, history);
}

/**
 * Load the full run history.
 * @returns {Array<object>}
 */
function loadRunHistory() {
  return readJSONFile(RUN_HISTORY);
}

module.exports = {
  appendHealingEvent,
  loadHealingLog,
  appendRunHistory,
  loadRunHistory,
  REPORTS_DIR,
};
