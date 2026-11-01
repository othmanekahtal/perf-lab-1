// Scenarios A–H. Each run returns flat numeric metrics plus free-form details for the raw JSON.
import type { EventEmitter } from 'node:events';
import autocannon from 'autocannon';
import type { Browser, Page } from '@playwright/test';
import { heapUsedMb, measuredPage, readPerf, sessionCookie, settle, timedSoftNav, type PagePerf, type RequestRecord } from './browser.ts';
import { p95 } from './stats.ts';
import { markTimes, summarizeTrace, TRACE_CATEGORIES } from './trace.ts';
import { resetUpstream, upstreamStats } from './services.ts';

export type Ctx = { browser: Browser; appUrl: string; upstreamUrl: string; vendorUrl: string };
export type RunResult = { metrics: Record<string, number>; details: Record<string, unknown> };

const READY = {
  dashboard: '[data-testid="recent-orders"]',
  products: '[data-testid="product-card"]',
  detail: '[data-testid="product-live-price"]',
  orders: '[data-testid="order-row"]',
  settings: '[data-testid="settings-name"]',
};

const KB = 1024;
const isStaticAsset = (url: string) => /\/_next\/static\/|\/_next\/image|\.(?:jpg|jpeg|png|webp|avif|woff2?|svg|ico)(?:\?|$)/.test(url);

function maxAge(cc: string | undefined) {
  if (!cc || /no-store|no-cache/.test(cc)) return 0;
  const m = cc.match(/max-age=(\d+)/);
  return m ? Number(m[1]) : 0;
}

function bytesBreakdown(reqs: RequestRecord[], appOrigin: string, vendorOrigin: string) {
  const net = reqs.filter((r) => !r.fromCache && !r.failed);
  const sum = (list: RequestRecord[]) => list.reduce((s, r) => s + r.transferBytes, 0);
  const doc = net.find((r) => r.resourceType === 'Document');
  const firstPartyScripts = net.filter((r) => r.resourceType === 'Script' && r.url.startsWith(appOrigin));
  return {
    doc,
    totalTransfer: sum(net),
    html: doc?.transferBytes ?? 0,
    htmlDecoded: doc?.decodedBytes ?? 0,
    css: sum(net.filter((r) => r.resourceType === 'Stylesheet')),
    font: sum(net.filter((r) => r.resourceType === 'Font')),
    image: sum(net.filter((r) => r.resourceType === 'Image')),
    jsInitial: sum(firstPartyScripts.filter((r) => r.initiator === 'parser' || r.initiator === 'preload' || r.initiator === 'other')),
    jsAsync: sum(firstPartyScripts.filter((r) => r.initiator === 'script')),
    thirdParty: sum(net.filter((r) => r.url.startsWith(vendorOrigin))),
    firstPartyText: sum(net.filter((r) => r.url.startsWith(appOrigin) && ['Document', 'Script', 'Stylesheet', 'Fetch', 'XHR'].includes(r.resourceType))),
    requests: net.length,
  };
}

async function inlineRscBytes(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll('script:not([src])')].reduce((s, el) => (el.textContent?.includes('__next_f') ? s + new Blob([el.textContent]).size : s), 0));
}

async function renderBlocking(page: Page) {
  return page.evaluate(() =>
    (performance.getEntriesByType('resource') as (PerformanceResourceTiming & { renderBlockingStatus?: string })[])
      .filter((e) => e.renderBlockingStatus === 'blocking')
      .map((e) => ({ url: e.name, transfer: e.transferSize, encoded: e.encodedBodySize })),
  );
}

function serverTiming(header: string | undefined) {
  const out: Record<string, number> = {};
  for (const part of (header ?? '').split(',')) {
    const [name, ...params] = part.trim().split(';');
    const dur = params.find((p) => p.trim().startsWith('dur='));
    if (name && dur) out[name] = Number(dur.trim().slice(4));
  }
  return out;
}

function lcpCls(perf: PagePerf) {
  return {
    ttfb: perf.vitals.TTFB?.value ?? NaN,
    fcp: perf.vitals.FCP?.value ?? NaN,
    lcp: perf.vitals.LCP?.value ?? NaN,
    cls: perf.vitals.CLS?.value ?? 0,
  };
}

async function scroll(page: Page, steps: number) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(120);
  }
}

/** A. Cold load of the dashboard, then scroll, resize and idle (traced). */
export async function scenarioA(ctx: Ctx, browser: Browser): Promise<RunResult> {
  const m = await measuredPage(browser, ctx.appUrl, { user: 'alice', cacheDisabled: true });
  await resetUpstream(ctx.upstreamUrl);
  await browser.startTracing(m.page, { categories: TRACE_CATEGORIES });
  await m.page.goto('/', { waitUntil: 'load' });
  await m.page.locator(READY.dashboard).waitFor({ state: 'visible' });
  await settle(m.page, 1500);
  const loadPerf = await readPerf(m.page);
  const upstreamCalls = (await upstreamStats(ctx.upstreamUrl)).total;
  await m.page.evaluate(() => performance.mark('perf-lab:load-end'));

  const scrollT0 = await m.page.evaluate(() => { performance.mark('perf-lab:scroll-start'); return performance.now(); });
  await scroll(m.page, 12);
  await m.page.setViewportSize({ width: 390, height: 780 });
  await m.page.waitForTimeout(300);
  await m.page.setViewportSize({ width: 412, height: 823 });
  await m.page.waitForTimeout(300);
  const scrollT1 = await m.page.evaluate(() => { performance.mark('perf-lab:scroll-end'); return performance.now(); });
  await m.page.evaluate(() => window.scrollTo(0, 0));
  await m.page.waitForTimeout(500);
  await m.page.evaluate(() => performance.mark('perf-lab:idle-start'));
  await m.page.waitForTimeout(2000);
  await m.page.evaluate(() => performance.mark('perf-lab:idle-end'));
  const trace = await browser.stopTracing();
  const afterPerf = await readPerf(m.page);

  const marks = markTimes(trace);
  const summary = summarizeTrace(trace, {
    appOrigin: ctx.appUrl,
    marks: {
      load: [0, marks['load-end'] ?? Infinity],
      scroll: [marks['scroll-start'] ?? 0, marks['scroll-end'] ?? 0],
      idle: [marks['idle-start'] ?? 0, marks['idle-end'] ?? 0],
    },
  });
  const reqs = m.requests.list();
  const b = bytesBreakdown(reqs, ctx.appUrl, ctx.vendorUrl);
  const blocking = await renderBlocking(m.page);
  const rscInline = await inlineRscBytes(m.page);
  const statics = reqs.filter((r) => r.url.startsWith(ctx.appUrl) && isStaticAsset(r.url) && r.status === 200);
  const scrollLoafs = afterPerf.loafs.filter((l) => l.start >= scrollT0 && l.start <= scrollT1);
  const v = lcpCls(loadPerf);
  await m.context.close();

  return {
    metrics: {
      ttfb: v.ttfb, fcp: v.fcp, lcp: v.lcp, cls: v.cls,
      tbt: summary.tbt,
      longTasks: loadPerf.longtasks.length,
      longTasksOver200: loadPerf.longtasks.filter((t) => t.duration > 200).length,
      forcedReflows: summary.forcedReflows,
      forcedReflowMs: summary.forcedReflowMs,
      scrollBlockingMs: scrollLoafs.reduce((s, l) => s + l.blocking, 0),
      idleLayoutsPerSec: summary.windows.idle.layouts / Math.max(0.001, summary.windows.idle.ms / 1000),
      layoutMs: summary.layoutMs,
      htmlKB: b.html / KB,
      rscInlineKB: rscInline / KB,
      cssKB: b.css / KB,
      fontKB: b.font / KB,
      renderBlockingCount: blocking.length,
      renderBlockingKB: blocking.reduce((s, r) => s + r.transfer, 0) / KB,
      jsInitialKB: b.jsInitial / KB,
      jsAsyncKB: b.jsAsync / KB,
      thirdPartyKB: b.thirdParty / KB,
      thirdPartyMainThreadMs: summary.thirdPartyMainThreadMs,
      firstPartyTextKB: b.firstPartyText / KB,
      coldTransferKB: b.totalTransfer / KB,
      upstreamCallsCold: upstreamCalls,
      staticCacheableRatio: statics.length ? statics.filter((r) => maxAge(r.cacheControl) >= 86_400).length / statics.length : 0,
      proxyMs: serverTiming(b.doc?.serverTiming).proxy ?? 0,
    },
    details: {
      lcp: loadPerf.vitals.LCP, cls: loadPerf.vitals.CLS, shifts: loadPerf.shifts.filter((s) => s.value > 0.01),
      longTasks: loadPerf.longtasks, traceLongTasks: summary.longTasks, thirdPartyByOrigin: summary.thirdPartyByOrigin, traceWindows: summary.windows,
      renderBlocking: blocking, serverTiming: serverTiming(b.doc?.serverTiming), documentEncoding: b.doc?.contentEncoding ?? null,
      cacheControl: Object.fromEntries(statics.map((r) => [new URL(r.url).pathname, r.cacheControl ?? null])),
      scrollLoafScripts: topScripts(scrollLoafs),
      requests: reqs.map((r) => ({ url: r.url, type: r.resourceType, initiator: r.initiator, status: r.status, transfer: r.transferBytes, decoded: r.decodedBytes, cache: r.cacheControl, encoding: r.contentEncoding, rsc: r.rsc })),
    },
  };
}

/** B. Warm repeat visit: load once, then navigate to the dashboard again with the HTTP cache enabled. */
export async function scenarioB(ctx: Ctx, browser: Browser): Promise<RunResult> {
  const m = await measuredPage(browser, ctx.appUrl, { user: 'alice' });
  await m.page.goto('/', { waitUntil: 'load' });
  await m.page.locator(READY.dashboard).waitFor({ state: 'visible' });
  await settle(m.page, 1000);
  await m.page.goto('about:blank');
  const since = await m.requests.now();
  await resetUpstream(ctx.upstreamUrl);
  await m.page.goto('/', { waitUntil: 'load' });
  await m.page.locator(READY.dashboard).waitFor({ state: 'visible' });
  await settle(m.page, 1500);
  const perf = await readPerf(m.page);
  const upstream = (await upstreamStats(ctx.upstreamUrl)).total;
  const reqs = m.requests.list(since + 1e-6);
  const b = bytesBreakdown(reqs, ctx.appUrl, ctx.vendorUrl);
  const v = lcpCls(perf);
  await m.context.close();
  return {
    metrics: {
      warmTtfb: v.ttfb, warmFcp: v.fcp, warmLcp: v.lcp,
      warmTransferKB: b.totalTransfer / KB,
      warmRequests: b.requests,
      warmFromCache: reqs.filter((r) => r.fromCache).length,
      upstreamCallsWarm: upstream,
    },
    details: {
      lcp: perf.vitals.LCP,
      requests: reqs.map((r) => ({ url: r.url, type: r.resourceType, status: r.status, fromCache: r.fromCache, transfer: r.transferBytes, cache: r.cacheControl })),
    },
  };
}

/** C. Soft navigations: dashboard → products → product detail → back. */
export async function scenarioC(ctx: Ctx, browser: Browser): Promise<RunResult> {
  const m = await measuredPage(browser, ctx.appUrl, { user: 'alice' });
  await m.page.goto('/', { waitUntil: 'load' });
  await m.page.locator(READY.dashboard).waitFor({ state: 'visible' });
  await settle(m.page, 1000);

  const s1 = await m.requests.now();
  const navProductsMs = await timedSoftNav(m.page, { click: '[data-testid="nav-products"]' }, READY.products);
  await settle(m.page, 500);
  const productsRsc = await m.requests.rscBytesSince(s1);

  await resetUpstream(ctx.upstreamUrl);
  const s2 = await m.requests.now();
  const navDetailMs = await timedSoftNav(m.page, { click: '[data-testid="product-card"] a' }, READY.detail);
  await settle(m.page, 500);
  const detailRsc = await m.requests.rscBytesSince(s2);
  const upstreamDetail = (await upstreamStats(ctx.upstreamUrl)).total;

  const navBackMs = await timedSoftNav(m.page, { back: true }, READY.products);
  await settle(m.page, 300);
  await m.context.close();
  return {
    metrics: {
      navProductsMs, navDetailMs, navBackMs,
      navTotalMs: navProductsMs + navDetailMs + navBackMs,
      rscNavProductsKB: productsRsc / KB,
      rscNavDetailKB: detailRsc / KB,
      upstreamCallsDetail: upstreamDetail,
    },
    details: {},
  };
}

function topScripts(loafs: PagePerf['loafs'], n = 8) {
  const agg = new Map<string, { script: string; duration: number; forcedLayout: number; count: number }>();
  for (const l of loafs) for (const s of l.scripts) {
    const key = `${s.invoker} @ ${s.src.replace(/^https?:\/\/[^/]+/, '')}${s.fn ? ` (${s.fn})` : ''}`;
    const cur = agg.get(key) ?? { script: key, duration: 0, forcedLayout: 0, count: 0 };
    cur.duration += s.duration;
    cur.forcedLayout += s.forcedLayout;
    cur.count++;
    agg.set(key, cur);
  }
  return [...agg.values()].sort((a, b) => b.duration - a.duration).slice(0, n);
}

/** D. Interaction on the products list: type a search, click a filter, click a sort. */
export async function scenarioD(ctx: Ctx, browser: Browser): Promise<RunResult> {
  const m = await measuredPage(browser, ctx.appUrl, { user: 'alice', cacheDisabled: true });
  await m.page.goto('/products', { waitUntil: 'load' });
  await m.page.locator(READY.products).first().waitFor({ state: 'visible' });
  await settle(m.page, 2000);
  const loadPerf = await readPerf(m.page);
  const loadReqs = m.requests.list();
  const doc = loadReqs.find((r) => r.resourceType === 'Document');
  const rscInline = await inlineRscBytes(m.page);
  const before = loadPerf.loafs.length;

  const search = m.page.getByTestId('product-search');
  await search.click();
  await m.page.keyboard.type('wireless', { delay: 150 });
  await m.page.waitForTimeout(1500);
  await m.page.getByTestId('category-chip').filter({ hasText: 'Audio' }).click();
  await m.page.waitForTimeout(1500);
  await m.page.getByTestId('sort-price-asc').click();
  await m.page.waitForTimeout(2000);

  const perf = await readPerf(m.page);
  const interactionLoafs = perf.loafs.slice(before);
  const byInteraction = new Map<number, { name: string; duration: number; target: string | null }>();
  for (const e of perf.events) {
    const cur = byInteraction.get(e.id);
    if (!cur || e.duration > cur.duration) byInteraction.set(e.id, { name: e.name, duration: e.duration, target: e.target });
  }
  const interactions = [...byInteraction.values()];
  const inp = perf.vitals.INP;
  await m.context.close();
  return {
    metrics: {
      inp: inp?.value ?? Math.max(0, ...interactions.map((i) => i.duration)),
      inpInputDelay: inp?.inputDelay ?? NaN,
      inpProcessing: inp?.processing ?? NaN,
      inpPresentation: inp?.presentation ?? NaN,
      interactionLongTasksOver200: interactionLoafs.filter((l) => l.duration > 200).length,
      interactionBlockingMs: interactionLoafs.reduce((s, l) => s + l.blocking, 0),
      productsTtfb: loadPerf.vitals.TTFB?.value ?? NaN,
      productsLcp: loadPerf.vitals.LCP?.value ?? NaN,
      productsHtmlKB: (doc?.transferBytes ?? 0) / KB,
      productsRscInlineKB: rscInline / KB,
    },
    details: { inp, interactions, loafTopScripts: topScripts(interactionLoafs), productsLcp: loadPerf.vitals.LCP },
  };
}

/** E. Memory: 20 soft navigations, forced GC, JS heap growth. Network and CPU are not throttled (heap is not timing-dependent). */
export async function scenarioE(ctx: Ctx, browser: Browser): Promise<RunResult> {
  const m = await measuredPage(browser, ctx.appUrl, { user: 'alice', throttle: false });
  await m.page.goto('/', { waitUntil: 'load' });
  await m.page.locator(READY.dashboard).waitFor({ state: 'visible' });
  await settle(m.page, 1500);
  const before = await heapUsedMb(m.cdp);
  const cycle: [string, string][] = [
    ['[data-testid="nav-products"]', READY.products],
    ['[data-testid="nav-orders"]', READY.orders],
    ['[data-testid="nav-settings"]', READY.settings],
    ['[data-testid="nav-dashboard"]', READY.dashboard],
  ];
  for (let i = 0; i < 20; i++) {
    const [link, ready] = cycle[i % cycle.length];
    await timedSoftNav(m.page, { click: link }, ready);
    await m.page.waitForTimeout(400);
  }
  await settle(m.page, 2000);
  const after = await heapUsedMb(m.cdp);
  await m.context.close();
  return { metrics: { heapGrowthMB: after - before, heapAfterMB: after }, details: { before, after } };
}

/** F. Freshness: edit the newest order as alice; the change must be visible on the dashboard and the orders list within one navigation. */
export async function scenarioF(ctx: Ctx, browser: Browser): Promise<RunResult> {
  const m = await measuredPage(browser, ctx.appUrl, { user: 'alice', throttle: false });
  const failures: string[] = [];
  await m.page.goto('/', { waitUntil: 'load' });
  const firstRow = m.page.locator('[data-testid="recent-order-row"]').first();
  await firstRow.waitFor({ state: 'visible' });
  const orderId = await firstRow.getAttribute('data-order-id');
  const oldStatus = (await firstRow.getByTestId('order-status').textContent())?.trim();
  const newStatus = oldStatus === 'shipped' ? 'delivered' : 'shipped';

  await firstRow.locator('a').first().click();
  await m.page.getByTestId('order-status-select').waitFor({ state: 'visible' });
  await m.page.getByTestId('order-status-select').selectOption(newStatus);
  await m.page.getByTestId('order-notes').fill(`freshness check ${Date.now()}`);
  await m.page.getByTestId('order-save').click();
  await m.page.getByTestId('order-saved').waitFor({ state: 'visible' });
  await m.page.waitForTimeout(300);

  await resetUpstream(ctx.upstreamUrl);
  const postEditNavMs = await timedSoftNav(m.page, { click: '[data-testid="nav-dashboard"]' }, `[data-testid="recent-order-row"][data-order-id="${orderId}"]`);
  await m.page.waitForTimeout(500);
  const postEditUpstreamCalls = (await upstreamStats(ctx.upstreamUrl)).total;
  const dashStatus = (await m.page.locator(`[data-testid="recent-order-row"][data-order-id="${orderId}"]`).filter({ visible: true }).first().getByTestId('order-status').textContent())?.trim();
  if (dashStatus !== newStatus) failures.push(`dashboard shows "${dashStatus}" for order ${orderId}, expected "${newStatus}"`);

  await timedSoftNav(m.page, { click: '[data-testid="nav-orders"]' }, READY.orders);
  const listRow = m.page.locator(`[data-testid="order-row"][data-order-id="${orderId}"]`).filter({ visible: true });
  const listStatus = (await listRow.first().getByTestId('order-status').textContent())?.trim();
  if (listStatus !== newStatus) failures.push(`orders list shows "${listStatus}" for order ${orderId}, expected "${newStatus}"`);
  await m.context.close();
  return { metrics: { freshnessPass: failures.length ? 0 : 1, postEditNavMs, postEditUpstreamCalls }, details: { orderId, oldStatus, newStatus, failures } };
}

/** G. Isolation: alice and bob browse in parallel; personalised data must never cross over. */
export async function scenarioG(ctx: Ctx, browser: Browser): Promise<RunResult> {
  const expected: Record<string, string[]> = {};
  for (const u of ['alice', 'bob']) {
    const r = (await (await fetch(`${ctx.upstreamUrl}/v1/recommendations?user=${u}`)).json()) as { items: { productId: number }[] };
    expected[u] = r.items.map((i) => String(i.productId)).sort();
  }
  const NAMES: Record<string, string> = { alice: 'Alice Martin', bob: 'Bob Chen' };
  const failures: string[] = [];

  const visit = async (user: 'alice' | 'bob', pass: number) => {
    const other = user === 'alice' ? 'bob' : 'alice';
    const m = await measuredPage(browser, ctx.appUrl, { user, throttle: false });
    const check = async (where: string) => {
      const text = await m.page.locator('body').innerText();
      if (text.includes(NAMES[other])) failures.push(`pass ${pass}: ${user} saw ${other}'s name on ${where}`);
      const current = (await m.page.getByTestId('current-user').filter({ visible: true }).first().textContent())?.trim();
      if (current !== NAMES[user]) failures.push(`pass ${pass}: ${user}'s header shows "${current}" on ${where}`);
    };
    await m.page.goto('/', { waitUntil: 'load' });
    const recs = m.page.locator('[data-testid="recommended-item"]').filter({ visible: true });
    await recs.first().waitFor({ state: 'visible' });
    await m.page.locator(READY.dashboard).waitFor({ state: 'visible' });
    await m.page.waitForTimeout(500);
    const ids = (await recs.evaluateAll((els) => els.map((e) => e.getAttribute('data-product-id') ?? ''))).sort();
    if (JSON.stringify(ids) !== JSON.stringify(expected[user])) failures.push(`pass ${pass}: ${user} got recommendations ${ids.join(',')} (expected ${expected[user].join(',')})`);
    const greeting = await m.page.getByTestId('greeting').filter({ visible: true }).first().textContent();
    if (!greeting?.includes(NAMES[user].split(' ')[0])) failures.push(`pass ${pass}: ${user}'s greeting reads "${greeting}"`);
    const revenue = (await m.page.getByTestId('kpi-revenue').filter({ visible: true }).first().innerText()).toLowerCase();
    if (user === 'bob' && !revenue.includes('restricted')) failures.push(`pass ${pass}: bob can see revenue ("${revenue.replace(/\s+/g, ' ')}")`);
    if (user === 'alice' && revenue.includes('restricted')) failures.push(`pass ${pass}: alice's revenue is restricted`);
    await check('dashboard');
    await timedSoftNav(m.page, { click: '[data-testid="nav-products"]' }, READY.products);
    await check('products');
    await timedSoftNav(m.page, { click: '[data-testid="nav-settings"]' }, READY.settings);
    const settingsName = await m.page.getByTestId('settings-name').filter({ visible: true }).first().inputValue();
    if (settingsName !== NAMES[user]) failures.push(`pass ${pass}: ${user}'s settings show "${settingsName}"`);
    await timedSoftNav(m.page, { click: '[data-testid="nav-dashboard"]' }, READY.dashboard);
    await check('dashboard (return)');
    await m.context.close();
  };

  await visit('alice', 1);
  await visit('bob', 2);
  await Promise.all([visit('alice', 3), visit('bob', 3)]);
  await Promise.all([visit('bob', 4), visit('alice', 4)]);
  return { metrics: { isolationPass: failures.length ? 0 : 1 }, details: { failures } };
}

/** H. Server throughput with autocannon, plus unloaded server response times per route. */
export async function scenarioH(ctx: Ctx): Promise<RunResult> {
  const cookie = `shoply_session=${sessionCookie('alice')}; theme=light`;
  const headers = { cookie, 'accept-encoding': 'gzip, br', 'user-agent': 'Mozilla/5.0 perf-lab' };
  const metrics: Record<string, number> = {};
  const details: Record<string, unknown> = {};

  // Unloaded time to first byte, measured from Node (no browser, no throttling).
  for (const [key, path] of [['dashboard', '/'], ['products', '/products'], ['settings', '/settings'], ['orders', '/orders?status=shipped&page=2']] as const) {
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const res = await fetch(`${ctx.appUrl}${path}`, { headers, redirect: 'manual' });
      const reader = res.body!.getReader();
      await reader.read();
      samples.push(performance.now() - t0);
      while (!(await reader.read()).done) {}
    }
    metrics[`serverTtfb_${key}`] = samples.sort((a, b) => a - b)[2];
  }

  // Static assets referenced by the login page, fetched sequentially.
  const loginHtml = await (await fetch(`${ctx.appUrl}/login`)).text();
  const assets = [...new Set(loginHtml.match(/\/_next\/static\/[^"' )]+/g) ?? [])].slice(0, 12);
  const assetTimes: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (const a of assets) {
      const t0 = performance.now();
      const res = await fetch(`${ctx.appUrl}${a}`, { headers: { 'accept-encoding': 'gzip, br' } });
      await res.arrayBuffer();
      assetTimes.push(performance.now() - t0);
    }
  }
  metrics.serverStaticMs = assetTimes.sort((a, b) => a - b)[Math.floor(assetTimes.length / 2)] ?? NaN;
  details.staticAssets = assets.length;

  const targets: { key: string; requests: { path: string }[] }[] = [
    { key: 'dashboard', requests: [{ path: '/' }] },
    { key: 'products', requests: [{ path: '/products' }, { path: '/products/42' }, { path: '/products/1337' }, { path: '/products/4021' }] },
    { key: 'orders', requests: ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'].flatMap((s) => [1, 2, 3].map((p) => ({ path: `/orders?status=${s}&page=${p}` }))) },
  ];
  for (const t of targets) {
    const latencies: number[] = [];
    let errors = 0;
    const instance = autocannon({ url: ctx.appUrl, connections: 10, duration: 10, headers, requests: t.requests, timeout: 30 }) as unknown as Promise<autocannon.Result> & EventEmitter;
    instance.on('response', (_client: unknown, status: number, _bytes: number, time: number) => {
      if (status >= 400) errors++;
      latencies.push(time);
    });
    const result = await instance;
    metrics[`rps_${t.key}`] = latencies.length / 10;
    metrics[`p95_${t.key}`] = latencies.length ? p95(latencies) : 30_000;
    metrics[`errors_${t.key}`] = errors + result.errors + result.timeouts;
    details[t.key] = { completed: latencies.length, non2xx: result.non2xx, timeouts: result.timeouts };
  }
  return { metrics, details };
}
