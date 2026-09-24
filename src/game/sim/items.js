/* ============================================================
   items.js -- what can be in the clerk's hands.

   Final Rental's hands held videotapes and nothing else, three at a
   time. The night desk hands hold keys and credit cards, towels and
   pillows, a light bulb, a plunger, a pack of coffee, a tray of
   muffins, a bundle of newspapers. Small things stack three deep;
   bulky things take both arms and nothing else fits.
   ============================================================ */

export const ITEMS = {
  key: { label: (it) => `KEY ${it.room}`, mesh: 'key' },
  master: { label: () => 'MASTER KEY', mesh: 'key' },
  card: { label: (it) => `${it.card.type} — ${it.card.name}`, mesh: 'card' },
  slip: { label: (it) => `CARD SLIP ${it.card ? it.card.type : ''} — ${it.signed ? 'SIGNED' : 'NOT SIGNED'}`, mesh: 'slip' },
  voucher: { label: (it) => `VOUCHER — ${it.company}`, mesh: 'voucher' },
  coupon: { label: () => 'TRAVEL-BOOK COUPON', mesh: 'voucher' },
  receipt: { label: (it) => `RECEIPT, RM ${it.room}`, mesh: 'receipt' },
  checks: { label: (it) => `TRAVELER'S CHECKS $${it.amount}`, mesh: 'voucher' },
  towels: { label: () => 'TOWELS', mesh: 'towels', supply: 'towels' },
  pillow: { label: () => 'PILLOW', mesh: 'pillow', supply: 'pillow' },
  blanket: { label: () => 'BLANKET', mesh: 'blanket', supply: 'blanket' },
  toiletries: { label: () => 'SOAP & SHAMPOO', mesh: 'box', supply: 'toiletries' },
  toothpaste: { label: () => 'TOOTHPASTE & BRUSH', mesh: 'box', supply: 'toothpaste' },
  tp: { label: () => 'TOILET PAPER', mesh: 'tp', supply: 'tp' },
  bulb: { label: () => 'LIGHT BULB', mesh: 'bulb' },
  batteries: { label: () => 'AA BATTERIES', mesh: 'batteries' },
  remote: { label: () => 'SPARE REMOTE', mesh: 'remote' },
  plunger: { label: () => 'PLUNGER', mesh: 'plunger' },
  lost: { label: (it) => it.what || 'SOMEBODY\'S THING', mesh: 'lostItem' },
  coinBag: { label: (it) => `COIN BAG $${it.amount.toFixed(2)}`, mesh: 'box' },
  sodaCase: { label: () => 'CASE OF SODA', mesh: 'box', bulky: true },
  coffee: { label: () => 'COFFEE PACK', mesh: 'coffee' },
  decaf: { label: () => 'DECAF PACK', mesh: 'decaf' },
  waffleMix: { label: () => 'WAFFLE MIX', mesh: 'waffleMix' },
  oj: { label: () => 'O.J. CONCENTRATE', mesh: 'oj' },
  milk: { label: () => 'MILK, GALLON', mesh: 'oj' },
  cereal: { label: () => 'CEREAL, SIX BOXES', mesh: 'cereal', stock: 'cereal', qty: 6 },
  muffins: { label: () => 'TRAY OF MUFFINS', mesh: 'tray', stock: 'pastry', qty: 8 },
  bagels: { label: () => 'BAGELS, A DOZEN', mesh: 'tray', stock: 'bagels', qty: 6 },
  fruit: { label: () => 'BANANAS & APPLES', mesh: 'tray', stock: 'fruit', qty: 6 },
  newsBundle: { label: () => 'NEWSPAPER BUNDLE', mesh: 'newsBundle', bulky: true },
  trash: { label: () => 'TRASH BAG', mesh: 'trashBag', bulky: true },
  mop: { label: () => 'MOP AND BUCKET', mesh: 'mop', bulky: true },
};

let seq = 1;
export function makeItem(kind, extra = {}) {
  const def = ITEMS[kind];
  return { id: seq++, kind, mesh: def.mesh, bulky: !!def.bulky, ...extra };
}
export function itemLabel(it) {
  const def = ITEMS[it.kind];
  return def ? def.label(it) : it.kind.toUpperCase();
}
