// Parses the route table printed by `next build` into a rendering mode per route.

export type RenderMode = 'static' | 'ssg' | 'partial' | 'dynamic' | 'unknown';

const SYMBOLS: Record<string, RenderMode> = { '○': 'static', '●': 'ssg', '◐': 'partial', 'ƒ': 'dynamic', 'λ': 'dynamic' };

export function parseRenderModes(log: string): Record<string, RenderMode> {
  const modes: Record<string, RenderMode> = {};
  const clean = log.replace(/\x1b\[[0-9;]*m/g, '');
  for (const line of clean.split('\n')) {
    const m = line.match(/^[┌├└│][\s│├└┌]*([○●◐ƒλ])\s+(\/\S*)/); // nested lines look like "│ └ ◐ /orders/[id]"
    if (m) modes[m[2]] = SYMBOLS[m[1]] ?? 'unknown';
  }
  return modes;
}

/** Key routes and how many of them can be served from a prerendered (static or partial) shell. */
export const KEY_ROUTES = ['/', '/products', '/products/[id]', '/orders', '/orders/[id]', '/settings'];

export function prerenderedCount(modes: Record<string, RenderMode>) {
  return KEY_ROUTES.filter((r) => modes[r] === 'static' || modes[r] === 'partial' || modes[r] === 'ssg').length;
}
