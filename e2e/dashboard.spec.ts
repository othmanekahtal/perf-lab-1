import { expect, test } from '@playwright/test';
import { loginAs, tid } from './helpers';

test('dashboard shows KPIs, charts, recommendations, recent orders and activity', async ({ page }) => {
  await loginAs(page, 'alice');
  await expect(tid(page, 'greeting')).toContainText('Alice');
  await expect(tid(page, 'kpis').getByTestId('kpi-value')).toHaveCount(4);
  await expect(tid(page, 'kpi-revenue')).toContainText('€');
  await expect(tid(page, 'chart-revenue').locator('svg.recharts-surface, svg').first()).toBeVisible();
  await expect(tid(page, 'chart-status')).toBeVisible();
  await expect(tid(page, 'chart-channels')).toContainText(/web/i);
  await expect(tid(page, 'recommended-item')).toHaveCount(6);
  await expect(tid(page, 'recent-order-row')).toHaveCount(8);
  await expect(tid(page, 'activity')).toContainText('placed');
  await expect(tid(page, 'live-visitors')).toContainText(/\d+ visitors/);
});

test('staff users cannot see revenue figures', async ({ page }) => {
  await loginAs(page, 'bob');
  await expect(tid(page, 'greeting')).toContainText('Bob');
  await expect(tid(page, 'kpi-revenue')).toContainText(/restricted/i);
  await expect(tid(page, 'kpi-aov')).toContainText(/restricted/i);
  await expect(tid(page, 'kpi-orders').getByTestId('kpi-value')).toBeVisible();
});

test('recommendations are personal', async ({ browser }) => {
  const ids: Record<string, string[]> = {};
  for (const user of ['alice', 'bob'] as const) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginAs(page, user);
    await expect(tid(page, 'recommended-item')).toHaveCount(6);
    ids[user] = await tid(page, 'recommended-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-product-id') ?? ''));
    await ctx.close();
  }
  expect(ids.alice).not.toEqual(ids.bob);
});
