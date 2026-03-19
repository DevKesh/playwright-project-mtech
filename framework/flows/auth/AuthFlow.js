const { createUniqueEmail } = require('../../utils/userFactory');

function createAuthFlow({ page, authPage, expect }) {
  const loginWithValidUser = async (baseUrl, loginData) => {
    await authPage.open(baseUrl);
    await authPage.login(loginData);
  };

  const registerWithRetryThenLogin = async (scenarioData) => {
    await authPage.open(scenarioData.baseUrl);
    await authPage.goToRegister();

    let registerPayload = { ...scenarioData.registerData };
    const createdCredentials = {
      email: scenarioData.loginData.email,
      password: scenarioData.loginData.password,
    };

    const registrationOutcome = await authPage.registerUser(registerPayload);

    if (registrationOutcome === 'exists') {
      await authPage.assertDuplicateEmailError();
      await page.reload();
      await expect(page).toHaveURL(/.*\/auth\/register/);

      const uniqueEmail = createUniqueEmail(scenarioData.registerData.email);
      registerPayload = { ...scenarioData.registerData, email: uniqueEmail };
      createdCredentials.email = uniqueEmail;

      const retryOutcome = await authPage.registerUser(registerPayload);
      expect(['created', 'redirected']).toContain(retryOutcome);
    } else {
      createdCredentials.email = registerPayload.email;
      expect(['created', 'redirected']).toContain(registrationOutcome);
    }

    await authPage.login(createdCredentials);
    return createdCredentials;
  };

  return {
    loginWithValidUser,
    registerWithRetryThenLogin,
  };
}

module.exports = { createAuthFlow };
