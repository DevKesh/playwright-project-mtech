const { test, expect } = require('@playwright/test');
const { createLoginSession } = require('../framework/utils/login-session');

test.describe('@tc Camera Clip Export', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  /** @type {import('@playwright/test').Browser} */
  let browser;

  test.beforeAll(async () => {
    test.setTimeout(180000);
    const session = await createLoginSession();
    browser = session.browser;
    context = session.context;
    page = session.page;
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test('Export camera clip from timeline', async () => {
    test.setTimeout(180000);

    const frame = page.locator('#fenixPagetarget').contentFrame();

    await test.step('Navigate to Cameras page', async () => {
      await page.getByText('ic_video_white Created with Sketch. Cameras').click();
      await page.waitForURL('**/cameras', { timeout: 15000 });
      await expect(page).toHaveURL(/.*cameras.*/);
    });

    await test.step('Open DOMECB5 camera feed', async () => {
      await frame.locator('#video-1621401').click();
      await expect(frame.locator('#video-popup-1621401')).toBeVisible({ timeout: 60000 });
      await page.waitForTimeout(5000);
    });

    await test.step('Select clip region and export', async () => {
      const scrubber = frame.locator('#scrubber-canvas');
      await scrubber.waitFor({ state: 'visible', timeout: 30000 });

      // Click on timeline to position the trim selection
      await scrubber.click({ position: { x: 130, y: 47 } });
      await scrubber.click({ position: { x: 226, y: 43 } });

      // Trim and save
      await frame.getByRole('button', { name: 'trim' }).click();
      await frame.getByRole('button', { name: 'Save Clip' }).click();
      await frame.getByRole('button', { name: 'Done' }).click();
    });

    await test.step('Second clip export', async () => {
      const scrubber = frame.locator('#scrubber-canvas');

      await scrubber.click({ position: { x: 441, y: 49 } });
      await scrubber.click({ position: { x: 457, y: 46 } });
      await scrubber.click({ position: { x: 88, y: 52 } });
      await scrubber.click({ position: { x: 27, y: 50 } });
      await scrubber.click({ position: { x: 647, y: 59 } });
      await scrubber.click({ position: { x: 554, y: 53 } });

      await frame.getByRole('button', { name: 'trim' }).dblclick();
      await frame.getByRole('button', { name: 'Wait for current export' }).click();
    });
  });
});
