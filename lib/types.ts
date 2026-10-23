export type Item = {
  id: string;
  name: string;
  qty: number;
  /** Line total for the row (already multiplied by qty). */
  price: number;
  honoree?: boolean;
};

export type TipMode = 'percent' | 'amount' | 'none';

/** Where guests send their share. Every field is optional; blank ones are hidden from guests. */
export type Pay = {
  /** Who the money goes to, shown as "Pay Ama". */
  name: string;
  /** Venmo username without the @. */
  venmo: string;
  /** Cash App $cashtag without the $. */
  cashapp: string;
  /** Phone or email registered with Zelle. */
  zelle: string;
  /** Phone or email for Apple Cash in Messages. */
  applePay: string;
};

export function emptyPay(): Pay {
  return { name: '', venmo: '', cashapp: '', zelle: '', applePay: '' };
}

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
  /** Missing on bills saved before payment details existed. */
  pay?: Pay;
};

/** itemId -> units claimed */
export type Claims = Record<string, number>;

export type PublicGuest = {
  pid: string;
  name: string;
  claims: Claims;
  updatedAt: string;
};

/** admin is only present when the request carried an organizer key; it says whether that key is right. */
export type BillResponse = { bill: Bill; guests: PublicGuest[]; admin?: boolean };

export function emptyBill(): Bill {
  return {
    title: 'Giselle’s birthday dinner',
    merchant: '',
    honoree: 'Giselle',
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
    pay: emptyPay(),
  };
}

/** A bill the organizer can open, from this device's list or their account. */
export type MyBill = { id: string; adminKey: string; title: string; createdAt: string };

export type Account = { email: string; bills: MyBill[] };
