'use client';

import { useActionState, useState } from 'react';
import { updateOrder, type SaveState } from '@/app/actions/orders';
import { StatusBadge } from '@/components/status-badge';
import { dateTime, money } from '@/lib/format';
import { ORDER_STATUSES, type Order, type OrderItem } from '@/lib/types';

type Props = { order: Order; items: OrderItem[]; products: { id: number; name: string; sku: string }[] };

export function OrderEditor({ order, items, products }: Props) {
  const [state, action, pending] = useActionState<SaveState, FormData>(updateOrder, {});
  const [qty, setQty] = useState(items.map((i) => i.qty));
  const total = items.reduce((sum, item, i) => sum + item.unitPriceCents * (qty[i] ?? 0), 0);

  return (
    <form action={action} className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-testid="order-editor">
      <input type="hidden" name="id" value={order.id} />
      <div className="space-y-4 lg:col-span-2">
        <div className="panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-bold" data-testid="order-number">{order.number}</h1>
            <StatusBadge status={order.status} />
          </div>
          <div className="muted text-sm">Placed {dateTime(order.created_at)} via {order.channel} · last updated {dateTime(order.updated_at)}</div>
        </div>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/50">
              <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Unit</th><th className="px-4 py-2">Qty</th><th className="px-4 py-2 text-right">Line</th></tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const p = products.find((x) => x.id === item.productId);
                return (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2"><div className="font-medium">{p?.name}</div><div className="muted text-xs">{p?.sku}</div></td>
                    <td className="px-4 py-2 tabular-nums">{money(item.unitPriceCents)}</td>
                    <td className="px-4 py-2">
                      <input
                        name={`qty_${i}`} type="number" min={0} max={99} value={qty[i]} className="input w-20"
                        onChange={(e) => setQty(qty.map((q, j) => (j === i ? Number(e.target.value) : q)))}
                        data-testid={`qty-${i}`} aria-label={`Quantity for ${p?.name}`}
                      />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(item.unitPriceCents * (qty[i] ?? 0))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold dark:border-slate-700">
                <td className="px-4 py-2" colSpan={3}>Total</td>
                <td className="px-4 py-2 text-right tabular-nums" data-testid="order-total">{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div className="space-y-4">
        <div className="panel space-y-3 p-4">
          <h2 className="panel-title">Fulfilment</h2>
          <label className="block text-sm font-medium">
            Status
            <select name="status" defaultValue={order.status} className="input mt-1 capitalize" data-testid="order-status-select">
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Shipping address
            <textarea name="shipping_address" defaultValue={order.shipping_address} rows={2} className="input mt-1" data-testid="order-shipping" />
          </label>
          <label className="block text-sm font-medium">
            Internal notes
            <textarea name="notes" defaultValue={order.notes} rows={3} className="input mt-1" data-testid="order-notes" />
          </label>
          <div className="text-sm">
            <div className="font-medium">{order.customer_name}</div>
            <div className="muted">{order.customer_email} · {order.customer_phone}</div>
          </div>
          {state.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
          {state.ok && <p className="text-sm text-emerald-600" role="status" data-testid="order-saved">Saved</p>}
          <button type="submit" disabled={pending} className="btn-primary-sh w-full justify-center" data-testid="order-save">
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
