/* ============================================================
   people.js -- who comes to the Starlite.

   Every named person here is built the way Final Rental built its
   regulars: a locked appearance spec and a fixed seed, so they are
   the same face in the same coat every time they walk in (Final
   Rental's specials.js fixedApp, carried over below). A regular is
   somebody you recognize across the lot before they reach the door.

   Most of these people have nothing to do with anything. They are
   here because they are driving somewhere, or live here now, or
   their kitchen ceiling came down. That is the point of them.

   Dialogue lives in dialogue/; what is here is who they are, what
   they want from a room, how they pay, and when they do things.
   ============================================================ */
import { makeRng } from '../../engine/mathx.js';
import {
  randomAppearance, HEIGHTS, BUILDS, FACIAL, GLASSES, HATS, MARKS, GAITS, CARRY, SMELLS, VOICES,
} from '../appearance.js';
import { Clock } from '../sim/clock.js';

const find = (tbl, id) => tbl.find((t) => t.id === id) || tbl[0];
const col = (id, name, hex) => ({ id, name, hex });
const at = Clock.at;

/** Final Rental's fixedApp: one locked-down appearance from a fixed seed. */
export function fixedApp(seed, spec) {
  const rng = makeRng(seed);
  const a = randomAppearance(rng, { gender: spec.gender || 'm' });
  if (spec.height) a.height = typeof spec.height === 'object' ? spec.height : find(HEIGHTS, spec.height);
  if (spec.build) a.build = find(BUILDS, spec.build);
  if (spec.facial) a.facial = find(FACIAL, spec.facial);
  if (spec.glasses) a.glasses = find(GLASSES, spec.glasses);
  if (spec.hat) a.hat = find(HATS, spec.hat);
  if (spec.mark) a.mark = find(MARKS, spec.mark);
  if (spec.gait) a.gait = find(GAITS, spec.gait);
  if (spec.carry) a.carry = find(CARRY, spec.carry);
  if (spec.smell) a.smell = find(SMELLS, spec.smell);
  if (spec.voice) a.voice = find(VOICES, spec.voice);
  if (spec.skin) a.skin = spec.skin;
  if (spec.hair) {
    a.hair = {
      id: spec.hair.id, color: col(spec.hair.id, spec.hair.name, spec.hair.hex),
      style: { id: spec.hair.style, name: spec.hair.styleName || spec.hair.style },
      label: spec.hair.label || '', bulletin: spec.hair.bulletin || '',
    };
    a.hair.color.dark = spec.hair.dark;
  }
  if (spec.jacket) {
    a.jacket = {
      id: spec.jacket.id, color: col(spec.jacket.id, spec.jacket.name, spec.jacket.hex), kind: spec.jacket.kind,
      label: `${spec.jacket.name[0].toUpperCase() + spec.jacket.name.slice(1)} ${spec.jacket.kind}`,
      bulletin: `a ${spec.jacket.name} ${spec.jacket.kind}`,
    };
  }
  if (spec.pants) {
    a.pants = {
      id: spec.pants.id, color: col(spec.pants.id, spec.pants.name, spec.pants.hex),
      label: `${spec.pants.name[0].toUpperCase() + spec.pants.name.slice(1)} pants`, bulletin: `${spec.pants.name} pants`,
    };
  }
  if (spec.shirt) a.shirt = col(spec.shirt.id, spec.shirt.name, spec.shirt.hex);
  if (spec.tie) a.tie = spec.tie;
  if (spec.bagColor) a.bagColor = spec.bagColor;
  return a;
}

/** A child: the same rig, scaled down, with a child's walk. */
export const CHILD_HEIGHT = { id: 'child', label: 'A child', bulletin: 'a kid', scale: 0.62 };

const H = (id, name, hex, dark, style, styleName) => ({ id, name, hex, dark, style, styleName: styleName || style });
const J = (id, name, hex, kind) => ({ id, name, hex, kind });
const C = (id, name, hex) => ({ id, name, hex });

/* ============================================================
   THE ROSTER
   kind: regular | resident | oneoff | cameo | crew | family | traveler | local | staff
   stay: what they want from a room, and how they pay for it
   volunteers: what they tell you without being asked
   ============================================================ */
export const PEOPLE = [
  /* ---------------- regulars ---------------- */
  {
    id: 'EARL', name: 'Earl Maddox', tag: 'restaurant equipment, the I-49 corridor',
    kind: 'regular', seed: 0x5EA11, priorStays: 11,
    app: {
      gender: 'm', height: 'tall', build: 'heavy', facial: 'mustache', glasses: 'none', hat: 'none',
      gait: 'normal', carry: 'briefcase', voice: 'raspy',
      hair: H('gray', 'gray', '#8d8a84', '#6a6862', 'short', 'short, going thin'),
      jacket: J('tan', 'tan', '#8a7148', 'sport coat'), shirt: C('blue', 'pale blue', '#6a7a9a'),
      pants: C('brown', 'brown', '#4a3a24'), skin: '#d8ab84', tie: '#6a2a24',
    },
    stay: {
      party: 1, nights: 1, beds: 'K', smoking: false, wants: ['quiet'], prefRoom: '105', pay: 'CARD',
      card: { type: 'VISA', name: 'EARL T MADDOX', exp: '06/99' }, rateCode: 'RACK', reservation: true,
      vehicle: { color: 'maroon', kind: 'sedan', desc: 'Maroon Buick LeSabre', plate: 'LA 4TK 219' },
    },
    volunteers: ['reservation', 'party', 'nights'],
    schedule: { arrive: [at(20, 5), at(20, 35)], bed: [at(22, 45), at(23, 15)], wake: at(5, 40), breakfast: [at(6, 2), at(6, 12)], checkout: [at(6, 30), at(6, 45)] },
    breakfast: { coffee: 'regular', food: 'pastry', lingers: 14 },
  },
  {
    id: 'KYLE', name: 'Kyle Mercer', tag: 'is renovating a house',
    kind: 'regular', seed: 0xB7A5E, priorStays: 3, partner: 'DANA',
    app: {
      gender: 'm', height: 'average', build: 'average', facial: 'stubble', glasses: 'none', hat: 'cap',
      gait: 'brisk', carry: 'none', voice: 'loud',
      hair: H('lightbrown', 'light brown', '#6b4a2c', '#4d341e', 'short'),
      jacket: J('flannel', 'red', '#7a2a24', 'flannel shirt'), shirt: C('gray', 'gray', '#6a6a6a'),
      pants: C('denim', 'denim blue', '#33507a'), skin: '#e0b394',
    },
    stay: {
      party: 2, nights: 2, beds: 'K', smoking: false, wants: ['nearOffice'], pay: 'CASH', rateCode: 'RACK',
      vehicle: { color: 'white', kind: 'pickup', desc: 'White Ford F-150, drywall in the bed', plate: 'LA 7BN 404' },
    },
    volunteers: ['party'],
    schedule: { arrive: [at(21, 25), at(21, 55)], bed: [at(24, 30), at(25, 0)], breakfast: [at(6, 15), at(6, 30)], checkout: null },
    breakfast: { coffee: 'regular', food: 'waffle', lingers: 16 },
  },
  {
    id: 'DANA', name: 'Dana Mercer', tag: 'is tired of the house',
    kind: 'regular', seed: 0xDA7A, priorStays: 3, partner: 'KYLE', companion: true,
    app: {
      gender: 'f', height: 'average', build: 'thin', facial: 'clean', glasses: 'none', hat: 'none',
      gait: 'normal', carry: 'suitcase', voice: 'flat', bagColor: '#5a2a2a',
      hair: H('brown', 'dark brown', '#3d2a1a', '#2a1c11', 'ponytail'),
      jacket: J('denim', 'denim', '#33507a', 'denim jacket'), shirt: C('white', 'white', '#c8c4b4'),
      pants: C('black', 'black', '#1a1a1e'), skin: '#c08e63',
    },
    breakfast: { coffee: 'regular', food: 'bagels', lingers: 16 },
  },
  {
    id: 'WEXLER', name: 'Harold Wexler', tag: 'retired, taught English thirty-one years',
    kind: 'regular', seed: 0x0E71E5, priorStays: 6, inHouse: { room: '205', nights: 3, night: 2 },
    app: {
      gender: 'm', height: 'short', build: 'thin', facial: 'clean', glasses: 'round', hat: 'none',
      gait: 'stiff', carry: 'newspaper', voice: 'soft',
      hair: H('white', 'white', '#cfcac0', '#a5a099', 'bald', 'bald on top'),
      jacket: J('olive', 'olive', '#44492a', 'cardigan'), shirt: C('white', 'white', '#c8c4b4'),
      pants: C('gray', 'gray', '#4a4a50'), skin: '#e8c39e', tie: '#2a3a5a',
    },
    stay: { party: 1, nights: 3, beds: 'K', smoking: false, wants: ['quiet', 'upstairs'], pay: 'CASH', rateCode: 'RACK' },
    schedule: { bed: [at(21, 30), at(22, 0)], wake: null, early: at(5, 35), breakfast: [at(5, 58), at(6, 5)], checkout: null },
    breakfast: { coffee: 'decaf', food: 'fruit', lingers: 30, newspaper: true },
  },
  {
    id: 'TAMMY', name: 'Tammy Guidry', tag: "waitress, Peg's Diner",
    kind: 'local', seed: 0x7A3339,
    app: {
      gender: 'f', height: 'average', build: 'average', facial: 'clean', glasses: 'none', hat: 'none',
      gait: 'brisk', carry: 'none', voice: 'nasal',
      hair: H('blond', 'blond', '#b99553', '#8f7038', 'curly', 'big, and sprayed into place'),
      jacket: J('pink', 'pink', '#b86a7a', 'uniform'), shirt: C('pink', 'pink', '#b86a7a'),
      pants: C('white', 'white', '#c8c4b4'), skin: '#e8c39e',
    },
    schedule: { visit: [at(24, 20), at(25, 10)] },
  },

  /* ---------------- weekly residents ---------------- */
  {
    id: 'HOLLIS', name: 'Hollis Tate', tag: 'weekly, room 102, drove a truck for forty years',
    kind: 'resident', seed: 0x40115, priorStays: 60, inHouse: { room: '102', weekly: true, weeks: 14 },
    app: {
      gender: 'm', height: 'tall', build: 'thin', facial: 'beard', glasses: 'none', hat: 'trucker',
      gait: 'shuffle', carry: 'none', smell: 'smoke', voice: 'raspy',
      hair: H('gray', 'gray', '#8d8a84', '#6a6862', 'short'),
      jacket: J('western', 'faded blue', '#4a5a7a', 'western shirt'), shirt: C('white', 'white', '#b8b4aa'),
      pants: C('denim', 'denim blue', '#2b4368'), skin: '#c08e63',
    },
    stay: { party: 1, beds: 'D', smoking: true, pay: 'CASH', rateCode: 'WEEKLY' },
    schedule: { porch: [at(19, 40), at(22, 50)], bed: [at(23, 0), at(23, 20)], early: at(5, 20), breakfast: [at(6, 0), at(6, 40)] },
    breakfast: { coffee: 'regular', food: 'bagels', lingers: 25 },
  },
  {
    id: 'ABERNATHY', name: 'Lorraine Abernathy', tag: 'weekly, room 115, sold the house two years ago',
    kind: 'resident', seed: 0xABE7, priorStays: 90, inHouse: { room: '115', weekly: true, weeks: 104 },
    app: {
      gender: 'f', height: 'short', build: 'heavy', facial: 'clean', glasses: 'round', hat: 'none',
      gait: 'shuffle', carry: 'none', voice: 'soft',
      hair: H('white', 'white', '#cfcac0', '#a5a099', 'curly', 'curly, set on Saturdays'),
      jacket: J('lilac', 'lilac', '#7a6a8a', 'housecoat'), shirt: C('cream', 'cream', '#b6ab8c'),
      pants: C('lilac', 'lilac', '#6a5a7a'), skin: '#e8c39e',
    },
    stay: { party: 1, beds: 'K', smoking: false, pay: 'CASH', rateCode: 'WEEKLY' },
    schedule: { ice: at(20, 50), bed: [at(22, 30), at(22, 45)], early: at(5, 30), breakfast: [at(6, 5), at(6, 25)] },
    breakfast: { coffee: 'decaf', food: 'pastry', lingers: 35 },
  },
  {
    id: 'DARNELL', name: 'Darnell Pike', tag: 'weekly, room 206, Gulf States Pipeline',
    kind: 'resident', seed: 0xDA2E11, priorStays: 30, inHouse: { room: '206', weekly: true, weeks: 5 },
    app: {
      gender: 'm', height: 'tall', build: 'broad', facial: 'goatee', glasses: 'none', hat: 'none',
      gait: 'normal', carry: 'none', voice: 'low',
      hair: H('black', 'black', '#17141a', '#0d0b10', 'buzz'),
      jacket: J('carhartt', 'brown duck', '#6a4e2c', 'work coat'), shirt: C('gray', 'gray', '#5a5a5a'),
      pants: C('denim', 'denim blue', '#2b4368'), skin: '#5e3c26',
    },
    stay: { party: 1, beds: 'D', smoking: false, pay: 'DIRECT', rateCode: 'CORP', account: 'GULFSTATES' },
    schedule: { laundry: [at(22, 40), at(23, 10)], bed: [at(23, 45), at(24, 0)], wake: at(4, 45), coffee: at(5, 5), leave: at(5, 20) },
  },

  /* ---------------- the ones you will tell people about ---------------- */
  {
    id: 'PILLOWS', name: 'Gene Lowery', tag: 'seems perfectly normal',
    kind: 'oneoff', seed: 0x9111, weight: 1,
    app: {
      gender: 'm', height: 'average', build: 'average', facial: 'clean', glasses: 'square', hat: 'none',
      gait: 'normal', carry: 'suitcase', voice: 'flat', bagColor: '#2a3a5a',
      hair: H('brown', 'dark brown', '#3d2a1a', '#2a1c11', 'short', 'short, neatly parted'),
      jacket: J('navy', 'navy', '#1e2a4a', 'windbreaker'), shirt: C('white', 'white', '#c8c4b4'),
      pants: C('khaki', 'khaki', '#8a7a58'), skin: '#e0b394',
    },
    stay: { party: 1, nights: 1, beds: 'K', smoking: false, wants: [], pay: 'CASH', rateCode: 'RACK', vehicle: { color: 'silver', kind: 'sedan', desc: 'Silver Camry', plate: 'TX 8MM 330' } },
    volunteers: ['party', 'nights', 'smoking'],
    schedule: { arrive: [at(22, 10), at(23, 0)], bed: [at(24, 0), at(24, 30)], breakfast: [at(6, 20), at(6, 40)] },
    breakfast: { coffee: 'regular', food: 'cereal', lingers: 10 },
  },
  {
    id: 'STORM', name: 'Rusty Kuykendall', tag: 'is following a line of storms',
    kind: 'oneoff', seed: 0x5707, weight: 1,
    app: {
      gender: 'm', height: 'average', build: 'heavy', facial: 'beard', glasses: 'aviator', hat: 'trucker',
      gait: 'brisk', carry: 'camcorder', voice: 'loud',
      hair: H('red', 'red', '#8a3a1c', '#642713', 'mullet'),
      jacket: J('rain', 'yellow', '#a8902a', 'windbreaker'), shirt: C('black', 'black', '#26262c'),
      pants: C('olive', 'olive', '#44492a'), skin: '#e0b394',
    },
    stay: { party: 1, nights: 1, beds: 'K', smoking: false, wants: ['west'], pay: 'CARD', card: { type: 'MC', name: 'R L KUYKENDALL', exp: '09/97' }, rateCode: 'RACK', vehicle: { color: 'white', kind: 'van', side: 'storm', desc: 'White van, antennas', plate: 'OK SKY 44' } },
    volunteers: ['party', 'nights'],
    schedule: { arrive: [at(23, 20), at(24, 20)], bed: [at(26, 0), at(26, 30)], breakfast: [at(5, 55), at(6, 10)], checkout: [at(6, 15), at(6, 30)] },
    breakfast: { coffee: 'regular', food: 'pastry', lingers: 18, channel: 'WEATHER' },
  },
  {
    id: 'MAGIC', name: 'Delmar Fitch', tag: 'The Amazing Delmar, children\'s entertainer',
    kind: 'oneoff', seed: 0xDE1A, weight: 1,
    app: {
      gender: 'm', height: 'tall', build: 'thin', facial: 'goatee', glasses: 'none', hat: 'none',
      gait: 'stiff', carry: 'suitcase', voice: 'loud', bagColor: '#3a1a4a',
      hair: H('black', 'black', '#17141a', '#0d0b10', 'greasy', 'slicked back'),
      jacket: J('purple', 'purple', '#3f2247', 'suit jacket'), shirt: C('white', 'white', '#c8c4b4'),
      pants: C('black', 'black', '#1a1a1e'), skin: '#d8ab84', tie: '#c8a13a',
    },
    stay: { party: 1, nights: 1, beds: 'K', smoking: false, wants: ['groundFloor', 'nearCar'], pay: 'CASH', rateCode: 'RACK', vehicle: { color: 'white', kind: 'van', side: 'magic', desc: 'Van, THE AMAZING DELMAR on the side', plate: 'MS 2CARDS' } },
    volunteers: ['party'],
    schedule: { arrive: [at(21, 40), at(22, 40)], bed: [at(24, 30), at(25, 0)], breakfast: [at(6, 10), at(6, 30)], checkout: [at(6, 35), at(6, 55)] },
    breakfast: { coffee: 'regular', food: 'waffle', lingers: 12 },
  },
  {
    id: 'URN', name: 'Carol Haskins', tag: 'and Frank',
    kind: 'oneoff', seed: 0x0247, weight: 1,
    app: {
      gender: 'f', height: 'average', build: 'thin', facial: 'clean', glasses: 'none', hat: 'none',
      gait: 'normal', carry: 'urn', voice: 'flat',
      hair: H('gray', 'gray', '#8d8a84', '#6a6862', 'short', 'short and practical'),
      jacket: J('black', 'black', '#1a1a1e', 'cardigan'), shirt: C('gray', 'gray', '#5a5a5a'),
      pants: C('black', 'black', '#1a1a1e'), skin: '#e0b394',
    },
    stay: { party: 1, nights: 1, beds: 'QQ', smoking: false, wants: ['poolside'], pay: 'CARD', card: { type: 'AMEX', name: 'CAROL A HASKINS', exp: '02/99' }, rateCode: 'RACK', vehicle: { color: 'gold', kind: 'sedan', desc: 'Gold Oldsmobile', plate: 'AL 55R 102' } },
    volunteers: ['nights'],
    schedule: { arrive: [at(22, 30), at(23, 30)], bed: [at(24, 15), at(24, 45)], breakfast: [at(6, 25), at(6, 45)], checkout: [at(6, 50), at(7, 20)] },
    breakfast: { coffee: 'decaf', food: 'fruit', lingers: 20, twoCups: true },
  },
  {
    id: 'ENCYC', name: 'Leonard Voss', tag: 'sells encyclopedias, door to door, still',
    kind: 'oneoff', seed: 0xE7C1C, weight: 1,
    app: {
      gender: 'm', height: 'average', build: 'average', facial: 'mustache', glasses: 'square', hat: 'none',
      gait: 'normal', carry: 'briefcase', voice: 'nasal',
      hair: H('gray', 'gray', '#8d8a84', '#6a6862', 'greasy', 'combed over, bravely'),
      jacket: J('brown', 'brown', '#5a3f22', 'suit jacket'), shirt: C('cream', 'cream', '#b6ab8c'),
      pants: C('brown', 'brown', '#4a3a24'), skin: '#e8c39e', tie: '#7a3c1c',
    },
    stay: { party: 1, nights: 1, beds: 'K', smoking: true, wants: [], pay: 'CASH', rateCode: 'RACK', vehicle: { color: 'brown', kind: 'wagon', desc: 'Brown station wagon, full of books', plate: 'LA 1Q2 877' } },
    volunteers: ['party', 'nights'],
    schedule: { arrive: [at(20, 40), at(21, 40)], bed: [at(23, 30), at(24, 0)], breakfast: [at(6, 5), at(6, 25)], checkout: [at(6, 40), at(7, 10)] },
    breakfast: { coffee: 'regular', food: 'pastry', lingers: 15, newspaper: true },
  },

  /* ---------------- a few faces from across town ---------------- */
  {
    /* Final Rental's AUDITOR, checking a different kind of shelf. Same seed,
       same spec: she is the same woman, a few months on. */
    id: 'VERNA', name: 'Verna Ashby', tag: 'is visiting her sister',
    kind: 'cameo', seed: 0xC0FFEE + 6 * 7919, weight: 1,
    app: {
      gender: 'f', height: 'short', build: 'thin', facial: 'clean', glasses: 'round', hat: 'none',
      gait: 'shuffle', carry: 'none', smell: 'bleach', voice: 'soft',
      hair: H('white', 'white', '#cfcac0', '#a5a099', 'short', 'short and set'),
      jacket: J('cardi', 'lilac', '#6a5a7a', 'cardigan'), pants: C('navy', 'navy', '#1e2a4a'),
      shirt: C('cream', 'cream', '#b6ab8c'), skin: '#e8c39e',
    },
    stay: { party: 1, nights: 2, beds: 'K', smoking: false, wants: ['quiet', 'groundFloor'], pay: 'CASH', rateCode: 'AAA', reservation: true, vehicle: { color: 'blue', kind: 'sedan', desc: 'Blue Buick, immaculate', plate: 'LA 3VA 100' } },
    volunteers: ['reservation', 'nights', 'party', 'smoking'],
    schedule: { arrive: [at(20, 50), at(21, 30)], bed: [at(21, 45), at(22, 0)], breakfast: [at(5, 55), at(6, 0)] },
    breakfast: { coffee: 'decaf', food: 'cereal', lingers: 28, audit: true },
  },
  {
    /* Final Rental's coupon man. He has made the Starlite a coupon too. */
    id: 'OTIS', name: 'Otis Bellweather', tag: 'has a coupon',
    kind: 'cameo', seed: 0xC0FFEE + 4 * 7919, weight: 1,
    app: {
      gender: 'm', height: 'short', build: 'heavy', facial: 'mustache', glasses: 'square', hat: 'trucker',
      gait: 'normal', carry: 'none', smell: 'smoke', voice: 'flat',
      hair: H('gray', 'gray', '#8d8a84', '#6a6862', 'bald', 'bald on top'),
      jacket: J('windb', 'mustard yellow', '#8a7317', 'windbreaker'), pants: C('gray', 'gray', '#4a4a50'),
      shirt: C('plaid', 'red', '#6a2a24'), skin: '#d8ab84',
    },
    stay: { party: 1, nights: 1, beds: 'K', smoking: true, wants: [], pay: 'CASH', rateCode: 'RACK', coupon: 'homemade', vehicle: { color: 'tan', kind: 'sedan', desc: 'Tan Chevy Caprice', plate: 'LA 9OB 118' } },
    volunteers: ['party', 'nights'],
    schedule: { arrive: [at(21, 10), at(22, 20)], bed: [at(23, 30), at(24, 0)], breakfast: [at(6, 10), at(6, 30)], checkout: [at(6, 45), at(7, 15)] },
    breakfast: { coffee: 'regular', food: 'pastry', lingers: 12, takesExtra: true },
  },
  {
    id: 'DEPUTY', name: 'Deputy Ray Sills', tag: 'Delphine Parish Sheriff',
    kind: 'local', seed: 0x5111, weight: 1,
    app: {
      gender: 'm', height: 'tall', build: 'broad', facial: 'mustache', glasses: 'aviator', hat: 'none',
      gait: 'normal', carry: 'none', voice: 'low',
      hair: H('brown', 'dark brown', '#3d2a1a', '#2a1c11', 'buzz'),
      jacket: J('tan', 'tan', '#8a7148', 'uniform'), pants: C('brown', 'brown', '#4a3a24'),
      shirt: C('tan', 'tan', '#8a7148'), skin: '#c08e63',
    },
    schedule: { visit: [at(25, 30), at(26, 30)] },
  },

  /* ---------------- tonight's reservations and walk-ins ---------------- */
  {
    id: 'BUDDY', name: 'Buddy Guidry', tag: 'foreman, Tri-Parish Paving',
    kind: 'crew', seed: 0xB0DD1, crew: 'TRIPARISH',
    app: {
      gender: 'm', height: 'average', build: 'broad', facial: 'mustache', glasses: 'none', hat: 'cap',
      gait: 'normal', carry: 'none', voice: 'loud',
      hair: H('brown', 'dark brown', '#3d2a1a', '#2a1c11', 'short'),
      jacket: J('orange', 'safety orange', '#b8561a', 'work coat'), pants: C('denim', 'denim blue', '#2b4368'),
      shirt: C('gray', 'gray', '#5a5a5a'), skin: '#c08e63',
    },
    stay: { party: 1, nights: 3, beds: 'D', smoking: true, wants: ['groundFloor', 'together'], pay: 'VOUCHER', rateCode: 'CORP', account: 'TRIPARISH', reservation: true, vehicle: { color: 'white', kind: 'pickup', desc: 'White company pickup', plate: 'LA TPP 12' } },
    volunteers: ['reservation', 'party', 'nights', 'pay'],
    schedule: { arrive: [at(19, 15), at(19, 30)], bed: [at(21, 30), at(22, 0)], wake: at(4, 30), breakfast: [at(5, 10), at(5, 20)], leave: at(5, 35) },
  },
  {
    id: 'PRUITT', name: 'Ron Pruitt', tag: 'driving the family to Houston',
    kind: 'family', seed: 0x9201, family: ['SHERRI', 'KID1', 'KID2'],
    app: {
      gender: 'm', height: 'tall', build: 'heavy', facial: 'clean', glasses: 'square', hat: 'cap',
      gait: 'normal', carry: 'suitcase', voice: 'loud', bagColor: '#2a4a2a',
      hair: H('brown', 'dark brown', '#3d2a1a', '#2a1c11', 'short'),
      jacket: J('teal', 'teal', '#1c5157', 'polo shirt'), pants: C('khaki', 'khaki', '#8a7a58'),
      shirt: C('teal', 'teal', '#1c5157'), skin: '#e8c39e',
    },
    stay: { party: 4, nights: 1, beds: 'QQ', smoking: false, wants: ['pool', 'twoBeds'], pay: 'CARD', card: { type: 'DISCOVER', name: 'RONALD PRUITT', exp: '11/98' }, rateCode: 'RACK', vehicle: { color: 'green', kind: 'wagon', desc: 'Green minivan, kid stickers', plate: 'MS 44K 881' } },
    volunteers: ['party'],
    schedule: { arrive: [at(20, 30), at(21, 10)], bed: [at(22, 15), at(22, 40)], breakfast: [at(6, 15), at(6, 30)], checkout: [at(6, 50), at(7, 30)] },
    breakfast: { coffee: 'regular', food: 'waffle', lingers: 22 },
  },
  { id: 'SHERRI', name: 'Sherri Pruitt', tag: 'is counting the kids', kind: 'family', seed: 0x9202, companion: true,
    app: { gender: 'f', height: 'average', build: 'average', facial: 'clean', glasses: 'none', hat: 'none', gait: 'brisk', carry: 'none', voice: 'nasal',
      hair: H('blond', 'blond', '#b99553', '#8f7038', 'short', 'short, feathered'), jacket: J('pink', 'coral', '#a85a52', 'blouse'), pants: C('denim', 'denim blue', '#33507a'), shirt: C('coral', 'coral', '#a85a52'), skin: '#e8c39e' },
    breakfast: { coffee: 'regular', food: 'fruit', lingers: 22 } },
  { id: 'KID1', name: 'Tyler Pruitt', tag: 'is eight', kind: 'family', seed: 0x9203, child: true, companion: true,
    app: { gender: 'm', height: 'short', build: 'thin', facial: 'clean', glasses: 'none', hat: 'cap', gait: 'brisk', carry: 'none', voice: 'nasal',
      hair: H('blond', 'blond', '#b99553', '#8f7038', 'short'), jacket: J('red', 'red', '#8a1e1a', 'polo shirt'), pants: C('denim', 'denim blue', '#33507a'), shirt: C('red', 'red', '#8a1e1a'), skin: '#e8c39e' },
    breakfast: { coffee: null, food: 'waffle', lingers: 22, chaos: 0.7, channel: 'CARTOONS' } },
  { id: 'KID2', name: 'Amber Pruitt', tag: 'is five, and in charge', kind: 'family', seed: 0x9204, child: true, companion: true,
    app: { gender: 'f', height: 'short', build: 'thin', facial: 'clean', glasses: 'none', hat: 'none', gait: 'brisk', carry: 'none', voice: 'nasal',
      hair: H('blond', 'blond', '#b99553', '#8f7038', 'ponytail'), jacket: J('purple', 'purple', '#6a3a9a', 'blouse'), pants: C('pink', 'pink', '#b86a7a'), shirt: C('purple', 'purple', '#6a3a9a'), skin: '#e8c39e' },
    breakfast: { coffee: null, food: 'cereal', lingers: 22, chaos: 0.5, channel: 'CARTOONS' } },
  {
    id: 'CONNIE', name: 'Connie Delacroix', tag: 'Delta Medical Supply, territory rep',
    kind: 'traveler', seed: 0xC0221, weight: 1,
    app: {
      gender: 'f', height: 'tall', build: 'thin', facial: 'clean', glasses: 'none', hat: 'none',
      gait: 'brisk', carry: 'briefcase', voice: 'loud',
      hair: H('black', 'black', '#17141a', '#0d0b10', 'short', 'short, sharp'),
      jacket: J('navy', 'navy', '#1e2a4a', 'blazer'), pants: C('navy', 'navy', '#1e2a4a'),
      shirt: C('white', 'white', '#c8c4b4'), skin: '#8d5f3c',
    },
    stay: { party: 1, nights: 1, beds: 'K', smoking: false, wants: ['quiet', 'upstairs'], pay: 'CARD', card: { type: 'AMEX', name: 'C DELACROIX', exp: '08/99' }, rateCode: 'AAA', aaa: true, vehicle: { color: 'red', kind: 'sedan', desc: 'Red Taurus, company car', plate: 'LA DMS 06' } },
    volunteers: ['party', 'nights', 'smoking'],
    schedule: { arrive: [at(19, 35), at(20, 10)], bed: [at(23, 0), at(23, 30)], wake: at(5, 15), breakfast: [at(5, 50), at(6, 0)], checkout: [at(6, 10), at(6, 20)] },
    breakfast: { coffee: 'regular', food: 'fruit', lingers: 8, channel: 'NEWS' },
  },
  {
    id: 'LATENIGHT', name: 'Mike Hollins', tag: 'hauling chickens to Memphis',
    kind: 'traveler', seed: 0x1A7E, weight: 1,
    app: {
      gender: 'm', height: 'tall', build: 'heavy', facial: 'stubble', glasses: 'none', hat: 'trucker',
      gait: 'shuffle', carry: 'none', voice: 'raspy',
      hair: H('brown', 'dark brown', '#3d2a1a', '#2a1c11', 'mullet'),
      jacket: J('denim', 'denim', '#33507a', 'denim jacket'), pants: C('denim', 'denim blue', '#2b4368'),
      shirt: C('black', 'black', '#26262c'), skin: '#d8ab84',
    },
    stay: { party: 1, nights: 1, beds: 'D', smoking: true, wants: ['groundFloor', 'nearOffice'], pay: 'CASH', rateCode: 'RACK', vehicle: { color: 'red', kind: 'pickup', desc: 'Red pickup (the rig is on the shoulder)', plate: 'AR 881 KZ' } },
    volunteers: ['party', 'nights', 'smoking'],
    schedule: { arrive: [at(25, 20), at(26, 10)], bed: [at(26, 30), at(26, 45)], wake: at(5, 30), checkout: [at(5, 50), at(6, 10)] },
  },

  /* ---------------- the staff ---------------- */
  {
    id: 'LUZ', name: 'Luz Ortega', tag: 'head housekeeper',
    kind: 'staff', seed: 0x10272,
    app: {
      gender: 'f', height: 'short', build: 'heavy', facial: 'clean', glasses: 'none', hat: 'none',
      gait: 'brisk', carry: 'none', voice: 'raspy',
      hair: H('black', 'black', '#17141a', '#0d0b10', 'ponytail'),
      jacket: J('teal', 'teal', '#1c5157', 'uniform'), pants: C('black', 'black', '#1a1a1e'),
      shirt: C('teal', 'teal', '#1c5157'), skin: '#a6714a',
    },
  },
  {
    id: 'TRAVIS', name: 'Travis Pickett', tag: 'the morning desk',
    kind: 'staff', seed: 0x7A415,
    app: {
      gender: 'm', height: 'tall', build: 'thin', facial: 'clean', glasses: 'none', hat: 'none',
      gait: 'normal', carry: 'coffee', voice: 'nasal',
      hair: H('brown', 'dark brown', '#3d2a1a', '#2a1c11', 'short', 'short, gelled'),
      jacket: J('white', 'white', '#c8c4b4', 'short-sleeve shirt'), pants: C('khaki', 'khaki', '#8a7a58'),
      shirt: C('white', 'white', '#c8c4b4'), skin: '#e8c39e', tie: '#1e2a4a',
    },
  },
];

export const PERSON = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

const BUILT = {};
/** The locked appearance for a roster id, built once. */
export function appFor(id) {
  if (BUILT[id]) return BUILT[id];
  const p = PERSON[id];
  const a = fixedApp(p.seed, p.app);
  if (p.child) { a.height = CHILD_HEIGHT; a.voicePitch = 1.55; }
  BUILT[id] = a;
  return a;
}

/* The crew members who come with Buddy. They are not written as
   characters -- they are three tired men in orange -- so they are rolled,
   from a fixed seed, and they look the same every night they are here. */
export function crewMember(i) {
  const rng = makeRng(0xC2E00 + i * 131);
  const a = randomAppearance(rng, { gender: 'm' });
  a.jacket = { id: 'orange', color: col('orange', 'safety orange', '#b8561a'), kind: 'work coat', label: 'Safety orange work coat', bulletin: 'a safety orange work coat' };
  a.hat = find(HATS, rng.chance(0.5) ? 'cap' : 'trucker');
  a.carry = find(CARRY, 'none');
  a.glasses = find(GLASSES, 'none');
  a.mark = find(MARKS, 'none');
  const names = ['Lonnie Hebert', 'Dale Landry', 'Junior Thibodeaux', 'Wade Fontenot'];
  return { app: a, name: names[i % names.length] };
}
