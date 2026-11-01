# Perf Lab 2 · Shoply Admin

Shoply Admin is the back office of a fake store. It works, and every feature is covered by tests, but users complain that it's slow. Your job is to find out why, fix it one change at a time, and prove each fix with measurements.

This file lists only what users notice. Causes are for you to find. A symptom can have more than one cause, and a single cause can show up in several symptoms.

## Symptoms

| ID | What users notice |
|---|---|
| **S1** | Every page takes a long time before anything shows up, even simple ones like Settings. |
| **S2** | The dashboard stays blank until everything on it is ready, even on a repeat visit. |
| **S3** | On a phone, the main content of the dashboard and of the products page appears very late. |
| **S4** | The dashboard jumps around while it loads. |
| **S5** | Typing in the product search, clicking a category or changing the sort order freezes the page. |
| **S6** | Scrolling or resizing the dashboard is janky, and the dashboard keeps the CPU busy even when nobody touches it. |
| **S7** | Coming back to the app re-downloads almost everything. |
| **S8** | Going from the dashboard to the products list, and from the list to a product, is slow. |
| **S9** | The tab gets slower and uses more memory the longer you use the app. |
| **S10** | The server struggles under modest load: few requests per second and slow responses, even for static files. |
| **S11** | The platform team says we call their API far too often: dozens of calls per dashboard view. |
| **S12** | Pages are huge to download, even the ones that show little. |
| **S13** | After the page appears, it doesn't respond for a while. |
| **S14** | Right after saving an order, the app feels as slow as a cold start. |

The validator also runs two **mystery checks**, M1 and M2. They don't match any symptom above. They show only a metric and a threshold. Find out what they measure and why they fail, using profiling.

## Rules of the game

- Fix **one thing at a time**, then measure. `pnpm validate -- --symptom S4 --quick` gives fast feedback for a single symptom.
- Fixes must not break features (`pnpm test:e2e`). Fresh data must stay fresh: an edited order must show up on the dashboard and in the orders list straight away. One user must never see another user's data. The validator enforces both.
- Don't change `perf-budgets.json`, the validator, the harness, the seed or the upstream/vendor servers. They stand for the outside world.
- See [README.md](README.md) for the tools and the weekly workflow.
