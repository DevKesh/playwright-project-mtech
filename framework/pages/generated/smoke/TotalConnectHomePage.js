// Full page object source code
const { expect } = require('@playwright/test');
const { LoginPage } = require('./LoginPage');
const {
  assertClickable,
  assertNavigation,
  withFailureContext,
  classifyAndThrow,
} = require('../../../utils/assertion-helper');

const PAGE_NAME = 'HomePage';
const transientPopupSetups = new WeakMap();

class TotalConnectHomePage {
  constructor(page) {
    this.page = page;
    this.cookieDismissButton = page.locator('#truste-consent-button');
    this.doneButton = page.getByRole('button', { name: 'DONE', exact: true }).filter({ visible: true }).first();
    this.selectAllCheckbox = page.getByText(/^(SELECT ALL|DESELECT ALL)$/i).filter({ visible: true }).first();
    this.partitionCheckboxes = page.getByRole('checkbox', { name: /^Toggle P\d+\s*-/ }).filter({ visible: true });
    this.armHomeButton = page.locator('button, .panelActionText').filter({ hasText: /^\s*ARM HOME(?: ALL)?\s*$/i }).filter({ visible: true }).first();
    this.armAwayButton = page.locator('button, .panelActionText').filter({ hasText: /^\s*ARM AWAY(?: ALL)?\s*$/i }).filter({ visible: true }).first();
    this.disarmButton = page.locator('button, .panelActionText').filter({ hasText: /^\s*DISARM(?: ALL)?\s*$/i }).filter({ visible: true }).first();
    // Only observed status text; do not guess a partition container. Include
    // pending states so one completed partition cannot mask another in progress.
    this.partitionStatusText = page.getByText(/^\s*(Armed Home|Armed Away|Disarmed|Arming|Disarming)\s*$/)
      .filter({ visible: true });
    this.actionError = page.getByText('Unable to perform the action', { exact: false })
      .filter({ visible: true }).first();
    this.securityNav = page.getByRole('button', { name: 'Security', exact: true }).first();
    this.devicesNav = page.getByRole('button', { name: 'Devices' }).first();
    this.camerasNav = page.getByRole('button', { name: 'Cameras' }).first();
    this.activityNav = page.getByRole('button', { name: 'Activity' }).first();
  }

  async dismissCookiePopup() {
    await new LoginPage(this.page).dismissCookieConsent();
  }

  async closeDonePopup() {
    await this._throwIfActionRejected();
    if (await this.doneButton.isVisible()) {
      await this.doneButton.click();
    }
  }

  /**
   * Compatibility method: application failures are reported, never dismissed.
   */
  async dismissErrorDialog() {
    await this._throwIfActionRejected();
  }

  async _throwIfActionRejected() {
    if (await this.page.getByText('Communication Failure', { exact: true }).isVisible()) {
      throw new Error('Security panel is offline (Communication Failure). Restore panel connectivity before running arm/disarm.');
    }
    if (await this.actionError.isVisible()) {
      classifyAndThrow(
        new Error(`Security system rejected the command: ${(await this.actionError.innerText()).trim()}`),
        'Verify security system response',
        { page: PAGE_NAME, element: 'Security system dialog', expected: 'Command accepted without an application error' }
      );
    }
  }

  /** Optional popups may appear late. Register persistent handlers once per page. */
  async dismissTransientPopups() {
    await this.dismissCookiePopup();
    if (!transientPopupSetups.has(this.page)) {
      const setup = (async () => {
        await this.page.addLocatorHandler(this.doneButton, async button => {
          await this._throwIfActionRejected();
          await button.click();
        });
        const outOfSyncDialog = this.page.getByRole('dialog')
          .filter({ hasText: 'Your security panel is out of sync' })
          .filter({ visible: true }).first();
        await this.page.addLocatorHandler(outOfSyncDialog, async () => {
          await this._throwIfActionRejected();
          await this.page.keyboard.press('Escape');
        });
      })();
      transientPopupSetups.set(this.page, setup);
    }
    await transientPopupSetups.get(this.page);
  }

  async selectAllPartitions({ armedOnly = false } = {}) {
    try {
      await this._throwIfActionRejected();
      await expect(this.selectAllCheckbox.or(this.partitionCheckboxes).first()).toBeVisible({ timeout: 15000 });
      // Current UI exposes individual selection checkboxes instead of SELECT ALL.
      // Selecting changes only UI state; setChecked is idempotent, unlike click.
      const selectable = armedOnly
        ? this.page.getByRole('listitem').filter({ has: this.partitionCheckboxes })
          .filter({ hasText: /Armed (Home|Away)/ }).getByRole('checkbox')
        : this.partitionCheckboxes;
      const checkboxes = await selectable.all();
      if (checkboxes.length) {
        for (const checkbox of checkboxes) {
          await checkbox.setChecked(true);
          await expect(checkbox).toBeChecked();
        }
        return;
      }
      const selectAll = this.page.getByText(/^SELECT ALL$/i).filter({ visible: true }).first();
      if (await selectAll.isVisible()) {
        await selectAll.click({ timeout: 10000 });
      }
      await this.page.getByText(/^DESELECT ALL$/i).filter({ visible: true }).first()
        .waitFor({ state: 'visible', timeout: 10000 });
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
      await expect(this.armHomeButton).toBeVisible({ timeout: 10000 });
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

    // Observe the response; never retry a physical security command.
    await this.verifyPartitionStatus('Armed Home');
  }

  async armAway() {
    try {
      await expect(this.armAwayButton).toBeVisible({ timeout: 10000 });
      await this.armAwayButton.click({ timeout: 10000 });
    } catch (error) {
      classifyAndThrow(error, 'Click ARM AWAY button', {
        page: PAGE_NAME,
        element: 'ARM AWAY ALL button',
        expected: 'Button should be visible and clickable after selecting partitions',
      });
    }
    await this.verifyPartitionStatus('Armed Away');
  }

  async disarm() {
    try {
      await expect(this.disarmButton).toBeVisible({ timeout: 10000 });
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

    await this.verifyPartitionStatus('Disarmed');
  }

  async waitForArmedHome() {
    await this.verifyPartitionStatus('Armed Home');
  }

  async waitForArmedAway() {
    await this.verifyPartitionStatus('Armed Away');
  }

  async waitForDisarmed() {
    await this.verifyPartitionStatus('Disarmed');
  }

  async verifyPartitionStatus(expectedStatus) {
    if (!['Armed Home', 'Armed Away', 'Disarmed'].includes(expectedStatus)) {
      throw new Error(`Unsupported partition status: ${expectedStatus}`);
    }
    let statuses = [];
    let rejection = '';
    try {
      await expect.poll(async () => {
        if (await this.actionError.isVisible()) {
          rejection = (await this.actionError.innerText()).trim();
          // Stop polling on rejection; throw outside the retrying assertion.
          return true;
        }
        statuses = await this._visiblePartitionStatuses();
        return statuses.length > 0 && statuses.every(status => status === expectedStatus);
      }, {
        timeout: 60000,
        message: `Every visible partition must reach "${expectedStatus}"`,
      }).toBe(true);
    } catch (error) {
      await this._throwIfActionRejected();
      classifyAndThrow(error, `Verify all partitions are "${expectedStatus}"; observed: ${JSON.stringify(statuses)}`, {
        page: PAGE_NAME, element: 'Visible partition statuses', expected: `All statuses must be "${expectedStatus}" within 60 seconds`,
      });
    }
    if (rejection) {
      classifyAndThrow(new Error(`Security system rejected the command: ${rejection}`), 'Verify partition status', {
        page: PAGE_NAME, element: 'Security system dialog', expected: `All partitions should reach "${expectedStatus}"`,
      });
    }
    await this._throwIfActionRejected();
  }

  async _visiblePartitionStatuses() {
    return (await this.partitionStatusText.allTextContents())
      .map(text => text.replace(/\s+/g, ' ').trim());
  }

  /**
   * Ensures all partitions are in Disarmed state before proceeding.
   */
  async ensureDisarmed() {
    await this._throwIfActionRejected();
    await withFailureContext(
      () => expect(this.partitionStatusText.first()).toBeVisible({ timeout: 30000 }),
      'Wait for actual partition statuses to load',
      { page: PAGE_NAME, element: 'Partition status text', expected: 'At least one visible partition status' }
    );
    const statuses = await this._visiblePartitionStatuses();
    await this._throwIfActionRejected();
    if (statuses.length > 0 && statuses.every(status => status === 'Disarmed')) return;

    // Mixed-state UI deliberately disables disarmed partitions once an armed
    // partition is selected. Select ALL armed partitions for this precondition;
    // normal arm/disarm steps still require every partition selected.
    await this.selectAllPartitions({ armedOnly: true });
    await this.disarm(); // Includes verification that ALL visible statuses are Disarmed.
  }

  async navigateToHome() {
    await this.dismissTransientPopups();
    if (new URL(this.page.url()).pathname.replace(/\/$/, '') === '/home') {
      await expect(this.devicesNav).toBeVisible({ timeout: 30000 });
      return;
    }
    await assertClickable(this.securityNav, 'Security navigation button', { page: PAGE_NAME });
    try {
      await this.securityNav.click({ timeout: 10000 });
    } catch (error) {
      classifyAndThrow(error, 'Click Security navigation', {
        page: PAGE_NAME, element: 'Security sidebar button', expected: 'Should navigate to /home',
      });
    }
    await assertNavigation(this.page, /\/home\/?(?:[?#].*)?$/, 'Home page', { fromPage: PAGE_NAME });
  }

  async navigateToDevices() {
    await this.dismissTransientPopups();
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
    await this.dismissTransientPopups();
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
    await this.dismissTransientPopups();
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