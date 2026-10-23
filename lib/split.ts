import type { Bill, Claims, Item, PublicGuest } from './types';

export const num = (x: unknown) => {
  const n = typeof x === 'number' ? x : parseFloat(String(x));
  return Number.isFinite(n) ? n : 0;
};
export const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;
export const fmt = (x: number) => {
  const v = r2(x);
  return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
};
export const qtyOf = (it: Item) => Math.max(1, Math.floor(num(it.qty)) || 1);
export const honName = (b: Bill) => b.honoree.trim() || 'the birthday person';
export const isGroupItem = (b: Bill, it: Item) => b.coverHonoree && !!it.honoree;

export function totals(b: Bill) {
  let sub = 0;
  let hon = 0;
  for (const it of b.items) {
    sub += num(it.price);
    if (isGroupItem(b, it)) hon += num(it.price);
  }
  const tip =
    b.tipMode === 'percent' ? (sub * num(b.tipPercent)) / 100 : b.tipMode === 'amount' ? num(b.tipAmount) : 0;
  const extras = num(b.tax) + num(b.gratuity) + num(b.fees) + tip;
  const rate = sub ? 1 + extras / sub : 1;
  return { sub, tip, extras, rate, total: sub + extras, hon, honFull: hon * rate };
}

export type ShareLine = { item: Item; units: number; amount: number; sharedWith: number };
export type Share = {
  lines: ShareLine[];
  items: number;
  tax: number;
  gratuity: number;
  fees: number;
  tip: number;
  honoree: number;
  total: number;
};
export type ItemStatus = {
  item: Item;
  claimedUnits: number;
  claimers: { pid: string; name: string; units: number }[];
  openFraction: number;
  openAmount: number;
  group: boolean;
};

/**
 * Splits the bill among guests.
 * An item's price is divided by units: each claimer pays price * units / max(qty, totalClaimedUnits).
 * So a single dish claimed by three people is split three ways automatically,
 * and a 3-pack of drinks claimed 1 + 1 leaves one drink unclaimed.
 * Tax, gratuity, fees and tip are shared in proportion to each person's items.
 * The honoree's items (when covered) are split evenly among paying guests.
 */
export function computeSplit(b: Bill, guests: { pid: string; name: string; claims: Claims }[]) {
  const t = totals(b);
  const byId = new Map(b.items.map((i) => [i.id, i]));
  const claimedUnits = new Map<string, number>();
  const claimers = new Map<string, { pid: string; name: string; units: number }[]>();

  for (const g of guests) {
    for (const [itemId, rawU] of Object.entries(g.claims || {})) {
      const it = byId.get(itemId);
      const u = Math.floor(num(rawU));
      if (!it || u <= 0 || isGroupItem(b, it)) continue;
      const units = Math.min(u, qtyOf(it));
      claimedUnits.set(itemId, (claimedUnits.get(itemId) || 0) + units);
      const list = claimers.get(itemId) || [];
      list.push({ pid: g.pid, name: g.name, units });
      claimers.set(itemId, list);
    }
  }

  const raw = new Map<string, { lines: ShareLine[]; items: number }>();
  for (const g of guests) {
    const lines: ShareLine[] = [];
    let items = 0;
    for (const [itemId, rawU] of Object.entries(g.claims || {})) {
      const it = byId.get(itemId);
      const u = Math.floor(num(rawU));
      if (!it || u <= 0 || isGroupItem(b, it)) continue;
      const units = Math.min(u, qtyOf(it));
      const denom = Math.max(qtyOf(it), claimedUnits.get(itemId) || 0);
      const amount = (num(it.price) * units) / denom;
      items += amount;
      lines.push({ item: it, units, amount, sharedWith: (claimers.get(itemId) || []).length });
    }
    lines.sort((a, c) => b.items.indexOf(a.item) - b.items.indexOf(c.item));
    raw.set(g.pid, { lines, items });
  }

  const payingCount = guests.filter((g) => (raw.get(g.pid)?.items || 0) > 0).length;
  const payers = b.payersOverride && b.payersOverride > 0 ? b.payersOverride : payingCount;
  const honPer = b.coverHonoree && t.hon > 0 && payers > 0 ? t.honFull / payers : 0;

  const shares = new Map<string, Share>();
  let collected = 0;
  for (const g of guests) {
    const r = raw.get(g.pid)!;
    const ratio = t.sub ? r.items / t.sub : 0;
    const s: Share = {
      lines: r.lines,
      items: r2(r.items),
      tax: r2(num(b.tax) * ratio),
      gratuity: r2(num(b.gratuity) * ratio),
      fees: r2(num(b.fees) * ratio),
      tip: r2(t.tip * ratio),
      honoree: r.items > 0 ? r2(honPer) : 0,
      total: 0,
    };
    s.total = r2(s.items + s.tax + s.gratuity + s.fees + s.tip + s.honoree);
    collected += s.total;
    shares.set(g.pid, s);
  }

  const items: ItemStatus[] = b.items.map((it) => {
    const group = isGroupItem(b, it);
    const cu = claimedUnits.get(it.id) || 0;
    const openFraction = group ? 0 : Math.max(0, 1 - cu / qtyOf(it));
    return {
      item: it,
      claimedUnits: cu,
      claimers: claimers.get(it.id) || [],
      openFraction,
      openAmount: num(it.price) * openFraction * t.rate,
      group,
    };
  });

  return { totals: t, shares, items, payers, honPer, collected: r2(collected), unclaimed: r2(t.total - collected) };
}

export type SplitResult = ReturnType<typeof computeSplit>;
export type { PublicGuest };
