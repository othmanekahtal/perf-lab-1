'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Campaign } from '@/lib/types';

const PALETTE = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#64748b'];
const eur = (cents: number) => `€${Math.round(cents / 100_000)}k`;

export type ChartsProps = {
  revenue: { day: string; revenue: number | null; forecast: number | null }[];
  itemsByStatus: { status: string; items: number }[];
  revenueByChannel: { channel: string; revenueCents: number }[];
  campaigns: Campaign[];
};

/** The chart panels; every box has a fixed height so nothing moves when the library loads. */
export default function DashboardCharts({ revenue, itemsByStatus, revenueByChannel, campaigns }: ChartsProps) {
  return (
    <>
      <section className="panel p-4 lg:col-span-3" data-testid="chart-revenue">
        <h2 className="panel-title mb-2">Revenue · last 30 days and 30-day forecast</h2>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
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
        </div>
      </section>
      <section className="panel p-4" data-testid="chart-status">
        <h2 className="panel-title mb-2">Items by order status</h2>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={itemsByStatus}>
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <Tooltip />
              <Bar dataKey="items" fill="#7c3aed" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel p-4" data-testid="chart-channels">
        <h2 className="panel-title mb-2">Revenue by channel · 30 days</h2>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={revenueByChannel} dataKey="revenueCents" nameKey="channel" innerRadius={50} outerRadius={80} isAnimationActive={false}>
                {revenueByChannel.map((d, i) => <Cell key={d.channel} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => eur(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 flex h-5 flex-wrap gap-3 overflow-hidden text-xs">
          {revenueByChannel.map((d, i) => (
            <li key={d.channel} className="flex items-center gap-1 capitalize">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /> {d.channel}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
