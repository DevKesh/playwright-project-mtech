const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildMessage } = require('../slack-notify');

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