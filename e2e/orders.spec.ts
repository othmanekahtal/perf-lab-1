import { expect, test } from '@playwright/test';
import { loginAs, tid } from './helpers';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'alice');
});

test('orders list filters by status and paginates', async ({ page }) => {
  await tid(page, 'nav-orders').click();
  await expect(tid(page, 'order-row')).toHaveCount(25);
  await tid(page, 'status-tab-refunded').click();
  await expect(page).toHaveURL(/status=refunded/);
  for (const s of await tid(page, 'order-row').getByTestId('order-status').allTextContents()) expect(s).toBe('refunded');
  await tid(page, 'orders-next').click();
  await expect(tid(page, 'orders-page-indicator')).toContainText('Page 2');
});

test('orders can be searched by number', async ({ page }) => {
  await page.goto('/orders');
  await tid(page, 'orders-search').fill('SH-142424');
  await tid(page, 'orders-search').press('Enter');
  await expect(tid(page, 'order-row')).toHaveCount(1);
  await expect(tid(page, 'order-row')).toContainText('SH-142424');
});

test('editing an order persists and shows up everywhere', async ({ page }) => {
  await page.goto('/orders/12345');
  await expect(tid(page, 'order-number')).toHaveText('SH-112345');
  const note = `e2e note ${Date.now()}`;
  await tid(page, 'order-status-select').selectOption('shipped');
  await tid(page, 'order-notes').fill(note);
  await tid(page, 'qty-0').fill('2');
  await tid(page, 'order-save').click();
  await expect(tid(page, 'order-saved')).toBeVisible();

  await page.reload();
  await expect(tid(page, 'order-notes')).toHaveValue(note);
  await expect(tid(page, 'order-status-select')).toHaveValue('shipped');
  await expect(tid(page, 'qty-0')).toHaveValue('2');

  await page.goto('/orders?q=SH-112345');
  await expect(tid(page, 'order-row').getByTestId('order-status')).toHaveText('shipped');
});

test('invalid edits are rejected', async ({ page }) => {
  await page.goto('/orders/12346');
  await tid(page, 'order-shipping').fill('x');
  await tid(page, 'order-save').click();
  await expect(page.getByRole('alert').filter({ hasText: /too short/i })).toBeVisible();
});
