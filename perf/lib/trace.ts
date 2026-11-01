// Summarises a Chrome performance trace (as produced by browser.startTracing / stopTracing).

type TraceEvent = { name: string; cat: string; ph: string; ts: number; dur?: number; pid: number; tid: number; args?: { name?: string; data?: Record<string, unknown>; frame?: string } };

export const TRACE_CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'v8.execute',
  'blink.user_timing',
  'loading',
  'toplevel',
];

const SCRIPT_EVENTS = new Set(['EvaluateScript', 'FunctionCall', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'v8.compile', 'v8.compileModule', 'RunMicrotasks', 'v8.evaluateModule', 'ParseHTML']);
const JS_TOPLEVEL = new Set(['EvaluateScript', 'FunctionCall', 'TimerFire', 'FireAnimationFrame', 'EventDispatch', 'v8.evaluateModule', 'RunMicrotasks']);

export type TraceSummary = {
  forcedReflows: number;
  forcedReflowMs: number;
  layoutMs: number;
  layoutCount: number;
  styleRecalcMs: number;
  thirdPartyMainThreadMs: number;
  thirdPartyByOrigin: Record<string, number>;
  longTasks: number[];
  tbt: number;
  windows: Record<string, { layouts: number; layoutMs: number; scriptMs: number; longestTaskMs: number; ms: number }>;
};

/**
 * @param marks  named windows in trace-clock microseconds, e.g. { scroll: [t0, t1], idle: [t2, t3] }
 * @param fcpTs  FCP time in trace clock (µs); TBT counts from there.
 */
export function summarizeTrace(buffer: Buffer, opts: { appOrigin: string; marks: Record<string, [number, number]> }): TraceSummary {
  const parsed = JSON.parse(buffer.toString('utf8')) as { traceEvents: TraceEvent[] } | TraceEvent[];
  const events = Array.isArray(parsed) ? parsed : parsed.traceEvents;

  // Pick the busiest renderer main thread (the page under test).
  const mainThreads = events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
  let main: { pid: number; tid: number } | null = null;
  let best = -1;
  for (const t of mainThreads) {
    const total = events.reduce((sum, e) => (e.pid === t.pid && e.tid === t.tid && e.name === 'RunTask' && e.dur ? sum + e.dur : sum), 0);
    if (total > best) { best = total; main = { pid: t.pid, tid: t.tid }; }
  }
  const onMain = events.filter((e) => main && e.pid === main.pid && e.tid === main.tid && e.ph === 'X' && typeof e.dur === 'number').sort((a, b) => a.ts - b.ts);

  const fcp = events.find((e) => e.name === 'firstContentfulPaint' && main && e.pid === main.pid);
  const fcpTs = fcp?.ts ?? 0;

  const tasks = onMain.filter((e) => e.name === 'RunTask');
  const scripts = onMain.filter((e) => JS_TOPLEVEL.has(e.name));
  const layouts = onMain.filter((e) => e.name === 'Layout');
  const styles = onMain.filter((e) => e.name === 'UpdateLayoutTree' || e.name === 'RecalculateStyles');

  // Forced reflow = a layout that runs synchronously inside JavaScript execution.
  const spans: [number, number][] = [];
  for (const s of scripts) {
    const end = s.ts + (s.dur ?? 0);
    const last = spans.at(-1);
    if (last && s.ts <= last[1]) last[1] = Math.max(last[1], end);
    else spans.push([s.ts, end]);
  }
  let forcedReflows = 0;
  let forcedReflowMs = 0;
  let k = 0;
  for (const l of layouts) {
    while (k < spans.length && spans[k][1] < l.ts) k++;
    if (k < spans.length && spans[k][0] <= l.ts && l.ts + (l.dur ?? 0) <= spans[k][1]) {
      forcedReflows++;
      forcedReflowMs += (l.dur ?? 0) / 1000;
    }
  }

  // Third-party main-thread time: top-level script work attributed to other origins.
  const thirdPartyByOrigin: Record<string, number> = {};
  let lastEnd = -1;
  for (const s of onMain.filter((e) => SCRIPT_EVENTS.has(e.name))) {
    if (s.ts < lastEnd) continue; // nested inside an already-counted event
    const url = String(s.args?.data?.url ?? s.args?.data?.scriptName ?? '');
    if (!url.startsWith('http')) continue;
    const origin = new URL(url).origin;
    if (origin === opts.appOrigin) continue;
    thirdPartyByOrigin[origin] = (thirdPartyByOrigin[origin] ?? 0) + (s.dur ?? 0) / 1000;
    lastEnd = s.ts + (s.dur ?? 0);
  }

  const longTasks = tasks.filter((t) => (t.dur ?? 0) > 50_000).map((t) => (t.dur ?? 0) / 1000);
  const loadEnd = opts.marks.load?.[1] ?? Infinity;
  const tbt = tasks
    .filter((t) => t.ts >= fcpTs && t.ts <= loadEnd && (t.dur ?? 0) > 50_000)
    .reduce((sum, t) => sum + ((t.dur ?? 0) - 50_000) / 1000, 0);

  const windows: TraceSummary['windows'] = {};
  for (const [name, [a, b]] of Object.entries(opts.marks)) {
    const within = (e: TraceEvent) => e.ts >= a && e.ts <= b;
    const wl = layouts.filter(within);
    windows[name] = {
      ms: (b - a) / 1000,
      layouts: wl.length,
      layoutMs: wl.reduce((s, e) => s + (e.dur ?? 0) / 1000, 0),
      scriptMs: scripts.filter(within).reduce((s, e) => s + (e.dur ?? 0) / 1000, 0),
      longestTaskMs: Math.max(0, ...tasks.filter(within).map((t) => (t.dur ?? 0) / 1000)),
    };
  }

  return {
    forcedReflows,
    forcedReflowMs,
    layoutMs: layouts.reduce((s, e) => s + (e.dur ?? 0) / 1000, 0),
    layoutCount: layouts.length,
    styleRecalcMs: styles.reduce((s, e) => s + (e.dur ?? 0) / 1000, 0),
    thirdPartyMainThreadMs: Object.values(thirdPartyByOrigin).reduce((a, b) => a + b, 0),
    thirdPartyByOrigin,
    longTasks,
    tbt,
    windows,
  };
}

/** Current time on the trace clock: emit a user-timing mark and read it back from the trace later. */
export const TRACE_MARK = (name: string) => `performance.mark('perf-lab:${name}')`;

export function markTimes(buffer: Buffer): Record<string, number> {
  const parsed = JSON.parse(buffer.toString('utf8')) as { traceEvents: TraceEvent[] } | TraceEvent[];
  const events = Array.isArray(parsed) ? parsed : parsed.traceEvents;
  const out: Record<string, number> = {};
  for (const e of events) if (e.name.startsWith('perf-lab:') && !(e.name.slice(9) in out)) out[e.name.slice(9)] = e.ts;
  return out;
}
