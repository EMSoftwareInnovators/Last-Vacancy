/* ============================================================
   doors.js -- every door on the property, and the two pool gates.

   Final Rental had exactly two doors and a named variable for each.
   The motel has thirty-odd, so a door is data: a hinge, a closed
   angle, which way it swings, whether it is locked, and a box that
   is solid while it is shut. Guests open their own; the lobby door
   opens for anyone; the clerk carries a master key.
   ============================================================ */
import { DOORS, GATES } from './layout.js';
import { doorSlab } from './collision.js';

const OPEN = 1.35;

export class Doors {
  constructor() {
    this.list = [];
    this.byId = {};
    for (const d of DOORS.concat(GATES.map((g) => ({ ...g, kind: 'gate', h: 1.2, lv: 0, auto: true })))) {
      const door = {
        ...d, y: d.y || 0, swing: 0, target: 0, hold: 0, locked: d.kind === 'room' && !!d.room,
        sign: swingSign(d),
      };
      door.slab = doorSlab(door);
      door.slab.skip = (who) => !!(who && who.ghost);
      this.list.push(door);
      this.byId[door.id] = door;
    }
    this.solids = this.list.map((d) => d.slab);
  }

  get(id) { return this.byId[id] || null; }
  room(no) { return this.byId['r' + no] || null; }

  /** Swing it open and keep it open for `hold` seconds. */
  open(id, hold = 2.5) {
    const d = typeof id === 'string' ? this.byId[id] : id;
    if (!d) return null;
    const was = d.target;
    d.target = 1; d.hold = Math.max(d.hold, hold);
    return was ? null : d;
  }
  close(id) {
    const d = typeof id === 'string' ? this.byId[id] : id;
    if (!d) return;
    d.target = 0; d.hold = 0;
  }
  isOpen(d) { return d.swing > 0.35; }

  /**
   * Doors that open themselves for people walking through them: the lobby
   * door, the laundry, the pool gates. Anybody within a step of one with
   * somewhere to be on the other side gets it held for them. Returns the
   * doors that started opening this frame, so the game can ring the bell.
   */
  update(dt, people) {
    const opened = [];
    for (const d of this.list) {
      if (d.auto) {
        const cx = d.hx + Math.cos(d.a) * d.w / 2, cz = d.hz - Math.sin(d.a) * d.w / 2;
        for (const p of people) {
          if (p.hidden || p.lv !== d.lv) continue;
          if (!p.moving && !p.isPlayer) continue;
          if (Math.hypot(p.x - cx, p.z - cz) < (p.isPlayer ? 1.05 : 1.5)) {
            if (d.target === 0) opened.push(d);
            d.target = 1; d.hold = Math.max(d.hold, p.isPlayer ? 0.8 : 1.4);
          }
        }
      }
      if (d.hold > 0) { d.hold -= dt; if (d.hold <= 0 && !d.stay) d.target = 0; }
      const k = Math.min(1, dt * (d.target ? 4.5 : 3.2));
      d.swing += (d.target * OPEN - d.swing) * k;
      d.slab.on = d.swing < 0.3;
    }
    return opened;
  }
}

/** Which way the angle has to go for the leaf to swing toward `into`. */
function swingSign(d) {
  const tx = -Math.sin(d.a), tz = -Math.cos(d.a);
  return tx * d.into[0] + tz * d.into[1] >= 0 ? 1 : -1;
}

export function leafYaw(d) { return d.a + d.sign * d.swing; }
