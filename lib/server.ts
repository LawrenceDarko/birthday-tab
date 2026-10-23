// Server-only helpers. Never import this file from a client component.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { Bill, Claims, Item, TipMode } from './types';

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  // Next.js caches server-side fetch GETs by default; supabase-js uses fetch, so opt out or reads go stale.
  client = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  return client;
}

const ALPHA = 'abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomId(len: number) {
  const bytes = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHA[bytes[i] % ALPHA.length];
  return s;
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function publicId(guestId: string) {
  return createHash('sha256').update(guestId).digest('hex').slice(0, 10);
}

export async function adminOk(billId: string, key: string | null) {
  if (!key) return false;
  const { data } = await db().from('bills').select('admin_key').eq('id', billId).maybeSingle();
  return !!data && safeEqual(String(data.admin_key), key);
}

const n = (x: unknown, min = 0, max = 1e6) => {
  const v = typeof x === 'number' ? x : parseFloat(String(x));
  if (!Number.isFinite(v)) return 0;
  return Math.min(max, Math.max(min, Math.round(v * 100) / 100));
};
const s = (x: unknown, max: number) => String(x ?? '').slice(0, max);

export function sanitizeBill(input: any): Bill {
  const tipMode: TipMode = ['percent', 'amount', 'none'].includes(input?.tipMode) ? input.tipMode : 'percent';
  const items: Item[] = (Array.isArray(input?.items) ? input.items : []).slice(0, 200).map((it: any) => ({
    id: s(it?.id, 16).replace(/[^A-Za-z0-9_-]/g, '') || randomId(6),
    name: s(it?.name, 80),
    qty: Math.max(1, Math.min(99, Math.floor(n(it?.qty, 1, 99)) || 1)),
    price: n(it?.price, -1e5, 1e5),
    honoree: !!it?.honoree,
  }));
  const po = Math.floor(n(input?.payersOverride, 0, 500));
  return {
    title: s(input?.title, 80),
    merchant: s(input?.merchant, 60),
    honoree: s(input?.honoree, 40),
    coverHonoree: !!input?.coverHonoree,
    payersOverride: po > 0 ? po : null,
    items,
    tax: n(input?.tax),
    gratuity: n(input?.gratuity),
    fees: n(input?.fees),
    tipMode,
    tipPercent: n(input?.tipPercent, 0, 100),
    tipAmount: n(input?.tipAmount),
    receiptSubtotal: n(input?.receiptSubtotal),
    receiptTotal: n(input?.receiptTotal),
    pay: {
      name: s(input?.pay?.name, 40).trim(),
      venmo: s(input?.pay?.venmo, 40).replace(/[^A-Za-z0-9_-]/g, ''),
      cashapp: s(input?.pay?.cashapp, 30).replace(/[^A-Za-z0-9_]/g, ''),
      zelle: s(input?.pay?.zelle, 80).trim(),
      applePay: s(input?.pay?.applePay, 80).trim(),
    },
  };
}

export function sanitizeClaims(input: any): Claims {
  const out: Claims = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input).slice(0, 200)) {
    const id = String(k).slice(0, 16).replace(/[^A-Za-z0-9_-]/g, '');
    const u = Math.floor(Number(v));
    if (id && Number.isFinite(u) && u > 0) out[id] = Math.min(u, 99);
  }
  return out;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
