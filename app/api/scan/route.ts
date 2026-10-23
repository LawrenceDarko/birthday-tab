import { currentOrganizer } from '@/lib/auth';
import { adminOk, json } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PROMPT = `This image is a photo of a restaurant receipt. Read it carefully and reply with only a JSON object of this shape, no other text:
{"merchant": string, "items": [{"name": string, "qty": integer, "price": number}], "subtotal": number, "tax": number, "gratuity": number, "fees": number, "total": number}
Rules: "price" is the LINE TOTAL printed for that row (already multiplied by quantity). Include every ordered food and drink line, and include modifiers or add-ons that carry their own price as separate items. Do not put subtotal, tax, tip, gratuity, service charge, discount or total rows in "items". Apply a discount by lowering the affected item price, or as a negative-price item if it applies to the whole order. "gratuity" is any automatic gratuity or service charge already added to the bill, else 0. "fees" is the sum of other surcharges (kitchen, credit card, delivery), else 0. "tax" is the sum of all tax lines. Use plain numbers without currency symbols. Use 0 for anything not printed. Keep item names short and readable, fixing obvious abbreviations.`;

export async function POST(req: Request) {
  const billId = req.headers.get('x-bill-id');
  const allowed = billId
    ? await adminOk(billId, req.headers.get('x-admin-key'))
    : !!(await currentOrganizer());
  if (!allowed)
    return json(
      {
        error: billId
          ? 'This organizer link is not valid for this bill, so it cannot scan.'
          : 'Sign in to scan a receipt.',
      },
      403,
    );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: 'Scanning is not set up. Add OPENAI_API_KEY on the server.' }, 501);

  const body = await req.json().catch(() => null);
  const image = String(body?.image || '');
  const mediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(body?.mediaType) ? body.mediaType : 'image/jpeg';
  if (!image || image.length > 6_000_000) return json({ error: 'The photo is missing or too large.' }, 400);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-6-astra',
      max_completion_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${image}`, detail: 'high' } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('OpenAI error', res.status, detail.slice(0, 500));
    const msg =
      res.status === 401
        ? 'The OpenAI API key on the server is not valid.'
        : res.status === 429
          ? 'OpenAI rate limit or quota reached. Check the API account has credit, then try again.'
          : 'Could not read the receipt. Try again.';
    return json({ error: msg }, 502);
  }
  const out = await res.json();
  const content = out?.choices?.[0]?.message?.content;
  const text: string = typeof content === 'string' ? content : Array.isArray(content) ? content.map((c: any) => c?.text || '').join('') : '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed?.items) || !parsed.items.length) throw new Error('no items');
    return json({ receipt: parsed });
  } catch {
    return json({ error: 'Could not find items on that photo. Retake it flat and in good light.' }, 422);
  }
}
