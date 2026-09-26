/* ============================================================
   layout.js -- the Starlite Motor Lodge, on paper.

   Everything that has a position is decided here once and read by
   the mesh builder, the collision, the navigation graph, the
   lighting, the room model and the people. Nothing else in the
   game invents a coordinate.

   Site plan, meters. +X east, +Z north, +Y up.

                              N
         [114][115][LAUNDRY][MAINT][ICE]          z 31..38.2  (north block)
         ....covered walk....................      z 29.5..31
    107 |        [   POOL, fenced   ]        | 108
    106 |                                    | 109
    105 |  stalls   drive lane    stalls     | 110
    104 |                                    | 111
    103 |                                    | 112
    102 |                                    | 113
    101 |  [office stalls]                   |  S2 stair
     S1 |  [ OFFICE: lobby / desk / breakfast / pantry / back office ]
        |          z -14 .. 0
    ================ HIGHWAY 71 ================      z -26 .. -17

   West wing: 101-107 downstairs, 201-207 up.  East wing: 108-113
   down, 208-213 up. 114 and 115 are the poolside pair in the north
   block. Twenty-eight rooms, and yes, one of them is 213.
   ============================================================ */

export const EYE = 1.62;
export const FLOOR2 = 2.9;          // upstairs floor / upper walkway height
export const ROOM_W = 3.6, ROOM_D = 7.2, ROOM_H = 2.6;

/* ---------------- the office building ---------------- */
export const OFFICE = { x0: -8, x1: 8, z0: -14, z1: 0, H: 2.8 };
export const LOBBY = { x0: -1, x1: 8, z0: -7, z1: 0 };
/** The front desk. The clerk stands on the south side, facing north through the glass. */
export const DESK = { x0: -1, x1: 6.3, z0: -5.0, z1: -4.2, y: 1.06 };
export const BREAKFAST = { x0: -8, x1: -1, z0: -8, z1: 0 };
export const BACKOFFICE = { x0: -1, x1: 8, z0: -14, z1: -7 };
export const PANTRY = { x0: -8, x1: -1, z0: -14, z1: -8 };
/** The archway between the lobby and the breakfast room, in the x = -1 wall. */
export const ARCH = { z0: -3.8, z1: -1.2 };

/* ---------------- the grounds ---------------- */
export const HIGHWAY = { z0: -26, z1: -17 };
export const LOT = { x0: -24, x1: 24, z0: -16.5, z1: 40 };
export const WEST = { facade: -14, back: -21.2, walk: -12, z0: 4, n: 7 };
export const EAST = { facade: 14, back: 21.2, walk: 12, zTop: 29.2, n: 6 };
export const NORTH = { facade: 31, back: 38.2, x0: -9, x1: 9, walkZ: 29.5 };
export const POOL = { x0: -4, x1: 4, z0: 22.2, z1: 27.8, fence: { x0: -6.4, x1: 6.4, z0: 20.6, z1: 29.4 } };
export const POOL_GATE = { x0: -0.55, x1: 0.55, z: 20.6 };
export const POOL_GATE_N = { x0: -0.55, x1: 0.55, z: 29.4 };
export const DUMPSTER = { x0: 15.4, x1: 18.6, z0: 1.4, z1: 4.4 };
export const SIGN_POS = { x: -17.5, z: -14.2 };

/* Stairs: a ramp for everybody's feet, steps for everybody's eyes. */
export const STAIRS = [
  { id: 'S1', x0: -13.7, x1: -12.3, z0: -1.2, z1: 4.0, axis: 'z', bottom: -1.2, top: 4.0 },
  { id: 'S2', x0: 12.3, x1: 13.7, z0: 2.4, z1: 7.6, axis: 'z', bottom: 2.4, top: 7.6 },
];

/* ---------------- the rooms ----------------
   Each room has a local frame: origin on the facade at the room's
   left edge as you face the door from outside, local +X along the
   facade, local +Z into the room. `yaw` rotates local into world. */

/* What each room is like. Guests do not know any of this until they
   have stayed in it; the clerk learns it from the notes in the system
   and from what people say in the morning. */
const TRAITS = {
  101: { beds: 'D', traits: ['office'], note: 'Closest to the office. Some highway noise.' },
  102: { beds: 'D', traits: [], note: 'Weekly. H. Tate.' },
  103: { beds: 'QQ', traits: ['basic'], note: 'Nothing wrong with it. Never has been.' },
  104: { beds: 'K', traits: ['noisyAC'], note: 'AC rattles. Maint. says "it\'s fine."' },
  105: { beds: 'K', traits: ['quiet'], note: 'Quiet end of the row. Mr. Maddox\'s room.' },
  106: { beds: 'QQ', traits: ['adjoin'], adj: '107', note: 'Adjoins 107.' },
  107: { beds: 'K', traits: ['adjoin'], adj: '106', note: 'Adjoins 106.' },
  108: { beds: 'QQ', traits: ['ice'], note: 'Next to the ice machine. You will hear it.' },
  109: { beds: 'K', traits: [], note: '' },
  110: { beds: 'D', traits: ['smoke', 'smell'], smoking: true, note: 'Smoking. Smells like it.' },
  111: { beds: 'QQ', traits: ['smoke'], smoking: true, note: 'Smoking.' },
  112: { beds: 'K', traits: ['renovated'], note: 'Redone in August. New carpet, new spread. Charge the full rate.' },
  113: { beds: 'QQ', traits: ['stairs'], note: 'By the east stairs. Foot traffic.' },
  114: { beds: 'QQ', traits: ['poolside'], note: 'Poolside.' },
  115: { beds: 'K', traits: ['poolside'], note: 'Poolside. Mrs. Abernathy (weekly).' },
  201: { beds: 'K', traits: ['tv'], note: 'Best TV reception on the property. Nobody knows why.' },
  202: { beds: 'QQ', traits: [], note: '' },
  203: { beds: 'QQ', traits: ['basic'], note: '' },
  204: { beds: 'K', traits: ['rollaway'], note: 'Big enough for a rollaway.' },
  205: { beds: 'K', traits: ['quiet'], note: 'Quiet. Over 105.' },
  206: { beds: 'D', traits: [], note: 'Weekly. D. Pike.' },
  207: { beds: 'QQ', traits: ['shower'], note: 'Shower pressure is weak. Warn them or don\'t.' },
  208: { beds: 'QQ', traits: ['ice', 'stairs'], note: 'Over the ice machine.' },
  209: { beds: 'K', traits: ['smoke'], smoking: true, note: 'Smoking.' },
  210: { beds: 'QQ', traits: ['drip'], note: 'Bathroom faucet drips. Work order in.' },
  211: { beds: 'QQ', traits: [], note: '' },
  212: { beds: 'K', traits: [], note: '' },
  213: { beds: 'K', traits: ['213'], note: 'It is a number. People need to get over it. -J.' },
};

export const TRAIT_LABEL = {
  office: 'NR OFFICE', basic: 'STANDARD', noisyAC: 'AC NOISY', quiet: 'QUIET', adjoin: 'ADJOINS',
  ice: 'NR ICE', smoke: 'SMOKING', smell: 'SMOKE SMELL', renovated: 'REMODEL', stairs: 'NR STAIRS',
  poolside: 'POOLSIDE', tv: 'BEST TV', rollaway: 'ROLLAWAY OK', shower: 'LOW PRESSURE',
  drip: 'FAUCET DRIP', 213: '213',
};
export const BED_LABEL = { K: '1 KING', QQ: '2 QUEEN', D: '1 DOUBLE' };

function makeRoom(no, wing, lv, ox, oz, yaw, idx) {
  const t = TRAITS[no] || { beds: 'K', traits: [] };
  const doorHi = idx % 2 === 0;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const y = lv ? FLOOR2 : 0;
  const room = {
    no: String(no), wing, lv, y, ox, oz, yaw, c, s,
    beds: t.beds, traits: t.traits.slice(), smoking: !!t.smoking, adj: t.adj || null,
    note: t.note || '',
    doorHi,
    door: doorHi ? { x0: 2.35, x1: 3.25 } : { x0: 0.35, x1: 1.25 },
    win: doorHi ? { x0: 0.35, x1: 1.9 } : { x0: 1.7, x1: 3.25 },
  };
  // world bounds of the interior footprint
  const pts = [[0, 0], [ROOM_W, 0], [ROOM_W, ROOM_D], [0, ROOM_D]].map(([lx, lz]) => toWorld(room, lx, lz));
  room.x0 = Math.min(...pts.map((p) => p[0])); room.x1 = Math.max(...pts.map((p) => p[0]));
  room.z0 = Math.min(...pts.map((p) => p[1])); room.z1 = Math.max(...pts.map((p) => p[1]));
  const dm = (room.door.x0 + room.door.x1) / 2;
  const [dx, dz] = toWorld(room, dm, -1.0);
  room.outside = { x: dx, z: dz };                 // where you stand to knock
  const [ix, iz] = toWorld(room, dm, 1.1);
  room.inside = { x: ix, z: iz };                  // just inside the door
  // the middle of the aisle between the dresser and the beds
  const [bx, bz] = toWorld(room, doorHi ? ROOM_W - 1.05 : 1.05, 3.2);
  room.center = { x: bx, z: bz };
  const [hx, hz] = toWorld(room, room.door.x0, 0);
  room.hinge = { x: hx, z: hz };
  room.faceOut = Math.atan2(-s, -c);               // yaw facing out of the door
  const [px, pz] = toWorld(room, ROOM_W / 2, -4.75);
  room.stall = { x: px, z: pz, yaw: Math.atan2(s, c) };  // nose to the building
  return room;
}

/** local room coords -> world x, z */
export function toWorld(room, lx, lz) {
  // local +X maps to (cos yaw, -sin yaw), local +Z to (sin yaw, cos yaw)
  return [room.ox + lx * room.c + lz * room.s, room.oz - lx * room.s + lz * room.c];
}
/** world x, z -> local room coords */
export function toLocal(room, x, z) {
  const dx = x - room.ox, dz = z - room.oz;
  return [dx * room.c - dz * room.s, dx * room.s + dz * room.c];
}

export const ROOMS = [];
for (let i = 0; i < WEST.n; i++) {
  const z0 = WEST.z0 + i * ROOM_W;
  ROOMS.push(makeRoom(101 + i, 'W', 0, WEST.facade, z0, -Math.PI / 2, i));
  ROOMS.push(makeRoom(201 + i, 'W', 1, WEST.facade, z0, -Math.PI / 2, i));
}
for (let j = 0; j < EAST.n; j++) {
  const z1 = EAST.zTop - j * ROOM_W;
  ROOMS.push(makeRoom(108 + j, 'E', 0, EAST.facade, z1, Math.PI / 2, j));
  ROOMS.push(makeRoom(208 + j, 'E', 1, EAST.facade, z1, Math.PI / 2, j));
}
ROOMS.push(makeRoom(114, 'N', 0, -9.0, NORTH.facade, 0, 1));
ROOMS.push(makeRoom(115, 'N', 0, -5.4, NORTH.facade, 0, 0));
ROOMS.sort((a, b) => Number(a.no) - Number(b.no));
export const ROOM_BY_NO = Object.fromEntries(ROOMS.map((r) => [r.no, r]));

/* The rest of the north block: the guest laundry, the maintenance room
   and the ice and vending alcove, west to east. */
export const LAUNDRY = { x0: -1.8, x1: 1.8, z0: NORTH.facade, z1: NORTH.back, door: { x0: -0.5, x1: 0.4 } };
export const MAINT = { x0: 1.8, x1: 5.4, z0: NORTH.facade, z1: NORTH.back, door: { x0: 2.3, x1: 3.2 } };
export const ALCOVE = { x0: 5.4, x1: 9.0, z0: NORTH.facade, z1: NORTH.facade + 3.4 };

/* ---------------- doors ----------------
   Every door that opens. `a` is the closed angle of the leaf (local +X
   of the leaf mesh, rotated), `into` which way it swings. */
export const DOORS = [
  { id: 'lobby', kind: 'glass', hx: 3.45, hz: 0, a: 0, w: 1.0, h: 2.15, into: [0, -1], lv: 0, auto: true, bell: true },
  { id: 'backoffice', kind: 'interior', hx: 5.25, hz: -7, a: 0, w: 0.9, h: 2.05, into: [0, -1], lv: 0, staff: true },
  { id: 'pantry', kind: 'interior', hx: -2.45, hz: -8, a: 0, w: 0.9, h: 2.05, into: [0, -1], lv: 0, staff: true },
  { id: 'pantry2', kind: 'interior', hx: -1, hz: -11.1, a: Math.PI / 2, w: 0.9, h: 2.05, into: [-1, 0], lv: 0, staff: true },
  { id: 'laundry', kind: 'room', hx: LAUNDRY.door.x0, hz: NORTH.facade, a: 0, w: 0.9, h: 2.1, into: [0, 1], lv: 0, auto: true, label: 'LAUNDRY' },
  { id: 'maint', kind: 'steel', hx: MAINT.door.x0, hz: NORTH.facade, a: 0, w: 0.9, h: 2.1, into: [0, 1], lv: 0, staff: true, label: 'SUPPLY ROOM' },
];
for (const r of ROOMS) {
  const [hx, hz] = toWorld(r, r.door.x0, 0);
  // the leaf runs along local +X, which is world yaw `r.yaw`, and swings into the room
  DOORS.push({
    id: 'r' + r.no, kind: 'room', room: r.no, hx, hz, a: r.yaw, w: r.door.x1 - r.door.x0, h: 2.1,
    into: [r.s, r.c], lv: r.lv, y: r.y,
  });
}
export const DOOR_BY_ID = Object.fromEntries(DOORS.map((d) => [d.id, d]));

/* The pool gates are gates, not doors: waist high, and they swing shut
   on their own the way the county inspector likes. */
export const GATES = [
  { id: 'gateS', hx: POOL_GATE.x0, hz: POOL_GATE.z, a: 0, w: 1.1, into: [0, 1] },
  { id: 'gateN', hx: POOL_GATE_N.x0, hz: POOL_GATE_N.z, a: 0, w: 1.1, into: [0, -1] },
];

/* ---------------- the desk and what is on it ----------------
   The counter top is at DESK.y. Things the clerk works are reached from
   the south side; the bell and the key drop from the north. */
const dy = DESK.y;
export const DESK_PROPS = {
  bell: { x: 2.0, z: -4.34, label: 'DESK BELL' },
  terminal: { x0: 1.05, x1: 1.75, z0: -4.95, z1: -4.35, y0: dy, y1: dy + 0.52, label: 'TERMINAL' },
  printer: { x0: 0.05, x1: 0.6, z0: -4.98, z1: -4.6, y0: dy, y1: dy + 0.16, label: 'PRINTER' },
  phone: { x0: 2.7, x1: 3.12, z0: -4.95, z1: -4.55, y0: dy, y1: dy + 0.12, label: 'PHONE' },
  wakeup: { x0: 3.3, x1: 3.62, z0: -4.95, z1: -4.55, y0: dy, y1: dy + 0.03, label: 'WAKE-UP SHEET' },
  cards: { x0: 3.78, x1: 4.02, z0: -4.9, z1: -4.62, y0: dy, y1: dy + 0.05, label: 'REG. CARDS' },
  imprinter: { x0: 4.2, x1: 4.62, z0: -4.95, z1: -4.62, y0: dy, y1: dy + 0.07, label: 'IMPRINTER' },
  register: { x0: 4.9, x1: 5.42, z0: -4.98, z1: -4.46, y0: dy, y1: dy + 0.34, label: 'REGISTER' },
  binder: { x0: 5.62, x1: 5.98, z0: -4.95, z1: -4.62, y0: dy, y1: dy + 0.06, label: 'BINDER' },
  keydrop: { x0: 5.9, x1: 6.25, z0: -4.4, z1: -4.2, y0: dy, y1: dy + 0.3, label: 'KEY DROP' },
  stool: { x: 2.3, z: -5.9 },
};
/** The key rack, on the wall behind the clerk. Four rows of seven. */
export const BOARD = { x0: 0.25, x1: 3.95, y0: 0.98, y1: 2.12, z: -6.95 };

/* ---------------- back office / pantry furniture ---------------- */
export const LINEN = { x0: 0.6, x1: 4.2, z0: -13.9, z1: -13.35, top: 1.95 };
export const SUPPLY = { x0: 4.6, x1: 5.8, z0: -13.9, z1: -13.4, top: 1.95 };
export const MGR_DESK = { x0: 5.7, x1: 7.7, z0: -10.4, z1: -9.5, y: 0.76 };
export const PANTRY_SHELF = { x0: -7.9, x1: -7.35, z0: -13.6, z1: -9.0, top: 2.0 };
export const FRIDGE = { x0: -3.4, x1: -2.6, z0: -13.95, z1: -13.2, top: 1.75 };
export const ROLLAWAY_HOME = { x: 7.2, z: -12.8, yaw: Math.PI / 2 };

/* ---------------- breakfast room ---------------- */
export const BFAST_COUNTER = { x0: -7.95, x1: -7.2, z0: -7.4, z1: -1.2, y: 0.92 };
/* Stations along the counter, south to north. `slot` stations hold food. */
export const STATIONS = [
  { id: 'coffee', z: -6.85, label: 'COFFEE' },
  { id: 'decaf', z: -6.3, label: 'DECAF' },
  { id: 'water', z: -5.8, label: 'HOT WATER' },
  { id: 'juice', z: -5.15, label: 'JUICE' },
  { id: 'cereal', z: -4.45, label: 'CEREAL', slot: true },
  { id: 'pastry', z: -3.75, label: 'MUFFINS', slot: true },
  { id: 'bagels', z: -3.1, label: 'BAGELS & TOAST', slot: true },
  { id: 'fruit', z: -2.5, label: 'FRUIT', slot: true },
  { id: 'waffle', z: -1.75, label: 'WAFFLES' },
];
export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
export const BTABLES = [
  { x: -5.2, z: -6.0 }, { x: -2.8, z: -6.0 }, { x: -5.2, z: -3.3 }, { x: -2.8, z: -3.3 },
];
/** Two seats a table, east and west of it. */
export const SEATS = [];
BTABLES.forEach((t, ti) => {
  SEATS.push({ table: ti, x: t.x - 0.62, z: t.z, yaw: Math.PI / 2 });
  SEATS.push({ table: ti, x: t.x + 0.62, z: t.z, yaw: -Math.PI / 2 });
});
export const BTV = { x: -4.0, y: 2.05, z: -7.72, yaw: 0 };
export const NEWS_RACK = { x0: -1.6, x1: -1.1, z0: -7.9, z1: -7.4 };
export const BTRASH = { x0: -1.6, x1: -1.1, z0: -0.7, z1: -0.25 };

/* ---------------- things outside ---------------- */
export const ICE_MACHINE = { x0: 7.7, x1: 8.8, z0: 33.4, z1: 34.3, top: 1.9 };
/* The vending machines. `yaw` is the way the front faces (pi: south, out of
   the alcove; pi/2: east, into the laundry). w, d and h are the cabinet's
   width across the front, depth and height. */
export const VENDING = [
  { id: 'soda', x0: 5.6, x1: 6.5, z0: 33.6, z1: 34.35, top: 1.85, yaw: Math.PI, w: 0.9, d: 0.75, h: 1.85 },
  { id: 'snack', x0: 6.6, x1: 7.5, z0: 33.6, z1: 34.35, top: 1.85, yaw: Math.PI, w: 0.9, d: 0.75, h: 1.85 },
  // the soap machine, on the laundry's west wall, facing the washers' aisle
  { id: 'soap', x0: -1.74, x1: -1.3, z0: 34.3, z1: 35.0, top: 1.6, yaw: Math.PI / 2, w: 0.7, d: 0.44, h: 1.6 },
];
export const VEND_BY_ID = Object.fromEntries(VENDING.map((v) => [v.id, v]));
/** The supply room's shelf of cases and boxes for the machines, just inside its door. */
export const VEND_SHELF = { x0: 1.9, x1: 2.5, z0: 32.0, z1: 34.4, top: 1.9 };
export const NEWS_DROP = { x: 5.4, z: 1.6 };
/** Sodium lights on poles, and the lamps on the buildings. */
export const POLES = [
  { x: -6.8, z: 9.5 }, { x: 6.8, z: 9.5 }, { x: -6.8, z: 19.5 }, { x: 6.8, z: 19.5 },
  { x: -9.5, z: -10.0 }, { x: 10.2, z: -8.0 },
];

/* ---------------- parking ---------------- */
export const OFFICE_STALLS = [
  { id: 'O0', x: 1.3, z: 3.1, yaw: Math.PI, office: true }, { id: 'O1', x: 6.7, z: 3.1, yaw: Math.PI, office: true },
];
/** Where cars come off the highway, and how they get round the lot. */
/* Westbound traffic keeps to the north lane (z -19.2), which is the motel's
   side of the road: arrivals come in from the east and turn right, and
   leavers turn right again and head west. */
export const DRIVE = {
  enterFrom: { x: 60, z: -19.2 },
  gate: { x: 10.3, z: -17.2 },
  inLane: { x: 10.3, z: -2 },
  hub: { x: 3.2, z: 7.0 },
  laneW: { x: -3.4, z: 12 },
  laneE: { x: 3.4, z: 12 },
  outLane: { x: -10.3, z: 1.0 },
  outGate: { x: -10.3, z: -17.2 },
  exitTo: { x: -70, z: -19.2 },
  bus: { x: -1.2, z: 15.0, yaw: 0 },
  laneWB: -19.2, laneEB: -22.4,
};
/* One stall per ground-floor room; upstairs rooms park in front of the room
   below. 114 and 115 have none of their own and use the north end of the rows. */
export const STALLS = [];
for (let i = 0; i < 7; i++) STALLS.push({ id: 'W' + i, x: -9.1, z: 4 + 1.8 + i * 3.6, yaw: -Math.PI / 2, lane: -3.4 });
for (let j = 0; j < 6; j++) STALLS.push({ id: 'E' + j, x: 9.1, z: 29.2 - 1.8 - j * 3.6, yaw: Math.PI / 2, lane: 3.4 });
/* When every room's stall is taken, people park down the middle of the lot. */
export const OVERFLOW = [];
for (let k = 0; k < 4; k++) {
  OVERFLOW.push({ id: 'MW' + k, x: -1.25, z: 6.2 + k * 3.6, yaw: Math.PI / 2, lane: -3.4 });
  OVERFLOW.push({ id: 'ME' + k, x: 1.25, z: 6.2 + k * 3.6, yaw: -Math.PI / 2, lane: 3.4 });
}


/* ---------------- spots people are steered to ---------------- */
export const SPOTS = {
  clerk: { x: 2.3, z: -5.55, yaw: 0 },
  playerStart: { x: 6.3, z: -10.6, yaw: Math.PI * 0.7 },
  guestDesk: { x: 2.9, z: -3.55, yaw: Math.PI },
  queue: [{ x: 4.3, z: -2.6 }, { x: 5.4, z: -1.9 }, { x: 6.5, z: -1.2 }, { x: 7.2, z: -0.6 }],
  lobbyIn: { x: 4.0, z: -0.9 },
  lobbyOut: { x: 4.0, z: 1.2 },
  lobbyChairs: [{ x: 7.2, z: -3.4, yaw: -Math.PI / 2 }, { x: 7.2, z: -2.5, yaw: -Math.PI / 2 }],
  lobbyCoffee: { x: 7.0, z: -0.7, yaw: Math.PI / 2 },
  bfastLine: { x: -6.4, z: -4.0 },
  bfastDoor: { x: -1.6, z: -2.5 },
  handoff: { x: 3.0, z: -3.5 },
  housekeepIn: { x: 5.8, z: -8.6 },
  poolDeck: { x: 3.2, z: 28.0, yaw: Math.PI },
  iceStand: { x: 8.25, z: 32.6, yaw: 0 },
  vendStand: { x: 6.05, z: 32.8, yaw: 0 },
  snackStand: { x: 7.05, z: 32.8, yaw: 0 },
  soapStand: { x: -0.75, z: 34.65, yaw: -Math.PI / 2 },
  laundryIn: { x: 0.8, z: 33.5 },
};

/* ---------------- places ----------------
   Used for footsteps, ambience and "where is the player". */
export function zoneAt(x, z, lv) {
  if (lv === 0 && x > OFFICE.x0 && x < OFFICE.x1 && z > OFFICE.z0 && z < OFFICE.z1) {
    if (x > LOBBY.x0 && z > LOBBY.z0) return z < DESK.z0 ? 'desk' : 'lobby';
    if (x < BREAKFAST.x1 && z > BREAKFAST.z0) return 'breakfast';
    if (x < PANTRY.x1) return 'pantry';
    return 'backoffice';
  }
  for (const r of ROOMS) {
    if (r.lv === lv && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return 'room:' + r.no;
  }
  if (lv === 0 && z > NORTH.facade && z < NORTH.back) {
    if (x > LAUNDRY.x0 && x < LAUNDRY.x1) return 'laundry';
    if (x > MAINT.x0 && x < MAINT.x1) return 'maint';
    if (x > ALCOVE.x0 && x < ALCOVE.x1) return 'alcove';
  }
  return 'outside';
}
export const INDOOR = (zone) => zone !== 'outside' && zone !== 'alcove';

export function roomAt(x, z, lv) {
  for (const r of ROOMS) if (r.lv === lv && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return r;
  return null;
}
