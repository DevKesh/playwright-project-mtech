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
    await page.goto(testDataConfig.targetApp.loginUrl);
    const loginPage = new LoginPage(page);
    await loginPage.dismissCookieConsent();
    await loginPage.login(
      testDataConfig.targetApp.credentials.email,
      testDataConfig.targetApp.credentials.password
    );
    await page.waitForURL('**/home', { timeout: 30000 });

    const homePage = new TotalConnectHomePage(page);
    await homePage.dismissCookiePopup();
    await homePage.closeDonePopup();
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test('Export camera clip from timeline', async () => {
    test.setTimeout(120000);

    await test.step('Navigate to Cameras page', async () => {
      await page.getByText('ic_video_white Created with Sketch. Cameras').click();
      await page.waitForURL('**/cameras', { timeout: 15000 });
    });

    const frame = page.locator('#fenixPagetarget').contentFrame();

    await test.step('Open camera feed (video-1621401)', async () => {
      await frame.locator('#video-1621401').click();
    });

    await test.step('Drag timeline slider to the left until blue lines appear', async () => {
      const scrubber = frame.locator('#scrubber-canvas');
      const scrubberBox = await scrubber.boundingBox();

      // Drag from center of scrubber towards the left to reveal blue recording lines
      const startX = scrubberBox.x + scrubberBox.width * 0.5;
      const startY = scrubberBox.y + scrubberBox.height * 0.5;
      const endX = scrubberBox.x + scrubberBox.width * 0.15;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      // Move in steps to simulate a real drag and trigger the UI update
      for (let x = startX; x >= endX; x -= 20) {
        await page.mouse.move(x, startY);
      }
      await page.mouse.move(endX, startY);
      await page.mouse.up();

      // Wait for blue lines to render on the timeline
      await page.waitForTimeout(1000);
    });

    await test.step('Click Trim button to enter clip selection mode', async () => {
      await frame.getByRole('button', { name: 'trim' }).click();
      // Wait for trim handles to appear on the scrubber
      await page.waitForTimeout(500);
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
      await frame.getByRole('button', { name: 'Save Clip' }).click();
      await frame.getByRole('button', { name: 'Done' }).click();
    });
  });
});
