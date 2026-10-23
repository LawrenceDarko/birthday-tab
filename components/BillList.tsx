'use client';
import { useState } from 'react';
import { api, type MyBill } from '@/lib/client';

/** The organizer's bills with open, rename and delete. */
export default function BillList({
  bills,
  onRenamed,
  onDeleted,
}: {
  bills: MyBill[];
  onRenamed: (id: string, title: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [mode, setMode] = useState<{ id: string; kind: 'rename' | 'delete' } | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function start(m: MyBill, kind: 'rename' | 'delete') {
    setMode({ id: m.id, kind });
    setName(m.title === 'Bill' ? '' : m.title);
    setErr('');
  }

  async function run(m: MyBill) {
    setBusy(true);
    setErr('');
    try {
      if (mode?.kind === 'rename') {
        const { bill } = await api.rename(m.id, m.adminKey, name);
        onRenamed(m.id, bill.title || bill.merchant || 'Bill');
      } else {
        await api.remove(m.id, m.adminKey);
        onDeleted(m.id);
      }
      setMode(null);
    } catch (e: any) {
      // A bill already deleted elsewhere is gone either way.
      if (mode?.kind === 'delete' && e.message === 'Not allowed.') {
        onDeleted(m.id);
        setMode(null);
      } else setErr(e.message === 'Not allowed.' ? 'This bill can no longer be changed from here.' : e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {bills.map((m) => {
        const active = mode?.id === m.id ? mode.kind : null;
        return (
          <div className="person" key={m.id} style={active ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
            {active === 'rename' ? (
              <form
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  run(m);
                }}
              >
                <label className="field" htmlFor={`rn-${m.id}`}>
                  New name
                  <input id={`rn-${m.id}`} type="text" maxLength={80} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <div className="row">
                  <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving' : 'Save name'}</button>
                  <button type="button" className="btn ghost" disabled={busy} onClick={() => setMode(null)}>Cancel</button>
                </div>
              </form>
            ) : active === 'delete' ? (
              <>
                <span>
                  Delete <b>{m.title}</b> and everyone&apos;s picks? The guest link will stop working. This cannot be undone.
                </span>
                <div className="row">
                  <button type="button" className="btn" disabled={busy} onClick={() => run(m)}>{busy ? 'Deleting' : 'Delete bill'}</button>
                  <button type="button" className="btn ghost" disabled={busy} onClick={() => setMode(null)}>Keep it</button>
                </div>
              </>
            ) : (
              <>
                <span>
                  <b>{m.title}</b>
                  <br />
                  <span className="muted small">{new Date(m.createdAt).toLocaleDateString()}</span>
                  <span className="actions">
                    <button type="button" className="linkbtn" onClick={() => start(m, 'rename')}>Rename</button>
                    <button type="button" className="linkbtn" onClick={() => start(m, 'delete')}>Delete</button>
                  </span>
                </span>
                <a className="btn ghost" href={`/b/${m.id}/admin?k=${m.adminKey}`}>Open</a>
              </>
            )}
            {active && err && <div className="banner">{err}</div>}
          </div>
        );
      })}
    </div>
  );
}
