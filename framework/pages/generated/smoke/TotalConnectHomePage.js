// Full page object source code
const { expect } = require('@playwright/test');
const {
  assertVisible,
  assertClickable,
  assertNavigation,
  assertText,
  withFailureContext,
  classifyAndThrow,
} = require('../../../utils/assertion-helper');

const PAGE_NAME = 'HomePage';

class TotalConnectHomePage {
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
    try {
      await this.selectAllCheckbox.click({ timeout: 10000 });
      await this.page.waitForTimeout(1000);
    } catch (error) {
      classifyAndThrow(error, 'Click "SELECT ALL" to select partitions', {
        page: PAGE_NAME,
        element: 'SELECT ALL checkbox',
        expected: 'Partition selection toggle should be clickable',
      });
    }
  }

  async armHome() {
    try {
      await this.armHomeButton.waitFor({ state: 'visible', timeout: 10000 });
    } catch (error) {
      classifyAndThrow(error, 'Wait for ARM HOME button to appear', {
        page: PAGE_NAME,
        element: 'ARM HOME ALL button',
        expected: 'Button should be visible after selecting partitions',
      });
    }

    try {
      await this.armHomeButton.click({ timeout: 10000 });
    } catch (error) {
      classifyAndThrow(error, 'Click ARM HOME button', {
        page: PAGE_NAME,
        element: 'ARM HOME ALL button',
        expected: 'Button should be clickable (no spinner/overlay blocking)',
      });
    }

    // Genuine failure: security system rejected the action
    const errorDialog = this.page.getByText('Unable to perform the action');
    const hasError = await errorDialog.isVisible({ timeout: 8000 }).catch(() => false);
    if (hasError) {
      classifyAndThrow(
        new Error('Security system rejected Arm Home action'),
        'Arm Home — system response',
        {
          page: PAGE_NAME,
          element: 'Security system dialog',
          expected: 'System should accept the Arm Home command without errors',
        }
      );
    }
  }

  async armAway() {
    try {
      await this.armAwayButton.waitFor({ state: 'visible', timeout: 10000 });
      await this.armAwayButton.click({ timeout: 10000 });
    } catch (error) {
      classifyAndThrow(error, 'Click ARM AWAY button', {
        page: PAGE_NAME,
        element: 'ARM AWAY ALL button',
        expected: 'Button should be visible and clickable after selecting partitions',
      });
    }
  }

  async disarm() {
    try {
      await this.disarmButton.waitFor({ state: 'visible', timeout: 10000 });
    } catch (error) {
      classifyAndThrow(error, 'Wait for DISARM button to appear', {
        page: PAGE_NAME,
        element: 'DISARM button',
        expected: 'Button should be visible when partitions are armed',
      });
    }

    try {
      await this.disarmButton.click({ timeout: 10000 });
    } catch (error) {
      classifyAndThrow(error, 'Click DISARM button', {
        page: PAGE_NAME,
        element: 'DISARM button',
        expected: 'Button should be clickable (no spinner/overlay blocking)',
      });
    }

    // Genuine failure: security system rejected the action
    const errorDialog = this.page.getByText('Unable to perform the action');
    const hasError = await errorDialog.isVisible({ timeout: 8000 }).catch(() => false);
    if (hasError) {
      classifyAndThrow(
        new Error('Security system rejected Disarm action'),
        'Disarm — system response',
        {
          page: PAGE_NAME,
          element: 'Security system dialog',
          expected: 'System should accept the Disarm command without errors',
        }
      );
    }
  }

  async waitForArmedHome() {
    await withFailureContext(
      () => this.page.getByText('Armed Home', { exact: true }).first().waitFor({ timeout: 30000 }),
      'Wait for partition status to show "Armed Home"',
      { page: PAGE_NAME, element: 'Partition status text', expected: 'Status should change to "Armed Home" after arming' }
    );
  }

  async waitForArmedAway() {
    await withFailureContext(
      () => this.page.getByText('Armed Away', { exact: true }).first().waitFor({ timeout: 30000 }),
      'Wait for partition status to show "Armed Away"',
      { page: PAGE_NAME, element: 'Partition status text', expected: 'Status should change to "Armed Away" after arming' }
    );
  }

  async waitForDisarmed() {
    await withFailureContext(
      () => this.page.getByText('Disarmed', { exact: true }).first().waitFor({ timeout: 30000 }),
      'Wait for partition status to show "Disarmed"',
      { page: PAGE_NAME, element: 'Partition status text', expected: 'Status should change to "Disarmed" after disarming' }
    );
  }

  async verifyPartitionStatus(expectedStatus) {
    await assertVisible(
      this.page.getByText(expectedStatus, { exact: true }).first(),
      `Partition status "${expectedStatus}"`,
      { page: PAGE_NAME, timeout: 30000 }
    );
  }

  /**
   * Ensures all partitions are in Disarmed state before proceeding.
   */
  async ensureDisarmed() {
    // Wait for partition section to fully render
    await withFailureContext(
      () => this.selectAllCheckbox.waitFor({ state: 'visible', timeout: 15000 }),
      'Wait for partition controls to load',
      { page: PAGE_NAME, element: 'SELECT ALL toggle', expected: 'Partition section should render within 15s' }
    );
    await this.page.waitForTimeout(500);

    // Select all partitions to reveal action buttons
    const selectAllText = this.page.getByText('SELECT ALL', { exact: true });
    const isSelectAll = await selectAllText.isVisible({ timeout: 2000 }).catch(() => false);
    if (isSelectAll) {
      await selectAllText.click({ timeout: 10000 });
      await this.page.waitForTimeout(1000);
    }

    // Check: is DISARM visible? → partitions are armed
    const disarmVisible = await this.disarmButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (!disarmVisible) {
      console.log('[ensureDisarmed] Partitions are already disarmed. Deselecting and proceeding.');
      const deselectAll = this.page.getByText('DESELECT ALL', { exact: true });
      if (await deselectAll.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deselectAll.click({ timeout: 10000 });
        await this.page.waitForTimeout(500);
      }
      return;
    }

    console.log('[ensureDisarmed] Partitions are armed. Clicking DISARM...');
    await this.disarmButton.click({ timeout: 10000 });

    // Wait for ARM HOME button to appear — confirms disarm completed
    await withFailureContext(
      () => this.armHomeButton.waitFor({ state: 'visible', timeout: 60000 }),
      'Confirm disarm completed (ARM HOME button should reappear)',
      { page: PAGE_NAME, element: 'ARM HOME button', expected: 'Disarm should complete and show ARM HOME within 60s' }
    );
    console.log('[ensureDisarmed] Disarm confirmed — ARM HOME button now visible.');

    await this.dismissErrorDialog();

    // Deselect all partitions to leave clean state
    const deselectAll = this.page.getByText('DESELECT ALL', { exact: true });
    if (await deselectAll.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deselectAll.click({ timeout: 10000 });
      await this.page.waitForTimeout(500);
    }

    console.log('[ensureDisarmed] Waiting 5s for security system cooldown...');
    await this.page.waitForTimeout(5000);
    console.log('[ensureDisarmed] Cooldown complete. Ready for test.');
  }

  async navigateToDevices() {
    await assertClickable(this.devicesNav, 'Devices navigation button', { page: PAGE_NAME });
    try {
      await this.devicesNav.click({ timeout: 10000 });
    } catch (error) {
      classifyAndThrow(error, 'Click Devices navigation', {
        page: PAGE_NAME, element: 'Devices sidebar button', expected: 'Should navigate to /automation',
      });
    }
    await assertNavigation(this.page, '**/automation**', 'Devices page', { fromPage: PAGE_NAME });
  }

  async navigateToCameras() {
    await assertClickable(this.camerasNav, 'Cameras navigation button', { page: PAGE_NAME });
    try {
      await this.camerasNav.click({ timeout: 10000 });
    } catch (error) {
      classifyAndThrow(error, 'Click Cameras navigation', {
        page: PAGE_NAME, element: 'Cameras sidebar button', expected: 'Should navigate to /cameras',
      });
    }
    await assertNavigation(this.page, '**/cameras**', 'Cameras page', { fromPage: PAGE_NAME });
  }

  async navigateToActivity() {
    await assertClickable(this.activityNav, 'Activity navigation button', { page: PAGE_NAME });
    try {
      await this.activityNav.click({ timeout: 10000 });
    } catch (error) {
      classifyAndThrow(error, 'Click Activity navigation', {
        page: PAGE_NAME, element: 'Activity sidebar button', expected: 'Should navigate to /events',
      });
    }
    await assertNavigation(this.page, '**/events**', 'Activity page', { fromPage: PAGE_NAME });
  }
}

module.exports = { TotalConnectHomePage };