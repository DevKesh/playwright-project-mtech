// @ts-check
import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

test('has title', async ({ page }) => {
  await allure.epic('Playwright Docs');
  await allure.feature('Smoke Tests');
  await allure.story('Page Title');
  await allure.severity('blocker');
  await allure.tags('smoke', 'docs');

  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await allure.epic('Playwright Docs');
  await allure.feature('Smoke Tests');
  await allure.story('Navigation');
  await allure.severity('normal');
  await allure.tags('smoke', 'docs', 'navigation');

  await page.goto('https://playwright.dev/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
