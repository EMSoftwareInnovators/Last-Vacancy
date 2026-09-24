/* ============================================================
   ledger.js -- the money, on paper and in the drawer.

   The drawer works exactly the way Final Rental's register did: a
   bill a guest hands you sits in your hand until you walk it to the
   register and ring it up, and the change comes back out of the
   drawer and has to be handed over. Nothing goes in by magic.

   Around the drawer is the paperwork a 1997 motel runs on: a folio
   per stay in the property system, carbon card slips in a box,
   company vouchers in an envelope, paid-out slips for the money
   that leaves the drawer for a good reason. The night audit holds
   what the system says against what is physically there, and
   the gap is whatever went wrong earlier in the night.
   ============================================================ */

export const TAX = 0.10;
export const BANK = 150;
const r2 = (v) => Math.round(v * 100) / 100;

/* The rates on the card by the door. */
export const RATES = {
  RACK: { label: 'RACK', desc: 'standard rate' },
  AAA: { label: 'AAA', desc: '10% off with a card' },
  COUPON: { label: 'COUPON', desc: 'travel-book coupon, $29.95' },
  WEEKLY: { label: 'WEEKLY', desc: '$159 the week' },
  CORP: { label: 'CORP', desc: 'company account, direct bill' },
  COMP: { label: 'COMP', desc: 'no charge' },
};
export const PAY = { CASH: 'CASH', CARD: 'CARD', TC: "TRAV CHK", VOUCHER: 'VOUCHER', DIRECT: 'DIRECT BILL' };

/** Nightly rate before tax, for a room and a rate code. */
export function nightly(beds, party, code, account) {
  let base = beds === 'QQ' ? 42.95 : party >= 2 ? 36.95 : 32.95;
  if (party > 2) base += 5 * (party - 2);
  switch (code) {
    case 'AAA': return r2(base * 0.9);
    case 'COUPON': return 29.95;
    case 'WEEKLY': return r2(159 / 7);
    case 'CORP': return account ? account.rate : 28.0;
    case 'COMP': return 0;
    default: return base;
  }
}
export function withTax(v) { return r2(v * (1 + TAX)); }

/* Companies with an account. Anybody else's voucher is a piece of paper. */
export const ACCOUNTS = [
  { id: 'TRIPARISH', name: 'TRI-PARISH PAVING & ASPHALT', rate: 28.0, note: 'Crew rooms only. No phone charges.' },
  { id: 'GULFSTATES', name: 'GULF STATES PIPELINE', rate: 30.0, note: 'Weekly resident D. Pike billed direct.' },
  { id: 'DELTAMEDICAL', name: 'DELTA MEDICAL SUPPLY', rate: 32.0, note: '' },
  { id: 'BAYOUSTAR', name: 'BAYOU STAR TOURS', rate: 27.5, note: 'Group rate. Driver comp.' },
];

export class Ledger {
  constructor() {
    this.drawer = BANK;
    this.folios = [];
    this.slips = [];          // imprinted card slips, in the box under the counter
    this.vouchers = [];       // company vouchers, in the envelope
    this.paidOuts = [];       // money out of the drawer, with or without a slip
    this.vendingBag = 0;      // coins pulled from the machines, not yet in the drawer
    this.vendingIn = 0;       // coins that made it into the drawer
    this.vendingMeter = 0;    // what the machines' own counters say they took
    this.tips = 0;            // yours, not the drawer's
    this.roomTaxPosted = false;
    this.nextFolio = 4410;
  }

  /* ---------------- folios ---------------- */
  open(o) {
    const f = {
      id: this.nextFolio++, room: o.room, name: o.name, guestId: o.guestId, party: o.party, nights: o.nights,
      rateCode: o.rateCode, rate: o.rate, pay: o.pay, account: o.account || null,
      charges: [], payments: [], open: true, opened: o.at || 0, card: o.card || null,
    };
    this.folios.push(f);
    return f;
  }
  folio(id) { return this.folios.find((f) => f.id === id) || null; }
  folioForRoom(no) { return this.folios.find((f) => f.open && f.room === String(no)) || null; }
  charge(f, desc, amt, at = 0) { f.charges.push({ desc, amt: r2(amt), at }); }
  pay(f, type, amt, ref = '', at = 0) { f.payments.push({ type, amt: r2(amt), ref, at }); }
  balance(f) { return r2(f.charges.reduce((a, c) => a + c.amt, 0) - f.payments.reduce((a, p) => a + p.amt, 0)); }
  /** What a stay costs, all nights, tax in. */
  stayTotal(f) { return r2(withTax(f.rate) * f.nights); }

  /* ---------------- the drawer ---------------- */
  ringUp(amount) { this.drawer = r2(this.drawer + amount); }
  payOut(amount, why, slip) {
    this.drawer = r2(this.drawer - amount);
    this.paidOuts.push({ amt: r2(amount), why, slip: !!slip });
  }
  takeFromDrawer(amount) { this.drawer = r2(this.drawer - amount); }
  returnToDrawer(amount) { this.drawer = r2(this.drawer + amount); }

  /* ---------------- what the system believes ---------------- */
  systemCash() {
    let n = 0;
    for (const f of this.folios) for (const p of f.payments) if (p.type === 'CASH' || p.type === 'TC') n += p.amt;
    return r2(n);
  }
  systemCard() {
    let n = 0;
    for (const f of this.folios) for (const p of f.payments) if (p.type === 'CARD') n += p.amt;
    return r2(n);
  }
  cardFolios() { return this.folios.filter((f) => f.pay === 'CARD'); }
  voucherFolios() { return this.folios.filter((f) => f.pay === 'VOUCHER' || f.pay === 'DIRECT'); }
  roomRevenue() {
    let n = 0;
    for (const f of this.folios) for (const c of f.charges) if (c.desc.startsWith('ROOM')) n += c.amt;
    return r2(n);
  }
  expectedDrawer() {
    const slipped = this.paidOuts.filter((p) => p.slip).reduce((a, p) => a + p.amt, 0);
    return r2(BANK + this.systemCash() + this.vendingIn - slipped);
  }

  /* ---------------- saving: only what carries into tomorrow ---------------- */
  save() {
    return {
      folios: this.folios.filter((f) => f.open).map((f) => ({ ...f })),
      nextFolio: this.nextFolio,
    };
  }
  load(d) {
    if (!d) return;
    this.folios = (d.folios || []).map((f) => ({ ...f }));
    this.nextFolio = d.nextFolio || this.nextFolio;
  }
}

export { r2 };
