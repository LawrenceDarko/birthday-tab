import { adminOk, db, json, publicId, sanitizeClaims } from '@/lib/server';

export const dynamic = 'force-dynamic';

/** A guest saves their own name and claims. guestId is a secret that lives only in their browser. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const guestId = String(body?.guestId || '');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(guestId)) return json({ error: 'Bad guest id.' }, 400);
  const name = String(body?.name || '').trim().slice(0, 40);
  if (!name) return json({ error: 'Enter your name first.' }, 400);

  const { data: bill } = await db().from('bills').select('id').eq('id', params.id).maybeSingle();
  if (!bill) return json({ error: 'This bill does not exist.' }, 404);

  const { error } = await db()
    .from('guests')
    .upsert(
      {
        bill_id: params.id,
        guest_id: guestId,
        pid: publicId(guestId),
        name,
        claims: sanitizeClaims(body?.claims),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'bill_id,guest_id' },
    );
  if (error) return json({ error: 'Could not save your picks.' }, 500);
  return json({ ok: true, pid: publicId(guestId) });
}

/** The organizer removes a guest (for duplicates or test entries). */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!(await adminOk(params.id, req.headers.get('x-admin-key')))) return json({ error: 'Not allowed.' }, 403);
  const pid = new URL(req.url).searchParams.get('pid') || '';
  const { error } = await db().from('guests').delete().eq('bill_id', params.id).eq('pid', pid);
  if (error) return json({ error: 'Could not remove.' }, 500);
  return json({ ok: true });
}
