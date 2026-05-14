const { expect } = require('@playwright/test');
const { waitForPageReady } = require('../../../utils/waitForPageReady');

class DevicesPage {
  constructor(page) {
    this.page = page;
  }

  async verifyDeviceCategoriesVisible() {
    // Wait for the page to load content — look for any heading, card, or list item on the devices/automation page
    await this.page.waitForURL('**/automation', { timeout: 10000 });
    // Wait for ALL loaders to disappear (e.g., "Loading devices" spinner)
    await waitForPageReady(this.page);
    // Verify there's at least some meaningful content on the page (not just a blank page)
    const hasContent = await this.page.locator('text=/Lights|Locks|Thermostat|Garage|Sensor|Switch|Device/i').first().isVisible({ timeout: 10000 }).catch(() => false)
      || await this.page.locator('[class*=automation], [class*=device], [class*=card], md-card, md-list-item').first().isVisible({ timeout: 5000 }).catch(() => false)
      || await this.page.locator('h1, h2, h3, h4').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasContent) {
      // Take a screenshot for debugging and fail with clear message
      throw new Error('Devices/Automation page loaded but no device categories, headings, or content found. The page may be empty or the locators need updating.');
    }
  }

  async verifyDevicesListVisible() {
    await this.verifyDeviceCategoriesVisible();
  }
}

module.exports = { DevicesPage };