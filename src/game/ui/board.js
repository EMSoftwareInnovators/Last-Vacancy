/* ============================================================
   board.js -- the key rack behind the desk.

   Twenty-eight hooks on a pegboard, two keys a hook, each key on a
   green diamond fob with the number stamped in gold. Over each hook
   is a colored tab that says what the clerk last believed about the
   room: CLEAN, DIRTY, OCC, RSVD, O-O-O. Behind the tab, a slip with
   the guest's name on it, written in pencil.

   Nothing flips a tab but a hand. Taking a key for a room the
   system just sold flips it to OCC, because your hand does that by
   habit; everything else -- the dirty rooms in the morning, the
   reservation that never came -- you flip yourself. Luz cleans by
   the rack.
   ============================================================ */
import { STATUS, STATUS_SHORT } from '../sim/rooms.js';
import { TRAIT_LABEL, BED_LABEL } from '../world/layout.js';
import { makeItem } from '../sim/items.js';

const ROWS = [
  { label: 'WEST · DOWNSTAIRS', rooms: ['101', '102', '103', '104', '105', '106', '107'] },
  { label: 'WEST · UPSTAIRS', rooms: ['201', '202', '203', '204', '205', '206', '207'] },
  { label: 'EAST · DOWNSTAIRS · POOLSIDE', rooms: ['108', '109', '110', '111', '112', '113', '114', '115'] },
  { label: 'EAST · UPSTAIRS', rooms: ['208', '209', '210', '211', '212', '213'] },
];
const TABS = ['VC', 'VD', 'OC', 'RS', 'OO'];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class Board {
  constructor(shift) { this.s = shift; this.r = 0; this.c = 0; this.msg = ''; }

  open() {
    this.msg = '';
    // start on the room somebody at the desk is waiting for, if there is one
    const want = this.wanted()[0];
    if (want) this.selectRoom(want.room);
    this.s.g.sound.keys(0);
  }
  selectRoom(no) {
    ROWS.forEach((row, r) => { const c = row.rooms.indexOf(no); if (c >= 0) { this.r = r; this.c = c; } });
  }
  current() { const row = ROWS[this.r]; return row.rooms[Math.min(this.c, row.rooms.length - 1)]; }

  /** Keys the desk is waiting on: whoever has paid and needs a key. */
  wanted() {
    const out = [];
    for (const p of this.s.desk.line) {
      const ci = p.ci;
      if (!ci || !ci.room) continue;
      if (ci.stage !== 'key' && ci.stage !== 'pay' && ci.stage !== 'cash' && ci.stage !== 'card' && ci.stage !== 'voucher') continue;
      const rooms = p.groupRooms || [ci.room];
      for (const no of rooms) if (!(p.groupKeys || []).includes(no) && !this.s.heldOf('key', (k) => k.room === no)) out.push({ room: no, who: p });
    }
    return out;
  }

  handle(i) {
    const s = this.s;
    if (i.hit('Escape', 'UiBack', 'Backspace')) return false;
    let moved = false;
    if (i.hit('ArrowUp', 'KeyW')) { this.r = (this.r + ROWS.length - 1) % ROWS.length; moved = true; }
    if (i.hit('ArrowDown', 'KeyS')) { this.r = (this.r + 1) % ROWS.length; moved = true; }
    if (i.hit('ArrowLeft', 'KeyA')) { this.c = (this.c + ROWS[this.r].rooms.length - 1) % ROWS[this.r].rooms.length; moved = true; }
    if (i.hit('ArrowRight', 'KeyD')) { this.c = (this.c + 1) % ROWS[this.r].rooms.length; moved = true; }
    if (moved) { this.c = Math.min(this.c, ROWS[this.r].rooms.length - 1); this.msg = ''; s.g.sound.uiMove(); }
    const no = this.current();
    const st = s.rooms.get(no);
    if (i.hit('KeyE', 'Enter', 'Space')) {
      const mine = s.heldAll('key').filter((k) => k.room === no);
      if (mine.length) {
        for (const k of mine) { s.removeHeld(k); s.rooms.hangKey(no); }
        s.g.sound.keys(0);
        this.msg = `Hung ${mine.length > 1 ? `${mine.length} keys` : 'the key'} on ${no}.${st.status === 'OC' && !st.guest ? ' The tab still says OCC.' : ''}`;
      } else if (st.keys > 0) {
        if (!s.canHold(makeItem('key'))) { this.msg = 'Your hands are full.'; s.g.sound.error(); return true; }
        s.rooms.takeKey(no);
        s.giveItem(makeItem('key', { room: no }), true);
        s.g.sound.keys(0);
        this.msg = `Took key ${no}.`;
        if (st.guest && st.status !== 'OC') { st.status = 'OC'; this.msg += ' You flip the tab to OCC out of habit.'; }
      } else {
        this.msg = `No keys on the ${no} hook. Both are out.`;
        s.g.sound.error();
      }
    }
    // the tab: G on a keyboard, X on a pad (the "put it down" button)
    if (i.hit('KeyG', 'PadX', 'KeyT')) {
      const k = TABS.indexOf(st.status);
      st.status = TABS[(k + 1) % TABS.length];
      s.g.sound.paper();
      this.msg = `${no} tab: ${STATUS[st.status]}.`;
    }
    return true;
  }

  render() {
    const s = this.s;
    const want = this.wanted();
    const wantRooms = new Set(want.map((w) => w.room));
    let grid = '';
    ROWS.forEach((row, r) => {
      grid += `<div class="row-h">${row.label}</div>`;
      row.rooms.forEach((no, c) => {
        const st = s.rooms.get(no);
        const sel = r === this.r && c === Math.min(this.c, row.rooms.length - 1);
        const keys = '◆'.repeat(st.keys) + '◇'.repeat(2 - st.keys);
        const who = st.guestName ? st.guestName.split(' ').slice(-1)[0].toUpperCase() : st.status === 'RS' && st.reservedFor ? `(${String(st.reservedFor).toUpperCase()})` : '';
        grid += `<div class="slot${sel ? ' sel' : ''}${wantRooms.has(no) ? ' want' : ''}"><span class="no">${no}</span>`
          + `<span class="tab ${st.status}">${STATUS_SHORT[st.status]}</span><span class="key${st.keys ? '' : ' gone'}">${keys}</span>`
          + `<span class="who">${esc(who) || '&nbsp;'}</span></div>`;
      });
      for (let k = row.rooms.length; k < 8; k++) grid += '<div class="slot empty"></div>';
    });
    const no = this.current(), st = s.rooms.get(no), r = st.def;
    const traits = r.traits.map((t) => TRAIT_LABEL[t]).filter(Boolean).join(' · ');
    const held = s.heldAll('key').map((k) => k.room);
    const info = `<div><b>${no}</b> &mdash; ${BED_LABEL[r.beds]} · ${r.smoking ? 'SMOKING' : 'NON-SMOKING'} · ${r.lv ? 'UPSTAIRS' : 'DOWNSTAIRS'}${traits ? ` · ${traits}` : ''}</div>`
      + `<div class="quiet">${esc(r.note || '')}</div>`
      + `<div>Tab: <b>${STATUS[st.status]}</b> &nbsp; System: <b>${STATUS[st.sys] || st.sys}</b>${st.guestName ? ` (${esc(st.guestName)})` : ''} &nbsp; Keys on hook: ${st.keys}</div>`
      + (want.length ? `<div class="k">At the desk: ${want.slice(0, 4).map((w) => `${esc(w.who.name.split(' ').slice(-1)[0])} &rarr; ${w.room}`).join(', ')}</div>` : '')
      + (held.length ? `<div>In your hand: key${held.length > 1 ? 's' : ''} ${held.join(', ')}</div>` : '')
      + (this.msg ? `<div class="k">${esc(this.msg)}</div>` : '')
      + `<div class="opts"><span>${s.g.ui.keyHint('interact')} take / hang key</span><span>${s.g.ui.keyHint('drop')} flip the tab</span><span>${s.g.ui.keyHint('back')} step away</span></div>`;
    return { grid, info };
  }
}
