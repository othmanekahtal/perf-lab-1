// Catalogue of every metric the harness records.
// kind: "deterministic" metrics (bytes, counts, headers, heap) are stable across machines; "timing" metrics are not.
// floor: smallest change considered meaningful when comparing two measurements (absolute, in the metric's unit).

export type MetricDef = {
  label: string;
  unit: 'ms' | 'KB' | 'MB' | '' | 'req/s' | 'ratio' | 'count' | 'bool';
  scenario: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'build';
  better: 'lower' | 'higher';
  kind: 'timing' | 'deterministic';
  floor: number;
};

export const METRICS: Record<string, MetricDef> = {
  // A — cold dashboard
  ttfb: { label: 'TTFB (dashboard, cold)', unit: 'ms', scenario: 'A', better: 'lower', kind: 'timing', floor: 50 },
  fcp: { label: 'FCP (dashboard, cold)', unit: 'ms', scenario: 'A', better: 'lower', kind: 'timing', floor: 75 },
  lcp: { label: 'LCP (dashboard, cold)', unit: 'ms', scenario: 'A', better: 'lower', kind: 'timing', floor: 100 },
  cls: { label: 'CLS (dashboard load)', unit: '', scenario: 'A', better: 'lower', kind: 'timing', floor: 0.01 },
  tbt: { label: 'TBT (dashboard load)', unit: 'ms', scenario: 'A', better: 'lower', kind: 'timing', floor: 50 },
  longTasks: { label: 'Long tasks (load)', unit: 'count', scenario: 'A', better: 'lower', kind: 'timing', floor: 1 },
  longTasksOver200: { label: 'Long tasks > 200 ms (load)', unit: 'count', scenario: 'A', better: 'lower', kind: 'timing', floor: 1 },
  forcedReflows: { label: 'Forced reflows (load + scroll + resize)', unit: 'count', scenario: 'A', better: 'lower', kind: 'timing', floor: 5 },
  forcedReflowMs: { label: 'Forced reflow time', unit: 'ms', scenario: 'A', better: 'lower', kind: 'timing', floor: 10 },
  scrollBlockingMs: { label: 'Main-thread blocking while scrolling', unit: 'ms', scenario: 'A', better: 'lower', kind: 'timing', floor: 20 },
  idleLayoutsPerSec: { label: 'Layouts per second while idle', unit: '', scenario: 'A', better: 'lower', kind: 'timing', floor: 2 },
  layoutMs: { label: 'Total layout time (A)', unit: 'ms', scenario: 'A', better: 'lower', kind: 'timing', floor: 20 },
  htmlKB: { label: 'HTML transferred (dashboard)', unit: 'KB', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 2 },
  rscInlineKB: { label: 'RSC payload in HTML (dashboard)', unit: 'KB', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 2 },
  cssKB: { label: 'CSS transferred', unit: 'KB', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 1 },
  fontKB: { label: 'Fonts transferred', unit: 'KB', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 1 },
  renderBlockingCount: { label: 'Render-blocking resources', unit: 'count', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 0 },
  renderBlockingKB: { label: 'Render-blocking bytes', unit: 'KB', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 1 },
  jsInitialKB: { label: 'Initial JS (first party)', unit: 'KB', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 2 },
  jsAsyncKB: { label: 'Async JS (first party)', unit: 'KB', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 2 },
  thirdPartyKB: { label: 'Third-party bytes', unit: 'KB', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 2 },
  thirdPartyMainThreadMs: { label: 'Third-party main-thread time', unit: 'ms', scenario: 'A', better: 'lower', kind: 'timing', floor: 20 },
  firstPartyTextKB: { label: 'First-party HTML/JS/CSS/data transferred (cold)', unit: 'KB', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 5 },
  coldTransferKB: { label: 'Total transferred (cold dashboard)', unit: 'KB', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 10 },
  upstreamCallsCold: { label: 'Upstream calls per dashboard view (cold browser)', unit: 'count', scenario: 'A', better: 'lower', kind: 'deterministic', floor: 0 },
  staticCacheableRatio: { label: 'Static assets cacheable ≥ 1 day', unit: 'ratio', scenario: 'A', better: 'higher', kind: 'deterministic', floor: 0.01 },
  proxyMs: { label: 'Server-Timing proxy (document)', unit: 'ms', scenario: 'A', better: 'lower', kind: 'timing', floor: 1 },
  // B — warm repeat visit
  warmTtfb: { label: 'TTFB (warm visit)', unit: 'ms', scenario: 'B', better: 'lower', kind: 'timing', floor: 50 },
  warmFcp: { label: 'FCP (warm visit)', unit: 'ms', scenario: 'B', better: 'lower', kind: 'timing', floor: 75 },
  warmLcp: { label: 'LCP (warm visit)', unit: 'ms', scenario: 'B', better: 'lower', kind: 'timing', floor: 100 },
  warmTransferKB: { label: 'Transferred on warm visit', unit: 'KB', scenario: 'B', better: 'lower', kind: 'deterministic', floor: 5 },
  warmRequests: { label: 'Network requests on warm visit', unit: 'count', scenario: 'B', better: 'lower', kind: 'deterministic', floor: 1 },
  warmFromCache: { label: 'Responses from browser cache (warm)', unit: 'count', scenario: 'B', better: 'higher', kind: 'deterministic', floor: 1 },
  upstreamCallsWarm: { label: 'Upstream calls per dashboard view (warm)', unit: 'count', scenario: 'B', better: 'lower', kind: 'deterministic', floor: 0 },
  // C — soft navigations
  navProductsMs: { label: 'Soft nav dashboard → products', unit: 'ms', scenario: 'C', better: 'lower', kind: 'timing', floor: 75 },
  navDetailMs: { label: 'Soft nav products → detail', unit: 'ms', scenario: 'C', better: 'lower', kind: 'timing', floor: 75 },
  navBackMs: { label: 'Soft nav back to products', unit: 'ms', scenario: 'C', better: 'lower', kind: 'timing', floor: 50 },
  navTotalMs: { label: 'Soft nav total', unit: 'ms', scenario: 'C', better: 'lower', kind: 'timing', floor: 150 },
  rscNavProductsKB: { label: 'RSC transferred (nav to products)', unit: 'KB', scenario: 'C', better: 'lower', kind: 'deterministic', floor: 2 },
  rscNavDetailKB: { label: 'RSC transferred (nav to detail)', unit: 'KB', scenario: 'C', better: 'lower', kind: 'deterministic', floor: 2 },
  upstreamCallsDetail: { label: 'Upstream calls per product view', unit: 'count', scenario: 'C', better: 'lower', kind: 'deterministic', floor: 0 },
  // D — interactions
  inp: { label: 'INP (search, filter, sort)', unit: 'ms', scenario: 'D', better: 'lower', kind: 'timing', floor: 25 },
  inpInputDelay: { label: 'INP input delay', unit: 'ms', scenario: 'D', better: 'lower', kind: 'timing', floor: 15 },
  inpProcessing: { label: 'INP processing', unit: 'ms', scenario: 'D', better: 'lower', kind: 'timing', floor: 15 },
  inpPresentation: { label: 'INP presentation delay', unit: 'ms', scenario: 'D', better: 'lower', kind: 'timing', floor: 15 },
  interactionLongTasksOver200: { label: 'Frames > 200 ms during interactions', unit: 'count', scenario: 'D', better: 'lower', kind: 'timing', floor: 1 },
  interactionBlockingMs: { label: 'Blocking time during interactions', unit: 'ms', scenario: 'D', better: 'lower', kind: 'timing', floor: 30 },
  productsTtfb: { label: 'TTFB (products, cold)', unit: 'ms', scenario: 'D', better: 'lower', kind: 'timing', floor: 50 },
  productsLcp: { label: 'LCP (products, cold)', unit: 'ms', scenario: 'D', better: 'lower', kind: 'timing', floor: 100 },
  productsHtmlKB: { label: 'HTML transferred (products)', unit: 'KB', scenario: 'D', better: 'lower', kind: 'deterministic', floor: 2 },
  productsRscInlineKB: { label: 'RSC payload in HTML (products)', unit: 'KB', scenario: 'D', better: 'lower', kind: 'deterministic', floor: 2 },
  // E — memory
  heapGrowthMB: { label: 'JS heap growth after 20 soft navigations', unit: 'MB', scenario: 'E', better: 'lower', kind: 'deterministic', floor: 2 },
  heapAfterMB: { label: 'JS heap after 20 soft navigations', unit: 'MB', scenario: 'E', better: 'lower', kind: 'deterministic', floor: 2 },
  // F — freshness
  freshnessPass: { label: 'Freshness (edit visible within one navigation)', unit: 'bool', scenario: 'F', better: 'higher', kind: 'deterministic', floor: 0 },
  postEditNavMs: { label: 'Dashboard after an order edit (soft nav, unthrottled)', unit: 'ms', scenario: 'F', better: 'lower', kind: 'timing', floor: 50 },
  postEditUpstreamCalls: { label: 'Upstream calls for the dashboard after an order edit', unit: 'count', scenario: 'F', better: 'lower', kind: 'deterministic', floor: 0 },
  // G — isolation
  isolationPass: { label: 'Isolation (no cross-user data)', unit: 'bool', scenario: 'G', better: 'higher', kind: 'deterministic', floor: 0 },
  // H — server
  serverTtfb_dashboard: { label: 'Server TTFB / (unloaded)', unit: 'ms', scenario: 'H', better: 'lower', kind: 'timing', floor: 20 },
  serverTtfb_products: { label: 'Server TTFB /products (unloaded)', unit: 'ms', scenario: 'H', better: 'lower', kind: 'timing', floor: 20 },
  serverTtfb_settings: { label: 'Server TTFB /settings (unloaded)', unit: 'ms', scenario: 'H', better: 'lower', kind: 'timing', floor: 20 },
  serverTtfb_orders: { label: 'Server TTFB /orders (unloaded)', unit: 'ms', scenario: 'H', better: 'lower', kind: 'timing', floor: 20 },
  serverStaticMs: { label: 'Server time per static asset (unloaded)', unit: 'ms', scenario: 'H', better: 'lower', kind: 'timing', floor: 1 },
  rps_dashboard: { label: 'Requests/s /', unit: 'req/s', scenario: 'H', better: 'higher', kind: 'timing', floor: 2 },
  p95_dashboard: { label: 'p95 latency / under load', unit: 'ms', scenario: 'H', better: 'lower', kind: 'timing', floor: 50 },
  rps_products: { label: 'Requests/s /products*', unit: 'req/s', scenario: 'H', better: 'higher', kind: 'timing', floor: 2 },
  p95_products: { label: 'p95 latency /products* under load', unit: 'ms', scenario: 'H', better: 'lower', kind: 'timing', floor: 50 },
  rps_orders: { label: 'Requests/s /orders?status&page', unit: 'req/s', scenario: 'H', better: 'higher', kind: 'timing', floor: 2 },
  p95_orders: { label: 'p95 latency /orders?status&page under load', unit: 'ms', scenario: 'H', better: 'lower', kind: 'timing', floor: 25 },
  // build
  prerenderedRoutes: { label: 'Key routes with a prerendered shell', unit: 'count', scenario: 'build', better: 'higher', kind: 'deterministic', floor: 0 },
};

export function format(key: string, value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '–';
  const def = METRICS[key];
  switch (def?.unit) {
    case 'ms': return `${Math.round(value)} ms`;
    case 'KB': return value >= 1024 ? `${(value / 1024).toFixed(2)} MB` : `${Math.round(value)} KB`;
    case 'MB': return `${value.toFixed(1)} MB`;
    case 'req/s': return `${value.toFixed(1)}/s`;
    case 'ratio': return `${Math.round(value * 100)}%`;
    case 'bool': return value >= 1 ? 'pass' : 'FAIL';
    case 'count': return `${Math.round(value * 10) / 10}`;
    default: return value < 1 ? value.toFixed(3) : value.toFixed(1);
  }
}
