import { Suspense } from 'react';
import { logout } from '@/app/actions/auth';
import { requireUser } from '@/lib/session';
import { Icon } from '@/components/icon';

export function Topbar() {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="relative hidden flex-1 md:block">
        <Icon name="magnify" className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input placeholder="Search orders, products, customers…" className="input max-w-md ps-9" aria-label="Global search" />
      </div>
      <Suspense fallback={<div className="ms-auto h-9 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />}>
        <UserMenu />
      </Suspense>
    </header>
  );
}

/** The only personal part of the shell. */
async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="ms-auto flex items-center gap-3">
      <span className="hidden text-xs text-slate-500 sm:inline">{user.region}</span>
      <span className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white" style={{ background: user.avatar_color }}>
        {user.name[0]}
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold" data-testid="current-user">{user.name}</div>
        <div className="text-xs capitalize text-slate-500" data-testid="current-role">{user.role}</div>
      </div>
      <form action={logout}>
        <button className="btn-ghost px-2 py-1" title="Sign out" data-testid="logout"><Icon name="logout" /></button>
      </form>
    </div>
  );
}
