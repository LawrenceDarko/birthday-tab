export type Item = {
  id: string;
  name: string;
  qty: number;
  /** Line total for the row (already multiplied by qty). */
  price: number;
  honoree?: boolean;
};

export type TipMode = 'percent' | 'amount' | 'none';

export type Bill = {
  title: string;
  merchant: string;
  honoree: string;
  coverHonoree: boolean;
  /** Fixed number of people splitting the honoree's meal; null = everyone who claimed something. */
  payersOverride: number | null;
  items: Item[];
  tax: number;
  gratuity: number;
  fees: number;
  tipMode: TipMode;
  tipPercent: number;
  tipAmount: number;
  receiptSubtotal: number;
  receiptTotal: number;
};

/** itemId -> units claimed */
export type Claims = Record<string, number>;

export type PublicGuest = {
  pid: string;
  name: string;
  claims: Claims;
  updatedAt: string;
};

export type BillResponse = { bill: Bill; guests: PublicGuest[] };

export function emptyBill(): Bill {
  return {
    title: '',
    merchant: '',
    honoree: '',
    coverHonoree: true,
    payersOverride: null,
    items: [],
    tax: 0,
    gratuity: 0,
    fees: 0,
    tipMode: 'percent',
    tipPercent: 20,
    tipAmount: 0,
    receiptSubtotal: 0,
    receiptTotal: 0,
  };
}
