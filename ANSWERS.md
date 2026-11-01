# ANSWERS: Perf Lab 2 (spoilers)

This branch contains the `main` code with every deliberate problem tagged `// PERF-BUG #n` (`grep -rn PERF-BUG app components lib proxy.ts next.config.ts`).
The `reference-solution` branch fixes them with one commit per problem.

Check IDs refer to `perf-budgets.json`. "Fix family" names the technique, not the only valid fix: the validator checks outcomes, so any fix that reaches the numbers passes.

## Summary

| # | Problem | Where | Symptoms | Checks |
|---|---|---|---|---|
| 1 | Root layout reads cookies/headers → every route dynamic | `app/layout.tsx` | S1, S2, S10 | S1.1–S1.4, S2.x, S10.x, B1 |
| 2 | Upstream and DB data uncached | `lib/upstream.ts`, `lib/data.ts`, `components/shell/sidebar.tsx` | S1, S2, S10, S11 | S1.x, S10.x, S11.2, B1, B8 |
| 3 | Waterfalls, N+1, no dedupe | `lib/dashboard.ts`, `kpi-grid.tsx`, `products/[id]/page.tsx` | S1, S2, S8, S10, S11 | S11.1, S11.3, S8.1, S1.1 |
| 4 | No streaming | `app/(shop)/page.tsx`, no `loading.tsx` | S2, S3, S8 | S2.1, S2.2, S3.1, S8.2 |
| 5 | Over-fetching to the client / needless client components | products page, dashboard charts, product view, settings, live widget | S12, S8, S3, S4, S13 | S12.1–S12.3, S8.3, S8.4, S4.1, S13.x |
| 6 | Mutation invalidates everything + refresh hack | `app/actions/orders.ts`, `order-editor.tsx` | S14 | S14.1, S14.2 |
| 7 | Personal data read deep inside shared components | `lib/dashboard.ts`, `kpi-grid.tsx`, `topbar.tsx` | S1, S2 (blocks caching), isolation gate | G, S1.x |
| 8 | Proxy without matcher + expensive sync work | `proxy.ts` | S10, S1 | S10.4, S10.x |
| 9 | Wrong HTTP caching, unoptimized images | `next.config.ts`, route handlers, `<Image unoptimized>` | S7, S3, S12 | S7.1, S7.2, B7 |
| 10 | Synchronous third-party scripts in `<head>` | `app/layout.tsx`, `servers/thirdparty.ts` (vendor) | S3, S4, S13 | S3.3, S4.1, S13.x |
| 11 | Long synchronous work in input handlers | `products-explorer.tsx`, `search.ts` | S5 | S5.1, S5.2, B3 |
| 12 | Layout thrashing, non-passive listeners, layout animations, huge list | `activity-feed.tsx`, `use-equal-heights.ts`, `globals.css` | S6 | S6.1–S6.4 |
| 13 | Memory leaks across soft navigations | `live-visitors.tsx`, `charts.tsx`, `products-explorer.tsx`, `use-equal-heights.ts` | S9 | S9.1, B6 |
| 14 | Render-blocking CSS framework + icon font | `app/globals.css` | S3, S12 | S3.3, S12.4, S12.5 |
| M1 | Missing database indexes + per-row customer lookup | `lib/data.ts` (`listOrders`, `getReviews`), schema | none | M1 |
| M2 | Compression disabled | `next.config.ts` (`compress: false`) | none | M2 |

---

## #1: The root layout forces dynamic rendering everywhere

- **Cause:** `app/layout.tsx` awaits `cookies()` (theme) and `headers()` (language). Any request-time API in the root layout makes every route render per request. The build table shows `ƒ` for every route, and nothing can be prerendered.
- **Symptoms / checks:** S1 (S1.1 TTFB, S1.2/S1.3 server TTFB of simple pages, S1.4 prerendered routes), S2, S10, global B1.
- **Fix family:** keep request-time APIs out of the root layout. Apply the theme on the client (a tiny inline script that reads the cookie before paint, or a client provider), use a static `lang`, and read personal data inside `<Suspense>` boundaries further down. With Cache Components (`cacheComponents: true`), the shell becomes a static prerender (`◐ Partial Prerender`).
- **Metrics:** TTFB, FCP, `prerenderedRoutes`, server TTFB, throughput.

## #2: Data is fetched uncached on every request

- **Cause:** `lib/upstream.ts` makes a raw HTTP call each time (150–2,500 ms). KPIs, charts and recent orders are recomputed from SQLite on every request. The sidebar's low-stock badge calls upstream on every navigation. None of the framework's caching tools are used.
- **Symptoms / checks:** S1, S2, S10 (throughput), S11.2 (upstream calls on a warm view), B8.
- **Fix family:** Cache Components: `"use cache"` on data functions, with a `cacheLife` profile that fits each source (FX: `hours`, catalogue: `hours`/`days`, orders: tagged and invalidated on write) and `cacheTag` for precise invalidation. Don't cache personal data unless the user identity is part of the cache key (see #7).
- **Metrics:** upstream calls per view (warm), TTFB, req/s.

## #3: Request waterfalls, N+1 and no deduplication

- **Cause:** `getDashboardData()` awaits independent calls one after another. The recent-orders loop makes one inventory call per row, and the recommendations loop one pricing call per product, both sequential. Each `KpiCard` fetches FX again (no dedupe). The product page does the same for related products.
- **Symptoms / checks:** S1, S2, S8.1, S10, S11.1 (23 calls per dashboard view), S11.3 (10 per product view).
- **Fix family:** `Promise.all` (or start promises early and await late), the batch endpoints `/v1/inventory?ids=` and `/v1/pricing?ids=`, and request-level dedupe (`React.cache`, or `"use cache"`, which dedupes by key).
- **Metrics:** upstream calls per view (cold), TTFB, soft navigation time.

## #4: No streaming

- **Cause:** the dashboard page awaits everything, including recommendations (~2.5 s), before rendering. There is no `<Suspense>` boundary and no `loading.tsx`, so neither the HTML nor a soft navigation shows anything until the slowest widget is ready.
- **Symptoms / checks:** S2.1/S2.2 FCP, S3.1 LCP, S8.2 soft navigation.
- **Fix family:** split the page into independently loading sections, each wrapped in `<Suspense>` with a skeleton of the final size (no layout shift). Add `loading.tsx` for instant navigation feedback, and stream the slow widget.
- **Metrics:** FCP, LCP, soft-nav time.

## #5: Over-fetching to the client

- **Cause:**
  - `/products` serializes all 5,000 products with every column (about 6–7 MB of RSC payload, inlined in the HTML and fetched on every soft navigation) to a client component that filters in the browser.
  - The dashboard sends about 8,400 raw order rows to a client chart component that aggregates them.
  - The product page is a single client component that receives every review.
  - `/settings` is a client page that fetches `/api/me` in `useEffect`.
  - The charts and the live-visitors widget render nothing until they mount or fetch, which causes the dashboard's layout shifts (S4).
- **Symptoms / checks:** S12.1–S12.3 (HTML/RSC size), S8.3/S8.4 (RSC per navigation), S3, S13 (hydration cost), S4.1 (pop-in).
- **Fix family:** keep data work on the server. Search, filter, sort and paginate in SQL (or a cached index) driven by `searchParams`, and send only the 24 rows shown. Aggregate the charts on the server and send a few dozen points. Use server components by default and push `"use client"` down to the leaves (gallery, form, filters). Select only the columns you render. Reserve space for anything that loads later.
- **Metrics:** HTML KB, RSC KB, TBT, CLS, soft-nav time.

## #6: The mutation throws away everything

- **Cause:** `updateOrder` calls `revalidatePath('/', 'layout')`, which invalidates every route, and the editor calls `router.refresh()` after saving. With nothing cached this is merely wasteful. Once you add caching, it discards the cache on every save, so the next dashboard view is as slow as a cold start (S14).
- **Symptoms / checks:** S14.1 (dashboard after an edit), S14.2 (upstream calls after an edit). The freshness gate F must keep passing.
- **Fix family:** tag cached data by what it depends on (`cacheTag('orders')`, `cacheTag('order:' + id)`) and call `updateTag(...)` in the Server Action, which gives read-your-own-writes for exactly those entries. Remove the refresh hack. Data that doesn't depend on orders (FX, forecast, recommendations, catalogue) stays cached.
- **Metrics:** post-edit soft-nav time, post-edit upstream calls, freshness gate.

## #7: Personal data is entangled with shared data

- **Cause:** the dashboard loader, the KPI grid (permissions) and the top bar read the session deep inside components that also render shared data. That prevents caching the shared parts. The naive fix, adding `"use cache"` around them, either fails (cookies inside a cache scope) or leaks: caching the KPI grid without the permission flag shows Alice's revenue to Bob, and caching recommendations without the user in the key shows Alice's picks to Bob.
- **Symptoms / checks:** blocks the fixes for S1/S2. The isolation gate G catches leaks: it loads both users in parallel and checks names, recommendations, the revenue restriction and settings.
- **Fix family:** read the session once, in a small boundary (inside `<Suspense>`). Pass the user ID or permissions as arguments to cached functions, so they become part of the cache key. Use `"use cache: private"` for data that must never be shared. Keep shared data (KPIs, charts) in caches with no user input.
- **Metrics:** isolation gate, TTFB.

## #8: The proxy runs on every request and is expensive

- **Cause:** `proxy.ts` has no `config.matcher`, so it runs for every request, including `/_next/static/*`, images and fonts. On each run it compiles ~3,000 regular expressions (bot detection) and scans a 60,000-entry IP table, about 15 ms of synchronous CPU per request. The `Server-Timing: proxy;dur=…` header is visible in DevTools.
- **Symptoms / checks:** S10.4 (static file server time), S10.1–S10.3 (throughput), S1.
- **Fix family:** add a `matcher` that excludes static assets and images. Hoist expensive setup to module scope (one combined regex built once, a `Set`/prefix map for IP ranges). Skip work the route doesn't need.
- **Metrics:** server time per static asset, req/s, p95.

## #9: Wrong HTTP caching and unoptimized images

- **Cause:** `next.config.ts` `headers()` sets `Cache-Control: no-store, must-revalidate` on `/:path*`. That also overrides the `public, max-age=31536000, immutable` Next.js gives to content-hashed `/_next/static` files, so a repeat visit re-downloads every chunk, the CSS, the fonts and the images. Route handlers send `no-store` for data that rarely changes. Every `<Image>` uses `unoptimized`, so 1600 × 1600 JPEGs of ~800 KB are served into 150 px slots, and the product hero (the LCP element) is lazy.
- **Symptoms / checks:** S7.1 (warm transfer), S7.2 (static assets cacheable), S3.2 (products LCP), B7.
- **Fix family:** remove the blanket header (or scope it to what really must not be stored). Let Next serve immutable static assets. Use the image optimizer (`sizes`, `quality`, AVIF/WebP) and `preload`/`fetchPriority="high"` for the LCP image. Give public assets and route handlers suitable `Cache-Control`.
- **Metrics:** warm transfer, cacheable ratio, LCP.

## #10: Third-party scripts block the page

- **Cause:** `analytics.js` (~390 KB, with ~200–400 ms of fingerprinting at start-up under 4× CPU) and `chat-widget.js` (~180 KB, building an index at start-up) are synchronous `<script>` tags in `<head>`, on another origin, with no preconnect. They block HTML parsing and the first render, then add long tasks. Without its launcher slot, the chat widget inserts a bar at the top of the page, which shifts everything (S4).
- **Symptoms / checks:** S3.3 (render-blocking bytes), S3.1 LCP, S13.1/S13.2 (TBT / long tasks), S4.1 CLS.
- **Fix family:** `next/script` with `strategy="afterInteractive"`/`"lazyOnload"` (or a worker), `preconnect` to the vendor origin, and the vendor's embed option (`<div id="hellodesk-launcher">` in a fixed-position slot) so the widget doesn't shift content.
- **Metrics:** render-blocking bytes, FCP/LCP, TBT, CLS, third-party main-thread time.

## #11: Slow interactions (INP)

- **Cause:** every keystroke, filter click and sort click runs `compute()` synchronously in the event handler. That's fuzzy bigram scoring over 5,000 products × ~60 words, then a sort whose comparator builds a new `Intl.Collator` and `JSON.parse`s specs on every comparison. One keystroke takes ~500–800 ms of processing under 4× CPU.
- **Symptoms / checks:** S5.1 (INP), S5.2 (frames > 200 ms during interactions), B3.
- **Fix family:** yield to the main thread. Update the input immediately, then compute in chunks with `await scheduler.yield()` (with a `setTimeout` fallback) and cancel stale runs. Or mark the update as a transition (`useTransition`/`useDeferredValue`). Make each chunk cheaper: precompute tokens and sort keys once, reuse one `Intl.Collator`, parse JSON once. Moving the work to the server (#5) also removes most of it. A worker isn't the intended fix here.
- **Metrics:** INP (processing duration), long animation frames during interactions.

## #12: Rendering pipeline problems

- **Cause:**
  - `activity-feed.tsx`: the scroll handler reads `getBoundingClientRect()` and writes `style.paddingLeft` for each of 1,500 rows, which forces a reflow per row. The scroll, wheel and touch listeners are registered `{ passive: false }`.
  - `use-equal-heights.ts`: on mount, resize and every scroll event it writes `minHeight`, then reads `offsetTop`/`offsetHeight`, in a loop.
  - `globals.css`: `.live-bar` and `.live-dot` animate `left`/`width`/`top`/`height`, so layout runs every frame, even when idle.
  - The 1,500-row list has no `content-visibility`.
- **Symptoms / checks:** S6.1 (forced reflows), S6.2 (blocking while scrolling), S6.3 (layouts per second while idle), S6.4 (total layout time).
- **Fix family:** batch reads before writes, or use an `IntersectionObserver` / CSS instead of measuring. Use passive listeners. Animate `transform`/`opacity`. Use `content-visibility: auto` with `contain-intrinsic-size`, or paginate/virtualize. Equal-height cards come for free with CSS grid.
- **Metrics:** forced reflows, scroll blocking, idle layouts, layout time.

## #13: Memory leaks across client navigations

- **Cause:**
  - `live-visitors.tsx`: `setInterval` and a `focus` listener are never cleared, so every dashboard visit adds another poller. `samples` is an unbounded module-level array.
  - `charts.tsx`: a `resize` listener is never removed, and its closure keeps the 8,400-row `orders` array alive.
  - `products-explorer.tsx`: the module-level `visited` array keeps every products array (≈ 5,000 objects) ever received.
  - `use-equal-heights.ts`: listeners are never removed.
- **Symptoms / checks:** S9.1 (heap growth after 20 soft navigations), B6.
- **Fix family:** return cleanup functions from effects (`clearInterval`, `removeEventListener`, `AbortController`), and bound or remove module-level caches. Find it with heap snapshots: compare two snapshots, then look at detached nodes and retainers.
- **Metrics:** heap growth (MB).

## #14: Render-blocking CSS and an icon font

- **Cause:** `globals.css` imports all of Bootstrap (~230 KB) and Material Design Icons (~300 KB of CSS for ~7,000 glyph classes, plus a ~400 KB woff2). All of it is render-blocking on every page, and the app uses a handful of Bootstrap classes and about 25 icons.
- **Symptoms / checks:** S3.3 (render-blocking bytes), S12.4 (CSS), S12.5 (fonts).
- **Fix family:** remove the framework (Tailwind already covers it). Replace the icon font with inline SVG components for the icons in use, or subset the font.
- **Metrics:** CSS KB, font KB, render-blocking bytes, FCP.

## M1: Missing indexes (mystery)

- **Cause:** the schema has no secondary indexes. `listOrders()` runs a "lifetime value" query per row (`WHERE customer_email = ?`), which means 25 full scans of 50,000 orders per page. Filtering by status, ordering by date and loading reviews by product are full scans too. `node:sqlite` is synchronous, so each scan blocks the event loop. Under load, p95 on `/orders?status=…&page=…` reaches seconds. Caching can't hide it: the page depends on `searchParams`.
- **How to find it:** server CPU profile (`node --cpu-prof`) or `Server-Timing` around queries, then `EXPLAIN QUERY PLAN` (`SCAN orders`).
- **Fix family:** `CREATE INDEX` on `orders(customer_email)`, `orders(status, created_at)`, `orders(created_at)` and `reviews(product_id, created_at)`, applied at start-up (or in the seed). Alternatively, precompute the customer stats.
- **Check:** M1 (`p95_orders`).

## M2: Compression disabled (mystery)

- **Cause:** `next.config.ts` sets `compress: false`, with a comment saying the load balancer compresses. There is no load balancer here, so HTML, JS, CSS and RSC go out uncompressed (`content-encoding` is missing in DevTools).
- **How to find it:** compare *transferred* and *resource* size in the Network panel, or look for `content-encoding` in the harness request log.
- **Fix family:** enable compression (remove the flag) or put a compressing proxy in front.
- **Check:** M2 (`firstPartyTextKB`).

## Interactions between fixes

- Fixing #2 (caching) while #6 is still in place makes S14 obvious: every save throws the cache away.
- Fixing #2 before #7 either fails to build (request APIs inside `"use cache"`) or leaks data. The isolation gate catches the leak.
- Fixing #4 (streaming) without reserved space makes S4 worse: skeletons must match the final size.
- With Cache Components on, uncached data access outside `<Suspense>` fails the build. #1, #2, #4 and #7 are usually fixed together in practice. The reference solution still keeps them in separate commits.
- Synchronous `node:sqlite` calls in dynamic components need `await connection()` (or `await io()`) first under Cache Components. See `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/io.md`.
