const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const YAML = require('yaml');
const root = path.resolve(__dirname, '../../..');
const directory = path.join(root, '.github/workflows');
const workflows = Object.fromEntries(fs.readdirSync(directory).filter(file => file.endsWith('.yml')).map(file => {
  const document = YAML.parseDocument(fs.readFileSync(path.join(directory, file), 'utf8'), { uniqueKeys: true });
  assert.deepEqual(document.errors, []);
  return [file, document.toJS()];
}));
const workflow = workflows['test-execution.yml'];
const steps = workflow.jobs.execute.steps;
const scope = steps.find(step => step.id === 'scope');

function selection(suite, overrides = {}) {
  let output = '';
  const script = scope.run.replace(/^node <<'NODE'\n/, '').replace(/\nNODE\s*$/, '');
  vm.runInNewContext(script, {
    process: { env: { SUITE: suite, PLATFORM: 'local', RUNNER: 'ubuntu-latest', REPETITIONS: '20', ITERATIONS: '100', INTERVAL_MS: '10000', GITHUB_OUTPUT: 'outputs', GITHUB_STEP_SUMMARY: 'summary', ...overrides } },
    require: name => {
      if (name === 'node:fs') return { appendFileSync: (filename, contents) => { if (filename === 'outputs') output += contents; } };
      if (name === './framework/utils/login-security') return require('../login-security');
      throw new Error('Unexpected workflow import');
    },
  });
  return Object.fromEntries(output.trim().split('\n').map(line => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

test('CI suite mapping selects only intended projects, repetitions and worker counts', () => {
  assert.equal(selection('smoke').args, '--project tc2 --workers 1 --grep @smoke');
  assert.equal(selection('smoke').expected, '8');
  assert.equal(selection('regression').args, '--project tc2 --workers 1 --grep @regression');
  for (const suite of ['generated', 'all', 'total-connect', 'tc2']) {
    assert.equal(selection(suite).args, '--project tc2 --workers 1');
  }
  assert.equal(selection('login-monitor').args, '--project monitoring --workers 1 --repeat-each 20');
  assert.equal(selection('login-monitor').expected, '40');
  assert.equal(selection('login-logout').args, '--project monitoring --workers 1 --repeat-each 20 --grep @login-logout');
  assert.equal(selection('login-logout').expected, '20');
  for (const suite of ['alarmnet-login-security', 'alarmnet-mobile-security', 'alarmnet-forgot-login-security']) {
    assert.equal(selection(suite).args, `--project ${suite} --workers 5`);
    assert.equal(selection(suite).prefix, `${suite}/`);
  }
});

test('CI scope rejects unknown suites and unsafe inputs without executing commands', () => {
  assert.throws(() => selection('smoke; echo unsafe'), /Unknown suite/);
  for (const repetitions of ['0', '101', '1.5', 'NaN']) {
    assert.throws(() => selection('login-monitor', { REPETITIONS: repetitions }), /Repetitions/);
  }
  assert.throws(() => selection('alarmnet-login-security', { ITERATIONS: 'nope' }), /ATTEMPTS/);
  assert.throws(() => selection('alarmnet-login-security', { INTERVAL_MS: '4999' }), /INTERVAL/);
  assert.doesNotThrow(() => selection('alarmnet-login-security', { ITERATIONS: '101' }));
  assert.throws(() => selection('alarmnet-login-security', { PLATFORM: 'lambda' }), /require local/);
});

test('all entrypoints delegate and preserve their trigger/load intent', () => {
  const expectedSchedules = {
    'playwright.yml': '0 2 * * *', 'smoke-daily.yml': '0 2 * * 1-5',
  };
  for (const [filename, cron] of Object.entries(expectedSchedules)) {
    assert.deepEqual(workflows[filename].on.schedule, [{ cron }]);
  }
  for (const filename of ['alarmnet-login-security.yml', 'alarmnet-mobile-security.yml', 'alarmnet-forgot-login-security.yml']) {
    assert.deepEqual(Object.keys(workflows[filename].on), ['workflow_dispatch']);
  }
  for (const filename of ['login-monitor.yml', 'login-logout.yml']) {
    assert.deepEqual(Object.keys(workflows[filename].on), ['workflow_dispatch']);
    assert.equal(workflows[filename].on.workflow_dispatch.inputs.repetitions.default, 20);
  }
  assert.deepEqual(workflows['playwright.yml'].on.push.branches, ['main', 'master']);
  assert.deepEqual(workflows['playwright.yml'].on.pull_request.branches, ['main', 'master']);
  for (const [filename, wrapper] of Object.entries(workflows)) {
    if (filename === 'test-execution.yml') continue;
    for (const job of Object.values(wrapper.jobs)) {
      assert.equal(job.uses, './.github/workflows/test-execution.yml');
      assert.equal(job.steps, undefined);
      assert.notEqual(job.secrets, 'inherit');
      if (filename.startsWith('alarmnet-')) assert.deepEqual(Object.keys(job.secrets), ['SLACK_WEBHOOK_URL']);
    }
  }
});

test('one execution, no retries or healing, isolated secrets and distinct non-cancelling locks', () => {
  assert.equal(workflow.env.AI_HEALING_ENABLED, 'false');
  assert.equal(workflow.env.HEAL_ENABLED, 'false');
  const commands = steps.filter(step => step.run?.includes('npx playwright test "'));
  assert.equal(commands.length, 2);
  for (const step of commands) {
    assert.match(step.run, /--retries 0/);
    assert.equal(step.env.RUN_LIVE_TESTS, 'true');
    assert.match(step.run, /timeout --signal=INT --kill-after=60s/);
    assert.equal(step['continue-on-error'], true);
  }
  const security = steps.find(step => step.id === 'security');
  assert.doesNotMatch(JSON.stringify(security), /secrets\.|ACCOUNT_|LOGIN_MONITOR_|OPENAI|AZURE_OPENAI|LT_ACCESS/);
  assert.doesNotMatch(JSON.stringify(workflow.env), /secrets\./);
  const business = steps.find(step => step.id === 'business');
  assert.match(business.env.ACCOUNT_APPROVED_MONITOR_USERNAME, /secrets.LOGIN_MONITOR_USERNAME/);
  assert.equal(workflow.jobs.execute.concurrency['cancel-in-progress'], false);
  assert.equal(workflow.jobs.publish.concurrency['cancel-in-progress'], false);
  assert.notEqual(workflow.jobs.execute.concurrency.group, workflow.jobs.publish.concurrency.group);
  for (const suite of ['smoke', 'login-monitor', 'alarmnet-login-security']) {
    const selected = selection(suite);
    assert.ok(Number(selected.global_timeout) / 1000 < Number(selected.wall_timeout));
  }
});

test('evidence precedes failure, and report/notify run regardless of upstream outcome', () => {
  const uploadIndex = steps.findIndex(step => step.uses === 'actions/upload-artifact@v4');
  const preserveIndex = steps.findIndex(step => step.name === 'Preserve execution failure');
  assert.ok(uploadIndex < preserveIndex);
  assert.match(steps[uploadIndex].if, /always\(\).*clean.outcome/);
  assert.ok(steps.findIndex(step => step.id === 'clean') < steps.findIndex(step => step.run === 'npm ci'));
  assert.equal(workflow.jobs.report.if, '${{ always() }}');
  assert.equal(workflow.jobs.notify.if, '${{ always() }}');
  const report = workflow.jobs.report.steps;
  assert.match(report.find(step => step.id === 'generate').if, /raw.outputs.valid == 'true'/);
  assert.match(report.find(step => step.id === 'generate').run, /find incoming\/allure-results -type f -name '\*-result.json'/);
  assert.match(report.find(step => step.id === 'generate').run, /"\$\{result_dirs\[@\]\}"/);
  assert.match(workflow.jobs.publish.if, /report.outputs.ready == 'true'/);
  assert.match(workflow.jobs.publish.if, /refs\/heads\/main/);
  assert.match(workflow.jobs.publish.outputs.published, /deploy.outcome == 'success'.*validated.outcome == 'success'/);
  const notify = workflow.jobs.notify.steps.find(step => step.env?.REPORT_URL);
  assert.match(notify.env.REPORT_URL, /published == 'true'/);
  assert.match(notify.env.JOB_OUTCOME, /execute.result/);
  assert.match(notify.env.RUN_INCOMPLETE, /execute.outputs.incomplete/);
  assert.doesNotMatch(JSON.stringify(workflow), /allure-history|healed-results|enable_healing/);
});