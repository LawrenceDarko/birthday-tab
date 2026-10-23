import { json } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json({
    passcodeRequired: !!process.env.CREATE_PASSCODE,
    scanEnabled: !!process.env.OPENAI_API_KEY,
  });
}
