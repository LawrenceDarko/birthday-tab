'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import BillEditor from '@/components/BillEditor';
import type { Bill, BillResponse } from '@/lib/types';
import { computeSplit, fmt, honName, num, qtyOf } from '@/lib/split';
import { api, copyText, ls, lsSet, MY_BILLS, type MyBill } from '@/lib/client';

type Tab = 'live' | 'edit';

export default function AdminPage({ params, searchParams }: { params: { id: string }; searchParams: { k?: string } }) {
  const id = params.id;
  const key = searchParams.k || '';
  const [data, setData] = useState<BillResponse | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [tab, setTab] = useState<Tab>('live');
  const [draft, setDraft] = useState<Bill | null>(null);
  const [dirty, setDirty] = useState(false);
  const [save, setSave] = useState({ busy: false, msg: '', err: '' });
  const [copied, setCopied] = useState('');
  const [confirmRemove, setConfirmRemove] = useState('');
  const [open, setOpen] = useState<string>('');
  const [scanEnabled, setScanEnabled] = useState(true);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    api.config().then((c) => setScanEnabled(c.scanEnabled)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await api.get(id);
      setData(d);
      setLoadErr('');
      setDraft((cur) => cur ?? d.bill);
    } catch (e: any) {
      setLoadErr(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 3000);
    return () => clearInterval(t);
  }, [load]);

  // Remember this bill on this device so it shows on the home page.
  useEffect(() => {
    if (!data || !key) return;
    const list = ls<MyBill[]>(MY_BILLS, []);
    const title = data.bill.title || data.bill.merchant || 'Bill';
    const rest = list.filter((m) => m.id !== id);
    const prev = list.find((m) => m.id === id);
    lsSet(MY_BILLS, [{ id, adminKey: key, title, createdAt: prev?.createdAt || new Date().toISOString() }, ...rest].slice(0, 30));
  }, [data, id, key]);

  const split = useMemo(() => (data ? computeSplit(data.bill, data.guests) : null), [data]);
  const guestUrl = `${origin}/b/${id}`;

  async function doSave() {
    if (!draft) return;
    setSave({ busy: true, msg: '', err: '' });
    try {
      const r = await api.save(id, key, draft);
      setDraft(r.bill);
      setDirty(false);
      setSave({ busy: false, msg: 'Saved. Guests see the update within a few seconds.', err: '' });
      load();
    } catch (e: any) {
      setSave({ busy: false, msg: '', err: e.message === 'Not allowed.' ? 'This organizer link is not valid for this bill.' : e.message });
    }
  }

  async function remove(pid: string) {
    try {
      await api.removeGuest(id, key, pid);
      setConfirmRemove('');
      load();
    } catch (e: any) {
      setLoadErr(e.message);
    }
  }

  async function copy(text: string, what: string) {
    const ok = await copyText(text);
    setCopied(ok ? what : 'fail');
    setTimeout(() => setCopied(''), 2500);
  }

  if (!key)
    return (
      <main className="wrap">
        <div className="banner">This organizer link is missing its key. Open the link you got when you created the bill.</div>
      </main>
    );
  if (loadErr && !data)
    return (
      <main className="wrap">
        <div className="banner">{loadErr}</div>
      </main>
    );
  if (!data || !split || !draft)
    return (
      <main className="wrap">
        <span className="muted">Loading</span>
      </main>
    );

  const bill = data.bill;
  const openItems = split.items.filter((s) => !s.group && s.openFraction > 0.001);
  const doneItems = split.items.filter((s) => s.group || s.openFraction <= 0.001);
  const people = data.guests.filter((g) => g.name.trim());

  return (
    <main className="wrap">
      <header className="head">
        <span className="eyebrow">{bill.merchant || 'Bill'} · organizer</span>
        {bill.title.trim() && <h1>{bill.title}</h1>}
      </header>

      <nav className="tabs" aria-label="Sections">
        <button type="button" aria-pressed={tab === 'live'} onClick={() => setTab('live')}>Who has what</button>
        <button type="button" aria-pressed={tab === 'edit'} onClick={() => setTab('edit')}>Edit bill{dirty ? ' •' : ''}</button>
      </nav>

      {tab === 'live' && (
        <>
          <section className="panel">
            <h2>Guest link</h2>
            <span className="num small" style={{ overflowWrap: 'anywhere' }}>{guestUrl}</span>
            <div className="row">
              <button type="button" className="btn" onClick={() => copy(guestUrl, 'guest')}>
                {copied === 'guest' ? 'Copied' : 'Copy guest link'}
              </button>
              <a className="btn ghost" href={`/b/${id}`} target="_blank" rel="noreferrer">Open guest view</a>
            </div>
            {copied === 'fail' && <div className="banner">Copy did not work here. Press and hold the link above to copy it.</div>}
            <span className="muted small">
              Send this link to the group. Guests can only pick items. Keep this organizer page to yourself: anyone with its address can edit the bill.
            </span>
          </section>

          <section className="receipt">
            <div className="lines">
              <div className="ln"><span>Bill total</span><span>{fmt(split.totals.total)}</span></div>
              <div className="ln"><span>Claimed by {people.length} {people.length === 1 ? 'person' : 'people'}</span><span>{fmt(split.collected)}</span></div>
              {bill.coverHonoree && split.totals.hon > 0 && (
                <div className="ln muted">
                  <span>{honName(bill)}&apos;s meal, split {split.payers || 0} ways</span>
                  <span>{fmt(split.totals.honFull)}</span>
                </div>
              )}
            </div>
            <div className="rule" />
            <div className="grand"><span className="eyebrow">Still unclaimed</span><span className="v">{fmt(split.unclaimed)}</span></div>
            <div className="muted small" style={{ marginTop: 8 }}><span className="dot" />Updates live as guests tap items</div>
          </section>

          <section className="panel">
            <div className="ln">
              <h2>Unclaimed items</h2>
              <span className={`chip ${openItems.length ? 'none' : 'ok'}`}>{openItems.length} OPEN</span>
            </div>
            {!openItems.length ? (
              <div className="banner good">Every item has been claimed.</div>
            ) : (
              <div>
                {openItems.map((s) => {
                  const q = qtyOf(s.item);
                  const left = q > 1 ? `${Math.round(s.openFraction * q)} of ${q} left` : 'Nobody has picked this yet';
                  return (
                    <div className="person" key={s.item.id}>
                      <span>
                        <b>{s.item.name}</b>
                        <br />
                        <span className="muted small">
                          {s.claimers.length ? `${left} · ${s.claimers.map((c) => `${c.name} (${c.units})`).join(', ')}` : left}
                        </span>
                      </span>
                      <span className="right">
                        <b>{fmt(s.openAmount)}</b>
                        <span className="muted small">with tax &amp; tip</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>People</h2>
            {!people.length && <span className="muted small">Nobody has joined yet. Guests appear here as soon as they type their name and tap an item.</span>}
            <div>
              {people.map((g) => {
                const s = split.shares.get(g.pid);
                const isOpen = open === g.pid;
                return (
                  <div key={g.pid} className="person" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div className="ln">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? '' : g.pid)}
                        aria-expanded={isOpen}
                        style={{ all: 'unset', cursor: 'pointer', minWidth: 0 }}
                      >
                        <b>{g.name}</b>{' '}
                        <span className="muted small">
                          {s?.lines.length || 0} item{(s?.lines.length || 0) === 1 ? '' : 's'} {isOpen ? '▴' : '▾'}
                        </span>
                      </button>
                      <span>{fmt(s?.total || 0)}</span>
                    </div>
                    {isOpen && s && (
                      <div className="lines small" style={{ paddingTop: 8 }}>
                        {s.lines.map((l) => (
                          <div className="ln muted" key={l.item.id}>
                            <span>
                              {l.item.name}
                              {qtyOf(l.item) > 1 ? ` ×${l.units}` : ''}
                              {l.sharedWith > 1 ? ` (shared ${l.sharedWith} ways)` : ''}
                            </span>
                            <span>{fmt(l.amount)}</span>
                          </div>
                        ))}
                        <div className="ln muted">
                          <span>Tax, tip and fees</span>
                          <span>{fmt(s.tax + s.gratuity + s.fees + s.tip)}</span>
                        </div>
                        {s.honoree > 0 && (
                          <div className="ln muted"><span>Share of {honName(bill)}&apos;s meal</span><span>{fmt(s.honoree)}</span></div>
                        )}
                        {confirmRemove === g.pid ? (
                          <div className="row" style={{ paddingTop: 6 }}>
                            <button type="button" className="btn" onClick={() => remove(g.pid)}>Remove {g.name}</button>
                            <button type="button" className="btn ghost" onClick={() => setConfirmRemove('')}>Keep</button>
                          </div>
                        ) : (
                          <button type="button" className="btn ghost" style={{ marginTop: 6 }} onClick={() => setConfirmRemove(g.pid)}>
                            Remove this person
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {doneItems.length > 0 && (
            <section className="panel">
              <details>
                <summary>Claimed items ({doneItems.length})</summary>
                <div>
                  {doneItems.map((s) => (
                    <div className="person" key={s.item.id}>
                      <span>
                        {s.item.name} <span className="muted num small">{fmt(num(s.item.price))}</span>
                        <br />
                        <span className="muted small">{s.group ? `${honName(bill)}'s, covered by the group` : s.claimers.map((c) => c.name).join(', ')}</span>
                      </span>
                      <span className="chip ok">{s.group ? 'GROUP' : s.claimers.length > 1 ? `SHARED ${s.claimers.length}` : 'CLAIMED'}</span>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          )}
        </>
      )}

      {tab === 'edit' && (
        <>
          <BillEditor
            bill={draft}
            onChange={(b) => {
              setDraft(b);
              setDirty(true);
              setSave({ busy: false, msg: '', err: '' });
            }}
            scanAuth={{ 'x-bill-id': id, 'x-admin-key': key }}
            scanEnabled={scanEnabled}
          />
          <section className="panel">
            <button type="button" className="btn" disabled={save.busy || !dirty} onClick={doSave}>
              {save.busy ? 'Saving' : dirty ? 'Save changes' : 'No unsaved changes'}
            </button>
            {people.length > 0 && (
              <span className="muted small">Guests keep their picks for items you leave in. Picks on items you delete are dropped.</span>
            )}
            {save.msg && <div className="banner good">{save.msg}</div>}
            {save.err && <div className="banner">{save.err}</div>}
          </section>
        </>
      )}
    </main>
  );
}
