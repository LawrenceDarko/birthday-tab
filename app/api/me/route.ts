import { currentOrganizer, ownedBills } from '@/lib/auth';
import { db, json, safeEqual } from '@/lib/server';
import type { Account } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** The signed-in organizer and their bills, or { account: null }. */
export async function GET() {
  const me = await currentOrganizer();
  if (!me) return json({ account: null });
  const account: Account = { email: me.email, bills: await ownedBills(me.id) };
  return json({ account });
}

/**
 * Adds bills to the signed-in organizer's account. Each entry must carry the bill's organizer key,
 * and bills that already belong to an account are left alone.
 */
export async function POST(req: Request) {
  const me = await currentOrganizer();
  if (!me) return json({ account: null });
  const body = await req.json().catch(() => null);
  const list: { id: string; adminKey: string }[] = (Array.isArray(body?.bills) ? body.bills : [])
    .slice(0, 50)
    .map((b: any) => ({ id: String(b?.id ?? '').slice(0, 16), adminKey: String(b?.adminKey ?? '') }))
    .filter((b: { id: string; adminKey: string }) => b.id && b.adminKey);
  if (list.length) {
    const { data } = await db()
      .from('bills')
      .select('id, admin_key')
      .in('id', list.map((b) => b.id))
      .is('owner_id', null);
    const ok = (data || [])
      .filter((r: any) => list.some((b) => b.id === r.id && safeEqual(b.adminKey, String(r.admin_key))))
      .map((r: any) => r.id);
    if (ok.length) await db().from('bills').update({ owner_id: me.id }).in('id', ok).is('owner_id', null);
  }
  const account: Account = { email: me.email, bills: await ownedBills(me.id) };
  return json({ account });
}
