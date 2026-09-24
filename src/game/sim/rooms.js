/* ============================================================
   rooms.js -- twenty-eight rooms, what state each one is in, and
   where its key is.

   Three things describe a room and they are allowed to disagree:
     - the PROPERTY SYSTEM says who is registered to it;
     - the KEY RACK behind the desk has its key on the hook or not,
       and a colored tab that says what the clerk last believed;
     - the ROOM itself has somebody in it or does not, lights on or
       off, a television going, an air conditioner that rattles.
   The job is keeping the first two honest with the third. The
   night audit is where you find out whether you did.

   Everything here is readable by any other system (the story will
   want this later), and saves between shifts.
   ============================================================ */
import { ROOMS, ROOM_BY_NO, TRAIT_LABEL, BED_LABEL, toWorld } from '../world/layout.js';

export const STATUS = {
  VC: 'VACANT CLEAN', VD: 'VACANT DIRTY', OC: 'OCCUPIED', RS: 'RESERVED', OO: 'OUT OF ORDER', MT: 'MAINTENANCE',
};
export const STATUS_SHORT = { VC: 'CLEAN', VD: 'DIRTY', OC: 'OCC', RS: 'RSVD', OO: 'O-O-O', MT: 'MAINT' };

export class Rooms {
  constructor() {
    this.map = {};
    for (const r of ROOMS) {
      this.map[r.no] = {
        no: r.no, def: r, lv: r.lv,
        status: 'VC',              // the tab on the rack
        sys: 'VC',                 // what the property system believes
        keys: 2,                   // keys hanging on its hook
        keysOut: 0,                // keys with guests
        guest: null,               // person id of whoever is registered (the system's view)
        guestName: '',
        party: 0,
        occupied: false,           // is anybody actually in there right now
        awake: false, tvOn: false,
        lightsOn: false,
        issues: new Set(r.traits.includes('noisyAC') ? ['ac'] : r.traits.includes('drip') ? ['drip'] : []),
        dnd: false,
        noDisclose: false,
        reservedFor: null,
        wake: null,
        lastGuest: '',
        cleaned: true,
      };
    }
  }

  get(no) { return this.map[String(no)] || null; }
  all() { return ROOMS.map((r) => this.map[r.no]); }
  def(no) { return ROOM_BY_NO[String(no)]; }

  /** What a room shows on its window: dark, lamp-lit, or television-blue. */
  glow(st) {
    if (!st.occupied || !st.awake) return 'dark';
    return st.tvOn ? 'tv' : 'lit';
  }
  refreshGlow() { for (const st of this.all()) st.windowGlow = this.glow(st); }

  /* ---------------- the system's side ---------------- */
  register(no, guest, party) {
    const st = this.get(no);
    st.guest = guest.id; st.guestName = guest.name; st.party = party || 1;
    st.noDisclose = !!(guest.noDisclose || (guest.stay && guest.stay.noDisclose));
    st.reservedFor = null;
    st.sys = 'OC';
    return st;
  }
  checkout(no) {
    const st = this.get(no);
    st.lastGuest = st.guestName;
    st.guest = null; st.guestName = ''; st.party = 0; st.noDisclose = false; st.dnd = false; st.wake = null;
    st.cleaned = false;
    st.sys = 'VD';
    return st;
  }

  /* ---------------- the rack's side ---------------- */
  takeKey(no) {
    const st = this.get(no);
    if (!st || st.keys <= 0) return false;
    st.keys--;
    return true;
  }
  hangKey(no) {
    const st = this.get(no);
    if (!st) return false;
    st.keys = Math.min(2, st.keys + 1);
    return true;
  }
  setTab(no, status) { const st = this.get(no); if (st) st.status = status; }

  /* ---------------- questions ---------------- */
  sellable(st) { return st.sys === 'VC' && !st.guest; }
  vacantClean() { return this.all().filter((s) => this.sellable(s)); }
  occupiedBySystem() { return this.all().filter((s) => !!s.guest); }
  keysOut() { return this.all().reduce((n, s) => n + (2 - s.keys), 0); }
  byGuest(id) { return this.all().find((s) => s.guest === id) || null; }
  findGuest(name) {
    const q = name.toLowerCase();
    return this.all().filter((s) => s.guestName && s.guestName.toLowerCase().includes(q));
  }

  /** "1 KING · QUIET · NR ICE" */
  describe(no, full = false) {
    const r = this.def(no);
    const bits = [BED_LABEL[r.beds]];
    if (r.smoking) bits.push('SMOKING'); else bits.push('NONSMK');
    for (const t of r.traits) if (t !== 'smoke' && TRAIT_LABEL[t]) bits.push(TRAIT_LABEL[t]);
    bits.push(r.lv ? 'UP' : 'DOWN');
    return full ? `${bits.join(' · ')}${r.note ? `  ${r.note}` : ''}` : bits.join(' · ');
  }

  /** The nearest room with its air unit running, for the ambience. */
  nearestRunningAc(x, z, lv) {
    let best = null, bd = 9;
    for (const st of this.all()) {
      if (!st.occupied || st.no === '104') continue;
      const r = st.def;
      if (r.lv !== lv && Math.abs(r.lv - lv) > 0) continue;
      const [ax, az] = toWorld(r, r.doorHi ? 1.1 : 2.45, -0.1);
      const d = Math.hypot(ax - x, az - z);
      if (d < bd) { bd = d; best = { x: ax, z: az }; }
    }
    return best;
  }
  nearestTv(x, z, lv) {
    let best = null, bd = 7;
    for (const st of this.all()) {
      if (!st.occupied || !st.tvOn || !st.awake) continue;
      const r = st.def;
      if (r.lv !== lv) continue;
      const d = Math.hypot(r.center.x - x, r.center.z - z);
      if (d < bd) { bd = d; best = r.center; }
    }
    return best;
  }

  /* ---------------- saving ---------------- */
  save() {
    const out = {};
    for (const st of this.all()) {
      out[st.no] = {
        status: st.status, sys: st.sys, keys: st.keys, guest: st.guest, guestName: st.guestName, party: st.party,
        issues: [...st.issues], noDisclose: st.noDisclose, cleaned: st.cleaned, lastGuest: st.lastGuest,
      };
    }
    return out;
  }
  load(data) {
    if (!data) return;
    for (const [no, d] of Object.entries(data)) {
      const st = this.get(no);
      if (!st) continue;
      Object.assign(st, { ...d, issues: new Set(d.issues || []) });
    }
  }
}
