// Browser setup shared by every scenario: emulation, web-vitals injection, request logging.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { ROOT } from './services.ts';

export const EMULATION = {
  device: 'Moto G Power–class phone (Lighthouse mobile defaults)',
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  cpuSlowdown: 4,
  // Chrome DevTools "Fast 4G" preset (front_end/core/sdk/NetworkManager.ts): 9 Mbps ×0.9 down, 1.5 Mbps ×0.9 up, 60 ms × 2.75 RTT.
  network: { name: 'Fast 4G (DevTools preset)', latency: 165, downloadThroughput: (9_000_000 / 8) * 0.9, uploadThroughput: (1_500_000 / 8) * 0.9 },
} as const;

const WEB_VITALS = readFileSync(join(ROOT, 'node_modules/web-vitals/dist/web-vitals.attribution.iife.js'), 'utf8');

// Runs before any page script. Collects vitals with attribution, long tasks, LoAF and event timing.
const OBSERVERS = `
(() => {
  if (window.top !== window) return;
  const P = (window.__perf = { vitals: {}, longtasks: [], loafs: [], events: [], shifts: [], marks: {} });
  const obs = (type, fn, opts) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true, ...opts }); } catch (e) {} };
  obs('longtask', (e) => P.longtasks.push({ start: e.startTime, duration: e.duration }));
  obs('long-animation-frame', (e) => P.loafs.push({
    start: e.startTime, duration: e.duration, blocking: e.blockingDuration,
    scripts: e.scripts.map((s) => ({ invoker: s.invoker, invokerType: s.invokerType, src: s.sourceURL, fn: s.sourceFunctionName, start: s.startTime, duration: s.duration, forcedLayout: s.forcedStyleAndLayoutDuration })),
  }));
  obs('event', (e) => { if (e.interactionId) P.events.push({ name: e.name, id: e.interactionId, start: e.startTime, duration: e.duration, processing: e.processingEnd - e.processingStart, delay: e.processingStart - e.startTime, target: e.target && e.target.getAttribute ? (e.target.getAttribute('data-testid') || e.target.tagName) : null }); }, { durationThreshold: 16 });
  obs('layout-shift', (e) => P.shifts.push({ start: e.startTime, value: e.value, recent: e.hadRecentInput, sources: (e.sources || []).map((s) => s.node && s.node.nodeType === 1 ? s.node.tagName.toLowerCase() + (s.node.getAttribute('data-testid') ? '[data-testid=' + s.node.getAttribute('data-testid') + ']' : s.node.className && typeof s.node.className === 'string' ? '.' + s.node.className.split(' ').slice(0, 2).join('.') : '') : null) }));
  const wv = window.webVitals;
  const opts = { reportAllChanges: true };
  wv.onTTFB((m) => (P.vitals.TTFB = { value: m.value, waiting: m.attribution.waitingDuration, request: m.attribution.requestDuration }), opts);
  wv.onFCP((m) => (P.vitals.FCP = { value: m.value }), opts);
  wv.onLCP((m) => (P.vitals.LCP = { value: m.value, element: m.attribution.target || null, url: m.attribution.url || null, ttfb: m.attribution.timeToFirstByte, loadDelay: m.attribution.resourceLoadDelay, loadDuration: m.attribution.resourceLoadDuration, renderDelay: m.attribution.elementRenderDelay }), opts);
  wv.onCLS((m) => (P.vitals.CLS = { value: m.value, largestShiftTarget: m.attribution.largestShiftTarget || null, largestShiftValue: m.attribution.largestShiftValue || 0, largestShiftTime: m.attribution.largestShiftTime || 0 }), opts);
  wv.onINP((m) => {
    const a = m.attribution;
    P.vitals.INP = { value: m.value, target: a.interactionTarget || null, type: a.interactionType || null, inputDelay: a.inputDelay, processing: a.processingDuration, presentation: a.presentationDelay,
      longestScript: a.longestScript ? { src: a.longestScript.entry.sourceURL, fn: a.longestScript.entry.sourceFunctionName, invoker: a.longestScript.entry.invoker, subpart: a.longestScript.subpart, duration: a.longestScript.intersectingDuration } : null,
      totalScript: a.totalScriptDuration || 0, totalStyleLayout: a.totalStyleAndLayoutDuration || 0 };
  }, { ...opts, durationThreshold: 16 });
})();`;

export type RequestRecord = {
  id: string;
  url: string;
  method: string;
  resourceType: string;
  initiator: string;
  status?: number;
  mimeType?: string;
  cacheControl?: string;
  contentEncoding?: string;
  serverTiming?: string;
  fromCache: boolean;
  transferBytes: number;
  encodedReceived: number;
  decodedBytes: number;
  startTime: number;
  endTime?: number;
  rsc: boolean;
  failed?: boolean;
};

export class RequestLog {
  readonly records = new Map<string, RequestRecord>();
  private readonly cdp: CDPSession;
  private constructor(cdp: CDPSession) {
    this.cdp = cdp;
  }

  static async attach(cdp: CDPSession) {
    const log = new RequestLog(cdp);
    await log.start();
    return log;
  }

  private async start() {
    const { cdp, records } = this;
    cdp.on('Network.requestWillBeSent', (e) => {
      const headers = e.request.headers as Record<string, string>;
      const rscHeader = Object.entries(headers).some(([k, v]) => k.toLowerCase() === 'rsc' && v === '1');
      records.set(e.requestId, {
        id: e.requestId, url: e.request.url, method: e.request.method, resourceType: e.type ?? 'Other', initiator: e.initiator.type,
        fromCache: false, transferBytes: 0, encodedReceived: 0, decodedBytes: 0, startTime: e.timestamp, rsc: rscHeader || e.request.url.includes('_rsc='),
      });
    });
    cdp.on('Network.responseReceived', (e) => {
      const r = records.get(e.requestId);
      if (!r) return;
      const h = Object.fromEntries(Object.entries(e.response.headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
      r.status = e.response.status;
      r.mimeType = e.response.mimeType;
      r.cacheControl = h['cache-control'];
      r.contentEncoding = h['content-encoding'];
      r.serverTiming = h['server-timing'];
      r.fromCache = Boolean(e.response.fromDiskCache || e.response.fromServiceWorker || e.response.fromPrefetchCache);
      if (h['content-type']?.includes('text/x-component')) r.rsc = true;
    });
    cdp.on('Network.requestServedFromCache', (e) => {
      const r = records.get(e.requestId);
      if (r) r.fromCache = true;
    });
    cdp.on('Network.dataReceived', (e) => {
      const r = records.get(e.requestId);
      if (!r) return;
      r.decodedBytes += e.dataLength;
      r.encodedReceived += e.encodedDataLength;
    });
    cdp.on('Network.loadingFinished', (e) => {
      const r = records.get(e.requestId);
      if (!r) return;
      // Throttled streaming responses can report 0 here; fall back to the sum of received chunks.
      r.transferBytes = Math.max(e.encodedDataLength, r.encodedReceived);
      r.endTime = e.timestamp;
    });
    cdp.on('Network.loadingFailed', (e) => {
      const r = records.get(e.requestId);
      if (r) { r.failed = true; r.endTime = e.timestamp; }
    });
  }

  /** Snapshot of the records since the given checkpoint (or all). */
  list(since = 0): RequestRecord[] {
    // Chunk events can arrive after loadingFinished, so take the larger of the two counts.
    return [...this.records.values()]
      .filter((r) => r.startTime >= since && !r.url.startsWith('data:'))
      .map((r) => ({ ...r, transferBytes: Math.max(r.transferBytes, r.encodedReceived) }));
  }

  /** RSC bytes of responses that finished after `since`, once no RSC request is still in flight. */
  async rscBytesSince(since: number, timeoutMs = 30_000): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && [...this.records.values()].some((r) => r.rsc && r.endTime === undefined && r.startTime >= since - 60)) {
      await new Promise((res) => setTimeout(res, 100));
    }
    return this.list().filter((r) => r.rsc && (r.endTime ?? 0) >= since).reduce((s, r) => s + r.transferBytes, 0);
  }

  async now(): Promise<number> {
    // CDP timestamps are monotonic seconds; take the latest one we have seen.
    let max = 0;
    for (const r of this.records.values()) max = Math.max(max, r.endTime ?? r.startTime);
    return max;
  }
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ args: ['--enable-precise-memory-info', '--disable-features=PaintHolding'] });
}

export function sessionCookie(username: string) {
  return Buffer.from(JSON.stringify({ u: username, v: 1 })).toString('base64url');
}

export type Measured = { context: BrowserContext; page: Page; cdp: CDPSession; requests: RequestLog };

export async function measuredPage(
  browser: Browser,
  appUrl: string,
  opts: { user: string | null; cacheDisabled?: boolean; throttle?: boolean; cpu?: boolean },
): Promise<Measured> {
  const throttle = opts.throttle ?? true;
  const cpu = opts.cpu ?? throttle;
  const context = await browser.newContext({
    viewport: EMULATION.viewport,
    deviceScaleFactor: EMULATION.deviceScaleFactor,
    isMobile: EMULATION.isMobile,
    hasTouch: EMULATION.hasTouch,
    userAgent: EMULATION.userAgent,
    locale: 'en-IE',
    timezoneId: 'Europe/Lisbon',
    baseURL: appUrl,
  });
  if (opts.user) {
    await context.addCookies([
      { name: 'shoply_session', value: sessionCookie(opts.user), url: appUrl },
      { name: 'theme', value: 'light', url: appUrl },
    ]);
  }
  await context.addInitScript({ content: `${WEB_VITALS}\n;window.webVitals = webVitals;\n${OBSERVERS}` });
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  page.setDefaultNavigationTimeout(120_000);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const requests = await RequestLog.attach(cdp);
  if (opts.cacheDisabled) await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (throttle) {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: EMULATION.network.latency,
      downloadThroughput: EMULATION.network.downloadThroughput,
      uploadThroughput: EMULATION.network.uploadThroughput,
    });
  }
  if (cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: EMULATION.cpuSlowdown });
  return { context, page, cdp, requests };
}

export type PagePerf = {
  vitals: {
    TTFB?: { value: number };
    FCP?: { value: number };
    LCP?: { value: number; element: string | null; url: string | null; ttfb: number; loadDelay: number; loadDuration: number; renderDelay: number };
    CLS?: { value: number; largestShiftTarget: string | null; largestShiftValue: number; largestShiftTime: number };
    INP?: { value: number; target: string | null; type: string | null; inputDelay: number; processing: number; presentation: number; longestScript: { src: string; fn: string; invoker: string; subpart: string; duration: number } | null; totalScript: number; totalStyleLayout: number };
  };
  longtasks: { start: number; duration: number }[];
  loafs: { start: number; duration: number; blocking: number; scripts: { invoker: string; invokerType: string; src: string; fn: string; start: number; duration: number; forcedLayout: number }[] }[];
  events: { name: string; id: number; start: number; duration: number; processing: number; delay: number; target: string | null }[];
  shifts: { start: number; value: number; recent: boolean; sources: (string | null)[] }[];
};

export async function readPerf(page: Page): Promise<PagePerf> {
  return page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as { __perf: unknown }).__perf)) as PagePerf);
}

/** Waits until no requests have been in flight for `quietMs` (ignoring long-polling noise below `ignoreUnder` bytes). */
export async function settle(page: Page, quietMs = 1000, maxMs = 30_000) {
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: maxMs }).catch(() => {});
  await page.waitForTimeout(quietMs);
}

/** Navigates in-page (soft navigation) and returns ms until `ready` is visible, measured in the page clock. */
export async function timedSoftNav(page: Page, action: { click: string } | { back: true }, ready: string): Promise<number> {
  return page.evaluate(
    ([clickSel, readySel]) =>
      new Promise<number>((resolve, reject) => {
        const t0 = performance.now();
        const timeout = setTimeout(() => reject(new Error(`timed out waiting for ${readySel}`)), 120_000);
        if (clickSel) {
          const el = document.querySelector<HTMLElement>(clickSel);
          if (!el) return reject(new Error(`no element ${clickSel}`));
          el.click();
        } else history.back();
        const check = () => {
          const found = [...document.querySelectorAll<HTMLElement>(readySel)].some((el) => el.checkVisibility() && el.getBoundingClientRect().height > 0);
          if (found) requestAnimationFrame(() => { clearTimeout(timeout); resolve(performance.now() - t0); });
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
    ['click' in action ? action.click : null, ready] as const,
  );
}

export async function heapUsedMb(cdp: CDPSession) {
  for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return usedSize / 1024 / 1024;
}
