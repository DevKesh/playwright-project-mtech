const test = require('@playwright/test');


test("Playwright test", async ({ browser }) => {
    const context = await browser.newContext();
    // create a new page and navigate to the URL
    const page = await context.newPage();
    await page.goto("https://rahulshettyacademy.com/loginpagePractise/");
});


test("Playwright first test", async ({ page }) => {

    await page.goto("https://rahulshettyacademy.com/loginpagePractise/");
});