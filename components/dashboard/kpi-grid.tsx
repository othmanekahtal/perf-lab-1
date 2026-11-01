import type { Kpis } from '@/lib/data';
import { money } from '@/lib/format';
import { getFxRates } from '@/lib/upstream';
import { Icon, type IconName } from '@/components/icon';

type Card = { id: string; label: string; icon: IconName; valueCents?: number; value?: string; prev?: number; cur?: number; restricted?: boolean };

/** Shared KPI view; the only personal input is whether revenue may be shown. */
export async function KpiGrid({ kpis, canSeeRevenue }: { kpis: Kpis; canSeeRevenue: boolean }) {
  const cards: Card[] = [
    { id: 'revenue', label: 'Revenue', icon: 'cash-multiple', valueCents: kpis.revenueCents, cur: kpis.revenueCents, prev: kpis.revenuePrevCents, restricted: !canSeeRevenue },
    { id: 'orders', label: 'Orders', icon: 'cart-outline', value: kpis.orders.toLocaleString('en-IE'), cur: kpis.orders, prev: kpis.ordersPrev },
    { id: 'aov', label: 'Avg. order value', icon: 'scale-balance', valueCents: kpis.aovCents, restricted: !canSeeRevenue },
    { id: 'refunds', label: 'Refund rate', icon: 'cash-refund', value: `${(kpis.refundRate * 100).toFixed(1)}%` },
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
    <div className="panel kpi-card p-3 sm:p-4" data-testid={`kpi-${card.id}`}>
      <div className="flex items-center justify-between">
        <span className="muted text-xs font-medium tracking-wide uppercase">{card.label}</span>
        <Icon name={card.icon} className="text-lg text-brand-500" />
      </div>
      {card.restricted ? (
        <div className="mt-2 text-sm font-medium text-slate-400" data-testid="kpi-restricted">
          <Icon name="lock-outline" /> Restricted
        </div>
      ) : (
        <>
          <div className="mt-2 text-xl font-bold tabular-nums sm:text-2xl" data-testid="kpi-value">
            {card.valueCents !== undefined ? money(card.valueCents) : card.value}
          </div>
          {card.valueCents !== undefined && (
            <div className="muted text-xs tabular-nums">≈ {money(card.valueCents * fx.rates.USD, 'USD', 'en-US')}</div>
          )}
        </>
      )}
      {delta !== null && !card.restricted && (
        <div className={`mt-1 text-xs font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          <Icon name={delta >= 0 ? 'trending-up' : 'trending-down'} /> {(delta * 100).toFixed(1)}% <span className="font-normal text-slate-500">vs prev.</span>
        </div>
      )}
    </div>
  );
}
