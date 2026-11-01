import type { Kpis } from '@/lib/data';
import { money } from '@/lib/format';
import { requireUser } from '@/lib/session';
import { getFxRates } from '@/lib/upstream';

type Card = { id: string; label: string; icon: string; valueCents?: number; value?: string; prev?: number; cur?: number; restricted?: boolean };

export async function KpiGrid({ kpis }: { kpis: Kpis }) {
  const user = await requireUser();
  const cards: Card[] = [
    { id: 'revenue', label: 'Revenue', icon: 'mdi-cash-multiple', valueCents: kpis.revenueCents, cur: kpis.revenueCents, prev: kpis.revenuePrevCents, restricted: !user.permissions.revenue },
    { id: 'orders', label: 'Orders', icon: 'mdi-cart-outline', value: kpis.orders.toLocaleString('en-IE'), cur: kpis.orders, prev: kpis.ordersPrev },
    { id: 'aov', label: 'Avg. order value', icon: 'mdi-scale-balance', valueCents: kpis.aovCents, restricted: !user.permissions.revenue },
    { id: 'refunds', label: 'Refund rate', icon: 'mdi-cash-refund', value: `${(kpis.refundRate * 100).toFixed(1)}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="kpis">
      {cards.map((c) => (
        <KpiCard key={c.id} card={c} />
      ))}
    </div>
  );
}

async function KpiCard({ card }: { card: Card }) {
  const fx = await getFxRates();
  const delta = card.cur !== undefined && card.prev ? (card.cur - card.prev) / card.prev : null;
  return (
    <div className="card kpi-card p-4" data-testid={`kpi-${card.id}`}>
      <div className="flex items-center justify-between">
        <span className="muted text-xs font-medium tracking-wide uppercase">{card.label}</span>
        <i className={`mdi ${card.icon} text-lg text-brand-500`} />
      </div>
      {card.restricted ? (
        <div className="mt-2 text-sm font-medium text-slate-400" data-testid="kpi-restricted">
          <i className="mdi mdi-lock-outline" /> Restricted
        </div>
      ) : (
        <>
          <div className="mt-2 text-2xl font-bold tabular-nums" data-testid="kpi-value">
            {card.valueCents !== undefined ? money(card.valueCents) : card.value}
          </div>
          {card.valueCents !== undefined && (
            <div className="muted text-xs tabular-nums">≈ {money(card.valueCents * fx.rates.USD, 'USD', 'en-US')}</div>
          )}
        </>
      )}
      {delta !== null && !card.restricted && (
        <div className={`mt-1 text-xs font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          <i className={`mdi ${delta >= 0 ? 'mdi-trending-up' : 'mdi-trending-down'}`} /> {(delta * 100).toFixed(1)}% vs previous 30 days
        </div>
      )}
    </div>
  );
}
