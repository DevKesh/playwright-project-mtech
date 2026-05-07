const { expect } = require('@playwright/test');

class TotalConnectActivityPage {
  constructor(page) {
    this.page = page;
    this.activityLogEntries = page.locator('.activity-log-entry, [class*="event"]').first();
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async verifyActivityLogVisible() {
    await expect(this.activityLogEntries).toBeVisible({ timeout: 10000 });
  }
}

module.exports = { TotalConnectActivityPage };
