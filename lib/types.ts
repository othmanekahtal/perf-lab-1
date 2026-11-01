export type Permissions = { revenue: boolean; refunds: boolean; exports: boolean; settings: boolean };

export type User = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  permissions: Permissions;
  avatar_color: string;
  region: string;
  theme: 'light' | 'dark';
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  slug: string;
  category: string;
  brand: string;
  description: string;
  specs: string;
  tags: string;
  price_cents: number;
  cost_cents: number;
  stock: number;
  reorder_level: number;
  image: number;
  images: string;
  rating: number;
  review_count: number;
  weight_g: number;
  dimensions: string;
  seo_title: string;
  seo_description: string;
  created_at: string;
  updated_at: string;
};

export type OrderItem = { productId: number; qty: number; unitPriceCents: number };

export type Order = {
  id: number;
  number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  billing_address: string;
  status: OrderStatus;
  channel: string;
  currency: string;
  total_cents: number;
  items: string;
  product_id: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Review = {
  id: number;
  product_id: number;
  author: string;
  rating: number;
  title: string;
  body: string;
  helpful: number;
  verified: number;
  created_at: string;
};

export type Pricing = { productId: number; discountPct: number; competitorDeltaPct: number; currency: string; validUntil: string };
export type Inventory = { productId: number; available: number; reserved: number; warehouse: string; restockEta: string | null };
export type FxRates = { base: string; rates: Record<string, number>; asOf: string };
export type Forecast = { model: string; horizonDays: number; points: { day: number; revenueCents: number; low: number; high: number }[] };
export type Campaign = { id: string; name: string; start: string; end: string };
export type Recommendations = { user: string; model: string; items: { productId: number; score: number }[] };
