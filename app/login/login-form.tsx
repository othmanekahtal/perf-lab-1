'use client';

import { useActionState } from 'react';
import { login, type LoginState } from '@/app/actions/auth';

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium">
        Username
        <input name="username" autoComplete="username" required className="input mt-1" data-testid="login-username" />
      </label>
      <label className="block text-sm font-medium">
        Password
        <input name="password" type="password" autoComplete="current-password" required className="input mt-1" data-testid="login-password" />
      </label>
      {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary-sh w-full justify-center" data-testid="login-submit">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
