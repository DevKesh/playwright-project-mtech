const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startNetworkEvidence } = require('../network-evidence');

function response(overrides = {}) {
  return {
    url: () => 'https://fixture.test/api/devices/123?token=secret-query',
    request: () => ({ resourceType: () => 'fetch', method: () => 'GET' }),
    status: () => 403,
    headers: () => ({ 'content-type': 'application/json', 'content-length': '200', 'set-cookie': 'secret-cookie' }),
    body: async () => Buffer.from(JSON.stringify({ status: 'failed', code: 403, password: 'secret-password', data: { success: false, token: 'secret-token', name: 'private-name', message: 'secret-message' } })),
    ...overrides,
  };
}

test('network attachment keeps response diagnostics without secrets or identity fields', async () => {
  const page = new EventEmitter();
  const attach = startNetworkEvidence(page);
  page.emit('response', response());
  await attach({ attach: async (name, attachment) => {
    assert.equal(name, 'Smoke network responses');
    assert.equal(attachment.contentType, 'application/json');
    const report = JSON.parse(attachment.body);
    assert.equal(report.captured, 1);
    assert.equal(report.responses[0].url, 'https://fixture.test/api/devices/[redacted]');
    assert.equal(report.responses[0].status, 403);
    assert.equal(report.responses[0].body.data.success, false);
    assert.doesNotMatch(attachment.body, /secret-|private-name|set-cookie/);
  } });
  assert.equal(page.listenerCount('response'), 0);
});

test('auth, unbounded, oversized and non-JSON bodies are not read; static assets are excluded', async () => {
  const page = new EventEmitter();
  const attach = startNetworkEvidence(page);
  const noBody = { body: () => assert.fail('Must not read this body') };
  page.emit('response', response({ ...noBody, url: () => 'https://fixture.test/api/session' }));
  for (const headers of [{ 'content-type': 'application/json' }, { 'content-type': 'text/html', 'content-length': '10' }, { 'content-type': 'application/json', 'content-length': '50000' }]) {
    page.emit('response', response({ ...noBody, headers: () => headers }));
  }
  page.emit('response', response({ ...noBody, request: () => ({ resourceType: () => 'image' }) }));
  await attach({ attach: async (_name, attachment) => assert.equal(JSON.parse(attachment.body).captured, 4) });
});

test('collection is bounded and incomplete or unreadable responses cannot block teardown', async () => {
  const page = new EventEmitter();
  const attach = startNetworkEvidence(page, { maxResponses: 2, drainTimeout: 10 });
  page.emit('response', response({ body: () => new Promise(() => {}) }));
  page.emit('response', response({ body: async () => { throw new Error('secret-provider-error'); } }));
  page.emit('response', response());
  await attach({ attach: async (_name, attachment) => {
    const report = JSON.parse(attachment.body);
    assert.equal(report.captured, 2);
    assert.equal(report.dropped, 1);
    assert.match(report.responses[0].body.omitted, /not completed/);
    assert.doesNotMatch(attachment.body, /secret-provider-error/);
  } });
  assert.equal(page.listenerCount('response'), 0);
});

test('empty collection still attaches a truthful summary and attachment failures detach listeners', async () => {
  const page = new EventEmitter();
  const attach = startNetworkEvidence(page);
  await assert.rejects(attach({ attach: async (_name, attachment) => {
    assert.equal(JSON.parse(attachment.body).captured, 0);
    throw new Error('attachment failed');
  } }), /attachment failed/);
  assert.equal(page.listenerCount('response'), 0);
});

test('setup challenge metadata is captured without reading any setup response body', async () => {
  const page = new EventEmitter();
  let authenticated = false;
  const attach = startNetworkEvidence(page, { isAuthenticated: () => authenticated });
  page.emit('response', response({
    headers: () => ({ 'content-type': 'application/json', 'content-length': '200', 'cf-mitigated': 'challenge' }),
    body: () => assert.fail('Setup bodies must never be read, even on non-authentication URLs'),
  }));
  authenticated = true;
  page.emit('response', response());
  await attach({ attach: async (_name, attachment) => {
    const report = JSON.parse(attachment.body);
    assert.equal(report.responses[0].phase, 'login-setup');
    assert.equal(report.responses[0].status, 403);
    assert.equal(report.responses[0].securityChallengeDetected, true);
    assert.match(report.responses[0].body.omitted, /Login setup/);
    assert.equal(report.responses[1].phase, 'test');
    assert.equal(report.responses[1].body.code, 403);
  } });
});