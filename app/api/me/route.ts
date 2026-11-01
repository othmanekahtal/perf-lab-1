import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  return Response.json(user, { headers: { 'Cache-Control': 'no-store' } });
}
