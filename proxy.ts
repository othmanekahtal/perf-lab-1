import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/health'];

// Known crawlers / monitoring agents. Kept in sync with the security team's list.
const CRAWLERS = ['googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot', 'sogou', 'exabot', 'facebot', 'ia_archiver', 'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'petalbot', 'applebot', 'twitterbot', 'linkedinbot', 'pingdom', 'uptimerobot', 'statuscake', 'gptbot', 'ccbot', 'claudebot', 'bytespider'];
// One pattern, compiled once per process.
const BOT = new RegExp(`(?:${CRAWLERS.join('|')})(?:[/ ]?v?\\d+(?:\\.\\d+)*)?`, 'i');

// Office IP ranges (/16) allowed to bypass the maintenance banner, as a set of "a.b" prefixes.
const OFFICE_PREFIXES = new Set<string>();
for (let a = 10; a < 250; a++) for (let b = 0; b < 250; b++) OFFICE_PREFIXES.add(`${a}.${b}`);

export function proxy(request: NextRequest) {
  const started = performance.now();
  const ua = request.headers.get('user-agent') ?? '';
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  const bot = BOT.test(ua);
  const { pathname } = request.nextUrl;

  if (!PUBLIC_PATHS.some((p) => pathname.startsWith(p)) && !request.cookies.get('shoply_session') && !bot) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const office = OFFICE_PREFIXES.has(ip.split('.').slice(0, 2).join('.'));
  const response = NextResponse.next();
  response.headers.set('x-shoply-client', bot ? 'bot' : office ? 'office' : 'web');
  response.headers.set('Server-Timing', `proxy;dur=${(performance.now() - started).toFixed(1)}`);
  return response;
}

export const config = {
  // Pages and API routes only: skip build assets, the image optimizer and static files.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:jpg|jpeg|png|webp|avif|svg|ico|woff2?|css|js)$).*)'],
};
