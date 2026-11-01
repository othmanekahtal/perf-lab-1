import { expect, type Page } from '@playwright/test';

export const USERS = {
  alice: { name: 'Alice Martin', role: 'admin' },
  bob: { name: 'Bob Chen', role: 'staff' },
} as const;

export async function loginAs(page: Page, username: keyof typeof USERS) {
  await page.goto('/login');
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill('password');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('current-user')).toHaveText(USERS[username].name);
}

export function euros(text: string) {
  return Number(text.replace(/[^0-9.,-]/g, '').replace(/,/g, ''));
}
