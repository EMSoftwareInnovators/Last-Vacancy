/* ============================================================
   memory.js -- what the Starlite remembers.

   A regular is only a regular if the place remembers them. Every
   named guest has a history: how many times they have stayed here
   (with anybody), how many of those were with you, which room,
   whether you put them where they wanted, what you said to them
   last time. Weekly residents keep their rooms. The reservation
   binder carries forward. The owner remembers how your last shift
   went and says so in the note on the desk.

   Nothing here scores anything. It is just remembered.
   ============================================================ */
import { loadGame, saveGame, clearGame } from '../../engine/save.js';

export const START_DATE = [1997, 9, 16];     // Thursday, October 16, 1997 (months from 0)

export function freshMemory() {
  return {
    shiftNo: 1,
    date: START_DATE.slice(),
    guests: {},
    reservations: [],
    residents: {},
    rooms: null,
    inventory: {
      coffee: 4, decaf: 2, milk: 2, oj: 3, muffins: 18, bagels: 12, cereal: 22, fruit: 12, waffleMix: 1,
      towels: 30, pillows: 14, blankets: 8, toiletries: 20, tp: 24, bulbs: 6, batteries: 8,
    },
    vending: null,            // the machines, column by column (see vending.js); filled in on first use
    lastShift: null,
    signFixed: false,
    flags: {},
    lostAndFound: ['A pair of reading glasses (Rm 207, Sept.)', 'One child\'s sneaker, left foot', 'A Bible, inscribed "To Darla"'],
  };
}

export class Memory {
  constructor(data) {
    this.d = data || freshMemory();
  }
  static load() {
    const g = loadGame();
    return g ? new Memory(g.memory) : null;
  }
  static fresh() { return new Memory(freshMemory()); }
  save(extra = {}) { return saveGame({ memory: this.d, ...extra }); }
  static clear() { clearGame(); }

  get shiftNo() { return this.d.shiftNo; }
  date() { const [y, m, d] = this.d.date; return new Date(y, m, d, 19, 0); }
  advanceDay() {
    const dt = this.date();
    dt.setDate(dt.getDate() + 1);
    this.d.date = [dt.getFullYear(), dt.getMonth(), dt.getDate()];
    this.d.shiftNo++;
  }

  /* ---------------- guests ---------------- */
  guest(id, seed = {}) {
    if (!this.d.guests[id]) this.d.guests[id] = { stays: seed.priorStays || 0, withYou: 0, lastRoom: null, rooms: [], flags: {}, lines: [], opinion: 0 };
    return this.d.guests[id];
  }
  known(id) { return !!this.d.guests[id]; }
  /** Somebody checked in. Remember where, and whether it was where they like. */
  stayed(id, room, liked) {
    const g = this.guest(id);
    g.stays++; g.withYou++;
    g.lastRoom = room;
    g.rooms.push(room);
    if (liked === true) g.opinion++;
    if (liked === false) g.opinion--;
    g.lastShift = this.d.shiftNo;
  }
  flag(id, key, v = true) { this.guest(id).flags[key] = v; }
  hasFlag(id, key) { return !!(this.d.guests[id] && this.d.guests[id].flags[key]); }
  opinion(id, d) { this.guest(id).opinion += d; }

  /* ---------------- the motel ---------------- */
  inv(k) { return this.d.inventory[k] || 0; }
  use(k, n = 1) { this.d.inventory[k] = Math.max(0, (this.d.inventory[k] || 0) - n); return this.d.inventory[k]; }
  addReservation(r) { this.d.reservations.push(r); }
}
