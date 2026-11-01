import type { Metadata } from 'next';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { DashboardCharts } from '@/components/dashboard/charts';
import { KpiGrid } from '@/components/dashboard/kpi-grid';
import { LiveVisitors } from '@/components/dashboard/live-visitors';
import { RecentOrders } from '@/components/dashboard/recent-orders';
import { Recommended } from '@/components/dashboard/recommended';
import { getDashboardData } from '@/lib/dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const data = await getDashboardData();
  const hour = 9;
  return (
    <div className="space-y-6" data-testid="dashboard">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="greeting">
            {hour < 12 ? 'Good morning' : 'Hello'}, {data.user.name.split(' ')[0]}
          </h1>
          <p className="muted text-sm">Here is what happened in your store over the last 30 days.</p>
        </div>
        <LiveVisitors />
      </div>
      <KpiGrid kpis={data.kpis} />
      <DashboardCharts orders={data.orders} forecast={data.forecast} campaigns={data.campaigns} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentOrders orders={data.recent} />
        </div>
        <Recommended products={data.recommended} user={data.user.name} />
      </div>
      <ActivityFeed items={data.activity} />
    </div>
  );
}
