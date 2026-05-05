const { expect } = require('@playwright/test');

class ActivityPage {
  constructor(page) {
    this.page = page;
    this.activityLogsLink = page.getByRole('link', { name: 'Activity Logs' });
    this.activityLogEntries = page.getByRole('list', { name: 'Activity Log Entries' });
    this.activityLogTimestamps = page.locator('.activity-log-entry .timestamp');
  }

  async open(url) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateToActivityLogs() {
    await this.activityLogsLink.click();
    await this.page.waitForURL(/.*\/activity|.*\/events/, { timeout: 10000 });
  }

  async verifyActivityLogEntriesVisible() {
    await expect(this.activityLogEntries).toBeVisible();
  }

  async verifyActivityLogTimestamps() {
    const count = await this.activityLogTimestamps.count();
    for (let i = 0; i < count; i++) {
      const timestampText = await this.activityLogTimestamps.nth(i).innerText();
      expect(timestampText).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2} (AM|PM)/);
    }
  }
}

module.exports = { ActivityPage };