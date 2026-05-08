const { expect } = require('@playwright/test');

class CamerasPage {
  constructor(page) {
    this.page = page;
  }

  async verifyCamerasPageLoaded() {
    await expect(this.page).toHaveURL(/.*\/cameras/, { timeout: 10000 });
    // Wait for page content to render
    await this.page.waitForTimeout(2000);
    // Verify there's actual camera content — look for camera-related elements or any meaningful content
    const hasContent = await this.page.locator('text=/Camera|Video|Live|Feed|Stream|No Camera/i').first().isVisible({ timeout: 10000 }).catch(() => false)
      || await this.page.locator('[class*=camera], [class*=video], [class*=feed], img, video').first().isVisible({ timeout: 5000 }).catch(() => false)
      || await this.page.locator('h1, h2, h3, h4').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasContent) {
      throw new Error('Cameras page loaded but no camera feed, video elements, or content found. The page may be empty or the locators need updating.');
    }
  }
}

module.exports = { CamerasPage };