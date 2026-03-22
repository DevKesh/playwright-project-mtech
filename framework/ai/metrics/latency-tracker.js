/**
 * Latency Tracker: decorates AIClient to record per-call inference timing.
 *
 * Wraps chatCompletionJSON and visionCompletionJSON methods with timing
 * instrumentation. All latency data is appended to ai-reports/latency-log.json.
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.resolve(__dirname, '../../../ai-reports');
const LATENCY_LOG = path.join(REPORTS_DIR, 'latency-log.json');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readLatencyLog() {
  try {
    if (fs.existsSync(LATENCY_LOG)) {
      return JSON.parse(fs.readFileSync(LATENCY_LOG, 'utf-8'));
    }
  } catch {
    // Corrupted file, start fresh
  }
  return [];
}

function appendLatencyEntry(entry) {
  ensureDir(REPORTS_DIR);
  const log = readLatencyLog();
  log.push(entry);
  fs.writeFileSync(LATENCY_LOG, JSON.stringify(log, null, 2), 'utf-8');
}

/**
 * Wrap an AIClient instance to track call latencies.
 * Uses the decorator pattern — the original client methods are replaced
 * with timed versions that log to latency-log.json.
 *
 * @param {object} aiClient - An AIClient instance.
 * @returns {object} The same instance with wrapped methods.
 */
function wrapWithLatencyTracking(aiClient) {
  const originalChat = aiClient.chatCompletionJSON.bind(aiClient);
  const originalVision = aiClient.visionCompletionJSON.bind(aiClient);

  aiClient.chatCompletionJSON = async function (systemPrompt, userPrompt, options = {}) {
    const start = Date.now();
    try {
      const result = await originalChat(systemPrompt, userPrompt, options);
      const durationMs = Date.now() - start;
      appendLatencyEntry({
        method: 'chatCompletionJSON',
        model: options.model || 'default',
        durationMs,
        success: true,
        promptLength: (systemPrompt || '').length + (userPrompt || '').length,
        timestamp: new Date().toISOString(),
      });
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      appendLatencyEntry({
        method: 'chatCompletionJSON',
        model: options.model || 'default',
        durationMs,
        success: false,
        error: err.message,
        promptLength: (systemPrompt || '').length + (userPrompt || '').length,
        timestamp: new Date().toISOString(),
      });
      throw err;
    }
  };

  aiClient.visionCompletionJSON = async function (systemPrompt, textPrompt, imageBuffer, options = {}) {
    const start = Date.now();
    try {
      const result = await originalVision(systemPrompt, textPrompt, imageBuffer, options);
      const durationMs = Date.now() - start;
      appendLatencyEntry({
        method: 'visionCompletionJSON',
        model: options.model || 'default',
        durationMs,
        success: true,
        promptLength: (systemPrompt || '').length + (textPrompt || '').length,
        imageSize: imageBuffer ? imageBuffer.length : 0,
        timestamp: new Date().toISOString(),
      });
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      appendLatencyEntry({
        method: 'visionCompletionJSON',
        model: options.model || 'default',
        durationMs,
        success: false,
        error: err.message,
        promptLength: (systemPrompt || '').length + (textPrompt || '').length,
        timestamp: new Date().toISOString(),
      });
      throw err;
    }
  };

  return aiClient;
}

module.exports = { wrapWithLatencyTracking, readLatencyLog, LATENCY_LOG };
