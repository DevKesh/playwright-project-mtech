const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { inspectResults, readReportSummary } = require('../validate-allure-results');

function withFiles(files, callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-validation-'));
  try {
    for (const [filename, value] of Object.entries(files)) {
      const target = path.join(directory, filename);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
    }
    callback(directory);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

const record = { uuid: 'test-1', name: 'Synthetic test', status: 'passed', start: 10, stop: 30 };

test('missing, empty, metadata-only and malformed results block publication', () => {
  assert.equal(inspectResults(path.join(os.tmpdir(), 'nonexistent-allure-results')).valid, false);
  for (const files of [{}, { 'categories.json': [], 'test-attachment.json': record },
    { 'test-result.json': '{' }, { 'test-result.json': {} }, { 'test-result.json': { status: 'passed' } }]) {
    withFiles(files, directory => assert.equal(inspectResults(directory).valid, false));
  }
});

test('valid passing and failed nested records are publishable', () => {
  for (const status of ['passed', 'failed', 'broken']) {
    withFiles({ 'nested/test-result.json': { ...record, status }, 'categories.json': [] }, directory => {
      const result = inspectResults(directory);
      assert.equal(result.valid, true);
      assert.equal(result.count, 1);
      assert.equal(result.summary.statistic[status], 1);
      assert.equal(result.summary.time.duration, 20);
    });
  }
});

test('mixed corrupt records retain known counts but block publishing', () => {
  withFiles({ 'good-result.json': record, 'bad-result.json': '{' }, directory => {
    const result = inspectResults(directory);
    assert.equal(result.valid, false);
    assert.equal(result.summary.statistic.passed, 1);
    assert.equal(result.summary.incomplete, true);
  });
  withFiles({ 'one-result.json': record, 'duplicate-result.json': record }, directory => {
    assert.equal(inspectResults(directory).valid, false);
  });
});

test('generated summary requires positive integer totals and consistent counts', () => {
  for (const stats of [{ total: 0 }, { total: '1', passed: 1 }, { total: 1, passed: 2 }, { total: 1, failed: -1 }]) {
    withFiles({ 'summary.json': { stats, status: 'passed' } }, directory => assert.equal(readReportSummary(directory), null));
  }
  for (const filename of ['summary.json', 'widgets/summary.json']) {
    withFiles({ [filename]: { stats: { total: 1, failed: 1 } } }, directory => {
      assert.equal(readReportSummary(directory).statistic.failed, 1);
    });
  }
});

test('CLI emits explicit readiness and partial-count outputs without live services', () => {
  withFiles({ 'test-result.json': record }, directory => {
    const output = path.join(directory, 'outputs');
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../validate-allure-results.js'), 'results', directory], {
      encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output, EXPECTED_RESULTS: '8' },
    });
    assert.equal(result.status, 0);
    assert.match(fs.readFileSync(output, 'utf8'), /valid=true\ncount=1\nincomplete=true/);
  });
  withFiles({ 'summary.json': { stats: { total: 1, passed: 1 } } }, directory => {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../validate-allure-results.js'), 'summary', directory], {
      encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: path.join(directory, 'outputs'), EXPECTED_RESULTS: '2' },
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /valid=false/);
  });
});

test('installed Allure generates a nonempty report from nested synthetic pass/fail records', () => {
  const cli = path.resolve(__dirname, '../../../node_modules/allure/cli.js');
  withFiles({
    'results/nested/pass-result.json': { ...record, historyId: 'pass', testCaseId: 'pass', fullName: 'Synthetic pass', stage: 'finished' },
    'results/nested/fail-result.json': { ...record, uuid: 'test-2', name: 'Synthetic failure', historyId: 'fail', testCaseId: 'fail', fullName: 'Synthetic fail', status: 'failed', stage: 'finished' },
  }, directory => {
    const result = spawnSync(process.execPath, [cli, 'generate', '-o', 'report', 'results/nested'], {
      cwd: directory, encoding: 'utf8', timeout: 60000,
      env: { ...process.env, CI: 'true' },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = readReportSummary(path.join(directory, 'report'));
    assert.ok(summary, `Generated summary must contain test records: ${fs.readFileSync(path.join(directory, 'report/summary.json'), 'utf8')}; CLI: ${result.stdout}`);
    assert.equal(summary.statistic.total, 2);
    assert.equal(summary.statistic.passed, 1);
    assert.equal(summary.statistic.failed, 1);
  });
});