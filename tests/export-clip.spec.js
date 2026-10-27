const { test, expect } = require('../framework/fixtures/tc.fixture');

test.use({ credentialProfile: 'configured' });

test.describe('@tc Camera Clip Export', () => {
  test('Export camera clip from timeline', async ({ authenticatedPage: page }) => {
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
      await frame.getByRole('button', { name: 'Close' }).click();
    });
  });
});
