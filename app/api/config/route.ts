import { json } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json({
    scanEnabled: !!process.env.OPENAI_API_KEY,
  });
}
