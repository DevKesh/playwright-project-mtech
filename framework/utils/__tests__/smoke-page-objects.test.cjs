const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { TotalConnectHomePage } = require('../../pages/generated/smoke/TotalConnectHomePage');
const { CamerasPage } = require('../../pages/generated/smoke/CamerasPage');
const { DevicesPage } = require('../../pages/generated/smoke/DevicesPage');
const { ActivityPage } = require('../../pages/generated/smoke/ActivityPage');

// Only synthetic DOM: no login, app server, credentials, or physical commands.
// Retain production assertion timeouts; run independent negative cases concurrently.
describe('smoke page objects against isolated synthetic pages', { concurrency: true }, () => {
  let browser;
  before(async () => {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  });
  after(async () => { await browser?.close(); });

  async function withPage(path, html, run) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const blocked = [];
    try {
      await context.route('**/*', async route => {
        if (route.request().url() === `http://smoke.test${path}`) {
          await route.fulfill({ contentType: 'text/html', body: html });
        } else {
          blocked.push(route.request().url());
          await route.abort();
        }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      await page.goto(`http://smoke.test${path}`);
      await run(page);
      assert.deepEqual(blocked, [], 'Fixtures must not attempt external requests');
    } finally {
      await context.close();
    }
  }

  const homeHTML = `
    <button id="select">SELECT ALL</button>
    <button data-command="armHome">ARM HOME</button>
    <button data-command="armAway">ARM AWAY</button>
    <button data-command="disarm">DISARM</button>
    <p id="p1">Disarmed</p><p id="p2">Disarmed</p>`;

  async function prepareHome(page) {
    await page.evaluate(() => {
      window.clicks = { select: 0, armHome: 0, armAway: 0, disarm: 0 };
      document.querySelector('#select').onclick = event => {
        window.clicks.select++;
        event.target.textContent = event.target.textContent === 'SELECT ALL' ? 'DESELECT ALL' : 'SELECT ALL';
      };
      for (const button of document.querySelectorAll('[data-command]')) {
        button.onclick = () => {
          const command = button.dataset.command;
          window.clicks[command]++;
          const target = { armHome: 'Armed Home', armAway: 'Armed Away', disarm: 'Disarmed' }[command];
          document.querySelector('#p1').textContent = target;
          document.querySelector('#p2').textContent = command === 'disarm' ? 'Disarming' : 'Arming';
          document.querySelector('#select').textContent = 'SELECT ALL';
          setTimeout(() => { document.querySelector('#p2').textContent = target; }, 700);
        };
      }
    });
    return new TotalConnectHomePage(page);
  }

  async function statuses(page) {
    return page.locator('#p1, #p2').allTextContents();
  }

  // Standalone Playwright expect omits custom messages outside its own runner.
  function visibilityFailure(locatorPattern, timeout) {
    return error => {
      assert.equal(error.matcherResult?.name, 'toBeVisible');
      assert.match(error.message, locatorPattern);
      assert.match(error.message, new RegExp(`Timeout: ${timeout}ms`));
      return true;
    };
  }

  test('selectAllPartitions twice toggles selection only once', () => withPage('/home', homeHTML, async page => {
    const home = await prepareHome(page);
    await home.selectAllPartitions();
    await home.selectAllPartitions();
    assert.equal(await page.locator('#select').innerText(), 'DESELECT ALL');
    assert.equal(await page.evaluate(() => window.clicks.select), 1);
  }));

  test('ensureDisarmed does not click when both actual partitions are Disarmed', () => withPage('/home', homeHTML, async page => {
    const home = await prepareHome(page);
    await home.ensureDisarmed();
    assert.deepEqual(await page.evaluate(() => window.clicks), { select: 0, armHome: 0, armAway: 0, disarm: 0 });
  }));

  test('status text with application trailing whitespace is recognized', () => withPage('/home', homeHTML, async page => {
    const home = await prepareHome(page);
    await page.locator('#p1, #p2').evaluateAll(elements => elements.forEach(e => { e.textContent = 'Disarmed   '; }));
    await home.ensureDisarmed();
    await home.verifyPartitionStatus('Disarmed');
    assert.equal(await page.evaluate(() => window.clicks.disarm), 0);
  }));

  test('mixed-state precondition selects armed partitions only and uses span action', () => withPage('/home', `
    <ul><li><p id="p1">Armed Home   </p><div role="checkbox" tabindex="0" aria-label="Toggle P1 - First" aria-checked="false"></div></li>
    <li><p id="p2">Disarmed   </p><div role="checkbox" tabindex="0" aria-label="Toggle P2 - Second" aria-checked="false"></div></li></ul>
    <span class="panelActionText">Disarm</span>
    <style>[role=checkbox]{width:30px;height:30px;background:#ddd}</style>`, async page => {
    await page.evaluate(() => {
      window.commands = 0;
      const boxes = document.querySelectorAll('[role=checkbox]');
      boxes[0].onclick = () => {
        boxes[0].setAttribute('aria-checked', 'true');
        boxes[1].setAttribute('aria-disabled', 'true');
      };
      boxes[1].onclick = () => { throw new Error('Already-disarmed partition must not be selected'); };
      document.querySelector('.panelActionText').onclick = () => {
        window.commands++;
        document.querySelector('#p1').textContent = 'Disarmed   ';
      };
    });
    await new TotalConnectHomePage(page).ensureDisarmed();
    assert.equal(await page.evaluate(() => window.commands), 1);
    assert.equal(await page.getByRole('checkbox').nth(1).getAttribute('aria-checked'), 'false');
  }));

  test('individual partition selection is idempotent', () => withPage('/home', `
    <label><input type="checkbox" aria-label="Toggle P1 - First">First</label>
    <label><input type="checkbox" aria-label="Toggle P2 - Second">Second</label>`, async page => {
    const home = new TotalConnectHomePage(page);
    await home.selectAllPartitions();
    await home.selectAllPartitions();
    assert.equal(await page.getByRole('checkbox', { checked: true }).count(), 2);
  }));

  test('verifyPartitionStatus waits for the second partition', () => withPage('/home', homeHTML, async page => {
    await page.evaluate(() => {
      document.querySelector('#p1').textContent = 'Armed Home';
      document.querySelector('#p2').textContent = 'Arming';
      setTimeout(() => { document.querySelector('#p2').textContent = 'Armed Home'; }, 700);
    });
    await new TotalConnectHomePage(page).verifyPartitionStatus('Armed Home');
    assert.deepEqual(await statuses(page), ['Armed Home', 'Armed Home']);
  }));

  test('verifyPartitionStatus fails on delayed command rejection', () => withPage('/home', homeHTML, async page => {
    await page.evaluate(() => {
      document.querySelector('#p1').textContent = 'Armed Home';
      document.querySelector('#p2').textContent = 'Arming';
      setTimeout(() => {
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.textContent = 'Unable to perform the action in your security system. Please try again.';
        document.body.append(dialog);
      }, 700);
    });
    await assert.rejects(new TotalConnectHomePage(page).verifyPartitionStatus('Armed Home'), /Security system rejected the command/);
    assert.deepEqual(await statuses(page), ['Armed Home', 'Arming']);
    assert.equal(await page.getByRole('dialog').isVisible(), true);
  }));

  for (const [command, target] of [['armHome', 'Armed Home'], ['armAway', 'Armed Away']]) {
    test(`${command} and disarm click once each and wait for every partition`, () => withPage('/home', homeHTML, async page => {
      const home = await prepareHome(page);
      await home.ensureDisarmed();
      await home.selectAllPartitions();
      await home[command]();
      assert.deepEqual(await statuses(page), [target, target]);
      await home.verifyPartitionStatus(target);
      await home.selectAllPartitions();
      await home.disarm();
      assert.deepEqual(await statuses(page), ['Disarmed', 'Disarmed']);
      await home.verifyPartitionStatus('Disarmed');
      assert.deepEqual(await page.evaluate(() => window.clicks), {
        select: 2, armHome: command === 'armHome' ? 1 : 0, armAway: command === 'armAway' ? 1 : 0, disarm: 1,
      });
    }));
  }

  const names = ['KITCHEN', 'LOBBY', 'DOMECB5'];

  function modernCameraHTML({ cards = true, feeds = true } = {}) {
    const content = `<h2>Camera Activities</h2><a>Long Camera Name</a><video style="width:100px;height:100px"></video>
      <app-live-camera><h2>Cameras</h2><div class="card-container">${cards ? `
      <app-device-card style="display:block;width:250px;height:200px">
        ${feeds ? '<div class="video-player" style="width:200px;height:100px">No live video</div>' : ''}
        <a class="cameraname-link">Long Cam...<span hidden>Long Camera Name</span></a>
      </app-device-card>` : ''}</div></app-live-camera>`;
    return `<iframe id="fenixPagetarget" style="width:800px;height:600px" srcdoc="${content.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"></iframe>`;
  }

  test('modern inventory uses full tooltip name and rendered offline section, not playback', () =>
    withPage('/cameras', modernCameraHTML(), async page => {
      const cameras = new CamerasPage(page, ['Long Camera Name']);
      assert.equal(await cameras.verifyAllCamerasVisible(), 1);
      assert.equal(await cameras.verifyCameraNames(), 1);
      assert.equal(await cameras.verifyCameraFeedsLoaded(), 1);
    }));

  test('activity name and clip cannot replace a missing live camera tile', () =>
    withPage('/cameras', modernCameraHTML({ cards: false }), async page => {
      await assert.rejects(new CamerasPage(page, ['Long Camera Name']).verifyAllCamerasVisible(),
        visibilityFailure(/app-device-card/, 30000));
    }));

  test('activity video cannot replace a missing feed section inside a live tile', () =>
    withPage('/cameras', modernCameraHTML({ feeds: false }), async page => {
      await assert.rejects(new CamerasPage(page, ['Long Camera Name']).verifyCameraFeedsLoaded(),
        visibilityFailure(/video-player/, 15000));
    }));

  function cameraHTML({ missing = '', hidden = '', feeds = false } = {}) {
    const content = '<h1>Cameras</h1>' + names.filter(name => name !== missing).map((name, index) =>
      `<a href="#camera-${index}" ${name === hidden ? 'hidden' : ''}>${name}</a>` +
      (feeds ? `<section id="video-${index}" style="width:160px;height:90px">Rendered feed ${index}</section>` : '')
    ).join('');
    return `<iframe id="fenixPagetarget" style="width:800px;height:600px" srcdoc="${content.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"></iframe>`;
  }

  test('camera visibility and names return three from srcdoc at /cameras', () => withPage('/cameras', cameraHTML(), async page => {
    const cameras = new CamerasPage(page);
    assert.equal(page.url(), 'http://smoke.test/cameras');
    assert.equal(await cameras.verifyAllCamerasVisible(), 3);
    assert.equal(await cameras.verifyCameraNames(), 3);
  }));

  for (const condition of ['missing', 'hidden']) {
    test(`${condition} expected camera rejects visibility verification (15s timeout)`, () =>
      withPage('/cameras', cameraHTML({ [condition]: 'DOMECB5' }), async page => {
        await assert.rejects(new CamerasPage(page).verifyAllCamerasVisible(), visibilityFailure(/DOMECB5/, 15000));
      }));
  }

  test('camera names alone reject feed verification (30s timeout)', () => withPage('/cameras', cameraHTML(), async page => {
    await assert.rejects(new CamerasPage(page).verifyCameraFeedsLoaded(), error => {
      assert.match(error.message, /toBeGreaterThanOrEqual/);
      assert.match(error.message, /Timeout 30000ms exceeded while waiting on the predicate/);
      return true;
    });
  }));

  test('three rendered #video-* sections return three feeds', () => withPage('/cameras', cameraHTML({ feeds: true }), async page => {
    assert.equal(await new CamerasPage(page).verifyCameraFeedsLoaded(), 3);
  }));

  test('generic Devices sidebar and heading reject category verification (30s timeout)', () =>
    withPage('/automation', '<nav><button>Devices</button></nav><h1>Automation</h1>', async page => {
      await assert.rejects(new DevicesPage(page).verifyDeviceCategoriesVisible(), visibilityFailure(/Lights/, 30000));
    }));

  test('delayed actual Lights category passes', () => withPage('/automation', '<h1>Automation</h1>', async page => {
    await page.evaluate(() => {
      setTimeout(() => {
        const category = document.createElement('h2');
        category.textContent = 'Lights';
        document.body.append(category);
      }, 1000);
    });
    await new DevicesPage(page).verifyDeviceCategoriesVisible();
    assert.equal(await page.getByRole('heading', { name: 'Lights', exact: true }).isVisible(), true);
  }));

  test('empty event wrapper rejects activity verification (30s timeout)', () =>
    withPage('/events', '<h1>Activity</h1><div class="event-list"></div>', async page => {
      await assert.rejects(new ActivityPage(page).verifyActivityLogEntries(), visibilityFailure(/event/, 30000));
    }));

  test('timestamped activity row passes', () =>
    withPage('/events', '<h1>Activity</h1><div class="event-row"><span>09:42 AM</span> <span>Simulated event</span></div>', async page => {
      await new ActivityPage(page).verifyActivityLogEntries();
      assert.equal(await page.locator('.event-row').isVisible(), true);
    }));
});