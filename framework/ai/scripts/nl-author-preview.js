/**
 * NL Authoring — Preview / Dry-Run Mode
 *
 * Demonstrates the AI's ability to parse plain English into structured
 * test steps and generate a Playwright code template — WITHOUT launching
 * a browser, executing anything, or writing files.
 *
 * Perfect for viva demo: shows the NL → structured plan → code pipeline
 * in ~5 seconds with 1 GPT call (~$0.01).
 *
 * Usage:
 *   npm run ai:author:preview -- --instructions "Navigate to cameras, verify KITCHEN camera visible"
 *
 * Output:
 *   - Structured execution plan (steps, actions, targets)
 *   - Generated Playwright code template (stdout only, no files written)
 *   - Saved to ai-reports/nl-authoring/preview-<timestamp>.md
 */

const fs = require('fs');
const path = require('path');
const { loadAIConfig } = require('../config/ai.config');
const { buildParseInstructionsPrompt } = require('../prompts/nl-test-authoring.prompt');
const { createAIClient } = require('../core/ai-client-factory');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

let testDataConfig = {};
try {
  testDataConfig = require('../../config/test-data.config').testDataConfig;
} catch { /* fallback */ }

/**
 * Generate a Playwright code template from structured steps (no GPT needed).
 */
function generateCodeTemplate(parsed) {
  const lines = [];
  lines.push(`const { test, expect } = require('@playwright/test');`);
  lines.push(`const { testDataConfig } = require('../../framework/config/test-data.config');`);
  lines.push(``);
  lines.push(`test('${parsed.testTitle}', async ({ page }) => {`);

  for (const step of parsed.steps) {
    lines.push(`  // Step ${step.stepNumber}: ${step.description}`);
    switch (step.action) {
      case 'navigate':
        lines.push(`  await page.goto('${step.urlPattern || step.value || 'https://qa2.totalconnect2.com/'}');`);
        break;
      case 'click':
        lines.push(`  await page.getByRole('button', { name: '${step.target}' }).click();`);
        break;
      case 'fill':
        const val = step.valueSource && step.valueSource.startsWith('testDataConfig')
          ? step.valueSource
          : `'${step.value || ''}'`;
        lines.push(`  await page.getByLabel('${step.target}').fill(${val});`);
        break;
      case 'assert_visible':
        lines.push(`  await expect(page.getByText('${step.target}')).toBeVisible();`);
        break;
      case 'assert_text':
        lines.push(`  await expect(page.getByText('${step.value || step.target}')).toBeVisible();`);
        break;
      case 'assert_url':
        lines.push(`  await expect(page).toHaveURL(/${step.urlPattern || step.value}/);`);
        break;
      case 'wait':
        lines.push(`  await page.waitForLoadState('networkidle');`);
        break;
      case 'press':
        lines.push(`  await page.keyboard.press('${step.value || 'Enter'}');`);
        break;
      case 'hover':
        lines.push(`  await page.getByText('${step.target}').hover();`);
        break;
      case 'screenshot':
        lines.push(`  await page.screenshot({ path: 'test-results/${parsed.testName}-step${step.stepNumber}.png' });`);
        break;
      default:
        lines.push(`  // TODO: ${step.action} — ${step.target}`);
    }
    lines.push(``);
  }

  lines.push(`});`);
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  let instructions = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--instructions' && args[i + 1]) {
      instructions = args[++i];
    }
  }

  if (!instructions) {
    console.error('Usage: npm run ai:author:preview -- --instructions "your test description"');
    process.exit(1);
  }

  const config = loadAIConfig();
  if (!config.openaiApiKey) {
    console.error('OPENAI_API_KEY not set. Add it to your .env file.');
    process.exit(1);
  }

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   NL Test Authoring — Preview Mode (Dry Run)            ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Instructions: ${instructions.substring(0, 41).padEnd(41)} ║`);
  console.log(`║  Mode:         Preview only (NO execution, NO files)    ║`);
  console.log(`║  AI Calls:     1 (parse instructions)                   ║`);
  console.log(`║  Cost:         ~$0.01                                   ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Build prompt and call GPT (single call)
  const { systemPrompt, userPrompt } = buildParseInstructionsPrompt({
    instructions,
    testDataConfig,
  });

  const aiClient = createAIClient(config);
  console.log('[PREVIEW] Parsing natural language instructions via GPT...');
  const startTime = Date.now();

  const parsed = await aiClient.chatCompletionJSON(systemPrompt, userPrompt, {
    model: config.analysisModel || 'gpt-4o',
    maxTokens: 4096,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[PREVIEW] Parsed in ${duration}s`);
  console.log('');

  // Display structured plan
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log(`│  Test: ${parsed.testTitle}`);
  console.log(`│  Epic: ${parsed.epic || 'N/A'} | Feature: ${parsed.feature || 'N/A'}`);
  console.log(`│  Severity: ${parsed.severity || 'normal'} | Tags: ${(parsed.tags || []).join(', ')}`);
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│  EXECUTION PLAN:');
  console.log('│');
  for (const step of parsed.steps) {
    const icon = step.action.startsWith('assert') ? '✓' : '▶';
    console.log(`│  ${icon} Step ${step.stepNumber}: [${step.action.toUpperCase()}] ${step.description}`);
    if (step.target) console.log(`│       Target: ${step.target}`);
    if (step.value) console.log(`│       Value: ${step.value}`);
    if (step.expectedPage) console.log(`│       Expected page: ${step.expectedPage}`);
  }
  console.log('│');
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');

  // Generate code template
  const code = generateCodeTemplate(parsed);
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│  GENERATED PLAYWRIGHT CODE (template):                  │');
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(code);
  console.log('');

  // Save detailed report
  const reportDir = path.join(PROJECT_ROOT, 'ai-reports', 'nl-authoring');
  fs.mkdirSync(reportDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const reportPath = path.join(reportDir, `preview-${timestamp}.md`);

  const actionSteps = parsed.steps.filter(s => !s.action.startsWith('assert'));
  const assertionSteps = parsed.steps.filter(s => s.action.startsWith('assert'));
  const pages = [...new Set(parsed.steps.map(s => s.expectedPage).filter(Boolean))];

  let md = `# NL Test Authoring — Structured Preview Report\n\n`;
  md += `---\n\n`;
  md += `## Metadata\n\n`;
  md += `| Field | Value |\n`;
  md += `|-------|-------|\n`;
  md += `| **Instructions** | ${instructions} |\n`;
  md += `| **Test Title** | ${parsed.testTitle} |\n`;
  md += `| **Epic** | ${parsed.epic || 'N/A'} |\n`;
  md += `| **Feature** | ${parsed.feature || 'N/A'} |\n`;
  md += `| **Story** | ${parsed.story || 'N/A'} |\n`;
  md += `| **Severity** | ${parsed.severity || 'normal'} |\n`;
  md += `| **Tags** | ${(parsed.tags || []).join(', ')} |\n`;
  md += `| **Parse Time** | ${duration}s |\n`;
  md += `| **Mode** | Preview / Dry-Run (no browser, no file writes) |\n`;
  md += `| **Generated** | ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST |\n`;
  md += `| **AI Model** | ${config.analysisModel || 'gpt-4o'} |\n`;
  md += `| **AI Calls** | 1 |\n`;
  md += `| **Estimated Cost** | ~$0.01 |\n\n`;

  md += `---\n\n`;
  md += `## Summary\n\n`;
  md += `- **Total Steps:** ${parsed.steps.length}\n`;
  md += `- **Actions:** ${actionSteps.length} (navigate, click, fill, etc.)\n`;
  md += `- **Assertions:** ${assertionSteps.length} (verification checkpoints)\n`;
  md += `- **Pages Involved:** ${pages.length} (${pages.join(', ')})\n\n`;

  md += `---\n\n`;
  md += `## Execution Plan\n\n`;
  md += `| Step | Action | Description | Target | Value | Expected Page |\n`;
  md += `|------|--------|-------------|--------|-------|---------------|\n`;
  for (const step of parsed.steps) {
    const icon = step.action.startsWith('assert') ? '✓' : '▶';
    md += `| ${icon} ${step.stepNumber} | \`${step.action}\` | ${step.description} | ${step.target || '-'} | ${step.value || '-'} | ${step.expectedPage || '-'} |\n`;
  }

  md += `\n---\n\n`;
  md += `## Step-by-Step Breakdown\n\n`;
  for (const step of parsed.steps) {
    const icon = step.action.startsWith('assert') ? '✓' : '▶';
    md += `### ${icon} Step ${step.stepNumber}: ${step.description}\n\n`;
    md += `- **Action:** \`${step.action}\`\n`;
    if (step.target) md += `- **Target Element:** ${step.target}\n`;
    if (step.value) md += `- **Value:** ${step.value}\n`;
    if (step.valueSource) md += `- **Data Source:** \`${step.valueSource}\`\n`;
    if (step.urlPattern) md += `- **URL Pattern:** \`${step.urlPattern}\`\n`;
    if (step.expectedPage) md += `- **Expected Page After:** ${step.expectedPage}\n`;
    md += `\n`;
  }

  md += `---\n\n`;
  md += `## Generated Playwright Code (Template)\n\n`;
  md += `> This code is a structural template derived from the parsed steps.\n`;
  md += `> It demonstrates how the NL instructions map to executable Playwright actions.\n`;
  md += `> A QA engineer should review and refine selectors before committing.\n\n`;
  md += '```javascript\n' + code + '\n```\n\n';

  md += `---\n\n`;
  md += `## QA Lead Decision Points\n\n`;
  md += `| # | Decision | Context |\n`;
  md += `|---|----------|----------|\n`;
  md += `| 1 | **Approve test scenario?** | Does this flow cover a valid user journey? |\n`;
  md += `| 2 | **Selector refinement needed?** | Template uses generic selectors — refine with actual DOM |\n`;
  md += `| 3 | **Add to regression suite?** | If approved, add to \`tests/generated/smoke/\` |\n`;
  md += `| 4 | **Data dependencies?** | Check if \`testDataConfig\` values are current |\n`;
  md += `| 5 | **Environment constraints?** | Verify target pages are accessible in QA staging |\n\n`;

  md += `---\n\n`;
  md += `## How to Execute This Test\n\n`;
  md += `If approved, the full NL authoring pipeline can execute this against the live app:\n\n`;
  md += '```bash\n';
  md += `npm run ai:author:login -- --instructions "${instructions}"\n`;
  md += '```\n\n';
  md += `This will launch a headed browser, execute each step, and generate production-ready Page Objects + test specs.\n\n`;
  md += `---\n\n`;
  md += `*Report generated by AI NL Test Authoring Framework — Preview Mode*\n`;

  fs.writeFileSync(reportPath, md, 'utf-8');

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Preview Complete                                       ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Steps:  ${String(parsed.steps.length).padEnd(47)} ║`);
  console.log(`║  Time:   ${(duration + 's').padEnd(47)} ║`);
  console.log(`║  Report: ai-reports/nl-authoring/preview-${timestamp.substring(0, 10)}...  ║`);
  console.log(`║  Files written: 0 (preview mode — report only)          ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n  📄 Full report: ${reportPath}`);
}

main().catch(err => {
  console.error(`Preview failed: ${err.message}`);
  process.exit(1);
});
