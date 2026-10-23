'use client';
import type { Account, Bill, BillResponse, MyBill } from './types';

export function ls<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function newId(len = 6) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}

/** Returns a message for the first problem that would confuse guests, or '' if the bill is fine to share. */
export function billProblem(bill: Bill): string {
  if (!bill.items.length) return 'Scan the receipt or add at least one item.';
  const unnamed = bill.items.filter((i) => !i.name.trim()).length;
  if (unnamed) return `${unnamed === 1 ? 'One item has' : `${unnamed} items have`} no name. Name ${unnamed === 1 ? 'it' : 'them'} or remove ${unnamed === 1 ? 'it' : 'them'} so guests know what to tap.`;
  return '';
}

export type { MyBill };
export const MY_BILLS = 'bt:my-bills';

/** Updates or drops one bill in this device's list (null drops it). */
export function updateLocalBill(id: string, patch: Partial<MyBill> | null) {
  const list = ls<MyBill[]>(MY_BILLS, []);
  lsSet(MY_BILLS, patch ? list.map((m) => (m.id === id ? { ...m, ...patch } : m)) : list.filter((m) => m.id !== id));
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Something went wrong. Try again.');
  return data as T;
}

export const api = {
  config: () => call<{ scanEnabled: boolean }>('/api/config'),
  get: (id: string, adminKey?: string) =>
    call<BillResponse>(`/api/bills/${id}`, adminKey ? { headers: { 'x-admin-key': adminKey } } : undefined),
  create: (bill: Bill) =>
    call<{ id: string; adminKey: string }>('/api/bills', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bill }),
    }),
  save: (id: string, adminKey: string, bill: Bill) =>
    call<{ ok: true; bill: Bill }>(`/api/bills/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ bill }),
    }),
  rename: (id: string, adminKey: string, title: string) =>
    call<{ ok: true; bill: Bill }>(`/api/bills/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ title }),
    }),
  remove: (id: string, adminKey: string) =>
    call<{ ok: true }>(`/api/bills/${id}`, { method: 'DELETE', headers: { 'x-admin-key': adminKey } }),
  me: () => call<{ account: Account | null }>('/api/me'),
  /** Adds bills this device knows about to the signed-in account. */
  attach: (bills: { id: string; adminKey: string }[]) =>
    call<{ account: Account | null }>('/api/me', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bills }),
    }),
  signup: (email: string, password: string) =>
    call<{ ok: true }>('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  login: (email: string, password: string) =>
    call<{ ok: true }>('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
  logout: () => call<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  claim: (id: string, guestId: string, name: string, claims: Record<string, number>) =>
    call<{ ok: true; pid: string }>(`/api/bills/${id}/guests`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ guestId, name, claims }),
    }),
  removeGuest: (id: string, adminKey: string, pid: string) =>
    call<{ ok: true }>(`/api/bills/${id}/guests?pid=${encodeURIComponent(pid)}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    }),
  scan: (image: string, auth: Record<string, string>) =>
    call<{ receipt: any }>('/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...auth },
      body: JSON.stringify({ image, mediaType: 'image/jpeg' }),
    }),
};

/** Shrinks a phone photo to a JPEG under ~1 MB so it fits serverless upload limits. Returns base64 without prefix. */
export async function photoToJpeg(file: File, maxSide = 1800): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file could not be opened as a photo. Use a JPEG or PNG.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot prepare the photo.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
