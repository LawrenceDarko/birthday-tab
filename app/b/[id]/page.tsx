'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BillResponse, Claims } from '@/lib/types';
import { computeSplit, fmt, honName, num, qtyOf } from '@/lib/split';
import { api, ls, lsSet, newId } from '@/lib/client';

async function sha10(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10);
}

type Sync = 'idle' | 'saving' | 'saved' | 'error';

export default function GuestPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [data, setData] = useState<BillResponse | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [guestId, setGuestId] = useState('');
  const [pid, setPid] = useState('');
  const [name, setName] = useState('');
  const [claims, setClaims] = useState<Claims>({});
  const [sync, setSync] = useState<Sync>('idle');
  const [syncErr, setSyncErr] = useState('');
  const [needName, setNeedName] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);

  useEffect(() => {
    let gid = ls<string>(`bt:gid:${id}`, '');
    if (!gid) {
      gid = newId(24);
      lsSet(`bt:gid:${id}`, gid);
    }
    setGuestId(gid);
    sha10(gid).then(setPid);
    setName(ls(`bt:name`, ''));
    setClaims(ls<Claims>(`bt:claims:${id}`, {}));
  }, [id]);

  const load = useCallback(async () => {
    try {
      const d = await api.get(id);
      setData(d);
      setLoadErr('');
    } catch (e: any) {
      setLoadErr(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 4000);
    return () => clearInterval(t);
  }, [load]);

  // When this device has no local picks yet but the server has some (e.g. storage was cleared), adopt them once.
  useEffect(() => {
    if (!data || !pid || dirty.current) return;
    const mine = data.guests.find((g) => g.pid === pid);
    if (mine && !Object.keys(claims).length && Object.keys(mine.claims).length) {
      setClaims(mine.claims);
      if (!name) setName(mine.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pid]);

  // Save picks shortly after each change.
  useEffect(() => {
    if (!dirty.current || !guestId) return;
    lsSet(`bt:claims:${id}`, claims);
    lsSet('bt:name', name);
    if (!name.trim()) return;
    setSync('saving');
    const t = setTimeout(async () => {
      try {
        await api.claim(id, guestId, name.trim(), claims);
        setSync('saved');
        setSyncErr('');
        load();
      } catch (e: any) {
        setSync('error');
        setSyncErr(e.message);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [claims, name, guestId, id, load]);

  const bill = data?.bill;
  const everyone = useMemo(() => {
    if (!data) return [];
    const others = data.guests.filter((g) => g.pid !== pid);
    return [...others, { pid: pid || 'me', name: name.trim() || 'You', claims }];
  }, [data, pid, name, claims]);
  const split = useMemo(() => (bill ? computeSplit(bill, everyone) : null), [bill, everyone]);
  const me = split?.shares.get(pid || 'me');

  function change(next: Claims) {
    dirty.current = true;
    setClaims(next);
    if (!name.trim()) {
      setNeedName(true);
      nameRef.current?.focus();
    }
  }

  if (loadErr && !data)
    return (
      <main className="wrap">
        <div className="banner">{loadErr}</div>
      </main>
    );
  if (!bill || !split)
    return (
      <main className="wrap">
        <span className="muted">Loading the bill</span>
      </main>
    );

  return (
    <main className="wrap">
      <header className="head">
        <span className="eyebrow">{bill.merchant || 'Bill'}</span>
        {bill.title.trim() && <h1>{bill.title}</h1>}
        <span className="muted small">
          Tap what you had. If others pick the same dish, it is split between you automatically. Tax
          {num(bill.gratuity) > 0 ? ', gratuity' : ''}
          {bill.tipMode !== 'none' ? ' and tip' : ''} are shared by how much you ordered.
        </span>
      </header>

      <section className="panel">
        <label className="field" htmlFor="g-name">
          Your name
          <input
            id="g-name"
            ref={nameRef}
            type="text"
            autoComplete="given-name"
            placeholder="e.g. Kofi"
            value={name}
            onChange={(e) => {
              dirty.current = true;
              setName(e.target.value);
              if (e.target.value.trim()) setNeedName(false);
            }}
          />
        </label>
        {needName && !name.trim() && <div className="banner">Add your name so the organizer knows these are yours.</div>}
      </section>

      <section className="items" aria-label="Receipt items">
        {split.items.map((st) => {
          const it = st.item;
          const q = qtyOf(it);
          if (st.group)
            return (
              <div className="item locked" key={it.id}>
                <span className="lead"><span className="nm">{it.name}</span></span>
                <span className="pr">{fmt(num(it.price))}</span>
                <span className="sub">{honName(bill)}&apos;s, covered by the group</span>
              </div>
            );
          const mine = claims[it.id] || 0;
          const on = mine > 0;
          const others = st.claimers.filter((c) => c.pid !== (pid || 'me'));
          const myLine = me?.lines.find((l) => l.item.id === it.id);
          let sub = q > 1 ? `${q} × ${fmt(num(it.price) / q)}` : '';
          if (others.length) sub += (sub ? ' · ' : '') + (on ? 'Also: ' : 'Picked by ') + others.map((o) => o.name + (q > 1 ? ` (${o.units})` : '')).join(', ');
          if (on && myLine && Math.abs(myLine.amount - num(it.price)) > 0.005) sub += (sub ? ' · ' : '') + `Your part ${fmt(myLine.amount)}`;
          return (
            <div key={it.id}>
              <button
                type="button"
                className="item"
                aria-pressed={on}
                onClick={() => {
                  const next = { ...claims };
                  if (on) delete next[it.id];
                  else next[it.id] = 1;
                  change(next);
                }}
              >
                <span className="lead">
                  <span className="tick" aria-hidden="true">{on ? '✓' : ''}</span>
                  <span className="nm">{it.name}</span>
                </span>
                <span className="pr">{fmt(num(it.price))}</span>
                {sub && <span className="sub">{sub}</span>}
              </button>
              {on && q > 1 && (
                <div className="stepper">
                  I had
                  <button type="button" aria-label="Fewer" onClick={() => change({ ...claims, [it.id]: Math.max(1, mine - 1) })}>−</button>
                  <b>{mine}</b>
                  <button type="button" aria-label="More" onClick={() => change({ ...claims, [it.id]: Math.min(q, mine + 1) })}>+</button>
                  of {q}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="receipt" aria-label="Your total">
        <div className="lines">
          {!me?.lines.length && <div className="muted">Tap the items you had to see your total.</div>}
          {me?.lines.map((l) => (
            <div className="ln" key={l.item.id}>
              <span>
                {l.item.name}
                {qtyOf(l.item) > 1 ? ` ×${l.units}` : ''}
                {l.sharedWith > 1 ? ` (shared ${l.sharedWith} ways)` : ''}
              </span>
              <span>{fmt(l.amount)}</span>
            </div>
          ))}
          {!!me?.lines.length && (
            <>
              <div className="rule" />
              <div className="ln"><span>Your items</span><span>{fmt(me.items)}</span></div>
              {num(bill.tax) > 0 && <div className="ln muted"><span>Tax</span><span>{fmt(me.tax)}</span></div>}
              {num(bill.gratuity) > 0 && <div className="ln muted"><span>Gratuity (on the bill)</span><span>{fmt(me.gratuity)}</span></div>}
              {num(bill.fees) > 0 && <div className="ln muted"><span>Fees</span><span>{fmt(me.fees)}</span></div>}
              {me.tip > 0 && (
                <div className="ln muted">
                  <span>Tip{bill.tipMode === 'percent' ? ` (${num(bill.tipPercent)}%)` : ''}</span>
                  <span>{fmt(me.tip)}</span>
                </div>
              )}
              {me.honoree > 0 && (
                <div className="ln muted">
                  <span>Your part of {honName(bill)}&apos;s meal (÷ {split.payers})</span>
                  <span>{fmt(me.honoree)}</span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="rule" />
        <div className="grand"><span className="eyebrow">You owe</span><span className="v">{fmt(me?.total || 0)}</span></div>
        {!!me?.lines.length && (
          <div className="muted small" style={{ marginTop: 8 }}>
            Your total can change if someone else picks a dish you picked, since it is then shared.
          </div>
        )}
      </section>

      {!!me?.lines.length && (
        <div className="paybar" role="status">
          <div className="in">
            <span>
              <span className="eyebrow">You owe</span>
              <br />
              <span className="amt">{fmt(me.total)}</span>
            </span>
            <span className="small muted right">
              {!name.trim() ? (
                <button type="button" className="btn" onClick={() => nameRef.current?.focus()}>Add your name</button>
              ) : sync === 'error' ? (
                <><span className="dot off" />{syncErr || 'Not saved. Check your connection.'}</>
              ) : sync === 'saving' ? (
                <><span className="dot busy" />Saving</>
              ) : (
                <><span className="dot" />Sent to the organizer</>
              )}
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
