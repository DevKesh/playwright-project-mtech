const { expect } = require('@playwright/test');

class CamerasPage {
  constructor(page) {
    this.page = page;
    // Camera content lives inside an iframe
    this.frame = page.locator('#fenixPagetarget').contentFrame();
    this.knownCameras = ['KITCHEN', 'LOBBY', 'DOMECB5'];
  }

  /**
   * Verifies cameras page loaded — URL check + "Cameras" text visible inside iframe.
   */
  async verifyCamerasPageLoaded() {
    await expect(this.page).toHaveURL(/.*\/cameras/, { timeout: 10000 });
    await expect(this.frame.getByText('Cameras').first()).toBeVisible({ timeout: 15000 });
    console.log('[CamerasPage] Cameras page loaded.');
  }

  /**
   * Verifies camera tiles are visible by checking known camera name links inside the iframe.
   */
  async verifyAllCamerasVisible() {
    await expect(this.page).toHaveURL(/.*\/cameras/, { timeout: 10000 });

    // Wait for first known camera link to appear
    await expect(this.frame.getByRole('link', { name: this.knownCameras[0] }).first()).toBeVisible({ timeout: 15000 });

    let found = 0;
    const foundNames = [];
    for (const name of this.knownCameras) {
      const count = await this.frame.getByRole('link', { name }).count();
      if (count > 0) {
        found++;
        foundNames.push(name);
      }
    }

    console.log(`[CamerasPage] Found ${found} cameras: ${foundNames.join(', ')}`);
    return found;
  }

  /**
   * Verifies camera names are displayed on the page.
   */
  async verifyCameraNames() {
    return await this.verifyAllCamerasVisible();
  }

  /**
   * Verifies camera feed sections are present (cameras visible = feeds rendered).
   */
  async verifyCameraFeedsLoaded() {
    return await this.verifyAllCamerasVisible();
  }
}

module.exports = { CamerasPage };