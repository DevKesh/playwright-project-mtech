const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadEnvironment } = require('../../config/environment');
const { getAccount } = require('../../config/accounts');

test('committed environment template has only blank account and service values', () => {
  const values = require('dotenv').parse(fs.readFileSync(path.resolve(__dirname, '../../../.env.example')));
  assert.ok(Object.hasOwn(values, 'ACCOUNT_APPROVED_MONITOR_USERNAME'));
  assert.ok(Object.hasOwn(values, 'ACCOUNT_APPROVED_MONITOR_PASSWORD'));
  assert.ok(Object.values(values).every(value => value === ''));
});

test('named accounts resolve only their own credential pair', () => {
  const env = {
    ACCOUNT_APPROVED_MONITOR_USERNAME: 'synthetic-user',
    ACCOUNT_APPROVED_MONITOR_PASSWORD: 'synthetic-password',
    ACCOUNT_SECONDARY_USERNAME: 'other-user',
    ACCOUNT_SECONDARY_PASSWORD: 'other-password',
  };
  assert.deepEqual(getAccount('approved_monitor', env), {
    username: 'synthetic-user', password: 'synthetic-password',
  });
  assert.equal(getAccount('secondary', env).username, 'other-user');
});

test('missing, partial and malformed accounts fail without exposing values', () => {
  assert.throws(() => getAccount('unknown', {}), /ACCOUNT_UNKNOWN_USERNAME/);
  for (const name of ['', '../secret', 'UPPER', 'two-names', 'name with space']) {
    assert.throws(() => getAccount(name, {}), /Invalid account name/);
  }
  const env = {
    ACCOUNT_APPROVED_MONITOR_USERNAME: 'must-not-be-printed',
    LOGIN_MONITOR_USERNAME: 'legacy', LOGIN_MONITOR_PASSWORD: 'legacy-secret',
  };
  assert.throws(() => getAccount('approved_monitor', env), error => {
    assert.match(error.message, /ACCOUNT_APPROVED_MONITOR_PASSWORD/);
    assert.doesNotMatch(error.message, /must-not-be-printed|legacy-secret/);
    return true;
  });
  assert.throws(() => getAccount('approved_monitor', {
    ...env, ACCOUNT_APPROVED_MONITOR_USERNAME: '',
  }), /ACCOUNT_APPROVED_MONITOR/);
});

test('legacy variables are aliases only for their documented profile', () => {
  const env = { LOGIN_MONITOR_USERNAME: 'approved', LOGIN_MONITOR_PASSWORD: 'synthetic' };
  assert.equal(getAccount('approved_monitor', env).username, 'approved');
  assert.throws(() => getAccount('secondary', env), /ACCOUNT_SECONDARY/);
  assert.throws(() => getAccount('approved_monitor', { TC_USERNAME: 'wrong', TC_PASSWORD: 'wrong' }), /LOGIN_MONITOR/);
  assert.equal(getAccount('configured', { TC_USERNAME: 'legacy', TC_PASSWORD: 'synthetic' }).username, 'legacy');
});

test('QA file uses dotenv parsing and shell variables take precedence', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-env-'));
  try {
    fs.writeFileSync(path.join(root, '.env.qa'), 'ACCOUNT_SAMPLE_USERNAME="qa user"\nACCOUNT_SAMPLE_PASSWORD="value#with=punctuation"\n');
    fs.writeFileSync(path.join(root, '.env'), 'LEGACY_ONLY=not-loaded\n');
    const env = { ACCOUNT_SAMPLE_USERNAME: 'shell-user' };
    loadEnvironment({ root, env });
    assert.equal(env.ACCOUNT_SAMPLE_USERNAME, 'shell-user');
    assert.equal(env.ACCOUNT_SAMPLE_PASSWORD, 'value#with=punctuation');
    assert.equal(env.LEGACY_ONLY, undefined);
    const ci = { CI: 'true' };
    loadEnvironment({ root, env: ci });
    assert.deepEqual(ci, { CI: 'true' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});