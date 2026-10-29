const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function loadWithDependencies(relativePath, dependencies, env = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const module = { exports: {} };
  const realRequire = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module,
    exports: module.exports,
    require: name => Object.hasOwn(dependencies, name) ? dependencies[name] : realRequire(name),
    process: { env },
    console: { log() {} },
  }, { filename });
  return module.exports;
}

test('login failure closes the acquired browser and preserves the login error', async () => {
  const failure = new Error('login navigation failed');
  let closed = 0;
  const { createLoginSession } = loadWithDependencies('../login-session.js', {
    './browser-launcher': {
      launchBrowser: async () => ({
        browser: { close: async () => { closed++; throw new Error('close failed'); } },
        context: {},
        page: { goto: async () => { throw failure; } },
      }),
    },
    '../config/test-data.config': {
      testDataConfig: { targetApp: { loginUrl: 'https://fixture.test/login', credentials: {} } },
    },
  });
  await assert.rejects(createLoginSession({ username: 'synthetic', password: 'synthetic' }), error => error === failure);
  assert.equal(closed, 1);
});

test('login setup captures evidence before close and preserves errors when capture fails', async () => {
  for (const captureFails of [false, true]) {
    const failure = new Error('login failed before test body');
    const events = [];
    const page = { goto: async () => { throw failure; } };
    const { createLoginSession } = loadWithDependencies('../login-session.js', {
      './browser-launcher': {
        launchBrowser: async () => ({
          browser: { close: async () => { events.push('close'); } }, context: {}, page,
        }),
      },
      '../config/test-data.config': {
        testDataConfig: { targetApp: { loginUrl: 'https://fixture.test/login', credentials: {} } },
      },
    });
    await assert.rejects(createLoginSession({
      onFailure: async failedPage => {
        assert.equal(failedPage, page);
        events.push('capture');
        if (captureFails) throw new Error('screenshot failed');
      },
    }), error => error === failure);
    assert.deepEqual(events, ['capture', 'close']);
  }
});

function sessionFixtures(env = {}) {
  return loadWithDependencies('../../fixtures/tc.fixture.js', {
    '@playwright/test': { test: { extend: fixtures => fixtures }, expect: {} },
    '../utils/login-session': { createLoginSession: async () => { throw new Error('Unexpected real login'); } },
    '../flows/totalconnect/TotalConnectFlow': {},
    '../utils/pageLoadMetrics': {},
  }, env).test;
}

test('session fixture attaches masked setup failure evidence even while status is passed', async () => {
  const fixtures = sessionFixtures();
  const attachments = [];
  const failure = new Error('login setup failed');
  const info = {
    status: 'passed', expectedStatus: 'passed',
    attach: async (name, data) => attachments.push({ name, ...data }),
  };
  await assert.rejects(fixtures.authenticatedSession[0]({
    credentialProfile: 'configured', sessionArtifacts: true,
    sessionFactory: async options => {
      await options.onFailure({
        screenshot: async settings => {
          assert.match(settings.style, /input, textarea, \[contenteditable\]/);
          return Buffer.from('masked screenshot');
        },
      });
      throw failure;
    },
  }, async () => assert.fail('Failed setup must not run the test body'), info), error => error === failure);
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].name, 'login-setup-failure');
  assert.equal(attachments[0].contentType, 'image/png');
});

test('approved credentials are validated before invoking the session factory', async () => {
  const fixtures = sessionFixtures();
  let launched = false;
  await assert.rejects(fixtures.authenticatedSession[0]({
    credentialProfile: 'approved-monitor',
    sessionFactory: async () => { launched = true; },
  }, async () => {}, {}), /LOGIN_MONITOR_USERNAME/);
  assert.equal(launched, false);
  assert.equal(fixtures.authenticatedSession[1].timeout, 180000);
});

test('authenticated sessions are independent and close exactly once after use', async () => {
  const fixtures = sessionFixtures({ LOGIN_MONITOR_USERNAME: 'synthetic', LOGIN_MONITOR_PASSWORD: 'synthetic' });
  const sessions = [];
  const sessionFactory = async options => {
    assert.equal(options.username, 'synthetic');
    const session = { page: {}, closed: 0, async close() { this.closed++; } };
    sessions.push(session);
    return session;
  };
  for (const iteration of [1, 2]) {
    await fixtures.authenticatedSession[0]({ credentialProfile: 'approved-monitor', sessionFactory, sessionArtifacts: false }, async session => {
      assert.equal(session.closed, 0);
      session.page.iteration = iteration;
    }, { status: 'passed', expectedStatus: 'passed' });
  }
  assert.notEqual(sessions[0].page, sessions[1].page);
  assert.equal(sessions[0].page.iteration, 1);
  assert.ok(sessions.every(session => session.closed === 1));
});

test('fixture teardown does not replace a failed test with a cleanup error', async () => {
  const fixtures = sessionFixtures();
  const failure = new Error('original assertion');
  const info = { status: 'failed', expectedStatus: 'passed', annotations: [] };
  let closed = 0;
  await assert.rejects(fixtures.authenticatedSession[0]({
    credentialProfile: 'configured', sessionArtifacts: false,
    sessionFactory: async () => ({ close: async () => { closed++; throw new Error('cleanup'); } }),
  }, async () => { throw failure; }, info), error => error === failure);
  assert.equal(closed, 1);
  assert.equal(info.annotations.length, 1);
});

test('security pacing runs once after success or failure without authenticating', async () => {
  const events = [];
  const fixtures = loadWithDependencies('../../fixtures/login-security.fixture.js', {
    '@playwright/test': { test: { extend: definitions => definitions }, expect: {} },
    'node:timers/promises': { setTimeout: async interval => events.push(interval) },
    '../pages/generated/smoke/LoginPage': { LoginPage: class {} },
    '../utils/login-security': { securitySettings: () => ({ intervalMs: 5000 }) },
  }).test;
  const pacing = fixtures._securityPacing[0];
  await pacing({}, async () => events.push('success'));
  await assert.rejects(pacing({}, async () => { events.push('failure'); throw new Error('original'); }), /original/);
  assert.deepEqual(events, ['success', 5000, 'failure', 5000]);
  assert.equal(fixtures._securityPacing[1].auto, true);
  assert.equal(fixtures.authenticatedSession, undefined);
});

test('configured profile preserves helper defaults and teardown failures still fail a passing test', async () => {
  const fixtures = sessionFixtures();
  const cleanupFailure = new Error('cleanup failed');
  await assert.rejects(fixtures.authenticatedSession[0]({
    credentialProfile: 'configured', sessionArtifacts: false,
    sessionFactory: async options => {
      assert.equal(Object.keys(options).length, 0);
      return { close: async () => { throw cleanupFailure; } };
    },
  }, async () => {}, { status: 'passed', expectedStatus: 'passed' }), error => error === cleanupFailure);
  await assert.rejects(fixtures.authenticatedSession[0]({ credentialProfile: 'typo' }, async () => {}, {}), /Unknown credential profile/);
});

test('smoke healing is conditional and precedes page object construction', async () => {
  for (const enabled of [false, true]) {
    const events = [];
    const page = {};
    class FakePageObject {
      constructor(owner) { this.page = owner; events.push('construct'); }
      async dismissTransientPopups() { events.push('popups'); }
    }
    const fixtures = loadWithDependencies('../../fixtures/smoke.fixture.js', {
      './tc.fixture': { test: { extend: definitions => definitions }, expect: {} },
      '../pages/generated/smoke/LoginPage': { LoginPage: FakePageObject },
      '../pages/generated/smoke/TotalConnectHomePage': { TotalConnectHomePage: FakePageObject },
      '../pages/generated/smoke/DevicesPage': { DevicesPage: FakePageObject },
      '../pages/generated/smoke/CamerasPage': { CamerasPage: FakePageObject },
      '../pages/generated/smoke/ActivityPage': { ActivityPage: FakePageObject },
      '../ai/config/ai.config': { loadAIConfig: () => ({ enabled }) },
      '../ai/fixtures/tc.ai.fixture': {
        healerAgent: enabled ? {} : null,
        patchPageWithHealing: owner => { assert.equal(owner, page); events.push('patch'); },
      },
    }).test;
    await fixtures.authenticatedPage({ authenticatedPage: page }, async owner => {
      await fixtures.homePage({ authenticatedPage: owner }, async home => assert.equal(home.page, page));
    });
    assert.deepEqual(events, enabled ? ['patch', 'construct', 'popups'] : ['construct', 'popups']);
  }
});

test('camera fixture uses dynamic inventory and attaches evidence after success or failure', async () => {
  for (const outcome of ['passed', 'failed', 'capture-error']) {
    const events = [];
    const attachments = [];
    const failure = new Error('original camera assertion');
    const page = {};
    class FakeCamera {
      constructor(owner, options) {
        assert.equal(owner, page);
        assert.equal(options.dynamicInventory, true);
        assert.equal(options.expectedCount, undefined);
        assert.equal(Array.isArray(options), false);
        this.liveCameras = { screenshot: async options => {
          events.push('screenshot');
          assert.match(options.style, /input, textarea/);
          return Buffer.from('synthetic screenshot');
        } };
      }
      async captureLiveState() {
        events.push('state');
        if (outcome === 'capture-error') throw new Error('capture failed');
        return { available: true, cameras: [{ displayedName: 'New name' }] };
      }
    }
    const fixtures = loadWithDependencies('../../fixtures/smoke.fixture.js', {
      './tc.fixture': { test: { extend: definitions => definitions }, expect: {} },
      '../pages/generated/smoke/LoginPage': {},
      '../pages/generated/smoke/TotalConnectHomePage': {},
      '../pages/generated/smoke/DevicesPage': {},
      '../pages/generated/smoke/CamerasPage': { CamerasPage: FakeCamera },
      '../pages/generated/smoke/ActivityPage': {},
      '../ai/config/ai.config': {},
      '../ai/fixtures/tc.ai.fixture': {},
    }).test;
    const testInfo = { annotations: [], attach: async (name, options) => attachments.push({ name, ...options }) };
    const execution = fixtures.camerasPage({ authenticatedPage: page }, async () => {
      events.push('use');
      if (outcome !== 'passed') throw failure;
    }, testInfo);
    if (outcome === 'passed') await execution;
    else await assert.rejects(execution, error => error === failure);
    if (outcome === 'capture-error') {
      assert.deepEqual(events, ['use', 'state']);
      assert.equal(testInfo.annotations.length, 1);
    } else {
      assert.deepEqual(events, ['use', 'state', 'screenshot']);
      assert.deepEqual(attachments.map(attachment => attachment.name), ['camera-live-state', 'camera-live-section']);
      assert.equal(JSON.parse(attachments[0].body).cameras[0].displayedName, 'New name');
    }
  }
});

test('context setup failure closes the acquired browser and preserves the setup error', async () => {
  const failure = new Error('context creation failed');
  let closed = 0;
  const { launchBrowser } = loadWithDependencies('../browser-launcher.js', {
    '@playwright/test': {
      chromium: {
        launch: async () => ({
          newContext: async () => { throw failure; },
          close: async () => { closed++; throw new Error('close failed'); },
        }),
      },
    },
  });
  await assert.rejects(launchBrowser(), error => error === failure);
  assert.equal(closed, 1);
});