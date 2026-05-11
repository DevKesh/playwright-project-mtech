/**
 * Cost Tracker: records OpenAI API token usage and estimated costs per healing session.
 *
 * Pricing (as of 2025):
 *   GPT-4o:      $2.50 / 1M input tokens,  $10.00 / 1M output tokens
 *   GPT-4o-mini: $0.15 / 1M input tokens,  $0.60  / 1M output tokens
 *
 * Data is appended to ai-reports/cost-log.json and read by the reporter
 * for Allure environment injection.
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.resolve(__dirname, '../../../ai-reports');
const COST_LOG = path.join(REPORTS_DIR, 'cost-log.json');

// Pricing per 1M tokens (USD)
const MODEL_PRICING = {
  'gpt-4o':      { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readCostLog() {
  try {
    if (fs.existsSync(COST_LOG)) {
      return JSON.parse(fs.readFileSync(COST_LOG, 'utf-8'));
    }
  } catch {
    // Corrupted file, start fresh
  }
  return [];
}

/**
 * Record a single API call's token usage and estimated cost.
 * @param {{ model: string, promptTokens: number, completionTokens: number, totalTokens: number, method: string }} entry
 */
function appendCostEntry(entry) {
  ensureDir(REPORTS_DIR);
  const log = readCostLog();

  const pricing = MODEL_PRICING[entry.model] || MODEL_PRICING['gpt-4o-mini'];
  const inputCost = (entry.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (entry.completionTokens / 1_000_000) * pricing.output;

  log.push({
    model: entry.model,
    method: entry.method,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    totalTokens: entry.totalTokens,
    estimatedCostUSD: +(inputCost + outputCost).toFixed(6),
    timestamp: new Date().toISOString(),
  });

  fs.writeFileSync(COST_LOG, JSON.stringify(log, null, 2), 'utf-8');
}

/**
 * Get a summary of costs for the current session (all entries in the log).
 * @returns {{ totalCalls: number, totalTokens: number, totalPromptTokens: number, totalCompletionTokens: number, totalCostUSD: number, byModel: Object }}
 */
function getCostSummary() {
  const log = readCostLog();
  const summary = {
    totalCalls: log.length,
    totalTokens: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCostUSD: 0,
    byModel: {},
  };

  for (const entry of log) {
    summary.totalTokens += entry.totalTokens || 0;
    summary.totalPromptTokens += entry.promptTokens || 0;
    summary.totalCompletionTokens += entry.completionTokens || 0;
    summary.totalCostUSD += entry.estimatedCostUSD || 0;

    if (!summary.byModel[entry.model]) {
      summary.byModel[entry.model] = { calls: 0, tokens: 0, costUSD: 0 };
    }
    summary.byModel[entry.model].calls++;
    summary.byModel[entry.model].tokens += entry.totalTokens || 0;
    summary.byModel[entry.model].costUSD += entry.estimatedCostUSD || 0;
  }

  summary.totalCostUSD = +summary.totalCostUSD.toFixed(6);
  for (const m of Object.keys(summary.byModel)) {
    summary.byModel[m].costUSD = +summary.byModel[m].costUSD.toFixed(6);
  }

  return summary;
}

/**
 * Clear the cost log (used at the start of a new run).
 */
function clearCostLog() {
  ensureDir(REPORTS_DIR);
  fs.writeFileSync(COST_LOG, '[]', 'utf-8');
}

module.exports = { appendCostEntry, getCostSummary, clearCostLog, readCostLog, COST_LOG };
