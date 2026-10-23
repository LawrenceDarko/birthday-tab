import { adminOk, db, json, sanitizeBill } from '@/lib/server';
import type { PublicGuest } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { data: bill } = await db().from('bills').select('data').eq('id', params.id).maybeSingle();
  if (!bill) return json({ error: 'This bill does not exist.' }, 404);
  const { data: rows } = await db()
    .from('guests')
    .select('pid,name,claims,updated_at')
    .eq('bill_id', params.id)
    .order('updated_at', { ascending: true });
  const guests: PublicGuest[] = (rows || []).map((r: any) => ({
    pid: r.pid,
    name: r.name,
    claims: r.claims || {},
    updatedAt: r.updated_at,
  }));
  return json({ bill: bill.data, guests });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!(await adminOk(params.id, req.headers.get('x-admin-key')))) return json({ error: 'Not allowed.' }, 403);
  const body = await req.json().catch(() => null);
  const bill = sanitizeBill(body?.bill);
  const { error } = await db()
    .from('bills')
    .update({ data: bill, updated_at: new Date().toISOString() })
    .eq('id', params.id);
  if (error) return json({ error: 'Could not save.' }, 500);
  return json({ ok: true, bill });
}
