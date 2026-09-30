const { expect } = require('@playwright/test');

class CamerasPage {
  constructor(page, expectedCameraNames = ['KITCHEN', 'LOBBY', 'DOMECB5']) {
    this.page = page;
    // Camera content lives inside an iframe
    this.frame = page.locator('#fenixPagetarget').contentFrame();
    if (!Array.isArray(expectedCameraNames) || !expectedCameraNames.length ||
        expectedCameraNames.some(name => typeof name !== 'string' || !name.trim())) {
      throw new Error('Expected camera inventory must contain nonempty camera names.');
    }
    this.knownCameras = expectedCameraNames;
    this.liveCameras = this.frame.locator('app-live-camera');
  }

  /**
   * Verifies cameras page loaded — URL check + "Cameras" text visible inside iframe.
   */
  async verifyCamerasPageLoaded() {
    await expect(this.page).toHaveURL(/.*\/cameras/, { timeout: 10000 });
    await expect(this.page.locator('#fenixPagetarget')).toBeVisible({ timeout: 30000 });
    await expect(this.frame.getByText('Cameras', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 30000 });
    console.log('[CamerasPage] Cameras page loaded.');
  }

  /**
   * Verifies camera tiles are visible by checking known camera name links inside the iframe.
   */
  async verifyAllCamerasVisible() {
    await this.verifyCamerasPageLoaded();
    const modernUI = await this.liveCameras.count() > 0;
    for (const name of this.knownCameras) {
      if (modernUI) {
        // Full names live in tooltip text; the visible link may be truncated.
        // Scope to live inventory so an activity mentioning a camera cannot pass.
        const card = this._cameraCard(name);
        await expect(card, `Expected live camera tile ${name}`).toBeVisible({ timeout: 30000 });
        await expect(card.locator('.cameraname-link')).toBeVisible({ timeout: 15000 });
      } else {
        await expect(this.frame.getByRole('link', { name, exact: true }).first(),
          `Expected camera ${name} must be visible`).toBeVisible({ timeout: 15000 });
      }
    }
    return this.knownCameras.length;
  }

  /**
   * Verifies camera names are displayed on the page.
   */
  async verifyCameraNames() {
    return await this.verifyAllCamerasVisible();
  }

  _cameraCard(name) {
    return this.liveCameras.locator('app-device-card')
      .filter({ has: this.frame.getByText(name, { exact: true }) });
  }

  /**
    * Verifies rendered feed sections, not playback. Camera-name links alone are insufficient.
   */
  async verifyCameraFeedsLoaded() {
    const expectedCount = await this.verifyAllCamerasVisible();
    if (await this.liveCameras.count()) {
      for (const name of this.knownCameras) {
        await expect(this._cameraCard(name).locator('.video-player').filter({ visible: true }).first(),
          `Camera ${name} must render a feed section`).toBeVisible({ timeout: 15000 });
      }
      // Explicit offline/no-live-video panels are rendered sections, NOT proof
      // of playback. Never count the unrelated Camera Activities clip player.
      return expectedCount;
    }
    // Count player roots only: a wrapper and its nested video are ONE feed.
    // #video-<id> is observed in recorded camera DOM. Native videos without such
    // a wrapper are supported, but controls/nested wrappers cannot inflate counts.
    const feeds = this.frame.locator('[id^="video-"], video')
      .filter({ visible: true });
    const countFeedRoots = () => feeds.evaluateAll(elements => elements
      .filter(element => !elements.some(other => other !== element && other.contains(element))).length);
    await expect.poll(countFeedRoots, {
      message: 'Every expected camera must have a visible feed section (names are not feeds)',
      timeout: 30000,
    }).toBeGreaterThanOrEqual(expectedCount);
    return await countFeedRoots();
  }
}

module.exports = { CamerasPage };