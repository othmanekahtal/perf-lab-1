# PERF.md: Perf Lab 2 · Shoply Admin

## 1. Methodology

### Environment (reference machine)

| | |
|---|---|
| Machine | Apple M1 Pro · 10 cores · 32 GB |
| OS | macOS 27.0.1 (Darwin 27.0.0) |
| Node.js | 24.21.0 |
| Browser | Chromium 156.0.8078.4 (Playwright 1.64.1, headless) |
| Next.js / React | 16.4.3 (Turbopack, `next build && next start`) / 19.3.1 |

Every measurement uses a **production build**. The harness runs `next build` itself, then starts `next start` (port 3100), the upstream API (4001) and the third-party vendors (4002). It restores the database from the seed snapshot first. All data, latencies and assets are local and deterministic.

### Emulation

| Setting | Value |
|---|---|
| Device | 412 × 823 viewport, DPR 1.75, touch, mobile Chrome UA (Lighthouse's Moto G Power profile) |
| CPU | 4× slowdown (`Emulation.setCPUThrottlingRate`) |
| Network | Chrome DevTools "Fast 4G" preset: 9 Mbps × 0.9 down, 1.5 Mbps × 0.9 up, 165 ms RTT (60 ms × 2.75), via `Network.emulateNetworkConditions` |
| Upstream latency | Deterministic per endpoint and key: FX 150 ms, campaigns 250 ms, forecast 600 ms, per-item pricing/inventory 100–180 ms, batch 260–340 ms, recommendations 2,500 ms |
| Runs | 7 per scenario (A–D). E: 3. F, G, H: 1. Reported as **median** and **IQR** (Q3 − Q1). |

Scenario E (memory) runs without network or CPU throttling, because heap size doesn't depend on timing. F (freshness) and G (isolation) run unthrottled too: they are correctness checks.

### Scenarios

| | Scenario |
|---|---|
| A | Cold dashboard load (HTTP cache disabled), traced. After load: 12 wheel scrolls, a viewport resize, then 2 s idle. |
| B | Warm repeat visit: load the dashboard, go to `about:blank`, navigate to the dashboard again with the HTTP cache enabled. |
| C | Soft navigations: dashboard → products (nav link) → first product → back. Each time is measured from the click until the target route's key element is visible, in the page clock. |
| D | Interactions on `/products`: type "wireless" (150 ms between keys), click the *Audio* category, click *price ↑*. |
| E | 20 soft navigations through the four sections, then forced GC (`HeapProfiler.collectGarbage` ×3) before and after. |
| F | As alice, edit the newest order's status in the UI, then soft-navigate to the dashboard and the orders list. Both must show the new status. |
| G | alice and bob, alone and then in parallel (4 passes): dashboard, products, settings, dashboard. Checks names, greeting, recommendations (against the upstream's per-user list), the revenue restriction and the settings name. |
| H | Unloaded server TTFB for 4 routes (median of 5, from Node). Server time per `/_next/static` file (12 files × 3). autocannon, 10 connections × 10 s, on `/`, on `/products` + 3 product pages, and on 18 `/orders?status=…&page=…` URLs. |

### Metric definitions

- **TTFB, FCP, LCP, CLS, INP** come from `web-vitals` 6 (attribution build), injected before any page script with `reportAllChanges`.
  - CLS is the value at the end of the load phase, before the scripted scrolling.
  - INP covers the interactions in D. Its attribution gives input delay, processing and presentation, plus the longest script.
- **TBT** is the sum of (task − 50 ms) for main-thread tasks over 50 ms, between FCP and the end of the load phase (load + network idle + 1.5 s), taken from the trace.
- **Long tasks** come from the `longtask` PerformanceObserver during load.
- **Forced reflows** count `Layout` trace events that run inside JavaScript execution (EvaluateScript, FunctionCall, event dispatch, timers, rAF) on the renderer main thread, during load, scrolling and the resize.
- **Main-thread blocking while scrolling** is the sum of Long Animation Frame `blockingDuration` during the scroll window.
- **Layouts per second while idle** counts `Layout` events per second during the 2 s idle window. Layout-property animations show up here.
- **Bytes** are transferred bytes from CDP (`encodedDataLength`, falling back to the sum of received chunks).
  - HTML is the document response.
  - "RSC payload in HTML" is the size of the inline `self.__next_f` scripts.
  - "RSC transferred (nav)" covers RSC responses (`RSC: 1`, `_rsc=`) that finished after the click.
  - Initial JS is first-party scripts loaded by the parser or a preload. Async JS is loaded by other scripts.
  - Render-blocking resources use `PerformanceResourceTiming.renderBlockingStatus === "blocking"`.
- **Static assets cacheable** is the share of `/_next/static`, `/_next/image`, image and font responses with `max-age ≥ 1 day`.
- **Upstream calls** come from the upstream server's counter (`/__stats`), reset just before the measured view.
- **Third-party main-thread time** is top-level script work in the trace attributed to the vendor origin.
- **Heap growth** is `Runtime.getHeapUsage().usedSize` after forced GC, after the 20 navigations minus before them.
- **Rendering mode per route** is parsed from the `next build` route table (○ static, ◐ partial prerender, ƒ dynamic). "Key routes with a prerendered shell" counts ○/◐ among `/`, `/products`, `/products/[id]`, `/orders`, `/orders/[id]`, `/settings`.
- **Noise:** a change counts as real when |Δ| exceeds max(IQR before, IQR after, a per-metric floor). See `perf/lib/metrics.ts`.

### Reproduce

```bash
pnpm install && pnpm exec playwright install chromium && pnpm seed
pnpm perf -- --label "my change"          # 7 runs, ~20 min on the baseline, ~8 min when fast
pnpm validate                             # all checks + gates + regression guard
```

## 2. Symptoms

The same list as [LAB.md](LAB.md):

| ID | What users notice |
|---|---|
| S1 | Every page takes a long time before anything shows up, even simple ones like Settings. |
| S2 | The dashboard stays blank until everything on it is ready, even on a repeat visit. |
| S3 | On a phone, the main content of the dashboard and of the products page appears very late. |
| S4 | The dashboard jumps around while it loads. |
| S5 | Typing in the product search, clicking a category or changing the sort order freezes the page. |
| S6 | Scrolling or resizing the dashboard is janky, and the dashboard keeps the CPU busy even when nobody touches it. |
| S7 | Coming back to the app re-downloads almost everything. |
| S8 | Going from the dashboard to the products list, and from the list to a product, is slow. |
| S9 | The tab gets slower and uses more memory the longer you use the app. |
| S10 | The server struggles under modest load: few requests per second and slow responses, even for static files. |
| S11 | The platform team says we call their API far too often: dozens of calls per dashboard view. |
| S12 | Pages are huge to download, even the ones that show little. |
| S13 | After the page appears, it doesn't respond for a while. |
| S14 | Right after saving an order, the app feels as slow as a cold start. |

## 3. Final targets

The global budgets for the whole app. Each threshold was derived from a reference implementation that fixes every problem, measured in 3 full runs on the machine above. The reference value is the worst median across those runs. The margin rules:

<!-- margins:start -->
- **timing**: ×1.5 of the reference plus an allowance of twice the metric's noise floor (e.g. +100 ms for TTFB, +50 ms for INP, +0.05 for CLS); counts: ×1.5 + 1; throughput: ÷1.5
- **bytes**: +10% of the reference + 5 KB
- **count**: reference + 1
- **heap**: ×1.25 of the reference + 3 MB
- **ratio**: reference − 0.02
- **exact**: exact
<!-- margins:end -->

<!-- targets:start -->
| Check | Measures | Scenario | Kind | Reference value | Margin | Threshold |
|---|---|---|---|---:|---|---:|
| B1 | TTFB (dashboard, cold) | A | timing | 4 ms | timing | <= 106 ms |
| B2 | LCP (dashboard, cold) | A | timing | 480 ms | timing | <= 920 ms |
| B3 | INP (search, filter, sort) | D | timing | 48 ms | timing | <= 122 ms |
| B4 | CLS (dashboard load) | A | timing | 0.000 | timing | <= 0.050 |
| B5 | Time to interactive (end of the last long task after first paint) | A | timing | 1868 ms | timing | <= 3002 ms |
| B6 | JS heap growth after 20 soft navigations | E | deterministic | 2.3 MB | heap | <= 5.9 MB |
| B7 | Transferred on warm visit | B | deterministic | 94 KB | bytes | <= 108 KB |
| B8 | Upstream calls per dashboard view (warm) | B | deterministic | 0 | count | <= 1 |
| B9 | p95 latency / under load | H | timing | 219 ms | timing | <= 429 ms |
| B10 | Soft nav total | C | timing | 890 ms | timing | <= 1636 ms |
<!-- targets:end -->

<details>
<summary>All validator checks (symptoms and mystery checks)</summary>

<!-- checks:start -->
| Check | Measures | Scenario | Kind | Reference value | Margin | Threshold |
|---|---|---|---|---:|---|---:|
| S1.1 | Dashboard starts responding quickly on a cold load | A | timing | 4 ms | timing | <= 106 ms |
| S1.2 | Products page starts responding quickly | H | timing | 3 ms | timing | <= 44 ms |
| S1.3 | Settings page starts responding quickly | H | timing | 2 ms | timing | <= 44 ms |
| S1.4 | Key pages can be served from a prerendered shell | build | deterministic | 6 | exact | >= 6 |
| S2.1 | Dashboard shows first content quickly (cold) | A | timing | 480 ms | timing | <= 870 ms |
| S2.2 | Dashboard shows first content quickly (repeat visit) | B | timing | 224 ms | timing | <= 486 ms |
| S3.1 | Dashboard main content appears quickly | A | timing | 480 ms | timing | <= 920 ms |
| S3.2 | Products page main content appears quickly | D | timing | 824 ms | timing | <= 1436 ms |
| S3.3 | Little must download before the first render | A | deterministic | 7 KB | bytes | <= 13 KB |
| S4.1 | Dashboard layout is stable while loading | A | timing | 0.000 | timing | <= 0.050 |
| S5.1 | Search, filter and sort respond quickly | D | timing | 48 ms | timing | <= 122 ms |
| S5.2 | No frozen frames while searching, filtering and sorting | D | timing | 0 | timing | <= 1 |
| S6.1 | Few synchronous layouts while loading, scrolling and resizing | A | timing | 227 | timing | <= 345.5 |
| S6.2 | Main thread stays free while scrolling and resizing | A | timing | 165 ms | timing | <= 288 ms |
| S6.3 | An idle dashboard does not keep re-laying out | A | timing | 0.499 | timing | <= 4.7 |
| S6.4 | Total layout work on the dashboard is small | A | timing | 105 ms | timing | <= 198 ms |
| S7.1 | A repeat visit downloads little | B | deterministic | 94 KB | bytes | <= 108 KB |
| S7.2 | Static files can be reused from the browser cache | A | deterministic | 100% | ratio | >= 98% |
| S8.1 | Opening a product from the list is quick | C | timing | 512 ms | timing | <= 919 ms |
| S8.2 | Opening the products list is quick | C | timing | 356 ms | timing | <= 684 ms |
| S8.3 | Opening the products list transfers little | C | deterministic | 27 KB | bytes | <= 35 KB |
| S9.1 | Memory stays flat across 20 navigations | E | deterministic | 2.3 MB | heap | <= 5.9 MB |
| S10.1 | Dashboard throughput under load | H | timing | 61.3/s | timing | >= 40.9/s |
| S10.2 | Dashboard p95 latency under load | H | timing | 219 ms | timing | <= 429 ms |
| S10.3 | Product pages throughput under load | H | timing | 85.6/s | timing | >= 57.1/s |
| S10.4 | Static files are served quickly | H | timing | 2 ms | timing | <= 5 ms |
| S11.1 | Upstream calls per dashboard view (new browser) | A | deterministic | 0 | count | <= 1 |
| S11.2 | Upstream calls per dashboard view (repeat visit) | B | deterministic | 0 | count | <= 1 |
| S11.3 | Upstream calls per product view | C | deterministic | 0 | count | <= 1 |
| S12.1 | Dashboard HTML is small | A | deterministic | 33 KB | bytes | <= 42 KB |
| S12.2 | Dashboard embedded data is small | A | deterministic | 224 KB | bytes | <= 251 KB |
| S12.3 | Products page HTML is small | D | deterministic | 20 KB | bytes | <= 27 KB |
| S12.4 | Stylesheets are small | A | deterministic | 8 KB | bytes | <= 13 KB |
| S12.5 | Fonts are small | A | deterministic | 0 KB | bytes | <= 5 KB |
| S13.1 | The page responds soon after it appears | A | timing | 1868 ms | timing | <= 3002 ms |
| S13.2 | No very long tasks during start-up | A | timing | 1 | timing | <= 2.5 |
| S14.1 | Dashboard is quick right after saving an order | F | timing | 380 ms | timing | <= 670 ms |
| S14.2 | Upstream calls for the dashboard right after saving an order | F | deterministic | 4 | count | <= 5 |
| M1 | Mystery check 1: p95 latency /orders?status&page under load | H | timing | 140 ms | timing | <= 260 ms |
| M2 | Mystery check 2: First-party HTML/JS/CSS/data transferred (cold) | A | deterministic | 340 KB | bytes | <= 379 KB |
<!-- checks:end -->

</details>

Correctness gates (always on): **F** freshness, **G** isolation, **E2E** `pnpm test:e2e`. **REG** fails if any metric got worse than the last row below, beyond noise.

## 4. Results

Medians of 7 runs (± IQR for timing metrics). The Validator column is the score of the full `pnpm validate` run on the same commit.

<!-- results:start -->
<!-- results:end -->
