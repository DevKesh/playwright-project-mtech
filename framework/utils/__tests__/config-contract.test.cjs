const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../..');
const configPath = path.join(root, 'playwright.config.js');

test('root configuration is secret-free and owns six disjoint projects', () => {
  const source = fs.readFileSync(configPath, 'utf8');
  assert.doesNotMatch(source, /dotenv|globalSetup|LT_ACCESS_KEY|ai-healing-reporter|allure-auto-reporter/);
  const config = require(configPath);
  assert.equal(config.workers, 4);
  assert.equal(config.retries, 0);
  assert.equal(config.fullyParallel, false);
  assert.deepEqual(config.projects.map(project => project.name), [
    'tc2', 'monitoring', 'alarmnet-login-security', 'alarmnet-mobile-security',
    'alarmnet-forgot-login-security', 'framework',
  ]);
  for (const project of config.projects) {
    assert.equal(project.retries, 0);
    assert.equal(project.metadata[project.name === 'framework' ? 'offline' : 'live'], true);
    if (['tc2', 'monitoring'].includes(project.name)) assert.equal(project.workers, 1);
    if (project.name.includes('security')) {
      assert.equal(project.use.trace, 'off');
      assert.equal(project.use.video, 'off');
      assert.match(project.use.screenshot.style, /input/);
    }
  }
  const allure = config.reporter.find(([name]) => name === 'allure-playwright')[1];
  assert.equal(allure.detail, false);
  assert.equal(allure.resultsDir, process.env.ALLURE_RESULTS_DIR || 'allure-results');
});

test('monitor repetitions accept only integers from 1 through 100', () => {
  for (const value of ['0', '101', '1.5', 'invalid', '']) {
    const result = spawnSync(process.execPath, ['-e', 'require("./playwright.config.js")'], {
      cwd: root,
      env: { ...process.env, LOGIN_MONITOR_REPETITIONS: value },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0, `accepted ${JSON.stringify(value)}`);
    assert.match(result.stderr, /LOGIN_MONITOR_REPETITIONS must be an integer between 1 and 100/);
  }
  for (const value of ['1', '20', '100']) {
    const result = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(require("./playwright.config.js").projects.find(project => project.name === "monitoring").repeatEach))'], {
      cwd: root,
      env: { ...process.env, LOGIN_MONITOR_REPETITIONS: value },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), value);
  }
});

test('npm defaults are offline and live aliases use explicit project selection', () => {
  const { scripts } = require(path.join(root, 'package.json'));
  assert.equal(scripts.test, 'node --test "framework/**/__tests__/*.test.cjs"');
  assert.equal(scripts['test:framework'], scripts.test);
  assert.match(scripts['test:framework:browser'], /--project framework/);
  for (const [name, command] of Object.entries(scripts)) {
    assert.doesNotMatch(command, /(^|[^&])&([^&]|$)/, name);
    assert.doesNotMatch(command, /--retries\s+[1-9]|--project (?:chrome|tc-smoke|tc-plan)|--config playwright\./, name);
    if (/playwright test/.test(command) && !/--project framework/.test(command)) {
      assert.match(command, /RUN_LIVE_TESTS=true/, name);
      assert.match(command, /--project /, name);
    }
  }
});

test('collection does not eagerly load dotenv or AI dependencies', () => {
  const cli = require.resolve('@playwright/test/cli');
  const script = `
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function(request, ...args) {
      if (/^(dotenv(?:\\/config)?|openai)$|ai-client-factory|tc\\.ai\\.fixture/.test(request)) {
        throw new Error('Forbidden collection dependency: ' + request);
      }
      return load.call(this, request, ...args);
    };
    process.argv = [process.execPath, ${JSON.stringify(cli)}, 'test', '--list', '--repeat-each', '1', '--reporter', 'json'];
    require(${JSON.stringify(cli)});
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: root,
    env: { ...process.env, CI: 'true', LOGIN_MONITOR_REPETITIONS: '20', LOGIN_SECURITY_ATTEMPTS: '5', AI_HEALING_ENABLED: 'false', RUN_LIVE_TESTS: 'false' },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 0, report.errors.map(error => error.message).join('\n') || result.stderr);
});

test('collection is disjoint and preserves eight tagged smoke tests', () => {
  const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--list', '--repeat-each', '1', '--reporter', 'json'], {
    cwd: root,
    env: { ...process.env, CI: 'true', LOGIN_MONITOR_REPETITIONS: '20', LOGIN_SECURITY_ATTEMPTS: '5', AI_HEALING_ENABLED: 'false', RUN_LIVE_TESTS: 'false' },
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 0, report.errors.map(error => error.message).join('\n') || result.stderr);
  const specs = [];
  function collect(suite) {
    specs.push(...(suite.specs || []));
    for (const child of suite.suites || []) collect(child);
  }
  for (const suite of report.suites) collect(suite);
  const counts = {};
  for (const spec of specs) {
    assert.equal(spec.tests.length, 1, `Duplicate ownership: ${spec.file}: ${spec.title}`);
    const project = spec.tests[0].projectName;
    counts[project] = (counts[project] || 0) + 1;
  }
  assert.deepEqual(counts, {
    tc2: 9, monitoring: 2, 'alarmnet-login-security': 5,
    'alarmnet-mobile-security': 5, 'alarmnet-forgot-login-security': 5, framework: 4,
  });
  const smoke = specs.filter(spec => spec.file.replaceAll('\\', '/').endsWith('tc2/smoke-suite.spec.js'));
  assert.equal(smoke.length, 8);
  for (const spec of smoke) {
    assert.ok(spec.tags.includes('smoke'), spec.title);
    assert.ok(spec.tags.includes('regression'), spec.title);
  }
  assert.ok(smoke.find(spec => spec.title.startsWith('TC-002')).tags.includes('panel'));
});

test('one root config remains and continuous monitoring selects its native project', () => {
  const before = { ...process.env };
  require(configPath);
  assert.ok(JSON.stringify({ ...process.env }) === JSON.stringify(before), 'Config import must not mutate process.env');
  const monitor = fs.readFileSync(path.join(root, 'framework/utils/run-login-monitor.js'), 'utf8');
  assert.match(monitor, /'--project', 'monitoring'/);
  assert.doesNotMatch(monitor, /--config/);
  for (const removed of ['playwright.login-monitor.config.js', 'playwright.login-security.config.js', 'playwright.smoke-validation.config.js', 'framework/utils/__tests__/fixtures/fixture-contract.config.cjs']) {
    assert.equal(fs.existsSync(path.join(root, removed)), false, removed);
  }
});