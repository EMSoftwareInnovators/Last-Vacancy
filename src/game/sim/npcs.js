/* ============================================================
   npcs.js -- people, and what they are doing right now.

   The movement is Final Rental's customer.js: follow a route, close
   the last bit by hand, slide off what is in the way, turn toward
   where you are going, footsteps, and hand the walk cycle to the
   shared animation driver. What is different is what people DO.
   A video store customer browses, queues and leaves. A motel guest
   arrives, registers, goes to the room, comes out for ice, sits on
   the walk and smokes, turns the lights out, gets up, eats a
   muffin, and checks out -- over twelve hours, on a schedule.

   A person carries a queue of activities. Each one knows how to
   start, what to do each frame, and when it is finished. The shift
   director pushes activities onto people when the clock says so.
   ============================================================ */
import { angleTowards } from '../../engine/mathx.js';
import { makeAnim, updateAnim } from '../actor.js';
import { paintSkin } from '../appearance.js';
import { navPath } from '../world/nav.js';
import { collide, settleLevel } from '../world/collision.js';
import { ROOM_BY_NO, SPOTS, zoneAt, toWorld, STATION_BY_ID } from '../world/layout.js';

let seq = 1;

export function createPerson(o) {
  const app = o.app;
  return {
    id: o.id || 'G' + (seq++), rosterId: o.rosterId || null, def: o.def || null,
    name: o.name, app, skin: paintSkin(app), tagLine: o.tagLine || '',
    x: o.x || 0, z: o.z || 0, y: 0, lv: o.lv || 0, yaw: o.yaw || 0, r: 0.28,
    anim: makeAnim(), moveSpeed: 0, moving: false,
    speed: 1.25 * (app.gait.speed || 1) * (o.speedK || 1),
    hidden: o.hidden !== undefined ? o.hidden : true,
    queue: [], act: null,
    room: o.room || null, stay: o.stay ? { ...o.stay } : null, party: o.party || [], leader: o.leader || null,
    car: null, keyFor: null, keys: 0,
    known: {}, mood: 70, patience: o.patience || 120, waitT: 0,
    flags: {}, lines: o.lines || null, kind: o.kind || 'traveler',
    inRoom: false, asleep: false, sit: false, eating: false, talking: false,
    path: null, pathI: 0, stuckT: 0, lastD: 0,
  };
}

export class NPCs {
  constructor(shift) {
    this.s = shift;
    this.list = [];
  }
  add(p) { this.list.push(p); return p; }
  find(id) { return this.list.find((p) => p.id === id || p.rosterId === id) || null; }
  visible() { return this.list.filter((p) => !p.hidden); }

  /* ---------------- activities ---------------- */
  /** Queue an activity; `now` puts it first, interrupting nothing already running. */
  push(p, act, now = false) {
    if (now) p.queue.unshift(act); else p.queue.push(act);
  }
  /** Drop what they are doing and do this instead. */
  interrupt(p, act) {
    if (p.act && p.act.stop) p.act.stop(p, this.s);
    p.act = null; p.path = null;
    p.queue.unshift(act);
  }
  clear(p) { if (p.act && p.act.stop) p.act.stop(p, this.s); p.act = null; p.queue.length = 0; p.path = null; }
  busy(p) { return !!p.act || p.queue.length > 0; }

  update(dt) {
    const s = this.s;
    for (const p of this.list) {
      p.moveSpeed = 0; p.moving = false;
      if (!p.act && p.queue.length) {
        p.act = p.queue.shift();
        p.act.t = 0;
        if (p.act.start) p.act.start(p, s, this);
      }
      if (p.act) {
        p.act.t += dt;
        const done = p.act.update ? p.act.update(p, dt, s, this) : true;
        if (done) { if (p.act && p.act.end) p.act.end(p, s); p.act = null; }
      }
      if (!p.hidden) {
        const talking = s.speaking === p;
        updateAnim(p.anim, dt, p.moveSpeed, p.app, {
          talking, sit: p.sit, eating: p.eating && !talking,
          headYaw: p.lookYaw || 0, reach: !!p.reach,
        });
      }
    }
    this.list = this.list.filter((p) => !p.gone);
  }

  /* ---------------- movement (Final Rental's step) ---------------- */
  route(p, x, z, lv) {
    p.path = navPath(this.s.g.nav, p.x, p.z, p.lv, x, z, lv, p.r + 0.04);
    p.pathI = 0; p.stuckT = 0;
  }
  step(p, dt) {
    if (!p.path || p.pathI >= p.path.length) return true;
    const wp = p.path[p.pathI];
    const dx = wp.x - p.x, dz = wp.z - p.z;
    const d = Math.hypot(dx, dz);
    const last = p.pathI === p.path.length - 1;
    if (d < (last ? 0.14 : 0.32)) {
      p.pathI++;
      if (p.pathI >= p.path.length) { p.path = null; return true; }
      return false;
    }
    this.opensDoors(p);
    const sp = p.speed * (p.rushing ? 1.5 : 1);
    const nx = p.x + (dx / d) * sp * dt, nz = p.z + (dz / d) * sp * dt;
    const [cx, cz] = collide(nx, nz, p.r, p.lv, this.s.g.solids, this.s.dynSolids, p);
    const moved = Math.hypot(cx - p.x, cz - p.z);
    p.x = cx; p.z = cz;
    settleLevel(p);
    p.moveSpeed = moved / Math.max(dt, 0.0001);
    p.moving = true;
    if (d > 0.05) p.yaw = angleTowards(p.yaw, Math.atan2(dx, dz), dt * 7.5);
    // stuck on something: after a moment, slip through it rather than stand there all night
    if (moved < sp * dt * 0.2) {
      p.stuckT += dt;
      if (p.stuckT > 1.6) p.ghost = true;
      // still stuck on something the map did not know about: give up on this
      // waypoint, and if that does not help, squeeze past it
      if (p.stuckT > 3.2 && !last) { p.pathI++; p.stuckT = 1.7; }
      else if (p.stuckT > 5.5) { p.x = wp.x; p.z = wp.z; p.lv = wp.lv; settleLevel(p); p.stuckT = 0; }
    } else { p.stuckT = Math.max(0, p.stuckT - dt); if (p.stuckT < 0.2) p.ghost = false; }
    p._stepT = (p._stepT || 0) - dt * Math.max(0.2, p.moveSpeed);
    if (p._stepT <= 0) { p._stepT = 0.62; this.s.footstep(p); }
    return false;
  }
  /** Walk straight at a point, for the last half meter. */
  approach(p, x, z, dt, faceYaw) {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.03) { if (faceYaw !== undefined) p.yaw = angleTowards(p.yaw, faceYaw, dt * 6); return true; }
    const sp = p.speed * 0.8;
    const st = Math.min(d, sp * dt);
    p.x += (dx / d) * st; p.z += (dz / d) * st;
    settleLevel(p);
    p.moveSpeed = st / Math.max(dt, 0.0001); p.moving = true;
    p.yaw = angleTowards(p.yaw, Math.atan2(dx, dz), dt * 6);
    return false;
  }
  /** Doors swing for people with somewhere to be: their own room, and anything staff-only if they are staff. */
  opensDoors(p) {
    const doors = this.s.g.doors;
    for (const d of doors.list) {
      if (d.auto || d.lv !== p.lv) continue;
      const cx = d.hx + Math.cos(d.a) * d.w / 2, cz = d.hz - Math.sin(d.a) * d.w / 2;
      if (Math.hypot(p.x - cx, p.z - cz) > 1.2) continue;
      const mine = (d.room && (d.room === p.room || d.room === p.keyFor)) || (d.staff && p.kind === 'staff');
      if (mine) doors.open(d, 1.6);
    }
  }
}

/* ============================================================
   ACTIVITIES
   Each returns an object with start / update / end. `update`
   returns true when the activity is finished.
   ============================================================ */

/** Walk somewhere. */
export const walkTo = (x, z, lv = 0, o = {}) => ({
  kind: 'walk', x, z, lv, face: o.face,
  start(p, s, n) { n.route(p, x, z, lv); p.rushing = !!o.rush; },
  update(p, dt, s, n) {
    if (p.path) { n.step(p, dt); return false; }
    return n.approach(p, x, z, dt, o.face);
  },
  end(p) { p.rushing = false; p.ghost = false; },
});

/** Stand (or sit) somewhere for a while. */
export const idle = (secs, o = {}) => ({
  kind: 'idle', secs,
  start(p) { p.sit = !!o.sit; if (o.face !== undefined) p.yaw = o.face; },
  update(p, dt) { if (o.face !== undefined) p.yaw = angleTowards(p.yaw, o.face, dt * 4); return this.t >= secs; },
  end(p) { if (!o.keepSit) p.sit = false; },
});

/** Do something instantly. */
export const run = (fn) => ({ kind: 'run', start(p, s) { fn(p, s); }, update() { return true; } });

/** Wait until something is true. */
export const until = (pred, o = {}) => ({
  kind: 'until',
  start(p) { if (o.sit) p.sit = true; },
  update(p, dt, s) { if (o.face !== undefined) p.yaw = angleTowards(p.yaw, o.face, dt * 4); return pred(p, s); },
  end(p) { if (o.sit) p.sit = false; },
});

/** Get into a car and disappear into it. */
export const getInCar = () => ({
  kind: 'carIn',
  start(p, s) { const d = s.cars.doorOf(p.car); s.npcs.route(p, d.x, d.z, 0); },
  update(p, dt, s, n) {
    if (p.path) { n.step(p, dt); return false; }
    const d = s.cars.doorOf(p.car);
    if (!n.approach(p, d.x, d.z, dt)) return false;
    s.carDoor(p.car);
    p.hidden = true;
    for (const id of p.party) { const c = n.find(id); if (c) c.hidden = true; }
    return true;
  },
});
/** Step out of a parked car. */
export const getOutOfCar = () => ({
  kind: 'carOut',
  start(p, s, n) {
    const d = s.cars.doorOf(p.car);
    p.x = d.x; p.z = d.z; p.lv = 0; settleLevel(p);
    p.yaw = p.car.yaw + Math.PI / 2;
    p.hidden = false;
    s.carDoor(p.car);
    for (const id of p.party) {
      const c = n.find(id);
      if (!c || !c.followsLeader) continue;
      c.x = d.x + (Math.random() - 0.5) * 1.2; c.z = d.z + (Math.random() - 0.5) * 1.2; c.lv = 0; settleLevel(c);
      c.hidden = false;
    }
  },
  update() { return this.t > 0.6; },
});
/** Drive: car goes somewhere with the person inside it. */
export const drive = (fn) => ({
  kind: 'drive', parked: false,
  start(p, s) { fn(p.car, () => { this.parked = true; }); s.engineStart(p.car); },
  update() { return this.parked; },
});

/** Go into your room and be in it. */
export const enterRoom = () => ({
  kind: 'enterRoom',
  start(p, s, n) { const r = ROOM_BY_NO[p.room]; n.route(p, r.outside.x, r.outside.z, r.lv); },
  update(p, dt, s, n) {
    const r = ROOM_BY_NO[p.room];
    if (p.path) { n.step(p, dt); return false; }
    if (!this.atDoor) {
      if (!n.approach(p, r.outside.x, r.outside.z, dt)) return false;
      this.atDoor = true;
      // the right key or not: they find out here, not at the desk
      if (p.keyFor !== p.room) { s.wrongKey(p); return true; }
      s.g.doors.open(s.g.doors.room(p.room), 2.2);
      s.g.sound.keys(s.panOf(p.x, p.z));
      this.wait = 0.5;
      return false;
    }
    if (this.wait > 0) { this.wait -= dt; return false; }
    if (!this.inside) {
      if (!n.approach(p, r.inside.x, r.inside.z, dt)) return false;
      this.inside = true;
      s.enteredRoom(p);
      return false;
    }
    return n.approach(p, r.center.x, r.center.z, dt);
  },
});
/** In the room: somewhere to sit, lights and television as the evening goes. */
export const inRoom = (untilMin, o = {}) => ({
  kind: 'inRoom',
  start(p, s) {
    const r = ROOM_BY_NO[p.room];
    const [x, z] = toWorld(r, r.doorHi ? 3.6 - 1.25 : 1.25, 3.0);
    p.x = x; p.z = z; p.lv = r.lv; settleLevel(p);
    p.yaw = r.yaw - (r.doorHi ? -Math.PI / 2 : Math.PI / 2);
    p.sit = true; p.inRoom = true; p.hidden = false;
    const st = s.rooms.get(p.room);
    st.occupied = true; st.awake = !o.asleep; st.lightsOn = !o.asleep; st.tvOn = !o.asleep && Math.random() < 0.7;
    p.asleep = !!o.asleep;
  },
  update(p, dt, s) { return untilMin !== undefined && s.clock.min >= untilMin && !s.withGuest(p); },
  end(p) { p.sit = false; },
});
/** Leave the room: up, out of the door, onto the walk. */
export const exitRoom = () => ({
  kind: 'exitRoom',
  start(p, s) {
    const r = ROOM_BY_NO[p.room];
    p.inRoom = false; p.asleep = false; p.sit = false; p.hidden = false;
    const st = s.rooms.get(p.room);
    st.awake = true; st.lightsOn = !st.powerOut;
    p.x = r.inside.x; p.z = r.inside.z; p.lv = r.lv; settleLevel(p);
    s.g.doors.open(s.g.doors.room(p.room), 2.2);
  },
  update(p, dt, s, n) {
    const r = ROOM_BY_NO[p.room];
    if (!n.approach(p, r.outside.x, r.outside.z, dt)) return false;
    const st = s.rooms.get(p.room);
    if (!p.party.some((id) => { const c = n.find(id); return c && c.inRoom; })) { st.occupied = !!p.leaveSomeone; st.tvOn = false; st.lightsOn = !!p.leaveSomeone; }
    return true;
  },
});

/** Go to sleep: lights out. */
export const sleep = (untilMin) => ({
  kind: 'sleep',
  start(p, s) {
    const st = s.rooms.get(p.room);
    if (st) { st.awake = false; st.lightsOn = false; st.tvOn = false; }
    p.asleep = true;
  },
  update(p, dt, s) { return s.clock.min >= untilMin; },
  end(p, s) {
    const st = s.rooms.get(p.room);
    if (st) { st.awake = true; st.lightsOn = true; }
    p.asleep = false;
  },
});

/** Walk up to the desk and wait there until the clerk deals with you. */
export const toDesk = (reason, o = {}) => ({
  kind: 'desk', reason,
  start(p, s) { s.desk.join(p, reason, o); },
  update(p, dt, s, n) {
    const spot = s.desk.spotFor(p);
    if (!spot) return true;
    if (!this.routedTo || Math.hypot(this.routedTo.x - spot.x, this.routedTo.z - spot.z) > 0.2) {
      n.route(p, spot.x, spot.z, 0); this.routedTo = spot;
    }
    if (p.path) { n.step(p, dt); return false; }
    n.approach(p, spot.x, spot.z, dt, spot.yaw);
    if (s.desk.isFront(p) && !this.rang && Math.hypot(p.x - spot.x, p.z - spot.z) < 0.2) {
      this.rang = true;
      s.desk.arrived(p);
    }
    return s.desk.done(p);
  },
  stop(p, s) { s.desk.leave(p); },
  end(p, s) { s.desk.leave(p); },
});

/** Follow someone around (a spouse, the kids). */
export const follow = (leaderId, o = {}) => ({
  kind: 'follow',
  update(p, dt, s, n) {
    const L = n.find(leaderId);
    if (!L || L.gone) return true;
    p.hidden = L.hidden;
    if (L.hidden) { p.x = L.x; p.z = L.z; p.lv = L.lv; return false; }
    const off = o.offset || 0.9;
    const tx = L.x - Math.sin(L.yaw) * off + Math.cos(L.yaw) * (o.side || 0.5);
    const tz = L.z - Math.cos(L.yaw) * off - Math.sin(L.yaw) * (o.side || 0.5);
    const d = Math.hypot(tx - p.x, tz - p.z);
    if (d > 6 || L.lv !== p.lv) { p.x = tx; p.z = tz; p.lv = L.lv; settleLevel(p); return false; }
    if (d > 0.35) {
      const sp = Math.min(p.speed * 1.3, d * 2.2);
      p.x += ((tx - p.x) / d) * sp * dt; p.z += ((tz - p.z) / d) * sp * dt; settleLevel(p);
      p.moveSpeed = sp; p.moving = true;
      p.yaw = angleTowards(p.yaw, Math.atan2(tx - p.x, tz - p.z), dt * 6);
    } else p.yaw = angleTowards(p.yaw, L.talkYaw !== undefined ? L.talkYaw : L.yaw, dt * 4);
    p.sit = L.sit;
    return false;
  },
});

/** Out to the ice machine and back with a bucket. */
export const iceRun = () => ({
  kind: 'ice', phase: 0,
  start(p, s, n) { n.route(p, SPOTS.iceStand.x, SPOTS.iceStand.z, 0); },
  update(p, dt, s, n) {
    if (this.phase === 0) {
      if (p.path) { n.step(p, dt); return false; }
      if (!n.approach(p, SPOTS.iceStand.x, SPOTS.iceStand.z, dt, 0)) return false;
      this.phase = 1; this.w = 3;
      p.reach = true;
      if (s.property.iceWorking()) { s.property.iceTaken(); s.g.sound.iceDrop(s.panOf(p.x, p.z), s.near(p.x, p.z, 14)); }
      else { this.broken = true; }
      return false;
    }
    if (this.phase === 1) {
      this.w -= dt;
      if (this.w > 0) return false;
      p.reach = false;
      if (this.broken) s.iceBroken(p);
      return true;
    }
    return true;
  },
});

/** Something from a machine: a soda, a honey bun, a box of Tide. It may be out, full, or keep the money. */
const STAND = { soda: SPOTS.vendStand, snack: SPOTS.snackStand, soap: SPOTS.soapStand };
export const vendRun = (id = 'soda') => ({
  kind: 'vend', phase: 0, machine: id,
  start(p, s, n) { const sp = STAND[id]; n.route(p, sp.x, sp.z, 0); },
  update(p, dt, s, n) {
    const sp = STAND[id];
    if (this.phase === 0) {
      if (p.path) { n.step(p, dt); return false; }
      if (!n.approach(p, sp.x, sp.z, dt, sp.yaw)) return false;
      this.phase = 1; this.w = 3.2; p.reach = true;
      this.res = s.vending.sale(id, p);
      s.g.sound.coins(s.panOf(p.x, p.z), s.near(p.x, p.z, 12));
      return false;
    }
    this.w -= dt;
    if (this.w > 0) return false;
    p.reach = false;
    if (this.res.ok) s.g.sound.vendDrop(s.panOf(p.x, p.z), s.near(p.x, p.z, 12));
    else s.vendFailed(p, id, this.res);
    return true;
  },
});

/** Sit on the walk outside the door in a lawn chair, and smoke, and watch the lot. */
export const porch = (untilMin) => ({
  kind: 'porch',
  start(p, s) {
    const r = ROOM_BY_NO[p.room];
    const [x, z] = toWorld(r, r.doorHi ? 1.7 : 1.9, -1.2);
    p.x = x; p.z = z; p.lv = r.lv; settleLevel(p);
    p.yaw = r.faceOut; p.sit = true; p.hidden = false; p.porch = true;
    s.porchChair(p, true);
  },
  update(p, dt, s) {
    this.smokeT = (this.smokeT || 3) - dt;
    if (this.smokeT <= 0) { this.smokeT = 8 + Math.random() * 10; p.reach = !p.reach; }
    return s.clock.min >= untilMin && !s.withGuest(p);
  },
  end(p, s) { p.sit = false; p.porch = false; p.reach = false; s.porchChair(p, false); },
});

/** Breakfast: in, to the counter, something to eat, a seat, eat, out. */
export const breakfastVisit = (o = {}) => ({
  kind: 'breakfast', phase: 0,
  start(p, s, n) { n.route(p, SPOTS.bfastLine.x + (Math.random() - 0.5) * 0.4, SPOTS.bfastLine.z + (Math.random() - 0.5), 0); },
  update(p, dt, s, n) {
    const B = s.breakfast;
    switch (this.phase) {
      case 0: // to the counter
        if (p.path) { n.step(p, dt); return false; }
        this.phase = 1; this.picks = B.menuFor(p); this.pi = 0;
        return false;
      case 1: { // along the counter, station by station
        const pk = this.picks[this.pi];
        if (!pk) { this.phase = 2; return false; }
        const st = STATION_BY_ID[pk];
        if (!n.approach(p, -6.75, st.z, dt, -Math.PI / 2)) return false;
        if (!this.w) { this.w = 1.4 + Math.random(); p.reach = true; }
        this.w -= dt;
        if (this.w > 0) return false;
        this.w = 0; p.reach = false;
        B.take(p, pk);
        this.pi++;
        return false;
      }
      case 2: { // a seat
        const seat = B.claimSeat(p);
        if (!seat) { this.phase = 5; this.stand = 20; n.route(p, -3.0 + Math.random(), -1.4, 0); return false; }
        this.seat = seat;
        n.route(p, seat.x + Math.sin(seat.yaw) * -0.35, seat.z + Math.cos(seat.yaw) * -0.35, 0);
        this.phase = 3;
        return false;
      }
      case 3:
        if (p.path) { n.step(p, dt); return false; }
        if (!n.approach(p, this.seat.x, this.seat.z, dt, this.seat.yaw)) return false;
        p.sit = true; p.eating = true; this.phase = 4;
        this.eat = (o.lingers || 12) * 60 / 60 * (0.8 + Math.random() * 0.4);
        B.sat(p, this.seat);
        return false;
      case 4: // eating, reading, talking, spilling
        this.eat -= s.clock.minDelta;
        B.eating(p, dt);
        if (this.eat > 0 || s.withGuest(p)) return false;
        p.sit = false; p.eating = false;
        B.leaveSeat(p, this.seat);
        return true;
      case 5: // no seat: stand by the window and eat
        if (p.path) { n.step(p, dt); return false; }
        p.eating = true;
        this.stand -= s.clock.minDelta;
        return this.stand <= 0 && !s.withGuest(p);
      default: return true;
    }
  },
  end(p) { p.eating = false; p.sit = false; p.reach = false; },
});

/** Walk off the property on foot (Tammy back to the diner, the deputy to his car). */
export const walkOff = (x = 6, z = -17.3) => ({
  kind: 'walkOff',
  start(p, s, n) { n.route(p, x, z, 0); },
  update(p, dt, s, n) {
    if (p.path) { n.step(p, dt); return false; }
    p.hidden = true; p.gone = true;
    return true;
  },
});

export { zoneAt };
