const { expect } = require('@playwright/test');

class TotalConnectForgotPasswordPage {
  constructor(page) {
    this.page = page;
    this.forgotPasswordHeading = page.getByText('Forgot your password');
    this.usernameInput = page.locator('#UsernameInput');
    this.recaptchaResponse = page.locator('#g-recaptcha-response-100000');
    this.nextButton = page.getByRole('button', { name: 'NEXT' });
    this.returnToSignInLink = page.locator('a[href="https://qa2.totalconnect2.com/login"]');
  }

  async open(url) {
    await this.page.goto(url);
  }

  async enterUsername(username) {
    await this.usernameInput.fill(username);
  }

  async completeCaptcha(response) {
    await this.recaptchaResponse.fill(response);
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async navigateBackToSignIn() {
    await this.returnToSignInLink.click();
  }
}

module.exports = { TotalConnectForgotPasswordPage };