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
<!-- margins:end -->

<!-- targets:start -->
<!-- targets:end -->

<details>
<summary>All validator checks (symptoms and mystery checks)</summary>

<!-- checks:start -->
<!-- checks:end -->

</details>

Correctness gates (always on): **F** freshness, **G** isolation, **E2E** `pnpm test:e2e`. **REG** fails if any metric got worse than the last row below, beyond noise.

## 4. Results

Medians of 7 runs (± IQR for timing metrics). The Validator column is the score of the full `pnpm validate` run on the same commit.

<!-- results:start -->
<!-- results:end -->
