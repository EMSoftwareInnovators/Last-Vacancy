/* ============================================================
   director.js -- tonight, planned.

   At seven the director looks at the calendar and the binder and
   the memory of every night before this one, and decides who is
   already here, who has a reservation, who will pull in off the
   highway and roughly when, which rooms will call about what,
   who will phone from outside, and what small thing will break.
   Then it lets the night happen. Times are windows, not
   appointments, and the rolls change every shift, so no two
   Thursdays are the same Thursday.

   It also owns each guest's evening: drive in, register, move the
   car, go to the room, turn the lights out, get up, eat a muffin,
   leave. Everything anybody does is an activity from npcs.js
   pushed onto their queue at the right time.
   ============================================================ */
import { makeRng } from '../../engine/mathx.js';
import { PERSON, appFor, crewMember } from '../content/people.js';
import { rollTraveler, pickArchetype } from '../content/travelers.js';
import { createPerson, walkTo, idle, run, until, getInCar, getOutOfCar, drive, enterRoom, inRoom, exitRoom, toDesk, follow, iceRun, vendRun, porch, breakfastVisit, walkOff } from './npcs.js';
import { SPOTS, ROOM_BY_NO, DRIVE, STALLS, DESK_PROPS, NEWS_DROP } from '../world/layout.js';
import { Clock } from './clock.js';
import { nightly, ACCOUNTS } from './ledger.js';
import { roomCall, pillowCall, OUTSIDE_CALLS, locatorCall } from '../dialogue/calls.js';
import { say, reply } from '../dialogue/runner.js';

const at = Clock.at;
const ROAD = { x: 10.3, z: -16.6 };

let resSeq = 981;

export class Director {
  constructor(shift) {
    this.s = shift;
    this.events = [];
    this.reservations = [];
    this.people = {};
    this.log = [];
  }

  rnd(win) {
    if (win === null || win === undefined) return null;
    if (typeof win === 'number') return win;
    return win[0] + this.s.rng() * (win[1] - win[0]);
  }
  at(min, fn, label = '') { this.events.push({ min, fn, label, done: false }); }
  after(mins, fn, label) { this.at(this.s.clock.min + mins, fn, label); }

  /* ============================================================
     SETUP
     ============================================================ */
  setup() {
    const s = this.s, rng = s.rng;
    const shiftNo = s.memory.shiftNo;
    const weekday = s.clock.weekday();
    this.variant = { weekday, shiftNo };

    this.setupRooms();
    this.setupInHouse();

    /* ---- tonight's reservations ---- */
    const earl = weekday === 4;                   // Earl is Thursdays
    if (earl) this.reserve({ id: 'EARL', name: 'Earl Maddox', nights: 1, beds: 'K', gtd: true, room: '105', rateCode: 'RACK', note: 'REGULAR -- 105' });
    // the group: a crew on weeknights, a ball team Friday, a tour bus Saturday
    const group = weekday === 5 ? 'TEAM' : weekday === 6 ? 'BUS' : 'CREW';
    this.variant.group = group;
    if (group === 'CREW' && !s.memory.d.flags.crewIn) this.reserve({ id: 'BUDDY', name: 'Tri-Parish Paving (Guidry)', group: true, rooms: 4, nights: 3, beds: 'D', note: 'VOUCHER. DOWNSTAIRS, TOGETHER, SMOKING OK' });
    this.reserve({ id: 'RIVAS', name: 'Hector Rivas', nights: 1, beds: 'QQ', gtd: true, room: '203', note: 'GTD LATE ARRIVAL' });

    /* ---- who is coming ---- */
    const plan = [];
    if (group === 'CREW' && !s.memory.d.flags.crewIn) plan.push({ id: 'BUDDY', arrive: [at(19, 12), at(19, 26)] });
    plan.push({ id: 'CONNIE' });
    if (earl) plan.push({ id: 'EARL' });
    plan.push({ id: 'PRUITT' });
    if (!s.memory.d.flags.mercersHome) plan.push({ id: 'KYLE' });
    // two of the ones people tell stories about, and one or two faces from across town
    const oneoffs = rng.sample(['PILLOWS', 'STORM', 'MAGIC', 'URN', 'ENCYC'], shiftNo === 1 ? 2 : 2 + rng.int(2));
    for (const id of oneoffs) plan.push({ id });
    const cameos = rng.sample(['VERNA', 'OTIS'], 1 + (rng.chance(0.5) ? 1 : 0));
    for (const id of cameos) {
      plan.push({ id });
      if (id === 'VERNA') this.reserve({ id: 'VERNA', name: 'Verna Ashby', nights: 2, beds: 'K', gtd: false, room: '107', rateCode: 'AAA', note: 'AAA -- GROUND FL QUIET' });
    }
    plan.push({ id: 'LATENIGHT' });
    // strangers
    const nTrav = 3 + rng.int(3);
    const used = [];
    for (let i = 0; i < nTrav; i++) {
      const arch = pickArchetype(rng, used.filter((a) => a === 'hiding' || a === 'pastor'));
      used.push(arch.id);
      const t = rollTraveler(rng, arch);
      plan.push({ def: t, arrive: [at(19, 30) + i * 55 + rng() * 20, at(19, 30) + i * 55 + 45 + rng() * 20] });
    }
    this.plan = plan;
    for (const e of plan) this.scheduleArrival(e);

    /* ---- the rest of the night ---- */
    this.scheduleResidents();
    this.scheduleCalls();
    this.scheduleProblems();
    this.scheduleVisits();
    this.scheduleMorning();
  }

  /** Room states at seven o'clock: what the day desk left you. */
  setupRooms() {
    const s = this.s;
    const saved = s.memory.d.rooms;
    if (saved) s.rooms.load(saved);
    else {
      for (const st of s.rooms.all()) { st.status = 'VC'; st.sys = 'VC'; st.keys = 2; }
      const oo = s.rooms.get('212'); oo.status = 'OO'; oo.sys = 'OO'; oo.issues.add('carpet');
      const vd = s.rooms.get('111'); vd.status = 'VD'; vd.sys = 'VD';
    }
    // anything the day desk checked out gets cleaned by the day crew
    for (const st of s.rooms.all()) {
      if (!st.guest && (st.sys === 'VD')) { if (s.rng() < 0.7 || st.no !== '111') { st.sys = 'VC'; st.status = 'VC'; } }
      if (!st.guest && st.sys === 'RS') { st.sys = 'VC'; st.status = 'VC'; st.reservedFor = null; }
      if (!st.guest && st.sys !== 'OO') st.keys = 2;
    }
  }

  reserve(r) {
    const res = { code: `R-${String(resSeq++).padStart(4, '0')}`, rooms: 1, arrived: false, ...r };
    this.reservations.push(res);
    if (res.room) {
      const st = this.s.rooms.get(res.room);
      if (st && !st.guest && st.sys === 'VC') { st.sys = 'RS'; st.status = 'RS'; st.reservedFor = res.name.split(' ').slice(-1)[0]; }
      else res.room = null;
    }
    return res;
  }
  reservationFor(p) {
    const id = p.rosterId;
    return this.reservations.find((r) => !r.arrived && (r.id === id || (r.name === p.name))) || null;
  }

  /* ============================================================
     PEOPLE
     ============================================================ */
  /** A person from a roster id or a rolled traveler definition. */
  person(def, o = {}) {
    const s = this.s;
    const roster = typeof def === 'string' ? PERSON[def] : null;
    const d = roster || def;
    const app = roster ? appFor(roster.id) : d.app;
    const p = createPerson({
      id: roster ? roster.id : d.id, rosterId: roster ? roster.id : null, def: d,
      name: d.name, app, tagLine: d.tag, kind: d.kind, stay: d.stay, lines: d.lines || null,
      patience: d.kind === 'regular' || d.kind === 'resident' ? 600 : 150 + s.rng() * 120,
      ...o,
    });
    p.lineSeed = Math.floor(s.rng() * 1000);
    p.lineUses = {};
    if (d.product) p.product = d.product;
    if (roster && roster.priorStays) s.memory.guest(roster.id, { priorStays: roster.priorStays });
    if (p.stay && p.stay.noDisclose) p.noDisclose = true;
    if (d.breakfast && d.breakfast.channel) p.wantsChannel = d.breakfast.channel;
    s.npcs.add(p);
    this.people[p.id] = p;
    return p;
  }

  /** The people who come with somebody: a wife, two kids, the man's wife with the bag. */
  companions(p) {
    const s = this.s, d = p.def;
    const ids = [];
    if (d.partner && PERSON[d.partner] && PERSON[d.partner].companion) ids.push(d.partner);
    if (d.family) ids.push(...d.family);
    const out = [];
    for (const id of ids) {
      const c = this.person(id, { leader: p.id });
      c.followsLeader = true;
      c.stay = null;
      out.push(c);
      p.party.push(c.id);
      s.npcs.push(c, follow(p.id, { offset: 0.9 + out.length * 0.25, side: out.length % 2 ? 0.6 : -0.6 }));
    }
    return out;
  }

  /* ---------------- arriving ---------------- */
  scheduleArrival(e) {
    const s = this.s;
    const d = e.def || PERSON[e.id];
    const win = e.arrive || (d.schedule && d.schedule.arrive) || [at(20, 0), at(23, 0)];
    const t = this.rnd(win);
    this.at(t, () => this.arrive(e.def || e.id), `arrive ${d.name}`);
  }

  arrive(def) {
    const s = this.s;
    const p = this.person(def);
    if (p.rosterId === 'BUDDY') return this.arriveCrew(p);
    this.companions(p);
    const v = p.stay && p.stay.vehicle;
    if (!v || (p.def && p.def.walksIn)) {
      p.x = ROAD.x; p.z = ROAD.z; p.lv = 0; p.hidden = false;
      s.npcs.push(p, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0));
      s.npcs.push(p, toDesk('checkin'));
      return p;
    }
    p.car = s.cars.add(v, p);
    for (const id of p.party) { const c = s.npcs.find(id); if (c) c.car = p.car; }
    s.npcs.push(p, drive((car, done) => s.cars.arrive(car, done)));
    s.npcs.push(p, getOutOfCar());
    s.npcs.push(p, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0));
    s.npcs.push(p, toDesk('checkin'));
    return p;
  }

  /** Four men in orange in two white trucks. Buddy does the talking. */
  arriveCrew(p) {
    const s = this.s;
    const members = [];
    const trucks = [s.cars.add(p.stay.vehicle, p), s.cars.add({ color: 'white', kind: 'pickup', desc: 'White company pickup', plate: 'LA TPP 14' }, p)];
    p.car = trucks[0];
    p.group = { name: 'TRI-PARISH', rooms: 4, members: [], account: 'TRIPARISH' };
    for (let i = 0; i < 3; i++) {
      const cm = crewMember(i);
      const m = this.person({ id: `CREW${i}`, name: cm.name, tag: 'Tri-Parish Paving', kind: 'crew', app: cm.app, stay: { party: 1, nights: 3, beds: 'D', smoking: true, pay: 'VOUCHER', account: 'TRIPARISH' }, breakfast: { coffee: 'regular', food: null } });
      m.car = i === 0 ? trucks[0] : trucks[1];
      m.crewLeader = p.id;
      m.followsLeader = true;
      p.group.members.push(cm.name.split(' ').slice(-1)[0].toUpperCase());
      p.party.push(m.id);
      members.push(m);
      s.npcs.push(m, follow(p.id, { offset: 1.3 + i * 0.5, side: i % 2 ? 0.8 : -0.8 }));
    }
    p.crew = members.map((m) => m.id);
    s.npcs.push(p, drive((car, done) => s.cars.arrive(car, done)));
    s.cars.arrive(trucks[1], () => {});
    s.npcs.push(p, getOutOfCar());
    s.npcs.push(p, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0));
    s.npcs.push(p, toDesk('checkin'));
    return p;
  }

  /** Registered, paid, keyed. Now: to the room. */
  afterCheckin(p) {
    const s = this.s;
    const room = p.room;
    if (p.crew) return this.crewToRooms(p);
    for (const id of p.party) { const c = s.npcs.find(id); if (c) { c.room = room; c.keyFor = p.keyFor; } }
    if (p.car) {
      s.npcs.push(p, getInCar());
      s.npcs.push(p, drive((car, done) => s.cars.toRoom(car, room, done)));
      s.npcs.push(p, getOutOfCar());
    }
    s.npcs.push(p, enterRoom());
    this.evening(p);
  }

  crewToRooms(p) {
    const s = this.s;
    const rooms = p.groupRooms;
    p.room = rooms[0]; p.keyFor = rooms[0];
    const trucks = [...new Set([p.car, ...p.crew.map((id) => s.npcs.find(id).car)])];
    p.crew.forEach((id, i) => {
      const m = s.npcs.find(id);
      m.room = rooms[i + 1] || rooms[0]; m.keyFor = m.room;
      m.followsLeader = false;
      s.npcs.clear(m);
      s.npcs.push(m, walkTo(s.cars.doorOf(m.car).x + (i - 1) * 0.8, s.cars.doorOf(m.car).z + 1.2, 0));
      s.npcs.push(m, enterRoom());
      this.evening(m, { bed: [at(21, 15), at(21, 50)], breakfast: null });
    });
    s.npcs.push(p, getInCar());
    s.npcs.push(p, drive((car, done) => s.cars.toRoom(car, rooms[0], done)));
    s.npcs.push(p, getOutOfCar());
    s.npcs.push(p, enterRoom());
    // the second truck follows to the next stall down the row
    if (trucks[1]) s.cars.toRoom(trucks[1], rooms[Math.min(2, rooms.length - 1)], () => {});
    this.evening(p);
  }

  /** From the room to bed to morning. */
  evening(p, over = {}) {
    const s = this.s, sch = { ...((p.def && p.def.schedule) || {}), ...over };
    const bed = this.rnd(sch.bed || [at(22, 30), at(24, 0)]);
    p.bedAt = bed;
    s.npcs.push(p, inRoom(bed));
    s.npcs.push(p, this.sleepAct());
    s.npcs.push(p, run((pp) => this.morning(pp)));
  }

  /** Sleep until your alarm, or until the desk calls, or -- if the desk doesn't -- a while after. */
  sleepAct() {
    const s = this.s, D = this;
    return {
      kind: 'sleep',
      start(p) {
        const st = s.rooms.get(p.room);
        if (st) { st.awake = false; st.lightsOn = false; st.tvOn = false; }
        p.asleep = true; p.sit = true;
        const sch = (p.def && p.def.schedule) || {};
        if (!p.wakeAt) {
          if (p.wakeWanted) p.wakeAt = Infinity;             // waiting for the phone
          else p.wakeAt = D.rnd(sch.early || sch.breakfast || [at(6, 0), at(6, 40)]) - 8;
        }
      },
      update(p) { return s.clock.min >= p.wakeAt; },
      end(p) {
        const st = s.rooms.get(p.room);
        if (st) { st.awake = true; st.lightsOn = true; }
        p.asleep = false; p.sit = false;
      },
    };
  }

  /** The morning: out of the room, maybe breakfast, then either stay or go. */
  morning(p) {
    const s = this.s, sch = (p.def && p.def.schedule) || {};
    const bf = p.def && p.def.breakfast;
    const stayingOn = p.stay && p.stay.nights > 1 && !p.leavingToday;
    if (p.kind === 'crew' || p.rosterId === 'BUDDY') {
      // coffee if there is any, then to work
      s.npcs.push(p, exitRoom());
      p.menuOverride = ['coffee'];
      s.npcs.push(p, breakfastVisit({ lingers: 3 }));
      s.npcs.push(p, until(() => s.clock.past(5, 30)));
      s.npcs.push(p, run((pp) => this.driveOff(pp, true)));
      return;
    }
    if (p.rosterId === 'DARNELL') {
      s.npcs.push(p, exitRoom());
      p.menuOverride = ['coffee'];
      s.npcs.push(p, breakfastVisit({ lingers: 4 }));
      s.npcs.push(p, run((pp) => this.driveOff(pp, true)));
      return;
    }
    s.npcs.push(p, exitRoom());
    if (p.rosterId === 'STORM') {
      s.npcs.push(p, walkTo(-2, 11, 0, {}));
      s.npcs.push(p, until(() => s.clock.past(5, 45), { face: -Math.PI / 2 }));
    }
    const bfAt = this.rnd(sch.breakfast);
    if (bf && bfAt) {
      s.npcs.push(p, until(() => s.clock.min >= bfAt));
      this.breakfastParty(p, bf);
    }
    if (stayingOn) {
      s.npcs.push(p, enterRoom());
      s.npcs.push(p, inRoom());
      return;
    }
    const co = this.rnd(sch.checkout === 'wake' ? null : sch.checkout) || s.clock.min + 10;
    s.npcs.push(p, until(() => s.clock.min >= co));
    const drop = p.kind === 'traveler' ? s.rng() < 0.4 : ['CONNIE', 'STORM', 'LATENIGHT'].includes(p.rosterId);
    if (drop) s.npcs.push(p, this.keyDropAct());
    else {
      s.npcs.push(p, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0));
      s.npcs.push(p, toDesk('checkout'));
    }
    s.npcs.push(p, run((pp) => this.driveOff(pp)));
  }

  breakfastParty(p, bf) {
    const s = this.s;
    s.npcs.push(p, breakfastVisit({ lingers: bf.lingers || 12 }));
    // the family goes in on its own and eats on its own, and catches up after
    for (const id of p.party) {
      const c = s.npcs.find(id);
      if (!c) continue;
      s.npcs.clear(c);
      s.npcs.push(c, until(() => !p.inRoom && !p.asleep));
      s.npcs.push(c, breakfastVisit({ lingers: (c.def.breakfast && c.def.breakfast.lingers) || 15 }));
      s.npcs.push(c, follow(p.id, { offset: 1 }));
    }
  }

  keyDropAct() {
    const s = this.s;
    const kd = DESK_PROPS.keydrop;
    return {
      kind: 'keyDrop',
      start(p, sh, n) { n.route(p, (kd.x0 + kd.x1) / 2, kd.z1 + 0.55, 0); },
      update(p, dt, sh, n) {
        if (p.path) { n.step(p, dt); return false; }
        if (!this.w) { this.w = 1.2; p.reach = true; }
        this.w -= dt;
        if (this.w > 0) return false;
        p.reach = false;
        if (p.keyFor) { s.keyDrop.push({ room: p.keyFor, who: p.id, name: p.name }); p.keyFor = null; s.g.sound.keys(s.panOf(p.x, p.z)); }
        const f = s.ledger.folioForRoom(p.room);
        if (f) f.departed = true;
        return true;
      },
    };
  }

  driveOff(p, toWork = false) {
    const s = this.s;
    const f = s.ledger.folioForRoom(p.room);
    if (f && !toWork) f.departed = true;
    if (!toWork) { s.stats.departures++; s.departed(p); }
    if (p.car) {
      s.npcs.push(p, getInCar());
      s.npcs.push(p, drive((car, done) => s.cars.leave(car, done)));
      s.npcs.push(p, run((pp) => { pp.gone = true; for (const id of pp.party) { const c = s.npcs.find(id); if (c) c.gone = true; } }));
    } else {
      s.npcs.push(p, walkOff(ROAD.x, ROAD.z));
    }
  }

  /* ============================================================
     IN-HOUSE AT SEVEN
     ============================================================ */
  setupInHouse() {
    const s = this.s, rng = s.rng;
    const mem = s.memory.d;
    const list = [];
    // the weeklies
    list.push({ id: 'HOLLIS', room: '102' }, { id: 'ABERNATHY', room: '115' }, { id: 'DARNELL', room: '206' });
    if (s.memory.shiftNo === 1) list.push({ id: 'WEXLER', room: '205', nightsLeft: 2 });
    // whoever is staying over from last night
    for (const h of mem.inHouse || []) if (!list.some((x) => x.id === h.id)) list.push(h);
    // two or three the day desk checked in this afternoon
    const n = 2 + rng.int(2);
    for (let i = 0; i < n; i++) {
      const t = rollTraveler(rng, pickArchetype(rng, ['hiding', 'brokedown', 'trucker']));
      list.push({ def: t, day: true });
    }
    for (const h of list) this.placeInHouse(h);
  }

  placeInHouse(h) {
    const s = this.s;
    const p = this.person(h.def || h.id);
    let room = h.room;
    if (!room || s.rooms.get(room).guest && s.rooms.get(room).guest !== p.id) {
      const want = p.stay && p.stay.beds;
      const free = s.rooms.all().filter((st) => s.rooms.sellable(st) && (!want || st.def.beds === want));
      const pick = free[Math.floor(s.rng() * free.length)] || s.rooms.vacantClean()[0];
      room = pick ? pick.no : null;
    }
    if (!room) { p.gone = true; return; }
    p.room = room; p.keyFor = room;
    p.stay = p.stay ? { ...p.stay } : { party: 1, nights: 1, beds: 'K', smoking: false, pay: 'CASH', rateCode: 'RACK' };
    if (h.nightsLeft) p.stay.nights = h.nightsLeft;
    const st = s.rooms.get(room);
    s.rooms.register(room, p, p.stay.party || 1);
    st.status = 'OC';
    st.keys = Math.min(st.keys, 1);
    // their folio, already paid by whoever was on the desk
    const acct = ACCOUNTS.find((a) => a.id === p.stay.account) || null;
    const weekly = p.kind === 'resident';
    const f = s.ledger.open({
      room, name: p.name, guestId: p.id, party: p.stay.party || 1, nights: weekly ? 7 : p.stay.nights,
      rateCode: weekly ? 'WEEKLY' : p.stay.rateCode || 'RACK', rate: weekly ? 159 / 7 : nightly(st.def.beds, p.stay.party || 1, p.stay.rateCode || 'RACK', acct),
      pay: p.stay.pay || 'CASH', account: p.stay.account || null, at: 0,
    });
    s.ledger.recharge(f, 0);
    s.ledger.pay(f, p.stay.pay === 'DIRECT' ? 'DIRECT' : 'PREPAID', s.ledger.balance(f), 'DAY DESK', 0);
    f.prepaid = true;
    if (p.rosterId === 'HOLLIS' && s.clock.weekday() === 4) f.rentDue = true;
    // the car is out front
    if (p.stay.vehicle) {
      p.car = s.cars.add(p.stay.vehicle, p);
      const stall = s.cars.stallForRoom(room);
      if (stall) s.cars.placeAt(p.car, stall);
    }
    this.companions(p);
    for (const id of p.party) { const c = s.npcs.find(id); if (c) { c.room = room; c.keyFor = room; c.hidden = true; } }
    p.inHouse = true;
    const sch = (p.def && p.def.schedule) || {};
    if (p.rosterId === 'HOLLIS') {
      s.npcs.push(p, inRoom(at(19, 25)));
      s.npcs.push(p, exitRoom());
      if (f.rentDue) { s.npcs.push(p, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0)); s.npcs.push(p, toDesk('rent')); s.npcs.push(p, walkTo(ROOM_BY_NO[room].outside.x, ROOM_BY_NO[room].outside.z, 0)); }
      s.npcs.push(p, porch(this.rnd(sch.porch ? [sch.porch[1] - 20, sch.porch[1]] : at(22, 40))));
      s.npcs.push(p, enterRoom());
      this.evening(p);
      return;
    }
    if (p.rosterId === 'ABERNATHY') {
      s.npcs.push(p, inRoom(this.rnd([at(20, 40), at(21, 0)])));
      s.npcs.push(p, exitRoom());
      s.npcs.push(p, iceRun());
      s.npcs.push(p, idle(25, { face: 0 }));
      s.npcs.push(p, enterRoom());
      this.evening(p);
      return;
    }
    if (p.rosterId === 'DARNELL') {
      s.wakeups.add(room, at(4, 45), p.id, { name: 'PIKE', note: 'standing' });
      p.wakeWanted = at(4, 45);
      s.npcs.push(p, inRoom(this.rnd(sch.laundry)));
      s.npcs.push(p, exitRoom());
      s.npcs.push(p, walkTo(SPOTS.laundryIn.x, SPOTS.laundryIn.z, 0));
      s.npcs.push(p, run(() => { s.laundryRunning = true; }));
      s.npcs.push(p, idle(260, { face: Math.PI }));
      s.npcs.push(p, run(() => { s.laundryRunning = false; }));
      s.npcs.push(p, enterRoom());
      this.evening(p, { bed: [at(23, 45), at(24, 0)] });
      return;
    }
    if (p.rosterId === 'WEXLER') {
      p.stay.nights = 2; p.leavingToday = false;
      s.npcs.push(p, inRoom(this.rnd([at(19, 50), at(20, 20)])));
      s.npcs.push(p, exitRoom());
      s.npcs.push(p, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0));
      p.visitId = 'WEXLER';
      s.npcs.push(p, toDesk('visit'));
      s.npcs.push(p, enterRoom());
      this.evening(p);
      return;
    }
    // everybody else: in for the night; a few go out for supper first
    if (h.day && s.rng() < 0.4 && p.car) {
      const back = this.rnd([at(20, 30), at(21, 45)]);
      s.npcs.push(p, inRoom(this.rnd([at(19, 5), at(19, 40)])));
      s.npcs.push(p, exitRoom());
      s.npcs.push(p, getInCar());
      s.npcs.push(p, drive((car, done) => s.cars.leave(car, done)));
      s.npcs.push(p, until(() => s.clock.min >= back));
      s.npcs.push(p, drive((car, done) => { s.cars.arriveTo(car, room, done); }));
      s.npcs.push(p, getOutOfCar());
      s.npcs.push(p, enterRoom());
    }
    this.evening(p);
  }

  /* ============================================================
     RESIDENTS, CALLS, PROBLEMS, VISITS
     ============================================================ */
  scheduleResidents() {}

  scheduleCalls() {
    const s = this.s, rng = s.rng;
    const call = (id, when) => {
      const def = OUTSIDE_CALLS.find((c) => c.id === id);
      if (!def) return;
      this.at(when, () => s.incoming(def.make(s)), `call ${id}`);
    };
    if (this.variant.group === 'CREW' && this.reservations.some((r) => r.id === 'BUDDY')) call('triparish', at(19, 4) + rng() * 4);
    call('june', this.rnd([at(20, 45), at(21, 25)]));
    const pool = OUTSIDE_CALLS.filter((c) => !c.fixed && (c.id !== 'gordy' || rng.chance(0.65)));
    const n = 4 + rng.int(2);
    for (const c of rng.sample(pool, Math.min(n, pool.length))) call(c.id, this.rnd(c.when));
    if (rng.chance(0.5)) call('rates', this.rnd([at(21, 30), at(23, 30)]));
    if (rng.chance(0.55)) { call('circulation', this.rnd([at(4, 20), at(4, 40)])); this.paperLate = true; }
  }

  /** Things go a little wrong, in rooms that have somebody in them. */
  scheduleProblems() {
    const s = this.s, rng = s.rng;
    const kinds = rng.shuffle(['towels', 'tv', 'batteries', 'toilet', 'bulb', 'toiletries', 'blanket', 'pillow']);
    const n = 4 + rng.int(2);
    const times = [];
    for (let i = 0; i < n; i++) times.push(this.rnd([at(20, 20), at(23, 40)]));
    times.sort((a, b) => a - b);
    times.forEach((t, i) => this.at(t, () => this.roomProblem(kinds[i % kinds.length]), `problem ${kinds[i % kinds.length]}`));
    // the drink machine keeps somebody's money; the ice machine jams
    this.at(this.rnd([at(21, 40), at(22, 50)]), () => this.errand('vend'), 'vend');
    this.at(this.rnd([at(22, 30), at(23, 50)]), () => { s.property.jamIce(); this.errand('ice'); }, 'ice jam');
    this.at(this.rnd([at(20, 50), at(21, 40)]), () => this.errand('ice'), 'ice');
    // one noise complaint, if there is anybody to make noise and anybody to hear it
    this.at(this.rnd([at(21, 35), at(22, 30)]), () => this.noise(), 'noise');
  }

  /** Whoever is awake in a room calls down about something. */
  roomProblem(kind, who = null) {
    const s = this.s;
    const awake = who ? [who] : s.npcs.list.filter((p) => p.inRoom && !p.asleep && p.room && !p.followsLeader && p.kind !== 'resident' && p.stay);
    if (!awake.length) return;
    let p = awake[Math.floor(s.rng() * awake.length)];
    let k = kind;
    if (kind === 'tv') { const in112 = awake.find((x) => x.room === '112'); if (in112) p = in112; }
    if (kind === 'towels') { const fam = awake.find((x) => x.rosterId === 'PRUITT'); if (fam) p = fam; }
    const r = s.rooms.def(p.room);
    if (r.traits.includes('noisyAC') && !p.flags.acCalled) { k = 'ac'; p.flags.acCalled = true; }
    if (r.traits.includes('drip') && !p.flags.dripCalled && s.rng() < 0.6) { k = 'drip'; p.flags.dripCalled = true; }
    if (k === 'tv' && p.room === '201') return;
    if (k === 'tv') s.rooms.get(p.room).issues.add('tv');
    if (k === 'toilet') s.rooms.get(p.room).issues.add('toilet');
    if (k === 'bulb') s.rooms.get(p.room).issues.add('lamp');
    s.incoming(roomCall(s, p, k));
  }

  /** Somebody walks to the ice machine or the drink machine. */
  errand(kind) {
    const s = this.s;
    const awake = s.npcs.list.filter((p) => p.inRoom && !p.asleep && p.room && p.stay && !p.followsLeader && p.act && p.act.kind === 'inRoom' && p.bedAt);
    if (!awake.length) return;
    const p = awake[Math.floor(s.rng() * awake.length)];
    s.npcs.interrupt(p, exitRoom());
    // after: back in the room, and the rest of the evening where it was
    p.queue.splice(1, 0, kind === 'vend' ? vendRun() : iceRun(), enterRoom(), inRoom(p.bedAt));
    if (kind === 'vend') s.property.soda.eats = true;
  }

  noise() {
    const s = this.s;
    const loud = s.npcs.list.find((p) => p.rosterId === 'PRUITT' && p.inRoom && !p.asleep)
      || s.npcs.list.find((p) => (p.kind === 'crew' || p.rosterId === 'KYLE') && p.inRoom && !p.asleep);
    if (!loud) return;
    const r = s.rooms.def(loud.room);
    // a neighbor: same wing, next door or directly above or below
    const n = Number(loud.room);
    const near = [n - 1, n + 1, n + 100, n - 100].map(String);
    const hearer = s.npcs.list.find((p) => p.inRoom && p.room && near.includes(p.room) && p !== loud && p.stay && !p.followsLeader);
    if (!hearer) return;
    loud.noisy = true;
    const st = s.rooms.get(loud.room); st.tvOn = true;
    const text = loud.rosterId === 'PRUITT' ? `Hi. I'm sorry to call. The room next to me -- ${r.lv ? 'next door' : 'the one by me'} -- it sounds like somebody's jumping off the furniture. Repeatedly. Onto other furniture.`
      : 'Hi, sorry -- the room next door has the TV up so loud I can tell you what they\'re watching. It\'s wrestling. It\'s very close wrestling.';
    s.incoming({
      from: 'room', room: hearer.room, who: { name: `ROOM ${hearer.room}`, app: hearer.app }, person: hearer, kind: 'noise',
      onMissed: () => { hearer.mood -= 10; },
      script: (sh, call) => say(call.who, text, [
        reply('I\'m sorry -- I\'ll go ask them to keep it down.', () => {
          s.tasks.add({ kind: 'noise', room: loud.room, who: loud.id, text: `Ask ${loud.room} to keep it down (${hearer.room} complained)`, due: s.clock.min + 20 });
          return say(call.who, 'Thank you. I\'m not trying to be -- I just have to drive at six.', [reply('(Hang up.)', () => null)]);
        }),
        reply('I\'ll give it a few minutes -- it usually settles down.', () => {
          hearer.mood -= 6;
          this.after(25, () => { loud.noisy = false; }, 'settle');
          return say(call.who, 'Okay. Okay.', [reply('(Hang up.)', () => null)]);
        }),
      ]),
    });
  }

  scheduleVisits() {
    const s = this.s, rng = s.rng;
    this.at(this.rnd(PERSON.TAMMY.schedule.visit), () => this.visitor('TAMMY'), 'tammy');
    if (rng.chance(0.7)) this.at(this.rnd(PERSON.DEPUTY.schedule.visit), () => this.visitor('DEPUTY'), 'deputy');
  }

  /** Somebody walks over from across the road. */
  visitor(id, o = {}) {
    const s = this.s;
    const p = id === 'GORDY' ? this.gordy() : this.person(id);
    p.x = o.from ? o.from.x : 5.2; p.z = o.from ? o.from.z : -16.4; p.lv = 0; p.hidden = false;
    p.visitId = id;
    s.npcs.push(p, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0));
    s.npcs.push(p, toDesk('visit'));
    if (id === 'DEPUTY') { s.npcs.push(p, walkTo(SPOTS.lobbyChairs[0].x, SPOTS.lobbyChairs[0].z, 0)); s.npcs.push(p, idle(40, { face: -Math.PI / 2, sit: true })); }
    s.npcs.push(p, walkOff(5.2, -16.4));
    return p;
  }
  addVisit(id, delayMin) { this.after(delayMin, () => this.visitor(id), `visit ${id}`); }
  gordy() {
    return this.person({
      id: 'GORDY', name: 'Gordy Nusbaum', tag: 'is here to collect his order', kind: 'cameo',
      app: (() => { const a = appFor('OTIS'); return a; })(),
    }, { app: gordyApp() });
  }

  /** Somebody who called about the rate shows up. */
  addWalkIn(delayMin, why) {
    const s = this.s;
    this.after(delayMin, () => {
      const arch = pickArchetype(s.rng, ['hiding']);
      const t = rollTraveler(s.rng, arch);
      if (why === 'dog') { t.dog = true; t.tag = 'and a very small dog'; }
      this.arrive(t);
    }, 'walk-in');
  }

  /** The sister found out. The woman in the room comes down. */
  upsetNoDisclose(target) {
    const s = this.s;
    this.after(12, () => {
      if (!target || target.gone) return;
      target.complaint = { kind: 'question', i: 0 };
      s.npcs.interrupt(target, exitRoom());
      s.npcs.push(target, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0), true);
      target.queue.splice(1, 0, toDesk('upset'), enterRoom(), inRoom());
      s.log(`${target.name} came down to the desk: her sister called her room.`, 'bad');
    }, 'upset');
  }

  /* ============================================================
     THE MORNING
     ============================================================ */
  scheduleMorning() {
    const s = this.s, rng = s.rng;
    // the papers
    const paperAt = this.paperLate ? this.rnd([at(5, 12), at(5, 22)]) : this.rnd([at(4, 50), at(5, 8)]);
    this.at(paperAt, () => {
      s.property.newsDelivered(24);
      s.g.sound.carPass(0.2, 0.6, 2.5);
      const { gain, pan } = s.g.sound.at(NEWS_DROP.x, NEWS_DROP.z, 30, s.indoor ? 0.5 : 1);
      s.g.sound.thump(pan, Math.max(0.15, gain));
      s.log('The Ledger came.', 'plain');
    }, 'papers');
    // the storm chaser's front
    this.at(at(5, 5), () => { s.flags.front = true; }, 'front');
    // staff
    this.at(this.rnd([at(6, 33), at(6, 42)]), () => this.staffArrives('LUZ'), 'luz');
    this.at(this.rnd([at(6, 48), at(6, 54)]), () => this.staffArrives('TRAVIS'), 'travis');
    // Hollis comes out for his coffee and sits on the walk
  }

  staffArrives(id) {
    const s = this.s;
    const p = this.person(id);
    p.kind = 'staff';
    p.x = 9.5; p.z = -16.2; p.lv = 0; p.hidden = false;
    if (id === 'TRAVIS') {
      s.npcs.push(p, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0));
      s.npcs.push(p, walkTo(SPOTS.handoff.x + 1.2, SPOTS.handoff.z + 0.4, 0, { face: Math.PI }));
      s.npcs.push(p, until(() => s.shiftOver, { face: Math.PI }));
    } else {
      s.npcs.push(p, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0));
      s.npcs.push(p, walkTo(SPOTS.handoff.x - 1.3, SPOTS.handoff.z + 0.2, 0, { face: Math.PI }));
      s.npcs.push(p, until(() => p.flags.briefed || s.clock.past(7, 5), { face: Math.PI }));
      s.npcs.push(p, walkTo(SPOTS.housekeepIn.x, SPOTS.housekeepIn.z, 0));
      s.npcs.push(p, walkTo(3.5, 5.5, 0));
      s.npcs.push(p, until(() => false));
    }
    return p;
  }

  /* ============================================================
     PER FRAME
     ============================================================ */
  update() {
    const s = this.s;
    const now = s.clock.min;
    for (const e of this.events) {
      if (e.done || now < e.min) continue;
      e.done = true;
      try { e.fn(); } catch (err) { console.error('event', e.label, err); }
    }
    if (this.events.length > 200) this.events = this.events.filter((e) => !e.done);
  }
}

/* Gordy is Final Rental's Gordy: same cap, same letterman jacket. */
let _gordy = null;
function gordyApp() {
  if (_gordy) return _gordy;
  const a = appFor('OTIS');
  _gordy = JSON.parse(JSON.stringify(a));
  _gordy.jacket = { id: 'letter', color: { id: 'letter', name: 'maroon', hex: '#4a1a1e' }, kind: 'letterman jacket', label: 'Maroon letterman jacket', bulletin: 'a maroon letterman jacket' };
  _gordy.pants = { id: 'denim', color: { id: 'denim', name: 'denim blue', hex: '#33507a' }, label: 'Denim pants', bulletin: 'denim pants' };
  _gordy.hat = { ...a.hat, id: 'cap' };
  _gordy.glasses = { ...a.glasses, id: 'none' };
  _gordy.skin = '#c08e63';
  return _gordy;
}

export { STALLS, DRIVE, makeRng, locatorCall, pillowCall };
