import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { listOrders } from '@/lib/data';
import { dateTime, money } from '@/lib/format';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Orders' };

type Props = { searchParams: Promise<{ status?: string; q?: string; page?: string }> };

export default async function OrdersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = ORDER_STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined;
  const q = sp.q?.trim() || undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, pages } = listOrders({ status, q, page });

  const href = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status, q, page, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== '' && !(k === 'page' && v === 1)) params.set(k, String(v));
    const s = params.toString();
    return s ? `/orders?${s}` : '/orders';
  };

  return (
    <div className="space-y-4" data-testid="orders-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="muted text-sm" data-testid="orders-total">{total.toLocaleString('en-IE')} orders</p>
        </div>
        <form className="flex gap-2" action="/orders">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Order #, customer, email" className="input" aria-label="Search orders" data-testid="orders-search" />
          <button className="btn-ghost" type="submit">Search</button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2" data-testid="status-tabs">
        <Link href={href({ status: undefined, page: 1 })} className={`chip ${!status ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>All</Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={href({ status: s, page: 1 })} className={`chip capitalize ${status === s ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`} data-testid={`status-tab-${s}`}>
            {s}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm" data-testid="orders-table">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Channel</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 dark:border-slate-800" data-testid="order-row" data-order-id={o.id}>
                <td className="px-4 py-2">
                  <Link href={`/orders/${o.id}`} className="font-medium text-brand-700 dark:text-brand-100" data-testid="order-link">{o.number}</Link>
                  <div className="muted text-xs">{dateTime(o.created_at)}</div>
                </td>
                <td className="px-4 py-2">
                  <div>{o.customer_name}</div>
                  <div className="muted text-xs">{o.customer_orders} orders · {money(o.customer_lifetime_cents)} lifetime</div>
                </td>
                <td className="px-4 py-2 capitalize">{o.channel}</td>
                <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-2 text-right tabular-nums">{money(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
        {page > 1 && <Link className="btn-ghost" href={href({ page: page - 1 })} data-testid="orders-prev">Prev</Link>}
        <span className="tabular-nums" data-testid="orders-page-indicator">Page {page} of {pages}</span>
        {page < pages && <Link className="btn-ghost" href={href({ page: page + 1 })} data-testid="orders-next">Next</Link>}
      </nav>
    </div>
  );
}
