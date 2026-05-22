const { test, expect } = require('@playwright/test');
const { launchBrowser } = require('../framework/utils/browser-launcher');
const { testDataConfig } = require('../framework/config/test-data.config');
const { LoginPage } = require('../framework/pages/generated/smoke/LoginPage');
const { TotalConnectHomePage } = require('../framework/pages/generated/smoke/TotalConnectHomePage');

test.describe('@tc Camera Clip Export', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Browser} */
  let browser;

  test.beforeAll(async () => {
    const session = await launchBrowser();
    browser = session.browser;
    context = session.context;
    page = session.page;

    // Login
    await page.goto(testDataConfig.targetApp.loginUrl, { timeout: 60000, waitUntil: 'domcontentloaded' });
    // Wait for SPA to render the login form
    await page.getByLabel('Username').waitFor({ state: 'visible', timeout: 60000 });
    const loginPage = new LoginPage(page);
    await loginPage.dismissCookieConsent();
    await loginPage.login(
      testDataConfig.targetApp.credentials.email,
      testDataConfig.targetApp.credentials.password
    );
    await page.waitForURL('**/home', { timeout: 60000, waitUntil: 'domcontentloaded' });

    const homePage = new TotalConnectHomePage(page);
    await homePage.dismissCookiePopup();
    await homePage.closeDonePopup();
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test('Export camera clip from timeline', async () => {
    test.setTimeout(180000);

    await test.step('Navigate to Cameras page', async () => {
      await page.getByText('ic_video_white Created with Sketch. Cameras').click();
      await page.waitForURL('**/cameras', { timeout: 15000 });
    });

    const frame = page.locator('#fenixPagetarget').contentFrame();

    await test.step('Wait for cameras iframe to load', async () => {
      await page.locator('#fenixPagetarget').waitFor({ state: 'attached', timeout: 30000 });
      await frame.locator('video[id^="video-"]').first().waitFor({ state: 'visible', timeout: 60000 });
    });

    await test.step('Open camera feed (DOMECB5)', async () => {
      // Click the DOMECB5 camera by data attribute or ID
      const camera = frame.locator('video[data-camera-name="DOMECB5"]').or(frame.locator('#video-1621401'));
      await camera.first().click({ timeout: 30000, force: true });
      // Wait for the single-camera detail view to load (scrubber appears)
      await frame.locator('#scrubber-canvas').waitFor({ state: 'visible', timeout: 60000 });
    });

    await test.step('Drag timeline slider to the right to highlight clip export region', async () => {
      const scrubber = frame.locator('#scrubber-canvas');
      await scrubber.waitFor({ state: 'visible', timeout: 30000 });
      const scrubberBox = await scrubber.boundingBox();

      // Drag from left area of scrubber towards the right to select a clip region
      const startX = scrubberBox.x + scrubberBox.width * 0.3;
      const startY = scrubberBox.y + scrubberBox.height * 0.5;
      const endX = scrubberBox.x + scrubberBox.width * 0.7;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Move in steps to simulate a real drag and trigger the UI update
      for (let x = startX; x <= endX; x += 20) {
        await page.mouse.move(x, startY);
      }
      await page.mouse.move(endX, startY);
      await page.mouse.up();

      // Wait for clip selection to render on the timeline
      await page.waitForTimeout(2000);
    });

    await test.step('Click Trim/Clip button to enter clip selection mode', async () => {
      // Try multiple selectors for the trim/scissors/clip button
      const trimBtn = frame.getByRole('button', { name: /trim|clip|scissors/i })
        .or(frame.locator('button[title*="rim"], button[title*="lip"], button[title*="cissors"]'))
        .or(frame.locator('button[aria-label*="rim"], button[aria-label*="lip"], button[aria-label*="cissors"]'))
        .or(frame.locator('.trim-button, .clip-button, [data-action="trim"], [data-action="clip"]'))
        .or(frame.locator('button.scissors, button.trim, button.clip'));
      await trimBtn.first().click({ timeout: 15000 });
      // Wait for trim handles to appear on the scrubber
      await page.waitForTimeout(1000);
    });

    await test.step('Drag scrubber handles to set clip start and end points', async () => {
      const scrubber = frame.locator('#scrubber-canvas');
      const scrubberBox = await scrubber.boundingBox();
      const centerY = scrubberBox.y + scrubberBox.height * 0.5;

      // Drag left trim handle to set clip start
      const leftHandleX = scrubberBox.x + scrubberBox.width * 0.3;
      const clipStartX = scrubberBox.x + scrubberBox.width * 0.4;
      await page.mouse.move(leftHandleX, centerY);
      await page.mouse.down();
      await page.mouse.move(clipStartX, centerY, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(300);

      // Drag right trim handle to set clip end
      const rightHandleX = scrubberBox.x + scrubberBox.width * 0.7;
      const clipEndX = scrubberBox.x + scrubberBox.width * 0.6;
      await page.mouse.move(rightHandleX, centerY);
      await page.mouse.down();
      await page.mouse.move(clipEndX, centerY, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(500);
    });

    await test.step('Save and confirm clip export', async () => {
      await frame.getByRole('button', { name: /save/i }).click({ timeout: 15000 });
      await frame.getByRole('button', { name: /done|ok|close/i }).click({ timeout: 15000 });
    });
  });
});
