import { cleanEmail, hashPassword, startSession } from '@/lib/auth';
import { db, json, passcodeOk, randomId } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Signed-in organizers skip the passcode, so creating an account needs it.
  if (!passcodeOk(req.headers.get('x-passcode')))
    return json({ error: 'Enter the organizer passcode to create an account.' }, 401);
  const body = await req.json().catch(() => null);
  const email = cleanEmail(body?.email);
  const password = String(body?.password ?? '');
  if (!email) return json({ error: 'Enter a valid email address.' }, 400);
  if (password.length < 8) return json({ error: 'Use a password of at least 8 characters.' }, 400);
  if (password.length > 200) return json({ error: 'That password is too long.' }, 400);

  const id = randomId(12);
  const { error } = await db()
    .from('organizers')
    .insert({ id, email, password_hash: await hashPassword(password) });
  if (error?.code === '23505') return json({ error: 'An account with that email already exists. Sign in instead.' }, 409);
  if (error) return json({ error: 'Could not create the account.' }, 500);
  await startSession(id);
  return json({ ok: true });
}
