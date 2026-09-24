/* ============================================================
   breakfast.js -- the Deluxe Continental Breakfast.

   "Deluxe" means two kinds of muffin. Continental means cereal in
   little boxes. The night clerk makes the coffee, mixes the juice,
   fills the trays out of the pantry, fills the waffle batter, turns
   the television on, and cuts the string on the newspapers, and
   then from six o'clock the whole motel comes in at once.

   Coffee matters. Every pot has an age and a strength and nobody
   says so on a meter: people say so. Earl asks whether it is fresh
   before he pours it, and will know if you lie.

   The waffle iron is the only hot food, and it is the only thing in
   the building that can catch fire in a way that makes a man in a
   tie stand up and point at it.
   ============================================================ */
import { STATIONS, STATION_BY_ID, SEATS, BTV, BFAST_COUNTER } from '../world/layout.js';
import { XBuilder } from '../world/geo.js';
import { F_EMIT, F_BLEND, F_DOUBLE } from '../../engine/raster.js';
import { Clock } from './clock.js';

const CUPS_PER_POT = 12;
export const CHANNELS = ['OFF', 'NEWS', 'WEATHER', 'CARTOONS', 'INFOMERCIAL'];

export class Breakfast {
  constructor(shift) {
    this.s = shift;
    const pot = () => ({ level: 0, brewedAt: null, brewing: false, brewEnd: 0, strength: 'normal', stretched: false });
    this.coffee = { coffee: pot(), decaf: pot() };
    this.water = { level: 0 };
    this.juice = { level: 0 };
    this.trays = { cereal: 0, pastry: 0, bagels: 0, fruit: 0 };
    this.waffle = { batter: 0, on: false, state: 'ok', cooking: null, smokeT: 0, used: 0 };
    this.tv = { channel: 'OFF', frameT: 0, frame: 0 };
    this.seats = SEATS.map((s) => ({ ...s, who: null }));
    this.spills = [];
    this.served = { cups: 0, plates: 0, waffles: 0 };
    this.shortages = {};
    this.complaints = [];
    this.open = false;
    this.meshes = this.buildMeshes(shift.g.T);
  }

  /* ---------------- the coffee ---------------- */
  /** fresh / ok / old / burnt / empty, and weak or strong on top. */
  quality(kind = 'coffee') {
    const p = this.coffee[kind];
    if (!p || p.level <= 0.02) return { age: 'empty', strength: 'none' };
    const age = this.s.clock.min - p.brewedAt;
    const a = age < 35 ? 'fresh' : age < 75 ? 'ok' : age < 120 ? 'old' : 'burnt';
    return { age: a, strength: p.stretched ? 'weak' : p.strength, minutes: Math.round(age) };
  }
  brew(kind, packs) {
    const p = this.coffee[kind];
    p.brewing = true; p.brewEnd = this.s.clock.min + 6;
    p.strength = packs >= 2 ? 'strong' : 'normal';
    p.stretched = false;
    this.s.stats.pots++;
  }
  stretch(kind) {
    const p = this.coffee[kind];
    p.level = Math.min(1, p.level + 0.45);
    p.stretched = true;
  }
  pour(kind) {
    const p = this.coffee[kind];
    if (p.level <= 0.02) return false;
    p.level = Math.max(0, p.level - 1 / CUPS_PER_POT);
    this.served.cups++;
    return true;
  }

  /* ---------------- guests at the counter ---------------- */
  /** Which stations somebody visits, in counter order. */
  menuFor(p) {
    const b = (p.def && p.def.breakfast) || { coffee: this.s.rng.chance(0.8) ? 'regular' : null, food: this.s.rng.pick(['pastry', 'cereal', 'bagels', 'fruit', 'waffle']) };
    const picks = [];
    if (b.coffee === 'regular') picks.push('coffee');
    if (b.coffee === 'decaf') picks.push('decaf');
    if (this.s.rng.chance(0.55) || p.child) picks.push('juice');
    if (b.food) picks.push(b.food);
    if (this.s.rng.chance(0.25) && b.food !== 'fruit') picks.push('fruit');
    const order = STATIONS.map((s) => s.id);
    return picks.sort((x, y) => order.indexOf(x) - order.indexOf(y));
  }

  take(p, id) {
    const s = this.s;
    let got = true;
    if (id === 'coffee' || id === 'decaf') {
      const q = this.quality(id);
      got = this.pour(id);
      p.coffeeQ = got ? q : { age: 'empty' };
      p.coffeeKind = id;
      if (!got) this.short(p, id);
      else if (q.age === 'burnt' || q.age === 'old' || q.strength !== 'normal') s.reactToCoffee(p, q, id);
    } else if (id === 'juice') {
      if (this.juice.level > 0.03) this.juice.level = Math.max(0, this.juice.level - 0.06); else { got = false; this.short(p, id); }
    } else if (id === 'waffle') {
      got = this.makeWaffle(p);
    } else if (this.trays[id] !== undefined) {
      if (this.trays[id] > 0) this.trays[id]--; else { got = false; this.short(p, id); }
    }
    if (got) this.served.plates += id === 'coffee' || id === 'decaf' || id === 'juice' ? 0 : 1;
    // a spill, now and then, and more often when you are eight
    if (got && (id === 'juice' || id === 'coffee') && s.rng.chance(p.child ? 0.18 : 0.035)) this.spill(p.x + 0.2, p.z, id === 'juice' ? 'juice' : 'coffee', p);
  }

  short(p, id) {
    this.shortages[id] = (this.shortages[id] || 0) + 1;
    this.s.stats.shortages++;
    this.s.breakfastShort(p, id);
  }

  /* ---------------- the waffle iron ---------------- */
  makeWaffle(p) {
    const W = this.waffle;
    if (!W.on) { this.s.waffleOff(p); return false; }
    if (W.batter <= 0.02) { this.short(p, 'waffle'); return false; }
    if (W.state !== 'ok') { this.s.waffleTrouble(p, W.state); return false; }
    W.batter = Math.max(0, W.batter - 0.05);
    W.used++;
    this.served.waffles++;
    this.s.g.sound.sizzle(this.s.panOf(-7.6, STATION_BY_ID.waffle.z), this.s.near(-7.6, STATION_BY_ID.waffle.z, 10));
    // what can go wrong: too much batter and it comes out the sides and smokes;
    // not enough spray and it sticks; a child and it is on the floor
    const k = p.child ? 0.45 : 0.08 + (W.used > 6 ? 0.05 : 0);
    if (this.s.rng.chance(k)) {
      const r = this.s.rng();
      if (r < 0.5) { W.state = 'smoking'; W.smokeT = 0; this.spill(-6.9, STATION_BY_ID.waffle.z + 0.3, 'batter', p); this.s.waffleSmokes(p); }
      else if (r < 0.8) { W.state = 'stuck'; this.s.waffleSticks(p); }
      else { this.spill(-6.7, STATION_BY_ID.waffle.z + 0.2, 'batter', p); this.s.waffleMess(p); }
    }
    return true;
  }
  cleanWaffle() {
    this.waffle.state = 'ok'; this.waffle.smokeT = 0;
    this.s.g.sound.spray(0);
  }

  /* ---------------- tables ---------------- */
  claimSeat(p) {
    const partyTable = p.party.length ? this.seats.find((s) => s.who && p.party.includes(s.who.id)) : null;
    let pool = this.seats.filter((s) => !s.who);
    if (partyTable) pool = pool.sort((a, b) => (a.table === partyTable.table ? -1 : 0) - (b.table === partyTable.table ? -1 : 0));
    else {
      // people would rather not sit across from a stranger if a table is empty
      const empty = pool.filter((s) => !this.seats.some((o) => o.table === s.table && o.who));
      if (empty.length) pool = empty;
    }
    const seat = pool[0] || null;
    if (seat) seat.who = p;
    return seat;
  }
  sat(p, seat) { p.seat = seat; this.s.barks.sitDown(p); }
  leaveSeat(p, seat) {
    if (seat) seat.who = null;
    p.seat = null;
    this.s.property.trash.breakfast = Math.min(1.2, this.s.property.trash.breakfast + 0.05);
  }
  eating(p, dt) {
    if (p.child && this.s.rng.chance(dt * 0.01)) this.spill(p.x + 0.4, p.z + 0.2, 'juice', p);
    if (p.wantsChannel && this.tv.channel !== p.wantsChannel && !p.askedChannel && this.s.rng.chance(dt * 0.04)) {
      p.askedChannel = true; this.s.channelRequest(p);
    }
  }
  tableMates(p) {
    if (!p.seat) return [];
    return this.seats.filter((s) => s.who && s.who !== p && s.table === p.seat.table).map((s) => s.who);
  }
  diners() { return this.seats.filter((s) => s.who).map((s) => s.who); }

  /* ---------------- spills ---------------- */
  spill(x, z, kind, who) {
    if (this.spills.length > 8) return;
    this.spills.push({ id: Math.random(), x, z, kind, by: who ? who.name : '', at: this.s.clock.min });
    this.s.g.sound.splat(this.s.panOf(x, z), this.s.near(x, z, 12));
    this.s.stats.spills++;
  }
  mop(sp) { this.spills.splice(this.spills.indexOf(sp), 1); this.s.g.sound.mop(0); }

  /* ---------------- television ---------------- */
  nextChannel() {
    const i = CHANNELS.indexOf(this.tv.channel);
    this.tv.channel = CHANNELS[(i + 1) % CHANNELS.length];
    this.s.g.sound.tvOn(this.s.panOf(BTV.x, BTV.z));
    this.s.channelChanged(this.tv.channel);
  }
  tvFrame() {
    const T = this.s.g.T;
    const frames = T.channels[this.tv.channel] || T.channels.OFF;
    return frames[this.tv.frame % frames.length];
  }

  /* ---------------- per frame ---------------- */
  update(dt) {
    const s = this.s;
    for (const kind of ['coffee', 'decaf']) {
      const p = this.coffee[kind];
      if (p.brewing && s.clock.min >= p.brewEnd) {
        p.brewing = false; p.level = 1; p.brewedAt = s.clock.min;
        s.g.sound.coffeeGurgle(s.panOf(-7.6, STATION_BY_ID[kind].z), s.near(-7.6, STATION_BY_ID[kind].z, 14));
      }
    }
    const W = this.waffle;
    if (W.state === 'smoking') {
      W.smokeT += dt;
      if (W.smokeT > 1.2 && s.rng.chance(dt * 0.5)) s.g.sound.sizzle(s.panOf(-7.6, STATION_BY_ID.waffle.z), s.near(-7.6, STATION_BY_ID.waffle.z, 10) * 0.6);
    }
    this.tv.frameT += dt;
    if (this.tv.frameT > 0.45) { this.tv.frameT = 0; this.tv.frame++; }
    if (!this.open && s.clock.past(6, 0)) { this.open = true; s.breakfastOpens(); }
  }

  placeAmbience(sound, zone) {
    const inB = zone === 'breakfast';
    const nearOffice = zone === 'lobby' || zone === 'desk' || zone === 'pantry';
    const k = inB ? 1 : nearOffice ? 0.35 : 0;
    sound.placeLoop('tvTalk', BTV.x, BTV.z, this.tv.channel !== 'OFF' ? 0.4 * k : 0, 9, 1);
    const hot = this.coffee.coffee.level > 0 || this.coffee.coffee.brewing || this.coffee.decaf.level > 0;
    sound.placeLoop('coffee', -7.6, -6.5, hot ? 0.5 * k : 0, 6, 1);
  }

  /* ---------------- how it looks ---------------- */
  buildMeshes(T) {
    const mk = (fn) => { const b = new XBuilder(); b.light = () => 1; fn(b); return b.build(); };
    return {
      pot: mk((b) => { b.box(-0.075, 0, -0.075, 0.075, 0.2, 0.075, { all: { tex: T.potFull, uv: [0, 0, 16, 16] } }); b.solid(-0.08, 0.2, -0.02, 0.08, 0.23, 0.02, T.plasticBlack, [0, 0, 8, 8]); }),
      potEmpty: mk((b) => { b.box(-0.075, 0, -0.075, 0.075, 0.2, 0.075, { all: { tex: T.potEmpty, uv: [0, 0, 16, 16] } }); b.solid(-0.08, 0.2, -0.02, 0.08, 0.23, 0.02, T.plasticBlack, [0, 0, 8, 8]); }),
      juice: mk((b) => b.box(-0.14, 0, -0.14, 0.14, 0.52, 0.14, { all: { tex: T.juice, uv: [0, 0, 32, 64] } })),
      juiceEmpty: mk((b) => b.box(-0.14, 0, -0.14, 0.14, 0.52, 0.14, { all: { tex: T.juiceEmpty, uv: [0, 0, 32, 64] } })),
      tray: mk((b) => b.box(-0.2, 0, -0.2, 0.2, 0.05, 0.2, { all: { tex: T.metal, uv: [0, 0, 16, 4] }, py: { tex: T.muffins, uv: [0, 0, 32, 32] } })),
      trayDanish: mk((b) => b.box(-0.2, 0, -0.2, 0.2, 0.05, 0.2, { all: { tex: T.metal, uv: [0, 0, 16, 4] }, py: { tex: T.danish, uv: [0, 0, 32, 32] } })),
      bagels: mk((b) => b.box(-0.2, 0, -0.2, 0.2, 0.09, 0.2, { all: { tex: T.wood, uv: [0, 0, 16, 8] }, py: { tex: T.bagels, uv: [0, 0, 32, 32] } })),
      fruit: mk((b) => b.box(-0.18, 0, -0.18, 0.18, 0.1, 0.18, { all: { tex: T.wood, uv: [0, 0, 16, 8] }, py: { tex: T.fruit, uv: [0, 0, 32, 32] } })),
      empty: mk((b) => b.box(-0.2, 0, -0.2, 0.2, 0.04, 0.2, { all: { tex: T.metal, uv: [0, 0, 16, 4] }, py: { tex: T.emptyTray, uv: [0, 0, 32, 32] } })),
      cereal: mk((b) => b.box(-0.03, 0, -0.28, 0.1, 0.34, 0.28, { all: { tex: T.cereal, uv: [0, 0, 64, 32] }, px: { tex: T.cereal, uv: [0, 0, 64, 32] } })),
      waffle: mk((b) => { b.box(-0.17, 0, -0.17, 0.17, 0.1, 0.17, { all: { tex: T.darkMetal, uv: [0, 0, 16, 16] }, py: { tex: T.waffleIron, uv: [0, 0, 32, 32] } }); }),
      batter: mk((b) => b.box(-0.07, 0, -0.07, 0.07, 0.34, 0.07, { all: { tex: T.batter, uv: [0, 0, 16, 32] } })),
      smoke: mk((b) => { b.quad([-0.25, 0, 0], [0.25, 0, 0], [0.25, 0.5, 0], [-0.25, 0.5, 0], T.waffleSmoke, [0, 0, 32, 32], F_BLEND | F_DOUBLE); b.quad([0, 0, -0.25], [0, 0, 0.25], [0, 0.5, 0.25], [0, 0.5, -0.25], T.waffleSmoke, [0, 0, 32, 32], F_BLEND | F_DOUBLE); }),
      spillJuice: mk((b) => b.quad([-0.35, 0.008, 0.3], [0.35, 0.008, 0.3], [0.35, 0.008, -0.3], [-0.35, 0.008, -0.3], T.spill, [0, 0, 32, 32], 0)),
      spillCoffee: mk((b) => b.quad([-0.35, 0.008, 0.3], [0.35, 0.008, 0.3], [0.35, 0.008, -0.3], [-0.35, 0.008, -0.3], T.spillCoffee, [0, 0, 32, 32], 0)),
      spillBatter: mk((b) => b.quad([-0.3, 0.008, 0.28], [0.3, 0.008, 0.28], [0.3, 0.008, -0.28], [-0.3, 0.008, -0.28], T.spillBatter, [0, 0, 32, 32], 0)),
      cup: mk((b) => b.solid(-0.035, 0, -0.035, 0.035, 0.1, 0.035, T.cups, [0, 0, 16, 16])),
      plate: mk((b) => b.solid(-0.11, 0, -0.11, 0.11, 0.015, 0.11, T.plates, [0, 0, 16, 16])),
      glow: mk((b) => b.solid(-0.02, 0, -0.02, 0.02, 0.02, 0.02, T.headlight, [0, 0, 8, 8], null, F_EMIT)),
    };
  }

  draw(draws) {
    const M = this.meshes, y = BFAST_COUNTER.y;
    const X = -7.55;
    const z = (id) => STATION_BY_ID[id].z;
    for (const kind of ['coffee', 'decaf']) {
      const p = this.coffee[kind];
      draws.push({ mesh: p.level > 0.05 || p.brewing ? M.pot : M.potEmpty, x: X + 0.18, y: y + 0.02, z: z(kind), r: 0.4 });
    }
    draws.push({ mesh: this.juice.level > 0.05 ? M.juice : M.juiceEmpty, x: X - 0.05, y, z: z('juice'), r: 0.5 });
    if (this.trays.cereal > 0) draws.push({ mesh: M.cereal, x: X - 0.33, y, z: z('cereal'), r: 0.5, scale: 0.6 + Math.min(1, this.trays.cereal / 12) * 0.4 });
    draws.push({ mesh: this.trays.pastry > 0 ? (this.trays.pastry % 3 === 0 ? M.trayDanish : M.tray) : M.empty, x: X, y, z: z('pastry'), r: 0.5 });
    draws.push({ mesh: this.trays.bagels > 0 ? M.bagels : M.empty, x: X, y, z: z('bagels'), r: 0.5 });
    draws.push({ mesh: this.trays.fruit > 0 ? M.fruit : M.empty, x: X, y, z: z('fruit'), r: 0.5 });
    draws.push({ mesh: M.waffle, x: X, y, z: z('waffle') + 0.15, r: 0.5 });
    if (this.waffle.batter > 0.02) draws.push({ mesh: M.batter, x: X - 0.1, y, z: z('waffle') - 0.25, r: 0.5 });
    if (this.waffle.on) draws.push({ mesh: M.glow, x: X + 0.17, y: y + 0.05, z: z('waffle') + 0.3, r: 0.2, shade: 1 });
    if (this.waffle.state === 'smoking') {
      const t = this.s.g.time;
      for (let i = 0; i < 3; i++) draws.push({ mesh: M.smoke, x: X + Math.sin(t * 0.7 + i) * 0.06, y: y + 0.1 + ((t * 0.35 + i * 0.33) % 1) * 0.9, z: z('waffle') + 0.15, yaw: t * 0.3 + i, r: 0.6, shade: 0.9 });
    }
    for (const sp of this.spills) {
      draws.push({ mesh: sp.kind === 'coffee' ? M.spillCoffee : sp.kind === 'batter' ? M.spillBatter : M.spillJuice, x: sp.x, y: 0, z: sp.z, yaw: sp.id * 6, r: 0.5 });
    }
    // cups and plates on the tables in front of whoever is eating
    for (const seat of this.seats) {
      if (!seat.who) continue;
      const fx = Math.sin(seat.yaw) * 0.3, fz = Math.cos(seat.yaw) * 0.3;
      draws.push({ mesh: M.plate, x: seat.x + fx, y: 0.74, z: seat.z + fz, r: 0.3 });
      if (seat.who.coffeeKind) draws.push({ mesh: M.cup, x: seat.x + fx * 0.8 + 0.15, y: 0.74, z: seat.z + fz * 0.8 + 0.1, r: 0.2 });
    }
  }

  /** How much to put out, if anybody asks: roughly one of everything per guest. */
  static suggest(guests) {
    return { pots: guests > 14 ? 3 : guests > 6 ? 2 : 1, muffins: Math.ceil(guests * 0.6), bagels: Math.ceil(guests * 0.4), cereal: Math.ceil(guests * 0.5) };
  }
}

export { Clock };
