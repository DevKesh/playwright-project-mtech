const { test: smokeTest, expect } = require('../../../fixtures/smoke.fixture');

const sessions = [];
let cameraTestInfo;
const test = smokeTest.extend({
  sessionFactory: async ({ browser }, use) => {
    await use(async options => {
      expect(options.username).toBe('offline-fixture-user');
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await context.route('**/*', route => route.request().url().startsWith('http://fixture.test/')
        ? route.fulfill({ contentType: 'text/html', body: '<button>Devices</button><button>Cameras</button><button>Security</button>' })
        : route.abort());
      const page = await context.newPage();
      await page.goto('http://fixture.test/home');
      const session = {
        page, context, closed: 0,
        async close() {
          this.closed++;
          await context.close();
        },
      };
      sessions.push(session);
      return session;
    });
  },
});

test.afterAll(() => {
  expect(sessions).toHaveLength(3);
  for (const session of sessions) {
    expect(session.closed).toBe(1);
    expect(session.page.isClosed()).toBe(true);
  }
  expect(cameraTestInfo.attachments.map(attachment => attachment.name)).toEqual(
    expect.arrayContaining(['camera-live-state'])
  );
  expect(cameraTestInfo.attachments.some(attachment => attachment.contentType === 'image/png')).toBe(false);
  expect(cameraTestInfo.annotations.some(annotation => annotation.type === 'camera-capture')).toBe(false);
});

test('all smoke page objects use the same test-owned page', async ({ authenticatedPage, loginPage, homePage, devicesPage, camerasPage, activityPage }, testInfo) => {
  cameraTestInfo = testInfo;
  for (const pageObject of [loginPage, homePage, devicesPage, camerasPage, activityPage]) {
    expect(pageObject.page).toBe(authenticatedPage);
  }
  expect(camerasPage.expectedCount).toBeNull();
  expect(camerasPage.knownCameras).toBeNull();
  await authenticatedPage.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'fenixPagetarget';
    frame.style.cssText = 'width:800px;height:600px';
    frame.srcdoc = '<app-live-camera style="display:block">' + Array.from({ length: 11 }, (_, index) =>
      `<app-device-card style="display:block"><a class="cameraname-link">Renamed ${index}</a><div class="video-player">No live video</div></app-device-card>`
    ).join('') + '</app-live-camera>';
    document.body.append(frame);
  });
  await expect(camerasPage.cameraCards).toHaveCount(11);
  await authenticatedPage.evaluate(() => localStorage.setItem('prior-test', 'must-not-leak'));
  await authenticatedPage.context().addCookies([{ name: 'prior-test', value: 'must-not-leak', url: 'http://fixture.test' }]);
});

test('next smoke test gets a fresh context and no prior browser state', async ({ authenticatedPage }) => {
  expect(sessions[0].closed).toBe(1);
  expect(authenticatedPage.context()).not.toBe(sessions[0].context);
  expect(await authenticatedPage.evaluate(() => localStorage.getItem('prior-test'))).toBeNull();
  expect(await authenticatedPage.context().cookies()).toEqual([]);
});

test('an assertion failure still tears down its session', async ({ authenticatedPage }) => {
  test.fail();
  expect(authenticatedPage.url()).toContain('/deliberate-failure');
});

test('public page fixture never starts an authenticated session', async ({ page }) => {
  expect(sessions).toHaveLength(3);
  expect(sessions[2].closed).toBe(1);
  expect(page.url()).toBe('about:blank');
  expect(await page.context().cookies()).toEqual([]);
});