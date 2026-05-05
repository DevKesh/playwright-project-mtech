const { expect } = require('@playwright/test');

class CamerasPage {
  constructor(page) {
    this.page = page;
    this.camerasLink = page.getByRole('link', { name: 'Cameras' });
    this.cameraFeedSection = page.getByRole('region', { name: 'Camera Feed' });
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateToCamerasPage() {
    await this.camerasLink.click();
    await this.page.waitForURL(/.*\/cameras/, { timeout: 10000 });
  }

  async verifyCamerasPageLoaded() {
    await expect(this.page).toHaveURL('**/cameras', { timeout: 15000 });
  }

  async verifyCameraFeedVisible() {
    await expect(this.cameraFeedSection).toBeVisible();
  }
}

module.exports = { CamerasPage };