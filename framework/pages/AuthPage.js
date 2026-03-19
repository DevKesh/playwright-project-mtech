const { expect } = require('@playwright/test');

class AuthPage {
  constructor(page) {
    this.page = page;

    // Login page
    this.registerLink = page.locator('.text-reset');
    this.loginEmail = page.locator('#userEmail');
    this.loginPassword = page.locator('#userPassword');
    this.loginButton = page.locator('#login');

    // Registration page
    this.firstName = page.locator('#firstName');
    this.lastName = page.locator('#lastName');
    this.registerEmail = page.locator('#userEmail');
    this.phone = page.locator('#userMobile');
    this.occupation = page.locator('select[formcontrolname="occupation"]');
    this.genderRadio = (gender) => page.locator(`input[value="${gender}"]`);
    this.registerPassword = page.locator('#userPassword');
    this.confirmPassword = page.locator('#confirmPassword');
    this.ageCheckbox = page.locator('input[type="checkbox"]');
    this.registerSubmit = page.locator('#login, input[value="Register"]');
    this.loginHereLink = page.getByText('Already have an account? Login here');
    this.loginFromSuccessButton = page.getByRole('button', { name: /^Login$/ });

    // Shared feedback locators
    this.successMessage = page.locator('text=Account Created Successfully');
    this.alreadyExistsMessage = page.locator('text=User already exisits with this Email Id!');
    this.dashboardHeader = page.locator('.left.mt-1, h1');
  }

  async open(baseUrl) {
    await this.page.goto(baseUrl);
    await expect(this.page).toHaveURL(/.*\/auth\/login/);
  }

  async goToRegister() {
    await this.registerLink.click();
    await expect(this.page).toHaveURL(/.*\/auth\/register/);
  }

  async registerUser(registerData) {
    await this.firstName.fill(registerData.firstName);
    await this.lastName.fill(registerData.lastName);
    await this.registerEmail.fill(registerData.email);
    await this.phone.fill(registerData.phone);
    await this.occupation.selectOption({ label: registerData.occupation });
    await this.genderRadio(registerData.gender).check();
    await this.registerPassword.fill(registerData.password);
    await this.confirmPassword.fill(registerData.confirmPassword);
    await this.ageCheckbox.check();
    await this.registerSubmit.click();

    // A reusable account can be pre-created; we accept both outcomes so reruns stay stable.
    const outcome = await Promise.race([
      this.successMessage.waitFor({ state: 'visible', timeout: 7000 }).then(() => 'created'),
      this.alreadyExistsMessage.waitFor({ state: 'visible', timeout: 7000 }).then(() => 'exists'),
      this.page.waitForURL(/.*\/auth\/login/, { timeout: 7000 }).then(() => 'redirected'),
    ]).catch(() => 'unknown');

    return outcome;
  }

  async assertDuplicateEmailError() {
    await expect(this.alreadyExistsMessage).toBeVisible();
  }

  async login(loginData) {
    // Register and login screens share some IDs, so we use this page-specific link as the guard.
    const registerScreenVisible = await this.loginHereLink.isVisible().catch(() => false);
    if (registerScreenVisible) {
      await this.loginHereLink.click();
      await expect(this.page).toHaveURL(/.*\/auth\/login/);
    }

    // New account flow lands on a success screen with a dedicated Login button.
    const successLoginVisible = await this.loginFromSuccessButton.isVisible().catch(() => false);
    if (successLoginVisible) {
      await this.loginFromSuccessButton.click();
      await expect(this.page).toHaveURL(/.*\/auth\/login/);
    }

    await this.loginEmail.fill(loginData.email);
    await this.loginPassword.fill(loginData.password);
    await this.loginButton.click();

    await expect(this.page).toHaveURL(/.*\/dashboard/);
    await expect(this.dashboardHeader.first()).toBeVisible();
  }
}

module.exports = { AuthPage };
