// Full page object source code
const { expect } = require('@playwright/test');

// Multiple page objects may wrap the same page. Keep just one persistent handler.
const consentHandlerPages = new WeakSet();

class LoginPage {
  constructor(page) {
    this.page = page;
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign In' });
    // Cookie consent selectors — try multiple (OneTrust / TrustArc variants)
    this.cookieAcceptAll = page.getByRole('button', { name: /^Accept All$/i });
    this.cookieConsentButton = page.locator('#truste-consent-button');
    this.cookieDismissButton = this.cookieAcceptAll
      .or(page.getByRole('button', { name: /^Confirm my choices$/i }))
      .or(this.cookieConsentButton)
      .or(page.getByRole('dialog').filter({ hasText: 'This website uses cookies.' })
        .getByRole('button', { name: 'OK', exact: true }))
      .filter({ visible: true }).first();
  }

  async login(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async dismissCookieConsent() {
    if (!consentHandlerPages.has(this.page)) {
      // Consent scripts load asynchronously, sometimes AFTER the login form.
      // Playwright checks this handler before actions/assertions, including their
      // actionability retries, and waits for the trigger to hide after dismissal.
      // No times limit: a dialog can reappear during SPA recovery navigation.
      await this.page.addLocatorHandler(this.cookieDismissButton, async button => {
        await button.click();
      });
      consentHandlerPages.add(this.page);
    }
    // Also handle an already-visible popup. Absence succeeds immediately; a popup
    // that cannot be dismissed fails explicitly rather than being silently ignored.
    await expect(this.cookieDismissButton).toBeHidden({ timeout: 10000 });
  }
}

module.exports = { LoginPage };