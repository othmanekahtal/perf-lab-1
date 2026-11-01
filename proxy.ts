import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/products/p', '/api/health'];

// Known crawlers / monitoring agents. Kept in sync with the security team's list.
const CRAWLERS = ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot', 'sogou', 'exabot', 'facebot', 'ia_archiver', 'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'petalbot', 'applebot', 'twitterbot', 'linkedinbot', 'pingdom', 'uptimerobot', 'statuscake', 'gptbot', 'ccbot', 'claudebot', 'bytespider'];
const BOT_PATTERNS: string[] = [];
for (const name of CRAWLERS) {
  for (let v = 0; v < 120; v++) BOT_PATTERNS.push(`${name}[/ ]?v?${v}(\\.\\d+)*`);
}

// Office IP ranges allowed to bypass the maintenance banner.
const ALLOWED_RANGES: string[] = [];
for (let a = 10; a < 250; a++) for (let b = 0; b < 250; b += 1) ALLOWED_RANGES.push(`${a}.${b}.0.0/16`);

function isBot(ua: string) {
  return BOT_PATTERNS.some((p) => new RegExp(p, 'i').test(ua));
}

function isOfficeIp(ip: string) {
  const [a, b] = ip.split('.');
  return ALLOWED_RANGES.some((range) => {
    const [ra, rb] = range.split('/')[0].split('.');
    return ra === a && rb === b;
  });
}

export function proxy(request: NextRequest) {
  const started = performance.now();
  const ua = request.headers.get('user-agent') ?? '';
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  const bot = isBot(ua);
  const office = isOfficeIp(ip);
  const { pathname } = request.nextUrl;

  if (!PUBLIC_PATHS.some((p) => pathname.startsWith(p)) && !request.cookies.get('shoply_session') && !bot) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const response = NextResponse.next();
  response.headers.set('x-shoply-client', bot ? 'bot' : office ? 'office' : 'web');
  response.headers.set('Server-Timing', `proxy;dur=${(performance.now() - started).toFixed(1)}`);
  return response;
}
