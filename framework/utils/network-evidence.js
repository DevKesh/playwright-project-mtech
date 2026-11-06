const MAX_RESPONSES = 100;
const MAX_BODY_BYTES = 32768;
const diagnosticFields = new Set(['status', 'statuscode', 'resultcode', 'errorcode', 'code', 'success', 'count', 'total']);
const containers = new Set(['data', 'result', 'results', 'response', 'errors']);
const safeStates = /^(ok|success|failed|failure|error|pending|true|false)$/i;
const sensitiveEndpoint = /auth|login|logout|token|session|password|credential|otp|pin/i;

function diagnosticBody(value, depth = 0) {
  if (depth > 5) return '[depth limit]';
  if (Array.isArray(value)) return value.slice(0, 20).map(item => diagnosticBody(item, depth + 1));
  if (!value || typeof value !== 'object') return '[omitted]';
  const result = {};
  let omittedFields = 0;
  for (const [key, item] of Object.entries(value)) {
    const field = key.toLowerCase();
    if (diagnosticFields.has(field) && (typeof item === 'number' || typeof item === 'boolean' ||
        (typeof item === 'string' && safeStates.test(item)))) {
      result[key] = item;
    } else if (containers.has(field) && item && typeof item === 'object') {
      result[key] = diagnosticBody(item, depth + 1);
    } else {
      omittedFields++;
    }
  }
  if (omittedFields) result.omittedFields = omittedFields;
  return result;
}

function startNetworkEvidence(page, { maxResponses = MAX_RESPONSES, drainTimeout = 2000, isAuthenticated = () => true } = {}) {
  const responses = [];
  const pending = [];
  let dropped = 0;
  let stopped = false;
  let finalized = false;

  function onResponse(response) {
    if (stopped) return;
    try {
      const request = response.request();
      const resourceType = request.resourceType();
      if (!['xhr', 'fetch', 'document'].includes(resourceType)) return;
      if (responses.length >= maxResponses) { dropped++; return; }
      const url = new URL(response.url());
      if (!['http:', 'https:'].includes(url.protocol)) return;
      const sensitive = sensitiveEndpoint.test(url.pathname);
      const authenticated = isAuthenticated();
      const headers = response.headers();
      const pathname = sensitive ? '/[sensitive-endpoint]' : url.pathname.split('/').map(segment =>
        /^[a-z_-]{1,40}$/i.test(segment) ? segment : segment ? '[redacted]' : '').join('/');
      const record = {
        url: `${url.origin}${pathname}`,
        method: request.method(), resourceType, status: response.status(),
        phase: authenticated ? 'test' : 'login-setup',
        securityChallengeDetected: headers['cf-mitigated'] === 'challenge',
        body: { omitted: 'Only bounded JSON diagnostic fields are collected.' },
      };
      responses.push(record);
      if (!authenticated) { record.body = { omitted: 'Login setup response bodies are not collected.' }; return; }
      if (sensitive) { record.body = { omitted: 'Authentication or session endpoint.' }; return; }
      const length = Number(headers['content-length']);
      if (!/\bjson\b/i.test(headers['content-type'] || '') ||
          !Number.isSafeInteger(length) || length < 1 || length > MAX_BODY_BYTES) return;
      record.body = { omitted: 'Response body not completed before evidence collection ended.' };
      pending.push((async () => {
        try {
          const buffer = await response.body();
          if (!finalized && buffer.length <= MAX_BODY_BYTES) {
            record.body = diagnosticBody(JSON.parse(buffer.toString('utf8')));
          }
        } catch {
          if (!finalized) record.body = { omitted: 'JSON body unavailable or invalid.' };
        }
      })());
    } catch {
      dropped++;
    }
  }

  page.on('response', onResponse);
  return async function attach(testInfo) {
    stopped = true;
    page.off('response', onResponse);
    let timer;
    try {
      await Promise.race([
        Promise.all(pending),
        new Promise(resolve => { timer = setTimeout(resolve, drainTimeout); }),
      ]);
      finalized = true;
      await testInfo.attach('Smoke network responses', {
        body: JSON.stringify({
          scope: 'Login setup and test document, XHR and fetch responses; no request bodies, raw headers or query strings. Setup response bodies are excluded.',
          bodyPolicy: 'Only diagnostic status/code/count fields from small JSON bodies with a declared size. Other fields and body formats are omitted.',
          captured: responses.length, dropped, responses,
        }, null, 2),
        contentType: 'application/json',
      });
    } finally {
      finalized = true;
      clearTimeout(timer);
    }
  };
}

module.exports = { startNetworkEvidence };