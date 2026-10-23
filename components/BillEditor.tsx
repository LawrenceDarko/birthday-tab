'use client';
import { useEffect, useState } from 'react';
import type { Bill, Item, TipMode } from '@/lib/types';
import { fmt, honName, num, qtyOf, r2, totals } from '@/lib/split';
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
    if (num(text) !== props.value) setText(String(props.value ?? ''));
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
  scanAuth,
  scanEnabled,
}: {
  bill: Bill;
  onChange: (b: Bill) => void;
  scanAuth: Record<string, string>;
  scanEnabled: boolean;
}) {
  const [scan, setScan] = useState<{ busy: boolean; msg: string; err: string }>({ busy: false, msg: '', err: '' });
  const set = (patch: Partial<Bill>) => onChange({ ...bill, ...patch });
  const setItem = (id: string, patch: Partial<Item>) =>
    set({ items: bill.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

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
        msg: `Found ${items.length} items. Check them against the receipt and mark ${honName(bill)}'s items.`,
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
                People splitting her meal
                <input
                  id="d-payers"
                  className="num"
                  type="text"
                  inputMode="numeric"
                  placeholder="Everyone who joins"
                  value={payersLabel}
                  onChange={(e) => {
                    const v = Math.floor(num(e.target.value.replace(/\D/g, '')));
                    set({ payersOverride: v > 0 ? v : null });
                  }}
                />
              </label>
            </div>
            <span className="muted small">
              Mark her items below. Their cost with tax and tip is split evenly among everyone who claims something, unless you set a number.
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
            {bill.coverHonoree && (
              <label className="hon" htmlFor={`h-${it.id}`}>
                <input id={`h-${it.id}`} type="checkbox" checked={!!it.honoree} onChange={(e) => setItem(it.id, { honoree: e.target.checked })} />
                {honName(bill)}&apos;s item
              </label>
            )}
          </div>
        ))}
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

      <section className="receipt">
        <div className="lines">
          <div className="ln"><span>Items subtotal</span><span>{fmt(t.sub)}</span></div>
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
        {num(bill.receiptSubtotal) > 0 && Math.abs(r2(t.sub) - r2(num(bill.receiptSubtotal))) > 0.009 && (
          <div className="banner" style={{ marginTop: 10 }}>
            Items add up to {fmt(t.sub)} but the receipt subtotal reads {fmt(num(bill.receiptSubtotal))}. Check for a missed or misread line.
          </div>
        )}
        {bill.items.some((i) => qtyOf(i) > 1) && (
          <div className="muted small" style={{ marginTop: 10 }}>For items with a quantity above 1, guests pick how many they had.</div>
        )}
      </section>
    </>
  );
}
