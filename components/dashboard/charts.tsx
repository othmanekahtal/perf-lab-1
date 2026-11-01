'use client';

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Campaign, Forecast, Order } from '@/lib/types';
import { useEqualHeights } from './use-equal-heights';
import { Icon } from '@/components/icon';

const PALETTE = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#64748b'];
const eur = (cents: number) => `€${Math.round(cents / 100_000)}k`;

export function DashboardCharts({ orders, forecast, campaigns }: { orders: Order[]; forecast: Forecast; campaigns: Campaign[] }) {
  const [mounted, setMounted] = useState(false);
  const [density, setDensity] = useState(1);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onResize = () => setDensity(Math.max(1, Math.round(orders.length / window.innerWidth / 10)));
    onResize();
    // PERF-BUG #13: listener never removed, its closure keeps `orders` (8,400 rows) alive after every visit. Affects S9.
    window.addEventListener('resize', onResize);
  }, [orders]);
  useEqualHeights('.kpi-card, .chart-card');

  const revenue = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const o of orders) {
      if (o.status === 'cancelled' || o.status === 'refunded') continue;
      const day = o.created_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + o.total_cents);
    }
    const days = [...byDay.keys()].sort();
    const history = days.map((d) => ({ day: d.slice(5), revenue: byDay.get(d)!, forecast: null as number | null }));
    const future = forecast.points.map((p) => {
      const d = new Date(Date.UTC(2026, 10, p.day));
      return { day: d.toISOString().slice(5, 10), revenue: null as number | null, forecast: p.revenueCents };
    });
    return [...history, ...future].filter((_, i) => i % density === 0);
  }, [orders, forecast, density]);

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + (JSON.parse(o.items) as unknown[]).length;
    return Object.entries(counts).map(([status, items]) => ({ status, items }));
  }, [orders]);

  // PERF-BUG #5: charts render only on the client after mount (no reserved space), and aggregate thousands of raw rows in the browser. Affects S4, S13.
  if (!mounted) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-testid="charts">
      <section className="panel chart-card p-4 lg:col-span-3" data-testid="chart-revenue">
        <h2 className="panel-title mb-2">Revenue · last 30 days and 30-day forecast</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={revenue} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tickFormatter={eur} tick={{ fontSize: 11 }} width={48} />
            <Tooltip formatter={(v) => eur(Number(v))} />
            {campaigns.map((c) => (
              <ReferenceArea key={c.id} x1={c.start.slice(5)} x2={c.end.slice(5)} fill="#7c3aed" fillOpacity={0.06} />
            ))}
            <Area type="monotone" dataKey="revenue" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.15} isAnimationActive={false} />
            <Area type="monotone" dataKey="forecast" stroke="#0ea5e9" strokeDasharray="4 4" fill="#0ea5e9" fillOpacity={0.08} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </section>
      <section className="panel chart-card p-4" data-testid="chart-status">
        <h2 className="panel-title mb-2">Items by order status</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byStatus}>
            <XAxis dataKey="status" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={40} />
            <Tooltip />
            <Bar dataKey="items" fill="#7c3aed" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </section>
      <ChannelMix />
      <CampaignList campaigns={campaigns} />
    </div>
  );
}

function ChannelMix() {
  const [data, setData] = useState<{ channel: string; revenueCents: number }[]>([]);
  useEffect(() => {
    fetch('/api/sales/channels').then((r) => r.json()).then((d: { channels: { channel: string; revenueCents: number }[] }) => setData(d.channels));
  }, []);
  return (
    <section className="panel chart-card p-4" data-testid="chart-channels">
      <h2 className="panel-title mb-2">Revenue by channel · 30 days</h2>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="revenueCents" nameKey="channel" innerRadius={50} outerRadius={80} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={d.channel} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => eur(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-2 flex flex-wrap gap-3 text-xs">
        {data.map((d, i) => (
          <li key={d.channel} className="flex items-center gap-1 capitalize">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /> {d.channel}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <section className="panel chart-card p-4" data-testid="campaigns">
      <h2 className="panel-title mb-2">Campaigns</h2>
      <ul className="space-y-2 text-sm">
        {campaigns.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span><Icon name="bullhorn-outline" className="me-1 text-brand-500" />{c.name}</span>
            <span className="muted text-xs">{c.start.slice(5)} → {c.end.slice(5)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
