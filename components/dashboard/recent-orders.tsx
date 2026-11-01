import Link from 'next/link';
import { dateTime, money } from '@/lib/format';
import type { Inventory, Order } from '@/lib/types';
import { StatusBadge } from '@/components/status-badge';

export function RecentOrders({ orders }: { orders: (Order & { inventory: Inventory })[] }) {
  return (
    <section className="panel overflow-hidden" data-testid="recent-orders">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="panel-title">Recent orders</h2>
        <Link href="/orders" className="text-sm font-medium text-brand-600">View all</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Stock</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-slate-100 dark:border-slate-800" data-testid="recent-order-row" data-order-id={o.id}>
                <td className="px-4 py-2">
                  <Link href={`/orders/${o.id}`} className="font-medium text-brand-700 dark:text-brand-100">{o.number}</Link>
                  <div className="muted text-xs">{dateTime(o.created_at)}</div>
                </td>
                <td className="px-4 py-2">{o.customer_name}</td>
                <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                <td className="px-4 py-2 text-xs">
                  {o.inventory.available > 0 ? `${o.inventory.available} in ${o.inventory.warehouse}` : <span className="text-red-600">Out · ETA {o.inventory.restockEta}</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{money(o.total_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
