'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BillEditor from '@/components/BillEditor';
import BillList from '@/components/BillList';
import { emptyBill, type Account, type Bill } from '@/lib/types';
import { api, billProblem, ls, lsSet, MY_BILLS, updateLocalBill, type MyBill } from '@/lib/client';

const DRAFT = 'bt:draft';

export default function Home() {
  const router = useRouter();
  const [bill, setBill] = useState<Bill>(emptyBill());
  const [cfg, setCfg] = useState({ passcodeRequired: false, scanEnabled: true });
  const [passcode, setPasscode] = useState('');
  const [mine, setMine] = useState<MyBill[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [restored, setRestored] = useState(false);
  // undefined while loading, null when signed out
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [auth, setAuth] = useState({ mode: 'signin' as 'signin' | 'signup', email: '', password: '', busy: false, err: '' });

  useEffect(() => {
    // A reload or a trip to the camera app can drop the page; keep the unsent bill on this device.
    const draft = ls<Bill | null>(DRAFT, null);
    if (draft && Array.isArray(draft.items)) setBill({ ...emptyBill(), ...draft });
    setRestored(true);
    setMine(ls<MyBill[]>(MY_BILLS, []));
    setPasscode(ls('bt:passcode', ''));
    api.config().then(setCfg).catch(() => {});
    loadAccount();
  }, []);

  /** Loads the signed-in account and moves bills saved on this device into it. */
  async function loadAccount() {
    try {
      const { account: a } = await api.me();
      const local = ls<MyBill[]>(MY_BILLS, []);
      if (a && local.some((m) => !a.bills.some((b) => b.id === m.id))) {
        const r = await api.attach(local.map(({ id, adminKey }) => ({ id, adminKey })));
        setAccount(r.account);
      } else setAccount(a);
    } catch {
      setAccount(null);
    }
  }

  async function submitAuth() {
    setAuth((a) => ({ ...a, busy: true, err: '' }));
    try {
      if (auth.mode === 'signup') {
        await api.signup(auth.email, auth.password, passcode);
        lsSet('bt:passcode', passcode);
      } else await api.login(auth.email, auth.password);
      setAuth((a) => ({ ...a, password: '', busy: false }));
      await loadAccount();
    } catch (e: any) {
      setAuth((a) => ({ ...a, busy: false, err: e.message }));
    }
  }

  async function signOut() {
    await api.logout().catch(() => {});
    setAccount(null);
  }

  function renamed(id: string, title: string) {
    updateLocalBill(id, { title });
    setMine(ls<MyBill[]>(MY_BILLS, []));
    setAccount((a) => a && { ...a, bills: a.bills.map((b) => (b.id === id ? { ...b, title } : b)) });
  }

  function deleted(id: string) {
    updateLocalBill(id, null);
    setMine(ls<MyBill[]>(MY_BILLS, []));
    setAccount((a) => a && { ...a, bills: a.bills.filter((b) => b.id !== id) });
  }

  useEffect(() => {
    if (restored) lsSet(DRAFT, bill);
  }, [bill, restored]);

  async function create() {
    setErr('');
    const problem = billProblem(bill);
    if (problem) return setErr(problem);
    setBusy(true);
    try {
      const { id, adminKey } = await api.create(bill, passcode);
      if (!account) lsSet('bt:passcode', passcode);
      const entry: MyBill = { id, adminKey, title: bill.title || bill.merchant || 'Bill', createdAt: new Date().toISOString() };
      lsSet(MY_BILLS, [entry, ...ls<MyBill[]>(MY_BILLS, [])].slice(0, 30));
      lsSet(DRAFT, null);
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
        <span className="muted small">Scan the receipt, share one link, and everyone taps what they had. Guests never need an account.</span>
      </header>

      {account ? (
        <section className="panel">
          <div className="ln">
            <h2>Your bills</h2>
            <button type="button" className="linkbtn" onClick={signOut}>Sign out</button>
          </div>
          <span className="muted small">Signed in as {account.email}. Your bills show here on any device you sign in on.</span>
          {account.bills.length ? (
            <BillList bills={account.bills} onRenamed={renamed} onDeleted={deleted} />
          ) : (
            <span className="muted small">No bills yet. Create one below.</span>
          )}
        </section>
      ) : (
        <>
          {mine.length > 0 && (
            <section className="panel">
              <h2>Your bills on this device</h2>
              <BillList bills={mine} onRenamed={renamed} onDeleted={deleted} />
            </section>
          )}
          {account === null && (
            <section className="panel">
              <h2>{auth.mode === 'signin' ? 'Organizer sign in' : 'Create an organizer account'}</h2>
              <span className="muted small">
                Sign in to keep your bills on every device and pick up where you left off.
                {auth.mode === 'signup' && cfg.passcodeRequired ? ' Creating an account needs the organizer passcode below.' : ''}
              </span>
              <form
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAuth();
                }}
              >
                <label className="field" htmlFor="auth-email">
                  Email
                  <input id="auth-email" type="email" autoComplete="email" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} />
                </label>
                <label className="field" htmlFor="auth-pass">
                  Password{auth.mode === 'signup' ? ' (at least 8 characters)' : ''}
                  <input
                    id="auth-pass"
                    type="password"
                    autoComplete={auth.mode === 'signup' ? 'new-password' : 'current-password'}
                    value={auth.password}
                    onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                  />
                </label>
                <button type="submit" className="btn" disabled={auth.busy || !auth.email || !auth.password}>
                  {auth.busy ? 'One moment' : auth.mode === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </form>
              <button type="button" className="linkbtn" onClick={() => setAuth({ ...auth, mode: auth.mode === 'signin' ? 'signup' : 'signin', err: '' })}>
                {auth.mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
              </button>
              {auth.err && <div className="banner">{auth.err}</div>}
            </section>
          )}
        </>
      )}

      {cfg.passcodeRequired && !account && (
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
        {bill.items.length > 0 && (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => {
              if (!window.confirm('Clear every item and start a new bill?')) return;
              setBill(emptyBill());
              setErr('');
            }}
          >
            Clear and start over
          </button>
        )}
        {err && <div className="banner">{err}</div>}
      </section>
    </main>
  );
}
