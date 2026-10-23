import { adminOk, db, json, sanitizeBill } from '@/lib/server';
import type { PublicGuest } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
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
  // The organizer page sends its key so it can tell a wrong link apart from a working one.
  const key = req.headers.get('x-admin-key');
  const admin = key ? await adminOk(params.id, key) : undefined;
  return json({ bill: bill.data, guests, admin });
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

/** Renames the bill without touching anything else on it. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await adminOk(params.id, req.headers.get('x-admin-key')))) return json({ error: 'Not allowed.' }, 403);
  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? '').trim().slice(0, 80);
  const { data: row } = await db().from('bills').select('data').eq('id', params.id).maybeSingle();
  if (!row) return json({ error: 'This bill does not exist.' }, 404);
  const bill = sanitizeBill({ ...row.data, title });
  const { error } = await db()
    .from('bills')
    .update({ data: bill, updated_at: new Date().toISOString() })
    .eq('id', params.id);
  if (error) return json({ error: 'Could not rename.' }, 500);
  return json({ ok: true, bill });
}

/** Deletes the bill and, through the foreign key, every guest's picks. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!(await adminOk(params.id, req.headers.get('x-admin-key')))) return json({ error: 'Not allowed.' }, 403);
  const { error } = await db().from('bills').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete the bill.' }, 500);
  return json({ ok: true });
}
