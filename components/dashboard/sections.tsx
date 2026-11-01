import { getActivity, getChartsData, getKpis, getRecentOrdersWithStock, getRecommendedProducts } from '@/lib/dashboard';
import { requireUser } from '@/lib/session';
import { ActivityFeed } from './activity-feed';
import { DashboardCharts } from './charts';
import { KpiGrid } from './kpi-grid';
import { RecentOrders } from './recent-orders';
import { Recommended } from './recommended';

export async function Greeting() {
  const user = await requireUser();
  return (
    <h1 className="text-2xl font-bold tracking-tight" data-testid="greeting">
      Good morning, {user.name.split(' ')[0]}
    </h1>
  );
}

export async function KpiSection() {
  const user = await requireUser();
  return <KpiGrid kpis={getKpis()} canSeeRevenue={user.permissions.revenue} />;
}

export async function ChartsSection() {
  const data = await getChartsData();
  return <DashboardCharts orders={data.orders} forecast={data.forecast} campaigns={data.campaigns} />;
}

export async function RecentOrdersSection() {
  return <RecentOrders orders={await getRecentOrdersWithStock(8)} />;
}

export async function RecommendedSection() {
  const user = await requireUser();
  return <Recommended products={await getRecommendedProducts(user.username)} user={user.name} />;
}

export async function ActivitySection() {
  return <ActivityFeed items={getActivity(1500)} />;
}
