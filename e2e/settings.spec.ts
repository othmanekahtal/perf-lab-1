import { expect, test } from '@playwright/test';
import { loginAs, tid } from './helpers';

test('settings shows the profile and switches theme', async ({ page }) => {
  await loginAs(page, 'bob');
  await tid(page, 'nav-settings').click();
  await expect(tid(page, 'settings-name')).toHaveValue('Bob Chen');
  await expect(tid(page, 'settings-permissions')).toContainText('revenue');
  await tid(page, 'theme-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await tid(page, 'theme-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
