import { expect, test } from '@playwright/test';
import { euros, loginAs, tid } from './helpers';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'alice');
  await tid(page, 'nav-products').click();
  await expect(tid(page, 'product-card')).toHaveCount(24);
});

test('search narrows the list', async ({ page }) => {
  const before = await tid(page, 'result-count').textContent();
  await tid(page, 'product-search').fill('espresso');
  await expect(tid(page, 'result-count')).not.toHaveText(before ?? '');
  await expect(tid(page, 'product-name').first()).toContainText(/espresso/i);
});

test('category filter only shows that category', async ({ page }) => {
  await tid(page, 'category-chip').filter({ hasText: 'Kitchen' }).click();
  await expect(tid(page, 'result-count')).toHaveText(/^4\d\d results$/);
  const cards = tid(page, 'product-card');
  await expect(cards.first()).toContainText('Kitchen');
  for (const text of await cards.allTextContents()) expect(text).toContain('Kitchen');
});

test('sorting by price ascending orders the cards', async ({ page }) => {
  await tid(page, 'sort-price-asc').click();
  await expect(tid(page, 'sort-price-asc')).toHaveAttribute('aria-pressed', 'true');
  await expect(tid(page, 'product-price').first()).toHaveText(/^€1?\d$/);
  const prices = (await tid(page, 'product-price').allTextContents()).map(euros);
  expect(prices).toEqual([...prices].sort((a, b) => a - b));
});

test('pagination moves through results', async ({ page }) => {
  const first = await tid(page, 'product-card').first().getAttribute('data-product-id');
  await tid(page, 'page-next').click();
  await expect(tid(page, 'page-indicator')).toContainText('Page 2');
  await expect(tid(page, 'product-card').first()).not.toHaveAttribute('data-product-id', first ?? '');
});

test('product detail shows images, pricing, reviews and related products', async ({ page }) => {
  await tid(page, 'product-card').first().click();
  await expect(tid(page, 'product-title')).toBeVisible();
  await expect(tid(page, 'product-live-price')).toContainText('€');
  await expect(tid(page, 'product-stock')).toContainText(/available|out of stock/i);
  await expect(tid(page, 'product-gallery').locator('img').first()).toBeVisible();
  await expect(tid(page, 'review').first()).toBeVisible();
  await expect(tid(page, 'related-item')).toHaveCount(8);
  const title = await tid(page, 'product-title').textContent();
  await tid(page, 'related-item').first().click();
  await expect(tid(page, 'product-title')).not.toHaveText(title ?? '');
});
