import { cleanEmail, startSession, verifyPassword } from '@/lib/auth';
import { db, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = cleanEmail(body?.email);
  const password = String(body?.password ?? '').slice(0, 200);
  const { data } = email
    ? await db().from('organizers').select('id, password_hash').eq('email', email).maybeSingle()
    : { data: null };
  if (!data || !(await verifyPassword(password, data.password_hash)))
    return json({ error: 'Wrong email or password.' }, 401);
  await startSession(data.id);
  return json({ ok: true });
}
