const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildMessage, loadSummary } = require('../slack-notify');

function withResults(files, callback) {
  const previous = process.cwd();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'slack-results-'));
  try {
    process.chdir(directory);
    for (const [file, contents] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(contents));
    }
    callback();
  } finally {
    process.chdir(previous);
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('empty generated summary falls back to actual nested monitor results', () => {
  const files = { 'allure-report/summary.json': { stats: { total: 0 }, status: 'passed' } };
  for (let index = 0; index < 60; index++) {
    files[`allure-results/login-monitor/${index}-result.json`] = {
      status: index < 19 ? 'passed' : 'failed', start: 1000 + index * 100, stop: 1100 + index * 100,
    };
  }
  withResults(files, () => {
    const summary = loadSummary();
    assert.equal(summary.statistic.total, 60);
    assert.equal(summary.statistic.passed, 19);
    assert.equal(summary.statistic.failed, 41);
    assert.match(buildMessage(summary).text, /Passed: 19, Failed: 41, Total: 60/);
  });
});

test('Allure 3 report preserves actual authentication totals', () => {
  withResults({ 'allure-report/summary.json': { stats: { total: 60, passed: 19, failed: 41 }, status: 'failed', duration: 60000 } }, () => {
    const summary = loadSummary();
    assert.equal(summary.statistic.total, 60);
    assert.equal(summary.reportStatus, 'failed');
    assert.match(buildMessage(summary).text, /Passed: 19, Failed: 41, Total: 60/);
  });
});

test('Allure 2 reports remain supported', () => {
  withResults({ 'allure-report/widgets/summary.json': passedSummary }, () => {
    assert.deepEqual(loadSummary(), passedSummary);
  });
});

test('empty Allure 2 report falls back to raw results without invalid durations', () => {
  withResults({
    'allure-report/widgets/summary.json': { statistic: { total: 0 } },
    'allure-results/current-result.json': { status: 'failed' },
  }, () => {
    const summary = loadSummary();
    assert.equal(summary.statistic.failed, 1);
    assert.equal(summary.statistic.total, 1);
    assert.equal(summary.time.duration, 0);
  });
});

test('current raw results take precedence over historical reports', () => {
  withResults({
    'allure-reports-history/allure-report-2099/summary.json': { stats: { total: 8, passed: 8 } },
    'allure-results/current-result.json': { status: 'failed' },
  }, () => {
    assert.equal(loadSummary().statistic.failed, 1);
    assert.equal(loadSummary().statistic.total, 1);
  });
});

test('CI never substitutes historical results for missing current results', () => {
  withResults({ 'allure-reports-history/allure-report-2099/summary.json': { stats: { total: 8, passed: 8 } } }, () => {
    withEnv({ CI: 'true' }, () => assert.equal(loadSummary(), null));
  });
});

test('explicit result and report directories isolate the selected suite', () => {
  withResults({
    'allure-report/summary.json': { stats: { total: 8, passed: 8 } },
    'monitor-report/summary.json': { stats: { total: 0 } },
    'allure-results/other-result.json': { status: 'failed' },
    'allure-results/login-monitor/selected-result.json': { status: 'passed' },
  }, () => {
    withEnv({ SLACK_REPORT_DIR: 'monitor-report', SLACK_RESULTS_DIR: 'allure-results/login-monitor' }, () => {
      assert.equal(loadSummary().statistic.total, 1);
      assert.equal(loadSummary().statistic.passed, 1);
    });
  });
});

test('missing or empty results show unavailable counts even after a successful command', () => {
  withResults({}, () => assert.equal(loadSummary(), null));
  for (const summary of [null, { statistic: { total: 0 }, time: { duration: 0 }, reportStatus: 'passed' }]) {
    for (const outcome of ['success', 'failure', undefined]) {
      withEnv({ TEST_OUTCOME: outcome }, () => {
        const payload = buildMessage(summary);
        assert.match(payload.text, /RESULTS UNAVAILABLE/);
        assert.match(payload.attachments[0].fallback, /Test counts unavailable/);
        assert.doesNotMatch(JSON.stringify(payload), /Total: 0|Passed: 0|Failed: 0|ALL TESTS PASSED|run tests first|0s/);
      });
    }
  }
});

const passedSummary = {
  statistic: { passed: 2, failed: 0, broken: 0, skipped: 0, total: 2 },
  time: { duration: 55000 },
  reportStatus: 'passed',
};

function withEnv(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('smoke notifications retain their default suite name', () => {
  withEnv({ TEST_SUITE_NAME: undefined }, () => {
    assert.match(buildMessage(passedSummary).attachments[0].blocks[0].text.text, /Playwright Smoke Suite/);
  });
});

test('authentication notification includes its suite name and permanent Allure link', () => {
  const reportUrl = 'https://example.test/login-monitor/runs/123/1/';
  withEnv({ TEST_SUITE_NAME: 'Login & Forgot Password (5 + 3 cycles)', REPORT_URL: reportUrl, HEAL_ENABLED: 'false' }, () => {
    const payload = buildMessage(passedSummary);
    const blocks = payload.attachments[0].blocks;
    assert.match(blocks[0].text.text, /Login & Forgot Password/);
    assert.match(payload.text, /Total: 2/);
    assert.ok(blocks.find(block => block.type === 'actions').elements.some(button => button.url === reportUrl));
    assert.ok(blocks.flatMap(block => block.fields || []).some(field => /AI Healing.*Disabled/s.test(field.text)));
  });
});

test('failed tests produce a red failure notification', () => {
  const payload = buildMessage({
    ...passedSummary,
    statistic: { passed: 1, failed: 1, broken: 0, skipped: 0, total: 2 },
    reportStatus: 'failed',
  });
  assert.equal(payload.attachments[0].color, '#e01e5a');
  assert.match(payload.text, /TESTS FAILED/);
});

test('missing results cannot be reported as a successful run', () => {
  withEnv({ TEST_OUTCOME: 'failure' }, () => {
    const payload = buildMessage({ statistic: { total: 0 }, reportStatus: 'passed' });
    assert.match(payload.text, /TESTS FAILED/);
  });
});

