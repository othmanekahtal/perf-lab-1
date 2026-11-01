import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'alice');
});

test('orders list filters by status and paginates', async ({ page }) => {
  await page.getByTestId('nav-orders').click();
  await expect(page.getByTestId('order-row')).toHaveCount(25);
  await page.getByTestId('status-tab-refunded').click();
  await expect(page).toHaveURL(/status=refunded/);
  for (const s of await page.getByTestId('order-row').getByTestId('order-status').allTextContents()) expect(s).toBe('refunded');
  await page.getByTestId('orders-next').click();
  await expect(page.getByTestId('orders-page-indicator')).toContainText('Page 2');
});

test('orders can be searched by number', async ({ page }) => {
  await page.goto('/orders');
  await page.getByTestId('orders-search').fill('SH-142424');
  await page.getByTestId('orders-search').press('Enter');
  await expect(page.getByTestId('order-row')).toHaveCount(1);
  await expect(page.getByTestId('order-row')).toContainText('SH-142424');
});

test('editing an order persists and shows up everywhere', async ({ page }) => {
  await page.goto('/orders/12345');
  await expect(page.getByTestId('order-number')).toHaveText('SH-112345');
  const note = `e2e note ${Date.now()}`;
  await page.getByTestId('order-status-select').selectOption('shipped');
  await page.getByTestId('order-notes').fill(note);
  await page.getByTestId('qty-0').fill('2');
  await page.getByTestId('order-save').click();
  await expect(page.getByTestId('order-saved')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('order-notes')).toHaveValue(note);
  await expect(page.getByTestId('order-status-select')).toHaveValue('shipped');
  await expect(page.getByTestId('qty-0')).toHaveValue('2');

  await page.goto('/orders?q=SH-112345');
  await expect(page.getByTestId('order-row').getByTestId('order-status')).toHaveText('shipped');
});

test('invalid edits are rejected', async ({ page }) => {
  await page.goto('/orders/12346');
  await page.getByTestId('order-shipping').fill('x');
  await page.getByTestId('order-save').click();
  await expect(page.getByRole('alert').filter({ hasText: /too short/i })).toBeVisible();
});
