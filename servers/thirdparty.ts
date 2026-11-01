// Simulated third-party vendors on a separate origin:
//   /analytics.js   – "InsightPulse" analytics SDK
//   /chat-widget.js – "HelloDesk" live-chat widget
import { createServer } from 'node:http';
import { mulberry32 } from '../scripts/rng.ts';

const PORT = Number(process.env.THIRDPARTY_PORT ?? 4002);
const r = mulberry32(42);

function token(n: number) {
  let s = '';
  for (let i = 0; i < n; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(r() * 36)];
  return s;
}

// A device-detection table, the bulk of the SDK's weight.
const devices = Array.from({ length: 5200 }, (_, i) => [`${token(6)}-${i}`, `Mozilla/5.0 (${token(10)}; ${token(8)}) ${token(14)}/${i % 140}.0`, i % 7]);

const analytics = `/*! InsightPulse Analytics SDK v8.14.2 | (c) InsightPulse Inc. */
(function () {
  var DEVICES = ${JSON.stringify(devices)};
  var start = performance.now();
  function fnv(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Device fingerprint + UA matching, computed eagerly at load.
  var ua = navigator.userAgent, fp = 0, matched = null;
  for (var round = 0; round < 6; round++) {
    for (var i = 0; i < DEVICES.length; i++) {
      var d = DEVICES[i];
      fp = (fp + fnv(d[1] + ua + round)) >>> 0;
      if (new RegExp(d[0].replace(/[^a-z]/g, '') + '$').test(ua)) matched = d[0];
    }
  }
  var queue = [];
  function track(name, props) {
    queue.push({ e: name, p: props || {}, t: Date.now(), u: location.pathname, fp: fp });
  }
  function flush() {
    if (!queue.length) return;
    try { navigator.sendBeacon('http://localhost:${PORT}/collect', JSON.stringify(queue.splice(0))); } catch (e) {}
  }
  window.InsightPulse = { track: track, fingerprint: fp, device: matched, initMs: performance.now() - start };
  track('page_view');
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  setInterval(flush, 10000);
})();
`;

const phrases = Array.from({ length: 1800 }, () => [token(8), `${token(5)} ${token(9)} ${token(7)} ${token(4)}`]);

const chat = `/*! HelloDesk Chat Widget v3.2.0 | (c) HelloDesk Ltd.
 *
 * Embedding: include this script. The widget renders its launcher inside an
 * element with id="hellodesk-launcher" if one exists; otherwise it shows a
 * "We're online" bar at the top of the page.
 */
(function () {
  var I18N = ${JSON.stringify(phrases)};
  var dict = {};
  for (var i = 0; i < I18N.length; i++) { dict[I18N[i][0]] = I18N[i][1].split(' ').reverse().join(' '); }
  function mount(status) {
    var host = document.getElementById('hellodesk-launcher');
    var bar = document.createElement('div');
    bar.setAttribute('data-hellodesk', '');
    bar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;background:#0f172a;color:#fff;font:500 14px/1.4 system-ui,sans-serif';
    bar.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:#22c55e;display:inline-block"></span>' +
      '<span>' + status.agents + ' agents online · Avg. reply ' + status.replyMinutes + ' min</span>' +
      '<button style="margin-left:auto;background:#22c55e;color:#0f172a;border:0;border-radius:999px;padding:6px 14px;font-weight:600">Chat</button>';
    if (host) { host.appendChild(bar); } else { document.body.insertBefore(bar, document.body.firstChild); }
  }
  function boot() {
    fetch('http://localhost:${PORT}/chat/status').then(function (r) { return r.json(); }).then(mount).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.HelloDesk = { version: '3.2.0', dict: dict };
})();
`;

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const common = { 'timing-allow-origin': '*', 'access-control-allow-origin': '*' };
  if (url.pathname === '/analytics.js' || url.pathname === '/chat-widget.js') {
    res.writeHead(200, { ...common, 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=3600' });
    res.end(url.pathname === '/analytics.js' ? analytics : chat);
    return;
  }
  if (url.pathname === '/chat/status') {
    setTimeout(() => {
      res.writeHead(200, { ...common, 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ agents: 4, replyMinutes: 2 }));
    }, 400);
    return;
  }
  if (url.pathname === '/collect') {
    req.resume();
    res.writeHead(204, common);
    res.end();
    return;
  }
  res.writeHead(404, common);
  res.end();
});

server.listen(PORT, () => {
  console.log(`third-party vendors on http://localhost:${PORT} (analytics.js ${(analytics.length / 1024).toFixed(0)} KB, chat-widget.js ${(chat.length / 1024).toFixed(0)} KB)`);
});
