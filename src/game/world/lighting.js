/* ============================================================
   lighting.js -- baked vertex light, the way Final Rental does it:
   no lightmaps and no per-pixel lights, a scalar per vertex folded
   into the fog term at draw time.

   The store had nine fluorescents. The motel has a lobby, a lot,
   sodium lights on poles, a porch light by every door on both
   floors, a glowing drink machine and a pool lit from underneath,
   and every room has its own lamps. Each part of the property is
   baked with the lights that can actually reach it.
   ============================================================ */
import {
  ROOMS, FLOOR2, POLES, OFFICE, NORTH, ALCOVE, POOL, toWorld, ROOM_W, SIGN_POS,
} from './layout.js';

const L = (x, y, z, r, i) => ({ x, y, z, r, i });

/* ---- inside the office ---- */
export const OFFICE_LIGHTS = [
  // lobby, guest side and behind the desk
  L(1.6, 2.7, -2.1, 6.4, 0.95), L(5.6, 2.7, -2.1, 6.4, 0.95),
  L(1.6, 2.7, -5.9, 5.2, 0.9), L(5.6, 2.7, -5.9, 5.2, 0.85),
  // breakfast room
  L(-5.6, 2.7, -2.4, 5.6, 0.95), L(-2.8, 2.7, -2.4, 5.6, 0.95),
  L(-5.6, 2.7, -5.8, 5.6, 0.95), L(-2.8, 2.7, -5.8, 5.6, 0.9),
  // back office and pantry
  L(1.8, 2.7, -10.6, 6.0, 0.9), L(5.8, 2.7, -10.6, 6.0, 0.85),
  L(-4.6, 2.7, -11.2, 6.2, 0.95),
];
const OFFICE_AMBIENT = 0.28;

/* ---- outside ---- */
const OUT = [];
// sodium lights on poles over the lot
for (const p of POLES) OUT.push(L(p.x, 6.2, p.z, 14.0, 0.95));
// the canopy lights over the office door and the office front
OUT.push(L(1.5, 2.9, 1.2, 6.5, 0.7), L(6.5, 2.9, 1.2, 6.5, 0.7));
// a porch light by every door, on both floors
for (const r of ROOMS) {
  const lx = r.doorHi ? r.door.x0 - 0.25 : r.door.x1 + 0.25;
  const [x, z] = toWorld(r, lx, -0.35);
  OUT.push(L(x, r.y + 2.3, z, 4.6, 0.5));
}
// the covered walk along the north block
for (let x = NORTH.x0 + 1.5; x < NORTH.x1; x += 4) OUT.push(L(x, 2.6, NORTH.walkZ + 0.6, 4.6, 0.5));
// the vending alcove, which is the brightest thing on the property after the sign
OUT.push(L((ALCOVE.x0 + ALCOVE.x1) / 2, 1.8, ALCOVE.z0 + 1.2, 6.5, 1.1));
// pool light, from underneath
OUT.push(L((POOL.x0 + POOL.x1) / 2, 0.2, (POOL.z0 + POOL.z1) / 2, 7.0, 0.5));
// the pylon sign washes the ground round its feet
OUT.push(L(SIGN_POS.x, 4.0, SIGN_POS.z + 1.0, 9.0, 0.55));
export const OUTDOOR_LIGHTS = OUT;
const OUT_AMBIENT = 0.1;

function accumulate(lights, amb, x, y, z, nx, ny, nz) {
  let s = amb;
  for (let i = 0; i < lights.length; i++) {
    const Lt = lights[i];
    const dx = Lt.x - x;
    if (dx > Lt.r || dx < -Lt.r) continue;
    const dz = Lt.z - z;
    if (dz > Lt.r || dz < -Lt.r) continue;
    const dy = Lt.y - y;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
    let a = 1 - d / Lt.r;
    if (a <= 0) continue;
    a *= a;
    let ndl = 1;
    if (nx !== undefined) ndl = Math.max(0, (dx * nx + dy * ny + dz * nz) / d) * 0.8 + 0.2;
    s += Lt.i * a * ndl;
  }
  return s;
}

export function officeLight(x, y, z, nx, ny, nz) {
  return Math.min(1.5, accumulate(OFFICE_LIGHTS, OFFICE_AMBIENT, x, y, z, nx, ny, nz));
}

export function outdoorLight(x, y, z, nx, ny, nz) {
  let s = accumulate(OUT, OUT_AMBIENT, x, y, z, nx, ny, nz);
  // the lobby glass throws a warm rectangle out onto the walk
  if (z > -0.5 && z < 6 && x > -1.5 && x < 8.5 && y < 2.5) s += Math.max(0, 1 - z / 6) * 0.35;
  return Math.min(1.4, s);
}

/** A room's lamps: one on each nightstand, the vanity light, and the bathroom. */
export function roomLights(r) {
  const out = [];
  const add = (lx, ly, lz, rad, i) => { const [x, z] = toWorld(r, lx, lz); out.push(L(x, r.y + ly, z, rad, i)); };
  const m = (lx) => (r.doorHi ? ROOM_W - lx : lx);
  add(m(3.3), 1.2, 1.9, 4.4, 0.75);
  add(m(3.3), 1.2, 4.6, 4.4, 0.6);
  add(m(1.2), 2.4, 3.0, 5.5, 0.35);
  add(m(2.8), 2.2, 6.0, 3.6, 0.7);
  add(m(1.0), 2.3, 6.1, 3.0, 0.6);
  return out;
}
export function roomLight(r) {
  const lights = roomLights(r);
  return (x, y, z, nx, ny, nz) => Math.min(1.4, accumulate(lights, 0.2, x, y, z, nx, ny, nz));
}

/** Utility rooms in the north block: one tube each. */
export function utilityLight(cx, cz) {
  const lights = [L(cx, 2.55, cz, 5.2, 1.0)];
  return (x, y, z, nx, ny, nz) => Math.min(1.4, accumulate(lights, 0.25, x, y, z, nx, ny, nz));
}

/* ---- live light, for people and loose props ---- */
export function lightAt(x, y, z, lv = 0) {
  if (lv === 0 && x > OFFICE.x0 && x < OFFICE.x1 && z > OFFICE.z0 && z < OFFICE.z1) return officeLight(x, y, z);
  for (const r of ROOMS) {
    if (r.lv === lv && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) {
      if (!r._light) r._light = roomLight(r);
      return r._light(x, r.y + y, z);
    }
  }
  return outdoorLight(x, y + (lv ? FLOOR2 : 0), z);
}
