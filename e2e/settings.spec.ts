import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test('settings shows the profile and switches theme', async ({ page }) => {
  await loginAs(page, 'bob');
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('settings-name')).toHaveValue('Bob Chen');
  await expect(page.getByTestId('settings-permissions')).toContainText('revenue');
  await page.getByTestId('theme-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
