const { expect } = require('@playwright/test');
const { waitForPageReady } = require('../../../utils/waitForPageReady');

class ActivityPage {
  constructor(page) {
    this.page = page;
    this.activityEntries = page.locator('[class*=event], [class*=activity], .event-row, tr')
      .filter({ hasText: /\b\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)\b/i })
      .filter({ visible: true }).first();
    this.activityTimestamp = this.activityEntries.getByText(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)\b/i).first();
  }

  async verifyActivityLogEntries() {
    // Wait for any loaders (e.g., "Loading activities") to disappear first
    await waitForPageReady(this.page);
    await expect(this.page).toHaveURL(/\/events(?:[/?#]|$)/);
    await expect(this.activityEntries, 'A timestamped activity entry must be visible').toBeVisible({ timeout: 30000 });
  }

  async verifyActivityLogEntriesVisible() {
    await this.verifyActivityLogEntries();
  }
}

module.exports = { ActivityPage };