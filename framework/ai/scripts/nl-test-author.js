/**
 * CLI: Natural Language Test Authoring
 *
 * Describe test scenarios in plain English, watch them execute in a browser,
 * and get proper Playwright test scripts with page objects and fixtures.
 *
 * Usage:
 *   npm run ai:author -- --instructions "login to the app, navigate to devices page"
 *   npm run ai:author -- --file test-instructions.txt
 *   npm run ai:author -- --suite tests/suites/smoke.md
 *   npm run ai:author -- --suite tests/suites/smoke.md --login
 *   npm run ai:author -- --suite tests/suites/smoke.md --login --tc 6
 *   npm run ai:author -- --suite tests/suites/smoke.md --login --tc TC-SMOKE-006
 *   npm run ai:author                          (interactive mode)
 *
 * Options:
 *   --instructions "..."   Plain English test description (wrap in quotes)
 *   --file <path>          Read instructions from a plain text file
 *   --suite <path>         Run a test suite from a .md file (multiple test cases)
 *   --tc <N|ID>            Run only the Nth test case or by ID (e.g. --tc 6 or --tc TC-SMOKE-006)
 *   --url <URL>            Override base URL from test-data.config.js
 *   --login                Auto-login before executing steps
 *   --headless             Run browser in headless mode (default: headed)
 *
 * Suite .md format:
 *   # Suite Name
 *   ## TC-001: Test case title
 *   plain english instructions here
 *   multiple lines supported
 *
 *   ## TC-002: Another test case
 *   > login: true
 *   more instructions here
 *
 * Outputs:
 *   framework/pages/generated/   — Generated Page Object files
 *   tests/generated/             — Generated test spec files
 *   ai-reports/nl-authoring/     — Recording reports + suite results
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { loadAIConfig } = require('../config/ai.config');
const { createNLAuthoringGraph } = require('../graph/nl-authoring-graph');
const { parseMdSuite } = require('../utils/md-suite-parser');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

let testDataConfig = {};
try {
  testDataConfig = require('../../config/test-data.config').testDataConfig;
} catch {
  // Config not created yet
}

/** IST timestamp for logging */
function istTimestamp() {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

/**
 * Read instructions interactively from stdin.
 */
function readInstructionsInteractive() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log('');
    console.log('Describe what you want to test in plain English.');
    console.log('You can write multiple lines. Press Enter twice (empty line) when done.');
    console.log('');
    const lines = [];
    let lastLineEmpty = false;
    rl.on('line', (line) => {
      if (line.trim() === '' && lastLineEmpty) { rl.close(); return; }
      lastLineEmpty = line.trim() === '';
      if (!lastLineEmpty) lines.push(line);
    });
    rl.on('close', () => resolve(lines.join('\n')));
  });
}

/**
 * Run a single test case through the NL authoring graph.
 * @returns {{id, title, instructions, status, actions, assertions, pageObjects, testSpecs, errors, durationMs}}
 */
async function runSingleTestCase(graph, { id, title, instructions, url, autoLogin, headed, preferredLocators, outputDir, pagesDir, entryCriteria, exitCriteria }) {
  const start = Date.now();
  const entry = { id, title, instructions, status: 'FAIL', actions: { passed: 0, failed: 0 }, assertions: { passed: 0, failed: 0, total: 0 }, pageObjects: [], testSpecs: [], errors: [], durationMs: 0 };

  try {
    // Inject entry/exit criteria into instructions if provided
    let fullInstructions = instructions;
    if (entryCriteria) fullInstructions = `PRECONDITION: ${entryCriteria}\n${fullInstructions}`;
    if (exitCriteria) fullInstructions = `${fullInstructions}\nEXPECTED RESULT: ${exitCriteria}`;

    const result = await graph.invoke({
      instructions: fullInstructions,
      baseUrl: url,
      autoLogin,
      headed,
      preferredLocators: preferredLocators || [],
      outputDir: outputDir || '',
      pagesDir: pagesDir || '',
      entryCriteria: entryCriteria || '',
      exitCriteria: exitCriteria || '',
    });

    const allActions = result.recordedActions || [];
    const actionSteps = allActions.filter(a => !a.isAssertion);
    const assertionSteps = allActions.filter(a => a.isAssertion);

    entry.actions.passed = actionSteps.filter(a => a.success).length;
    entry.actions.failed = actionSteps.filter(a => !a.success).length;
    entry.assertions.total = assertionSteps.length;
    entry.assertions.passed = assertionSteps.filter(a => a.assertionVerdict === 'PASS').length;
    entry.assertions.failed = assertionSteps.filter(a => a.assertionVerdict === 'FAIL').length;
    entry.pageObjects = (result.generatedPageObjects || []).map(po => po.fileName).filter(Boolean);
    entry.testSpecs = (result.generatedTestSpecs || []).map(s => s.fileName).filter(Boolean);
    entry.errors = result.errors || [];

    // Determine PASS/FAIL: no failed actions AND no failed assertions
    const hasFails = entry.actions.failed > 0 || entry.assertions.failed > 0;
    entry.status = hasFails ? 'FAIL' : 'PASS';
  } catch (err) {
    entry.errors.push(err.message);
    entry.status = 'ERROR';
  }

  entry.durationMs = Date.now() - start;
  return entry;
}

/**
 * Print a single test case result box.
 */
function printTestCaseResult(tc) {
  const dur = (tc.durationMs / 1000).toFixed(1) + 's';
  const icon = tc.status === 'PASS' ? '✓' : tc.status === 'FAIL' ? '✗' : '⚠';
  console.log(`  ${icon} [${tc.status}] ${tc.id}: ${tc.title}  (${dur})`);
  if (tc.actions.failed > 0) console.log(`      Actions: ${tc.actions.passed} passed, ${tc.actions.failed} failed`);
  if (tc.assertions.total > 0) console.log(`      Assertions: ${tc.assertions.passed} passed, ${tc.assertions.failed} failed`);
  if (tc.errors.length > 0) console.log(`      Errors: ${tc.errors[0].substring(0, 80)}`);
}

/**
 * Write suite results to a JSON and human-readable .txt report.
 */
function writeSuiteReport(suiteName, suiteFile, results) {
  const reportDir = path.join(PROJECT_ROOT, 'ai-reports', 'nl-authoring');
  fs.mkdirSync(reportDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const baseName = suiteName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Compute totals
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errored = results.filter(r => r.status === 'ERROR').length;
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

  // JSON report
  const jsonReport = {
    suite: suiteName,
    sourceFile: suiteFile,
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed, errored, passRate: `${passRate}%`, durationMs: totalDuration },
    testCases: results,
  };
  const jsonPath = path.join(reportDir, `suite-${baseName}-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8');

  // Human-readable .txt report
  const lines = [];
  lines.push(`Suite Report: ${suiteName}`);
  lines.push(`Source: ${suiteFile}`);
  lines.push(`Run: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  lines.push('═'.repeat(70));
  lines.push('');
  lines.push(`SUMMARY: ${passed}/${total} passed (${passRate}%) | ${failed} failed | ${errored} errors | ${(totalDuration / 1000).toFixed(1)}s`);
  lines.push('');
  lines.push('─'.repeat(70));
  for (const tc of results) {
    const icon = tc.status === 'PASS' ? '✓' : tc.status === 'FAIL' ? '✗' : '⚠';
    const dur = (tc.durationMs / 1000).toFixed(1) + 's';
    lines.push(`${icon} [${tc.status.padEnd(5)}] ${tc.id}: ${tc.title}  (${dur})`);
    if (tc.actions.failed > 0) lines.push(`         Actions: ${tc.actions.passed} passed, ${tc.actions.failed} failed`);
    if (tc.assertions.total > 0) lines.push(`         Assertions: ${tc.assertions.passed}/${tc.assertions.total} passed`);
    if (tc.testSpecs.length > 0) lines.push(`         Spec: tests/generated/${tc.testSpecs[0]}`);
    if (tc.errors.length > 0) lines.push(`         Error: ${tc.errors[0].substring(0, 80)}`);
  }
  lines.push('─'.repeat(70));
  lines.push('');
  lines.push('Generated artifacts:');
  const allPOs = results.flatMap(r => r.pageObjects);
  const allSpecs = results.flatMap(r => r.testSpecs);
  for (const po of [...new Set(allPOs)]) lines.push(`  PO:   framework/pages/generated/${po}`);
  for (const sp of [...new Set(allSpecs)]) lines.push(`  Spec: tests/generated/${sp}`);

  const txtPath = path.join(reportDir, `suite-${baseName}-${timestamp}.txt`);
  fs.writeFileSync(txtPath, lines.join('\n'), 'utf-8');

  return { jsonPath, txtPath, summary: jsonReport.summary };
}

async function main() {
  const args = process.argv.slice(2);
  let instructions = '';
  let suitePath = '';
  let url = testDataConfig?.targetApp?.baseUrl || '';
  let autoLogin = false;
  let headed = true;
  let tcFilter = null; // --tc N or --tc TC-SMOKE-006

  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--instructions' && args[i + 1]) {
      instructions = args[++i];
    } else if (args[i] === '--file' && args[i + 1]) {
      const filePath = path.resolve(args[++i]);
      if (!fs.existsSync(filePath)) { console.error(`File not found: ${filePath}`); process.exit(1); }
      // If it's a .md file, treat as suite
      if (filePath.endsWith('.md')) {
        suitePath = filePath;
      } else {
        instructions = fs.readFileSync(filePath, 'utf-8').trim();
      }
    } else if (args[i] === '--suite' && args[i + 1]) {
      suitePath = path.resolve(args[++i]);
    } else if (args[i] === '--tc' && args[i + 1]) {
      tcFilter = args[++i];
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[++i];
    } else if (args[i] === '--login') {
      autoLogin = true;
    } else if (args[i] === '--headless') {
      headed = false;
    }
  }

  // ── Suite mode ──────────────────────────────────────────────────
  if (suitePath) {
    if (!fs.existsSync(suitePath)) { console.error(`Suite file not found: ${suitePath}`); process.exit(1); }

    const suite = parseMdSuite(suitePath);
    if (suite.testCases.length === 0) {
      console.error('No test cases found in the suite file. Use ## headings to define test cases.');
      process.exit(1);
    }

    // Filter to a single TC if --tc was specified
    let testCasesToRun = suite.testCases;
    if (tcFilter) {
      const tcNum = parseInt(tcFilter, 10);
      if (!isNaN(tcNum) && tcNum >= 1 && tcNum <= suite.testCases.length) {
        // Numeric filter: --tc 6 means the 6th test case
        testCasesToRun = [suite.testCases[tcNum - 1]];
      } else {
        // ID-based filter: --tc TC-SMOKE-006 or partial match --tc 006
        const match = suite.testCases.filter(tc =>
          tc.id === tcFilter || tc.id.includes(tcFilter)
        );
        if (match.length > 0) {
          testCasesToRun = match;
        } else {
          console.error(`TC not found: "${tcFilter}". Available:`);
          suite.testCases.forEach((tc, i) => console.error(`  ${i + 1}. ${tc.id}: ${tc.title}`));
          process.exit(1);
        }
      }
      console.log(`[NL-AUTHOR] Filtered to ${testCasesToRun.length} test case(s): ${testCasesToRun.map(t => t.id).join(', ')}`);
    }

    const config = loadAIConfig();
    if (!config.openaiApiKey) { console.error('OPENAI_API_KEY not set. Add it to your .env file.'); process.exit(1); }

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   AI NL Test Author — Suite Mode                        ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Suite:      ${suite.suiteName.substring(0, 43).padEnd(43)} ║`);
    console.log(`║  File:       ${suite.suiteFile.substring(0, 43).padEnd(43)} ║`);
    console.log(`║  Test Cases: ${String(testCasesToRun.length + (tcFilter ? ` (filtered from ${suite.testCases.length})` : '')).padEnd(43)} ║`);
    console.log(`║  Login:      ${String(autoLogin).padEnd(43)} ║`);
    console.log(`║  Headed:     ${String(headed).padEnd(43)} ║`);
    if (suite.suiteOptions.preferredLocators) {
      console.log(`║  Locators:   ${suite.suiteOptions.preferredLocators.join(', ').substring(0, 43).padEnd(43)} ║`);
    }
    if (suite.suiteOptions.outputDir) {
      console.log(`║  Output:     ${suite.suiteOptions.outputDir.substring(0, 43).padEnd(43)} ║`);
    }
    if (suite.suiteOptions.pagesDir) {
      console.log(`║  Pages:      ${suite.suiteOptions.pagesDir.substring(0, 43).padEnd(43)} ║`);
    }
    console.log('╠══════════════════════════════════════════════════════════╣');
    for (const tc of testCasesToRun) {
      console.log(`║  ${tc.id}: ${tc.title.substring(0, 50).padEnd(50)}   ║`);
    }
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    const graph = createNLAuthoringGraph(config);
    const results = [];

    for (let i = 0; i < testCasesToRun.length; i++) {
      const tc = testCasesToRun[i];
      const tcUrl = tc.options.url || url;
      const tcLogin = tc.options.autoLogin !== undefined ? tc.options.autoLogin : autoLogin;
      const tcHeaded = tc.options.headless !== undefined ? !tc.options.headless : headed;

      console.log('');
      console.log(`┌──────────────────────────────────────────────────────────┐`);
      console.log(`│  [${istTimestamp()}] Running ${i + 1}/${testCasesToRun.length}: ${tc.id}: ${tc.title.substring(0, 35).padEnd(35)}│`);
      console.log(`└──────────────────────────────────────────────────────────┘`);

      const result = await runSingleTestCase(graph, {
        id: tc.id,
        title: tc.title,
        instructions: tc.instructions,
        url: tcUrl,
        autoLogin: tcLogin,
        headed: tcHeaded,
        preferredLocators: tc.options.preferredLocators || suite.suiteOptions.preferredLocators || [],
        outputDir: tc.options.outputDir || suite.suiteOptions.outputDir || '',
        pagesDir: tc.options.pagesDir || suite.suiteOptions.pagesDir || '',
        entryCriteria: tc.entryCriteria || '',
        exitCriteria: tc.exitCriteria || '',
      });

      results.push(result);
      printTestCaseResult(result);
    }

    // Write suite reports
    const { jsonPath, txtPath, summary } = writeSuiteReport(suite.suiteName, suite.suiteFile, results);

    // Print consolidated summary
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   Suite Results                                         ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Suite:       ${suite.suiteName.substring(0, 42).padEnd(42)} ║`);
    console.log(`║  Total:       ${String(summary.total).padEnd(42)} ║`);
    console.log(`║  Passed:      ${String(summary.passed).padEnd(42)} ║`);
    console.log(`║  Failed:      ${String(summary.failed).padEnd(42)} ║`);
    if (summary.errored > 0) {
      console.log(`║  Errors:      ${String(summary.errored).padEnd(42)} ║`);
    }
    console.log(`║  Pass Rate:   ${summary.passRate.padEnd(42)} ║`);
    console.log(`║  Duration:    ${((summary.durationMs / 1000).toFixed(1) + 's').padEnd(42)} ║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    for (const r of results) {
      const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⚠';
      console.log(`║  ${icon} ${r.status.padEnd(5)} ${r.id}: ${r.title.substring(0, 42).padEnd(42)} ║`);
    }
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Report: ${path.relative(PROJECT_ROOT, txtPath).padEnd(47)} ║`);
    console.log('╚══════════════════════════════════════════════════════════╝');

    // Print generated spec run commands
    const allSpecs = results.flatMap(r => r.testSpecs);
    if (allSpecs.length > 0) {
      console.log('');
      console.log('To run ALL generated tests:');
      console.log('  npx playwright test tests/generated/ --headed');
      console.log('');
      console.log('To run individual tests:');
      for (const spec of [...new Set(allSpecs)]) {
        console.log(`  npx playwright test tests/generated/${spec} --headed`);
      }
    }

    // Exit with non-zero if any test failed
    const exitCode = summary.failed > 0 || summary.errored > 0 ? 1 : 0;
    process.exit(exitCode);
  }

  // ── Single test mode (original behavior) ────────────────────────

  // Interactive mode if no instructions provided
  if (!instructions) {
    instructions = await readInstructionsInteractive();
  }

  if (!instructions.trim()) {
    console.error('No instructions provided. Usage:');
    console.error('  npm run ai:author -- --instructions "login, go to devices, verify device list"');
    console.error('  npm run ai:author -- --file my-test-steps.txt');
    console.error('  npm run ai:author -- --suite tests/suites/smoke.md');
    console.error('  npm run ai:author                    (interactive mode)');
    process.exit(1);
  }

  // Load config
  const config = loadAIConfig();
  if (!config.openaiApiKey) { console.error('OPENAI_API_KEY not set. Add it to your .env file.'); process.exit(1); }

  const configSource = url === testDataConfig?.targetApp?.baseUrl ? 'test-data.config.js' : 'CLI argument';

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   AI Natural Language Test Author                       ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Mode:      Describe → Execute → Generate               ║`);
  console.log(`║  URL:       ${(url || 'from instructions').substring(0, 44).padEnd(44)} ║`);
  console.log(`║  Source:    ${configSource.padEnd(44)} ║`);
  console.log(`║  Login:     ${String(autoLogin).padEnd(44)} ║`);
  console.log(`║  Headed:    ${String(headed).padEnd(44)} ║`);
  console.log(`║  Model:     ${(config.analysisModel || 'gpt-4o').padEnd(44)} ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Instructions:                                          ║');
  const instrLines = instructions.split('\n');
  for (const line of instrLines.slice(0, 5)) {
    console.log(`║    ${line.substring(0, 54).padEnd(54)} ║`);
  }
  if (instrLines.length > 5) {
    console.log(`║    ... (${instrLines.length - 5} more lines)                                  ║`);
  }
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    const graph = createNLAuthoringGraph(config);

    const result = await graph.invoke({
      instructions,
      baseUrl: url,
      autoLogin,
      headed,
    });

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   Results                                               ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    const allActions = result.recordedActions || [];
    const actionSteps = allActions.filter(a => !a.isAssertion);
    const assertionSteps = allActions.filter(a => a.isAssertion);
    const assertionsPassed = assertionSteps.filter(a => a.assertionVerdict === 'PASS').length;
    const assertionsFailed = assertionSteps.filter(a => a.assertionVerdict === 'FAIL').length;
    console.log(`║  Steps Executed:     ${String(allActions.length).padEnd(36)} ║`);
    console.log(`║  Actions Passed:     ${String(actionSteps.filter(a => a.success).length).padEnd(36)} ║`);
    console.log(`║  Actions Failed:     ${String(actionSteps.filter(a => !a.success).length).padEnd(36)} ║`);
    if (assertionSteps.length > 0) {
      console.log('║                                                          ║');
      console.log(`║  Assertions Total:   ${String(assertionSteps.length).padEnd(36)} ║`);
      console.log(`║  Assertions PASSED:  ${String(assertionsPassed).padEnd(36)} ║`);
      console.log(`║  Assertions FAILED:  ${String(assertionsFailed).padEnd(36)} ║`);
    }
    console.log('║                                                          ║');
    console.log(`║  Page Objects:       ${String(result.generatedPageObjects?.length || 0).padEnd(36)} ║`);
    console.log(`║  Test Specs:         ${String(result.generatedTestSpecs?.length || 0).padEnd(36)} ║`);

    if (result.generatedPageObjects?.length > 0) {
      console.log('║                                                          ║');
      console.log('║  Generated Page Objects:                                 ║');
      for (const po of result.generatedPageObjects) {
        console.log(`║    → framework/pages/generated/${(po.fileName || '').padEnd(26)} ║`);
      }
    }

    if (result.generatedTestSpecs?.length > 0) {
      console.log('║                                                          ║');
      console.log('║  Generated Test Specs:                                   ║');
      for (const spec of result.generatedTestSpecs) {
        console.log(`║    → tests/generated/${(spec.fileName || '').padEnd(36)} ║`);
      }
    }

    if (result.errors?.length > 0) {
      console.log('║                                                          ║');
      console.log(`║  Errors: ${String(result.errors.length).padEnd(48)} ║`);
    }

    console.log('╚══════════════════════════════════════════════════════════╝');

    // Print run commands
    if (result.generatedTestSpecs?.length > 0) {
      console.log('');
      console.log('To run the generated test:');
      for (const spec of result.generatedTestSpecs) {
        console.log(`  npx playwright test tests/generated/${spec.fileName} --headed`);
      }
      console.log('');
      console.log('Or run all generated tests:');
      console.log('  npm run demo:test:headed');
    }
  } catch (err) {
    console.error('');
    console.error(`Fatal error: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
