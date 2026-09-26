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
import { PRODUCTS, MACHINES, MACHINE_IDS, shelfKey } from '../sim/vending.js';
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
    if (this.s.vending.machine(this.id).jam) out.push({ kind: 'jam' });
    return out;
  }
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

/* ---------------- the supply room shelf ---------------- */
export class StockShelf {
  constructor(shift) { this.s = shift; this.title = 'VENDING STOCK'; this.sel = 0; this.msg = ''; }
  rows() {
    const out = [];
    for (const p of this.s.heldAll('vendPack')) out.push({ kind: 'back', pack: p });
    for (const id of MACHINE_IDS) {
      out.push({ kind: 'head', id });
      for (const k of MACHINES[id].slots) out.push({ kind: 'take', prod: k, id });
    }
    return out;
  }
  pickable(rows) { return rows.map((r, i) => (r.kind === 'head' ? -1 : i)).filter((i) => i >= 0); }
  handle(i) {
    const s = this.s, rows = this.rows(), ok = this.pickable(rows);
    if (i.hit('KeyQ', 'UiBack', 'Backspace')) return false;
    let at = Math.max(0, ok.indexOf(this.sel));
    if (ok.indexOf(this.sel) < 0) this.sel = ok[0];
    if (i.hit('ArrowUp', 'KeyW')) { at = (at + ok.length - 1) % ok.length; this.sel = ok[at]; s.g.sound.uiMove(); this.msg = ''; }
    if (i.hit('ArrowDown', 'KeyS')) { at = (at + 1) % ok.length; this.sel = ok[at]; s.g.sound.uiMove(); this.msg = ''; }
    if (i.hit('KeyE', 'Enter', 'Space')) this.act(rows[this.sel]);
    return true;
  }
  /** Start on what somebody needs: the first product that is out in a machine. */
  focusNeeded() {
    const rows = this.rows(), V = this.s.vending;
    const i = rows.findIndex((r) => r.kind === 'take' && V.count(r.id, r.prod) <= 0 && this.s.memory.inv(shelfKey(r.prod)) > 0);
    this.sel = i >= 0 ? i : this.pickable(rows)[0];
    return this;
  }
  act(row) {
    const s = this.s, V = s.vending;
    if (!row) return;
    if (row.kind === 'back') {
      V.putBack(row.pack);
      s.removeHeld(row.pack);
      s.g.sound.drop();
      this.msg = `Put the ${row.pack.pack} of ${PRODUCTS[row.pack.product].label} back on the shelf.`;
      this.sel = this.pickable(this.rows())[0];
      return;
    }
    if (row.kind !== 'take') return;
    const P = PRODUCTS[row.prod], M = MACHINES[row.id];
    if (s.memory.inv(shelfKey(row.prod)) <= 0) { this.msg = `No ${P.label} left. The distributor comes Monday.`; return; }
    const probe = makePack({ product: row.prod, qty: 1, pack: M.pack, bulky: M.bulky });
    if (!s.canHold(probe)) { this.msg = M.bulky ? 'A case of soda takes both arms. Put down what you have first (G), or put it back here.' : 'Your hands are full.'; return; }
    const pack = V.takePack(row.prod);
    s.giveItem(makePack(pack), true);
    s.g.sound.pickup();
    this.msg = `Took a ${pack.pack} of ${P.label} (${pack.qty}). It goes in ${M.name}.`;
    s.onVendTaken(row.prod);
  }
  render() {
    const s = this.s, V = s.vending, rows = this.rows();
    const html = rows.map((r, i) => {
      const sel = i === this.sel ? 'sel' : '';
      if (r.kind === 'head') {
        const t = V.trouble(r.id);
        return `<tr class="head"><td colspan="3"><b>${esc(MACHINES[r.id].title)}</b>${t ? ` <span class="bad">&mdash; ${esc(t)}</span>` : ''}</td></tr>`;
      }
      if (r.kind === 'back') return `<tr class="${sel}"><td>Put back:</td><td>${r.pack.pack} of ${esc(PRODUCTS[r.pack.product].label)} (${r.pack.qty})</td><td></td></tr>`;
      const P = PRODUCTS[r.prod], M = MACHINES[r.id], have = s.memory.inv(shelfKey(r.prod));
      const inMachine = V.count(r.id, r.prod);
      const flag = inMachine <= 0 ? ' <span class="bad">(out)</span>' : inMachine < M.cap ? ` <span class="quiet">(${inMachine}/${M.cap})</span>` : '';
      return `<tr class="${sel}"><td>${M.pack === 'case' ? 'Case' : 'Box'}</td><td>${esc(P.label)}${flag}</td><td>${have <= 0 ? '<span class="bad">NONE</span>' : `${have} on the shelf`}</td></tr>`;
    }).join('');
    return `<div class="sheet shelf vend"><h2>VENDING STOCK <span class="quiet">&mdash; supply room</span></h2>
      <p class="quiet">A case of soda fills a column and takes both arms. Snack and soap boxes: one a hand.</p>
      <table>${html}</table>${this.msg ? `<p class="k">${esc(this.msg)}</p>` : ''}
      <p class="foot">${s.g.ui.keyHint('interact')} take / put back &nbsp; ${s.g.ui.keyHint('back')} done &nbsp; &middot; &nbsp; hands: ${esc(s.handsText() || 'empty')}</p></div>`;
  }
}
