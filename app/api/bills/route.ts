import { currentOrganizer } from '@/lib/auth';
import { db, json, randomId, sanitizeBill } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const me = await currentOrganizer();
  if (!me) return json({ error: 'Sign in to create a bill.' }, 401);
  const body = await req.json().catch(() => null);
  const bill = sanitizeBill(body?.bill);
  if (!bill.items.length) return json({ error: 'Add at least one item.' }, 400);

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomId(8);
    const adminKey = randomId(24);
    const { error } = await db().from('bills').insert({ id, admin_key: adminKey, data: bill, owner_id: me.id });
    if (!error) return json({ id, adminKey });
    if (error.code !== '23505') return json({ error: 'Could not create the bill.' }, 500);
  }
  return json({ error: 'Could not create the bill.' }, 500);
}
