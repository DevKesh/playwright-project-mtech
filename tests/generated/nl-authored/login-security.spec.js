const { test } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { setTimeout: pace } = require('node:timers/promises');
const { LoginPage } = require('../../../framework/pages/generated/smoke/LoginPage');
const {
  securitySettings, uniqueInvalidCredentials, observeLoginNetwork,
  stopSignal,
} = require('../../../framework/utils/login-security');

const settings = securitySettings();
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test.describe('@nl-authored @login-security Synthetic invalid credentials', () => {
  test.describe.configure({ mode: 'serial', retries: 0 });
  let context, page, network, runId, audit;

  async function saveAudit() {
    const folder = path.resolve('test-results/login-security');
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'security-audit.json'), JSON.stringify(audit, null, 2));
  }

  test.beforeAll(async ({ browser }) => {
    if (process.env.LOGIN_SECURITY_APPROVED !== 'true') throw new Error('Explicit security-test approval is required.');
    runId = randomUUID();
    audit = {
      runId, target: 'QA2', startedAt: new Date().toISOString(), requestedAttempts: settings.attempts,
      minimumGapMs: settings.intervalMs, attempts: [], status: 'running',
      scope: 'Submission only. No assertions about rejection, authentication success or attack prevention.',
    };
    await saveAudit();
    // Keep the SAME browser context/cookies/device across attempts. Never reset
    // or rotate them in response to a challenge to get around security controls.
    context = await browser.newContext({ baseURL: 'https://qa2.totalconnect2.com' });
    page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(45000);
    network = observeLoginNetwork(page);
    await new LoginPage(page).dismissCookieConsent();
  });

  test.afterAll(async () => {
    try {
      if (audit) {
        audit.finishedAt = new Date().toISOString();
        audit.pageErrorCount = network?.pageErrors || 0;
        if (audit.status === 'running') audit.status = 'incomplete';
        await saveAudit();
      }
    } finally {
      network?.close();
      await context?.close();
    }
  });

  // Generate individual reportable tests, not repeated submits within a test.
  // Serial mode + maxFailures=1 stops the run; no worker restart can resume it.
  Array.from({ length: settings.attempts }, (_, index) => {
    const attempt = index + 1;
    test(`Attempt ${String(attempt).padStart(3, '0')}: submit unique synthetic credentials`, async ({}, testInfo) => {
      test.skip(audit.status === 'stopped', `Run stopped: ${audit.stopReason}`);
      const credentials = uniqueInvalidCredentials(attempt, runId);
      const record = { attempt, username: credentials.username, submitted: false, outcome: 'not_submitted' };
      const networkStart = network.responses.length;
      audit.attempts.push(record);
      try {
        const before = await stopSignal(page, network);
        if (before) {
          audit.status = 'stopped';
          audit.stopReason = before;
          record.outcome = 'stopped_before_submission';
          test.skip(true, `Safety stop: ${before}`);
        }
        await test.step('Open the public login form', async () => {
          await page.goto('/login', { waitUntil: 'domcontentloaded' });
          const stop = await stopSignal(page, network);
          if (stop) {
            audit.status = 'stopped';
            audit.stopReason = stop;
            record.outcome = 'stopped_before_submission';
            test.skip(true, `Safety stop: ${stop}`);
          }
          await new LoginPage(page).dismissCookieConsent();
        });
        await test.step('Fill unique credentials and click Sign In once', async () => {
          const login = new LoginPage(page);
          // Same fields and submit method as existing LoginPage; no response assertions.
          record.startedAt = new Date().toISOString();
          await login.login(credentials.username, credentials.password);
          record.submitted = true;
          record.outcome = 'submitted_without_assertions';
        });
        // Allow the response to settle and maintain a bounded request rate.
        await pace(settings.intervalMs);
        const after = await stopSignal(page, network);
        if (after) {
          audit.status = 'stopped';
          audit.stopReason = after;
          record.stopReason = after;
          testInfo.annotations.push({ type: 'safety-stop', description: after });
        } else {
          audit.status = attempt === settings.attempts ? 'completed_submissions' : 'running';
        }
      } catch (error) {
        if (record.outcome === 'stopped_before_submission') throw error;
        // Do not rethrow raw Playwright errors: fill errors can echo passwords.
        record.outcome = 'automation_error';
        audit.status = 'stopped';
        audit.stopReason = record.outcome;
        throw new Error(`Submission stopped at attempt ${attempt}: automation error. See sanitized audit; no retries.`);
      } finally {
        record.finishedAt = new Date().toISOString();
        record.httpResponses = network.responses.slice(networkStart);
        await saveAudit();
        await testInfo.attach('security-observation', {
          body: Buffer.from(JSON.stringify(record, null, 2)), contentType: 'application/json',
        });
        console.log(`[login-security] attempt=${attempt} outcome=${record.outcome} submitted=${record.submitted}`);
      }
    });
  });
});