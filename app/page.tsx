'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BillEditor from '@/components/BillEditor';
import { emptyBill, type Bill } from '@/lib/types';
import { api, ls, lsSet, MY_BILLS, type MyBill } from '@/lib/client';

export default function Home() {
  const router = useRouter();
  const [bill, setBill] = useState<Bill>(emptyBill());
  const [cfg, setCfg] = useState({ passcodeRequired: false, scanEnabled: true });
  const [passcode, setPasscode] = useState('');
  const [mine, setMine] = useState<MyBill[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setMine(ls<MyBill[]>(MY_BILLS, []));
    setPasscode(ls('bt:passcode', ''));
    api.config().then(setCfg).catch(() => {});
  }, []);

  async function create() {
    setErr('');
    if (!bill.items.length) return setErr('Scan the receipt or add at least one item.');
    setBusy(true);
    try {
      const { id, adminKey } = await api.create(bill, passcode);
      lsSet('bt:passcode', passcode);
      const entry: MyBill = { id, adminKey, title: bill.title || bill.merchant || 'Bill', createdAt: new Date().toISOString() };
      lsSet(MY_BILLS, [entry, ...ls<MyBill[]>(MY_BILLS, [])].slice(0, 30));
      router.push(`/b/${id}/admin?k=${adminKey}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <header className="head">
        <span className="eyebrow">Birthday Tab</span>
        <h1>Split the bill</h1>
        <span className="muted small">Scan the receipt, share one link, and everyone taps what they had. No accounts.</span>
      </header>

      {mine.length > 0 && (
        <section className="panel">
          <h2>Your bills</h2>
          <div>
            {mine.map((m) => (
              <div className="person" key={m.id}>
                <span>
                  <b>{m.title}</b>
                  <br />
                  <span className="muted small">{new Date(m.createdAt).toLocaleDateString()}</span>
                </span>
                <a className="btn ghost" href={`/b/${m.id}/admin?k=${m.adminKey}`}>Open</a>
              </div>
            ))}
          </div>
        </section>
      )}

      {cfg.passcodeRequired && (
        <section className="panel">
          <label className="field" htmlFor="pass">
            Organizer passcode
            <input id="pass" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
          </label>
        </section>
      )}

      <BillEditor bill={bill} onChange={setBill} scanAuth={{ 'x-passcode': passcode }} scanEnabled={cfg.scanEnabled} />

      <section className="panel">
        <button type="button" className="btn" disabled={busy} onClick={create}>
          {busy ? 'Creating' : 'Create bill and get the link'}
        </button>
        {err && <div className="banner">{err}</div>}
      </section>
    </main>
  );
}
