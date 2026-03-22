const { test, expect } = require('../../../framework/fixtures/app.fixture');
const { createUniqueUser } = require('../../../framework/utils/userFactory');
const { logStep } = require('../../../framework/utils/steps');
const allure = require('allure-js-commons');

async function fillRegistrationForm(page, userData) {
  await page.locator('#firstName').fill(userData.firstName);
  await page.locator('#lastName').fill(userData.lastName);
  await page.locator('#userEmail').fill(userData.email);
  await page.locator('#userMobile').fill(userData.phone);
  await page.locator('select[formcontrolname="occupation"]').selectOption({ label: userData.occupation });
  await page.locator(`input[value="${userData.gender}"]`).check();
  await page.locator('#userPassword').fill(userData.password);
  await page.locator('#confirmPassword').fill(userData.confirmPassword);
  await page.locator('input[type="checkbox"]').check();
}

async function expectLoginFailureMessage(page) {
  const loginErrorMessage = page.locator('text=/Incorrect|invalid|not found/i').first();
  await expect(loginErrorMessage).toBeVisible();
}

test.describe('Register and login validations (5 positive + 5 negative)', () => {
  test.describe.configure({ mode: 'serial' });

  test('P1 - successful login with existing valid user', async ({ page, authPage, scenarioData }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Login');
    await allure.severity('critical');
    await allure.tags('auth', 'login', 'positive');

    await test.step('Open login page', async () => {
      logStep('Open login page');
      await authPage.open(scenarioData.baseUrl);
    });

    await test.step('Login with valid existing credentials', async () => {
      logStep('Login with valid existing credentials');
      await authPage.login(scenarioData.loginData);
    });

    await test.step('Assert dashboard and cart button are visible', async () => {
      logStep('Assert dashboard and cart button are visible');
      await expect(page).toHaveURL(/.*\/dashboard/);
      await expect(page.locator('button[routerlink*="cart"]')).toBeVisible();
    });
  });

  test('P2 - successful registration with unique user data', async ({ page, authPage, scenarioData }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Registration');
    await allure.severity('critical');
    await allure.tags('auth', 'registration', 'positive');

    const uniqueUser = createUniqueUser(scenarioData.registerData);

    await test.step('Open register page', async () => {
      logStep('Open register page');
      await authPage.open(scenarioData.baseUrl);
      await authPage.goToRegister();
    });

    await test.step('Submit valid registration form with unique email', async () => {
      logStep('Submit valid registration form with unique email');
      const outcome = await authPage.registerUser(uniqueUser);
      expect(['created', 'redirected']).toContain(outcome);
    });

    await test.step('Assert account creation success state is shown', async () => {
      logStep('Assert account creation success state is shown');
      const successTitle = page.locator('text=Account Created Successfully');
      const loginButtonOnSuccess = page.getByRole('button', { name: /^Login$/ });
      const loginUrl = /.*\/auth\/login/;
      const isSuccessTitleVisible = await successTitle.isVisible().catch(() => false);
      const isLoginButtonVisible = await loginButtonOnSuccess.isVisible().catch(() => false);

      expect(isSuccessTitleVisible || isLoginButtonVisible || loginUrl.test(page.url())).toBeTruthy();
    });
  });

  test('P3 - successful register then login using same created credentials', async ({ page, authPage, scenarioData }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Registration + Login');
    await allure.severity('critical');
    await allure.tags('auth', 'registration', 'login', 'positive', 'e2e');

    const uniqueUser = createUniqueUser(scenarioData.registerData);
    const createdCredentials = { email: uniqueUser.email, password: uniqueUser.password };

    await test.step('Register unique user', async () => {
      logStep('Register unique user');
      await authPage.open(scenarioData.baseUrl);
      await authPage.goToRegister();
      const outcome = await authPage.registerUser(uniqueUser);
      expect(['created', 'redirected']).toContain(outcome);
    });

    await test.step('Login with exact same newly created credentials', async () => {
      logStep('Login with exact same newly created credentials');
      await authPage.login(createdCredentials);
      await expect(page).toHaveURL(/.*\/dashboard/);
    });
  });

  test('P4 - all registration fields accept and retain valid data before submit', async ({ page, authPage, scenarioData }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Registration');
    await allure.severity('normal');
    await allure.tags('auth', 'registration', 'positive', 'form-validation');

    const uniqueUser = createUniqueUser(scenarioData.registerData);

    await test.step('Open register page and fill all mandatory fields', async () => {
      logStep('Open register page and fill all mandatory fields');
      await authPage.open(scenarioData.baseUrl);
      await authPage.goToRegister();
      await fillRegistrationForm(page, uniqueUser);
    });

    await test.step('Assert all field values are present before submission', async () => {
      logStep('Assert all field values are present before submission');
      await expect(page.locator('#firstName')).toHaveValue(uniqueUser.firstName);
      await expect(page.locator('#lastName')).toHaveValue(uniqueUser.lastName);
      await expect(page.locator('#userEmail')).toHaveValue(uniqueUser.email);
      await expect(page.locator('#userMobile')).toHaveValue(uniqueUser.phone);
      await expect(page.locator('#userPassword')).toHaveValue(uniqueUser.password);
      await expect(page.locator('#confirmPassword')).toHaveValue(uniqueUser.confirmPassword);
      await expect(page.locator(`input[value="${uniqueUser.gender}"]`)).toBeChecked();
      await expect(page.locator('input[type="checkbox"]')).toBeChecked();
    });
  });

  test('P5 - after login user can open cart section', async ({ page, authPage, scenarioData }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Login');
    await allure.severity('normal');
    await allure.tags('auth', 'login', 'cart', 'positive');

    await test.step('Login with valid credentials', async () => {
      logStep('Login with valid credentials');
      await authPage.open(scenarioData.baseUrl);
      await authPage.login(scenarioData.loginData);
    });

    await test.step('Navigate to cart and verify cart page opens', async () => {
      logStep('Navigate to cart and verify cart page opens');
      await page.locator('button[routerlink*="cart"]').click();
      await expect(page).toHaveURL(/.*\/cart/);
      await expect(page.getByRole('heading', { name: /My Cart|No Products in Your Cart/i }).first()).toBeVisible();
    });
  });

  test('N1 - login fails for valid email with wrong password', async ({ page, authPage, scenarioData }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Login');
    await allure.severity('critical');
    await allure.tags('auth', 'login', 'negative', 'security');

    await test.step('Open login and submit wrong password', async () => {
      logStep('Open login and submit wrong password');
      await authPage.open(scenarioData.baseUrl);
      await page.locator('#userEmail').fill(scenarioData.loginData.email);
      await page.locator('#userPassword').fill(`${scenarioData.loginData.password}wrong`);
      await page.locator('#login').click();
    });

    await test.step('Assert user stays on login and error is shown', async () => {
      logStep('Assert user stays on login and error is shown');
      await expect(page).toHaveURL(/.*\/auth\/login/);
      await expectLoginFailureMessage(page);
    });
  });

  test('N2 - login fails for non-registered email', async ({ page, authPage, scenarioData }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Login');
    await allure.severity('critical');
    await allure.tags('auth', 'login', 'negative', 'security');

    const fakeEmail = `nouser${Date.now()}@example.com`;

    await test.step('Open login and submit non-registered email', async () => {
      logStep('Open login and submit non-registered email');
      await authPage.open(scenarioData.baseUrl);
      await page.locator('#userEmail').fill(fakeEmail);
      await page.locator('#userPassword').fill(scenarioData.loginData.password);
      await page.locator('#login').click();
    });

    await test.step('Assert login error is displayed', async () => {
      logStep('Assert login error is displayed');
      await expect(page).toHaveURL(/.*\/auth\/login/);
      await expectLoginFailureMessage(page);
    });
  });

  test('N3 - registration shows account already exists for duplicate email', async ({ page, authPage, scenarioData }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Registration');
    await allure.severity('normal');
    await allure.tags('auth', 'registration', 'negative', 'duplicate');

    await test.step('Open register and submit with existing email', async () => {
      logStep('Open register and submit with existing email');
      await authPage.open(scenarioData.baseUrl);
      await authPage.goToRegister();
      const outcome = await authPage.registerUser(scenarioData.registerData);
      expect(outcome).toBe('exists');
    });

    await test.step('Assert duplicate account message is visible', async () => {
      logStep('Assert duplicate account message is visible');
      await authPage.assertDuplicateEmailError();
    });
  });

  test('N4 - mandatory registration fields are invalid when left empty', async ({ page, authPage, scenarioData }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Registration');
    await allure.severity('normal');
    await allure.tags('auth', 'registration', 'negative', 'form-validation');

    await test.step('Open register and attempt submit without filling fields', async () => {
      logStep('Open register and attempt submit without filling fields');
      await authPage.open(scenarioData.baseUrl);
      await authPage.goToRegister();
      await page.locator('#login, input[value="Register"]').click();
    });

    await test.step('Assert mandatory field validation messages are shown', async () => {
      logStep('Assert mandatory field validation messages are shown');
      await expect(page.locator('text=*First Name is required')).toBeVisible();
      await expect(page.locator('text=*Email is required')).toBeVisible();
      await expect(page.locator('text=*Phone Number is required')).toBeVisible();
      await expect(page.locator('text=*Password is required')).toBeVisible();
      await expect(page.locator('text=Confirm Password is required')).toBeVisible();
      await expect(page.locator('text=*Please check above checkbox')).toBeVisible();
      await expect(page).toHaveURL(/.*\/auth\/register/);
    });
  });

  test('N5 - registration fails when password and confirm password do not match', async ({ page, authPage, scenarioData }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Authentication');
    await allure.story('Registration');
    await allure.severity('normal');
    await allure.tags('auth', 'registration', 'negative', 'password-mismatch');

    const uniqueUser = createUniqueUser(scenarioData.registerData);

    await test.step('Open register and fill mismatched passwords', async () => {
      logStep('Open register and fill mismatched passwords');
      await authPage.open(scenarioData.baseUrl);
      await authPage.goToRegister();
      await fillRegistrationForm(page, {
        ...uniqueUser,
        confirmPassword: `${uniqueUser.password}x`,
      });
      await page.locator('#login, input[value="Register"]').click();
    });

    await test.step('Assert registration is blocked and success is not shown', async () => {
      logStep('Assert registration is blocked and success is not shown');
      await expect(page).toHaveURL(/.*\/auth\/register/);
      await expect(page.locator('text=Account Created Successfully')).toHaveCount(0);

      const confirmInputClass = await page.locator('#confirmPassword').getAttribute('class');
      expect(confirmInputClass || '').toContain('ng-invalid');
    });
  });
});
