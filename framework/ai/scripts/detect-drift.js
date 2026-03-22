/**
 * CLI script: Drift Detection
 *
 * Launches a headless browser, navigates to each page that a page object
 * targets, and validates all locators against the live DOM.
 *
 * Usage: node framework/ai/scripts/detect-drift.js
 * Requires: OPENAI_API_KEY environment variable
 */

const { chromium } = require('playwright');
const path = require('path');
const { DriftDetectionAgent } = require('../agents/drift-detection.agent');
const { loadAIConfig } = require('../config/ai.config');
const { writeReport } = require('../storage/report-writer');

// Map page objects to the URLs they target
const PAGE_OBJECT_URLS = [
  {
    file: path.resolve(__dirname, '../../pages/AuthPage.js'),
    urls: [
      'https://rahulshettyacademy.com/client/auth/login',
    ],
  },
  {
    file: path.resolve(__dirname, '../../pages/ProductsPage.js'),
    urls: [
      'https://rahulshettyacademy.com/client/dashboard/dash',
    ],
    requiresAuth: true,
  },
];

// Credentials for pages that require authentication
const AUTH_CREDENTIALS = {
  email: 'rahulshettyacademy@gmail.com',
  password: 'Iamking@000',
};

async function loginAndGetContext(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Log in to get an authenticated session
  await page.goto('https://rahulshettyacademy.com/client/auth/login');
  await page.locator('#userEmail').fill(AUTH_CREDENTIALS.email);
  await page.locator('#userPassword').fill(AUTH_CREDENTIALS.password);
  await page.locator('#login').click();
  await page.waitForURL(/.*\/dashboard/, { timeout: 15000 });
  await page.close();

  return context;
}

async function main() {
  const config = loadAIConfig();
  // Override: always enable for CLI scripts
  config.enabled = true;

  if (!config.openaiApiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is required.');
    process.exit(1);
  }

  const agent = new DriftDetectionAgent(config);
  const browser = await chromium.launch({ headless: true });

  let authContext = null;

  console.log('=== AI Drift Detection ===\n');

  for (const entry of PAGE_OBJECT_URLS) {
    const basename = path.basename(entry.file, '.js');

    for (const url of entry.urls) {
      let page;

      if (entry.requiresAuth) {
        if (!authContext) {
          console.log('Authenticating for protected pages...');
          authContext = await loginAndGetContext(browser);
        }
        page = await authContext.newPage();
      } else {
        const context = await browser.newContext();
        page = await context.newPage();
      }

      console.log(`Checking ${basename} against ${url}...`);

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        const report = await agent.detectDrift(page, entry.file);

        const filename = `drift-${basename}-${Date.now()}.json`;
        const filePath = writeReport('drift-reports', filename, report);
        console.log(`  Report saved: ${filePath}`);
        console.log(`  Summary: ${report.summary}`);

        // Print drift items
        const broken = (report.driftItems || []).filter((d) => d.status === 'broken');
        const fragile = (report.driftItems || []).filter((d) => d.status === 'fragile');
        const newEls = report.newElements || [];

        if (broken.length > 0) {
          console.log(`  BROKEN locators (${broken.length}):`);
          broken.forEach((d) => console.log(`    - ${d.propertyName}: ${d.explanation}`));
        }
        if (fragile.length > 0) {
          console.log(`  Fragile locators (${fragile.length}):`);
          fragile.forEach((d) => console.log(`    - ${d.propertyName}: ${d.explanation}`));
        }
        if (newEls.length > 0) {
          console.log(`  New elements not covered (${newEls.length}):`);
          newEls.forEach((e) => console.log(`    - ${e.suggestedPropertyName}: ${e.description}`));
        }
      } catch (err) {
        console.error(`  Error analyzing ${basename} at ${url}: ${err.message}`);
      } finally {
        await page.close();
      }

      console.log('');
    }
  }

  await browser.close();
  console.log('Drift detection complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
