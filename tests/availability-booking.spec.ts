/*import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});*/


import { test, expect } from '@playwright/test';

// Home page test
test('home page loads successfully', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('body')).toBeVisible();
});

// Lecturer availability page test
test('lecturer availability page loads', async ({ page }) => {
  await page.goto('/lecturer/availability');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('body')).toBeVisible();
});

// Student booking page test
test('student booking page loads', async ({ page }) => {
  await page.goto('/student/booking');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('body')).toBeVisible();
});