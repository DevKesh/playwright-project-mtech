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
    this.camerasNav = page.getByRole('button', { name: 'Cameras-broken' }).first();
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

  /**
   * Dismisses any error/status dialog that appears with an OK button.
   */
  async dismissErrorDialog() {
    const okButton = this.page.getByRole('button', { name: 'OK' });
    if (await okButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await okButton.click();
      await this.page.waitForTimeout(1000);
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
    // If an error dialog appears, the test should fail — do NOT silently dismiss
    const errorDialog = this.page.getByText('Unable to perform the action');
    const hasError = await errorDialog.isVisible({ timeout: 8000 }).catch(() => false);
    if (hasError) {
      throw new Error('Security system error: "Unable to perform the action in your security system. Please try again." — the system may need more cooldown time between arm/disarm operations.');
    }
  }

  async armAway() {
    await this.armAwayButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.armAwayButton.click();
  }

  async disarm() {
    await this.disarmButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.disarmButton.click();
    // If an error dialog appears, the test should fail — do NOT silently dismiss
    const errorDialog = this.page.getByText('Unable to perform the action');
    const hasError = await errorDialog.isVisible({ timeout: 8000 }).catch(() => false);
    if (hasError) {
      throw new Error('Security system error: "Unable to perform the action in your security system. Please try again." — the system may need more cooldown time between arm/disarm operations.');
    }
  }

  async waitForArmedHome() {
    // Use exact match to avoid matching activity log entries like "Armed Home-P2 Partition-02"
    await this.page.getByText('Armed Home', { exact: true }).first().waitFor({ timeout: 30000 });
  }

  async waitForArmedAway() {
    await this.page.getByText('Armed Away', { exact: true }).first().waitFor({ timeout: 30000 });
  }

  async waitForDisarmed() {
    // Use exact match to avoid matching activity log entries like "Disarmed-P1 Partition 1"
    await this.page.getByText('Disarmed', { exact: true }).first().waitFor({ timeout: 30000 });
  }

  async verifyPartitionStatus(expectedStatus) {
    await expect(this.page.getByText(expectedStatus, { exact: true }).first()).toBeVisible({ timeout: 30000 });
  }

  /**
   * Ensures all partitions are in Disarmed state before proceeding.
   * Selects all partitions, checks the action buttons to determine state,
   * and disarms if needed. Leaves partitions deselected when done.
   */
  async ensureDisarmed() {
    // Wait for partition section to fully render
    await this.selectAllCheckbox.waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForTimeout(2000);

    // Select all partitions to reveal action buttons (ARM HOME / DISARM)
    const selectAllText = this.page.getByText('SELECT ALL', { exact: true });
    const isSelectAll = await selectAllText.isVisible({ timeout: 2000 }).catch(() => false);
    if (isSelectAll) {
      await selectAllText.click();
      await this.page.waitForTimeout(1000);
    }
    // If DESELECT ALL was already showing, partitions are already selected — that's fine

    // Now check: is DISARM visible? → partitions are armed
    const disarmVisible = await this.disarmButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (!disarmVisible) {
      console.log('[ensureDisarmed] Partitions are already disarmed. Deselecting and proceeding.');
      // Deselect all to leave clean state
      const deselectAll = this.page.getByText('DESELECT ALL', { exact: true });
      if (await deselectAll.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deselectAll.click();
        await this.page.waitForTimeout(500);
      }
      return;
    }

    console.log('[ensureDisarmed] Partitions are armed. Clicking DISARM...');
    await this.disarmButton.click();

    // Wait for ARM HOME button to appear — confirms disarm completed
    await this.armHomeButton.waitFor({ state: 'visible', timeout: 30000 });
    console.log('[ensureDisarmed] Disarm confirmed — ARM HOME button now visible.');

    // Dismiss any error dialog
    await this.dismissErrorDialog();

    // Deselect all partitions to leave clean state
    const deselectAll = this.page.getByText('DESELECT ALL', { exact: true });
    if (await deselectAll.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deselectAll.click();
      await this.page.waitForTimeout(500);
    }

    // Wait for the security system to stabilize before allowing re-arm
    console.log('[ensureDisarmed] Waiting 15s for security system cooldown...');
    await this.page.waitForTimeout(15000);
    console.log('[ensureDisarmed] Cooldown complete. Ready for test.');
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