/* ============================================================
   build.js -- the Starlite Motor Lodge, built once at boot.

   Final Rental built the whole store into one static mesh with one
   draw call. That does not scale to a motel: the office, two wings
   of two floors, a north block, a pool and an acre of asphalt. So
   the property is built into chunks, each with its own bounds, and
   the renderer throws away whatever is behind the camera or lost in
   the dark. Room interiors are their own meshes and are only drawn
   when you could see into them.

   The building methods are Final Rental's: subdivided walls, floors
   laid a tile at a time, variants dealt out by hash, vertex light
   baked from the lights that can reach each surface.
   ============================================================ */
import { F_EMIT, F_BLEND, F_DOUBLE } from '../../engine/raster.js';
import {
  OFFICE, LOBBY, DESK, BREAKFAST, BACKOFFICE, PANTRY, ARCH, WEST, EAST, NORTH, POOL, POOL_GATE,
  POOL_GATE_N, DUMPSTER, SIGN_POS, STAIRS, ROOMS, FLOOR2, ROOM_W, ROOM_H, LAUNDRY, MAINT, ALCOVE,
  DESK_PROPS, BOARD, LINEN, SUPPLY, MGR_DESK, PANTRY_SHELF, FRIDGE, BFAST_COUNTER, STATIONS, BTABLES,
  SEATS, NEWS_RACK, BTRASH, ICE_MACHINE, VENDING, POLES, HIGHWAY,
} from './layout.js';
import { officeLight, outdoorLight, utilityLight } from './lighting.js';
import { XBuilder, wall, wall2, floor, ceiling, sign, panel, post, hash2 } from './geo.js';
import { buildRoomInterior, buildRoomFacade, buildCurtainMesh, buildRoomDoorMesh } from './roombuild.js';
import {
  chair, table, armchair, lounger, vendingMachine, iceMachine, washer, buildWallTv, buildItemMeshes,
} from './props.js';
import { buildSolids } from './collision.js';

export function buildWorld(T) {
  const chunks = [];
  const add = (name, mb, opts = {}) => {
    const mesh = mb.build();
    if (!mesh.count) return null;
    const c = { name, mesh, ...opts };
    chunks.push(c);
    return c;
  };

  /* ---------------- the lot, in quarters so it can be culled ---------------- */
  const lotQ = [
    ['lotSW', -24, 0, -17.6, 11.2], ['lotSE', 0, 24, -17.6, 11.2],
    ['lotNW', -24, 0, 11.2, 40.6], ['lotNE', 0, 24, 11.2, 40.6],
  ];
  for (const [name, x0, x1, z0, z1] of lotQ) {
    const mb = new XBuilder(); mb.light = outdoorLight;
    buildLot(mb, T, x0, x1, z0, z1);
    add(name, mb);
  }
  { const mb = new XBuilder(); mb.light = outdoorLight; buildHighway(mb, T); add('highway', mb); }
  { const mb = new XBuilder(); mb.light = outdoorLight; buildCurbs(mb, T); add('curbs', mb); }

  /* ---------------- the office ---------------- */
  { const mb = new XBuilder(); mb.light = outdoorLight; buildOfficeExterior(mb, T); add('officeExt', mb); }
  { const mb = new XBuilder(); mb.light = officeLight; buildLobby(mb, T); add('lobby', mb, { indoor: true }); }
  { const mb = new XBuilder(); mb.light = officeLight; buildBreakfastRoom(mb, T); add('breakfast', mb, { indoor: true }); }
  { const mb = new XBuilder(); mb.light = officeLight; buildBackRooms(mb, T); add('back', mb, { indoor: true }); }

  /* ---------------- the wings ---------------- */
  { const mb = new XBuilder(); mb.light = outdoorLight; buildWing(mb, T, 'W'); add('westExt', mb); }
  { const mb = new XBuilder(); mb.light = outdoorLight; buildWing(mb, T, 'E'); add('eastExt', mb); }
  { const mb = new XBuilder(); mb.light = outdoorLight; buildNorth(mb, T); add('northExt', mb); }
  { const mb = new XBuilder(); mb.light = outdoorLight; for (const s of STAIRS) buildStair(mb, T, s); add('stairs', mb); }
  buildUtilityInteriors(T, add);

  /* ---------------- the pool, the poles, the sign, the far side ---------------- */
  { const mb = new XBuilder(); mb.light = outdoorLight; buildPool(mb, T); add('pool', mb); }
  { const mb = new XBuilder(); mb.light = outdoorLight; buildPoles(mb, T); add('poles', mb); }
  { const mb = new XBuilder(); mb.light = outdoorLight; buildSign(mb, T); add('sign', mb, { always: true }); }
  { const mb = new XBuilder(); mb.light = outdoorLight; buildFarSide(mb, T); add('far', mb, { always: true }); }

  /* ---------------- room interiors ---------------- */
  const roomMeshes = {};
  for (const r of ROOMS) roomMeshes[r.no] = buildRoomInterior(T, r);

  /* ---------------- dynamic pieces ---------------- */
  const dyn = {
    roomDoor: buildRoomDoorMesh(T, false),
    roomDoorUp: buildRoomDoorMesh(T, true),
    glassDoor: leafMesh(T, 'glass'),
    interiorDoor: leafMesh(T, 'interior'),
    steelDoor: leafMesh(T, 'steel'),
    gate: gateMesh(T),
    curtain: buildCurtainMesh(T),
    tv: buildWallTv(T),
    backdrop: backdropMesh(T),
    poolWater: poolWaterMesh(T),
    items: buildItemMeshes(T),
  };

  return { chunks, roomMeshes, dyn, solids: buildSolids(), T };
}

/* ============================================================
   THE LOT
   ============================================================ */
/** What the ground is at a point: asphalt, a stall line, grass, or nothing to build. */
function groundAt(cx, cz) {
  if (cz < -16.2) return 'grass';                                           // the verge
  if (cx > OFFICE.x0 - 0.2 && cx < OFFICE.x1 + 0.2 && cz > OFFICE.z0 - 0.2 && cz < 0) return null;
  if (cx < WEST.walk && cx > WEST.back - 0.2 && cz > WEST.z0 && cz < 29.2) return null;
  if (cx > EAST.walk && cx < EAST.back + 0.2 && cz > 7.6 && cz < EAST.zTop) return null;
  if (cz > NORTH.walkZ && cx > NORTH.x0 - 0.1 && cx < NORTH.x1 + 0.1) return null;
  if (cz > NORTH.back) return 'grass';
  if (cx < WEST.back - 0.4 || cx > EAST.back + 0.4) return 'grass';
  if (cx > POOL.fence.x0 && cx < POOL.fence.x1 && cz > POOL.fence.z0 && cz < POOL.fence.z1) return null;
  return 'asphalt';
}

function buildLot(mb, T, x0, x1, z0, z1) {
  const CX = 2.0, CZ = 1.8;
  for (let x = x0; x < x1 - 0.01; x += CX) {
    for (let z = z0; z < z1 - 0.01; z += CZ) {
      const cx = x + CX / 2, cz = z + CZ / 2;
      const g = groundAt(cx, cz);
      if (!g) continue;
      let t;
      if (g === 'grass' || g === 'grassBack') t = { tex: T.grass };
      else {
        // stall lines, painted into the tile at the stall boundaries
        const westRow = cx > -12 && cx < -6 && cz > WEST.z0 && cz < 29.2;
        const eastRow = cx > 6 && cx < 12 && cz > 7.6 && cz < EAST.zTop;
        const onW = westRow && Math.abs(((z - WEST.z0) / 3.6) - Math.round((z - WEST.z0) / 3.6)) < 0.01;
        const onE = eastRow && Math.abs(((z - 7.6) / 3.6) - Math.round((z - 7.6) / 3.6)) < 0.01;
        if (onW || onE) t = { tex: T.stallLineZ, noFlip: true };
        else t = { tex: T.asphaltSet[hash2(cx * 3.3, Math.round(cz * 7)) % T.asphaltSet.length] };
      }
      const y = g === 'asphalt' ? -0.12 : -0.14;
      floor(mb, x, z, x + CX, z + CZ, y, t, CX);
    }
  }
}

/** The step up from the lot to every walk and building edge. */
function buildCurbs(mb, T) {
  const curb = (ax, az, bx, bz) => wall(mb, ax, az, bx, bz, -0.12, 0.0, T.curb, { cell: 1.5 });
  // west walk: its lot edge faces +x
  curb(WEST.walk, 29.2, WEST.walk, WEST.z0);
  curb(WEST.walk, WEST.z0, WEST.facade, WEST.z0);
  curb(WEST.facade, 29.2, WEST.walk, 29.2);
  curb(EAST.facade, 7.6, EAST.walk, 7.6);
  // east walk: its lot edge faces -x
  curb(EAST.walk, 7.6, EAST.walk, EAST.zTop);
  curb(EAST.walk, EAST.zTop, EAST.facade, EAST.zTop);
  // north covered walk
  curb(NORTH.x1 + 0.1, NORTH.walkZ, NORTH.x0 - 0.1, NORTH.walkZ);
  // pool deck
  const f = POOL.fence;
  curb(f.x1, f.z0, f.x0, f.z0); curb(f.x0, f.z0, f.x0, f.z1); curb(f.x1, f.z1, f.x1, f.z0);
  // walks themselves
  floor(mb, WEST.facade, WEST.z0, WEST.walk, 29.2, 0, (i, j) => (j % 5 === 2 ? T.walkStain : T.walk), 1.0);
  floor(mb, EAST.walk, 7.6, EAST.facade, EAST.zTop, 0, (i, j) => (j % 6 === 3 ? T.walkStain : T.walk), 1.0);
  floor(mb, NORTH.x0 - 0.1, NORTH.walkZ, NORTH.x1 + 0.1, NORTH.facade, 0, T.walk, 1.5);
  // the dumpster pad behind the east stairs
  floor(mb, DUMPSTER.x0 - 0.4, DUMPSTER.z0 - 0.4, DUMPSTER.x1 + 0.4, DUMPSTER.z1 + 0.4, -0.1, T.gravel, 1.2);
}

function buildHighway(mb, T) {
  const X0 = -64, X1 = 64, CX = 4;
  for (let x = X0; x < X1; x += CX) {
    floor(mb, x, HIGHWAY.z0, x + CX, -22.4, -0.16, { tex: T.road }, CX);
    floor(mb, x, -22.4, x + CX, -19.2, -0.16, { tex: T.roadLine, noFlip: true, uv: [0, 64, 64, 0] }, CX);
    floor(mb, x, -19.2, x + CX, HIGHWAY.z1, -0.16, { tex: T.road }, CX);
    // the field across the road, and the verge on this side
    floor(mb, x, -40, x + CX, HIGHWAY.z0, -0.18, T.grass, CX);
    floor(mb, x, HIGHWAY.z1, x + CX, -17.6, -0.15, (x > 7 && x < 13) || (x > -13 && x < -7) ? T.road : T.grass, CX);
  }
  // the grass round the lot, out to the treeline
  floor(mb, -64, -17.6, -24, 56, -0.15, T.grass, 4);
  floor(mb, 24, -17.6, 64, 56, -0.15, T.grass, 4);
  floor(mb, -24, 40.6, 24, 56, -0.15, T.grass, 4);
}

/* ============================================================
   THE OFFICE
   ============================================================ */
function buildOfficeExterior(mb, T) {
  const O = OFFICE, TOP = 2.9, FASCIA = 3.45;
  // breakfast room front, with two windows onto the court
  wall(mb, BREAKFAST.x0, 0.0, BREAKFAST.x1, 0.0, 0, TOP, T.stuccoSet, {
    holes: [{ a: 0.8, b: 2.9, y0: 0.9, y1: 2.1 }, { a: 3.9, b: 6.0, y0: 0.9, y1: 2.1 }],
  });
  for (const [a, b] of [[0.8, 2.9], [3.9, 6.0]]) {
    const xa = BREAKFAST.x0 + a, xb = BREAKFAST.x0 + b;
    mb.solid(xa - 0.05, 0.84, -0.12, xb + 0.05, 0.9, 0.1, T.post, [0, 0, 16, 8]);
    mb.solid(xa - 0.05, 2.1, -0.12, xb + 0.05, 2.15, 0.08, T.bronze, [0, 0, 16, 8]);
    sign(mb, (xa + xb) / 2, 0.9, -0.05, xb - xa, 1.2, 0, T.glass, F_BLEND);
  }
  // west, south and east faces
  wall(mb, O.x0, O.z0, O.x0, O.z1, 0, TOP, T.stuccoSet);
  wall(mb, O.x1, O.z0, O.x0, O.z0, 0, TOP, T.stuccoSet);
  wall(mb, O.x1, O.z1, O.x1, O.z0, 0, TOP, T.stuccoSet);
  // back windows, curtained, on the outside faces only
  for (const x of [O.x0 + 3.6, O.x0 + 11.25]) {
    panel(mb, x, 1.1, O.z0 - 0.03, 1.2, 0.8, Math.PI, T.curtainDark);
    mb.solid(x - 0.65, 1.04, O.z0 - 0.1, x + 0.65, 1.1, O.z0, T.post, [0, 0, 16, 8]);
  }
  panel(mb, O.x0 - 0.03, 1.0, -9.7, 1.2, 0.8, -Math.PI / 2, T.curtainDark);
  // the storefront's header above the glass, outside face
  wall(mb, LOBBY.x0, 0.0, LOBBY.x1, 0.0, 2.35, TOP, T.stucco);
  // fascia band all the way round, and the flat roof
  const band = (ax, az, bx, bz) => wall(mb, ax, az, bx, bz, TOP, FASCIA, T.fascia, { cell: 2.0, noFlip: true });
  band(O.x0 - 0.3, O.z1 + 0.3, O.x1 + 0.3, O.z1 + 0.3);
  band(O.x1 + 0.3, O.z1 + 0.3, O.x1 + 0.3, O.z0 - 0.3);
  band(O.x1 + 0.3, O.z0 - 0.3, O.x0 - 0.3, O.z0 - 0.3);
  band(O.x0 - 0.3, O.z0 - 0.3, O.x0 - 0.3, O.z1 + 0.3);
  ceiling(mb, O.x0 - 0.3, O.z0 - 0.3, O.x1 + 0.3, O.z1 + 0.3, TOP, T.soffit, 2.0);
  floor(mb, O.x0 - 0.3, O.z0 - 0.3, O.x1 + 0.3, O.z1 + 0.3, FASCIA - 0.05, T.roof, 2.5);

  /* The canopy over the door: a porte-cochere you can pull under to
     register, lit from underneath, with OFFICE on its front edge. */
  const C = { x0: 0.0, x1: 8.2, z0: 0.0, z1: 4.8, y: 3.0, t: 0.35 };
  ceiling(mb, C.x0, C.z0, C.x1, C.z1, C.y, T.soffit, 1.6);
  floor(mb, C.x0, C.z0, C.x1, C.z1, C.y + C.t, T.roof, 2.0);
  wall(mb, C.x0, C.z1, C.x1, C.z1, C.y, C.y + C.t, T.fascia, { cell: 2.0, noFlip: true });
  wall(mb, C.x1, C.z1, C.x1, C.z0, C.y, C.y + C.t, T.fascia, { cell: 2.0, noFlip: true });
  wall(mb, C.x0, C.z0, C.x0, C.z1, C.y, C.y + C.t, T.fascia, { cell: 2.0, noFlip: true });
  post(mb, 0.25, 4.55, -0.12, C.y, 0.1, T.post);
  post(mb, 7.95, 4.55, -0.12, C.y, 0.1, T.post);
  for (const x of [1.5, 6.5]) mb.box(x - 0.2, C.y - 0.05, 1.0, x + 0.2, C.y, 1.4, { all: { tex: T.lightPanel, uv: [0, 0, 32, 32], flags: F_EMIT } });
  sign(mb, 4.1, C.y + 0.02, C.z1 + 0.02, 1.4, 0.32, 0, T.officeSign, F_EMIT);
  // front walk under the canopy, raised off the lot
  floor(mb, -8.2, 0.0, 8.2, 0.9, 0, T.walk, 1.2);
  wall(mb, -8.2, 0.9, 8.2, 0.9, -0.12, 0.0, T.curb, { cell: 1.5 });
  // the office sign board facing the highway
  panel(mb, 0.0, 1.0, OFFICE.z0 - 0.02, 2.4, 0.6, Math.PI, T.readerboard);
}

function buildLobby(mb, T) {
  const L = LOBBY, H = OFFICE.H;
  /* ---- floor: tile, with the mat inside the door as part of it ---- */
  floor(mb, L.x0, L.z0, L.x1, L.z1, 0, (i, j, cx, cz) => (cx > 3.0 && cx < 5.0 && cz > -1.35 ? { tex: T.entryMat, noFlip: true } : T.lobbyTile), 1.0);
  ceiling(mb, L.x0, L.z0, L.x1, L.z1, H, (i, j) => (hash2(i * 3.1, j) % 9 === 0 ? T.ceilingTiles[2] : T.ceilingTiles[i % 2]), 1.0);
  for (const [x, z] of [[1.6, -2.1], [5.6, -2.1], [1.6, -5.9], [5.6, -5.9]]) {
    mb.quad([x - 0.6, H - 0.02, z - 0.3], [x + 0.6, H - 0.02, z - 0.3], [x + 0.6, H - 0.02, z + 0.3], [x - 0.6, H - 0.02, z + 0.3], T.lightPanel, [0, 0, 64, 64], F_EMIT);
  }
  /* ---- walls: paneling below the rail, wallpaper above ---- */
  const paneled = (ax, az, bx, bz, holes, top = H) => {
    wall(mb, ax, az, bx, bz, 0, 1.0, T.paneling, { holes });
    wall(mb, ax, az, bx, bz, 1.0, 1.08, T.rail, { holes, noFlip: true });
    wall(mb, ax, az, bx, bz, 1.08, top, T.wallpaperSet, { holes });
  };
  // east wall, facing -x
  paneled(L.x1, L.z0, L.x1, L.z1);
  // west wall, lobby side, with the archway through to breakfast
  paneled(L.x0, L.z1, L.x0, L.z0, [{ a: L.z1 - ARCH.z1, b: L.z1 - ARCH.z0, y0: 0, y1: 2.3 }]);
  // back wall behind the desk, with the door to the back office
  paneled(L.x0, L.z0, L.x1, L.z0, [{ a: 5.25 - L.x0, b: 6.15 - L.x0, y0: 0, y1: 2.05 }]);
  mb.solid(5.18, 0, -7.06, 5.25, 2.12, -6.9, T.doorFrame, [0, 0, 8, 64]);
  mb.solid(6.15, 0, -7.06, 6.22, 2.12, -6.9, T.doorFrame, [0, 0, 8, 64]);
  mb.solid(5.18, 2.05, -7.06, 6.22, 2.12, -6.9, T.doorFrame, [0, 0, 32, 8]);
  // the arch trim
  mb.solid(L.x0 - 0.06, 0, ARCH.z0 - 0.07, L.x0 + 0.06, 2.36, ARCH.z0, T.wood, [0, 0, 8, 64]);
  mb.solid(L.x0 - 0.06, 0, ARCH.z1, L.x0 + 0.06, 2.36, ARCH.z1 + 0.07, T.wood, [0, 0, 8, 64]);
  mb.solid(L.x0 - 0.06, 2.3, ARCH.z0 - 0.07, L.x0 + 0.06, 2.38, ARCH.z1 + 0.07, T.wood, [0, 0, 64, 8]);
  // inside face of the header over the storefront
  wall(mb, L.x1, -0.05, L.x0, -0.05, 2.35, H, T.wallpaper);

  /* ---- the storefront: bronze frame, glass, the door opening ---- */
  const D0 = 3.45, D1 = 4.45;
  const mull = (x) => mb.solid(x - 0.04, 0, -0.08, x + 0.04, 2.38, 0.05, T.bronze, [0, 0, 16, 64]);
  for (const x of [L.x0 + 0.04, 1.2, 2.3, D0 - 0.04, D1 + 0.04, 5.8, 7.0, L.x1 - 0.04]) mull(x);
  mb.solid(L.x0, 2.3, -0.08, L.x1, 2.38, 0.05, T.bronze, [0, 0, 64, 8]);
  mb.solid(L.x0, 0, -0.08, D0, 0.12, 0.05, T.bronze, [0, 0, 64, 8]);
  mb.solid(D1, 0, -0.08, L.x1, 0.12, 0.05, T.bronze, [0, 0, 64, 8]);
  sign(mb, (L.x0 + D0) / 2, 0.12, -0.015, D0 - L.x0 - 0.08, 2.18, 0, T.glass, F_BLEND);
  sign(mb, (D1 + L.x1) / 2, 0.12, -0.015, L.x1 - D1 - 0.08, 2.18, 0, T.glass, F_BLEND);
  // the VACANCY sign hangs in the window, facing the court
  panel(mb, 6.5, 1.55, 0.06, 1.3, 0.32, 0, T.vacancy, F_EMIT);
  panel(mb, 6.5, 1.55, 0.02, 1.3, 0.32, Math.PI, T.dark);
  panel(mb, 1.2, 1.62, 0.07, 0.7, 0.35, 0, T.officeHours);

  /* ---- the desk ---- */
  const Dk = DESK;
  mb.box(Dk.x0, 0, Dk.z0, Dk.x1, Dk.y - 0.04, Dk.z1, {
    all: { tex: T.deskFront, uv: [0, 0, 64, 64], sub: [5, 1, true] },
    nz: { tex: T.wood, uv: [0, 0, 64, 64], sub: [5, 1, true] },
    py: null, ny: null, nx: null,
  });
  mb.box(Dk.x0, Dk.y - 0.04, Dk.z0 - 0.04, Dk.x1 + 0.05, Dk.y, Dk.z1 + 0.06, {
    all: { tex: T.wood, uv: [0, 0, 64, 8] },
    py: { tex: T.deskTop, uv: [0, 0, 64, 64], sub: [6, 1, true] }, ny: null, nx: null,
  });
  // the shelf under the counter on the clerk's side, with the phone book on it
  mb.solid(Dk.x0, 0.62, Dk.z0 - 0.35, Dk.x1, 0.66, Dk.z0, T.wood, [0, 0, 64, 8]);
  mb.solid(0.4, 0.66, -5.3, 0.75, 0.74, -5.05, T.binder, [0, 0, 32, 32]);
  // what hangs off the front of the desk, on the guest side
  panel(mb, 1.0, 0.45, Dk.z1 + 0.01, 0.62, 0.31, 0, T.checkoutSign);
  panel(mb, 3.5, 0.55, Dk.z1 + 0.01, 0.62, 0.16, 0, T.noPets);
  panel(mb, 5.4, 0.42, Dk.z1 + 0.01, 0.6, 0.6, 0, T.ratesSign);

  /* ---- things on the desk ---- */
  const P = DESK_PROPS, y = Dk.y;
  // the bell, where a guest can reach it
  mb.at(P.bell.x, y, P.bell.z, 0, (b) => {
    b.solid(-0.05, 0, -0.05, 0.05, 0.02, 0.05, T.darkMetal, [0, 0, 16, 16]);
    b.loft([{ y: 0.02, w: 0.045, d: 0.045 }, { y: 0.05, w: 0.04, d: 0.04 }, { y: 0.07, w: 0.02, d: 0.02 }],
      [[-0.7, 0.7], [0.7, 0.7], [1, -0.2], [0, -1], [-1, -0.2]], [{ tex: T.bellTex, uv: [0, 0, 16, 16] }], { top: { tex: T.bellTex, uv: [0, 0, 16, 16] } });
    b.solid(-0.004, 0.07, -0.004, 0.004, 0.085, 0.004, T.chrome, [0, 0, 8, 8]);
  });
  // the terminal: a beige CRT on the counter and the keyboard in front of it
  const t = P.terminal;
  mb.box(t.x0 + 0.05, y, t.z0, t.x1 - 0.05, y + 0.08, t.z0 + 0.34, { all: { tex: T.crtBody, uv: [0, 0, 32, 32] } });
  mb.box(t.x0, y + 0.08, t.z0 - 0.02, t.x1, y + 0.5, t.z0 + 0.36, {
    all: { tex: T.crtBody, uv: [0, 0, 32, 32] },
    nz: { tex: T.crtBezel, uv: [0, 0, 64, 64], sub: [2, 2, false] }, ny: null,
  });
  mb.box(t.x0 + 0.02, y, t.z1 - 0.22 - 0.02, t.x1 - 0.02, y + 0.03, t.z1 - 0.02 + 0.15, {
    all: { tex: T.crtBody, uv: [0, 0, 32, 8] }, py: { tex: T.keyboard, uv: [0, 0, 64, 32] },
  });
  // the desk phone: handset in its cradle on the clerk's left, keys and line buttons on the right
  const ph = P.phone;
  mb.box(ph.x0, y, ph.z0, ph.x1, y + 0.05, ph.z1, { all: { tex: T.handset, uv: [0, 0, 16, 8] } });
  mb.box(ph.x0 + 0.13, y + 0.05, ph.z0 + 0.02, ph.x1 - 0.02, y + 0.07, ph.z1 - 0.02, {
    all: { tex: T.handset, uv: [0, 0, 16, 8] }, py: { tex: T.deskPhoneTop, uv: [0, 0, 32, 32] }, ny: null,
  });
  mb.box(ph.x0 + 0.01, y + 0.05, ph.z0 + 0.02, ph.x0 + 0.12, y + 0.09, ph.z1 - 0.02, { all: { tex: T.handset, uv: [0, 0, 16, 8] }, ny: null });
  mb.box(ph.x0 - 0.005, y + 0.09, ph.z0 + 0.01, ph.x0 + 0.125, y + 0.125, ph.z1 - 0.01, { all: { tex: T.handsetDark, uv: [0, 0, 16, 8] } });
  mb.box(ph.x0 - 0.01, y + 0.1, ph.z0 + 0.0, ph.x0 + 0.13, y + 0.145, ph.z0 + 0.08, { all: { tex: T.handsetDark, uv: [0, 0, 16, 8] } });
  mb.box(ph.x0 - 0.01, y + 0.1, ph.z1 - 0.08, ph.x0 + 0.13, y + 0.145, ph.z1, { all: { tex: T.handsetDark, uv: [0, 0, 16, 8] } });
  mb.solid(ph.x0 + 0.02, y + 0.01, ph.z0 - 0.04, ph.x0 + 0.04, y + 0.02, ph.z0, T.plasticBlack, [0, 0, 8, 8]);   // the cord
  // the wake-up sheet on its clipboard, by the phone
  const wk = P.wakeup;
  mb.box(wk.x0, y, wk.z0, wk.x1, y + 0.012, wk.z1, { all: { tex: T.wood, uv: [0, 0, 16, 8] }, py: { tex: T.wakeSheet, uv: [0, 0, 32, 32] }, ny: null });
  // dot-matrix printer
  const pr = P.printer;
  mb.box(pr.x0, y, pr.z0, pr.x1, pr.y1, pr.z1, { all: { tex: T.crtBody, uv: [0, 0, 32, 16] }, py: { tex: T.printerTop, uv: [0, 0, 64, 32] } });
  // registration cards, the imprinter, the binder
  const cd = P.cards;
  mb.box(cd.x0, y, cd.z0, cd.x1, cd.y1, cd.z1, { all: { tex: T.wood, uv: [0, 0, 16, 8] }, py: { tex: T.regCards, uv: [0, 0, 32, 32] } });
  const im = P.imprinter;
  mb.box(im.x0, y, im.z0, im.x1, im.y1, im.z1, { all: { tex: T.metal, uv: [0, 0, 16, 8] }, py: { tex: T.imprinter, uv: [0, 0, 32, 32] } });
  const bd = P.binder;
  mb.box(bd.x0, y, bd.z0, bd.x1, bd.y1, bd.z1, { all: { tex: T.binder, uv: [0, 0, 32, 8] }, py: { tex: T.binder, uv: [0, 0, 32, 32] } });
  // the register: a black electronic one with a green display
  const rg = P.register;
  mb.box(rg.x0, y, rg.z0, rg.x1, y + 0.11, rg.z1, { all: { tex: T.registerBody, uv: [0, 0, 64, 20] } });
  mb.box(rg.x0 + 0.02, y + 0.11, rg.z0 + 0.12, rg.x1 - 0.02, y + 0.2, rg.z1, { all: { tex: T.registerBody, uv: [0, 0, 64, 16] }, py: { tex: T.registerKeys, uv: [0, 0, 64, 64] } });
  mb.box(rg.x0 + 0.1, y + 0.2, rg.z0 + 0.13, rg.x1 - 0.1, y + 0.32, rg.z0 + 0.2, {
    all: { tex: T.registerBody, uv: [0, 0, 32, 16] },
    pz: { tex: T.registerDisplay, uv: [0, 0, 32, 16], flags: F_EMIT }, nz: { tex: T.registerDisplay, uv: [0, 0, 32, 16], flags: F_EMIT },
  });
  // the key drop on the guest side of the counter
  const kd = P.keydrop;
  mb.box(kd.x0, y, kd.z0, kd.x1, kd.y1, kd.z1, { all: { tex: T.wood, uv: [0, 0, 32, 32] }, pz: { tex: T.keyDrop, uv: [0, 0, 32, 32] } });
  // a stapler, a cup of pens, a stack of rate cards
  mb.solid(3.95, y, -4.45, 4.05, y + 0.12, -4.35, T.vinylBrown, [0, 0, 16, 16]);
  // the stool
  const st = P.stool;
  mb.at(st.x, 0, st.z, 0, (b) => {
    b.solid(-0.02, 0, -0.02, 0.02, 0.7, 0.02, T.chrome, [0, 0, 8, 8]);
    b.solid(-0.22, 0, -0.22, 0.22, 0.03, 0.22, T.darkMetal, [0, 0, 16, 16]);
    b.solid(-0.19, 0.7, -0.19, 0.19, 0.76, 0.19, T.vinylBrown, [0, 0, 32, 32]);
  });

  /* ---- behind the desk: the key rack frame, the calendar, the clock ---- */
  const B = BOARD;
  mb.solid(B.x0 - 0.05, B.y0 - 0.05, B.z - 0.03, B.x1 + 0.05, B.y1 + 0.05, B.z, T.wood, [0, 0, 64, 16]);
  panel(mb, 4.6, 1.5, -6.94, 0.44, 0.44, 0, T.calendar);
  panel(mb, 4.6, 2.15, -6.94, 0.34, 0.34, 0, T.clockFace);
  panel(mb, -0.35, 1.3, -6.94, 0.9, 0.9, 0, T.corkboard);
  // a low filing cabinet and a coffee maker of the clerk's own
  mb.solid(6.5, 0, -6.95, 7.0, 0.72, -6.4, T.fileCab, [0, 0, 32, 40]);
  mb.solid(6.6, 0.72, -6.9, 6.85, 1.0, -6.62, T.coffeeMaker, [0, 0, 32, 40]);

  /* ---- the guest side ---- */
  // two armchairs against the east wall, and a table of brochures between them
  mb.at(7.45, 0, -3.5, -Math.PI / 2, (b) => armchair(b, T));
  mb.at(7.45, 0, -2.2, -Math.PI / 2, (b) => armchair(b, T));
  mb.solid(7.3, 0, -3.0, 7.9, 0.55, -2.7, T.wood, [0, 0, 32, 16]);
  // the brochure rack by the door
  mb.box(7.55, 0, -6.2, 7.95, 1.5, -5.2, { all: { tex: T.wood, uv: [0, 0, 16, 64] }, nx: { tex: T.brochures, uv: [0, 0, 64, 64] } });
  // a potted palm in the corner that has never once been watered by anybody on nights
  mb.at(7.55, 0, -0.5, 0, (b) => {
    b.solid(-0.2, 0, -0.2, 0.2, 0.4, 0.2, T.pot, [0, 0, 16, 16]);
    sign(b, 0, 0.35, 0, 0.9, 1.1, 0.4, T.plant);
    sign(b, 0, 0.35, 0, 0.9, 1.1, 2.0, T.plant);
  });
  // the lobby coffee: an airpot on a little table by the arch
  mb.solid(-0.9, 0, -0.95, -0.3, 0.76, -0.35, T.wood, [0, 0, 32, 16]);
  mb.solid(-0.75, 0.76, -0.8, -0.58, 1.08, -0.62, T.darkMetal, [0, 0, 16, 16]);
  mb.solid(-0.5, 0.76, -0.75, -0.38, 0.86, -0.5, T.cups, [0, 0, 16, 16]);
  // the rates, framed on the wall by the door
  panel(mb, L.x1 - 0.02, 1.35, -1.3, 0.5, 0.5, -Math.PI / 2, T.ratesSign);
}

function buildBreakfastRoom(mb, T) {
  const B = BREAKFAST, H = OFFICE.H;
  floor(mb, B.x0, B.z0, B.x1, B.z1, 0, { tex: T.bfastFloor, noFlip: true }, 1.0);
  ceiling(mb, B.x0, B.z0, B.x1, B.z1, H, (i, j) => T.ceilingTiles[(i + j) % 2], 1.0);
  for (const [x, z] of [[-5.6, -2.4], [-2.8, -2.4], [-5.6, -5.8], [-2.8, -5.8]]) {
    mb.quad([x - 0.6, H - 0.02, z - 0.3], [x + 0.6, H - 0.02, z - 0.3], [x + 0.6, H - 0.02, z + 0.3], [x - 0.6, H - 0.02, z + 0.3], T.lightPanel, [0, 0, 64, 64], F_EMIT);
  }
  // walls: north with its windows, west, south with the pantry door, east with the arch
  wall(mb, B.x1, -0.12, B.x0, -0.12, 0, H, T.bfastWall, { holes: [{ a: 1.0, b: 3.1, y0: 0.9, y1: 2.1 }, { a: 4.1, b: 6.2, y0: 0.9, y1: 2.1 }] });
  wall(mb, B.x0, -0.12, B.x0, B.z0, 0, H, T.bfastWall);
  wall(mb, B.x0, B.z0, B.x1, B.z0, 0, H, T.bfastWall, { holes: [{ a: 5.55, b: 6.45, y0: 0, y1: 2.05 }] });
  wall(mb, B.x1, B.z0, B.x1, -0.12, 0, H, T.bfastWall, { holes: [{ a: ARCH.z0 - B.z0, b: ARCH.z1 - B.z0, y0: 0, y1: 2.3 }] });
  mb.solid(-2.52, 0, -8.08, -2.45, 2.12, -7.92, T.doorFrame, [0, 0, 8, 64]);
  mb.solid(-1.55, 0, -8.08, -1.48, 2.12, -7.92, T.doorFrame, [0, 0, 8, 64]);
  mb.solid(-2.52, 2.05, -8.08, -1.48, 2.12, -7.92, T.doorFrame, [0, 0, 32, 8]);
  // window sills inside
  for (const [a, b] of [[1.0, 3.1], [4.1, 6.2]]) mb.solid(B.x1 - b, 0.85, -0.3, B.x1 - a, 0.9, -0.1, T.woodLight, [0, 0, 32, 8]);

  /* ---- the breakfast bar along the west wall ---- */
  const C = BFAST_COUNTER;
  mb.box(C.x0, 0, C.z0, C.x1, C.y - 0.04, C.z1, {
    all: { tex: T.deskFront, uv: [0, 0, 64, 64], sub: [1, 1, true] },
    px: { tex: T.deskFront, uv: [0, 0, 64, 64], sub: [6, 1, true] }, ny: null, nx: null,
  });
  mb.box(C.x0, C.y - 0.04, C.z0 - 0.03, C.x1 + 0.04, C.y, C.z1 + 0.03, { all: { tex: T.wood, uv: [0, 0, 64, 8] }, py: { tex: T.formica, uv: [0, 0, 64, 64], sub: [1, 6, true] } });
  // backsplash and the sign
  wall(mb, C.x0 + 0.01, C.z1, C.x0 + 0.01, C.z0, C.y, C.y + 0.5, T.bathTile);
  panel(mb, C.x0 + 0.02, 1.7, -4.3, 1.2, 0.6, Math.PI / 2, T.bfastSign);
  const y = C.y;
  const at = (id) => STATIONS.find((s) => s.id === id).z;
  // coffee brewers: regular and decaf, black with the warming plates
  for (const id of ['coffee', 'decaf']) {
    const z = at(id);
    mb.box(-7.9, y, z - 0.22, -7.55, y + 0.62, z + 0.22, { all: { tex: T.plasticBlack, uv: [0, 0, 16, 16] }, px: { tex: T.coffeeMaker, uv: [0, 0, 32, 64] } });
    mb.solid(-7.55, y + 0.5, z - 0.2, -7.3, y + 0.62, z + 0.2, T.plasticBlack, [0, 0, 16, 16]);
  }
  // hot water: a tall steel urn
  { const z = at('water'); mb.solid(-7.85, y, z - 0.15, -7.55, y + 0.55, z + 0.15, T.chrome, [0, 0, 16, 16]); mb.solid(-7.55, y + 0.12, z - 0.02, -7.48, y + 0.16, z + 0.02, T.darkMetal, [0, 0, 8, 8]); }
  // the toaster next to the bagels
  { const z = at('bagels') - 0.28; mb.solid(-7.8, y, z - 0.12, -7.52, y + 0.2, z + 0.12, T.chrome, [0, 0, 16, 16]); }
  // plates, cups, napkins, utensils, the condiment caddy at the end
  mb.solid(-7.9, y, -1.35, -7.62, y + 0.14, -1.05, T.plates, [0, 0, 16, 16]);
  mb.box(-7.62, y, -1.3, -7.38, y + 0.11, -1.1, { all: { tex: T.cups, uv: [0, 0, 16, 16] } });
  mb.solid(-7.9, y, -7.35, -7.6, y + 0.08, -7.08, T.napkins, [0, 0, 16, 16]);
  mb.box(-7.6, y, -7.3, -7.3, y + 0.08, -7.05, { all: { tex: T.condiments, uv: [0, 0, 32, 16] } });
  // the cereal rack, a wire thing on the counter
  { const z = at('cereal'); mb.solid(-7.92, y, z - 0.3, -7.85, y + 0.5, z + 0.3, T.chrome, [0, 0, 8, 16]); }
  // trash can, and the newspaper rack
  mb.box(BTRASH.x0, 0, BTRASH.z0, BTRASH.x1, 0.8, BTRASH.z1, { all: { tex: T.trashCan, uv: [0, 0, 32, 32] }, py: { tex: T.darkMetal, uv: [0, 0, 16, 16] } });
  mb.solid(NEWS_RACK.x0, 0, NEWS_RACK.z0, NEWS_RACK.x1, 0.03, NEWS_RACK.z1, T.chrome, [0, 0, 16, 16]);
  mb.solid(NEWS_RACK.x0, 0.03, NEWS_RACK.z0, NEWS_RACK.x0 + 0.03, 0.7, NEWS_RACK.z1, T.chrome, [0, 0, 8, 16]);
  mb.solid(NEWS_RACK.x1 - 0.03, 0.03, NEWS_RACK.z0, NEWS_RACK.x1, 0.7, NEWS_RACK.z1, T.chrome, [0, 0, 8, 16]);
  mb.solid(NEWS_RACK.x0, 0.5, NEWS_RACK.z0 + 0.05, NEWS_RACK.x1, 0.53, NEWS_RACK.z1 - 0.05, T.chrome, [0, 0, 16, 8]);

  /* ---- tables and chairs ---- */
  for (const t of BTABLES) mb.at(t.x, 0, t.z, 0, (b) => table(b, T, 0.8, 0.8, 0.74));
  for (const s of SEATS) mb.at(s.x, 0, s.z, s.yaw, (b) => chair(b, T));
  // the wall bracket the TV hangs from is part of its mesh; a plant, a clock
  panel(mb, -1.1, 1.9, -7.94, 0.34, 0.34, 0, T.clockFace);
  mb.at(-7.55, 0, -0.55, 0, (b) => { b.solid(-0.2, 0, -0.2, 0.2, 0.4, 0.2, T.pot, [0, 0, 16, 16]); sign(b, 0, 0.35, 0, 0.8, 1.0, 0.7, T.plant); sign(b, 0, 0.35, 0, 0.8, 1.0, 2.3, T.plant); });
}

function buildBackRooms(mb, T) {
  const BO = BACKOFFICE, P = PANTRY, H = OFFICE.H;
  /* ---- the back office ---- */
  floor(mb, BO.x0, BO.z0, BO.x1, BO.z1, 0, T.officeCarpet, 1.0);
  ceiling(mb, BO.x0, BO.z0, BO.x1, BO.z1, H, (i, j) => T.ceilingTiles[(i * 3 + j) % 3], 1.0);
  for (const [x, z] of [[1.8, -10.6], [5.8, -10.6]]) mb.quad([x - 0.6, H - 0.02, z - 0.3], [x + 0.6, H - 0.02, z - 0.3], [x + 0.6, H - 0.02, z + 0.3], [x - 0.6, H - 0.02, z + 0.3], T.lightPanel, [0, 0, 64, 64], F_EMIT);
  wall(mb, BO.x1, BO.z1, BO.x0, BO.z1, 0, H, T.plainWall, { holes: [{ a: BO.x1 - 6.15, b: BO.x1 - 5.25, y0: 0, y1: 2.05 }] });
  wall(mb, BO.x1, BO.z0, BO.x1, BO.z1, 0, H, T.plainWall);
  wall(mb, BO.x0, BO.z0, BO.x1, BO.z0, 0, H, T.plainWall);
  wall(mb, BO.x0, BO.z1, BO.x0, BO.z0, 0, H, T.plainWall, { holes: [{ a: BO.z1 - (-11.1), b: BO.z1 - (-12.0), y0: 0, y1: 2.05 }] });
  panel(mb, BO.x0 + 4.25, 1.1, BO.z0 + 0.03, 1.2, 0.8, 0, T.curtainDark);
  // the linen shelves: towels, pillows, blankets, the soaps
  const Ln = LINEN;
  mb.box(Ln.x0, 0, Ln.z0, Ln.x1, Ln.top, Ln.z1, { all: { tex: T.steelShelf, uv: [0, 0, 64, 64] }, pz: null, ny: null });
  const shelf = (x0, x1, y0, y1, tex) => mb.box(x0, y0, Ln.z0 + 0.02, x1, y1, Ln.z1, { all: { tex: T.steelShelf, uv: [0, 0, 16, 8] }, pz: { tex, uv: [0, 0, 64, 64] }, ny: null, nz: null });
  shelf(Ln.x0 + 0.05, Ln.x0 + 1.2, 0.1, 0.62, T.linenStack);
  shelf(Ln.x0 + 0.05, Ln.x0 + 1.2, 0.72, 1.24, T.linenStack);
  shelf(Ln.x0 + 1.25, Ln.x0 + 2.4, 0.1, 0.62, T.blanketStack);
  shelf(Ln.x0 + 1.25, Ln.x0 + 2.4, 0.72, 1.24, T.pillowStack);
  shelf(Ln.x0 + 2.45, Ln.x1 - 0.05, 0.1, 0.62, T.suppliesBox);
  shelf(Ln.x0 + 2.45, Ln.x1 - 0.05, 0.72, 1.24, T.pillowStack);
  shelf(Ln.x0 + 0.05, Ln.x1 - 0.05, 1.34, 1.9, T.cardboard);
  // supply cabinet: bulbs, batteries, remotes, the lost and found box
  mb.box(SUPPLY.x0, 0, SUPPLY.z0, SUPPLY.x1, SUPPLY.top, SUPPLY.z1, { all: { tex: T.fileCab, uv: [0, 0, 32, 64] }, pz: { tex: T.suppliesBox, uv: [0, 0, 64, 64] }, ny: null });
  // the manager's desk with the note on it
  const MD = MGR_DESK;
  mb.box(MD.x0, 0, MD.z0, MD.x1, MD.y, MD.z1, { all: { tex: T.wood, uv: [0, 0, 64, 32] }, py: { tex: T.woodLight, uv: [0, 0, 64, 32] }, ny: null });
  mb.solid(MD.x0 + 0.2, MD.y, MD.z0 + 0.1, MD.x0 + 0.5, MD.y + 0.28, MD.z0 + 0.4, T.crtBody, [0, 0, 32, 32]);
  mb.at((MD.x0 + MD.x1) / 2, 0, MD.z1 + 0.5, Math.PI, (b) => chair(b, T, T.vinylBrown));
  // filing cabinets, the safe, the time clock, the breaker panel, the corkboard
  mb.solid(7.4, 0, -8.8, 7.95, 1.3, -7.8, T.fileCab, [0, 0, 32, 64]);
  mb.solid(7.3, 0, -12.2, 7.95, 0.8, -11.5, T.safe, [0, 0, 32, 32]);
  panel(mb, 1.0, 1.35, -7.07, 0.32, 0.32, Math.PI, T.timeclock);
  panel(mb, 2.2, 1.0, -7.07, 0.34, 0.9, Math.PI, T.breakerBox);
  panel(mb, 3.6, 1.2, -7.07, 1.0, 0.8, Math.PI, T.corkboard);
  panel(mb, BO.x1 - 0.02, 1.3, -11.0, 0.5, 0.5, -Math.PI / 2, T.calendar);

  /* ---- the pantry ---- */
  floor(mb, P.x0, P.z0, P.x1, P.z1, 0, { tex: T.pantryFloor, noFlip: true }, 1.0);
  ceiling(mb, P.x0, P.z0, P.x1, P.z1, H, T.ceilingTiles[0], 1.0);
  mb.quad([-5.2, H - 0.02, -11.5], [-3.9, H - 0.02, -11.5], [-3.9, H - 0.02, -10.9], [-5.2, H - 0.02, -10.9], T.lightPanel, [0, 0, 64, 64], F_EMIT);
  wall(mb, P.x1, P.z1, P.x0, P.z1, 0, H, T.plainWall, { holes: [{ a: P.x1 - (-1.55), b: P.x1 - (-2.45), y0: 0, y1: 2.05 }] });
  wall(mb, P.x1, P.z0, P.x1, P.z1, 0, H, T.plainWall, { holes: [{ a: -12.0 - P.z0, b: -11.1 - P.z0, y0: 0, y1: 2.05 }] });
  wall(mb, P.x0, P.z0, P.x1, P.z0, 0, H, T.plainWall);
  wall(mb, P.x0, P.z1, P.x0, P.z0, 0, H, T.plainWall);
  panel(mb, P.x0 + 3.6, 1.1, P.z0 + 0.03, 1.2, 0.8, 0, T.curtainDark);
  mb.solid(-1.08, 0, -11.12, -0.92, 2.12, -11.05, T.doorFrame, [0, 0, 8, 64]);
  mb.solid(-1.08, 0, -12.05, -0.92, 2.12, -11.98, T.doorFrame, [0, 0, 8, 64]);
  // shelving full of breakfast
  const S = PANTRY_SHELF;
  mb.box(S.x0, 0, S.z0, S.x1, S.top, S.z1, { all: { tex: T.steelShelf, uv: [0, 0, 64, 64] }, px: null, ny: null });
  for (let k = 0; k < 3; k++) {
    const y0 = 0.12 + k * 0.62;
    mb.box(S.x0 + 0.02, y0, S.z0 + 0.05, S.x1, y0 + 0.5, S.z1 - 0.05, { all: { tex: T.steelShelf, uv: [0, 0, 16, 8] }, px: { tex: T.pantryStock, uv: [0, 0, 64, 64], sub: [3, 1, true] }, nx: null, ny: null });
  }
  // fridge, the prep counter and its sink, the mop sink in the corner
  const F = FRIDGE;
  mb.box(F.x0, 0, F.z0, F.x1, F.top, F.z1, { all: { tex: T.fridge, uv: [0, 0, 32, 64] }, ny: null });
  mb.box(-6.9, 0, -13.95, -4.2, 0.9, -13.35, { all: { tex: T.deskFront, uv: [0, 0, 64, 64] }, py: { tex: T.formica, uv: [0, 0, 64, 32] }, ny: null });
  mb.solid(-6.3, 0.9, -13.9, -5.6, 0.92, -13.4, T.sink, [0, 0, 32, 32]);
  mb.solid(-2.2, 0, -13.9, -1.3, 0.35, -13.2, T.cardboard, [0, 0, 64, 32]);
  mb.solid(-2.1, 0.35, -13.8, -1.4, 0.7, -13.3, T.cardboard, [0, 0, 64, 32]);
  panel(mb, -4.5, 1.4, -13.97, 0.5, 0.5, 0, T.calendar);
}

/* ============================================================
   THE WINGS
   ============================================================ */
/**
 * One two-storey wing: every room's face on both floors, the ground walk,
 * the upper walk and its slab, the railing, the posts, the fascia and
 * roof edge, and the ends of the building.
 */
function buildWing(mb, T, wing) {
  const rooms = ROOMS.filter((r) => r.wing === wing);
  for (const r of rooms) buildRoomFacade(mb, T, r);
  // the wing's own frame: origin at one end of the facade, +x along it, +z into the rooms
  const n = wing === 'W' ? WEST.n : EAST.n;
  const L = n * ROOM_W;
  const ox = wing === 'W' ? WEST.facade : EAST.facade;
  const oz = wing === 'W' ? WEST.z0 : EAST.zTop;
  const yaw = wing === 'W' ? -Math.PI / 2 : Math.PI / 2;
  const TOP2 = FLOOR2 + ROOM_H, ROOF = TOP2 + 0.5;
  mb.at(ox, 0, oz, yaw, (b) => {
    // upper walk: the slab, its top, its underside and its edge
    floor(b, 0, -2.0, L, 0, FLOOR2, (i, j) => ((i + j) % 7 === 3 ? T.walkStain : T.walk), 1.2);
    ceiling(b, 0, -2.0, L, 0, FLOOR2 - 0.3, T.slab, 1.2);
    wall(b, L, -2.0, 0, -2.0, FLOOR2 - 0.3, FLOOR2, T.slab, { cell: 2.0 });
    wall(b, L, 0, L, -2.0, FLOOR2 - 0.3, FLOOR2, T.slab);
    wall(b, 0, -2.0, 0, 0, FLOOR2 - 0.3, FLOOR2, T.slab);
    // railing along the edge of the upper walk
    for (let x = 0; x < L - 0.01; x += ROOM_W / 2) {
      sign(b, x + ROOM_W / 4, FLOOR2, -2.0, ROOM_W / 2, 1.0, 0, T.railing, 0, [0, 0, 64, 32]);
    }
    b.solid(0, FLOOR2 + 0.98, -2.05, L, FLOOR2 + 1.04, -1.95, T.railSolid, [0, 0, 64, 8]);
    // the end rail at the far end of the walk
    sign(b, L, FLOOR2, -1.0, 2.0, 1.0, Math.PI / 2, T.railing, 0, [0, 0, 64, 32]);
    // posts holding the whole thing up, one per party wall
    for (let i = 0; i <= n; i++) {
      const x = Math.min(L - 0.08, Math.max(0.08, i * ROOM_W));
      b.solid(x - 0.08, -0.12, -2.08, x + 0.08, FLOOR2 + 1.05, -1.92, T.post, [0, 0, 16, 64]);
    }
    // roof overhang over the upper walk: soffit, fascia, and the roof itself
    ceiling(b, 0, -2.3, L, 0, TOP2 + 0.05, T.soffit, 1.8);
    wall(b, L, -2.3, 0, -2.3, TOP2 + 0.05, ROOF, T.fascia, { cell: 2.0, noFlip: true });
    wall(b, 0, -2.3, 0, 0, TOP2 + 0.05, ROOF, T.fascia, { cell: 2.0, noFlip: true });
    wall(b, L, 0, L, -2.3, TOP2 + 0.05, ROOF, T.fascia, { cell: 2.0, noFlip: true });
    wall(b, L, 0, 0, 0, TOP2, TOP2 + 0.05, T.stucco);
    floor(b, 0, -2.3, L, 7.4, ROOF, T.roof, 3.0);
    // the ends of the building and its back
    wall(b, 0, 0, 0, 7.3, 0, ROOF, T.stuccoSet);
    wall(b, L, 7.3, L, 0, 0, ROOF, T.stuccoSet);
    wall(b, 0, 7.3, L, 7.3, 0, ROOF, T.stuccoBack, { cell: 2.4 });
  });
}

/** The north block: 114 and 115, the laundry, maintenance, and the ice alcove. */
function buildNorth(mb, T) {
  const N = NORTH;
  for (const r of ROOMS.filter((q) => q.wing === 'N')) buildRoomFacade(mb, T, r);
  const TOP = ROOM_H + 0.3, ROOF = TOP + 0.45;
  // laundry and maintenance faces
  wall(mb, LAUNDRY.x1, N.facade, LAUNDRY.x0, N.facade, 0, TOP, T.stuccoSet, { holes: [{ a: LAUNDRY.x1 - LAUNDRY.door.x1, b: LAUNDRY.x1 - LAUNDRY.door.x0, y0: 0, y1: 2.1 }, { a: 0.4, b: 1.2, y0: 1.2, y1: 1.9 }] });
  wall(mb, MAINT.x1, N.facade, MAINT.x0, N.facade, 0, TOP, T.stuccoSet, { holes: [{ a: MAINT.x1 - MAINT.door.x1, b: MAINT.x1 - MAINT.door.x0, y0: 0, y1: 2.1 }] });
  sign(mb, LAUNDRY.x1 - 0.8, 1.2, N.facade - 0.03, 0.8, 0.7, Math.PI, T.glass, F_BLEND);
  for (const [x0, x1] of [[LAUNDRY.door.x0, LAUNDRY.door.x1], [MAINT.door.x0, MAINT.door.x1]]) {
    mb.solid(x0 - 0.07, 0, N.facade - 0.03, x0, 2.16, N.facade + 0.15, T.doorFrame, [0, 0, 8, 64]);
    mb.solid(x1, 0, N.facade - 0.03, x1 + 0.07, 2.16, N.facade + 0.15, T.doorFrame, [0, 0, 8, 64]);
    mb.solid(x0 - 0.07, 2.1, N.facade - 0.03, x1 + 0.07, 2.18, N.facade + 0.15, T.doorFrame, [0, 0, 32, 8]);
  }
  panel(mb, (LAUNDRY.x0 + LAUNDRY.x1) / 2 + 0.3, 2.25, N.facade - 0.02, 1.0, 0.25, Math.PI, T.laundrySign);
  panel(mb, (MAINT.door.x0 + MAINT.door.x1) / 2, 1.55, N.facade - 0.02, 0.6, 0.15, Math.PI, T.maintSign);
  // the alcove: open at the front, header over it with ICE on it
  wall(mb, ALCOVE.x1, N.facade, ALCOVE.x0, N.facade, 2.35, TOP, T.stucco);
  panel(mb, (ALCOVE.x0 + ALCOVE.x1) / 2, 2.4, N.facade - 0.02, 0.9, 0.24, Math.PI, T.iceSign, F_EMIT);
  // covered walk: soffit, fascia, posts
  ceiling(mb, N.x0 - 0.1, N.walkZ, N.x1 + 0.1, N.facade, TOP, T.soffit, 1.5);
  wall(mb, N.x1 + 0.1, N.walkZ, N.x0 - 0.1, N.walkZ, TOP - 0.05, ROOF, T.fascia, { cell: 2.0, noFlip: true });
  for (let x = N.x0 + 0.1; x <= N.x1; x += 3.6) mb.solid(x - 0.07, 0, N.walkZ + 0.02, x + 0.07, TOP, N.walkZ + 0.16, T.post, [0, 0, 16, 64]);
  // the rest of the shell
  floor(mb, N.x0 - 0.1, N.walkZ, N.x1 + 0.1, N.back + 0.1, ROOF, T.roof, 3.0);
  wall(mb, N.x1 + 0.1, N.back + 0.1, N.x1 + 0.1, N.walkZ, 0, ROOF, T.stuccoSet);
  wall(mb, N.x0 - 0.1, N.walkZ, N.x0 - 0.1, N.back + 0.1, 0, ROOF, T.stuccoSet);
  wall(mb, N.x0 - 0.1, N.back + 0.1, N.x1 + 0.1, N.back + 0.1, 0, ROOF, T.stuccoBack, { cell: 2.4 });
  // the dumpster behind the east stairs
  mb.box(DUMPSTER.x0 + 0.3, -0.1, DUMPSTER.z0 + 0.4, DUMPSTER.x1 - 0.3, 1.3, DUMPSTER.z1 - 0.4, {
    all: { tex: T.dumpster, uv: [0, 0, 64, 32] }, py: { tex: T.darkMetal, uv: [0, 0, 32, 32] },
  });
}

/** Inside the north block's utility rooms, each with its one tube light. */
function buildUtilityInteriors(T, add) {
  const N = NORTH, H = ROOM_H;
  {
    const mb = new XBuilder(); mb.light = utilityLight(0, 34.5);
    const R = LAUNDRY;
    floor(mb, R.x0, R.z0 + 0.12, R.x1, R.z1, 0, { tex: T.pantryFloor, noFlip: true }, 1.0);
    ceiling(mb, R.x0, R.z0, R.x1, R.z1, H, T.ceilingTiles[0], 1.2);
    wall(mb, R.x0 + 0.06, R.z0 + 0.12, R.x1 - 0.06, R.z0 + 0.12, 0, H, T.blockWall, { holes: [{ a: R.door.x0 - R.x0 - 0.06, b: R.door.x1 - R.x0 - 0.06, y0: 0, y1: 2.1 }, { a: 0.6 - R.x0 - 0.06, b: 1.4 - R.x0 - 0.06, y0: 1.2, y1: 1.9 }] });
    wall(mb, R.x1 - 0.06, R.z0 + 0.12, R.x1 - 0.06, R.z1 - 0.06, 0, H, T.blockWall);
    wall(mb, R.x1 - 0.06, R.z1 - 0.06, R.x0 + 0.06, R.z1 - 0.06, 0, H, T.blockWall);
    wall(mb, R.x0 + 0.06, R.z1 - 0.06, R.x0 + 0.06, R.z0 + 0.12, 0, H, T.blockWall);
    mb.quad([-0.6, H - 0.02, 34.2], [0.6, H - 0.02, 34.2], [0.6, H - 0.02, 34.8], [-0.6, H - 0.02, 34.8], T.lightPanel, [0, 0, 64, 64], F_EMIT);
    for (let i = 0; i < 2; i++) mb.at(R.x0 + 0.55 + i * 0.75, 0, R.z1 - 0.45, Math.PI, (b) => washer(b, T, false));
    for (let i = 0; i < 2; i++) mb.at(R.x1 - 0.55 - i * 0.75, 0, R.z1 - 0.45, Math.PI, (b) => washer(b, T, true));
    mb.solid(R.x1 - 0.7, 0, R.z0 + 1.2, R.x1 - 0.1, 0.85, R.z0 + 2.8, T.formica, [0, 0, 32, 64]);
    panel(mb, R.x0 + 0.08, 1.3, R.z0 + 2.2, 0.6, 0.8, Math.PI / 2, T.corkboard);
    add('laundryInt', mb, { indoor: true });
  }
  {
    const mb = new XBuilder(); mb.light = utilityLight(3.6, 34.5);
    const R = MAINT;
    floor(mb, R.x0, R.z0 + 0.12, R.x1, R.z1, 0, T.gravel, 1.2);
    ceiling(mb, R.x0, R.z0, R.x1, R.z1, H, T.slab, 1.2);
    wall(mb, R.x0 + 0.06, R.z0 + 0.12, R.x1 - 0.06, R.z0 + 0.12, 0, H, T.blockWall, { holes: [{ a: R.door.x0 - R.x0 - 0.06, b: R.door.x1 - R.x0 - 0.06, y0: 0, y1: 2.1 }] });
    wall(mb, R.x1 - 0.06, R.z0 + 0.12, R.x1 - 0.06, R.z1 - 0.06, 0, H, T.blockWall);
    wall(mb, R.x1 - 0.06, R.z1 - 0.06, R.x0 + 0.06, R.z1 - 0.06, 0, H, T.blockWall);
    wall(mb, R.x0 + 0.06, R.z1 - 0.06, R.x0 + 0.06, R.z0 + 0.12, 0, H, T.blockWall);
    mb.box(3.2, 2.4, 34.3, 4.2, 2.45, 34.6, { all: { tex: T.lightPanel, uv: [0, 0, 64, 16], flags: F_EMIT } });
    panel(mb, (R.x0 + R.x1) / 2, 1.0, R.z1 - 0.08, 1.8, 1.2, Math.PI, T.tools);
    panel(mb, R.x1 - 0.08, 1.0, 33.0, 0.34, 0.9, -Math.PI / 2, T.breakerBox);
    mb.box(R.x0 + 0.1, 0, R.z0 + 1.0, R.x0 + 0.7, 1.9, R.z0 + 3.4, { all: { tex: T.steelShelf, uv: [0, 0, 64, 64] }, nx: null, ny: null });
    for (let k = 0; k < 3; k++) mb.solid(R.x0 + 0.12, 0.2 + k * 0.6, R.z0 + 1.1, R.x0 + 0.65, 0.5 + k * 0.6, R.z0 + 3.3, T.cardboard, [0, 0, 64, 32]);
    post(mb, R.x1 - 0.5, R.z1 - 0.6, 0, 1.5, 0.28, T.metal, 8);                       // water heater
    mb.solid(R.x1 - 0.8, 0, R.z0 + 0.5, R.x1 - 0.4, 0.34, R.z0 + 0.85, T.bucket, [0, 0, 32, 16]);
    add('maintInt', mb, { indoor: true });
  }
  {
    const mb = new XBuilder(); mb.light = outdoorLight;
    const A = ALCOVE;
    floor(mb, A.x0, A.z0, A.x1, A.z1, 0, T.walk, 1.2);
    ceiling(mb, A.x0, A.z0, A.x1, A.z1, 2.35, T.slab, 1.2);
    wall(mb, A.x0, A.z1, A.x0, A.z0, 0, 2.35, T.blockWall);
    wall(mb, A.x1, A.z0, A.x1, A.z1, 0, 2.35, T.blockWall);
    wall(mb, A.x1, A.z1, A.x0, A.z1, 0, 2.35, T.blockWall);
    mb.box(6.6, 2.3, 32.4, 7.8, 2.35, 32.7, { all: { tex: T.lightPanel, uv: [0, 0, 64, 16], flags: F_EMIT } });
    for (const v of VENDING) mb.at((v.x0 + v.x1) / 2, 0, (v.z0 + v.z1) / 2, Math.PI, (b) => vendingMachine(b, T, v.id === 'soda' ? T.sodaMachine : T.snackMachine));
    const I = ICE_MACHINE;
    mb.at((I.x0 + I.x1) / 2, 0, (I.z0 + I.z1) / 2, Math.PI, (b) => iceMachine(b, T));
    add('alcove', mb);
  }
  void N;
}

/** Steps and stringers and the railing up the side. */
function buildStair(mb, T, s) {
  const run = s.top - s.bottom, n = 16, rise = FLOOR2 / n, step = run / n;
  for (let i = 0; i < n; i++) {
    const z0 = s.bottom + i * step, y = (i + 1) * rise;
    mb.box(s.x0, y - 0.05, z0, s.x1, y, z0 + step + 0.02, { all: { tex: T.stair, uv: [0, 0, 32, 8] }, py: { tex: T.stair, uv: [0, 0, 32, 32] } });
  }
  // stringers and rails, as slanted quads on both sides
  for (const x of [s.x0 - 0.02, s.x1 + 0.02]) {
    const a = [x, -0.12, s.bottom], b = [x, FLOOR2 - 0.3, s.top], c = [x, FLOOR2, s.top], d = [x, 0.2, s.bottom];
    mb.quad(a, b, c, d, T.stringer, [0, 0, 64, 16], F_DOUBLE, [4, 1, false]);
    const ra = [x, 0.2, s.bottom], rb = [x, FLOOR2, s.top], rc = [x, FLOOR2 + 1.0, s.top], rd = [x, 1.2, s.bottom];
    mb.quad(ra, rb, rc, rd, T.railing, [0, 0, 64, 32], F_DOUBLE, [5, 1, true]);
  }
  mb.solid(s.x0 - 0.06, -0.12, s.bottom - 0.05, s.x0 + 0.02, 1.2, s.bottom + 0.05, T.post, [0, 0, 16, 64]);
  mb.solid(s.x1 - 0.02, -0.12, s.bottom - 0.05, s.x1 + 0.06, 1.2, s.bottom + 0.05, T.post, [0, 0, 16, 64]);
}

/* ============================================================
   THE POOL
   ============================================================ */
function buildPool(mb, T) {
  const P = POOL, F = P.fence;
  // deck, with the basin cut out of it
  floor(mb, F.x0, F.z0, F.x1, F.z1, 0, (i, j, cx, cz) => (cx > P.x0 && cx < P.x1 && cz > P.z0 && cz < P.z1 ? null : T.poolDeck), 0.8);
  // coping round the edge, the basin walls, the floor of it
  const co = (x0, z0, x1, z1) => mb.box(x0, -0.02, z0, x1, 0.03, z1, { all: { tex: T.poolCoping, uv: [0, 0, 64, 16] } });
  co(P.x0 - 0.2, P.z0 - 0.2, P.x1 + 0.2, P.z0); co(P.x0 - 0.2, P.z1, P.x1 + 0.2, P.z1 + 0.2);
  co(P.x0 - 0.2, P.z0, P.x0, P.z1); co(P.x1, P.z0, P.x1 + 0.2, P.z1);
  const D = -1.5;
  wall(mb, P.x0, P.z0, P.x1, P.z0, D, -0.02, T.poolTile);
  wall(mb, P.x1, P.z0, P.x1, P.z1, D, -0.02, T.poolTile);
  wall(mb, P.x1, P.z1, P.x0, P.z1, D, -0.02, T.poolTile);
  wall(mb, P.x0, P.z1, P.x0, P.z0, D, -0.02, T.poolTile);
  floor(mb, P.x0, P.z0, P.x1, P.z1, D, T.poolTile, 1.0);
  // the fence: chain link panels on posts, with gates at north and south
  const run = (ax, az, bx, bz, gap) => {
    const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
    const yaw = Math.atan2(-uz, ux);
    for (let d = 0; d < len - 0.01; d += 1.5) {
      const e = Math.min(len, d + 1.5), m = (d + e) / 2;
      const cx = ax + ux * m, cz = az + uz * m;
      if (gap && Math.abs(cx - gap.x) < 0.6 && Math.abs(cz - gap.z) < 0.6) continue;
      sign(mb, cx, 0, cz, e - d, 1.3, yaw, T.chainlink, 0, [0, 0, 32 * (e - d) / 0.45, 32 * 1.3 / 0.45]);
      mb.solid(ax + ux * d - 0.03, 0, az + uz * d - 0.03, ax + ux * d + 0.03, 1.36, az + uz * d + 0.03, T.chrome, [0, 0, 8, 16]);
    }
  };
  run(F.x0, F.z0, F.x1, F.z0, { x: 0, z: F.z0 });
  run(F.x1, F.z0, F.x1, F.z1);
  run(F.x1, F.z1, F.x0, F.z1, { x: 0, z: F.z1 });
  run(F.x0, F.z1, F.x0, F.z0);
  panel(mb, 2.5, 0.6, F.z0 - 0.03, 0.45, 0.9, Math.PI, T.poolRules);
  // loungers, a table under a faded umbrella, a life ring on a post
  for (const [x, z, yaw] of [[-5.2, 23.0, 0], [-5.2, 25.4, 0], [5.2, 23.0, 0], [5.2, 25.6, 0]]) mb.at(x, 0, z, yaw, (b) => lounger(b, T));
  mb.at(-3.4, 0, 28.3, 0, (b) => table(b, T, 0.7, 0.7, 0.72, T.whiteMetal));
  mb.solid(-3.43, 0.72, 28.27, -3.37, 2.2, 28.33, T.whiteMetal, [0, 0, 8, 16]);
  mb.loft([{ y: 2.0, w: 1.1, d: 1.1, ox: -3.4, oz: 28.3 }, { y: 2.3, w: 0.05, d: 0.05, ox: -3.4, oz: 28.3 }],
    [[-0.7, 0.7], [0.7, 0.7], [1, 0], [0.7, -0.7], [-0.7, -0.7], [-1, 0]], [{ tex: T.lounger, uv: [0, 0, 32, 32] }], null);
  mb.loft([{ y: 2.3, w: 0.05, d: 0.05, ox: -3.4, oz: 28.3 }, { y: 2.0, w: 1.1, d: 1.1, ox: -3.4, oz: 28.3 }],
    [[-0.7, 0.7], [0.7, 0.7], [1, 0], [0.7, -0.7], [-0.7, -0.7], [-1, 0]], [{ tex: T.lounger, uv: [0, 0, 32, 32] }], null);
  // the pool pump shed in the corner
  mb.box(4.6, 0, 27.6, 6.0, 1.2, 28.9, { all: { tex: T.stuccoBack, uv: [0, 0, 64, 32] }, py: { tex: T.roof, uv: [0, 0, 32, 32] } });
  void POOL_GATE; void POOL_GATE_N;
}

/* ============================================================
   POLES, SIGN, AND THE REST OF THE WORLD
   ============================================================ */
function buildPoles(mb, T) {
  for (const p of POLES) {
    post(mb, p.x, p.z, -0.12, 6.2, 0.09, T.pole);
    mb.solid(p.x - 0.05, 6.1, p.z - 0.05, p.x + 0.05, 6.2, p.z + 0.9, T.pole, [0, 0, 8, 16]);
    mb.box(p.x - 0.22, 5.95, p.z + 0.55, p.x + 0.22, 6.12, p.z + 1.1, {
      all: { tex: T.lampHead, uv: [0, 0, 16, 16] }, ny: { tex: T.sodium, uv: [0, 0, 16, 16], flags: F_EMIT },
    });
    mb.solid(p.x - 0.25, -0.12, p.z - 0.25, p.x + 0.25, 0.3, p.z + 0.25, T.curb, [0, 0, 32, 16]);
  }
}

/**
 * The pylon by the highway. Two faces, one toward the traffic and one toward
 * the lot, built as separate panels so the lettering reads right on both.
 */
function buildSign(mb, T) {
  const { x, z } = SIGN_POS;
  post(mb, x - 1.2, z, -0.15, 7.6, 0.14, T.pole);
  post(mb, x + 1.2, z, -0.15, 7.6, 0.14, T.pole);
  const cab = (y0, y1, w, tex, flags) => {
    mb.box(x - w / 2, y0, z - 0.25, x + w / 2, y1, z + 0.25, { all: { tex: T.darkMetal, uv: [0, 0, 16, 16] }, pz: null, nz: null });
    panel(mb, x, y0, z - 0.26, w, y1 - y0, Math.PI, tex, flags);
    panel(mb, x, y0, z + 0.26, w, y1 - y0, 0, tex, flags);
  };
  cab(6.2, 8.6, 4.8, T.signTop, F_EMIT);
  cab(5.4, 6.2, 4.0, T.signBand, F_EMIT);
  cab(3.4, 5.3, 3.8, T.readerboard, F_EMIT);
  cab(2.7, 3.3, 2.2, T.vacancy, F_EMIT);
  // the planter at its feet
  mb.box(x - 2.0, -0.15, z - 0.8, x + 2.0, 0.35, z + 0.8, { all: { tex: T.curb, uv: [0, 0, 64, 16] }, py: { tex: T.gravel, uv: [0, 0, 64, 32] } });
}

/** Peg's Diner and the gas station across the highway: lights in the dark. */
function buildFarSide(mb, T) {
  mb.light = () => 0.35;
  // the diner: a long low building with lit windows
  mb.box(14, -0.18, -38, 30, 3.2, -31, { all: { tex: T.stuccoBack, uv: [0, 0, 64, 32] }, ny: null });
  mb.light = () => 1;
  for (let x = 15; x < 29; x += 2.2) mb.quad([x, 1.0, -30.98], [x + 1.6, 1.0, -30.98], [x + 1.6, 2.2, -30.98], [x, 2.2, -30.98], T.curtainLit, [0, 0, 64, 64], F_EMIT);
  panel(mb, 22, 3.6, -31.5, 5.0, 2.5, 0, T.dinerSign, F_EMIT);
  post(mb, 22, -31.5, 0, 3.6, 0.1, T.pole);
  // the gas station canopy, lit bright underneath
  mb.light = () => 0.5;
  mb.box(-40, 4.0, -38, -28, 4.6, -32, { all: { tex: T.fascia, uv: [0, 0, 64, 16] }, ny: { tex: T.lightPanel, uv: [0, 0, 64, 64], flags: F_EMIT } });
  post(mb, -39, -35, -0.18, 4.0, 0.15, T.pole);
  post(mb, -29, -35, -0.18, 4.0, 0.15, T.pole);
  mb.light = () => 1;
  panel(mb, -24, 5.0, -32, 2.2, 2.2, 0, T.gasSign, F_EMIT);
  post(mb, -24, -32.2, 0, 5.0, 0.1, T.pole);
}

/* ============================================================
   DYNAMIC MESHES
   ============================================================ */
function leafMesh(T, kind) {
  const b = new XBuilder();
  b.light = () => 1;
  if (kind === 'glass') {
    const w = 1.0, h = 2.15;
    b.box(0, 0, -0.03, w, h, 0.03, {
      all: { tex: T.bronze, uv: [0, 0, 8, 64] },
      pz: { tex: T.glassDoor, uv: [0, 0, 64, 128], flags: F_BLEND, sub: [2, 4, false] },
      nz: { tex: T.glassDoor, uv: [0, 0, 64, 128], flags: F_BLEND, sub: [2, 4, false] },
    });
    b.solid(0, 0, -0.035, 0.07, h, 0.035, T.bronze, [0, 0, 8, 64]);
    b.solid(w - 0.07, 0, -0.035, w, h, 0.035, T.bronze, [0, 0, 8, 64]);
    b.solid(0, 0, -0.035, w, 0.14, 0.035, T.bronze, [0, 0, 64, 8]);
    b.solid(0, h - 0.1, -0.035, w, h, 0.035, T.bronze, [0, 0, 64, 8]);
    b.solid(0.1, 1.0, -0.07, w - 0.1, 1.05, 0.07, T.chrome, [0, 0, 16, 8]);
  } else {
    const w = 0.9, h = kind === 'steel' ? 2.1 : 2.05;
    const tex = kind === 'steel' ? T.steelDoor : T.officeDoor;
    b.box(0, 0, -0.022, w, h, 0.022, {
      all: { tex: T.doorFrame, uv: [0, 0, 8, 64] },
      pz: { tex, uv: [0, 0, 64, 128], sub: [2, 4, false] },
      nz: { tex, uv: [64, 0, 0, 128], sub: [2, 4, false] },
    });
  }
  return b.build();
}

function gateMesh(T) {
  const b = new XBuilder();
  b.light = () => 1;
  b.quad([1.1, 0, 0], [0, 0, 0], [0, 1.2, 0], [1.1, 1.2, 0], T.chainlink, [0, 0, 78, 85], F_DOUBLE, [2, 2, false]);
  b.solid(0, 0, -0.02, 0.04, 1.25, 0.02, T.chrome, [0, 0, 8, 16]);
  b.solid(1.06, 0, -0.02, 1.1, 1.25, 0.02, T.chrome, [0, 0, 8, 16]);
  b.solid(0, 1.2, -0.02, 1.1, 1.25, 0.02, T.chrome, [0, 0, 16, 8]);
  return b.build();
}

/** Four big walls far out: the treeline, the sky, the county. */
function backdropMesh(T) {
  const b = new XBuilder();
  b.light = () => 1;
  const R = 90, Y0 = -2, Y1 = 34;
  const tex = T.backdrop.night;
  const side = (ax, az, bx, bz) => b.quad([ax, Y0, az], [bx, Y0, bz], [bx, Y1, bz], [ax, Y1, az], tex, [0, 0, 128, 64], F_EMIT, [6, 1, true]);
  side(-R, -R, R, -R);   // south, behind the highway
  side(R, -R, R, R);
  side(R, R, -R, R);
  side(-R, R, -R, -R);
  const m = b.build();
  m.slot = m.textures.indexOf(tex);
  return m;
}

function poolWaterMesh(T) {
  const b = new XBuilder();
  b.light = () => 1;
  const P = POOL;
  floor(b, P.x0, P.z0, P.x1, P.z1, -0.22, { tex: T.poolWater[0], noFlip: true }, 1.4, F_EMIT);
  const m = b.build();
  m.slot = m.textures.indexOf(T.poolWater[0]);
  return m;
}
