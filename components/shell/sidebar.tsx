import Link from 'next/link';
import { getLowStock } from '@/lib/upstream';
import { NavLinks } from './nav-links';

export async function Sidebar() {
  // PERF-BUG #2: an uncached upstream call in the layout, on every navigation. Affects S1, S11.
  const lowStock = await getLowStock();
  return (
    <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 px-4 py-3 lg:py-5">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white"><i className="mdi mdi-shopping" /></span>
          Shoply
        </Link>
        <span className="badge text-bg-light ms-1 border">Admin</span>
      </div>
      <NavLinks lowStock={lowStock.count} />
    </aside>
  );
}
