/* ============================================================
   cars.js -- what is parked in the lot, and what goes by.

   Part of learning a motel is learning its lot: the maroon Buick
   is Earl, the pickup with drywall in the bed is the Mercers, the
   van with DELMAR on the side is exactly what it looks like. Cars
   come off the highway, pull under the canopy while somebody goes
   in to register, move to the stall in front of their room, and
   back out in the morning. They do not run anybody over: a car
   with a person in front of it waits.

   And the interstate goes by all night, both ways.
   ============================================================ */
import { angleTowards } from '../../engine/mathx.js';
import { DRIVE, STALLS, OFFICE_STALLS, OVERFLOW, ROOM_BY_NO } from '../world/layout.js';
import { buildCarMesh } from '../world/props.js';

let seq = 1;

export class Cars {
  constructor(shift) {
    this.s = shift;
    this.list = [];
    this.traffic = [];
    this.meshes = {};
    this.trafficT = 2;
    this.solids = [];
    // the stalls are shared layout data; tonight they start empty
    for (const st of [...STALLS, ...OFFICE_STALLS, ...OVERFLOW]) st.taken = null;
  }

  mesh(color, kind, side) {
    const key = `${color}:${kind}:${side || ''}`;
    if (!this.meshes[key]) {
      const T = this.s.g.T;
      this.meshes[key] = buildCarMesh(T, color, kind, side ? T.vanSide[side] : null);
    }
    return this.meshes[key];
  }

  /** A car that belongs to somebody. */
  add(v, owner) {
    const c = {
      id: seq++, color: v.color || 'gray', kind: v.kind || 'sedan', side: v.side || null,
      desc: v.desc || 'a car', plate: v.plate || '', owner,
      x: DRIVE.enterFrom.x, z: DRIVE.enterFrom.z, yaw: -Math.PI / 2, speed: 0,
      state: 'gone', route: null, ri: 0, stall: null, lights: false, waitT: 0,
    };
    c.mesh = this.mesh(c.color, c.kind, c.side);
    c.solid = { x0: 0, x1: 0, z0: 0, z1: 0, lv: 0, on: false, skip: (who) => !!(who && who.ghost) };
    this.solids.push(c.solid);
    this.list.push(c);
    return c;
  }

  /** Park it somewhere without driving it there (in-house guests at 7 PM). */
  placeAt(c, stall) {
    c.x = stall.x; c.z = stall.z; c.yaw = stall.yaw;
    c.state = 'parked'; c.stall = stall; stall.taken = c.id;
    this.solidFor(c);
  }

  /* ---------------- routes ---------------- */
  freeStall(list) { return list.find((s) => !s.taken) || null; }
  stallForRoom(no) {
    const r = ROOM_BY_NO[no];
    if (!r) return this.freeStall(STALLS);
    // the stall in front of this room's column
    let best = null, bd = 1e9;
    for (const s of STALLS) {
      if (s.taken) continue;
      const d = Math.hypot(s.x - r.stall.x, s.z - r.stall.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** Off the highway and under the office canopy. */
  arrive(c, onPark) {
    const st = this.freeStall(OFFICE_STALLS) || this.stallNearOffice();
    const route = [
      { x: DRIVE.enterFrom.x, z: DRIVE.laneWB }, { x: 18, z: DRIVE.laneWB }, { x: 12.5, z: -18.6 }, DRIVE.gate,
      { x: 10.3, z: 7.6 }, { x: st.x + (st.office ? 0 : 0), z: 7.4 }, { x: st.x, z: st.z },
    ];
    this.go(c, route, st, onPark);
    c.x = DRIVE.enterFrom.x; c.z = DRIVE.laneWB; c.yaw = -Math.PI / 2;
  }
  stallNearOffice() {
    return this.freeStall(STALLS.slice().sort((a, b) => Math.hypot(a.x - 4, a.z) - Math.hypot(b.x - 4, b.z))) || this.freeStall(OVERFLOW) || OVERFLOW[0];
  }

  /** The motorcoach: through the gate and down the middle of the lot, where it fits. */
  arriveBus(c, onPark) {
    const st = { x: DRIVE.bus.x, z: DRIVE.bus.z, yaw: DRIVE.bus.yaw, lane: -3.4, bus: true };
    const route = [
      { x: DRIVE.enterFrom.x, z: DRIVE.laneWB }, { x: 18, z: DRIVE.laneWB }, { x: 12.5, z: -18.6 }, DRIVE.gate,
      { x: 10.3, z: 3.0 }, { x: 3.4, z: 5.0 }, { x: DRIVE.bus.x, z: 8.0 }, { x: DRIVE.bus.x, z: DRIVE.bus.z },
    ];
    for (const o of OVERFLOW) if (o.x < 0 && o.z > 9) o.taken = o.taken || 'bus';
    this.go(c, route, st, onPark);
    c.x = DRIVE.enterFrom.x; c.z = DRIVE.laneWB; c.yaw = -Math.PI / 2;
  }

  /** Straight in off the highway to the stall in front of a room (a guest back from supper). */
  arriveTo(c, no, onPark) {
    const st = this.stallForRoom(no) || this.freeStall(STALLS) || this.freeStall(OVERFLOW) || OVERFLOW[0];
    const route = [
      { x: DRIVE.enterFrom.x, z: DRIVE.laneWB }, { x: 18, z: DRIVE.laneWB }, { x: 12.5, z: -18.6 }, DRIVE.gate,
      { x: 10.3, z: 7.6 }, { x: st.lane > 0 ? 3.4 : -3.4, z: 7.0 }, { x: st.lane, z: st.z }, { x: st.x, z: st.z },
    ];
    this.go(c, route, st, onPark);
    c.x = DRIVE.enterFrom.x; c.z = DRIVE.laneWB; c.yaw = -Math.PI / 2;
  }

  /** From wherever it is to the stall in front of a room. */
  toRoom(c, no, onPark) {
    const st = this.stallForRoom(no) || this.freeStall(STALLS) || this.freeStall(OVERFLOW);
    if (!st) { if (onPark) onPark(); return; }      // nowhere left: it stays under the canopy
    const route = this.backOut(c);
    const laneX = st.lane;
    route.push({ x: laneX > 0 ? 3.4 : -3.4, z: 7.0 }, { x: laneX, z: st.z }, { x: st.x, z: st.z });
    this.go(c, route, st, onPark);
  }

  /** Back out of wherever it is and leave for the highway. */
  leave(c, onGone) {
    const route = this.backOut(c);
    route.push({ x: -3.4, z: 5.2 }, { x: -10.3, z: 3.0 }, DRIVE.outLane, DRIVE.outGate, { x: -12.5, z: -18.6 }, { x: -20, z: DRIVE.laneWB }, DRIVE.exitTo);
    this.go(c, route, null, () => { c.state = 'gone'; c.solid.on = false; if (onGone) onGone(); });
  }

  backOut(c) {
    const out = [];
    if (c.state === 'parked' && c.stall) {
      const s = c.stall;
      const bx = s.office ? s.x : s.x + Math.sign(s.lane - s.x) * 3.8;
      const bz = s.office ? s.z + 4.0 : s.z;
      out.push({ x: bx, z: bz, rev: true });
      s.taken = null;
    }
    return out;
  }

  go(c, route, stall, done) {
    if (c.stall && c.stall !== stall) c.stall.taken = null;
    c.route = route; c.ri = 0; c.state = 'drive'; c.done = done || null;
    c.stall = stall; if (stall) stall.taken = c.id;
    c.solid.on = false;
    c.lights = true;
  }

  solidFor(c) {
    const hl = c.mesh.length / 2 + 0.1, hw = c.mesh.width / 2 + 0.05;
    const along = Math.abs(Math.sin(c.yaw)) > 0.7;
    const ex = along ? hl : hw, ez = along ? hw : hl;
    Object.assign(c.solid, { x0: c.x - ex, x1: c.x + ex, z0: c.z - ez, z1: c.z + ez, on: true });
  }

  /* ---------------- per frame ---------------- */
  update(dt, people, player) {
    for (const c of this.list) {
      if (c.state !== 'drive') continue;
      const wp = c.route[c.ri];
      if (!wp) { this.park(c); continue; }
      const dx = wp.x - c.x, dz = wp.z - c.z, d = Math.hypot(dx, dz);
      // somebody in the way: stop and wait, lights on
      const fx = Math.sin(c.yaw) * (wp.rev ? -1 : 1), fz = Math.cos(c.yaw) * (wp.rev ? -1 : 1);
      let blocked = false;
      for (const p of [player, ...people]) {
        if (!p || p.hidden || (p.lv || 0) !== 0) continue;
        const px = p.x - c.x, pz = p.z - c.z;
        const ahead = px * fx + pz * fz, side = Math.abs(px * fz - pz * fx);
        if (ahead > 0 && ahead < 4.2 && side < 1.3) { blocked = true; break; }
      }
      const target = blocked ? 0 : (c.ri === c.route.length - 1 ? Math.min(3.0, d * 1.6 + 0.4) : wp.rev ? 1.8 : c.z < -15 ? 11 : 4.5);
      c.speed += (target - c.speed) * Math.min(1, dt * (blocked ? 6 : 1.6));
      if (blocked) { c.waitT += dt; if (c.waitT > 2.5 && Math.random() < dt * 0.5) this.s.honk(c); } else c.waitT = 0;
      if (d < 0.35 + c.speed * 0.12) { c.ri++; continue; }
      const step = Math.min(d, c.speed * dt);
      c.x += (dx / d) * step; c.z += (dz / d) * step;
      if (!wp.rev) c.yaw = angleTowards(c.yaw, Math.atan2(dx, dz), dt * 2.4);
    }
    this.updateTraffic(dt);
  }

  park(c) {
    c.state = 'parked'; c.speed = 0; c.lights = false;
    if (c.stall) { c.x = c.stall.x; c.z = c.stall.z; c.yaw = c.stall.yaw; }
    this.solidFor(c);
    const d = c.done; c.done = null;
    if (d) d();
  }

  /** Where the driver's door is: the side of the car, a step out. */
  doorOf(c) {
    const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
    return { x: c.x - rx * 1.25, z: c.z - rz * 1.25 };
  }

  /* ---------------- the interstate ---------------- */
  updateTraffic(dt) {
    this.trafficT -= dt;
    if (this.trafficT <= 0) {
      const late = this.s.clock.between(25 * 60, 28 * 60);
      this.trafficT = (late ? 14 : 6) + Math.random() * (late ? 30 : 14);
      const west = Math.random() < 0.5;
      const truck = Math.random() < (late ? 0.5 : 0.3);
      const colors = ['white', 'gray', 'blue', 'red', 'black', 'green', 'tan', 'silver'];
      const t = {
        x: west ? 90 : -90, z: west ? DRIVE.laneWB : DRIVE.laneEB, yaw: west ? -Math.PI / 2 : Math.PI / 2,
        v: (truck ? 24 : 28) * (west ? -1 : 1), truck,
        mesh: this.mesh(truck ? 'white' : colors[Math.floor(Math.random() * colors.length)], truck ? 'bus' : 'sedan'),
        sounded: false,
      };
      this.traffic.push(t);
    }
    for (const t of this.traffic) {
      t.x += t.v * dt;
      if (!t.sounded && Math.abs(t.x - this.s.g.player.x) < 60) {
        t.sounded = true;
        const pan = Math.sign(t.v) * 0.3;
        const d = Math.abs(this.s.g.player.z - t.z);
        const k = Math.max(0.1, 1 - d / 60) * (this.s.indoor ? 0.4 : 1);
        if (t.truck) this.s.g.sound.truckPass(pan, k); else this.s.g.sound.carPass(pan, k * 0.8, 3.5);
      }
    }
    this.traffic = this.traffic.filter((t) => Math.abs(t.x) < 100);
  }

  /** Everything for the renderer's list. */
  draw(draws, dawn) {
    for (const c of this.list) {
      if (c.state === 'gone') continue;
      draws.push({ mesh: c.mesh, x: c.x, y: -0.12, z: c.z, yaw: c.yaw, r: 3.2, shade: undefined, lv: 0 });
    }
    for (const t of this.traffic) draws.push({ mesh: t.mesh, x: t.x, y: -0.16, z: t.z, yaw: t.yaw, r: t.truck ? 7 : 3.2, shade: 0.55 + dawn * 0.5 });
  }
}
