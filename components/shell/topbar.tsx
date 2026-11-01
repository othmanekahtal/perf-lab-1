import { logout } from '@/app/actions/auth';
import { requireUser } from '@/lib/session';

export async function Topbar() {
  // PERF-BUG #7: personal data (name/role) read in the shared shell. Affects S1.
  const user = await requireUser();
  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8 dark:border-slate-800 dark:bg-slate-900/80">
      <div className="relative hidden flex-1 md:block">
        <i className="mdi mdi-magnify absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input placeholder="Search orders, products, customers…" className="input max-w-md ps-9" aria-label="Global search" />
      </div>
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
          <button className="btn-ghost px-2 py-1" title="Sign out" data-testid="logout"><i className="mdi mdi-logout" /></button>
        </form>
      </div>
    </header>
  );
}
