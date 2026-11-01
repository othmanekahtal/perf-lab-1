import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';

test('dashboard shows KPIs, charts, recommendations, recent orders and activity', async ({ page }) => {
  await loginAs(page, 'alice');
  await expect(page.getByTestId('greeting')).toContainText('Alice');
  await expect(page.getByTestId('kpis').getByTestId('kpi-value')).toHaveCount(4);
  await expect(page.getByTestId('kpi-revenue')).toContainText('€');
  await expect(page.getByTestId('chart-revenue').locator('svg.recharts-surface, svg').first()).toBeVisible();
  await expect(page.getByTestId('chart-status')).toBeVisible();
  await expect(page.getByTestId('chart-channels')).toContainText(/web/i);
  await expect(page.getByTestId('recommended-item')).toHaveCount(6);
  await expect(page.getByTestId('recent-order-row')).toHaveCount(8);
  await expect(page.getByTestId('activity')).toContainText('placed');
  await expect(page.getByTestId('live-visitors')).toContainText(/\d+ visitors/);
});

test('staff users cannot see revenue figures', async ({ page }) => {
  await loginAs(page, 'bob');
  await expect(page.getByTestId('greeting')).toContainText('Bob');
  await expect(page.getByTestId('kpi-revenue')).toContainText(/restricted/i);
  await expect(page.getByTestId('kpi-aov')).toContainText(/restricted/i);
  await expect(page.getByTestId('kpi-orders').getByTestId('kpi-value')).toBeVisible();
});

test('recommendations are personal', async ({ browser }) => {
  const ids: Record<string, string[]> = {};
  for (const user of ['alice', 'bob'] as const) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, user);
    await expect(page.getByTestId('recommended-item')).toHaveCount(6);
    ids[user] = await page.getByTestId('recommended-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-product-id') ?? ''));
    await ctx.close();
  }
  expect(ids.alice).not.toEqual(ids.bob);
});
