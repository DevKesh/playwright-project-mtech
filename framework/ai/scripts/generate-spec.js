#!/usr/bin/env node
/**
 * Single-Shot Spec Generation CLI
 * 
 * Usage:
 *   node framework/ai/scripts/generate-spec.js --instructions "..." [--test-id TC-SMOKE-002] [--output tests/generated] [--pages framework/pages/generated]
 *   node framework/ai/scripts/generate-spec.js --suite tests/suites/smoke.md [--tc 2]
 * 
 * This is the FAST path: 1 API call generates complete spec + page object from page registry.
 * No browser, no per-step DOM extraction.
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { generateAndWriteSpec } = require('../agents/spec-generator');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// ── Argument Parsing ───────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--instructions' || args[i] === '-i') {
      parsed.instructions = args[++i];
    } else if (args[i] === '--suite' || args[i] === '-s') {
      parsed.suite = args[++i];
    } else if (args[i] === '--tc') {
      parsed.tcNumber = parseInt(args[++i], 10);
    } else if (args[i] === '--test-id') {
      parsed.testId = args[++i];
    } else if (args[i] === '--output' || args[i] === '-o') {
      parsed.output = args[++i];
    } else if (args[i] === '--pages' || args[i] === '-p') {
      parsed.pages = args[++i];
    } else if (args[i] === '--tags') {
      parsed.tags = args[++i].split(',').map(t => t.trim());
    } else if (args[i] === '--all') {
      parsed.all = true;
    } else if (args[i] === '--consolidated') {
      parsed.consolidated = true;
    }
  }

  return parsed;
}

// ── Suite Parser (lightweight) ─────────────────────────────────────

function parseSuiteFile(suitePath) {
  const content = fs.readFileSync(path.resolve(PROJECT_ROOT, suitePath), 'utf-8');
  const lines = content.split('\n');

  // Parse suite-level config (> lines before first ##)
  const suiteConfig = {};
  const testCases = [];
  let currentTC = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Suite config lines
    if (trimmed.startsWith('>') && !currentTC) {
      const match = trimmed.match(/^>\s*(\w+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim();
        suiteConfig[key] = val;
      }
      continue;
    }

    // Test case header
    if (trimmed.startsWith('## ')) {
      if (currentTC) testCases.push(currentTC);
      const titleMatch = trimmed.match(/^##\s*(.+?):\s*(.+)$/);
      currentTC = {
        id: titleMatch ? titleMatch[1] : `TC-${testCases.length + 1}`,
        title: titleMatch ? titleMatch[2] : trimmed.replace('## ', ''),
        entry: '',
        exit: '',
        instructions: [],
      };
      continue;
    }

    if (!currentTC) continue;

    // Entry/Exit criteria
    if (trimmed.startsWith('**Entry:**')) {
      currentTC.entry = trimmed.replace('**Entry:**', '').trim();
      continue;
    }
    if (trimmed.startsWith('**Exit:**')) {
      currentTC.exit = trimmed.replace('**Exit:**', '').trim();
      continue;
    }

    // Instruction lines (non-empty, non-separator)
    if (trimmed && !trimmed.startsWith('---') && !trimmed.startsWith('#') && !trimmed.startsWith('>')) {
      currentTC.instructions.push(trimmed);
    }
  }
  if (currentTC) testCases.push(currentTC);

  return { suiteConfig, testCases };
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const startTime = Date.now();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SINGLE-SHOT SPEC GENERATOR (Registry-Based)               ║');
  console.log('║  1 API call = Complete Spec + Page Object                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  let tasks = []; // { instructions, testMeta }

  if (args.suite) {
    // Parse suite file and generate for specific TC or all
    const { suiteConfig, testCases } = parseSuiteFile(args.suite);
    const tags = (suiteConfig.tags || '@smoke @tc @tc-plan').split(' ').map(t => t.trim());
    const output = args.output || suiteConfig.output || 'tests/generated';
    const pages = args.pages || suiteConfig.pages || 'framework/pages/generated';

    if (args.tcNumber) {
      const tc = testCases[args.tcNumber - 1];
      if (!tc) {
        console.error(`ERROR: TC #${args.tcNumber} not found. Suite has ${testCases.length} test cases.`);
        process.exit(1);
      }
      tasks.push({
        instructions: tc.instructions.join('\n'),
        testMeta: { testId: tc.id, title: tc.title, tags, entry: tc.entry, exit: tc.exit },
        output: path.resolve(PROJECT_ROOT, output),
        pages: path.resolve(PROJECT_ROOT, pages),
      });
    } else if (args.all) {
      // Generate all TCs in suite
      for (const tc of testCases) {
        tasks.push({
          instructions: tc.instructions.join('\n'),
          testMeta: { testId: tc.id, title: tc.title, tags, entry: tc.entry, exit: tc.exit },
          output: path.resolve(PROJECT_ROOT, output),
          pages: path.resolve(PROJECT_ROOT, pages),
        });
      }
    } else {
      console.log('Available test cases:');
      testCases.forEach((tc, i) => console.log(`  ${i + 1}. ${tc.id}: ${tc.title}`));
      console.log('\nUse --tc <number> to generate a specific TC, or --all for all.');
      process.exit(0);
    }
  } else if (args.instructions) {
    tasks.push({
      instructions: args.instructions,
      testMeta: {
        testId: args.testId || 'TC-SMOKE-001',
        tags: args.tags || ['@smoke', '@tc', '@tc-plan'],
        entry: 'User is on login page',
        exit: 'Test assertions pass',
      },
      output: args.output ? path.resolve(PROJECT_ROOT, args.output) : path.join(PROJECT_ROOT, 'tests', 'generated'),
      pages: args.pages ? path.resolve(PROJECT_ROOT, args.pages) : path.join(PROJECT_ROOT, 'framework', 'pages', 'generated'),
    });
  } else {
    console.log('Usage:');
    console.log('  node framework/ai/scripts/generate-spec.js --suite tests/suites/smoke.md --tc 2');
    console.log('  node framework/ai/scripts/generate-spec.js --suite tests/suites/smoke.md --all');
    console.log('  node framework/ai/scripts/generate-spec.js --suite tests/suites/smoke.md --all --consolidated');
    console.log('  node framework/ai/scripts/generate-spec.js --instructions "login and verify home page"');
    process.exit(0);
  }

  // ── CONSOLIDATED MODE: Send ALL test cases as ONE prompt, get ONE suite file ──
  if (args.consolidated && args.suite && tasks.length > 1) {
    console.log(`\n[CONSOLIDATED] Generating single suite file with ${tasks.length} test cases...`);

    const { suiteConfig, testCases } = parseSuiteFile(args.suite);
    const tags = (suiteConfig.tags || '@smoke @tc @tc-plan').split(' ').map(t => t.trim());
    const output = args.output || suiteConfig.output || 'tests/generated/smoke';
    const pages = args.pages || suiteConfig.pages || 'framework/pages/generated/smoke';

    // Combine all test cases into a single instruction block
    const combinedInstructions = testCases.map(tc =>
      `### ${tc.id}: ${tc.title}\nEntry: ${tc.entry}\nExit: ${tc.exit}\n${tc.instructions.join('\n')}`
    ).join('\n\n---\n\n');

    const testMeta = {
      testId: testCases[0].id,
      title: `${testCases.length} Smoke Tests (Consolidated Suite)`,
      tags,
      entry: 'User is on login page',
      exit: 'All test assertions pass',
      consolidated: true,
      testCaseCount: testCases.length,
    };

    try {
      const result = await generateAndWriteSpec({
        instructions: combinedInstructions,
        testMeta,
        outputDir: path.resolve(PROJECT_ROOT, output),
        pagesDir: path.resolve(PROJECT_ROOT, pages),
      });
      console.log(`\n[CONSOLIDATED] ✓ Suite generated in ${(result.durationMs / 1000).toFixed(1)}s`);
      console.log(`[CONSOLIDATED] → ${result.spec.fileName}`);
    } catch (err) {
      console.error(`[CONSOLIDATED] ✗ Failed: ${err.message}`);
    }
    process.exit(0);
  }

  // Execute generation (individual mode)
  let successCount = 0;
  let totalTokens = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${i + 1}/${tasks.length}] Generating: ${task.testMeta.testId} — ${task.testMeta.title || ''}`);
    console.log(`${'─'.repeat(60)}`);

    try {
      const result = await generateAndWriteSpec({
        instructions: task.instructions,
        testMeta: task.testMeta,
        outputDir: task.output,
        pagesDir: task.pages,
      });
      successCount++;
      totalTokens += result.tokensUsed;
      console.log(`[SPEC-GEN] ✓ Done in ${(result.durationMs / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error(`[SPEC-GEN] ✗ Failed: ${err.message}`);
      if (err.stack) console.error(err.stack);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`SUMMARY: ${successCount}/${tasks.length} specs generated`);
  console.log(`Total time: ${totalTime}s | Total tokens: ~${totalTokens.toLocaleString()}`);
  console.log(`${'═'.repeat(60)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
