import { endSession } from '@/lib/auth';
import { json } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  await endSession();
  return json({ ok: true });
}
