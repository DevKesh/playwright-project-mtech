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

    await test.step('Navigate to Cameras page', async () => {
      await page.getByText('ic_video_white Created with Sketch. Cameras').click();
      await page.waitForURL('**/cameras', { timeout: 15000 });
      await expect(page).toHaveURL(/.*cameras.*/);
    });

    const frame = page.locator('#fenixPagetarget').contentFrame();

    await test.step('Wait for cameras iframe to load', async () => {
      await page.locator('#fenixPagetarget').waitFor({ state: 'attached', timeout: 30000 });
      await frame.locator('video[id^="video-"]').first().waitFor({ state: 'visible', timeout: 60000 });
      await expect(frame.locator('video[id^="video-"]').first()).toBeVisible();
    });

    await test.step('Open LOBBY camera feed', async () => {
      const lobbyCamera = frame.locator('text=LOBBY').first();
      await lobbyCamera.waitFor({ state: 'visible', timeout: 30000 });
      await lobbyCamera.click();
      await frame.locator('#scrubber-canvas').waitFor({ state: 'visible', timeout: 60000 });
      await expect(frame.locator('#scrubber-canvas')).toBeVisible();
    });

    await test.step('Drag orange timeline marker to the left until blue lines are visible', async () => {
      const scrubber = frame.locator('#scrubber-canvas');
      await scrubber.waitFor({ state: 'visible', timeout: 30000 });
      const scrubberBox = await scrubber.boundingBox();
      const centerY = scrubberBox.y + scrubberBox.height * 0.5;

      // Orange line is on the right — drag it left towards the blue event markers
      const orangeLineX = scrubberBox.x + scrubberBox.width * 0.85;
      const targetX = scrubberBox.x + scrubberBox.width * 0.2;

      await page.mouse.move(orangeLineX, centerY);
      await page.mouse.down();
      await page.mouse.move(targetX, centerY, { steps: 30 });
      await page.mouse.up();

      await page.waitForTimeout(2000);
      await expect(scrubber).toBeVisible();
    });

    await test.step('Click Trim button', async () => {
      const trimBtn = frame.getByRole('button', { name: /trim/i })
        .or(frame.locator('button[title*="rim"]'))
        .or(frame.locator('[data-action="trim"]'));
      await expect(trimBtn.first()).toBeVisible({ timeout: 15000 });
      await trimBtn.first().click();
      await page.waitForTimeout(1000);
    });

    await test.step('Expand orange selection to reveal Save clip button', async () => {
      const scrubber = frame.locator('#scrubber-canvas');
      const scrubberBox = await scrubber.boundingBox();
      const centerY = scrubberBox.y + scrubberBox.height * 0.5;

      // Drag from current position to the right to expand the clip selection
      const startX = scrubberBox.x + scrubberBox.width * 0.2;
      const endX = scrubberBox.x + scrubberBox.width * 0.5;

      await page.mouse.move(startX, centerY);
      await page.mouse.down();
      await page.mouse.move(endX, centerY, { steps: 20 });
      await page.mouse.up();

      await page.waitForTimeout(1000);
    });

    await test.step('Click Save clip to export', async () => {
      const saveClipBtn = frame.getByRole('button', { name: /save clip/i })
        .or(frame.locator('button:has-text("Save Clip")'))
        .or(frame.locator('button:has-text("Save clip")'));
      await expect(saveClipBtn.first()).toBeVisible({ timeout: 15000 });
      await saveClipBtn.first().click();
      await page.waitForTimeout(2000);
    });
  });
});
