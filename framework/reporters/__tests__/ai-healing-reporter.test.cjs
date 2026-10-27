const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function loadReporter() {
  const filename = path.resolve(__dirname, '../../ai/reporters/ai-healing-reporter.js');
  const realRequire = createRequire(filename);
  const module = { exports: {} };
  const dependencies = {
    '../config/ai.config': { loadAIConfig: () => ({ enabled: false, auditEnabled: false }) },
    '../graph/healing-graph': {},
    '../storage/healing-history': {},
    '../audit/audit-trail': { AuditTrail: class { generateRunId() { return 'offline-run'; } } },
    '../metrics/cost-tracker': {},
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, process, console,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : realRequire(name),
  }, { filename });
  return new module.exports();
}

const testCase = { location: { file: 'camera.spec.js' }, titlePath: () => ['camera suite', 'camera names'] };

test('camera failure analysis receives scoped DOM and prefers the section screenshot', async () => {
  const reporter = loadReporter();
  reporter.healingGraph = {};
  const calls = [];
  reporter._runHealing = async input => calls.push(input);
  const state = { expectedCount: 8, cameras: [{ displayedName: 'Renamed Entrance' }], dom: '<app-live-camera>Renamed Entrance</app-live-camera>' };
  await reporter.onTestEnd(testCase, {
    status: 'failed', duration: 1, error: { message: 'Original count failure' },
    attachments: [
      { name: 'failure-screenshot', path: 'whole-page.png' },
      { name: 'camera-live-section', path: 'camera-section.png' },
      { name: 'camera-live-state', contentType: 'application/json', body: Buffer.from(JSON.stringify(state)) },
    ],
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].screenshotPath, 'camera-section.png');
  assert.match(calls[0].errorMessage, /Original count failure/);
  assert.match(calls[0].errorMessage, /Renamed Entrance/);
  assert.match(calls[0].errorMessage, /app-live-camera/);
  assert.match(calls[0].errorMessage, /names may change/);
});

test('passed renamed camera tests do not invoke post-failure AI analysis', async () => {
  const reporter = loadReporter();
  reporter.healingGraph = {};
  reporter._runHealing = async () => assert.fail('Unexpected AI analysis');
  await reporter.onTestEnd(testCase, { status: 'passed', duration: 1, attachments: [] });
  assert.equal(reporter._pendingHealings.length, 0);
});

test('unreadable camera evidence preserves original failure and ordinary screenshot fallback', async () => {
  const reporter = loadReporter();
  reporter.healingGraph = {};
  let captured;
  reporter._runHealing = async input => { captured = input; };
  await reporter.onTestEnd(testCase, {
    status: 'timedOut', duration: 1, error: { message: 'Original timeout' },
    attachments: [
      { name: 'failure-screenshot', path: 'whole-page.png' },
      { name: 'camera-live-state', contentType: 'application/json', body: Buffer.from('invalid-json') },
    ],
  });
  assert.equal(captured.screenshotPath, 'whole-page.png');
  assert.match(captured.errorMessage, /Original timeout/);
  assert.match(captured.errorMessage, /evidence was unavailable/);
});