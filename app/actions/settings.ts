'use server';

import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function setTheme(theme: 'light' | 'dark') {
  const user = await requireUser();
  db().prepare('UPDATE users SET theme = ? WHERE id = ?').run(theme, user.id);
  (await cookies()).set('theme', theme, { sameSite: 'lax', path: '/' });
}
