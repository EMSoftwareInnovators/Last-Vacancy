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
const BATH_Z = 5.0, BATH_X = 2.0;
export const DOOR_L = { x0: 0.35, x1: 1.25, h: 2.1 };
export const WIN_L = { x0: 1.7, x1: 3.25, y0: 0.95, y1: 2.05 };

/** Pieces of furniture in room-local space, for collision and interaction. */
export function roomFurniture(room) {
  const out = [];
  const add = (id, x0, z0, x1, z1, y1) => out.push({ id, x0, z0, x1, z1, y1 });
  const bedsK = room.beds === 'K', bedsQ = room.beds === 'QQ';
  if (bedsK) add('bed', 1.45, 2.05, 3.54, 4.15, 0.62);
  else if (bedsQ) { add('bed', 1.46, 0.85, 3.54, 2.4, 0.62); add('bed2', 1.46, 3.2, 3.54, 4.75, 0.62); }
  else add('bed', 1.59, 2.3, 3.54, 3.67, 0.62);
  if (bedsQ) add('nightstand', 3.02, 2.5, 3.54, 3.1, 0.6);
  else { add('nightstand', 3.02, bedsK ? 1.45 : 1.7, 3.54, bedsK ? 1.95 : 2.2, 0.6); add('nightstand2', 3.02, bedsK ? 4.25 : 3.8, 3.54, bedsK ? 4.75 : 4.3, 0.6); }
  add('dresser', SX0, 2.3, 0.58, 3.9, 0.76);
  add('tv', SX0 + 0.04, 2.85, 0.58, 3.35, 1.22);
  add('ac', 1.95, IN, 2.95, 0.42, 0.85);
  if (!bedsQ) add('table', 2.85, 0.62, 3.4, 1.14, 0.72);
  add('rack', SX0, 1.2, 0.62, 1.8, 0.5);
  add('tub', SX0, 5.12, 0.8, BZ, 0.5);
  add('toilet', 1.35, 6.55, 1.75, BZ, 0.8);
  add('vanity', 2.08, 6.55, SX1, BZ, 0.84);
  // the partitions
  add('wallBath', SX0, 4.96, 1.1, 5.04, H);
  add('wallBath2', 1.9, 4.96, 2.04, 5.04, H);
  add('wallBath3', 1.96, 5.0, 2.04, BZ, H);
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

  mb.at(room.ox, room.y, room.oz, room.yaw, (b) => {
    /* ---- shell ---- */
    floor(b, SX0, IN, SX1, BATH_Z, 0, carpet, 1.0);
    floor(b, SX0, BATH_Z, BATH_X, BZ, 0, T.bathTile, 1.0);
    floor(b, BATH_X, BATH_Z, SX1, BZ, 0, T.pantryFloor, 1.0);
    ceiling(b, SX0, IN, SX1, BZ, H, T.popcornCeiling, 1.2);
    // facade, inside face, with the door and the window cut out of it
    wall(b, SX0, IN, SX1, IN, 0, H, paper, {
      holes: [{ a: DOOR_L.x0 - SX0, b: DOOR_L.x1 - SX0, y0: 0, y1: DOOR_L.h },
        { a: WIN_L.x0 - SX0, b: WIN_L.x1 - SX0, y0: WIN_L.y0, y1: WIN_L.y1 }],
    });
    // the party wall the beds stand against, then the vanity alcove
    wall(b, SX1, IN, SX1, BATH_Z, 0, H, paper);
    wall(b, SX1, BATH_Z, SX1, BZ, 0, H, paper);
    // the other party wall: bedroom, then the bathroom side
    wall(b, SX0, BATH_Z, SX0, IN, 0, H, paper);
    wall(b, SX0, BZ, SX0, BATH_Z, 0, H, T.bathWall);
    // back wall: alcove, then bathroom
    wall(b, SX1, BZ, BATH_X, BZ, 0, H, paper);
    wall(b, BATH_X, BZ, SX0, BZ, 0, H, T.bathWall);
    // bathroom partitions, both faces
    wall2(b, BATH_X, BATH_Z, SX0, BATH_Z, 0, H, paper, T.bathWall, { holes: [{ a: 0.1, b: 0.9, y0: 0, y1: 2.05 }] });
    wall2(b, BATH_X, BZ, BATH_X, BATH_Z, 0, H, paper, T.bathWall);
    // baseboards along the bedroom walls
    b.solid(SX0, 0, IN, SX0 + 0.015, 0.09, BATH_Z, T.baseboard, [0, 0, 64, 16], ['ny']);
    b.solid(SX1 - 0.015, 0, IN, SX1, 0.09, BATH_Z, T.baseboard, [0, 0, 64, 16], ['ny']);

    /* ---- the window, from the inside: drapes and a valance ---- */
    panel(b, (WIN_L.x0 + WIN_L.x1) / 2, WIN_L.y0 - 0.04, IN + 0.01, WIN_L.x1 - WIN_L.x0, WIN_L.y1 - WIN_L.y0 + 0.08, 0, T.curtainDark);
    b.solid(WIN_L.x0 - 0.3, WIN_L.y0 - 0.25, IN, WIN_L.x0 - 0.02, WIN_L.y1 + 0.2, IN + 0.12, spread, [0, 0, 16, 64]);
    b.solid(WIN_L.x1 + 0.02, WIN_L.y0 - 0.25, IN, WIN_L.x1 + 0.28, WIN_L.y1 + 0.2, IN + 0.12, spread, [0, 0, 16, 64]);
    b.solid(WIN_L.x0 - 0.32, WIN_L.y1 + 0.1, IN, WIN_L.x1 + 0.3, WIN_L.y1 + 0.34, IN + 0.16, spread, [0, 0, 64, 16]);

    /* ---- the air unit under the window ---- */
    b.box(1.95, 0.25, IN, 2.95, 0.85, 0.42, {
      all: { tex: T.beige, uv: [0, 0, 32, 32] },
      pz: { tex: T.acFront, uv: [0, 0, 64, 32] }, nz: null,
    });

    /* ---- beds ---- */
    const bed = (x0, z0, x1, z1) => {
      b.solid(x0, 0, z0, x1, 0.3, z1, T.wood, [0, 0, 64, 16], ['ny']);
      b.box(x0 - 0.02, 0.3, z0 - 0.02, x1, 0.58, z1 + 0.02, {
        all: { tex: spread, uv: [0, 0, 64, 20] },
        py: { tex: spread, uv: [0, 0, 64, 64] }, ny: null, px: null,
      });
      // pillows up by the headboard, under a fold of spread
      const zc = (z0 + z1) / 2, half = (z1 - z0) / 2;
      const pw = half > 0.8 ? 0.8 : half - 0.05;
      b.solid(x1 - 0.5, 0.58, zc - pw - 0.02, x1 - 0.06, 0.7, zc - 0.04, T.pillow, [0, 0, 32, 16], ['ny']);
      b.solid(x1 - 0.5, 0.58, zc + 0.04, x1 - 0.06, 0.7, zc + pw + 0.02, T.pillow, [0, 0, 32, 16], ['ny']);
      // headboard bolted to the wall
      b.box(x1, 0.3, z0 - 0.08, SX1, 1.2, z1 + 0.08, { all: { tex: T.headboard, uv: [0, 0, 64, 32] }, px: null });
    };
    let lamps;
    if (room.beds === 'K') {
      bed(1.45, 2.05, 3.49, 4.15);
      lamps = [1.7, 4.5];
    } else if (room.beds === 'QQ') {
      bed(1.46, 0.85, 3.49, 2.4); bed(1.46, 3.2, 3.49, 4.75);
      lamps = [2.8];
    } else {
      bed(1.59, 2.3, 3.49, 3.67);
      lamps = [1.95, 4.05];
    }
    /* ---- nightstands and their lamps ---- */
    for (const z of lamps) {
      b.solid(3.02, 0, z - 0.27, SX1, 0.58, z + 0.27, T.wood, [0, 0, 32, 32], ['ny']);
      b.solid(3.2, 0.58, z - 0.05, 3.3, 0.96, z + 0.05, T.lampBase, [0, 0, 16, 16]);
      b.box(3.08, 0.96, z - 0.17, 3.42, 1.24, z + 0.17, { all: { tex: T.lampShade, uv: [0, 0, 16, 16], flags: F_EMIT }, ny: null });
    }
    // the phone on the first stand, and an ashtray or a no-smoking card
    const z0 = lamps[0];
    b.box(3.05, 0.58, z0 + 0.1, 3.22, 0.66, z0 + 0.25, { all: { tex: T.phoneRoom, uv: [0, 0, 16, 16] } });
    if (room.smoking) b.solid(3.06, 0.58, z0 - 0.24, 3.18, 0.61, z0 - 0.12, T.ashtray, [0, 0, 16, 16]);

    /* ---- dresser and the television ---- */
    b.box(SX0, 0, 2.3, 0.58, 0.76, 3.9, {
      all: { tex: T.wood, uv: [0, 0, 64, 32] },
      px: { tex: T.tvWood, uv: [0, 0, 32, 32] }, ny: null, nx: null,
    });
    b.box(0.1, 0.76, 2.85, 0.58, 1.2, 3.35, {
      all: { tex: T.tvShell, uv: [0, 0, 32, 32] },
      px: { tex: T.tvScreenRoom, uv: [0, 0, 32, 32] },
    });
    b.solid(0.25, 1.2, 3.05, 0.3, 1.34, 3.08, T.chrome, [0, 0, 8, 8]);     // rabbit ears
    b.solid(0.25, 1.2, 3.12, 0.3, 1.32, 3.15, T.chrome, [0, 0, 8, 8]);
    if (!room.smoking) b.box(0.12, 0.76, 2.45, 0.2, 0.88, 2.6, { all: { tex: T.noSmoking, uv: [0, 0, 16, 16] } });
    // the ice bucket on the dresser, where it always is
    b.solid(0.25, 0.76, 3.55, 0.45, 0.94, 3.75, T.iceBucket, [0, 0, 16, 16], ['ny']);
    // luggage rack by the door
    b.solid(SX0 + 0.02, 0.44, 1.2, 0.62, 0.5, 1.8, T.wood, [0, 0, 32, 8]);
    b.solid(SX0 + 0.05, 0, 1.25, 0.1, 0.44, 1.3, T.chrome, [0, 0, 8, 8]);
    b.solid(0.54, 0, 1.7, 0.59, 0.44, 1.75, T.chrome, [0, 0, 8, 8]);
    // table and chair by the window, where there is room for one
    if (room.beds !== 'QQ') {
      b.solid(3.1, 0, 0.84, 3.16, 0.7, 0.9, T.chrome, [0, 0, 8, 8]);
      b.solid(2.85, 0.7, 0.62, 3.4, 0.74, 1.14, T.formica, [0, 0, 32, 32]);
      b.solid(2.3, 0.42, 0.7, 2.72, 0.48, 1.1, T.vinylOrange, [0, 0, 32, 32]);
      b.solid(2.3, 0.48, 0.66, 2.72, 0.95, 0.72, T.vinylOrange, [0, 0, 32, 32]);
      b.solid(2.48, 0, 0.88, 2.54, 0.42, 0.94, T.chrome, [0, 0, 8, 8]);
    }
    /* ---- art: over the beds, and over the dresser ---- */
    panel(b, SX1 - 0.02, 1.42, lamps.length === 1 ? 2.8 : 3.1, 1.0, 0.5, -Math.PI / 2, art);
    panel(b, SX0 + 0.02, 1.45, 3.1, 0.9, 0.62, Math.PI / 2, T.mirror);

    /* ---- the bathroom ---- */
    b.box(SX0, 0, 5.12, 0.8, 0.5, BZ, {
      all: { tex: T.porcelain, uv: [0, 0, 32, 32] },
      py: { tex: T.tubInner, uv: [0, 0, 32, 32] }, ny: null,
    });
    sign(b, 0.82, 0.55, (5.12 + BZ) / 2, BZ - 5.12, 1.5, Math.PI / 2, T.showerCurtain);
    b.solid(1.38, 0, 6.55, 1.72, 0.4, 6.98, T.porcelain, [0, 0, 32, 32], ['ny']);
    b.solid(1.35, 0.4, 6.98, 1.75, 0.8, BZ, T.porcelain, [0, 0, 32, 32], ['ny']);
    b.solid(1.36, 0.4, 6.55, 1.74, 0.43, 6.98, T.white, [0, 0, 16, 16], ['ny']);
    // roll of paper on the wall by it
    b.solid(1.05, 0.62, 6.9, 1.12, 0.72, 7.02, T.white, [0, 0, 16, 16]);
    b.box(1.0, 2.5, 5.9, 1.3, 2.58, 6.2, { all: { tex: T.lightPanel, uv: [0, 0, 64, 64], flags: F_EMIT }, py: null });

    /* ---- the vanity, out in its alcove ---- */
    b.box(2.08, 0, 6.55, SX1, 0.84, BZ, {
      all: { tex: T.wood, uv: [0, 0, 64, 32] },
      py: { tex: T.vanityTop, uv: [0, 0, 32, 32] }, pz: null, ny: null,
    });
    panel(b, (2.08 + SX1) / 2, 1.05, BZ - 0.01, 1.2, 0.8, Math.PI, T.mirror);
    b.box(2.4, 1.9, BZ - 0.06, 3.2, 1.98, BZ, { all: { tex: T.lightPanel, uv: [0, 0, 64, 16], flags: F_EMIT } });
    panel(b, SX1 - 0.01, 0.9, 5.55, 0.42, 0.62, -Math.PI / 2, T.towel);
    // a wire rack with the spare towels over the tub end
    b.solid(2.1, 1.75, 5.1, SX1 - 0.02, 1.78, 5.45, T.chrome, [0, 0, 8, 8]);
    b.solid(2.2, 1.78, 5.12, 2.8, 1.9, 5.42, T.towel, [0, 0, 16, 32]);
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
