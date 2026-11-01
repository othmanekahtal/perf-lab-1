# Perf Lab 2: Shoply Admin

A deliberately slow, realistic Next.js admin app for practising **server-side and full-stack performance**: rendering modes, Next.js caching, request waterfalls, streaming, HTTP caching, third-party scripts, the rendering pipeline, memory leaks and server throughput.

Start with **[LAB.md](LAB.md)**, which lists the symptoms users complain about. **[PERF.md](PERF.md)** holds the methodology, the final targets and your weekly results.

## Stack

Next.js 16.4 (App Router, Turbopack, `next start`) · React 19.3 · TypeScript (strict) · Tailwind 4 · SQLite through Node's built-in `node:sqlite` · pnpm · Node 24 · Playwright (Chromium) · web-vitals 6 · autocannon.

| Process | Port | Command | What it is |
|---|---|---|---|
| App | 3100 | `pnpm build && pnpm start` | Shoply Admin |
| Upstream API | 4001 | `pnpm upstream` | Pricing, inventory, FX, forecast and recommendations, with deterministic latency (150 ms – 2.5 s). `GET /__stats` counts calls. |
| Third parties | 4002 | `pnpm thirdparty` | "InsightPulse" analytics and the "HelloDesk" chat widget, served from a separate origin |

Users: **alice** (admin) and **bob** (staff). The password for both is `password`.

## Getting started

```bash
pnpm install
pnpm exec playwright install chromium
pnpm seed                 # deterministic data: 5k products, 50k orders, 200k reviews, 48 product photos
pnpm upstream &           # keep it running while you build and browse
pnpm thirdparty &
pnpm build && pnpm start  # http://localhost:3100
```

`pnpm seed` writes `data/shoply.seed.db`, a pristine snapshot. The measurement tools restore `data/shoply.db` from it before every session, so edits never leak between runs. To reset by hand, run `node scripts/reset-db.ts`.

> If you start caching data at build time, `next build` will call the upstream API, so keep `pnpm upstream` running while you build. The measurement tools start everything themselves.

## Tools

### `pnpm perf -- --label "..." [--week n] [--append]`

The measurement harness. It builds the app, starts the app, upstream and third-party servers itself, and drives Chromium through Playwright with:

- a Moto G Power–class viewport (412 × 823, DPR 1.75, touch)
- **4× CPU** slowdown
- Chrome DevTools' **Fast 4G** preset (9 Mbps down, 1.5 Mbps up, 165 ms RTT)

It runs **7 runs** by default and reports the median and IQR.

| Scenario | What it measures |
|---|---|
| A | Cold dashboard load (cache disabled), then scrolling, a resize and an idle period, with a trace: TTFB, FCP, LCP (+ element), CLS (+ largest shift), TBT, long tasks, forced reflows, layout time, HTML/RSC/CSS/JS/third-party bytes, render-blocking resources, cache headers, upstream calls, Server-Timing |
| B | Warm repeat visit: transferred bytes, requests, upstream calls |
| C | Soft navigations: dashboard → products → product → back (time until the new route is visibly complete, RSC bytes) |
| D | Interactions on the product list: typing a search, a filter click, a sort click (INP with phases, Long Animation Frames attribution with the top scripts) |
| E | Memory: 20 soft navigations, forced GC, JS heap growth |
| F | Freshness: alice edits an order; the change must show on the dashboard and the orders list within one navigation (pass/fail) |
| G | Isolation: alice and bob browse in parallel; nobody may see the other's personal data (pass/fail) |
| H | Server: unloaded TTFB per route, static-file server time, autocannon throughput (req/s, p95) on three routes |

Options:

- `--runs n`, `--scenarios A,C,D` and `--skip-build` (reuse the current `.next`).
- The raw JSON (request logs, trace summary, LCP/CLS/INP attribution, LoAF scripts) goes to `perf-results/<date>-<label>.json`.
- The harness prints a markdown row and a comparison with the previous row (✅ / ❌ / "within noise", using the IQR).
- `--append` adds the row to PERF.md. It refuses if freshness or isolation fails.

### `pnpm validate`

The grader. It answers one question: *is this symptom fixed, and did I break anything?* Checks test **outcomes** (bytes, calls, timings, headers), never the implementation, so any valid fix passes.

| Command | What runs |
|---|---|
| `pnpm validate` | Every check, 7 runs. Exit code 1 on any failure. |
| `pnpm validate -- --symptom S4` | Only S4's checks, plus the correctness gates |
| `pnpm validate -- --symptom S4 --quick` | The same with 3 runs. Timing results are marked *provisional*. |
| `pnpm validate -- --quick` | Every check, 3 runs |
| `pnpm validate -- --deterministic` | Only checks that don't depend on timing: bytes, request counts, upstream calls, cache headers, rendering modes, heap growth, correctness. Stable across machines. |
| `pnpm validate -- --from perf-results/x.json` | Re-grade a saved `pnpm perf` result without measuring again (no e2e gate) |
| `pnpm validate:self-test` | Proves the grader works both ways: the baseline must fail every S/M check with all gates green, and the reference solution must pass everything 3 times in a row (about 1.5 h; checks out both in temporary worktrees) |

Check types:

- **S1…S14**: one or more checks per symptom in LAB.md.
- **M1, M2**: mystery checks. They fail on the baseline and only show a metric and a threshold.
- **Gates**: freshness (F), isolation (G) and `pnpm test:e2e`. If one fails, the validation fails.
- **B1…B10**: final targets for the whole app.
- **REG**: the regression guard. It fails if any budgeted metric got worse than the last PERF.md row beyond noise (IQR-based), even if the symptom you targeted improved.

The score counts the S, M and B checks: `Score: X / 49 checks passing · gates: F ✅ G ✅ E2E ✅ REG ✅`. The exit code is 1 if any check or gate fails.

Thresholds live in `perf-budgets.json`. They were derived from a reference implementation (see PERF.md). **Don't edit them.** Results go to `validation-results/<date>.json`, and the final line reads `Score: X / Y checks passing`.

### `pnpm test:e2e`

Functional Playwright tests for every feature, run against a production build: sign-in, the dashboard, personalisation and permissions, product search/filter/sort/pagination, the product page, the orders list, the order editor and settings. Every fix must keep these green. Use `E2E_SKIP_BUILD=1` to reuse the current build.

### Bundle analyzer

```bash
ANALYZE=true pnpm build
```

This runs `next build`, then `next analyze`, the Turbopack bundle analyzer built into Next.js 16. `@next/bundle-analyzer` only works with webpack, so the lab uses the built-in one. It opens an interactive treemap with import chains, filterable by route and by client/server.

## Weekly workflow

1. **Pick a symptom** from LAB.md.
2. **Profile.** Read the relevant numbers in `perf-results/*.json`, then reproduce in DevTools (Performance, Network, Memory, Coverage) or with the analyzer, the build route table or the upstream counter.
3. **Form a hypothesis**, and write it down.
4. **Fix ONE thing.**
5. Run `pnpm validate -- --symptom <id> --quick` for fast feedback.
6. Run `pnpm test:e2e` to confirm nothing broke.
7. **Commit.**
8. Run a full `pnpm validate`.
9. Run `pnpm perf -- --label "what changed" --week <n> --append`.
10. **Commit the results** (PERF.md, `perf-results/`, `validation-results/`).
11. **Write a note.** In a Claude session in this repo, ask for an Obsidian note in `notes/`.

## Why timing checks only run locally

CI runners are shared virtual machines. Their CPU speed, neighbours and network vary from run to run and are nothing like your laptop, so a 300 ms INP on CI can't be compared with your PERF.md history. The PR workflow (`.github/workflows/perf-lab.yml`) therefore runs only:

- `pnpm test:e2e`
- `pnpm validate -- --deterministic`, which covers bytes, request counts, upstream calls, cache headers, rendering modes, heap growth, freshness and isolation. These are properties of the code, not of the machine.

Timing checks (TTFB, LCP, INP, TBT, throughput…) are run with a full `pnpm validate` on your own machine, where the reference thresholds were measured.

Optional pre-push hook with the deterministic checks:

```bash
git config core.hooksPath .githooks
```

## Repository map

```
app/            routes (App Router), server actions, route handlers
components/     dashboard, products, orders, shell
lib/            data access (node:sqlite), upstream client, session
proxy.ts        request proxy
servers/        upstream API and third-party vendors (part of the "outside world", don't edit)
scripts/        seed, DB reset, build and e2e runners
perf/           measurement harness (pnpm perf)
validate/       validator (pnpm validate) and threshold derivation
e2e/            functional tests
perf-budgets.json, PERF.md, LAB.md, CLAUDE.md
```

## Branches

- `main`: the slow baseline (tag `baseline`). Work here.
- `answers` and `reference-solution`: spoilers. Don't look at them until you're done, or until you really want to.
