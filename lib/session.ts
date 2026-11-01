import 'server-only';
import { cookies } from 'next/headers';
import { db } from './db';
import type { User } from './types';

export const SESSION_COOKIE = 'shoply_session';

export function encodeSession(username: string) {
  return Buffer.from(JSON.stringify({ u: username, v: 1 })).toString('base64url');
}

export function decodeSession(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { u?: unknown };
    return typeof parsed.u === 'string' ? parsed.u : null;
  } catch {
    return null;
  }
}

type UserRow = Omit<User, 'permissions'> & { permissions: string };

export function findUser(username: string): User | null {
  const row = db().prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  return row ? { ...row, permissions: JSON.parse(row.permissions) } : null;
}

/** The signed-in user, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const username = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  return username ? findUser(username) : null;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not signed in');
  return user;
}
