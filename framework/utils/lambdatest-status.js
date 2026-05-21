/**
 * LambdaTest Session Status Updater
 * 
 * After test execution completes, this script:
 *   1. Reads allure-results to determine overall pass/fail
 *   2. Calls LambdaTest REST API to find the latest session(s) for this build
 *   3. Marks session(s) as 'passed' or 'failed' on the LambdaTest dashboard
 *
 * Usage:
 *   node framework/utils/lambdatest-status.js
 *
 * Requires:
 *   LT_USERNAME, LT_ACCESS_KEY in .env
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── Load .env ──────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../../.env');
try {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch (e) { /* best-effort */ }

const LT_USERNAME = process.env.LT_USERNAME;
const LT_ACCESS_KEY = process.env.LT_ACCESS_KEY;
const LT_BUILD_NAME = process.env.LT_BUILD_NAME || `TC2-${new Date().toISOString().slice(0, 10)}`;

if (!LT_USERNAME || !LT_ACCESS_KEY) {
  console.error('[LT-Status] LT_USERNAME or LT_ACCESS_KEY not set. Cannot update session status.');
  process.exit(1);
}

const AUTH = Buffer.from(`${LT_USERNAME}:${LT_ACCESS_KEY}`).toString('base64');

// ─── Determine test outcome from allure-results ─────────────────────────────
function getTestOutcome() {
  const resultsDir = path.resolve(process.cwd(), 'allure-results');
  try {
    const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('-result.json'));
    if (files.length === 0) return { status: 'unknown', passed: 0, failed: 0, total: 0 };

    let passed = 0, failed = 0, broken = 0, skipped = 0, total = 0;
    for (const file of files) {
      const r = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
      total++;
      if (r.status === 'passed') passed++;
      else if (r.status === 'failed') failed++;
      else if (r.status === 'broken') broken++;
      else if (r.status === 'skipped') skipped++;
    }

    const status = (failed === 0 && broken === 0) ? 'passed' : 'failed';
    return { status, passed, failed, broken, skipped, total };
  } catch {
    return { status: 'unknown', passed: 0, failed: 0, total: 0 };
  }
}

// ─── LambdaTest API helpers ─────────────────────────────────────────────────
function ltApiRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.lambdatest.com',
      port: 443,
      path: apiPath,
      method: method,
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getRecentSessions() {
  // Get sessions from the current build
  const encodedBuild = encodeURIComponent(LT_BUILD_NAME);
  const res = await ltApiRequest(
    'GET',
    `/automation/api/v1/sessions?limit=10&sort=start_timestamp.desc`
  );

  if (res.statusCode !== 200) {
    console.error(`[LT-Status] Failed to fetch sessions: HTTP ${res.statusCode}`);
    return [];
  }

  // Filter sessions matching our build name
  const sessions = (res.body.data || []).filter(s =>
    s.build_name === LT_BUILD_NAME || s.build_name?.includes('TC2-')
  );

  return sessions;
}

async function updateSessionStatus(sessionId, status, remark) {
  const res = await ltApiRequest(
    'PATCH',
    `/automation/api/v1/sessions/${sessionId}`,
    { status_ind: status, reason: remark }
  );

  if (res.statusCode === 200) {
    console.log(`[LT-Status] Session ${sessionId} marked as: ${status.toUpperCase()}`);
    return true;
  } else {
    console.error(`[LT-Status] Failed to update session ${sessionId}: HTTP ${res.statusCode}`);
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[LT-Status] Checking test results and updating LambdaTest session status...`);
  console.log(`[LT-Status] Build: ${LT_BUILD_NAME}`);

  // 1. Get test outcome
  const outcome = getTestOutcome();
  console.log(`[LT-Status] Test Results: ${outcome.passed} passed, ${outcome.failed} failed, ${outcome.broken || 0} broken, ${outcome.total} total`);
  console.log(`[LT-Status] Overall status: ${outcome.status.toUpperCase()}`);

  if (outcome.status === 'unknown') {
    console.log('[LT-Status] No test results found — skipping status update.');
    return;
  }

  // 2. Get recent LambdaTest sessions
  const sessions = await getRecentSessions();
  if (sessions.length === 0) {
    console.log('[LT-Status] No matching LambdaTest sessions found for this build.');
    return;
  }

  // 3. Update the most recent session(s) from today
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter(s => s.start_timestamp?.includes(today));
  const targetSessions = todaySessions.length > 0 ? todaySessions : [sessions[0]];

  const remark = outcome.status === 'passed'
    ? `All ${outcome.passed} tests passed`
    : `${outcome.failed} failed, ${outcome.broken || 0} broken out of ${outcome.total} tests`;

  let updated = 0;
  for (const session of targetSessions.slice(0, 3)) {
    const success = await updateSessionStatus(session.session_id, outcome.status, remark);
    if (success) updated++;
  }

  console.log(`[LT-Status] Updated ${updated} session(s) on LambdaTest dashboard.`);
}

main().catch(err => {
  console.error('[LT-Status] Error:', err.message);
  process.exit(1);
});
