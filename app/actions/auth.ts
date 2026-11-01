'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { encodeSession, findUser, SESSION_COOKIE } from '@/lib/session';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const user = findUser(username);
  if (!user || password !== 'password') return { error: 'Invalid username or password' };
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(user.username), { httpOnly: true, sameSite: 'lax', path: '/' });
  jar.set('theme', user.theme, { sameSite: 'lax', path: '/' });
  redirect('/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
