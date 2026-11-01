let tick = 0;

export async function GET() {
  tick++;
  const pages = Array.from({ length: 200 }, (_, i) => `/products/${((tick * 31 + i * 17) % 5000) + 1}`);
  return Response.json({ visitors: 120 + ((tick * 7) % 40), pages }, { headers: { 'Cache-Control': 'no-store' } });
}
