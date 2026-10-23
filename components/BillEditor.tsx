'use client';
import { useEffect, useState } from 'react';
import { emptyPay, type Bill, type Item, type Pay, type TipMode } from '@/lib/types';
import { fmt, honName, isDiscount, num, qtyOf, r2, totals } from '@/lib/split';
import { api, newId, photoToJpeg } from '@/lib/client';

function NumField(props: {
  id: string;
  label?: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
  inputMode?: 'decimal' | 'numeric';
  ariaLabel?: string;
}) {
  const [text, setText] = useState(String(props.value ?? ''));
  useEffect(() => {
    // Leave an emptied field alone while it is being retyped (clearing a qty of 2 must not snap back to "1").
    if (text !== '' && num(text) !== props.value) setText(String(props.value ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);
  const input = (
    <input
      id={props.id}
      className="num"
      type="text"
      inputMode={props.inputMode || 'decimal'}
      aria-label={props.ariaLabel}
      value={text}
      onBlur={() => {
        if (num(text) !== props.value || text === '') setText(String(props.value ?? ''));
      }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9.\-]/g, '');
        setText(v);
        props.onChange(num(v));
      }}
    />
  );
  if (!props.label) return input;
  return (
    <label className="field" htmlFor={props.id}>
      {props.label}
      {input}
    </label>
  );
}

export default function BillEditor({
  bill,
  onChange,
  scanAuth = {},
  scanEnabled,
  scanWarning,
}: {
  bill: Bill;
  onChange: (b: Bill) => void;
  /** Headers that allow scanning for an existing bill (its organizer key); signed-in organizers need none. */
  scanAuth?: Record<string, string>;
  scanEnabled: boolean;
  /** Extra caution shown next to the scan buttons, e.g. when guests have already picked items. */
  scanWarning?: string;
}) {
  const [scan, setScan] = useState<{ busy: boolean; msg: string; err: string }>({ busy: false, msg: '', err: '' });
  const set = (patch: Partial<Bill>) => onChange({ ...bill, ...patch });
  const setItem = (id: string, patch: Partial<Item>) =>
    set({ items: bill.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const pay = { ...emptyPay(), ...bill.pay };
  const setPay = (patch: Partial<Pay>) => set({ pay: { ...pay, ...patch } });

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setScan({ busy: true, msg: '', err: '' });
    try {
      const image = await photoToJpeg(file);
      const { receipt: r } = await api.scan(image, scanAuth);
      const items: Item[] = (r.items || [])
        .filter((x: any) => x && x.name)
        .map((x: any) => ({
          id: newId(),
          name: String(x.name).slice(0, 80),
          qty: Math.max(1, Math.floor(num(x.qty)) || 1),
          price: r2(num(x.price)),
        }));
      const gratuity = r2(num(r.gratuity));
      onChange({
        ...bill,
        items,
        merchant: r.merchant ? String(r.merchant).slice(0, 60) : bill.merchant,
        tax: r2(num(r.tax)),
        gratuity,
        fees: r2(num(r.fees)),
        receiptSubtotal: r2(num(r.subtotal)),
        receiptTotal: r2(num(r.total)),
        tipMode: gratuity > 0 ? 'none' : bill.tipMode,
      });
      setScan({
        busy: false,
        err: '',
        msg: `Found ${items.length} items. Check them against the receipt${bill.coverHonoree ? ` and mark ${honName(bill)}'s items` : ''}.`,
      });
    } catch (e: any) {
      setScan({ busy: false, msg: '', err: e?.message || 'Could not read that photo.' });
    }
  }

  const t = totals(bill);
  const payersLabel = bill.payersOverride ? String(bill.payersOverride) : '';

  return (
    <>
      <section className="panel">
        <h2>Scan the receipt</h2>
        {scanEnabled ? (
          scan.busy ? (
            <span className="btn" aria-live="polite">
              <span className="spin" aria-hidden="true" /> Reading receipt
            </span>
          ) : (
            <>
              <input id="scan-pick" className="file-in" type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} />
              <input
                id="scan-cam"
                className="file-in"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
              <div className="row">
                <label htmlFor="scan-pick" className="btn" role="button" tabIndex={0}>
                  Choose from photos
                </label>
                <label htmlFor="scan-cam" className="btn ghost" role="button" tabIndex={0}>
                  Take a photo
                </label>
              </div>
              <span className="muted small">Scanning replaces the item list. Check every line against the paper before saving.</span>
              {scanWarning && <div className="banner">{scanWarning}</div>}
            </>
          )
        ) : (
          <span className="muted small">Photo scanning is off on this server. Type the items below.</span>
        )}
        {scan.msg && <div className="banner good">{scan.msg}</div>}
        {scan.err && <div className="banner">{scan.err}</div>}
      </section>

      <section className="panel">
        <h2>Party</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="d-title">Group name (optional)</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input id="d-title" type="text" placeholder="e.g. Birthday dinner" value={bill.title} onChange={(e) => set({ title: e.target.value })} />
              <button type="button" className="icon-btn" aria-label="Delete group name" onClick={() => set({ title: '' })}>
                &times;
              </button>
            </div>
          </div>
          <label className="field" htmlFor="d-merchant">
            Restaurant
            <input id="d-merchant" type="text" value={bill.merchant} onChange={(e) => set({ merchant: e.target.value })} />
          </label>
        </div>
        <label className="check-row" htmlFor="d-cover">
          <input id="d-cover" type="checkbox" checked={bill.coverHonoree} onChange={(e) => set({ coverHonoree: e.target.checked })} />
          The group covers the birthday person&apos;s meal
        </label>
        {bill.coverHonoree && (
          <>
            <div className="row">
              <label className="field" htmlFor="d-honoree">
                Birthday person
                <input id="d-honoree" type="text" placeholder="Name" value={bill.honoree} onChange={(e) => set({ honoree: e.target.value })} />
              </label>
              <label className="field" htmlFor="d-payers">
                People splitting {bill.honoree.trim() ? `${bill.honoree.trim()}'s` : 'their'} meal
                <input
                  id="d-payers"
                  className="num"
                  type="text"
                  inputMode="numeric"
                  placeholder="Everyone who claims"
                  value={payersLabel}
                  onChange={(e) => {
                    const v = Math.floor(num(e.target.value.replace(/\D/g, '')));
                    set({ payersOverride: v > 0 ? v : null });
                  }}
                />
              </label>
            </div>
            <span className="muted small">
              Mark {honName(bill)}&apos;s items below. Their cost with tax and tip is split evenly among everyone who claims something. Set a
              number if some people who will chip in have not joined yet; if more people claim than that, it is split among all of them.
            </span>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Items</h2>
        <div className="ed-item muted small">
          <span>Item</span>
          <span>Qty</span>
          <span>Line total</span>
          <span />
        </div>
        {bill.items.map((it) => (
          <div className="ed-item" key={it.id}>
            <input id={`n-${it.id}`} type="text" aria-label="Item name" value={it.name} onChange={(e) => setItem(it.id, { name: e.target.value })} />
            <NumField id={`q-${it.id}`} ariaLabel="Quantity" inputMode="numeric" value={it.qty} onChange={(v) => setItem(it.id, { qty: Math.max(1, Math.floor(v) || 1) })} />
            <NumField id={`p-${it.id}`} ariaLabel="Line total" value={it.price} onChange={(v) => setItem(it.id, { price: v })} />
            <button type="button" className="icon-btn" aria-label={`Remove ${it.name || 'item'}`} onClick={() => set({ items: bill.items.filter((x) => x.id !== it.id) })}>
              &times;
            </button>
            {bill.coverHonoree && !isDiscount(it) && (
              <label className="hon" htmlFor={`h-${it.id}`}>
                <input id={`h-${it.id}`} type="checkbox" checked={!!it.honoree} onChange={(e) => setItem(it.id, { honoree: e.target.checked })} />
                {honName(bill)}&apos;s item
              </label>
            )}
          </div>
        ))}
        {bill.items.some(isDiscount) && (
          <span className="muted small">Lines with a negative total are discounts. Guests cannot pick them; they lower everyone&apos;s share in proportion.</span>
        )}
        <button type="button" className="btn ghost" onClick={() => set({ items: [...bill.items, { id: newId(), name: '', qty: 1, price: 0 }] })}>
          Add item
        </button>
      </section>

      <section className="panel">
        <h2>Tax, gratuity and tip</h2>
        <div className="row">
          <NumField id="d-tax" label="Tax" value={bill.tax} onChange={(v) => set({ tax: v })} />
          <NumField id="d-grat" label="Gratuity already on bill" value={bill.gratuity} onChange={(v) => set({ gratuity: v })} />
          <NumField id="d-fees" label="Other fees" value={bill.fees} onChange={(v) => set({ fees: v })} />
        </div>
        {num(bill.gratuity) > 0 && <div className="banner">Gratuity is already included. Add an extra tip only if the group wants to.</div>}
        <div className="field">
          Extra tip
          <div className="seg" role="group" aria-label="Tip type">
            {(['percent', 'amount', 'none'] as TipMode[]).map((m) => (
              <button key={m} type="button" aria-pressed={bill.tipMode === m} onClick={() => set({ tipMode: m })}>
                {m === 'percent' ? 'Percent' : m === 'amount' ? 'Amount' : 'No tip'}
              </button>
            ))}
          </div>
        </div>
        {bill.tipMode === 'percent' && (
          <NumField id="d-tipp" label="Tip percent (of pre-tax items)" value={bill.tipPercent} onChange={(v) => set({ tipPercent: v })} />
        )}
        {bill.tipMode === 'amount' && <NumField id="d-tipa" label="Tip amount" value={bill.tipAmount} onChange={(v) => set({ tipAmount: v })} />}
      </section>

      <section className="panel">
        <h2>Get paid</h2>
        <span className="muted small">Guests see these under their total so they can send you their share. Fill in any you use.</span>
        <label className="field" htmlFor="d-payname">
          Your name (optional)
          <input id="d-payname" type="text" placeholder="e.g. Ama" value={pay.name} onChange={(e) => setPay({ name: e.target.value })} />
        </label>
        <div className="row">
          <label className="field" htmlFor="d-venmo">
            Venmo username
            <input
              id="d-venmo"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="@username"
              value={pay.venmo ? `@${pay.venmo}` : ''}
              onChange={(e) => setPay({ venmo: e.target.value.replace(/[^A-Za-z0-9_-]/g, '') })}
            />
          </label>
          <label className="field" htmlFor="d-cashapp">
            Cash App $cashtag
            <input
              id="d-cashapp"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="$cashtag"
              value={pay.cashapp ? `$${pay.cashapp}` : ''}
              onChange={(e) => setPay({ cashapp: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
            />
          </label>
        </div>
        <div className="row">
          <label className="field" htmlFor="d-zelle">
            Zelle phone or email
            <input id="d-zelle" type="text" autoCapitalize="none" value={pay.zelle} onChange={(e) => setPay({ zelle: e.target.value })} />
          </label>
          <label className="field" htmlFor="d-apple">
            Apple Pay phone or email
            <input id="d-apple" type="text" autoCapitalize="none" value={pay.applePay} onChange={(e) => setPay({ applePay: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="receipt">
        <div className="lines">
          <div className="ln"><span>Items subtotal</span><span>{fmt(t.sub)}</span></div>
          {t.discount < 0 && <div className="ln muted"><span>Discounts</span><span>{fmt(t.discount)}</span></div>}
          <div className="ln muted"><span>Tax</span><span>{fmt(num(bill.tax))}</span></div>
          {num(bill.gratuity) > 0 && <div className="ln muted"><span>Gratuity</span><span>{fmt(num(bill.gratuity))}</span></div>}
          {num(bill.fees) > 0 && <div className="ln muted"><span>Fees</span><span>{fmt(num(bill.fees))}</span></div>}
          <div className="ln muted"><span>Tip</span><span>{fmt(t.tip)}</span></div>
          {bill.coverHonoree && t.hon > 0 && (
            <div className="ln muted"><span>{honName(bill)}&apos;s meal, all in</span><span>{fmt(t.honFull)}</span></div>
          )}
        </div>
        <div className="rule" />
        <div className="grand"><span className="eyebrow">Bill total</span><span className="v">{fmt(t.total)}</span></div>
        {num(bill.receiptSubtotal) > 0 &&
          Math.abs(r2(t.sub) - r2(num(bill.receiptSubtotal))) > 0.009 &&
          Math.abs(r2(t.sub + t.discount) - r2(num(bill.receiptSubtotal))) > 0.009 && (
          <div className="banner" style={{ marginTop: 10 }}>
            Items add up to {fmt(t.sub + t.discount)} but the receipt subtotal reads {fmt(num(bill.receiptSubtotal))}. Check for a missed or misread line.
          </div>
        )}
        {num(bill.receiptTotal) > 0 && Math.abs(r2(t.total - t.tip) - r2(num(bill.receiptTotal))) > 0.009 && (
          <div className="banner" style={{ marginTop: 10 }}>
            Before the extra tip this bill comes to {fmt(t.total - t.tip)}, but the receipt total reads {fmt(num(bill.receiptTotal))}. Check the
            items, tax and fees.
          </div>
        )}
        {bill.items.some((i) => qtyOf(i) > 1) && (
          <div className="muted small" style={{ marginTop: 10 }}>For items with a quantity above 1, guests pick how many they had.</div>
        )}
      </section>
    </>
  );
}
