// Server-only organizer accounts: scrypt password hashes and an httpOnly session cookie.
import { cookies } from 'next/headers';
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { db } from './server';
import type { MyBill } from './types';

const COOKIE = 'bt_session';
const SESSION_DAYS = 90;

function scrypt(password: string, salt: Buffer, len: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, len, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64');
  const got = await scrypt(password, Buffer.from(salt, 'base64'), want.length);
  return timingSafeEqual(got, want);
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function cleanEmail(x: unknown) {
  const email = String(x ?? '').trim().toLowerCase().slice(0, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export async function startSession(organizerId: string) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const { error } = await db()
    .from('sessions')
    .insert({ token_hash: tokenHash(token), organizer_id: organizerId, expires_at: expires.toISOString() });
  if (error) throw error;
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  });
}

export async function endSession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) await db().from('sessions').delete().eq('token_hash', tokenHash(token));
  cookies().delete(COOKIE);
}

/** The signed-in organizer, or null. */
export async function currentOrganizer(): Promise<{ id: string; email: string } | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const { data } = await db()
    .from('sessions')
    .select('expires_at, organizers(id, email)')
    .eq('token_hash', tokenHash(token))
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  const o = data.organizers as any;
  return o ? { id: o.id, email: o.email } : null;
}

export async function ownedBills(organizerId: string): Promise<MyBill[]> {
  const { data } = await db()
    .from('bills')
    .select('id, admin_key, data, created_at')
    .eq('owner_id', organizerId)
    .order('created_at', { ascending: false });
  return (data || []).map((r: any) => ({
    id: r.id,
    adminKey: r.admin_key,
    title: r.data?.title || r.data?.merchant || 'Bill',
    createdAt: r.created_at,
  }));
}
