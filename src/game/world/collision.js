/* ============================================================
   collision.js -- what you cannot walk through, on which floor.

   Final Rental's collision was a flat list of boxes tested against
   a circle: push the circle out of anything it overlaps and slide.
   That is still exactly what happens here. What the motel adds is
   a second floor: every solid belongs to the ground (0), the
   upstairs walk (1) or both (-1), and the stairs are ramps that
   carry whoever is on them from one to the other.

   Solids live in a coarse grid so a person only tests the boxes
   near them. Doors and parked cars are passed in each frame.
   ============================================================ */
import {
  OFFICE, LOBBY, DESK, BREAKFAST, ARCH, WEST, EAST, NORTH, POOL, STAIRS, ROOMS, FLOOR2, ROOM_W, ROOM_D,
  LAUNDRY, MAINT, ALCOVE, LINEN, SUPPLY, MGR_DESK, PANTRY_SHELF, FRIDGE, BFAST_COUNTER, BTABLES, NEWS_RACK,
  BTRASH, ICE_MACHINE, VENDING, POLES, SIGN_POS, DUMPSTER, toWorld,
} from './layout.js';
import { roomFurniture } from './roombuild.js';

const GX0 = -34, GZ0 = -24, CELL = 4, GW = 18, GH = 18;

/* ============================================================
   THE STATIC SOLIDS
   ============================================================ */
export function buildSolids() {
  const S = [];
  const add = (x0, z0, x1, z1, lv = 0, tag = 'wall') => {
    S.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), lv, tag });
  };
  const T = 0.08;

  /* ---- the office ---- */
  const O = OFFICE;
  add(O.x0, O.z1 - 0.14, 3.45, O.z1 + T);            // storefront and breakfast front, west of the door
  add(4.45, O.z1 - 0.14, O.x1 + 0.1, O.z1 + T);      // and east of it
  add(O.x0 - T, O.z0, O.x0 + 0.06, O.z1);
  add(O.x1 - 0.06, O.z0, O.x1 + T, O.z1);
  add(O.x0, O.z0 - T, O.x1, O.z0 + 0.06);
  // the wall down the middle, lobby | breakfast | pantry, with the arch and a door in it
  add(-1.06, ARCH.z1, -0.94, O.z1);
  add(-1.06, -11.1, -0.94, ARCH.z0);
  add(-1.06, O.z0, -0.94, -12.0);
  // behind the desk | back office, with its door
  add(LOBBY.x0, -7.06, 5.25, -6.94);
  add(6.15, -7.06, O.x1, -6.94);
  // breakfast | pantry, with its door
  add(O.x0, -8.06, -2.45, -7.94);
  add(-1.55, -8.06, -1.0, -7.94);
  // the desk
  add(DESK.x0, DESK.z0, DESK.x1, DESK.z1, 0, 'desk');
  // lobby furniture
  add(7.05, -3.95, 7.95, -1.8, 0, 'furniture');       // armchairs and their table
  add(7.55, -6.2, 7.95, -5.2, 0, 'furniture');        // brochure rack
  add(7.35, -0.7, 7.75, -0.3, 0, 'furniture');        // the palm
  add(-0.9, -0.95, -0.3, -0.35, 0, 'furniture');      // lobby coffee
  add(6.5, -6.95, 7.0, -6.4, 0, 'furniture');         // clerk's cabinet
  // breakfast
  add(BFAST_COUNTER.x0, BFAST_COUNTER.z0, BFAST_COUNTER.x1, BFAST_COUNTER.z1, 0, 'counter');
  for (const t of BTABLES) add(t.x - 0.28, t.z - 0.28, t.x + 0.28, t.z + 0.28, 0, 'table');
  add(NEWS_RACK.x0, NEWS_RACK.z0, NEWS_RACK.x1, NEWS_RACK.z1, 0, 'furniture');
  add(BTRASH.x0, BTRASH.z0, BTRASH.x1, BTRASH.z1, 0, 'furniture');
  add(-7.75, -0.75, -7.35, -0.35, 0, 'furniture');
  // back office and pantry
  add(LINEN.x0, LINEN.z0, LINEN.x1, LINEN.z1, 0, 'shelf');
  add(SUPPLY.x0, SUPPLY.z0, SUPPLY.x1, SUPPLY.z1, 0, 'shelf');
  add(MGR_DESK.x0, MGR_DESK.z0, MGR_DESK.x1, MGR_DESK.z1, 0, 'furniture');
  add(7.4, -8.8, 7.95, -7.8, 0, 'furniture');
  add(7.3, -12.2, 7.95, -11.5, 0, 'furniture');
  add(PANTRY_SHELF.x0, PANTRY_SHELF.z0, PANTRY_SHELF.x1, PANTRY_SHELF.z1, 0, 'shelf');
  add(FRIDGE.x0, FRIDGE.z0, FRIDGE.x1, FRIDGE.z1, 0, 'furniture');
  add(-6.9, -13.95, -4.2, -13.35, 0, 'furniture');
  add(-2.2, -13.9, -1.3, -13.2, 0, 'furniture');
  // canopy posts, front of the office
  add(0.12, 4.42, 0.38, 4.68, 0, 'post'); add(7.82, 4.42, 8.08, 4.68, 0, 'post');

  /* ---- every room, on both floors ---- */
  for (const r of ROOMS) {
    const lv = r.lv;
    const box = (lx0, lz0, lx1, lz1, tag = 'wall') => {
      const mx0 = r.doorHi ? ROOM_W - lx1 : lx0, mx1 = r.doorHi ? ROOM_W - lx0 : lx1;
      const a = toWorld(r, mx0, lz0), b = toWorld(r, mx1, lz1);
      add(a[0], a[1], b[0], b[1], lv, tag);
    };
    // facade, either side of the door (canonical door-left layout, mirrored as needed)
    box(0, 0, 0.35, 0.12);
    box(1.25, 0, ROOM_W, 0.12);
    // party walls and the back wall
    box(0, 0, 0.06, ROOM_D);
    box(ROOM_W - 0.06, 0, ROOM_W, ROOM_D);
    box(0, ROOM_D - 0.06, ROOM_W, ROOM_D);
    for (const f of roomFurniture(r)) box(f.x0, f.z0, f.x1, f.z1, 'furniture');
  }

  /* ---- the walks ---- */
  // ground-floor posts under the upper walk
  for (let i = 0; i <= WEST.n; i++) {
    const z = Math.min(29.2 - 0.08, Math.max(WEST.z0 + 0.08, WEST.z0 + i * ROOM_W));
    add(WEST.walk - 0.08, z - 0.08, WEST.walk + 0.08, z + 0.08, 0, 'post');
  }
  for (let i = 0; i <= EAST.n; i++) {
    const z = Math.min(EAST.zTop - 0.08, Math.max(7.6 + 0.08, EAST.zTop - i * ROOM_W));
    add(EAST.walk - 0.08, z - 0.08, EAST.walk + 0.08, z + 0.08, 0, 'post');
  }
  // upstairs railings, and the ends of the upper walks
  add(WEST.walk - 0.06, WEST.z0, WEST.walk + 0.1, 29.2, 1, 'rail');
  add(WEST.facade, 29.2 - 0.06, WEST.walk + 0.1, 29.3, 1, 'rail');
  add(EAST.walk - 0.1, 7.6, EAST.walk + 0.06, EAST.zTop, 1, 'rail');
  add(EAST.walk - 0.1, EAST.zTop - 0.06, EAST.facade, EAST.zTop + 0.1, 1, 'rail');
  // building ends, both floors
  add(WEST.back, WEST.z0 - 0.1, WEST.facade, WEST.z0, -1);
  add(WEST.back, 29.2, WEST.facade, 29.3, -1);
  add(EAST.facade, 7.5, EAST.back, 7.6, -1);
  add(EAST.facade, EAST.zTop, EAST.back, EAST.zTop + 0.1, -1);

  /* ---- stairs: side rails for everybody, the high end solid underneath ---- */
  for (const s of STAIRS) {
    add(s.x0 - 0.12, s.z0, s.x0, s.z1, -1, 'rail');
    add(s.x1, s.z0, s.x1 + 0.12, s.z1, -1, 'rail');
    const zHigh = s.bottom + (s.top - s.bottom) * (1.75 / FLOOR2);
    add(s.x0, zHigh, s.x1, s.z1, 0, 'underStair');
    // the slivers of walk beside the top of the stair, which are a drop
    const facadeX = s.x0 < 0 ? WEST.facade : EAST.facade;
    const walkX = s.x0 < 0 ? WEST.walk : EAST.walk;
    add(Math.min(facadeX, s.x0), s.top - 1.2, Math.max(facadeX, s.x0) - (s.x0 < 0 ? 0 : 0), s.top, 1, 'rail');
    add(Math.min(walkX, s.x1), s.top - 1.2, Math.max(walkX, s.x1), s.top, 1, 'rail');
    // and the far end of the ground walk, which the stair closes off
    add(s.x0, s.z0 - 0.02, s.x1, s.z0 + 0.02, 1, 'rail');
  }

  /* ---- the north block ---- */
  const N = NORTH;
  const wallsAround = (R, door, open = false) => {
    if (!open) {
      if (door) { add(R.x0, N.facade, door.x0, N.facade + 0.12); add(door.x1, N.facade, R.x1, N.facade + 0.12); }
      else add(R.x0, N.facade, R.x1, N.facade + 0.12);
    }
    add(R.x0, N.facade, R.x0 + 0.06, N.back); add(R.x1 - 0.06, N.facade, R.x1, N.back);
    add(R.x0, N.back - 0.06, R.x1, N.back);
  };
  wallsAround(LAUNDRY, LAUNDRY.door);
  wallsAround(MAINT, MAINT.door);
  add(ALCOVE.x0, N.facade, ALCOVE.x0 + 0.06, N.back); add(ALCOVE.x1 - 0.06, N.facade, ALCOVE.x1 + 0.1, N.back);
  add(ALCOVE.x0, ALCOVE.z1 - 0.06, ALCOVE.x1, ALCOVE.z1);
  add(ALCOVE.x0, ALCOVE.z1, ALCOVE.x1 + 0.1, N.back);
  add(N.x0 - 0.1, N.facade, N.x0, N.back);
  // things inside: washers and dryers, the table, the shelves, the heater, the machines
  add(LAUNDRY.x0 + 0.1, N.back - 0.8, LAUNDRY.x1 - 0.1, N.back, 0, 'furniture');
  add(LAUNDRY.x1 - 0.7, N.facade + 1.2, LAUNDRY.x1 - 0.1, N.facade + 2.8, 0, 'furniture');
  add(MAINT.x0 + 0.1, N.facade + 1.0, MAINT.x0 + 0.7, N.facade + 3.4, 0, 'shelf');
  add(MAINT.x1 - 0.8, N.back - 0.9, MAINT.x1 - 0.2, N.back - 0.3, 0, 'furniture');
  add(ICE_MACHINE.x0, ICE_MACHINE.z0, ICE_MACHINE.x1, ICE_MACHINE.z1, 0, 'machine');
  for (const v of VENDING) add(v.x0, v.z0, v.x1, v.z1, 0, 'machine');
  // the covered walk's posts
  for (let x = N.x0 + 0.1; x <= N.x1; x += 3.6) add(x - 0.07, N.walkZ + 0.02, x + 0.07, N.walkZ + 0.16, 0, 'post');

  /* ---- the pool: fence with gate openings, the water, the furniture ---- */
  const F = POOL.fence;
  add(F.x0, F.z0 - 0.04, -0.55, F.z0 + 0.04, 0, 'fence'); add(0.55, F.z0 - 0.04, F.x1, F.z0 + 0.04, 0, 'fence');
  add(F.x0, F.z1 - 0.04, -0.55, F.z1 + 0.04, 0, 'fence'); add(0.55, F.z1 - 0.04, F.x1, F.z1 + 0.04, 0, 'fence');
  add(F.x0 - 0.04, F.z0, F.x0 + 0.04, F.z1, 0, 'fence'); add(F.x1 - 0.04, F.z0, F.x1 + 0.04, F.z1, 0, 'fence');
  add(POOL.x0, POOL.z0, POOL.x1, POOL.z1, 0, 'water');
  for (const [x, z] of [[-5.2, 23.0], [-5.2, 25.4], [5.2, 23.0], [5.2, 25.6]]) add(x - 0.34, z - 0.95, x + 0.34, z + 0.95, 0, 'furniture');
  add(-3.8, 27.9, -3.0, 28.7, 0, 'furniture');
  add(4.6, 27.6, 6.0, 28.9, 0, 'furniture');

  /* ---- out in the lot ---- */
  for (const p of POLES) add(p.x - 0.25, p.z - 0.25, p.x + 0.25, p.z + 0.25, 0, 'post');
  add(SIGN_POS.x - 2.0, SIGN_POS.z - 0.8, SIGN_POS.x + 2.0, SIGN_POS.z + 0.8, 0, 'sign');
  add(DUMPSTER.x0 + 0.3, DUMPSTER.z0 + 0.4, DUMPSTER.x1 - 0.3, DUMPSTER.z1 - 0.4, 0, 'dumpster');
  // the edge of the property: nobody on foot goes out onto the interstate
  add(-26, -17.4, 26, -17.0, 0, 'edge');
  add(-26, 40.4, 26, 40.8, 0, 'edge');
  add(-26, -17.4, -25.6, 40.8, 0, 'edge');
  add(25.6, -17.4, 26, 40.8, 0, 'edge');
  // the backs of the wings, which nobody has any business walking round
  add(WEST.back - 0.1, WEST.z0 - 0.1, WEST.back, 29.3, 0, 'wall');
  add(EAST.back, 7.5, EAST.back + 0.1, EAST.zTop + 0.1, 0, 'wall');
  add(N.x0 - 0.1, N.back, N.x1 + 0.1, N.back + 0.1, 0, 'wall');

  return indexSolids(S);
}

/* ---------------- the grid ---------------- */
function indexSolids(list) {
  const cells = Array.from({ length: GW * GH }, () => []);
  for (const s of list) {
    const i0 = Math.max(0, Math.floor((s.x0 - GX0) / CELL)), i1 = Math.min(GW - 1, Math.floor((s.x1 - GX0) / CELL));
    const j0 = Math.max(0, Math.floor((s.z0 - GZ0) / CELL)), j1 = Math.min(GH - 1, Math.floor((s.z1 - GZ0) / CELL));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) cells[j * GW + i].push(s);
  }
  return { list, cells, stamp: 0 };
}

function near(solids, x0, z0, x1, z1, out) {
  out.length = 0;
  const st = ++solids.stamp;
  const i0 = Math.max(0, Math.floor((x0 - GX0) / CELL)), i1 = Math.min(GW - 1, Math.floor((x1 - GX0) / CELL));
  const j0 = Math.max(0, Math.floor((z0 - GZ0) / CELL)), j1 = Math.min(GH - 1, Math.floor((z1 - GZ0) / CELL));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const c = solids.cells[j * GW + i];
      for (let k = 0; k < c.length; k++) { const s = c[k]; if (s._st !== st) { s._st = st; out.push(s); } }
    }
  }
  return out;
}
const _near = [];

/* ============================================================
   LEVELS AND STAIRS
   ============================================================ */
export function stairAt(x, z) {
  for (const s of STAIRS) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return s;
  return null;
}
export function rampY(s, z) {
  const t = (z - s.bottom) / (s.top - s.bottom);
  return Math.max(0, Math.min(1, t)) * FLOOR2;
}

/* Where the ground is raised off the lot: walks, the office front, the
   north walk, the pool deck. Everything else outside is asphalt, 12cm down. */
const RAISED = [
  { x0: OFFICE.x0 - 0.3, x1: OFFICE.x1 + 0.3, z0: OFFICE.z0 - 0.3, z1: 0.9 },
  { x0: WEST.back, x1: WEST.walk, z0: WEST.z0, z1: 29.2 },
  { x0: EAST.walk, x1: EAST.back, z0: 7.6, z1: EAST.zTop },
  { x0: NORTH.x0 - 0.1, x1: NORTH.x1 + 0.1, z0: NORTH.walkZ, z1: NORTH.back },
  { x0: POOL.fence.x0, x1: POOL.fence.x1, z0: POOL.fence.z0, z1: POOL.fence.z1 },
];
export function groundY(x, z) {
  for (const r of RAISED) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return 0;
  return -0.12;
}

/**
 * Where somebody's feet are, and which floor they are on, after a move.
 * Mutates `e.y` and `e.lv`.
 */
export function settleLevel(e) {
  const s = stairAt(e.x, e.z);
  if (s) {
    e.y = rampY(s, e.z);
    e.lv = e.y > 1.45 ? 1 : 0;
    e.onStair = true;
    return;
  }
  e.onStair = false;
  e.y = e.lv ? FLOOR2 : groundY(e.x, e.z);
}

/* ============================================================
   RESOLVING A MOVE
   ============================================================ */
/**
 * Push a circle at (x, z) out of everything solid on its floor. Returns [x, z].
 * `dyn` is a list of extra boxes (closed doors, parked cars) with `lv` and
 * an optional `skip` predicate.
 */
export function collide(x, z, r, lv, solids, dyn, who) {
  const list = near(solids, x - r - 0.1, z - r - 0.1, x + r + 0.1, z + r + 0.1, _near);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (s.lv !== lv && s.lv !== -1) continue;
      [x, z] = push(x, z, r, s);
    }
    if (dyn) {
      for (let i = 0; i < dyn.length; i++) {
        const s = dyn[i];
        if (!s.on || (s.lv !== lv && s.lv !== -1)) continue;
        if (s.skip && s.skip(who)) continue;
        [x, z] = push(x, z, r, s);
      }
    }
  }
  return [x, z];
}

function push(x, z, r, s) {
  const cx = s.x0 > x ? s.x0 : s.x1 < x ? s.x1 : x;
  const cz = s.z0 > z ? s.z0 : s.z1 < z ? s.z1 : z;
  const dx = x - cx, dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return [x, z];
  const d = Math.sqrt(d2);
  if (d > 0.0001) return [cx + (dx / d) * r, cz + (dz / d) * r];
  // dead center: out along the shallowest axis
  const px = Math.min(x - s.x0, s.x1 - x), pz = Math.min(z - s.z0, s.z1 - z);
  if (px < pz) return [(x - s.x0 < s.x1 - x) ? s.x0 - r : s.x1 + r, z];
  return [x, (z - s.z0 < s.z1 - z) ? s.z0 - r : s.z1 + r];
}

/** Straight-line walkability on one floor, used by the navigator. */
export function clearPath(x0, z0, x1, z1, lv, solids, r, ignore = null) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.max(1, Math.ceil(len / 0.25));
  const list = near(solids, Math.min(x0, x1) - r - 0.2, Math.min(z0, z1) - r - 0.2, Math.max(x0, x1) + r + 0.2, Math.max(z0, z1) + r + 0.2, []);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    for (const s of list) {
      if (s.lv !== lv && s.lv !== -1) continue;
      if (ignore && ignore(s)) continue;
      if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) return false;
    }
  }
  return true;
}

/** A closed door as a box, for collide(). Updated in place by the door system. */
export function doorSlab(d) {
  const c = Math.cos(d.a), s = -Math.sin(d.a);
  const ex = d.hx + c * d.w, ez = d.hz + s * d.w;
  const t = 0.06;
  return {
    x0: Math.min(d.hx, ex) - t, x1: Math.max(d.hx, ex) + t,
    z0: Math.min(d.hz, ez) - t, z1: Math.max(d.hz, ez) + t,
    lv: d.lv | 0, on: true, door: d,
  };
}
