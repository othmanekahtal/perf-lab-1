import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test('anonymous visitors are sent to the login page', async ({ page }) => {
  await page.goto('/products');
  await expect(page).toHaveURL(/\/login$/);
});

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-username').fill('alice');
  await page.getByTestId('login-password').fill('nope');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('alert').filter({ hasText: /invalid/i })).toBeVisible();
});

test('alice can sign in and out', async ({ page }) => {
  await loginAs(page, 'alice');
  await expect(page.getByTestId('current-role')).toHaveText(/admin/i);
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login$/);
});
