import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 px-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 text-xl font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white"><i className="mdi mdi-shopping" /></span>
          Shoply Admin
        </div>
        <div className="card p-6">
          <h1 className="mb-1 text-lg font-semibold">Sign in</h1>
          <p className="muted mb-5 text-sm">Use <b>alice</b> or <b>bob</b> with the password <b>password</b>.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
