/**
 * Runtime Configuration — Single source of truth for LOCAL vs CI/CD behavior.
 *
 * How it works:
 *   1. Auto-detects CI from process.env.CI
 *   2. Loads .env file (if present) for local overrides
 *   3. Exports clean flags consumed by specs, reporters, and utilities
 *
 * Usage:
 *   const runtime = require('../config/runtime.config');
 *   if (runtime.browser.headless) { ... }
 */

const { getAccount } = require('./accounts');

// ─── Detect execution mode ──────────────────────────────────────────────────
const isCI = process.env.CI === 'true';
const mode = process.env.RUN_MODE || (isCI ? 'ci' : 'local');

// ─── Export runtime configuration ───────────────────────────────────────────
module.exports = {
  /** true when running in GitHub Actions / Jenkins / Azure Pipelines */
  isCI,

  /** 'local' | 'ci' — can be forced via RUN_MODE env var */
  mode,

  browser: {
    /** Headless in CI, headed locally (override with HEADLESS=true|false) */
    headless: process.env.HEADLESS !== undefined
      ? process.env.HEADLESS === 'true'
      : isCI,

    /** Browser channel */
    channel: process.env.BROWSER_CHANNEL || 'chrome',

    /** Slow-mo for debugging (ms) — 0 in CI */
    slowMo: parseInt(process.env.SLOW_MO || (isCI ? '0' : '0'), 10),
  },

  reporting: {
    /** Auto-open Allure report after test run */
    openAfterRun: process.env.OPEN_REPORT !== undefined
      ? process.env.OPEN_REPORT === 'true'
      : !isCI,

    /** Send Slack notification */
    slackEnabled: process.env.SLACK_ENABLED !== undefined
      ? process.env.SLACK_ENABLED === 'true'
      : isCI,

    /** Slack webhook URL */
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  },

  get credentials() {
    return { ...getAccount('configured'), displayName: process.env.TC_DISPLAY_NAME || '' };
  },

  ai: {
    /** Enable AI self-healing on failures */
    healingEnabled: process.env.AI_HEALING_ENABLED === 'true',

    /** OpenAI API key for healing agent */
    openaiApiKey: process.env.OPENAI_API_KEY || '',
  },

  /** Timeouts (ms) */
  timeouts: {
    navigation: parseInt(process.env.NAV_TIMEOUT || (isCI ? '30000' : '15000'), 10),
    action: parseInt(process.env.ACTION_TIMEOUT || (isCI ? '15000' : '10000'), 10),
    test: parseInt(process.env.TEST_TIMEOUT || (isCI ? '120000' : '60000'), 10),
  },

  /** LambdaTest Cloud Execution Configuration */
  lambda: {
    /** Execution platform: 'local' (default) | 'lambda' */
    platform: process.env.EXECUTION_PLATFORM || 'local',

    /** LambdaTest credentials */
    username: process.env.LT_USERNAME || '',
    accessKey: process.env.LT_ACCESS_KEY || '',

    /** Build & project identification on LambdaTest dashboard
     *  Auto-generates: TC2-{TestType}-YYYY-MM-DD_HH-MM-SS
     *  TestType derived from npm script name or defaults to 'Run'
     */
    buildName: process.env.LT_BUILD_NAME || (() => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const script = process.env.npm_lifecycle_event || '';
      let suite = 'Full Test Run';
      if (script.includes('smoke')) suite = 'Smoke Suite (8 TCs)';
      else if (script.includes('plan')) suite = 'Test Plan - All Tagged';
      else if (script.includes('regression')) suite = 'Regression Suite';
      else if (script.includes('generated')) suite = 'Generated Tests';
      else if (script.includes('heal')) suite = 'AI Healing Run';
      return `TotalConnect QA - ${suite} - ${dateStr} ${timeStr}`;
    })(),
    projectName: process.env.LT_PROJECT_NAME || 'TC2-Automation',

    /** Browser capabilities */
    browserName: process.env.LT_BROWSER || 'Chrome',
    browserVersion: process.env.LT_BROWSER_VERSION || 'latest',
    platformName: process.env.LT_PLATFORM || 'Windows 11',
    resolution: process.env.LT_RESOLUTION || '1920x1080',

    /** Recording & debugging options */
    video: process.env.LT_VIDEO !== 'false',
    console: process.env.LT_CONSOLE !== 'false',
    network: process.env.LT_NETWORK !== 'false',

    /** LambdaTest Tunnel (for internal/private apps) */
    tunnel: process.env.LT_TUNNEL === 'true',
    tunnelName: process.env.LT_TUNNEL_NAME || '',

    /** Helper: true when running on LambdaTest */
    get isLambda() {
      return this.platform === 'lambda';
    },
  },
};
