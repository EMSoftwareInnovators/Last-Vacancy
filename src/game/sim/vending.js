/* ============================================================
   vending.js -- the machines, and the clerk who fills them.

   The vending company quit on the Starlite in March, and June did
   the arithmetic and kept the machines. So they are the night
   desk's: the drink machine and the snack machine in the alcove by
   the ice, and the soap machine in the guest laundry. Every column
   sells down over the evening, a can and a bag and a box of Tide at
   a time, most of it to people you never see. When one runs out,
   somebody pushes the button anyway, and then walks down to the
   office to tell you.

   Filling one is a walk: look at the machine to see what is out,
   get the case or the box off the shelf in the supply room next
   door, carry it over, load the column. When a machine is full, the
   coin box comes out, and the coins go in the register -- not the
   clerk's shirt -- and the audit expects them there.

   A coin box that is never emptied fills up, and a full coin box
   will not take a quarter. A drink machine now and then keeps
   somebody's money outright. Both of those walk down to the office
   too.
   ============================================================ */
import { XBuilder } from '../world/geo.js';
import { F_EMIT } from '../../engine/raster.js';
import { VENDING } from '../world/layout.js';

/* What is in the machines. `pop` is how often somebody wants it. */
export const PRODUCTS = {
  coke: { label: 'Coca-Cola', short: 'COKE', spoken: 'Coke', machine: 'soda', price: 0.6, pop: 6 },
  diet: { label: 'Diet Coke', short: 'DIET COKE', machine: 'soda', price: 0.6, pop: 3 },
  sprite: { label: 'Sprite', short: 'SPRITE', machine: 'soda', price: 0.6, pop: 3 },
  drpep: { label: 'Dr Pepper', short: 'DR PEPPER', machine: 'soda', price: 0.6, pop: 4 },
  barqs: { label: 'Barq\'s root beer', short: 'BARQ\'S', spoken: 'Barq\'s', machine: 'soda', price: 0.6, pop: 2 },
  bigred: { label: 'Big Red', short: 'BIG RED', machine: 'soda', price: 0.6, pop: 2 },

  funyuns: { label: 'Funyuns', short: 'FUNYUNS', machine: 'snack', price: 0.5, pop: 4 },
  lays: { label: 'Lay\'s, plain', short: 'LAY\'S', spoken: 'Lay\'s', machine: 'snack', price: 0.5, pop: 4 },
  doritos: { label: 'Doritos, nacho', short: 'DORITOS', spoken: 'Doritos', machine: 'snack', price: 0.5, pop: 4 },
  nabs: { label: 'Nabs (peanut butter crackers)', short: 'NABS', spoken: 'Nabs', machine: 'snack', price: 0.45, pop: 2 },
  snickers: { label: 'Snickers', short: 'SNICKERS', machine: 'snack', price: 0.55, pop: 4 },
  mms: { label: 'Peanut M&M\'s', short: 'M&M\'S', machine: 'snack', price: 0.55, pop: 3 },
  honeybun: { label: 'Honey bun', short: 'HONEY BUN', spoken: 'honey buns', machine: 'snack', price: 0.65, pop: 3 },
  peanuts: { label: 'Planters peanuts', short: 'PEANUTS', spoken: 'peanuts', machine: 'snack', price: 0.45, pop: 2 },

  tide: { label: 'Tide, one load', short: 'TIDE', spoken: 'Tide', machine: 'soap', price: 0.75, pop: 5 },
  bounce: { label: 'Bounce, two sheets', short: 'BOUNCE', spoken: 'Bounce', machine: 'soap', price: 0.5, pop: 3 },
  bleach: { label: 'Clorox, one cup', short: 'CLOROX', spoken: 'bleach', machine: 'soap', price: 0.5, pop: 2 },
};

/* The machines. A case or a box off the shelf fills one column from empty. */
export const MACHINES = {
  soda: {
    id: 'soda', name: 'the drink machine', title: 'DRINK MACHINE', where: 'in the alcove by the ice machine',
    slots: ['coke', 'diet', 'sprite', 'drpep', 'barqs', 'bigred'], cap: 20, pack: 'case', bulky: true, coinCap: 36,
    perHour: 3.4,
  },
  snack: {
    id: 'snack', name: 'the snack machine', title: 'SNACK MACHINE', where: 'in the alcove by the ice machine',
    slots: ['funyuns', 'lays', 'doritos', 'nabs', 'snickers', 'mms', 'honeybun', 'peanuts'], cap: 12, pack: 'box', bulky: false, coinCap: 36,
    perHour: 2.4,
  },
  soap: {
    id: 'soap', name: 'the soap machine', title: 'LAUNDRY SOAP', where: 'in the guest laundry',
    slots: ['tide', 'bounce', 'bleach'], cap: 15, pack: 'box', bulky: false, coinCap: 24,
    perHour: 0.9,
  },
};
export const MACHINE_IDS = Object.keys(MACHINES);
/** What the supply room shelf holds after the distributor's Monday run (and what June tops it up to). */
const SHELF = { soda: 40, snack: 24, soap: 30 };
/** What the day desk sells while you are asleep. */
const DAY_SALES = { soda: [18, 30], snack: [12, 22], soap: [4, 9] };

const r2 = (v) => Math.round(v * 100) / 100;
export const shelfKey = (prod) => 'v_' + prod;

/** The machines as the first night finds them: full, except for the things June wants you to fix. */
function firstNight() {
  const m = {};
  for (const id of MACHINE_IDS) {
    const M = MACHINES[id];
    m[id] = { n: Object.fromEntries(M.slots.map((k) => [k, M.cap])), coins: 0, jam: false };
  }
  m.soda.n.coke = 0;                        // no Coke: a crime in this parish
  m.soda.coins = 14.4;
  m.snack.n.funyuns = 0; m.snack.n.honeybun = 0; m.snack.n.doritos = 5;
  m.snack.coins = 9.85;
  m.soap.n.tide = 0; m.soap.n.bounce = 9;
  m.soap.coins = 6.25;
  return m;
}

/** Fill in the shelf and the machines on a save that predates them. */
export function ensureVending(d) {
  if (!d.vending) d.vending = firstNight();
  for (const id of MACHINE_IDS) {
    const M = MACHINES[id];
    if (!d.vending[id]) d.vending[id] = { n: Object.fromEntries(M.slots.map((k) => [k, M.cap])), coins: 0, jam: false };
    for (const k of M.slots) {
      if (d.vending[id].n[k] === undefined) d.vending[id].n[k] = M.cap;
      if (d.inventory[shelfKey(k)] === undefined) d.inventory[shelfKey(k)] = SHELF[id];
    }
  }
  delete d.inventory.sodaCases;
}

export class Vending {
  constructor(shift) {
    this.s = shift;
    ensureVending(shift.memory.d);
    this.m = shift.memory.d.vending;        // live: the save holds the same object
    this.acc = { soda: 0, snack: 0, soap: 0 };
    this.sold = { soda: 0, snack: 0, soap: 0 };
    this.lost = { empty: 0, full: 0, ate: 0 };
    this.lastComplaint = {};
    this.outSince = {};                      // machine:product -> minute it ran out
    this.rungIn = 0;
    this.meshes = this.buildMeshes(shift.g.T);
  }

  /* ---------------- reading the machines ---------------- */
  machine(id) { return this.m[id]; }
  def(id) { return MACHINES[id]; }
  count(id, prod) { return this.m[id].n[prod] || 0; }
  empties(id) { const M = MACHINES[id]; return M.slots.filter((k) => this.m[id].n[k] <= 0); }
  lows(id) { const M = MACHINES[id]; return M.slots.filter((k) => this.m[id].n[k] > 0 && this.m[id].n[k] <= Math.ceil(M.cap * 0.25)); }
  coinsFull(id) { return this.m[id].coins >= MACHINES[id].coinCap - 0.001; }
  /** Every column the shelf can fill is full: the coin box can come out. */
  readyForCoins(id) {
    const M = MACHINES[id];
    return M.slots.every((k) => this.m[id].n[k] >= M.cap || this.s.memory.inv(shelfKey(k)) <= 0);
  }
  /** One line of what is wrong with a machine, or ''. */
  trouble(id) {
    const out = [];
    const e = this.empties(id);
    if (e.length) out.push(`out of ${e.map((k) => PRODUCTS[k].short.toLowerCase()).join(', ')}`);
    if (this.coinsFull(id)) out.push('coin box full');
    if (this.m[id].jam) out.push('jammed');
    return out.join('; ');
  }
  needsYou(id) { return !!this.trouble(id); }

  /* ---------------- the day that happened without you ---------------- */
  /** Called at seven: what sold while the day desk was on. */
  daySales() {
    const s = this.s;
    for (const id of MACHINE_IDS) {
      const [a, b] = DAY_SALES[id];
      const n = Math.round(a + s.rng() * (b - a));
      for (let i = 0; i < n; i++) this.sale(id, null, { quiet: true, day: true });
    }
    this.sold = { soda: 0, snack: 0, soap: 0 };
    this.lost = { empty: 0, full: 0, ate: 0 };
  }

  /* ---------------- somebody puts money in ---------------- */
  /**
   * One customer at one machine. `who` is a person you can see, or null for
   * the guests you never do. Returns { ok, why, prod }.
   */
  sale(id, who, o = {}) {
    const s = this.s, M = MACHINES[id], st = this.m[id];
    // Murphy's law: the one you can see walked down for exactly the thing that is out
    const out = this.empties(id);
    const want = who && out.length && s.rng() < 0.6 ? out[Math.floor(s.rng() * out.length)] : this.pickWant(id);
    let why = null, prod = want;
    if (st.jam) { st.coins = r2(Math.min(M.coinCap, st.coins + PRODUCTS[want].price)); why = 'ate'; }
    else if (this.coinsFull(id)) why = 'full';
    else if (st.n[want] <= 0) {
      // half the time they take something else; half the time they want what they wanted
      const other = M.slots.filter((k) => st.n[k] > 0);
      if (other.length && s.rng() < (who ? 0.3 : 0.5)) prod = other[Math.floor(s.rng() * other.length)];
      else why = 'empty';
    }
    if (why) {
      this.lost[why]++;
      // somebody you can see finishes at the machine first (see Shift.vendFailed)
      if (!o.day && !who) this.trouble_(id, why, want, null);
      return { ok: false, why, prod: want };
    }
    st.n[prod]--;
    st.coins = r2(st.coins + PRODUCTS[prod].price);
    if (!o.day) this.sold[id]++;
    if (st.n[prod] <= 0) this.outSince[`${id}:${prod}`] = s.clock.min;
    // now and then the drink machine keeps the next person's money
    if (id === 'soda' && !o.day && s.rng() < 0.012) st.jam = true;
    return { ok: true, prod };
  }
  pickWant(id) {
    const M = MACHINES[id];
    const tot = M.slots.reduce((a, k) => a + PRODUCTS[k].pop, 0);
    let r = this.s.rng() * tot;
    for (const k of M.slots) { r -= PRODUCTS[k].pop; if (r <= 0) return k; }
    return M.slots[0];
  }

  /**
   * Something went wrong for a customer. Sometimes they walk down about it:
   * the one you can see, if it is their first time; the ones you cannot,
   * now and then, through whoever is awake. Returns true if somebody is
   * on the way to the desk.
   */
  trouble_(id, why, prod, who) {
    const s = this.s;
    const now = s.clock.min;
    // a promise on the notepad buys you three quarters of an hour with the ones you cannot see
    const promised = s.tasks.find((t) => t.kind === 'vend' && t.machine === id && t.why === why);
    if (promised && !who && now - promised.created < 45) return false;
    if (s.desk.line.some((p) => p.complaint && p.complaint.kind === 'vending' && p.complaint.machine === id)) return false;
    if (now - (this.lastComplaint[id] || -999) < 40) return false;
    if (!who && s.rng() > (why === 'empty' ? 0.4 : 0.55)) return false;
    const p = who ? (who.flags.vendComplained || who.gone ? null : who) : this.someoneAwake();
    if (!p) return false;
    p.flags.vendComplained = true;
    this.lastComplaint[id] = now;
    s.guestComesDown(p, { kind: 'vending', machine: id, why, product: prod });
    return true;
  }
  someoneAwake() {
    const s = this.s;
    const awake = s.npcs.list.filter((p) => p.inRoom && !p.asleep && p.room && p.stay && !p.followsLeader && !p.groupMember
      && p.kind !== 'staff' && p.act && p.act.kind === 'inRoom' && !p.flags.vendComplained && !p.complaint);
    return awake.length ? awake[Math.floor(s.rng() * awake.length)] : null;
  }

  /* ---------------- the night, a minute at a time ---------------- */
  /** How much each machine sells per game hour, by the clock and how full the motel is. */
  rate(id) {
    const s = this.s, h = (Math.floor(s.clock.min / 60)) % 24;
    const occ = s.rooms.all().filter((r) => r.guest).length;
    const k = Math.max(0.35, Math.min(1.5, occ / 10));
    let t;
    if (id === 'soap') t = h >= 19 && h < 23 ? 1 : h >= 23 || h < 1 ? 0.5 : h >= 6 && h < 8 ? 0.4 : 0.05;
    else t = h >= 19 && h < 23 ? 1 : h === 23 || h === 0 ? 0.7 : h >= 1 && h < 5 ? 0.15 : h >= 5 && h < 8 ? 0.6 : 0.3;
    return MACHINES[id].perHour * t * k;
  }
  update() {
    const s = this.s, dm = s.clock.minDelta || 0;
    if (dm <= 0) return;
    for (const id of MACHINE_IDS) {
      this.acc[id] += this.rate(id) * dm / 60;
      while (this.acc[id] >= 1) { this.acc[id] -= 1; this.sale(id, null); }
    }
    this.checkTasks();
  }
  /** A promise on the notepad is kept when the machine is right again. */
  checkTasks() {
    for (const t of this.s.tasks.open()) {
      if (t.kind !== 'vend') continue;
      const st = this.m[t.machine];
      const fixed = t.why === 'empty' ? !this.empties(t.machine).length
        : t.why === 'full' ? st.coins < MACHINES[t.machine].coinCap * 0.5
          : t.why === 'ate' ? !st.jam : false;
      if (fixed) this.s.tasks.complete(t);
    }
  }

  /* ---------------- the clerk's side ---------------- */
  /** Load what is in the pack into its column. Returns how many went in. */
  load(id, pack) {
    const M = MACHINES[id], st = this.m[id];
    if (PRODUCTS[pack.product].machine !== id) return 0;
    const add = Math.min(pack.qty, M.cap - st.n[pack.product]);
    if (add <= 0) return 0;
    st.n[pack.product] += add;
    pack.qty -= add;
    delete this.outSince[`${id}:${pack.product}`];
    this.checkTasks();
    return add;
  }
  /** The coin box comes out; the machine is left with an empty one. */
  pullCoins(id) {
    const st = this.m[id];
    const amt = r2(st.coins);
    st.coins = 0;
    this.checkTasks();
    return amt;
  }
  clearJam(id) { this.m[id].jam = false; this.checkTasks(); }

  /** Take a case or a box off the supply room shelf. */
  takePack(prod) {
    const s = this.s, M = MACHINES[PRODUCTS[prod].machine];
    const have = s.memory.inv(shelfKey(prod));
    if (have <= 0) return null;
    const qty = Math.min(M.cap, have);
    s.memory.use(shelfKey(prod), qty);
    return { product: prod, qty, pack: M.pack, bulky: M.bulky };
  }
  putBack(pack) { const k = shelfKey(pack.product); this.s.memory.d.inventory[k] = (this.s.memory.inv(k)) + pack.qty; }

  /** June tops the shelf up between nights (the distributor, really, on Mondays). */
  static restockShelf(d) {
    for (const id of MACHINE_IDS) for (const k of MACHINES[id].slots) d.inventory[shelfKey(k)] = Math.max(d.inventory[shelfKey(k)] || 0, SHELF[id]);
  }

  /** For June's note and the log. */
  summary() {
    const out = {};
    for (const id of MACHINE_IDS) out[id] = { empties: this.empties(id).map((k) => PRODUCTS[k].short.toLowerCase()), full: this.coinsFull(id), jam: this.m[id].jam, coins: this.m[id].coins };
    return { machines: out, sold: { ...this.sold }, lost: { ...this.lost }, rungIn: this.rungIn };
  }

  /* ---------------- what you can see from the walk ---------------- */
  buildMeshes(T) {
    const mk = (fn) => { const b = new XBuilder(); b.light = () => 1; fn(b); return b.build(); };
    return {
      // a red SOLD OUT chip, in front of a button
      out: mk((b) => b.quad([-0.055, -0.02, 0], [0.055, -0.02, 0], [0.055, 0.02, 0], [-0.055, 0.02, 0], T.soldOut, [0, 0, 32, 8], F_EMIT)),
      // an empty spiral in the snack machine's window
      coil: mk((b) => b.quad([-0.07, -0.045, 0], [0.07, -0.045, 0], [0.07, 0.045, 0], [-0.07, 0.045, 0], T.emptyCoil, [0, 0, 16, 8], F_EMIT)),
    };
  }
  /** SOLD OUT on the buttons of the columns that are out, and bare spirals in the snack window. */
  draw(draws) {
    for (const v of VENDING) {
      const st = this.m[v.id], M = MACHINES[v.id];
      if (!st) continue;
      const cx = (v.x0 + v.x1) / 2, cz = (v.z0 + v.z1) / 2;
      const c = Math.cos(v.yaw), sn = Math.sin(v.yaw);
      /* Machine-local to world, just proud of the face. Seen from the front,
         local +x is on your left, and the front's texture runs u = 0 on the
         left to u = 32 on the right, so a spot on the texture is at
         x = w/2 - u/32 * w. */
      const ux = (u) => v.w / 2 - (u / 32) * v.w;
      const put = (mesh, lx, ly) => {
        const fz = v.d / 2 + 0.004;
        draws.push({ mesh, x: cx + lx * c + fz * sn, y: ly, z: cz - lx * sn + fz * c, yaw: v.yaw, r: 0.3 });
      };
      M.slots.forEach((k, i) => {
        if (st.n[k] > 0) return;
        if (v.id === 'soda') put(this.meshes.out, ux(18.5), v.h * (1 - (7 + 6 * i) / 64));
        else if (v.id === 'snack') {
          const row = i >> 1, col = i & 1;
          const u = 3 + col * 10 + 4.5, vv = 5 + row * 9 + 3;
          put(this.meshes.coil, ux(u), v.h * (1 - vv / 64));
        } else put(this.meshes.out, ux(16), v.h * (1 - (12 + 14 * i) / 64));
      });
    }
  }
}

export { r2 };
