const test = require('@playwright/test');
const allure = require('allure-js-commons');


test("Playwright test", async ({ browser }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Smoke Tests');
    await allure.story('Browser Launch');
    await allure.severity('blocker');
    await allure.tags('smoke', 'browser');

    const context = await browser.newContext();
    // create a new page and navigate to the URL
    const page = await context.newPage();
    await page.goto("https://rahulshettyacademy.com/loginpagePractise/");
});


test("Playwright first test", async ({ page }) => {
    await allure.epic('E-Commerce App');
    await allure.feature('Smoke Tests');
    await allure.story('Page Navigation');
    await allure.severity('blocker');
    await allure.tags('smoke', 'navigation');

    await page.goto("https://rahulshettyacademy.com/loginpagePractise/");
});