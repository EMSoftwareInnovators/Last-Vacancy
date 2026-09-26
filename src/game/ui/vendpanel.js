/* ============================================================
   vendpanel.js -- a vending machine with its front open, and the
   supply room shelf that fills it.

   Open a machine and you see what the route man sees: every
   column, how many are left in it, which ones are out; the coin
   box and how full it is; whether it is holding somebody's money.
   With a case or a box in your hands, E loads it into its column.
   When every column is full, the coin box comes out.

   The shelf is the other end of the walk: a case of each drink, a
   box of each snack and each soap, and a place to put back the
   half a case you did not need.
   ============================================================ */
import { PRODUCTS, MACHINES, shelfKey } from '../sim/vending.js';
import { makeItem, makePack } from '../sim/items.js';
import { money } from '../dialogue/runner.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const bar = (n, cap) => `[${'#'.repeat(Math.round((n / cap) * 10)).padEnd(10, '.')}]`;
const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];

/* ---------------- a machine, open ---------------- */
export class VendPanel {
  constructor(shift, id) {
    this.s = shift; this.id = id;
    this.M = MACHINES[id];
    this.title = this.M.title;
    this.msg = '';
    this.sel = this.firstUseful();
  }
  rows() {
    const out = this.M.slots.map((k) => ({ kind: 'slot', prod: k }));
    out.push({ kind: 'coins' });
    if (this.heldBox()) out.push({ kind: 'coinsBack' });
    if (this.s.vending.machine(this.id).jam) out.push({ kind: 'jam' });
    return out;
  }
  heldBox() { return this.s.heldAll('vendCoins').find((b) => b.machine === this.id) || null; }
  /** Open on the column your case is for, or the first one that is out. */
  firstUseful() {
    const V = this.s.vending, st = V.machine(this.id);
    const pack = this.s.heldAll('vendPack').find((p) => PRODUCTS[p.product].machine === this.id);
    const rows = this.rows();
    if (pack) return rows.findIndex((r) => r.prod === pack.product);
    if (st.jam) return rows.length - 1;
    const empty = rows.findIndex((r) => r.kind === 'slot' && st.n[r.prod] <= 0);
    if (empty >= 0) return empty;
    if (V.readyForCoins(this.id) && st.coins > 0) return rows.findIndex((r) => r.kind === 'coins');
    return 0;
  }
  handle(i) {
    const s = this.s, rows = this.rows(), n = rows.length;
    if (i.hit('KeyQ', 'UiBack', 'Backspace')) return false;
    if (i.hit('ArrowUp', 'KeyW')) { this.sel = (this.sel + n - 1) % n; s.g.sound.uiMove(); this.msg = ''; }
    if (i.hit('ArrowDown', 'KeyS')) { this.sel = (this.sel + 1) % n; s.g.sound.uiMove(); this.msg = ''; }
    this.sel = Math.min(this.sel, n - 1);
    const d = DIGITS.findIndex((k) => i.hit(k));
    if (d >= 0 && d < n) this.sel = d;
    if (i.hit('KeyE', 'Enter', 'Space') || d >= 0) this.act(rows[this.sel]);
    return true;
  }
  act(row) {
    const s = this.s, V = s.vending, st = V.machine(this.id), snd = s.g.sound;
    if (!row) return;
    if (row.kind === 'slot') {
      const P = PRODUCTS[row.prod];
      const pack = s.heldAll('vendPack').find((p) => p.product === row.prod);
      if (!pack) {
        const other = s.heldAll('vendPack').find((p) => PRODUCTS[p.product].machine === this.id);
        if (st.n[row.prod] >= this.M.cap) { this.msg = `${P.label}: full.`; return; }
        this.msg = other ? `That's ${PRODUCTS[other.product].label} you're carrying. It goes in its own column.`
          : `${P.label} comes from the supply room, next to the laundry: the shelf inside the door. (${s.memory.inv(shelfKey(row.prod))} there.)`;
        return;
      }
      if (st.n[row.prod] >= this.M.cap) { this.msg = `${P.label} is already full. The rest of the ${pack.pack} goes back on the shelf.`; return; }
      const added = V.load(this.id, pack);
      snd.vendDrop(0, 0.5);
      if (pack.qty <= 0) s.removeHeld(pack);
      this.msg = `Loaded ${added} ${P.label}.${pack.qty > 0 ? ` ${pack.qty} left in the ${pack.pack}.` : ''}`;
      s.onVendLoaded(this.id, row.prod);
      return;
    }
    if (row.kind === 'coins') {
      if (st.coins < 0.01) { this.msg = 'The coin box is empty.'; return; }
      if (!V.readyForCoins(this.id)) {
        const short = this.M.slots.filter((k) => st.n[k] < this.M.cap && s.memory.inv(shelfKey(k)) > 0).map((k) => PRODUCTS[k].label);
        this.msg = `Fill it first. June counts the coin box against the fill sheet, and the sheet says full. (Still short: ${short.join(', ')}.)`;
        return;
      }
      const amt = V.pullCoins(this.id);
      s.giveItem(makeItem('vendCoins', { machine: this.id, title: this.M.title, amount: amt }), true);
      snd.coins(0, 1);
      this.msg = `${money(amt)} in coins. It goes to the register, and the register only.`;
      s.onVendCoins(this.id, amt);
      return;
    }
    if (row.kind === 'coinsBack') {
      const box = this.heldBox();
      if (!box) return;
      st.coins = Math.round((st.coins + box.amount) * 100) / 100;
      s.removeHeld(box);
      snd.coins(0, 0.7);
      this.msg = `Put the coin box back in: ${money(box.amount)}.`;
      return;
    }
    if (row.kind === 'jam') {
      V.clearJam(this.id);
      snd.thump(0, 0.8);
      this.msg = 'You find the quarters stuck in the coin mech and push them through. It clunks. It works.';
      s.onVendJamCleared(this.id);
    }
  }
  render() {
    const s = this.s, V = s.vending, st = V.machine(this.id), M = this.M;
    const rows = this.rows().map((r, i) => {
      const sel = i === this.sel ? 'sel' : '';
      if (r.kind === 'slot') {
        const n = st.n[r.prod], P = PRODUCTS[r.prod];
        const state = n <= 0 ? '<span class="bad">EMPTY</span>' : n >= M.cap ? '<span class="ok">FULL</span>' : n <= Math.ceil(M.cap * 0.25) ? '<span class="warn">LOW</span>' : '';
        return `<tr class="${sel}"><td>${i + 1}.</td><td>${esc(P.label)}</td><td class="mono">${bar(n, M.cap)}</td><td>${n}/${M.cap}</td><td>${state}</td></tr>`;
      }
      if (r.kind === 'coins') {
        const full = V.coinsFull(this.id);
        return `<tr class="${sel}"><td>${i + 1}.</td><td>Coin box</td><td class="mono">${bar(st.coins, M.coinCap)}</td><td>${money(st.coins)}</td><td>${full ? '<span class="bad">FULL</span>' : V.readyForCoins(this.id) && st.coins > 0 ? '<span class="ok">PULL IT</span>' : ''}</td></tr>`;
      }
      if (r.kind === 'coinsBack') return `<tr class="${sel}"><td>${i + 1}.</td><td colspan="4">Put the coin box you pulled back in (${money(this.heldBox().amount)})</td></tr>`;
      return `<tr class="${sel}"><td>${i + 1}.</td><td colspan="4"><span class="bad">Something is stuck in the coin mech.</span> Clear it.</td></tr>`;
    }).join('');
    const packs = s.heldAll('vendPack').filter((p) => PRODUCTS[p.product].machine === this.id);
    const carrying = packs.length ? `You have: ${packs.map((p) => `${p.pack} of ${PRODUCTS[p.product].label} (${p.qty})`).join(', ')}.` : 'Refills are on the shelf in the supply room.';
    return `<div class="sheet shelf vend"><h2>${esc(M.title)} <span class="quiet">&mdash; front open</span></h2>
      <p class="quiet">${esc(carrying)}</p>
      <table>${rows}</table>${this.msg ? `<p class="k">${esc(this.msg)}</p>` : ''}
      <p class="foot">${s.g.ui.keyHint('interact')} load / pull &nbsp; ${s.g.ui.keyHint('back')} close it up &nbsp; &middot; &nbsp; hands: ${esc(s.handsText() || 'empty')}</p></div>`;
  }
}

/* ---------------- the supply room shelf ----------------
   One unit per machine. The list opens on what you most likely came for:
   what you are carrying, if you are carrying some of it (E puts it back),
   otherwise "take what the machine needs". Every line says what E will do. */
export class StockShelf {
  constructor(shift, id) {
    this.s = shift; this.id = id;
    this.M = MACHINES[id];
    this.title = `${this.M.pack === 'case' ? 'soda' : id === 'soap' ? 'soap' : 'snack'} shelf`;
    this.msg = '';
    this.sel = this.firstUseful();
  }
  carrying(prod) { return this.s.heldAll('vendPack').find((p) => p.product === prod) || null; }
  /**
   * What the machine is out of (or, if nothing is out, nearly out of) that the
   * shelf has and you are not already carrying. A column that is half full
   * would leave you holding half a box to bring back, so it is not a need.
   */
  needs() {
    const V = this.s.vending, M = this.M;
    const ok = (k) => this.s.memory.inv(shelfKey(k)) > 0 && !this.carrying(k);
    const out = M.slots.filter((k) => V.count(this.id, k) <= 0 && ok(k));
    if (out.length) return out;
    return M.slots.filter((k) => V.count(this.id, k) <= Math.ceil(M.cap * 0.25) && ok(k)).sort((a, b) => V.count(this.id, a) - V.count(this.id, b));
  }
  rows() {
    const out = [];
    if (this.needs().length) out.push({ kind: 'needs' });
    for (const k of this.M.slots) out.push({ kind: 'prod', prod: k });
    return out;
  }
  firstUseful() {
    const rows = this.rows();
    const held = rows.findIndex((r) => r.kind === 'prod' && this.carrying(r.prod));
    if (held >= 0) return held;
    return 0;
  }
  handle(i) {
    const s = this.s, rows = this.rows(), n = rows.length;
    if (i.hit('KeyQ', 'UiBack', 'Backspace')) return false;
    if (i.hit('ArrowUp', 'KeyW')) { this.sel = (this.sel + n - 1) % n; s.g.sound.uiMove(); this.msg = ''; }
    if (i.hit('ArrowDown', 'KeyS')) { this.sel = (this.sel + 1) % n; s.g.sound.uiMove(); this.msg = ''; }
    this.sel = Math.min(this.sel, n - 1);
    const d = DIGITS.findIndex((k) => i.hit(k));
    if (d >= 0 && d < n) this.sel = d;
    if (i.hit('KeyE', 'Enter', 'Space') || d >= 0) {
      const had = rows.length;
      this.act(rows[this.sel]);
      // the "needs" line comes and goes; keep the highlight on the same product
      const now = this.rows().length;
      if (now !== had) this.sel = Math.max(0, Math.min(now - 1, this.sel + (now - had)));
    }
    return true;
  }
  take(prod) {
    const s = this.s, V = s.vending, P = PRODUCTS[prod];
    if (s.memory.inv(shelfKey(prod)) <= 0) { this.msg = `No ${P.label} left on the shelf. The distributor comes Monday.`; return false; }
    const probe = makePack({ product: prod, qty: 1, pack: this.M.pack, bulky: this.M.bulky });
    if (!s.canHold(probe)) {
      this.msg = this.M.bulky ? 'A case of soda takes both arms. Put back what you have first (select it, E), or set it down (G).' : 'Your hands are full: three boxes is all you can carry.';
      return false;
    }
    const pack = V.takePack(prod);
    s.giveItem(makePack(pack), true);
    s.g.sound.pickup();
    s.onVendTaken(prod);
    return pack;
  }
  putBack(pack) {
    const s = this.s;
    s.vending.putBack(pack);
    s.removeHeld(pack);
    s.g.sound.drop();
    this.msg = `Put the ${pack.pack} of ${PRODUCTS[pack.product].label} back on the shelf.`;
  }
  act(row) {
    if (!row) return;
    if (row.kind === 'needs') {
      const got = [];
      for (const k of this.needs()) {
        const pk = this.take(k);
        if (!pk) break;
        got.push(`${PRODUCTS[k].label} (${pk.qty})`);
        if (this.M.bulky) break;            // one case at a time
      }
      if (got.length) this.msg = `Took ${got.length > 1 ? `${got.length} boxes` : `a ${this.M.pack}`}: ${got.join(', ')}. Carry ${got.length > 1 ? 'them' : 'it'} to ${this.M.name} and press E on it.`;
      return;
    }
    const held = this.carrying(row.prod);
    if (held) { this.putBack(held); return; }
    const pk = this.take(row.prod);
    if (pk) this.msg = `Took a ${pk.pack} of ${PRODUCTS[row.prod].label} (${pk.qty}). Carry it to ${this.M.name} and press E on it.`;
  }
  render() {
    const s = this.s, V = s.vending, M = this.M, rows = this.rows();
    const unit = M.pack === 'case' ? 'case' : 'box';
    const html = rows.map((r, i) => {
      const sel = i === this.sel ? 'sel' : '';
      if (r.kind === 'needs') {
        const list = this.needs().slice(0, M.bulky ? 1 : 3).map((k) => PRODUCTS[k].label).join(', ');
        return `<tr class="${sel} act"><td colspan="3"><b>Take what ${esc(M.name)} needs:</b> ${esc(list)}</td><td class="do">TAKE</td></tr>`;
      }
      const P = PRODUCTS[r.prod], have = s.memory.inv(shelfKey(r.prod)), inM = V.count(this.id, r.prod);
      const held = this.carrying(r.prod);
      const state = inM <= 0 ? '<span class="bad">OUT</span>' : inM >= M.cap ? 'full' : `${inM}/${M.cap}`;
      const act = held ? '<span class="warn">PUT BACK</span>' : have <= 0 ? '<span class="quiet">none</span>' : 'take';
      return `<tr class="${sel}"><td>${esc(P.label)}${held ? ' <span class="quiet">(you have one)</span>' : ''}</td><td>machine: ${state}</td><td>${have} on shelf</td><td class="do">${act}</td></tr>`;
    }).join('');
    const packs = s.heldAll('vendPack');
    const mine = packs.filter((p) => PRODUCTS[p.product].machine === this.id);
    const carryLine = mine.length
      ? `You're carrying ${mine.map((p) => `a ${p.pack} of ${PRODUCTS[p.product].label}`).join(' and ')}. ${mine.length > 1 ? 'Their lines say' : 'Its line says'} PUT BACK: E puts it back on the shelf.`
      : packs.length ? `You're carrying ${packs.map((p) => `a ${p.pack} of ${PRODUCTS[p.product].label}`).join(' and ')}, which goes on another shelf.`
        : `One ${unit} fills one column of ${M.name}.${M.bulky ? ' A case takes both arms.' : ' You can carry three boxes.'}`;
    return `<div class="sheet shelf vend"><h2>${esc(M.title)} STOCK <span class="quiet">&mdash; supply room</span></h2>
      <p class="quiet">${esc(carryLine)}</p>
      <table>${html}</table>${this.msg ? `<p class="k">${esc(this.msg)}</p>` : ''}
      <p class="foot">${s.g.ui.keyHint('interact')} take / put back &nbsp; ${s.g.ui.keyHint('back')} done &nbsp; &middot; &nbsp; hands: ${esc(s.handsText() || 'empty')}</p></div>`;
  }
}
