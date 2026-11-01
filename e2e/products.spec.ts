import { expect, test } from '@playwright/test';
import { euros, loginAs } from './helpers';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'alice');
  await page.getByTestId('nav-products').click();
  await expect(page.getByTestId('product-card')).toHaveCount(24);
});

test('search narrows the list', async ({ page }) => {
  const before = await page.getByTestId('result-count').textContent();
  await page.getByTestId('product-search').fill('espresso');
  await expect(page.getByTestId('result-count')).not.toHaveText(before ?? '');
  await expect(page.getByTestId('product-name').first()).toContainText(/espresso/i);
});

test('category filter only shows that category', async ({ page }) => {
  await page.getByTestId('category-chip').filter({ hasText: 'Kitchen' }).click();
  await expect(page.getByTestId('result-count')).toHaveText(/^4\d\d results$/);
  const cards = page.getByTestId('product-card');
  await expect(cards.first()).toContainText('Kitchen');
  for (const text of await cards.allTextContents()) expect(text).toContain('Kitchen');
});

test('sorting by price ascending orders the cards', async ({ page }) => {
  await page.getByTestId('sort-price-asc').click();
  await expect(page.getByTestId('sort-price-asc')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('product-price').first()).toHaveText(/^€1?\d$/);
  const prices = (await page.getByTestId('product-price').allTextContents()).map(euros);
  expect(prices).toEqual([...prices].sort((a, b) => a - b));
});

test('pagination moves through results', async ({ page }) => {
  const first = await page.getByTestId('product-card').first().getAttribute('data-product-id');
  await page.getByTestId('page-next').click();
  await expect(page.getByTestId('page-indicator')).toContainText('Page 2');
  await expect(page.getByTestId('product-card').first()).not.toHaveAttribute('data-product-id', first ?? '');
});

test('product detail shows images, pricing, reviews and related products', async ({ page }) => {
  await page.getByTestId('product-card').first().click();
  await expect(page.getByTestId('product-title')).toBeVisible();
  await expect(page.getByTestId('product-live-price')).toContainText('€');
  await expect(page.getByTestId('product-stock')).toContainText(/available|out of stock/i);
  await expect(page.getByTestId('product-gallery').locator('img').first()).toBeVisible();
  await expect(page.getByTestId('review').first()).toBeVisible();
  await expect(page.getByTestId('related-item')).toHaveCount(8);
  const title = await page.getByTestId('product-title').textContent();
  await page.getByTestId('related-item').first().click();
  await expect(page.getByTestId('product-title')).not.toHaveText(title ?? '');
});
