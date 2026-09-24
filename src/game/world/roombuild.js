/* ============================================================
   roombuild.js -- one motel room, twenty-eight times.

   Every room is the same room: a door and a window on the walk,
   the beds against the party wall with the headboards bolted to it,
   a dresser with the television on it opposite, the air unit under
   the window, a bathroom at the back with the tub and the toilet,
   and the sink out in its own alcove the way motels do it.

   What changes is what makes a room a room you remember: which way
   it is mirrored, how many beds, the carpet, the spread, the art,
   whether anybody has smoked in it since 1983, and 112, which got
   the new carpet in August and will not let anybody forget it.

   Built in the room's local frame (see layout.js) for a door on the
   left, and mirrored for rooms whose door is on the right.
   ============================================================ */
import { F_EMIT, F_DOUBLE } from '../../engine/raster.js';
import { ROOM_W as W, ROOM_D as D, ROOM_H as H, toWorld } from './layout.js';
import { wall, wall2, floor, ceiling, panel, sign, hash2, XBuilder } from './geo.js';
import { roomLight, outdoorLight } from './lighting.js';

const WALL_T = 0.12;
const IN = WALL_T;           // inside face of the facade
const SX0 = 0.06, SX1 = W - 0.06, BZ = D - 0.06;
/* The back of the room: the sink in an open nook at the end of the aisle,
   and the bathroom beside it behind a wall, with a doorway off the nook. */
const BACK_Z = 4.9;          // where the bedroom ends
const BX = 1.95;             // the bathroom's side wall
const BATH_DOOR = { z0: 5.15, z1: 6.0 };
export const DOOR_L = { x0: 0.35, x1: 1.25, h: 2.1 };
export const WIN_L = { x0: 1.7, x1: 3.25, y0: 0.95, y1: 2.05 };

/* Where the beds and nightstands go, by bed type. Beds run across the room
   with the headboard on the right-hand wall, leaving the aisle along the
   left wall clear from the door to the sink. */
function bedPlan(beds) {
  if (beds === 'QQ') return { beds: [[0.72, 2.24], [2.9, 4.42]], stands: [2.57], table: false };
  if (beds === 'K') return { beds: [[1.55, 3.55]], stands: [1.22, 3.88], table: true };
  return { beds: [[1.85, 3.25]], stands: [1.52, 3.58], table: true };
}
const BED_X0 = 1.52, BED_X1 = 3.49;

/** Pieces of furniture in room-local space, for collision and interaction. */
export function roomFurniture(room) {
  const out = [];
  const add = (id, x0, z0, x1, z1, y1) => out.push({ id, x0, z0, x1, z1, y1 });
  const plan = bedPlan(room.beds);
  plan.beds.forEach(([z0, z1], i) => add(i ? 'bed2' : 'bed', BED_X0, z0, SX1, z1, 0.62));
  plan.stands.forEach((z, i) => add(i ? 'nightstand2' : 'nightstand', 3.02, z - 0.27, SX1, z + 0.27, 0.6));
  add('dresser', SX0, 2.2, 0.56, 3.8, 0.76);
  add('tv', SX0 + 0.04, 2.75, 0.56, 3.25, 1.22);
  add('ac', 1.95, IN, 2.95, 0.42, 0.85);
  add('rack', SX0, 1.0, 0.62, 1.6, 0.5);
  if (plan.table) { add('table', 2.95, 0.45, 3.45, 0.85, 0.72); add('chair', 2.45, 0.5, 2.85, 0.9, 0.9); }
  // the sink, and the bathroom behind its wall
  add('vanity', SX0, 6.58, BX, BZ, 0.84);
  add('wallBath', BX, BACK_Z, SX1, BACK_Z + 0.08, H);
  add('wallBath2', BX, BACK_Z, BX + 0.08, BATH_DOOR.z0, H);
  add('wallBath3', BX, BATH_DOOR.z1, BX + 0.08, BZ, H);
  add('tub', BX + 0.08, 6.4, SX1, BZ, 0.5);
  add('toilet', 3.12, 5.2, SX1, 5.62, 0.8);
  return out;
}

/**
 * Build a room's interior into its own mesh.
 * @param variant { k } a per-room hash, so rooms differ from their neighbors
 */
export function buildRoomInterior(T, room) {
  const mb = new XBuilder();
  mb.light = roomLight(room);
  const k = hash2(Number(room.no), 3);
  const reno = room.traits.includes('renovated');
  const smelly = room.traits.includes('smell');
  const carpet = reno ? T.roomCarpetNew : T.roomCarpet[k % T.roomCarpet.length];
  const paper = reno ? T.roomWallNew : smelly ? T.roomWallSmoke : T.roomWall[(k >>> 3) % T.roomWall.length];
  const spread = reno ? T.bedspreadNew : T.bedspreads[(k >>> 5) % T.bedspreads.length];
  const art = T.art[(k >>> 7) % T.art.length];
  const mw = room.doorHi ? W : null;
  const plan = bedPlan(room.beds);

  mb.at(room.ox, room.y, room.oz, room.yaw, (b) => {
    /* ---- shell ---- */
    floor(b, SX0, IN, SX1, BACK_Z, 0, carpet, 1.0);
    floor(b, SX0, BACK_Z, BX, BZ, 0, T.pantryFloor, 1.0);         // the sink nook: vinyl
    floor(b, BX, BACK_Z, SX1, BZ, 0, T.bathTile, 1.0);            // the bathroom: tile
    ceiling(b, SX0, IN, SX1, BZ, H, T.popcornCeiling, 1.2);
    // facade, inside face, with the door and the window cut out of it
    wall(b, SX0, IN, SX1, IN, 0, H, paper, {
      holes: [{ a: DOOR_L.x0 - SX0, b: DOOR_L.x1 - SX0, y0: 0, y1: DOOR_L.h },
        { a: WIN_L.x0 - SX0, b: WIN_L.x1 - SX0, y0: WIN_L.y0, y1: WIN_L.y1 }],
    });
    // the wall the headboards are on, then the bathroom behind it
    wall(b, SX1, IN, SX1, BACK_Z + 0.04, 0, H, paper);
    wall(b, SX1, BACK_Z + 0.04, SX1, BZ, 0, H, T.bathWall);
    // the aisle wall runs all the way back past the sink
    wall(b, SX0, BZ, SX0, IN, 0, H, paper);
    // back wall: behind the sink, then the bathroom
    wall(b, BX + 0.04, BZ, SX0, BZ, 0, H, paper);
    wall(b, SX1, BZ, BX + 0.04, BZ, 0, H, T.bathWall);
    // the bathroom's two walls, both faces, with a doorway off the nook
    wall2(b, SX1, BACK_Z + 0.04, BX + 0.04, BACK_Z + 0.04, 0, H, paper, T.bathWall);
    wall2(b, BX + 0.04, BACK_Z + 0.04, BX + 0.04, BZ, 0, H, paper, T.bathWall, {
      holes: [{ a: BATH_DOOR.z0 - BACK_Z - 0.04, b: BATH_DOOR.z1 - BACK_Z - 0.04, y0: 0, y1: 2.05 }],
    });
    // the doorway's casing, and the corner post where the walls meet
    b.solid(BX, 0, BATH_DOOR.z0 - 0.05, BX + 0.08, 2.1, BATH_DOOR.z0, T.doorFrame, [0, 0, 8, 64]);
    b.solid(BX, 0, BATH_DOOR.z1, BX + 0.08, 2.1, BATH_DOOR.z1 + 0.05, T.doorFrame, [0, 0, 8, 64]);
    b.solid(BX, 2.05, BATH_DOOR.z0 - 0.05, BX + 0.08, 2.12, BATH_DOOR.z1 + 0.05, T.doorFrame, [0, 0, 32, 8]);
    b.solid(BX - 0.02, 0, BACK_Z - 0.02, BX + 0.1, H, BACK_Z + 0.1, T.doorFrame, [0, 0, 8, 64], ['ny']);
    // baseboards along the bedroom walls
    b.solid(SX0, 0, IN, SX0 + 0.015, 0.09, 6.58, T.baseboard, [0, 0, 64, 16], ['ny']);
    b.solid(SX1 - 0.015, 0, IN, SX1, 0.09, BACK_Z, T.baseboard, [0, 0, 64, 16], ['ny']);
    b.solid(BX, 0, BACK_Z - 0.015, SX1, 0.09, BACK_Z, T.baseboard, [0, 0, 64, 16], ['ny']);

    /* ---- the window, from the inside: drapes and a valance ---- */
    panel(b, (WIN_L.x0 + WIN_L.x1) / 2, WIN_L.y0 - 0.04, IN + 0.01, WIN_L.x1 - WIN_L.x0, WIN_L.y1 - WIN_L.y0 + 0.08, 0, T.curtainDark);
    b.solid(WIN_L.x0 - 0.3, WIN_L.y0 - 0.25, IN, WIN_L.x0 - 0.02, WIN_L.y1 + 0.2, IN + 0.12, spread, [0, 0, 16, 64]);
    b.solid(WIN_L.x1 + 0.02, WIN_L.y0 - 0.25, IN, WIN_L.x1 + 0.2, WIN_L.y1 + 0.2, IN + 0.12, spread, [0, 0, 16, 64]);
    b.solid(WIN_L.x0 - 0.32, WIN_L.y1 + 0.1, IN, WIN_L.x1 + 0.22, WIN_L.y1 + 0.34, IN + 0.16, spread, [0, 0, 64, 16]);

    /* ---- the air unit under the window ---- */
    b.box(1.95, 0.25, IN, 2.95, 0.85, 0.42, {
      all: { tex: T.beige, uv: [0, 0, 32, 32] },
      pz: { tex: T.acFront, uv: [0, 0, 64, 32] }, nz: null,
    });

    /* ---- beds, across the room, headboards on the right-hand wall ---- */
    const bed = (z0, z1) => {
      const x0 = BED_X0, x1 = BED_X1;
      b.solid(x0, 0, z0, x1, 0.3, z1, T.wood, [0, 0, 64, 16], ['ny']);
      b.box(x0 - 0.02, 0.3, z0 - 0.02, x1, 0.58, z1 + 0.02, {
        all: { tex: spread, uv: [0, 0, 64, 20] },
        py: { tex: spread, uv: [0, 0, 64, 64] }, ny: null, px: null,
      });
      // two pillows up by the headboard
      const zc = (z0 + z1) / 2, pw = Math.min(0.7, (z1 - z0) / 2 - 0.08);
      b.solid(x1 - 0.5, 0.58, zc - pw - 0.02, x1 - 0.06, 0.7, zc - 0.04, T.pillow, [0, 0, 32, 16], ['ny']);
      b.solid(x1 - 0.5, 0.58, zc + 0.04, x1 - 0.06, 0.7, zc + pw + 0.02, T.pillow, [0, 0, 32, 16], ['ny']);
      // headboard bolted to the wall
      b.box(x1, 0.3, z0 - 0.06, SX1, 1.15, z1 + 0.06, { all: { tex: T.headboard, uv: [0, 0, 64, 32] }, px: null });
    };
    for (const [z0, z1] of plan.beds) bed(z0, z1);

    /* ---- nightstands and their lamps ---- */
    for (const z of plan.stands) {
      b.solid(3.02, 0, z - 0.27, SX1, 0.58, z + 0.27, T.wood, [0, 0, 32, 32], ['ny']);
      b.solid(3.2, 0.58, z - 0.05, 3.3, 0.96, z + 0.05, T.lampBase, [0, 0, 16, 16]);
      b.box(3.08, 0.96, z - 0.17, 3.42, 1.24, z + 0.17, { all: { tex: T.lampShade, uv: [0, 0, 16, 16], flags: F_EMIT }, ny: null });
    }
    // the phone on the first stand, and an ashtray on smoking rooms'
    const z0 = plan.stands[0];
    b.box(3.05, 0.58, z0 + 0.08, 3.22, 0.66, z0 + 0.23, { all: { tex: T.phoneRoom, uv: [0, 0, 16, 16] } });
    if (room.smoking) b.solid(3.06, 0.58, z0 - 0.24, 3.18, 0.61, z0 - 0.12, T.ashtray, [0, 0, 16, 16]);

    /* ---- dresser, television, and the mirror over it ---- */
    b.box(SX0, 0, 2.2, 0.56, 0.76, 3.8, {
      all: { tex: T.wood, uv: [0, 0, 64, 32] },
      px: { tex: T.tvWood, uv: [0, 0, 32, 32] }, ny: null, nx: null,
    });
    b.box(0.1, 0.76, 2.75, 0.56, 1.2, 3.25, {
      all: { tex: T.tvShell, uv: [0, 0, 32, 32] },
      px: { tex: T.tvScreenRoom, uv: [0, 0, 32, 32] },
    });
    b.solid(0.25, 1.2, 2.95, 0.3, 1.34, 2.98, T.chrome, [0, 0, 8, 8]);     // rabbit ears
    b.solid(0.25, 1.2, 3.02, 0.3, 1.32, 3.05, T.chrome, [0, 0, 8, 8]);
    if (!room.smoking) b.box(0.12, 0.76, 2.35, 0.2, 0.88, 2.5, { all: { tex: T.noSmoking, uv: [0, 0, 16, 16] } });
    b.solid(0.22, 0.76, 3.45, 0.42, 0.94, 3.65, T.iceBucket, [0, 0, 16, 16], ['ny']);
    // framed art over the dresser, flat on the wall
    b.solid(SX0, 1.42, 2.55, SX0 + 0.03, 2.0, 3.45, T.doorFrame, [0, 0, 32, 16]);
    panel(b, SX0 + 0.035, 1.46, 3.0, 0.82, 0.5, Math.PI / 2, T.art[(k >>> 9) % T.art.length]);
    // luggage rack by the door
    b.solid(SX0 + 0.02, 0.44, 1.0, 0.62, 0.5, 1.6, T.wood, [0, 0, 32, 8]);
    b.solid(SX0 + 0.05, 0, 1.05, 0.1, 0.44, 1.1, T.chrome, [0, 0, 8, 8]);
    b.solid(0.54, 0, 1.5, 0.59, 0.44, 1.55, T.chrome, [0, 0, 8, 8]);
    // a little table and a chair by the window, where the beds leave room
    if (plan.table) {
      b.solid(3.17, 0, 0.62, 3.23, 0.7, 0.68, T.chrome, [0, 0, 8, 8]);
      b.solid(2.95, 0.7, 0.45, 3.45, 0.74, 0.85, T.formica, [0, 0, 32, 32]);
      b.solid(2.45, 0.42, 0.5, 2.85, 0.48, 0.9, T.vinylOrange, [0, 0, 32, 32]);
      b.solid(2.45, 0.48, 0.86, 2.85, 0.92, 0.9, T.vinylOrange, [0, 0, 32, 32]);
      b.solid(2.62, 0, 0.68, 2.68, 0.42, 0.74, T.chrome, [0, 0, 8, 8]);
    }
    /* ---- art over the beds ---- */
    for (const [z0b, z1b] of plan.beds) panel(b, SX1 - 0.02, 1.38, (z0b + z1b) / 2, 0.9, 0.46, -Math.PI / 2, art);

    /* ---- the sink nook: counter across the back, mirror, two lights ---- */
    b.box(SX0, 0, 6.58, BX, 0.84, BZ, {
      all: { tex: T.wood, uv: [0, 0, 64, 32] },
      py: { tex: T.vanityTop, uv: [0, 0, 32, 32] }, pz: null, ny: null,
    });
    b.solid(SX0, 0.84, BZ - 0.08, BX, 0.95, BZ, T.vanityTop, [0, 0, 32, 8]);   // backsplash
    const mc = (SX0 + BX) / 2;
    b.solid(mc - 0.66, 1.0, BZ - 0.025, mc + 0.66, 1.9, BZ, T.doorFrame, [0, 0, 32, 32]);
    panel(b, mc, 1.04, BZ - 0.03, 1.24, 0.82, Math.PI, T.mirror);
    for (const x of [mc - 0.8, mc + 0.8]) {
      b.solid(x - 0.05, 1.62, BZ - 0.06, x + 0.05, 1.66, BZ, T.chrome, [0, 0, 8, 8]);
      b.box(x - 0.07, 1.66, BZ - 0.14, x + 0.07, 1.84, BZ - 0.02, { all: { tex: T.lampShade, uv: [0, 0, 16, 16], flags: F_EMIT } });
    }
    // a hand towel on a ring on the aisle wall, and the light overhead
    panel(b, SX0 + 0.02, 0.95, 6.15, 0.36, 0.5, Math.PI / 2, T.towel);
    b.box(0.7, H - 0.04, 5.5, 1.3, H - 0.01, 6.1, { all: { tex: T.lightPanel, uv: [0, 0, 64, 64], flags: F_EMIT }, py: null });

    /* ---- the bathroom: tub across the back, the toilet on the side wall ---- */
    b.box(BX + 0.08, 0, 6.4, SX1, 0.5, BZ, {
      all: { tex: T.porcelain, uv: [0, 0, 32, 32] },
      py: { tex: T.tubInner, uv: [0, 0, 32, 32] }, ny: null, pz: null, px: null,
    });
    sign(b, (BX + 0.08 + SX1) / 2, 0.55, 6.37, SX1 - BX - 0.08, 1.5, 0, T.showerCurtain);
    b.solid(BX + 0.08, 2.05, 6.36, SX1, 2.07, 6.38, T.chrome, [0, 0, 8, 8]);   // the curtain rod, wall to wall
    // toilet: tank against the wall, bowl facing into the room
    b.solid(3.34, 0.4, 5.2, SX1, 0.8, 5.62, T.porcelain, [0, 0, 32, 32], ['ny']);
    b.solid(3.12, 0, 5.24, 3.46, 0.4, 5.58, T.porcelain, [0, 0, 32, 32], ['ny']);
    b.solid(3.12, 0.4, 5.23, 3.36, 0.43, 5.59, T.white, [0, 0, 16, 16], ['ny']);
    b.solid(SX1 - 0.04, 0.62, 5.8, SX1, 0.72, 5.94, T.white, [0, 0, 16, 16]);   // paper on its holder
    // bath towels on the wall by the door, and the bathroom light
    panel(b, (BX + SX1) / 2, 0.9, BACK_Z + 0.09, 0.5, 0.62, 0, T.towel);
    b.box(2.45, H - 0.04, 5.4, 3.05, H - 0.01, 6.0, { all: { tex: T.lightPanel, uv: [0, 0, 64, 64], flags: F_EMIT }, py: null });
  }, mw);

  return mb.build();
}

/**
 * The face a room shows to the walk: stucco, the door frame, the window
 * frame and sill, the air unit's grille, the porch light and the number.
 * Built into the exterior chunk of whichever building the room is in.
 */
export function buildRoomFacade(mb, T, room) {
  const mw = room.doorHi ? W : null;
  const top = room.lv ? H : H + 0.3;      // downstairs, the wall runs up behind the slab
  mb.at(room.ox, room.y, room.oz, room.yaw, (b) => {
    wall(b, W, 0, 0, 0, 0, top, T.stuccoSet, {
      holes: [{ a: W - DOOR_L.x1, b: W - DOOR_L.x0, y0: 0, y1: DOOR_L.h },
        { a: W - WIN_L.x1, b: W - WIN_L.x0, y0: WIN_L.y0, y1: WIN_L.y1 }],
    });
    // door frame, standing proud of the wall on both faces
    b.solid(DOOR_L.x0 - 0.07, 0, -0.03, DOOR_L.x0, DOOR_L.h + 0.06, IN + 0.03, T.doorFrame, [0, 0, 8, 64]);
    b.solid(DOOR_L.x1, 0, -0.03, DOOR_L.x1 + 0.07, DOOR_L.h + 0.06, IN + 0.03, T.doorFrame, [0, 0, 8, 64]);
    b.solid(DOOR_L.x0 - 0.07, DOOR_L.h, -0.03, DOOR_L.x1 + 0.07, DOOR_L.h + 0.08, IN + 0.03, T.doorFrame, [0, 0, 32, 8]);
    // threshold
    b.solid(DOOR_L.x0, 0, -0.02, DOOR_L.x1, 0.012, IN, T.bronze, [0, 0, 16, 8], ['ny']);
    // window frame and sill
    b.solid(WIN_L.x0 - 0.06, WIN_L.y0 - 0.07, -0.1, WIN_L.x1 + 0.06, WIN_L.y0, IN, T.post, [0, 0, 16, 8]);
    b.solid(WIN_L.x0 - 0.05, WIN_L.y1, -0.03, WIN_L.x1 + 0.05, WIN_L.y1 + 0.05, IN, T.bronze, [0, 0, 16, 8]);
    b.solid(WIN_L.x0 - 0.05, WIN_L.y0, -0.03, WIN_L.x0, WIN_L.y1, IN, T.bronze, [0, 0, 8, 16]);
    b.solid(WIN_L.x1, WIN_L.y0, -0.03, WIN_L.x1 + 0.05, WIN_L.y1, IN, T.bronze, [0, 0, 8, 16]);
    b.solid((WIN_L.x0 + WIN_L.x1) / 2 - 0.02, WIN_L.y0, -0.02, (WIN_L.x0 + WIN_L.x1) / 2 + 0.02, WIN_L.y1, 0.02, T.bronze, [0, 0, 8, 16]);
    // the air unit sticks out of the wall under the window
    b.box(1.95, 0.25, -0.1, 2.95, 0.85, 0.0, {
      all: { tex: T.beige, uv: [0, 0, 32, 32] },
      nz: { tex: T.acGrille, uv: [0, 0, 32, 32] }, pz: null,
    });
    // porch light between the door and the window
    b.box(1.43, 2.12, -0.1, 1.57, 2.36, 0, { all: { tex: T.porchLight, uv: [0, 0, 16, 16], flags: F_EMIT }, pz: null });
  }, mw);
  // The number goes on unmirrored, so it reads the right way round.
  const lx = room.doorHi ? W - 1.5 : 1.5;
  const [px, pz] = toWorld(room, lx, -0.015);
  panel(mb, px, room.y + 1.55, pz, 0.32, 0.16, room.faceOut, T.roomNo[room.no] || T.roomNo['101']);
}

/**
 * The window's curtain seen from outside, as its own little mesh, so the
 * game can light it when somebody is up and put it out when they sleep.
 * Local frame: origin at the window's lower left from outside, facing -z.
 */
export function buildCurtainMesh(T) {
  const mb = new XBuilder();
  mb.light = () => 1;
  const w = WIN_L.x1 - WIN_L.x0, h = WIN_L.y1 - WIN_L.y0;
  mb.quad([w, 0, 0.03], [0, 0, 0.03], [0, h, 0.03], [w, h, 0.03], T.curtainDark, [0, 0, 64, 64], 0, [2, 2, false]);
  const m = mb.build();
  m.slot = 0;
  return m;
}

/** A room door leaf: painted outside, cream inside. Local: hinge at x 0, leaf along +x. */
export function buildRoomDoorMesh(T, up) {
  const mb = new XBuilder();
  mb.light = () => 1;
  const w = DOOR_L.x1 - DOOR_L.x0, h = DOOR_L.h;
  mb.box(0, 0, 0, w, h, 0.045, {
    all: { tex: T.doorFrame, uv: [0, 0, 8, 64] },
    nz: { tex: up ? T.roomDoorUp : T.roomDoor, uv: [0, 0, 64, 128], sub: [2, 4, false] },
    pz: { tex: T.doorInside, uv: [64, 0, 0, 128], sub: [2, 4, false] },
  });
  return mb.build();
}

export { outdoorLight, F_DOUBLE };
