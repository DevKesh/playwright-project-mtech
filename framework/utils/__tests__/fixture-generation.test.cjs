const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

function promptSources() {
  const generate = read('framework/ai/scripts/nl-author-generate.js');
  const prompt = vm.runInNewContext(generate.slice(generate.indexOf('const PAGE_OBJECT_API'), generate.indexOf('async function main()')) + '\nSYSTEM_PROMPT');
  const registry = read('framework/ai/agents/spec-generator.js');
  const builder = registry.slice(registry.indexOf('function buildSingleShotPrompt'), registry.indexOf('// ── Main Generator'));
  const buildPrompt = vm.runInNewContext(builder + '\nbuildSingleShotPrompt', {
    formatRegistriesForPrompt: () => '',
    testDataConfig: { targetApp: { baseUrl: 'https://fixture.test', loginUrl: 'https://fixture.test/login' } },
  });
  return [
    read('.github/copilot-instructions.md'),
    prompt,
    buildPrompt({ instructions: 'Verify device categories', registries: {}, testMeta: {}, existingPageObjects: '' }).systemPrompt,
  ];
}

test('all authoring contracts specify isolated authenticated and public fixtures', () => {
  for (const prompt of promptSources()) {
    assert.match(prompt, /framework\/fixtures\/smoke\.fixture/);
    assert.match(prompt, /LOGIN_MONITOR_USERNAME/);
    assert.match(prompt, /unauthenticated/i);
    assert.match(prompt, /90000/);
    assert.match(prompt, /300000/);
    assert.match(prompt, /finally/);
    assert.doesNotMatch(prompt, /test\.beforeAll\(|test\.afterAll\(|chromium\.launch\(|mode: 'serial'/);
  }
});

test('authoring templates compile and declare only supported fixture dependencies', () => {
  for (const prompt of promptSources()) {
    const example = /```javascript\s*([\s\S]*?)```/.exec(prompt)?.[1];
    assert.ok(example, 'A runnable template must be present');
    assert.doesNotThrow(() => new vm.Script(example));
    assert.match(example, /async \(\{ homePage, devicesPage \}\)/);
    assert.doesNotMatch(example, /let page|new \w+Page|browser\.close/);
  }
});