const { expect } = require('@playwright/test');

class CamerasPage {
  constructor(page, expectedCameraNames = ['KITCHEN', 'LOBBY', 'DOMECB5']) {
    this.page = page;
    // Camera content lives inside an iframe
    this.frame = page.locator('#fenixPagetarget').contentFrame();
    if (Array.isArray(expectedCameraNames)) {
      if (!expectedCameraNames.length || expectedCameraNames.some(name => typeof name !== 'string' || !name.trim())) {
        throw new Error('Expected camera inventory must contain nonempty camera names.');
      }
      this.knownCameras = expectedCameraNames;
      this.expectedCount = expectedCameraNames.length;
    } else {
      const dynamicInventory = expectedCameraNames?.dynamicInventory === true && expectedCameraNames.expectedCount === undefined;
      if (!dynamicInventory && (!Number.isInteger(expectedCameraNames?.expectedCount) || expectedCameraNames.expectedCount < 1)) {
        throw new Error('Expected camera count must be a positive integer.');
      }
      this.knownCameras = null;
      this.expectedCount = dynamicInventory ? null : expectedCameraNames.expectedCount;
    }
    this.liveCameras = this.frame.locator('app-live-camera');
    this.cameraCards = this.liveCameras.locator('app-device-card');
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
  * Verifies live camera cards using dynamic inventory, a fixed count, or explicit names.
   */
  async verifyAllCamerasVisible() {
    await this.verifyCamerasPageLoaded();
    if (!this.knownCameras) {
      await expect(this.liveCameras).toBeVisible({ timeout: 30000 });
      if (this.expectedCount === null) {
        await expect(this.cameraCards.first(), 'At least one live camera must be present').toBeVisible({ timeout: 30000 });
      } else {
        await expect(this.cameraCards, 'Expected live camera inventory count').toHaveCount(this.expectedCount, { timeout: 30000 });
      }
      const cameraCount = this.expectedCount ?? await this.cameraCards.count();
      for (let index = 0; index < cameraCount; index++) {
        const card = this.cameraCards.nth(index);
        await expect(card, `Live camera tile ${index + 1}`).toBeVisible({ timeout: 15000 });
        const label = card.locator('.cameraname-link').filter({ visible: true }).first();
        await expect(label, `Camera ${index + 1} must display a name`).toBeVisible({ timeout: 15000 });
        await expect.poll(() => label.innerText(), {
          message: `Camera ${index + 1} must have a nonempty displayed name`,
          timeout: 15000,
        }).toMatch(/\S/);
      }
      return cameraCount;
    }
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

  async captureLiveState() {
    const metadata = {
      capturedAt: new Date().toISOString(),
      scope: '#fenixPagetarget >> app-live-camera',
      expectedCount: this.expectedCount,
      inventoryMode: this.expectedCount === null ? 'dynamic' : this.knownCameras ? 'names' : 'count',
    };
    if (!await this.page.locator('#fenixPagetarget').count() || !await this.liveCameras.count()) {
      return { ...metadata, available: false, cameras: [], dom: '' };
    }
    const state = await this.liveCameras.evaluate(root => {
      const cameras = Array.from(root.querySelectorAll('app-device-card')).map((card, index) => {
        const label = Array.from(card.querySelectorAll('.cameraname-link'))
          .find(element => element.checkVisibility()) || card.querySelector('.cameraname-link');
        return {
          index,
          visible: card.checkVisibility(),
          displayedName: label?.innerText || '',
          nameTextContent: label?.textContent || '',
          nameTitle: label?.getAttribute('title') || '',
          feedText: Array.from(card.querySelectorAll('.video-player')).map(feed => feed.innerText),
        };
      });
      const snapshot = root.cloneNode(true);
      snapshot.querySelectorAll('script, style, input, textarea, select, [contenteditable], iframe, video, audio, source, img, canvas')
        .forEach(element => element.remove());
      const keepAttributes = new Set(['id', 'class', 'role', 'aria-label', 'aria-hidden', 'title', 'data-testid']);
      for (const element of [snapshot, ...snapshot.querySelectorAll('*')]) {
        for (const attribute of Array.from(element.attributes)) {
          if (!keepAttributes.has(attribute.name)) element.removeAttribute(attribute.name);
        }
      }
      const dom = snapshot.outerHTML;
      return { available: true, cameras, actualCount: cameras.length, dom: dom.slice(0, 16000), truncated: dom.length > 16000 };
    }, undefined, { timeout: 3000 });
    return { ...metadata, ...state };
  }

  /**
    * Verifies rendered feed sections, not playback. Camera-name links alone are insufficient.
   */
  async verifyCameraFeedsLoaded() {
    const expectedCount = await this.verifyAllCamerasVisible();
    if (await this.liveCameras.count()) {
      for (let index = 0; index < expectedCount; index++) {
        const name = this.knownCameras?.[index];
        const card = this.knownCameras ? this._cameraCard(name) : this.cameraCards.nth(index);
        await expect(card.locator('.video-player').filter({ visible: true }).first(),
          `Camera ${name || index + 1} must render a feed section`).toBeVisible({ timeout: 15000 });
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