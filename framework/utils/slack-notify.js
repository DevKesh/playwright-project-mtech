/**
 * Slack Notification Utility
 * Zero-dependency — uses built-in Node.js https module.
 * Reads Allure summary.json for test counts and sends a color-coded message.
 *
 * Required env vars:
 *   SLACK_WEBHOOK_URL — Slack incoming webhook URL
 *   GITHUB_RUN_URL   — Link to the GitHub Actions run
 *   REPORT_URL       — Link to the published Allure report
 *
 * Optional env vars:
 *   TEST_OUTCOME     — 'success' | 'failure' (from GH Actions step outcome)
 *   HEAL_ENABLED     — whether AI healing was enabled
 *   TEST_SUITE_NAME  — displayed suite name (defaults to Playwright Smoke Suite)
 *   SLACK_REQUIRED   — fail instead of silently skipping a missing webhook
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const runtime = require('../config/runtime.config');

function readReportSummary(directory) {
  for (const relativePath of ['summary.json', path.join('widgets', 'summary.json')]) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(directory, relativePath), 'utf8'));
      if (data.stats?.total > 0) {
        const { passed = 0, failed = 0, broken = 0, skipped = 0, unknown = 0, total } = data.stats;
        const unaccounted = Math.max(0, total - passed - failed - broken - skipped - unknown);
        return {
          statistic: { passed, failed, broken, skipped, unknown: unknown + unaccounted, total },
          time: { duration: data.duration || 0 },
          reportStatus: data.status,
        };
      }
      if (data.statistic?.total > 0) return data;
    } catch {}
  }
  return null;
}

function loadSummary() {
  const reportDir = path.resolve(process.cwd(), process.env.SLACK_REPORT_DIR || 'allure-report');
  const resultsDir = path.resolve(process.cwd(), process.env.SLACK_RESULTS_DIR || 'allure-results');
  const report = readReportSummary(reportDir);
  if (report) return report;

  try {
    const files = fs.readdirSync(resultsDir, { recursive: true }).filter(file => file.endsWith('-result.json'));
    if (files.length > 0) {
      const statistic = { passed: 0, failed: 0, broken: 0, skipped: 0, unknown: 0, total: 0 };
      let minStart = Infinity, maxStop = 0;
      for (const file of files) {
        const result = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
        const status = ['passed', 'failed', 'broken', 'skipped'].includes(result.status) ? result.status : 'unknown';
        statistic[status]++;
        statistic.total++;
        if (Number.isFinite(result.start)) minStart = Math.min(minStart, result.start);
        if (Number.isFinite(result.stop)) maxStop = Math.max(maxStop, result.stop);
      }
      console.log(`[SlackNotify] Built summary from ${resultsDir}: ${statistic.total} results`);
      return { statistic, time: { duration: Number.isFinite(minStart) ? Math.max(0, maxStop - minStart) : 0 } };
    }
  } catch {}

  if (process.env.CI !== 'true' && !process.env.SLACK_REPORT_DIR && !process.env.SLACK_RESULTS_DIR &&
      !fs.existsSync(reportDir) && !fs.existsSync(resultsDir)) {
    const historyDir = path.resolve(process.cwd(), 'allure-reports-history');
    try {
      const latest = fs.readdirSync(historyDir).filter(folder => folder.startsWith('allure-report-')).sort().reverse()[0];
      if (latest) return readReportSummary(path.join(historyDir, latest));
    } catch {}
  }
  return null;
}

function buildMessage(summary) {
  // Guard: when total=0, Allure 3.x emits status:'passed' (vacuous truth — no failures = passed).
  // Never trust reportStatus when there are no results; fall back to TEST_OUTCOME env var instead.
  const totalTests = summary?.statistic?.total || 0;

  // Determine outcome — use Allure 3.x 'status' field first (most reliable),
  // then check stats, then fall back to env var
  let outcome;
  if (totalTests === 0) {
    outcome = process.env.TEST_OUTCOME === 'failure' ? 'failure' : 'unknown';
    console.log(`[SlackNotify] total=0 — ignoring Allure status, using TEST_OUTCOME: "${outcome}"`);
  } else if (summary && summary.reportStatus) {
    // Allure 3.x provides an explicit 'passed' or 'failed' status
    outcome = summary.reportStatus === 'passed' ? 'success' : 'failure';
  } else if (summary && summary.statistic) {
    outcome = (summary.statistic.failed === 0 && summary.statistic.total > 0 && summary.statistic.passed === summary.statistic.total) ? 'success' : 'failure';
  } else {
    outcome = process.env.TEST_OUTCOME || 'unknown';
  }
  const passed = outcome === 'success';
  const color = passed ? '#2eb886' : '#e01e5a';
  const icon = passed ? ':large_green_circle:' : ':red_circle:';
  const status = totalTests === 0
    ? (outcome === 'failure' ? 'TESTS FAILED - RESULTS UNAVAILABLE' : 'RESULTS UNAVAILABLE')
    : passed ? 'ALL TESTS PASSED' : 'TESTS FAILED';

  const runUrl = process.env.GITHUB_RUN_URL || '';
  const reportUrl = process.env.REPORT_URL || '';
  const suiteName = process.env.TEST_SUITE_NAME || 'Playwright Smoke Suite';
  const healEnabled = process.env.HEAL_ENABLED !== undefined
    ? process.env.HEAL_ENABLED === 'true'
    : runtime.ai.healingEnabled;
  const timestamp = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  // Execution platform detection
  const isLambda = runtime.lambda && runtime.lambda.isLambda;
  const isCI = process.env.CI === 'true';
  const platformLabel = isLambda
    ? ':cloud: LambdaTest Cloud'
    : isCI
      ? ':github: GitHub Actions (CI)'
      : ':computer: Local';
  const ltBuild = isLambda ? (runtime.lambda.buildName || process.env.LT_BUILD_NAME || '') : '';

  // Build stats
  let total = 0, pass = 0, fail = 0, broken = 0, skipped = 0;
  if (summary && summary.statistic) {
    const s = summary.statistic;
    total = s.total || 0;
    pass = s.passed || 0;
    fail = s.failed || 0;
    broken = s.broken || 0;
    skipped = s.skipped || 0;
  }

  let duration = 'N/A';
  if (totalTests > 0 && summary && summary.time) {
    const ms = summary.time.duration || 0;
    const seconds = Math.round(ms / 1000);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    duration = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  }

  // Build the stats line with emoji indicators
  const statsLine = total > 0
    ? `:white_check_mark: ${pass}  :x: ${fail}  :warning: ${broken}  :fast_forward: ${skipped}  |  *${total} total*`
    : '_Test counts could not be loaded. Check the pipeline artifacts and result paths._';

  // Progress bar visualization
  let progressBar = '';
  if (total > 0) {
    const passRatio = Math.round((pass / total) * 10);
    const failRatio = Math.round((fail / total) * 10);
    const rest = 10 - passRatio - failRatio;
    progressBar = '\u2705'.repeat(passRatio) + '\u274C'.repeat(failRatio) + '\u2B1C'.repeat(Math.max(0, rest));
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${icon}  *${status}*\n_${suiteName}_`,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Test Results*\n${statsLine}${progressBar ? '\n' + progressBar : ''}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*:clock1: Duration*\n${duration}` },
        { type: 'mrkdwn', text: `*:rocket: Platform*\n${platformLabel}` },
        { type: 'mrkdwn', text: `*:gear: Environment*\n\`${runtime.mode.toUpperCase()}\`` },
        { type: 'mrkdwn', text: `*:robot_face: AI Healing*\n${healEnabled ? ':white_check_mark: Active' : ':no_entry_sign: Disabled'}` },
        { type: 'mrkdwn', text: `*:calendar: Executed*\n${timestamp}` },
        ...(isLambda ? [{ type: 'mrkdwn', text: `*:label: LT Build*\n\`${ltBuild}\`` }] : []),
      ],
    },
  ];

  // Add action buttons only when URLs exist
  if (runUrl || reportUrl) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'actions',
      elements: [
        ...(runUrl ? [{ type: 'button', text: { type: 'plain_text', text: ':github: View Pipeline Run', emoji: true }, url: runUrl }] : []),
        ...(reportUrl ? [{ type: 'button', text: { type: 'plain_text', text: ':bar_chart: Allure Report', emoji: true }, url: reportUrl, style: 'primary' }] : []),
      ],
    });
  }

  // Add footer context
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `_Sent by QA Playwright Execution Pipeline  •  Platform: ${isLambda ? 'LambdaTest' : isCI ? 'GitHub Actions' : 'Local'}  •  Browser: ${runtime.browser.channel}  •  Headless: ${runtime.browser.headless}_` },
    ],
  });

  const notificationText = totalTests > 0
    ? `${icon} ${status} — Passed: ${pass}, Failed: ${fail}, Total: ${total}`
    : `${icon} ${status} — Test counts unavailable`;
  return {
    text: notificationText,
    attachments: [
      {
        color,
        fallback: notificationText,
        blocks,
      },
    ],
  };
}

function sendWebhook(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const transport = url.protocol === 'https:' ? https : http;
    const data = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`Slack responded with ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  if (!runtime.reporting.slackEnabled) {
    console.log('[SlackNotify] Slack notifications disabled in runtime config — skipping.');
    process.exit(0);
  }

  const webhookUrl = runtime.reporting.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    if (process.env.SLACK_REQUIRED === 'true') {
      console.error('[SlackNotify] SLACK_WEBHOOK_URL is required for this workflow.');
      process.exit(1);
    }
    console.log('[SlackNotify] SLACK_WEBHOOK_URL not set — skipping notification.');
    process.exit(0);
  }

  const summary = loadSummary();
  const payload = buildMessage(summary);

  try {
    const response = await sendWebhook(webhookUrl, payload);
    console.log(`[SlackNotify] Notification sent successfully. Response: ${response}`);
  } catch (err) {
    console.error('[SlackNotify] Failed to send notification:', err.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { buildMessage, loadSummary };
