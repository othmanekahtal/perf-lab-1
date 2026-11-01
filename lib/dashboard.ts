import 'server-only';
import { getActivity, getKpis, getOrdersSince, getProductsByIds, getRecentOrders } from './data';
import { requireUser } from './session';
import { getCampaigns, getForecast, getFxRates, getInventory, getPricing, getRecommendations } from './upstream';

export async function getDashboardData() {
  const user = await requireUser();
  const fx = await getFxRates();
  const kpis = getKpis();
  const forecast = await getForecast(30);
  const campaigns = await getCampaigns();
  const orders = getOrdersSince(30);

  const recent = [];
  for (const order of getRecentOrders(8)) {
    const inventory = await getInventory(order.product_id);
    recent.push({ ...order, inventory });
  }

  const recs = await getRecommendations(user.username);
  const recProducts = getProductsByIds(recs.items.map((i) => i.productId));
  const recommended = [];
  for (const product of recProducts) {
    const pricing = await getPricing(product.id);
    recommended.push({ ...product, pricing });
  }

  return { user, fx, kpis, forecast, campaigns, orders, recent, recommended, activity: getActivity(1500) };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
