/* ============================================================
   geo.js -- building blocks for the motel's geometry.

   Final Rental built its store straight into world coordinates,
   which is fine for one room. The motel has twenty-eight rooms
   that are the same room turned four ways and mirrored every
   other door, so the builder here can carry a transform: model a
   bed once in room space and it lands in 213 facing the right
   way, with its vertex light baked where it actually is.

   The rules Final Rental learned the hard way still hold: nothing
   coplanar, big surfaces cut into roughly meter tiles so affine
   texture mapping does not swim, and variants dealt out by hash
   so no wall repeats itself.
   ============================================================ */
import { MeshBuilder } from '../../engine/mesh.js';
import { F_DOUBLE } from '../../engine/raster.js';

export class XBuilder extends MeshBuilder {
  constructor(textures) {
    super(textures);
    this.xf = null;
    this._stack = [];
  }
  /** Enter a local frame: origin, yaw, and optionally mirrored across x = mw / 2. */
  push(ox, oy, oz, yaw = 0, mw = null) {
    this._stack.push(this.xf);
    this.xf = { ox, oy, oz, c: Math.cos(yaw), s: Math.sin(yaw), mw };
    return this;
  }
  pop() { this.xf = this._stack.pop() || null; return this; }
  /** Run `fn` inside a frame. */
  at(ox, oy, oz, yaw, fn, mw = null) { this.push(ox, oy, oz, yaw, mw); try { fn(this); } finally { this.pop(); } return this; }

  vert(x, y, z, u, v, nx, ny, nz) {
    const f = this.xf;
    if (f) {
      if (f.mw !== null) { x = f.mw - x; nx = -nx; }
      const wx = f.ox + x * f.c + z * f.s;
      const wz = f.oz - x * f.s + z * f.c;
      const wnx = nx * f.c + nz * f.s;
      const wnz = -nx * f.s + nz * f.c;
      return super.vert(wx, f.oy + y, wz, u, v, wnx, ny, wnz);
    }
    return super.vert(x, y, z, u, v, nx, ny, nz);
  }
  tri(a, b, c, slot, flags) {
    if (this.xf && this.xf.mw !== null) super.tri(a, c, b, slot, flags);
    else super.tri(a, b, c, slot, flags);
  }

  /* ---------------- shorthand ---------------- */
  /** Box with one texture everywhere, `skip` naming faces to leave off. */
  solid(x0, y0, z0, x1, y1, z1, tex, uv, skip, flags) {
    const f = { tex, uv: uv || [0, 0, 32, 32], flags: flags | 0 };
    const faces = { all: f };
    if (skip) for (const k of skip) faces[k] = null;
    this.box(x0, y0, z0, x1, y1, z1, faces);
  }
}

/** Deterministic small integer from a pair of numbers (Final Rental's). */
export function hash2(a, b) {
  let h = Math.imul(Math.round(a * 977) ^ Math.imul(b + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0);
}

const uvFull = (tex) => [0, 0, tex.w || 64, tex.h || 64];

/**
 * A wall from A to B, facing to the LEFT of the direction of travel (the
 * convention Final Rental's wallSeg used), from y0 to y1.
 *
 * `holes` cut openings: [{ a, b, y0, y1 }] with a, b in meters along the
 * wall from A. The wall is emitted as vertical strips between the hole
 * edges, each cut into cells about a meter across.
 *
 * `tex` may be a single texture or an array to deal variants from.
 */
export function wall(mb, ax, az, bx, bz, y0, y1, tex, opts = {}) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.005) return;
  const holes = (opts.holes || []).slice().sort((p, q) => p.a - q.a);
  const cuts = [0];
  for (const h of holes) cuts.push(Math.max(0, h.a), Math.min(len, h.b));
  cuts.push(len);
  const ux = (bx - ax) / len, uz = (bz - az) / len;
  const P = (d, y) => [ax + ux * d, y, az + uz * d];
  const texes = Array.isArray(tex) ? tex : [tex];
  const cell = opts.cell || 1.1;
  const flags = opts.flags | 0;
  const strip = (d0, d1, ya, yb, k) => {
    if (d1 - d0 < 0.004 || yb - ya < 0.004) return;
    const t = texes[hash2(ax * 3.1 + az * 1.7 + d0, k) % texes.length];
    const S = Math.max(1, Math.round((d1 - d0) / cell));
    const Tn = Math.max(1, Math.round((yb - ya) / cell));
    const flip = (hash2(d0 * 5.3 + ax, k + 7) >> 3) & 1;
    const r = uvFull(t);
    const uv = flip && !opts.noFlip ? [r[2], r[1], r[0], r[3]] : r;
    mb.quad(P(d0, ya), P(d1, ya), P(d1, yb), P(d0, yb), t, uv, flags, [S, Tn, true]);
  };
  for (let i = 0; i < cuts.length - 1; i++) {
    const d0 = cuts[i], d1 = cuts[i + 1];
    if (d1 - d0 < 0.004) continue;
    const mid = (d0 + d1) / 2;
    const hole = holes.find((h) => mid > h.a && mid < h.b);
    if (hole) {
      strip(d0, d1, y0, Math.max(y0, hole.y0), i * 2);
      strip(d0, d1, Math.min(y1, hole.y1), y1, i * 2 + 1);
    } else {
      strip(d0, d1, y0, y1, i);
    }
  }
}

/** The same wall seen from both sides, with its own texture on each. */
export function wall2(mb, ax, az, bx, bz, y0, y1, texA, texB, opts = {}) {
  wall(mb, ax, az, bx, bz, y0, y1, texA, opts);
  const len = Math.hypot(bx - ax, bz - az);
  const holes = (opts.holes || []).map((h) => ({ a: len - h.b, b: len - h.a, y0: h.y0, y1: h.y1 }));
  wall(mb, bx, bz, ax, az, y0, y1, texB, { ...opts, holes });
}

/**
 * A floor (or anything flat and facing up) tiled a cell at a time. `pick`
 * chooses the texture per tile, so a mat, a worn path or a stain is part
 * of the floor rather than a second surface laid on it.
 */
export function floor(mb, x0, z0, x1, z1, y, pick, cell = 1.0, flags = 0) {
  const nx = Math.max(1, Math.round((x1 - x0) / cell));
  const nz = Math.max(1, Math.round((z1 - z0) / cell));
  const dx = (x1 - x0) / nx, dz = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const ax = x0 + i * dx, bx = ax + dx, az = z0 + j * dz, bz = az + dz;
      const t = typeof pick === 'function' ? pick(i, j, (ax + bx) / 2, (az + bz) / 2) : pick;
      if (!t) continue;
      const tex = t.tex || t;
      const k = hash2(ax * 13.1 + az * 2.7, i + j * 31);
      const r = t.uv || uvFull(tex);
      const fu = t.noFlip ? 0 : (k >> 4) & 1, fv = t.noFlip ? 0 : (k >> 5) & 1;
      const uv = [fu ? r[2] : r[0], fv ? r[3] : r[1], fu ? r[0] : r[2], fv ? r[1] : r[3]];
      mb.quad([ax, y, bz], [bx, y, bz], [bx, y, az], [ax, y, az], tex, uv, flags | (t.flags | 0));
    }
  }
}

/** The underside of something: a ceiling, a slab, a soffit. */
export function ceiling(mb, x0, z0, x1, z1, y, pick, cell = 1.0) {
  const nx = Math.max(1, Math.round((x1 - x0) / cell));
  const nz = Math.max(1, Math.round((z1 - z0) / cell));
  const dx = (x1 - x0) / nx, dz = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const ax = x0 + i * dx, bx = ax + dx, az = z0 + j * dz, bz = az + dz;
      const t = typeof pick === 'function' ? pick(i, j, (ax + bx) / 2, (az + bz) / 2) : pick;
      if (!t) continue;
      const tex = t.tex || t;
      const k = hash2(ax * 31.7 + az * 5.9, j);
      const r = uvFull(tex);
      const fu = (k >> 7) & 1, fv = (k >> 8) & 1;
      const uv = [fu ? r[2] : r[0], fv ? r[3] : r[1], fu ? r[0] : r[2], fv ? r[1] : r[3]];
      mb.quad([ax, y, az], [bx, y, az], [bx, y, bz], [ax, y, bz], tex, uv, 0);
    }
  }
}

/**
 * A flat sign: double sided, cut along its length so affine mapping cannot
 * shear the lettering as you walk past (Final Rental's signPlate).
 */
export function sign(mb, cx, y0, cz, w, h, yaw, tex, flags = 0, uv) {
  const c = Math.cos(yaw), s = Math.sin(yaw), hw = w / 2;
  const ax = cx - c * hw, az = cz + s * hw;
  const bx = cx + c * hw, bz = cz - s * hw;
  const S = Math.max(2, Math.round(w * 4)), T = Math.max(1, Math.round(h * 4));
  mb.quad([ax, y0, az], [bx, y0, bz], [bx, y0 + h, bz], [ax, y0 + h, az],
    tex, uv || uvFull(tex), flags | F_DOUBLE, [S, T, false]);
}

/**
 * A single-sided panel standing at (cx, cz), facing yaw (the direction a
 * reader stands in, looking back at it). Used for wall art, notices and
 * the faces of machines.
 */
export function panel(mb, cx, y0, cz, w, h, yaw, tex, flags = 0, uv) {
  // facing yaw means its normal points along (sin yaw, cos yaw)
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const hw = w / 2;
  // viewed from the front, p0 sits bottom-right (MeshBuilder.quad's convention)
  const p0 = [cx - rx * hw, y0, cz - rz * hw];
  const p1 = [cx + rx * hw, y0, cz + rz * hw];
  const S = Math.max(1, Math.round(w * 4)), T = Math.max(1, Math.round(h * 4));
  mb.quad(p0, p1, [p1[0], y0 + h, p1[2]], [p0[0], y0 + h, p0[2]], tex, uv || uvFull(tex), flags, [S, T, false]);
}

/** A vertical cylinder-ish post, eight sided, for poles and legs. */
export function post(mb, x, z, y0, y1, r, tex, sides = 6) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  mb.loft([{ y: y0, w: r, d: r, ox: x, oz: z }, { y: y1, w: r, d: r, ox: x, oz: z }],
    pts.slice().reverse(), [{ tex, uv: uvFull(tex) }], null);
}
