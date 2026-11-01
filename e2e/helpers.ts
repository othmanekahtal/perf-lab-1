import { expect, type Locator, type Page } from '@playwright/test';

export const USERS = {
  alice: { name: 'Alice Martin', role: 'admin' },
  bob: { name: 'Bob Chen', role: 'staff' },
} as const;

/** A test id, visible instances only: routes kept alive in the background may leave hidden copies in the DOM. */
export function tid(page: Page, id: string): Locator {
  return page.getByTestId(id).filter({ visible: true });
}

export async function loginAs(page: Page, username: keyof typeof USERS) {
  await page.goto('/login');
  await tid(page, 'login-username').fill(username);
  await tid(page, 'login-password').fill('password');
  await tid(page, 'login-submit').click();
  await expect(tid(page, 'current-user')).toHaveText(USERS[username].name);
}

export function euros(text: string) {
  return Number(text.replace(/[^0-9.,-]/g, '').replace(/,/g, ''));
}
