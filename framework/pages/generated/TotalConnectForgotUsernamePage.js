const { expect } = require('@playwright/test');

class TotalConnectForgotUsernamePage {
  constructor(page) {
    this.page = page;
    this.forgotUsernameHeading = page.getByText('Forgot your username');
    this.emailOrPhoneInput = page.locator('#EmailPhoneInput');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.recaptchaResponse = page.locator('#g-recaptcha-response-100000');
    this.returnToSignInLink = page.getByText('Return To Sign In');
  }

  async open(url) {
    await this.page.goto(url);
  }

  async fillEmailOrPhoneInput(value) {
    await this.emailOrPhoneInput.fill(value);
  }

  async completeCaptcha(response) {
    await this.recaptchaResponse.fill(response);
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async navigateToLoginPage() {
    await this.returnToSignInLink.click();
    await expect(this.page).toHaveURL(/.*\/login/);
  }
}

module.exports = { TotalConnectForgotUsernamePage };