import type { OrderStatus } from '@/lib/types';

const STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-sky-100 text-sky-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-700',
  refunded: 'bg-rose-100 text-rose-800',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`chip border-transparent capitalize ${STYLES[status]}`} data-testid="order-status">
      {status}
    </span>
  );
}
