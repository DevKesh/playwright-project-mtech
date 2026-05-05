/**
 * Exploration Nodes: node functions for the LangGraph exploration graph.
 *
 * Graph flow:
 *   navigate → discoverPage → [crawlNext → discoverPage]* → analyzeApp
 *   → generatePageObjects → generateTests → writeFiles → END
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { ExploratoryAgent } = require('../agents/exploratory.agent');
const { createAIClient } = require('../core/ai-client-factory');
const { writeReport } = require('../storage/report-writer');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Load centralized test data config for generation prompts
let testDataConfig = {};
try {
  testDataConfig = require('../../config/test-data.config').testDataConfig;
} catch {
  // Config not yet created — GPT will use generic data
}

/**
 * Read an existing framework file to use as a pattern example in prompts.
 * @param {string} relativePath - Path relative to project root.
 * @returns {string} File contents or fallback message.
 */
function readPatternExample(relativePath) {
  try {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf-8');
  } catch {
    return '// Pattern example not available';
  }
}

/**
 * Normalize a URL for deduplication (remove trailing slash, hash).
 * @param {string} urlStr
 * @returns {string}
 */
function normalizeUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.origin + url.pathname.replace(/\/$/, '') + url.search;
  } catch {
    return urlStr;
  }
}

/**
 * Derive a PascalCase page name from a URL when GPT classification fails or returns "unknown".
 * @param {string} urlStr
 * @returns {string}
 */
function derivePageNameFromUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    // Use hostname for the app name part
    const hostParts = url.hostname.replace('www.', '').split('.');
    const appName = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);

    // Use pathname for the page part
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) {
      return `${appName}HomePage`;
    }

    const pagePart = pathParts
      .map(p => p.replace(/[^a-zA-Z0-9]/g, ' '))
      .map(p => p.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''))
      .join('');

    return `${appName}${pagePart}Page`;
  } catch {
    return 'AppPage';
  }
}

/**
 * Create all exploration node functions.
 * @param {object} config - AI config from ai.config.js
 * @returns {object} Node functions.
 */
function createExplorationNodes(config) {
  const agent = new ExploratoryAgent(config);

  /**
   * Phase 1: Navigate — launch browser, optionally auto-login, go to start URL.
   */
  async function navigate(state) {
    console.log(`[EXPLORE] Phase 1: Navigating to ${state.startUrl}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(state.startUrl, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (err) {
      console.log(`[EXPLORE] Navigation warning: ${err.message}. Continuing with current state.`);
    }

    // Auto-login if credentials are available and autoLogin flag is set
    const creds = testDataConfig?.targetApp?.credentials;
    const loginUrl = testDataConfig?.targetApp?.loginUrl;
    if (state.autoLogin && creds && creds.email && creds.password) {
      console.log('[EXPLORE] Auto-login: Logging in with configured credentials...');
      try {
        if (loginUrl && !page.url().includes('/login')) {
          await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
        }

        // Dismiss cookie consent if present
        try {
          await page.locator('#truste-consent-button').click({ timeout: 3000 });
          console.log('[EXPLORE] Auto-login: Dismissed cookie consent');
        } catch { /* no consent banner */ }

        // Try common selectors for login form fields
        const userSelectors = ['#UsernameInput', '#username', 'input[name="username"]', 'input[name="email"]', '#email', 'input[type="email"]'];
        const passSelectors = ['#PasswordInput', '#password', 'input[name="password"]', 'input[type="password"]'];
        const submitSelectors = ['#LoginButton', '#loginButton', 'button[type="submit"]', 'input[type="submit"]'];

        let filled = false;
        for (const sel of userSelectors) {
          if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.locator(sel).first().fill(creds.email);
            filled = true;
            break;
          }
        }
        if (filled) {
          for (const sel of passSelectors) {
            if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
              await page.locator(sel).first().fill(creds.password);
              break;
            }
          }
          for (const sel of submitSelectors) {
            if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
              await page.locator(sel).first().click();
              break;
            }
          }
          try {
            await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15000 });
            console.log(`[EXPLORE] Auto-login: Success — now at ${page.url()}`);
          } catch {
            console.log('[EXPLORE] Auto-login: URL did not change — login may have failed');
          }
        } else {
          console.log('[EXPLORE] Auto-login: Could not find username field — skipping');
        }
      } catch (err) {
        console.log(`[EXPLORE] Auto-login error: ${err.message}. Continuing without login.`);
      }
    }

    const normalizedStart = normalizeUrl(state.startUrl);

    return {
      browser,
      page,
      currentUrl: page.url(),
      visitedUrls: [normalizedStart],
      currentPhase: 'discover',
    };
  }

  /**
   * Phase 2: Discover Page — extract elements, classify, queue new links.
   */
  async function discoverPage(state) {
    const url = state.currentUrl || state.startUrl;
    console.log(`[EXPLORE] Discovering page ${state.visitedPages.length + 1}: ${url}`);

    const page = state.page;
    let pageStructure;
    let domSnapshot;

    try {
      pageStructure = await agent.extractPageStructure(page);
      domSnapshot = await agent.extractDOMSnapshot(page);
    } catch (err) {
      console.log(`[EXPLORE] Extraction error on ${url}: ${err.message}`);
      return {
        visitedPages: [{
          url,
          title: 'Error',
          classification: 'error',
          purpose: `Failed to extract: ${err.message}`,
          keyElements: [],
          formFields: [],
          navigationLinks: [],
          userActions: [],
          domSnapshot: '',
        }],
        errors: [{ phase: 'discover', url, error: err.message }],
      };
    }

    // Classify page via GPT
    let classification;
    try {
      classification = await agent.classifyPage(pageStructure, url);
    } catch (err) {
      console.log(`[EXPLORE] Classification error: ${err.message}`);
      classification = {
        classification: 'home',
        purpose: 'Classification failed — defaulting to home page',
        pageName: derivePageNameFromUrl(url),
        keyElements: [],
        formFields: pageStructure.formFields || [],
        navigationLinks: [],
        userActions: [],
      };
    }

    console.log(`[EXPLORE]   → Classification: ${classification.classification} (${classification.pageName})`);

    // Fallback: fix "unknown" or "UnknownPage" from GPT
    if (!classification.pageName || classification.pageName === 'UnknownPage' || classification.pageName.toLowerCase().includes('unknown')) {
      classification.pageName = derivePageNameFromUrl(url);
      console.log(`[EXPLORE]   → Renamed to: ${classification.pageName} (derived from URL)`);
    }
    if (classification.classification === 'unknown' || classification.classification === 'other') {
      // Try to infer from page structure
      if (pageStructure.formFields && pageStructure.formFields.some(f => f.type === 'password')) {
        classification.classification = 'login';
      } else if (pageStructure.formFields && pageStructure.formFields.length > 3) {
        classification.classification = 'form';
      } else {
        classification.classification = 'home';
      }
      console.log(`[EXPLORE]   → Reclassified to: ${classification.classification} (inferred from structure)`);
    }

    // Build page data
    const pageData = {
      url,
      title: pageStructure.title,
      depth: state.currentDepth,
      classification: classification.classification,
      purpose: classification.purpose,
      pageName: classification.pageName,
      keyElements: classification.keyElements || [],
      formFields: classification.formFields || [],
      navigationLinks: classification.navigationLinks || [],
      userActions: classification.userActions || [],
      domSnapshot,
      rawStructure: pageStructure,
    };

    // Queue new links (same-origin, unvisited, bounded by depth)
    let startOrigin;
    try {
      startOrigin = new URL(state.startUrl).origin;
    } catch {
      startOrigin = '';
    }

    const allLinks = [
      ...(pageStructure.links || []),
      ...(classification.navigationLinks || []).map(nl => ({ href: nl.href, text: nl.text })),
    ];

    const filteredLinks = agent.filterLinks(allLinks, startOrigin, state.visitedUrls);

    // Merge with existing queue, respecting depth limit
    const existingQueueUrls = new Set((state.urlQueue || []).map(q => q.url));
    const newQueueEntries = [];
    for (const link of filteredLinks) {
      const normalized = normalizeUrl(link.href);
      if (!existingQueueUrls.has(normalized) && state.currentDepth + 1 <= state.maxDepth) {
        newQueueEntries.push({ url: normalized, depth: state.currentDepth + 1 });
        existingQueueUrls.add(normalized);
      }
    }

    const updatedQueue = [...(state.urlQueue || []), ...newQueueEntries];
    console.log(`[EXPLORE]   → Links queued: ${newQueueEntries.length} new (${updatedQueue.length} total in queue)`);

    return {
      visitedPages: [pageData],
      urlQueue: updatedQueue,
    };
  }

  /**
   * Crawl Next: pop the next URL from the queue and navigate to it.
   */
  async function crawlNext(state) {
    const queue = [...(state.urlQueue || [])];
    const next = queue.shift();

    if (!next) {
      return { urlQueue: [], currentPhase: 'analyze' };
    }

    console.log(`[EXPLORE] Crawling to: ${next.url} (depth: ${next.depth})`);

    const page = state.page;
    try {
      await page.goto(next.url, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (err) {
      console.log(`[EXPLORE] Navigation warning for ${next.url}: ${err.message}`);
    }

    // Wait a bit for SPA routing to settle
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    } catch {
      // Ignore timeout — page may already be loaded
    }

    return {
      currentUrl: page.url(),
      currentDepth: next.depth,
      visitedUrls: [...state.visitedUrls, normalizeUrl(next.url)],
      urlQueue: queue,
    };
  }

  /**
   * Phase 3: Analyze App — send all pages to GPT to identify flows.
   */
  async function analyzeApp(state) {
    console.log(`[EXPLORE] Phase 3: Analyzing app (${state.visitedPages.length} pages discovered)`);

    const analysisResult = await agent.analyzeApp(state.visitedPages);

    console.log(`[EXPLORE]   → App: ${analysisResult.appName}`);
    console.log(`[EXPLORE]   → Flows identified: ${(analysisResult.userFlows || []).length}`);
    for (const flow of analysisResult.userFlows || []) {
      console.log(`[EXPLORE]     - ${flow.name} (${flow.priority}): ${flow.steps.length} steps`);
    }

    // Save analysis report
    writeReport('exploration', `analysis-${Date.now()}.json`, analysisResult);

    return {
      siteMap: {
        appName: analysisResult.appName,
        appDescription: analysisResult.appDescription,
        baseUrl: analysisResult.baseUrl,
        pageRelationships: analysisResult.pageRelationships || [],
      },
      identifiedFlows: analysisResult.userFlows || [],
      currentPhase: 'generatePOs',
    };
  }

  /**
   * Phase 4: Generate Page Objects from each unique page classification.
   */
  async function generatePageObjects(state) {
    console.log('[EXPLORE] Phase 4: Generating Page Objects');

    const patternExample = readPatternExample('framework/pages/AuthPage.js');

    // Deduplicate by classification — generate one PO per unique page type
    const seenClassifications = new Set();
    const uniquePages = [];
    for (const pageData of state.visitedPages) {
      const key = pageData.classification + '__' + pageData.pageName;
      if (!seenClassifications.has(key) && pageData.classification !== 'error') {
        seenClassifications.add(key);
        uniquePages.push(pageData);
      }
    }

    const generatedPOs = [];
    for (const pageData of uniquePages) {
      console.log(`[EXPLORE]   → Generating PO for: ${pageData.pageName} (${pageData.classification})`);

      try {
        const po = await agent.generatePageObjectCode(
          pageData,
          patternExample,
          pageData.domSnapshot,
          testDataConfig,
        );
        generatedPOs.push(po);
        console.log(`[EXPLORE]     ✓ ${po.className} — ${(po.locators || []).length} locators, ${(po.methods || []).length} methods`);
      } catch (err) {
        console.log(`[EXPLORE]     ✗ Failed: ${err.message}`);
      }
    }

    return {
      generatedPageObjects: generatedPOs,
      currentPhase: 'generateTests',
    };
  }

  /**
   * Phase 5: Generate test specs from identified user flows.
   */
  async function generateTests(state) {
    console.log('[EXPLORE] Phase 5: Generating Test Specs');

    // Use a TC-style pattern example that matches our import paths and conventions
    const patternExample = `const { test, expect } = require('../../framework/ai/fixtures/tc.ai.fixture');
const allure = require('allure-js-commons');
const { testDataConfig } = require('../../framework/config/test-data.config');
const { TotalConnect2LoginPage } = require('../../framework/pages/generated/TotalConnect2LoginPage');
const { TotalConnectHomePage } = require('../../framework/pages/generated/TotalConnectHomePage');

test.describe('@smoke @tc @tc-plan Login Flow', () => {
  test('TC01 - User should be able to log into Total Connect', async ({ page }) => {
    await allure.epic(testDataConfig.targetApp.name);
    await allure.feature('Authentication');
    await allure.story('User Login');
    await allure.severity('critical');
    await allure.tags('login', 'authentication', 'positive');

    const loginPage = new TotalConnect2LoginPage(page);
    const homePage = new TotalConnectHomePage(page);

    await test.step('Navigate to login page', async () => {
      await loginPage.open(testDataConfig.targetApp.baseUrl);
      await page.waitForLoadState('domcontentloaded');
    });

    await test.step('Dismiss cookie consent if visible', async () => {
      try { await loginPage.acceptConsent(); } catch {}
    });

    await test.step('Fill login form and submit', async () => {
      await loginPage.fillLoginForm(
        testDataConfig.targetApp.credentials.email,
        testDataConfig.targetApp.credentials.password
      );
      await loginPage.clickSignIn();
    });

    await test.step('Verify successful login - dashboard loads', async () => {
      await expect(page).toHaveURL(/.*\\/home/, { timeout: 15000 });
    });
  });
});`;
    const appName = state.siteMap?.appName || 'Web Application';

    const generatedSpecs = [];
    for (const flow of state.identifiedFlows) {
      console.log(`[EXPLORE]   → Generating spec for: ${flow.name}`);

      try {
        const spec = await agent.generateTestSpecCode(
          flow,
          state.generatedPageObjects,
          patternExample,
          appName,
          testDataConfig,
        );
        generatedSpecs.push(spec);
        console.log(`[EXPLORE]     ✓ ${spec.fileName} — ${(spec.testCases || []).length} test cases`);
      } catch (err) {
        console.log(`[EXPLORE]     ✗ Failed: ${err.message}`);
      }
    }

    return {
      generatedTestSpecs: generatedSpecs,
      currentPhase: 'writeFiles',
    };
  }

  /**
   * Phase 6: Write all generated files to disk and close browser.
   */
  async function writeFiles(state) {
    console.log('[EXPLORE] Phase 6: Writing generated files');

    // Ensure output directories exist
    const poDir = path.join(PROJECT_ROOT, 'framework', 'pages', 'generated');
    const specDir = path.join(PROJECT_ROOT, 'tests', 'generated');
    fs.mkdirSync(poDir, { recursive: true });
    fs.mkdirSync(specDir, { recursive: true });

    // Write Page Objects
    for (const po of state.generatedPageObjects) {
      if (!po.code || !po.fileName) continue;
      const filePath = path.join(poDir, po.fileName);
      fs.writeFileSync(filePath, po.code, 'utf-8');
      console.log(`[EXPLORE]   → Wrote PO: framework/pages/generated/${po.fileName}`);
    }

    // Write Test Specs
    for (const spec of state.generatedTestSpecs) {
      if (!spec.code || !spec.fileName) continue;
      const filePath = path.join(specDir, spec.fileName);
      fs.writeFileSync(filePath, spec.code, 'utf-8');
      console.log(`[EXPLORE]   → Wrote Spec: tests/generated/${spec.fileName}`);
    }

    // Save site map and metadata to ai-reports
    const timestamp = Date.now();
    writeReport('exploration', `sitemap-${timestamp}.json`, {
      siteMap: state.siteMap,
      pagesDiscovered: state.visitedPages.length,
      visitedUrls: state.visitedUrls,
    });

    writeReport('exploration', `flows-${timestamp}.json`, {
      flows: state.identifiedFlows,
    });

    writeReport('exploration', `page-objects-${timestamp}.json`, {
      pageObjects: state.generatedPageObjects.map(po => ({
        className: po.className,
        fileName: po.fileName,
        locators: po.locators,
        methods: po.methods,
      })),
    });

    writeReport('exploration', `test-specs-${timestamp}.json`, {
      testSpecs: state.generatedTestSpecs.map(spec => ({
        fileName: spec.fileName,
        testCases: spec.testCases,
      })),
    });

    // Close browser
    try {
      if (state.browser) {
        await state.browser.close();
        console.log('[EXPLORE] Browser closed');
      }
    } catch {
      // Ignore close errors
    }

    // Summary
    console.log('\n[EXPLORE] === Exploration Complete ===');
    console.log(`[EXPLORE] Pages discovered: ${state.visitedPages.length}`);
    console.log(`[EXPLORE] Page Objects generated: ${state.generatedPageObjects.length}`);
    console.log(`[EXPLORE] Test Specs generated: ${state.generatedTestSpecs.length}`);
    console.log(`[EXPLORE] Output: framework/pages/generated/, tests/generated/, ai-reports/exploration/`);

    return {
      currentPhase: 'complete',
      // Clear browser references from state to avoid serialization issues
      browser: null,
      page: null,
    };
  }

  return { navigate, discoverPage, crawlNext, analyzeApp, generatePageObjects, generateTests, writeFiles };
}

module.exports = { createExplorationNodes };
