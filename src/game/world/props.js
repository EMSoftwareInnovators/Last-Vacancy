/* ============================================================
   props.js -- furniture and machines, modeled in their own frame.

   Final Rental's rule for props: model the thing out of the parts
   it is made of rather than wrapping one texture round a cube --
   "one texture wrapped round a cube reads as a cardboard box with
   a keypad printed on it". A chair has legs. A car has wheels.

   Everything here faces local +Z unless it says otherwise, stands
   on y = 0, and is placed by whoever calls it with XBuilder.at().
   ============================================================ */
import { F_EMIT, F_BLEND, F_DOUBLE } from '../../engine/raster.js';
import { XBuilder, panel, post } from './geo.js';

/* ---------------- seating and tables ---------------- */
/** A chrome-legged vinyl chair, seat facing +z (you sit looking +z). */
export function chair(b, T, seat) {
  const s = seat || T.vinylBrown;
  for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
    b.solid(x - 0.015, 0, z - 0.015, x + 0.015, 0.44, z + 0.015, T.chrome, [0, 0, 8, 8]);
  }
  b.solid(-0.22, 0.44, -0.22, 0.22, 0.5, 0.22, s, [0, 0, 32, 32]);
  b.solid(-0.21, 0.5, -0.24, 0.21, 0.92, -0.19, s, [0, 0, 32, 32]);
}
/** Square table on a pedestal. */
export function table(b, T, w = 0.8, d = 0.8, h = 0.74, top) {
  b.solid(-0.04, 0, -0.04, 0.04, h - 0.03, 0.04, T.chrome, [0, 0, 8, 8]);
  b.solid(-0.25, 0, -0.25, 0.25, 0.03, 0.25, T.darkMetal, [0, 0, 16, 16]);
  b.box(-w / 2, h - 0.03, -d / 2, w / 2, h, d / 2, { all: { tex: T.chrome, uv: [0, 0, 16, 4] }, py: { tex: top || T.tableTop, uv: [0, 0, 64, 64] } });
}
/** A lobby armchair: vinyl on a wooden frame. */
export function armchair(b, T) {
  b.solid(-0.36, 0, -0.34, 0.36, 0.42, 0.34, T.wood, [0, 0, 32, 16]);
  b.solid(-0.34, 0.42, -0.32, 0.34, 0.5, 0.32, T.vinylOrange, [0, 0, 32, 32]);
  b.solid(-0.36, 0.42, -0.36, 0.36, 0.95, -0.24, T.vinylOrange, [0, 0, 32, 32]);
  b.solid(-0.4, 0.42, -0.34, -0.33, 0.66, 0.34, T.wood, [0, 0, 16, 16]);
  b.solid(0.33, 0.42, -0.34, 0.4, 0.66, 0.34, T.wood, [0, 0, 16, 16]);
}
/** A pool lounger, flat, with its back raised at -z. */
export function lounger(b, T) {
  for (const [x, z] of [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]]) b.solid(x - 0.02, 0, z - 0.02, x + 0.02, 0.3, z + 0.02, T.whiteMetal, [0, 0, 8, 8]);
  b.box(-0.32, 0.3, -0.35, 0.32, 0.34, 0.95, { all: { tex: T.whiteMetal, uv: [0, 0, 8, 8] }, py: { tex: T.lounger, uv: [0, 0, 32, 48] } });
  // the raised back, as a slanted quad pair
  b.quad([0.32, 0.34, -0.35], [-0.32, 0.34, -0.35], [-0.32, 0.95, -0.95], [0.32, 0.95, -0.95], T.lounger, [0, 40, 32, 64], F_DOUBLE);
}

/* ---------------- machines ---------------- */
/** A drink or snack machine: lit front, dark sides. */
export function vendingMachine(b, T, front, w = 0.9, d = 0.75, h = 1.85) {
  b.box(-w / 2, 0, -d / 2, w / 2, h, d / 2, {
    all: { tex: T.machineSide, uv: [0, 0, 16, 64] },
    pz: { tex: front, uv: [0, 0, 32, 64], flags: F_EMIT, sub: [2, 3, false] },
    ny: null,
  });
}
export function iceMachine(b, T, w = 1.1, d = 0.9, h = 1.9) {
  b.box(-w / 2, 0, -d / 2, w / 2, h, d / 2, {
    all: { tex: T.metal, uv: [0, 0, 32, 32] },
    pz: { tex: T.iceMachine, uv: [0, 0, 32, 64], sub: [2, 3, false] },
    ny: null,
  });
}
export function washer(b, T, dryer) {
  b.box(-0.34, 0, -0.33, 0.34, 0.92, 0.33, {
    all: { tex: T.white, uv: [0, 0, 16, 16] },
    pz: { tex: dryer ? T.dryer : T.washer, uv: [0, 0, 32, 32] },
    py: { tex: dryer ? T.white : T.washer, uv: [0, 0, 32, 10] }, ny: null,
  });
}

/* ---------------- televisions ---------------- */
/**
 * A 19" color set on a wall bracket, screen facing +z. Returns a mesh with
 * `screenSlot` so the game can swap the picture the way Final Rental swaps
 * its static frames.
 */
export function buildWallTv(T) {
  const b = new XBuilder();
  b.light = () => 0.95;
  const HW = 0.34, HH = 0.27, DZ = 0.42;
  b.box(-HW, -HH, -DZ * 0.6, HW, HH, DZ * 0.4, {
    all: { tex: T.tvShell, uv: [0, 0, 32, 32] }, pz: null,
  });
  const IZ = DZ * 0.4;
  const frame = (ax, ay, bx, by) => b.quad([bx, ay, IZ], [ax, ay, IZ], [ax, by, IZ], [bx, by, IZ], T.tvShell, [0, 0, 32, 32], 0);
  const SW = 0.27, SH = 0.2;
  // wound to face +z: p0 is the viewer's bottom-right, which is -x
  const f2 = (ax, ay, bx, by) => b.quad([ax, ay, IZ], [bx, ay, IZ], [bx, by, IZ], [ax, by, IZ], T.tvShell, [0, 0, 32, 32], 0);
  void frame;
  f2(-HW, -HH, HW, -SH); f2(-HW, SH, HW, HH); f2(-HW, -SH, -SW, SH); f2(SW, -SH, HW, SH);
  b.quad([-SW, -SH, IZ + 0.004], [SW, -SH, IZ + 0.004], [SW, SH, IZ + 0.004], [-SW, SH, IZ + 0.004], T.channels.OFF[0], [2, 2, 62, 62], F_EMIT);
  b.light = () => 0.6;
  b.solid(-0.04, -0.05, -DZ * 0.6 - 0.35, 0.04, 0.05, -DZ * 0.6, T.darkMetal, [0, 0, 16, 16]);
  const m = b.build();
  m.screenSlot = m.textures.indexOf(T.channels.OFF[0]);
  return m;
}

/* ---------------- vehicles ---------------- */
/**
 * A car of the period: a long flat body, a greenhouse set back on it, four
 * wheels. `kind` shapes it -- sedan, wagon, pickup, van, bus -- and the
 * paint comes out of the per-color texture set. Nose at +z.
 */
export function buildCarMesh(T, color, kind = 'sedan', side = null) {
  const b = new XBuilder();
  b.light = () => 1;
  const P = T.car[color] || T.car.gray;
  const dims = {
    sedan: { L: 5.1, W: 1.86, H0: 0.3, H1: 0.9, cab: [-1.35, 1.0], ch: 0.55 },
    wagon: { L: 5.2, W: 1.86, H0: 0.3, H1: 0.9, cab: [-2.2, 1.0], ch: 0.56 },
    pickup: { L: 5.2, W: 1.9, H0: 0.42, H1: 1.05, cab: [-0.1, 1.2], ch: 0.6, bed: true },
    van: { L: 5.0, W: 2.0, H0: 0.35, H1: 1.1, cab: [-2.5, 1.5], ch: 0.95 },
    bus: { L: 11.5, W: 2.55, H0: 0.45, H1: 1.4, cab: [-5.75, 5.6], ch: 1.8 },
  }[kind] || { L: 5.1, W: 1.86, H0: 0.3, H1: 0.9, cab: [-1.35, 1.0], ch: 0.55 };
  const hl = dims.L / 2, hw = dims.W / 2;
  const bodyTex = side || P.body;
  b.box(-hw, dims.H0, -hl, hw, dims.H1, hl, {
    all: { tex: bodyTex, uv: [0, 0, 64, 32], sub: [2, 1, false] },
    pz: { tex: P.front, uv: [0, 0, 32, 16] },
    nz: { tex: P.back, uv: [0, 0, 32, 16] },
    py: { tex: P.top, uv: [0, 0, 32, 32] },
    ny: null,
  });
  // the greenhouse: glass all round, the roof on top, tapered on the long cars
  const [c0, c1] = dims.cab;
  const top = dims.H1 + dims.ch;
  const inset = kind === 'bus' || kind === 'van' ? 0.02 : 0.1;
  const glass = { tex: T.carGlass, uv: [0, 0, 32, 16] };
  b.box(-hw + inset, dims.H1, c0, hw - inset, top, c1, {
    all: glass, py: { tex: P.top, uv: [0, 0, 32, 32] }, ny: null,
    ...(side && kind !== 'sedan' ? { px: { tex: side, uv: [0, 0, 64, 32] }, nx: { tex: side, uv: [64, 0, 0, 32] } } : {}),
  });
  if (kind === 'bus') {
    // the whole side is the livery; the glass is a band along the top
    b.box(-hw - 0.005, dims.H1 + 0.9, -hl + 0.3, hw + 0.005, top - 0.1, hl - 0.4, { all: glass, py: null, ny: null, pz: null, nz: null });
  }
  if (dims.bed) {
    // pickup bed walls
    b.solid(-hw, dims.H1, -hl, -hw + 0.08, dims.H1 + 0.32, c0 - 0.05, bodyTex, [0, 0, 32, 8]);
    b.solid(hw - 0.08, dims.H1, -hl, hw, dims.H1 + 0.32, c0 - 0.05, bodyTex, [0, 0, 32, 8]);
    b.solid(-hw, dims.H1, -hl, hw, dims.H1 + 0.32, -hl + 0.08, bodyTex, [0, 0, 32, 8]);
  }
  // wheels
  const wr = kind === 'bus' ? 0.5 : 0.34, wz = hl - (kind === 'bus' ? 1.4 : 0.85);
  for (const x of [-hw - 0.01, hw - 0.19]) {
    for (const z of [-wz, wz]) b.solid(x, 0, z - wr, x + 0.2, wr * 2, z + wr, T.tire, [0, 0, 16, 16]);
  }
  // lamps, lit only when driving: kept in their own slots so the game can swap them
  b.box(-hw + 0.1, dims.H0 + 0.18, hl, -hw + 0.4, dims.H0 + 0.36, hl + 0.01, { all: { tex: T.headlight, uv: [0, 0, 8, 8], flags: F_EMIT } });
  b.box(hw - 0.4, dims.H0 + 0.18, hl, hw - 0.1, dims.H0 + 0.36, hl + 0.01, { all: { tex: T.headlight, uv: [0, 0, 8, 8], flags: F_EMIT } });
  b.box(-hw + 0.08, dims.H0 + 0.2, -hl - 0.01, -hw + 0.34, dims.H0 + 0.34, -hl, { all: { tex: T.taillight, uv: [0, 0, 8, 8], flags: F_EMIT } });
  b.box(hw - 0.34, dims.H0 + 0.2, -hl - 0.01, hw - 0.08, dims.H0 + 0.34, -hl, { all: { tex: T.taillight, uv: [0, 0, 8, 8], flags: F_EMIT } });
  if (kind === 'van' && side === T.vanSide.storm) {
    // the storm chaser's weather station and antennas
    b.solid(-0.3, top, -0.4, 0.3, top + 0.1, 0.4, T.darkMetal, [0, 0, 16, 16]);
    b.solid(0.5, top, -1.8, 0.53, top + 1.3, -1.77, T.chrome, [0, 0, 8, 8]);
    b.solid(-0.5, top, -1.8, -0.47, top + 0.9, -1.77, T.chrome, [0, 0, 8, 8]);
  }
  const m = b.build();
  m.length = dims.L; m.width = dims.W;
  return m;
}

/* ---------------- small things the clerk carries ---------------- */
/**
 * Everything that can be in your hands, as a little mesh each, built the
 * way Final Rental built its tapes. Local frame: centered, lying flat.
 */
export function buildItemMeshes(T) {
  const M = {};
  const mk = (fn) => { const b = new XBuilder(); b.light = () => 1; fn(b); return b.build(); };
  M.key = mk((b) => {
    // brass key and the big diamond fob with the number on it
    b.solid(-0.012, 0, -0.05, 0.012, 0.004, 0.02, T.brass, [0, 0, 16, 16]);
    b.quad([0.035, 0.006, 0.02], [0, 0.006, 0.075], [-0.035, 0.006, 0.02], [0, 0.006, -0.035], T.vinylOrange, [0, 0, 32, 32], F_DOUBLE);
  });
  M.towels = mk((b) => { for (let i = 0; i < 3; i++) b.solid(-0.16, i * 0.045, -0.11, 0.16, i * 0.045 + 0.04, 0.11, T.towel, [0, 0, 16, 32]); });
  M.pillow = mk((b) => b.solid(-0.3, 0, -0.18, 0.3, 0.13, 0.18, T.pillow, [0, 0, 32, 16]));
  M.blanket = mk((b) => b.solid(-0.22, 0, -0.16, 0.22, 0.14, 0.16, T.blanketStack, [0, 0, 64, 12]));
  M.box = mk((b) => b.solid(-0.1, 0, -0.07, 0.1, 0.1, 0.07, T.suppliesBox, [0, 0, 20, 24]));
  M.tp = mk((b) => { b.solid(-0.05, 0, -0.05, 0.05, 0.11, 0.05, T.white, [0, 0, 16, 16]); b.solid(0.06, 0, -0.05, 0.16, 0.11, 0.05, T.white, [0, 0, 16, 16]); });
  M.card = mk((b) => b.solid(-0.043, 0, -0.027, 0.043, 0.002, 0.027, T.binder, [0, 0, 32, 20]));
  M.slip = mk((b) => b.solid(-0.07, 0, -0.045, 0.07, 0.002, 0.045, T.paper, [0, 0, 32, 20]));
  M.receipt = mk((b) => b.solid(-0.06, 0, -0.09, 0.06, 0.002, 0.09, T.paper, [0, 0, 32, 32]));
  M.voucher = mk((b) => b.solid(-0.08, 0, -0.05, 0.08, 0.002, 0.05, T.regCards, [0, 0, 32, 20]));
  M.bulb = mk((b) => { b.solid(-0.03, 0, -0.03, 0.03, 0.09, 0.03, T.white, [0, 0, 8, 8]); b.solid(-0.015, 0.09, -0.015, 0.015, 0.12, 0.015, T.chrome, [0, 0, 8, 8]); });
  M.batteries = mk((b) => b.solid(-0.04, 0, -0.03, 0.04, 0.05, 0.03, T.suppliesBox, [42, 34, 60, 54]));
  M.plunger = mk((b) => { b.solid(-0.07, 0, -0.07, 0.07, 0.08, 0.07, T.plunger, [0, 0, 16, 16]); b.solid(-0.012, 0.08, -0.012, 0.012, 0.6, 0.012, T.wood, [0, 0, 8, 32]); });
  M.coffee = mk((b) => b.solid(-0.1, 0, -0.07, 0.1, 0.15, 0.07, T.pantryStock, [2, 2, 21, 20]));
  M.decaf = mk((b) => b.solid(-0.1, 0, -0.07, 0.1, 0.15, 0.07, T.pantryStock, [23, 2, 42, 20]));
  M.waffleMix = mk((b) => b.solid(-0.1, 0, -0.07, 0.1, 0.2, 0.07, T.pantryStock, [44, 2, 63, 20]));
  M.oj = mk((b) => b.solid(-0.05, 0, -0.05, 0.05, 0.14, 0.05, T.pantryStock, [2, 23, 21, 41]));
  M.tray = mk((b) => b.box(-0.22, 0, -0.16, 0.22, 0.06, 0.16, { all: { tex: T.metal, uv: [0, 0, 16, 4] }, py: { tex: T.muffins, uv: [0, 0, 32, 32] } }));
  M.cereal = mk((b) => b.solid(-0.2, 0, -0.08, 0.2, 0.2, 0.08, T.cereal, [0, 0, 64, 32]));
  M.newsBundle = mk((b) => b.box(-0.2, 0, -0.15, 0.2, 0.18, 0.15, { all: { tex: T.newsBundle, uv: [0, 0, 32, 16] }, py: { tex: T.newsBundle, uv: [0, 0, 32, 32] } }));
  M.newspapers = mk((b) => b.box(-0.2, 0, -0.15, 0.2, 0.12, 0.15, { all: { tex: T.white, uv: [0, 0, 16, 16] }, py: { tex: T.newspaper, uv: [0, 0, 64, 64] } }));
  M.trashBag = mk((b) => b.solid(-0.2, 0, -0.2, 0.2, 0.4, 0.2, T.bag, [0, 0, 16, 16]));
  M.mop = mk((b) => { b.solid(-0.1, 0, -0.04, 0.1, 0.12, 0.04, T.mop, [0, 0, 16, 16]); b.solid(-0.012, 0.12, -0.012, 0.012, 1.2, 0.012, T.wood, [0, 0, 8, 32]); });
  M.cash = mk((b) => {
    for (let i = 0; i < 3; i++) b.solid(-0.075, i * 0.004, -0.033, 0.075, i * 0.004 + 0.003, 0.033, T.car.green ? T.car.green.top : T.white, [0, 0, 16, 16]);
  });
  M.remote = mk((b) => b.solid(-0.025, 0, -0.08, 0.025, 0.02, 0.08, T.plasticBlack, [0, 0, 16, 16]));
  M.lostItem = mk((b) => b.solid(-0.08, 0, -0.05, 0.08, 0.07, 0.05, T.vinylBrown, [0, 0, 32, 32]));
  M.rollaway = mk((b) => {
    // folded in half on its frame, on casters
    b.solid(-0.48, 0.08, -0.12, 0.48, 1.35, 0.12, T.mattress, [0, 0, 32, 32]);
    b.solid(-0.5, 0.06, -0.2, 0.5, 0.1, 0.2, T.chrome, [0, 0, 16, 8]);
    for (const x of [-0.45, 0.45]) b.solid(x - 0.03, 0, -0.18, x + 0.03, 0.08, 0.18, T.plasticBlack, [0, 0, 8, 8]);
  });
  M.bucket = mk((b) => { b.solid(-0.2, 0, -0.16, 0.2, 0.32, 0.16, T.bucket, [0, 0, 32, 16]); b.solid(-0.21, 0.25, -0.02, 0.21, 0.3, 0.02, T.chrome, [0, 0, 8, 8]); });
  M.plate = mk((b) => b.solid(-0.11, 0, -0.11, 0.11, 0.015, 0.11, T.plates, [0, 0, 16, 16]));
  return M;
}

export { panel, post, F_EMIT, F_BLEND };
