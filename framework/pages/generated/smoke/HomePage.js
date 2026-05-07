const { expect } = require('@playwright/test');

class HomePage {
  constructor(page) {
    this.page = page;
    this.cookieDismissButton = page.locator('#truste-consent-button');
    this.doneButton = page.getByRole('button', { name: 'DONE' });
    this.selectAllCheckbox = page.getByText(/SELECT ALL|DESELECT ALL/).first();
    this.armHomeButton = page.locator('button', { hasText: 'ARM HOME' }).first();
    this.armAwayButton = page.locator('button', { hasText: 'ARM AWAY' }).first();
    this.disarmButton = page.locator('button', { hasText: 'DISARM' }).first();
    this.partitionStatusText = page.getByText(/Armed Home|Armed Away|Disarmed/);
    this.devicesNav = page.getByRole('button', { name: 'Devices' }).first();
    this.camerasNav = page.getByRole('button', { name: 'Cameras' }).first();
    this.activityNav = page.getByRole('button', { name: 'Activity' }).first();
  }

  async dismissCookiePopup() {
    if (await this.cookieDismissButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.cookieDismissButton.click();
    }
  }

  async closeDonePopup() {
    if (await this.doneButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.doneButton.click();
    }
  }

  async selectAllPartitions() {
    await this.selectAllCheckbox.click();
    // Wait for arming buttons to appear after selection
    await this.page.waitForTimeout(1000);
  }

  async armHome() {
    await this.armHomeButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.armHomeButton.click();
  }

  async armAway() {
    await this.armAwayButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.armAwayButton.click();
  }

  async disarm() {
    await this.disarmButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.disarmButton.click();
  }

  async waitForArmedHome() {
    await this.page.getByText('Armed Home').first().waitFor({ timeout: 30000 });
  }

  async waitForArmedAway() {
    await this.page.getByText('Armed Away').first().waitFor({ timeout: 30000 });
  }

  async waitForDisarmed() {
    await this.page.getByText('Disarmed').first().waitFor({ timeout: 30000 });
  }

  async verifyPartitionStatus(expectedStatus) {
    await expect(this.page.getByText(expectedStatus).first()).toBeVisible({ timeout: 30000 });
  }

  async navigateToDevices() {
    await this.devicesNav.click();
    await this.page.waitForURL('**/automation', { timeout: 15000 });
  }

  async navigateToCameras() {
    await this.camerasNav.click();
    await this.page.waitForURL('**/cameras', { timeout: 15000 });
  }

  async navigateToActivity() {
    await this.activityNav.click();
    await this.page.waitForURL('**/events', { timeout: 15000 });
  }
}

module.exports = { HomePage };