/* ============================================================
   terminal.js -- PROPERTY SYSTEM v2.4.

   Green on black, sixty columns, function keys. It was old in 1997
   and June will not replace it because it works, and it does work,
   as long as you tell it the truth. It knows who is registered to
   what room and what they owe. It does not know where the keys are
   or whether anybody is actually in the room. That is the rack's
   job, and yours.

     F1 CHECK-IN     the guest at the desk, into a room
     F2 CHECK-OUT    close a folio, print the receipt
     F3 ROOMS        what the system believes about every room
     F4 RESERVATIONS tonight's arrivals, and the group blocks
     F5 NIGHT AUDIT  three in the morning: make the books close

   Arrow keys move, left and right change a value, ENTER does the
   thing, ESC goes back. On a pad, the d-pad and the face buttons.
   ============================================================ */
import { nightly, withTax, ACCOUNTS, BANK, TAX } from '../sim/ledger.js';
import { BED_LABEL } from '../world/layout.js';
import { Clock } from '../sim/clock.js';
import { money } from '../dialogue/runner.js';
import { cardExpired } from '../dialogue/desk.js';
import { makeItem } from '../sim/items.js';

const W = 60;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const pad = (s, n) => { s = String(s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); };
const rpad = (s, n) => { s = String(s); return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s; };
const line = (ch = '─') => ch.repeat(W);
const span = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;
const RATE_CODES = ['RACK', 'AAA', 'COUPON', 'WEEKLY', 'CORP', 'COMP'];
const PAYS = ['CASH', 'CARD', 'TC', 'VOUCHER', 'DIRECT'];
const BEDS = ['K', 'QQ', 'D'];

export class Terminal {
  constructor(shift) {
    this.s = shift;
    this.screen = 'main';
    this.sel = 0;
    this.msg = '';
    this.form = null;
    this.audit = null;
    this.scroll = 0;
  }

  open() { this.screen = 'main'; this.sel = 0; this.msg = ''; this.s.g.sound.terminalBeep(); }

  /* ---------------- input ---------------- */
  /** Returns false when the clerk steps away from the terminal. */
  handle(i) {
    const s = this.s;
    const fk = ['F1', 'F2', 'F3', 'F4', 'F5'].findIndex((k) => i.hit(k));
    if (fk >= 0) { this.go(['checkin', 'checkout', 'rooms', 'res', 'audit'][fk]); return true; }
    const up = i.hit('ArrowUp', 'KeyW'), down = i.hit('ArrowDown', 'KeyS');
    const left = i.hit('ArrowLeft', 'KeyA'), right = i.hit('ArrowRight', 'KeyD');
    const enter = i.hit('Enter', 'KeyE', 'Space');
    const back = i.hit('Escape', 'UiBack', 'Backspace');
    if (up || down || left || right || enter) s.g.sound.keyClick();
    switch (this.screen) {
      case 'main': {
        const n = ['1', '2', '3', '4', '5'].findIndex((d) => i.hit('Digit' + d));
        if (n >= 0) { this.go(['checkin', 'checkout', 'rooms', 'res', 'audit'][n]); return true; }
        if (up) this.sel = (this.sel + 4) % 5;
        if (down) this.sel = (this.sel + 1) % 5;
        if (enter) this.go(['checkin', 'checkout', 'rooms', 'res', 'audit'][this.sel]);
        if (back) return false;
        return true;
      }
      case 'checkin': return this.handleCheckin(up, down, left, right, enter, back);
      case 'checkout': return this.handleList(up, down, enter, back, () => this.checkoutList(), (f) => this.doCheckout(f));
      case 'rooms': return this.handleRooms(up, down, left, right, enter, back);
      case 'res': return this.handleList(up, down, enter, back, () => this.resList(), (r) => this.resPick(r));
      case 'audit': return this.handleAudit(up, down, left, right, enter, back);
      default: this.screen = 'main'; return true;
    }
  }

  go(screen) {
    this.screen = screen; this.sel = 0; this.msg = ''; this.scroll = 0;
    this.s.g.sound.terminalBeep();
    if (screen === 'checkin') this.form = this.buildForm();
    if (screen === 'audit') this.audit = this.audit && this.audit.done ? this.audit : this.startAudit();
  }

  /* ============================================================
     F1 CHECK-IN
     ============================================================ */
  guestAtDesk() {
    const f = this.s.desk.front();
    if (f && f.deskReason === 'checkin' && f.ci && f.ci.stage === 'system') return f;
    // anybody further back who is ready to be entered
    return this.s.desk.line.find((p) => p.deskReason === 'checkin' && p.ci && p.ci.stage === 'system') || null;
  }

  buildForm() {
    const s = this.s, p = this.guestAtDesk();
    if (!p) return { p: null };
    const k = p.known, st = p.stay;
    const res = k.name && st.reservation ? s.director.reservationFor(p) : null;
    const f = {
      p, res,
      party: k.party || res ? st.party : null,
      nights: k.nights || res ? st.nights : null,
      beds: k.beds || res ? st.beds : null,
      smoking: k.smoking || res ? st.smoking : null,
      rate: res && res.rateCode ? res.rateCode : (k.pay && st.rateCode && st.rateCode !== 'COUPON' ? st.rateCode : (p.stay.account && k.pay ? 'CORP' : null)),
      pay: k.pay ? st.pay : null,
      group: p.group ? p.group : null,
      rooms: [],
      roomI: 0,
      confirmUnknown: false,
    };
    if (st.aaa && k.pay && !f.rate) f.rate = 'AAA';
    f.options = this.roomOptions(f);
    if (res && res.room) { const i = f.options.findIndex((o) => o[0] === res.room); if (i >= 0) f.roomI = i; }
    return f;
  }

  /** Rooms the system will sell for this form, best matches first. Groups get sets. */
  roomOptions(f) {
    const s = this.s;
    let list = s.rooms.all().filter((st) => s.rooms.sellable(st) || (f.res && f.res.room === st.no && st.sys === 'RS'));
    if (f.group) {
      const n = f.group.rooms;
      const down = list.filter((st) => st.lv === 0 && !st.def.traits.includes('poolside'));
      const sets = [];
      const pool = down.length >= n ? down : list;
      const sorted = pool.slice().sort((a, b) => Number(a.no) - Number(b.no));
      for (let i = 0; i + n <= sorted.length && sets.length < 5; i++) sets.push(sorted.slice(i, i + n).map((st) => st.no));
      return sets;
    }
    const score = (st) => {
      const r = st.def;
      let v = 0;
      if (f.beds && r.beds === f.beds) v += 4;
      if (f.beds === 'QQ' && r.beds !== 'QQ') v -= 6;
      if (f.smoking !== null && r.smoking === f.smoking) v += 3;
      if (r.traits.includes('213')) v -= 1;
      return v;
    };
    return list.sort((a, b) => score(b) - score(a) || Number(a.no) - Number(b.no)).map((st) => [st.no]);
  }

  formRows(f) {
    return ['party', 'nights', 'beds', 'smoking', 'rate', 'pay', 'room', 'post'];
  }

  handleCheckin(up, down, left, right, enter, back) {
    const f = this.form;
    if (back) { this.screen = 'main'; this.sel = 0; return true; }
    if (!f || !f.p) { if (enter) this.form = this.buildForm(); return true; }
    if (!this.s.desk.line.includes(f.p)) { this.form = this.buildForm(); this.msg = 'GUEST LEFT THE DESK.'; return true; }
    const rows = this.formRows(f);
    if (up) this.sel = (this.sel + rows.length - 1) % rows.length;
    if (down) this.sel = (this.sel + 1) % rows.length;
    const row = rows[this.sel];
    const d = right ? 1 : left ? -1 : 0;
    if (d) {
      f.confirmUnknown = false; this.msg = '';
      const cyc = (arr, v) => arr[((arr.indexOf(v) < 0 ? (d > 0 ? -1 : 0) : arr.indexOf(v)) + d + arr.length) % arr.length];
      if (row === 'party') f.party = Math.max(1, Math.min(6, (f.party || 1) + (f.party === null ? 0 : d)));
      if (row === 'nights') f.nights = Math.max(1, Math.min(14, (f.nights || 1) + (f.nights === null ? 0 : d)));
      if (row === 'beds') { f.beds = cyc(BEDS, f.beds); f.options = this.roomOptions(f); f.roomI = 0; }
      if (row === 'smoking') { f.smoking = f.smoking === null ? false : !f.smoking; f.options = this.roomOptions(f); f.roomI = 0; }
      if (row === 'rate') f.rate = cyc(RATE_CODES, f.rate);
      if (row === 'pay') f.pay = cyc(PAYS, f.pay);
      if (row === 'room' && f.options.length) f.roomI = (f.roomI + d + f.options.length) % f.options.length;
    }
    if (enter) {
      if (row !== 'post') { this.sel = rows.length - 1; return true; }
      return this.post(f);
    }
    return true;
  }

  post(f) {
    const s = this.s, p = f.p;
    if (!p.known.name) { this.msg = '*** NAME REQUIRED. ASK THE GUEST. ***'; s.g.sound.error(); return true; }
    if (!f.options.length) { this.msg = '*** NO VACANT CLEAN ROOMS. ***'; s.g.sound.error(); return true; }
    const unknown = ['party', 'nights', 'beds', 'smoking', 'rate', 'pay'].filter((k) => f[k] === null);
    if (unknown.length && !f.confirmUnknown) {
      f.confirmUnknown = true;
      this.msg = `${unknown.length} FIELD(S) NOT CONFIRMED (${unknown.join(', ').toUpperCase()}). ENTER TO POST WITH DEFAULTS.`;
      s.g.sound.error();
      return true;
    }
    const party = f.party || 1, nights = f.nights || 1, rate = f.rate || 'RACK', pay = f.pay || 'CASH';
    const rooms = f.options[f.roomI];
    const acct = ACCOUNTS.find((a) => a.id === p.stay.account) || null;
    const folios = rooms.map((no, i) => {
      const r = s.rooms.def(no);
      const pp = f.group ? 1 : party;
      const fo = s.ledger.open({
        room: no, name: f.group && i > 0 ? `${f.group.name} (${f.group.members[i - 1] || 'CREW'})` : p.name, guestId: p.id, party: pp, nights,
        rateCode: rate, rate: nightly(r.beds, pp, rate, acct), pay, account: p.stay.account || null, at: s.clock.min,
      });
      fo.beds = r.beds; fo.accountObj = acct;
      s.ledger.recharge(fo, s.clock.min);
      s.rooms.register(no, p, pp);
      s.rooms.get(no).reservedFor = null;
      return fo;
    });
    if (f.res) f.res.arrived = true;
    s.g.sound.printer(6);
    s.onRegistered(p, rooms, folios, f);
    this.msg = `POSTED. FOLIO ${folios.map((x) => x.id).join(', ')}. REG CARD${rooms.length > 1 ? 'S' : ''} PRINTING.`;
    s.g.sound.terminalBeep();
    this.form = { p: null, posted: rooms };
    return true;
  }

  renderCheckin() {
    const s = this.s, f = this.form;
    const out = [this.header('F1 CHECK-IN')];
    if (!f || !f.p) {
      out.push('');
      if (f && f.posted) out.push(span('hi', `  ROOM ${f.posted.join(', ')} REGISTERED.`), '', '  Take the payment. Then the key off the rack.');
      else out.push('  NO GUEST WAITING TO BE ENTERED.', '', span('dim', '  Talk to the guest at the desk first: name, how many,'), span('dim', '  how long, smoking, beds, how they are paying.'), span('dim', '  Then come back here. [ENTER] refresh'));
      out.push('', this.foot('[ESC] MAIN MENU'));
      return out.join('\n');
    }
    const p = f.p, k = p.known;
    const v = (x, txt) => (x === null ? span('warn blink', '?  (not asked)') : esc(txt));
    const rows = this.formRows(f);
    const mark = (row) => (rows[this.sel] === row ? '&gt;' : ' ');
    const acct = ACCOUNTS.find((a) => a.id === p.stay.account) || null;
    const rooms = f.options[f.roomI] || [];
    const r0 = rooms[0] ? s.rooms.def(rooms[0]) : null;
    const rateAmt = r0 ? nightly(r0.beds, f.group ? 1 : (f.party || 1), f.rate || 'RACK', acct) : 0;
    const total = rooms.reduce((n, no) => n + withTax(nightly(s.rooms.def(no).beds, f.group ? 1 : (f.party || 1), f.rate || 'RACK', acct)) * (f.nights || 1), 0);
    out.push(`  NAME ........ ${k.name ? span('hi', p.name.toUpperCase()) : span('warn blink', '??? -- ASK THE GUEST')}`);
    out.push(`  RESERVATION . ${f.res ? span('hi', `FOUND  ${f.res.code}  ${f.res.note || ''}`) : (k.reservation ? 'NONE ON FILE' : span('dim', 'not asked'))}`);
    if (f.group) out.push(`  GROUP ....... ${span('hi', `${f.group.name} -- ${f.group.rooms} ROOMS`)}`);
    out.push(`${mark('party')} PARTY ....... ${v(f.party, f.party)}`);
    out.push(`${mark('nights')} NIGHTS ...... ${v(f.nights, f.nights)}`);
    out.push(`${mark('beds')} BEDS ........ ${v(f.beds, BED_LABEL[f.beds] || '')}`);
    out.push(`${mark('smoking')} SMOKING ..... ${v(f.smoking, f.smoking ? 'YES' : 'NO')}`);
    out.push(`${mark('rate')} RATE ........ ${f.rate === null ? span('warn', '?  (RACK)') : esc(f.rate)}   ${rooms.length ? esc(money(rateAmt)) + ' + TAX' : ''}`);
    out.push(`${mark('pay')} PAY ......... ${v(f.pay, f.pay === 'TC' ? "TRAV CHK" : f.pay)}`);
    if (!rooms.length) out.push(`${mark('room')} ROOM ........ ${span('warn', 'NO VACANT CLEAN ROOMS')}`);
    else if (f.group) out.push(`${mark('room')} ROOMS ....... ${span('inv', ` &lt; ${rooms.join(' ')} &gt; `)}`);
    else {
      const st = s.rooms.get(rooms[0]);
      out.push(`${mark('room')} ROOM ........ ${span('inv', ` &lt; ${rooms[0]} &gt; `)} ${esc(s.rooms.describe(rooms[0]))}${st.sys === 'RS' ? span('warn', ' RSVD') : ''}`);
      out.push(`                ${span('dim', pad(r0.note || '', 44))}`);
    }
    out.push(line());
    out.push(`  TOTAL ${f.nights || 1} NIGHT(S)${rooms.length > 1 ? ` x ${rooms.length} RMS` : ''} ${'.'.repeat(20)} ${span('hi', money(total))}`);
    out.push(`${mark('post')} ${rows[this.sel] === 'post' ? span('inv', ' [ENTER] POST & PRINT REG CARD ') : '[ENTER] POST & PRINT REG CARD'}`);
    out.push(this.msg ? span('warn', `  ${this.msg}`) : '');
    out.push(this.foot('↑↓ FIELD   ←→ CHANGE   [ESC] MAIN'));
    return out.join('\n');
  }

  /* ============================================================
     F2 CHECK-OUT
     ============================================================ */
  checkoutList() {
    return this.s.ledger.folios.filter((f) => f.open).sort((a, b) => (b.departed ? 1 : 0) - (a.departed ? 1 : 0) || Number(a.room) - Number(b.room));
  }
  handleList(up, down, enter, back, listFn, pickFn) {
    const list = listFn();
    if (back) { this.screen = 'main'; this.sel = 0; return true; }
    if (!list.length) return true;
    if (up) this.sel = (this.sel + list.length - 1) % list.length;
    if (down) this.sel = (this.sel + 1) % list.length;
    if (enter) pickFn(list[Math.min(this.sel, list.length - 1)]);
    return true;
  }
  doCheckout(f) {
    const s = this.s;
    if (this.confirmCo !== f.id) { this.confirmCo = f.id; this.msg = `CHECK OUT ${f.room} ${f.name.toUpperCase()}? BAL ${money(s.ledger.balance(f))}  [ENTER] TO CONFIRM`; return; }
    this.confirmCo = null;
    s.checkOutFolio(f);
    this.msg = `${f.room} CHECKED OUT. RECEIPT PRINTING. FLIP THE TAB ON THE RACK.`;
    s.g.sound.printer(8);
    this.sel = 0;
  }
  renderCheckout() {
    const s = this.s, list = this.checkoutList();
    const out = [this.header('F2 CHECK-OUT'), span('dim', '  RM   NAME                  NTS  PAY      BALANCE  NOTE')];
    const start = Math.max(0, Math.min(this.sel - 6, list.length - 12));
    list.slice(start, start + 12).forEach((f, j) => {
      const i = start + j;
      const t = `  ${pad(f.room, 4)} ${pad(f.name.toUpperCase(), 21)} ${rpad(f.nights, 3)}  ${pad(f.pay, 8)} ${rpad(money(s.ledger.balance(f)), 8)}  ${f.departed ? 'KEY IN' : ''}`;
      out.push(i === this.sel ? span('inv', pad(t, W)) : (f.departed ? span('hi', t) : esc(t)));
    });
    if (!list.length) out.push('', '  NO OPEN FOLIOS.');
    while (out.length < 15) out.push('');
    out.push(this.msg ? span('warn', `  ${this.msg}`) : span('dim', '  KEY IN = KEY RETURNED OR IN THE DROP BOX'));
    out.push(this.foot('↑↓ SELECT   [ENTER] CHECK OUT   [ESC] MAIN'));
    return out.join('\n');
  }

  /* ============================================================
     F3 ROOMS
     ============================================================ */
  handleRooms(up, down, left, right, enter, back) {
    const all = this.s.rooms.all();
    if (back) { this.screen = 'main'; this.sel = 0; return true; }
    if (up) this.sel = (this.sel + all.length - 1) % all.length;
    if (down) this.sel = (this.sel + 1) % all.length;
    const st = all[this.sel];
    if ((left || right) && !st.guest) {
      const opts = ['VC', 'VD', 'OO'];
      const i = opts.indexOf(st.sys);
      st.sys = opts[((i < 0 ? 0 : i) + (right ? 1 : -1) + 3) % 3];
      this.msg = `${st.no} SET ${st.sys} IN SYSTEM.`;
    }
    return true;
  }
  renderRooms() {
    const s = this.s, all = s.rooms.all();
    const out = [this.header('F3 ROOMS'), span('dim', '  RM  SYS  GUEST            TYPE')];
    const start = Math.max(0, Math.min(this.sel - 5, all.length - 11));
    all.slice(start, start + 11).forEach((st, j) => {
      const i = start + j;
      const t = `  ${pad(st.no, 4)}${pad(st.sys, 4)} ${pad(st.guestName ? st.guestName.toUpperCase() : (st.sys === 'RS' ? `(${String(st.reservedFor || '').toUpperCase()})` : ''), 16)} ${pad(s.rooms.describe(st.no), 32)}`;
      out.push(i === this.sel ? span('inv', pad(t, W)) : st.sys === 'OO' ? span('dim', t) : esc(t));
    });
    const st = all[this.sel];
    out.push(line());
    out.push(`  ${span('hi', st.no)}  ${esc(st.def.note || '')}`);
    out.push(st.issues.size ? span('warn', `  ISSUES: ${[...st.issues].join(', ').toUpperCase()}`) : '');
    out.push(this.msg ? span('warn', `  ${this.msg}`) : span('dim', '  ←→ SET VC / VD / OUT OF ORDER (EMPTY ROOMS ONLY)'));
    out.push(this.foot('↑↓ SELECT   [ESC] MAIN'));
    return out.join('\n');
  }

  /* ============================================================
     F4 RESERVATIONS
     ============================================================ */
  resList() { return this.s.director.reservations; }
  resPick(r) { this.msg = r.arrived ? `${r.name.toUpperCase()} ALREADY IN.` : `${r.name.toUpperCase()}: ${r.note || ''} -- CHECK IN WITH F1 WHEN THEY ARRIVE.`; }
  renderRes() {
    const list = this.resList();
    const out = [this.header('F4 RESERVATIONS'), span('dim', `  TONIGHT, ${this.s.clock.dayLabel()}`), span('dim', '  CODE    NAME                   RMS NTS TYPE   NOTE')];
    list.forEach((r, i) => {
      const st = r.arrived ? 'IN' : r.noShow ? 'N/S' : '';
      const t = `  ${pad(r.code, 7)} ${pad(r.name.toUpperCase(), 22)} ${rpad(r.rooms || 1, 3)} ${rpad(r.nights, 3)} ${pad(BED_LABEL[r.beds] || r.beds, 6)} ${pad((r.room ? `BLOCK ${r.room} ` : '') + (r.gtd ? 'GTD ' : '') + (r.dnd ? 'DO NOT DISCLOSE ' : '') + st, 18)}`;
      out.push(i === this.sel ? span('inv', pad(t, W)) : r.arrived ? span('dim', t) : esc(t));
    });
    if (!list.length) out.push('  NONE.');
    out.push('');
    const fut = this.s.memory.d.reservations.filter((r) => r.takenShift === this.s.memory.shiftNo);
    if (fut.length) out.push(span('dim', `  TAKEN TONIGHT FOR LATER: ${fut.map((r) => `${r.name.toUpperCase()} (${r.forDay})`).join(', ')}`));
    while (out.length < 16) out.push('');
    out.push(this.msg ? span('warn', `  ${this.msg}`) : '');
    out.push(this.foot('↑↓ SELECT   [ESC] MAIN'));
    return out.join('\n');
  }

  /* ============================================================
     F5 NIGHT AUDIT
     Each step compares what the system believes with what is
     physically true, says what it found in plain words, and
     moves on. Nothing here punishes; it just tells the truth.
     ============================================================ */
  startAudit() {
    return { step: 0, done: false, results: [], noShowCharge: null, counted: false };
  }
  auditSteps() {
    return [
      { id: 'noshow', title: 'NO-SHOWS', run: () => this.auditNoShows() },
      { id: 'rack', title: 'ROOM RACK vs. SYSTEM', run: () => this.auditRack() },
      { id: 'drawer', title: 'COUNT THE DRAWER', run: () => this.auditDrawer() },
      { id: 'cards', title: 'CARD SLIPS', run: () => this.auditCards() },
      { id: 'vouchers', title: 'VOUCHERS & DIRECT BILL', run: () => this.auditVouchers() },
      { id: 'post', title: 'POST ROOM & TAX, ROLL THE DATE', run: () => this.auditPost() },
    ];
  }
  handleAudit(up, down, left, right, enter, back) {
    const s = this.s, A = this.audit;
    if (back) { this.screen = 'main'; this.sel = 0; return true; }
    if (!s.clock.past(3, 0) && !A.results.length) return true;
    if (A.done) return true;
    const steps = this.auditSteps();
    const cur = A.results[A.step];
    if (A.pending && (left || right)) { A.pending.choice = 1 - A.pending.choice; return true; }
    if (!enter) return true;
    if (A.pending) { A.pending.apply(A.pending.choice); A.pending = null; A.step++; }
    else if (!cur) { A.results[A.step] = steps[A.step].run(); if (!A.results[A.step].pending) A.step++; else A.pending = A.results[A.step].pending; }
    if (A.step >= steps.length) { A.done = true; s.auditDone(A); s.g.sound.printer(20); }
    return true;
  }
  auditNoShows() {
    const s = this.s, out = [];
    const miss = s.director.reservations.filter((r) => !r.arrived && !r.group);
    if (!miss.length) return { lines: ['Every reservation for tonight arrived.'], ok: true };
    for (const r of miss) { r.noShow = true; const st = r.room && s.rooms.get(r.room); if (st && st.sys === 'RS') st.sys = 'VC'; }
    const gtd = miss.filter((r) => r.gtd);
    const res = { lines: miss.map((r) => `${r.name.toUpperCase()} -- ${r.gtd ? 'GUARANTEED, card on file' : 'not guaranteed'}. Never came.`), ok: true };
    res.lines.push(miss.some((r) => r.room) ? 'Their blocked rooms go back to VACANT CLEAN in the system. (Flip the RSVD tab on the rack.)' : '');
    if (gtd.length) {
      res.pending = {
        q: `Charge ${gtd.map((r) => r.name).join(', ')} one night as a no-show?`, choice: 0, opts: ['YES, CHARGE IT', 'NO, WAIVE IT'],
        apply: (c) => { s.stats.noShowCharged = c === 0; res.lines.push(c === 0 ? 'No-show charged: one night plus tax to the card on file.' : 'No-show waived. June may have a feeling about it, or may not.'); },
      };
    }
    return res;
  }
  auditRack() {
    const s = this.s, lines = [];
    let n = 0;
    for (const st of s.rooms.all()) {
      const rack = st.status, sys = st.sys;
      const occ = sys === 'OC';
      if ((rack === 'OC') !== occ || (sys === 'VD' && rack === 'VC')) {
        n++;
        if (lines.length < 6) lines.push(`${st.no}: rack says ${rack}, system says ${sys}${st.guestName ? ` (${st.guestName.split(' ').slice(-1)[0].toUpperCase()})` : ''}.`);
      }
      if (st.keys < 2 && !st.guest && st.status !== 'OO') {
        n++;
        if (lines.length < 8) lines.push(`${st.no}: a key is out, but nobody is registered to the room.`);
      }
    }
    s.stats.rackOff = n;
    if (!n) return { lines: ['Every tab on the rack matches the system. Every key that is out belongs to somebody registered.'], ok: true };
    return { lines: [...lines, n > lines.length ? `...and ${n - lines.length} more.` : '', 'Fix the tabs on the rack. Luz cleans by the rack in the morning.'], ok: false };
  }
  auditDrawer() {
    const s = this.s, L = s.ledger;
    const expect = L.expectedDrawer();
    const actual = L.drawer;
    const delta = Math.round((actual - expect) * 100) / 100;
    s.stats.drawerDelta = delta;
    s.stats.audited = true;
    const lines = [`Opening bank ${money(BANK)}. Cash & checks taken per folios ${money(L.systemCash())}. Paid-outs with slips ${money(L.paidOuts.filter((p) => p.slip).reduce((a, p) => a + p.amt, 0))}.`, `System says the drawer should hold ${money(expect)}.`, `You count ${money(actual)}.`];
    if (Math.abs(delta) < 0.005) lines.push('Balanced to the penny.');
    else lines.push(`${delta < 0 ? 'SHORT' : 'OVER'} ${money(Math.abs(delta))}. ${delta < 0 ? 'Usually change handed back twice, or money out of the drawer without a slip.' : 'Usually change that never got handed back, or cash nobody rang to a folio.'}`);
    if (s.g.player.cash.tendered > 0.004) lines.push(`(There is ${money(s.g.player.cash.tendered)} in your hand that never went in the register.)`);
    return { lines, ok: Math.abs(delta) < 0.005 };
  }
  auditCards() {
    const s = this.s, L = s.ledger;
    const cardFolios = L.folios.filter((f) => f.payments.some((p) => p.type === 'CARD'));
    const lines = [`${L.slips.length} slip(s) in the box. ${cardFolios.length} folio(s) paid by card.`];
    const bad = L.slips.filter((sl) => sl.expired);
    for (const b of bad) lines.push(`${b.card.type} ${b.card.name} EXP ${b.card.exp} -- EXPIRED. The bank will send this one back.`);
    s.stats.expiredTaken = bad.length;
    const unpaidCard = L.folios.filter((f) => f.open && f.pay === 'CARD' && L.balance(f) > 0.004);
    for (const f of unpaidCard.slice(0, 3)) lines.push(`${f.room} ${f.name.toUpperCase()}: on a card, but no slip. Balance ${money(L.balance(f))}.`);
    if (!bad.length && !unpaidCard.length) lines.push('Every slip is signed, in date, and matches a folio.');
    return { lines, ok: !bad.length && !unpaidCard.length };
  }
  auditVouchers() {
    const s = this.s, L = s.ledger;
    const lines = [];
    if (!L.vouchers.length) lines.push('No vouchers tonight.');
    for (const v of L.vouchers) lines.push(`${v.company}: ${v.rooms} room(s). ${v.onFile ? 'Account on file -- billed direct.' : 'NO ACCOUNT ON FILE. June will be calling somebody.'}`);
    const direct = L.folios.filter((f) => f.pay === 'DIRECT');
    if (direct.length) lines.push(`${direct.length} direct-bill folio(s): ${direct.map((f) => f.room).join(', ')}.`);
    return { lines, ok: L.vouchers.every((v) => v.onFile) };
  }
  auditPost() {
    const s = this.s, L = s.ledger;
    const occ = s.rooms.all().filter((st) => st.sys === 'OC').length;
    L.roomTaxPosted = true;
    s.stats.occupied = occ;
    const rev = L.roomRevenue();
    return { lines: [`${occ} rooms occupied. Room revenue on the books ${money(rev)}, tax ${money(rev * TAX)}.`, 'Reports printing for June: the D-report, the rack sheet, the cash sheet.', 'The system date rolls to today. Go make the coffee.'], ok: true };
  }
  renderAudit() {
    const s = this.s, A = this.audit;
    const out = [this.header('F5 NIGHT AUDIT')];
    if (!s.clock.past(3, 0) && !A.results.length) {
      out.push('', '  THE AUDIT RUNS AT 3:00 AM.', '', span('dim', '  It checks tonight against itself: the rack, the drawer,'), span('dim', '  the card slips, the vouchers, the reservations that never'), span('dim', '  came. Then it posts the room revenue and rolls the date.'));
      while (out.length < 18) out.push('');
      out.push(this.foot('[ESC] MAIN'));
      return out.join('\n');
    }
    const steps = this.auditSteps();
    steps.forEach((st, i) => {
      const r = A.results[i];
      const tag = r ? (r.ok ? span('hi', '[ OK ]') : span('warn', '[LOOK]')) : i === A.step ? span('inv blink', '[ >> ]') : span('dim', '[    ]');
      out.push(`  ${tag} ${esc(`${i + 1}. ${st.title}`)}`);
    });
    out.push(line());
    const show = A.results[Math.min(A.step, steps.length) - (A.results[A.step] ? 0 : 1)] || A.results[A.step - 1];
    if (show) for (const l of show.lines.filter(Boolean).slice(0, 7)) out.push(`  ${esc(l).slice(0, 180)}`);
    if (A.pending) out.push('', `  ${span('warn', A.pending.q)}`, `  ${A.pending.opts.map((o, i) => (i === A.pending.choice ? span('inv', ` ${o} `) : ` ${o} `)).join('   ')}`);
    while (out.length < 19) out.push('');
    out.push(this.foot(A.done ? 'AUDIT COMPLETE.   [ESC] MAIN' : A.pending ? '←→ CHOOSE   [ENTER] CONFIRM' : '[ENTER] RUN NEXT STEP   [ESC] MAIN'));
    return out.join('\n');
  }

  /* ============================================================
     DRAWING
     ============================================================ */
  header(title) {
    const s = this.s;
    const d = s.clock.date;
    const dt = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate() + (s.clock.min >= 1440 ? 1 : 0)).padStart(2, '0')}/97`;
    return `${span('inv', pad(` STARLITE MOTOR LODGE     PROPERTY SYSTEM v2.4   ${dt} ${rpad(s.clock.label(), 8)}`, W))}\n ${span('hi', title)}\n${line()}`;
  }
  foot(t) { return `${line()}\n${span('dim', ` ${t}`)}`; }

  renderMain() {
    const s = this.s;
    const all = s.rooms.all();
    const occ = all.filter((st) => st.sys === 'OC').length, vc = all.filter((st) => s.rooms.sellable(st)).length;
    const vd = all.filter((st) => st.sys === 'VD').length, oo = all.filter((st) => st.sys === 'OO').length;
    const due = s.director.reservations.filter((r) => !r.arrived && !r.noShow).length;
    const items = ['F1  CHECK-IN', 'F2  CHECK-OUT', 'F3  ROOMS', 'F4  RESERVATIONS', 'F5  NIGHT AUDIT'];
    const out = [this.header('MAIN MENU'), ''];
    items.forEach((t, i) => out.push(i === this.sel ? `   ${span('inv', ` ${pad(t, 22)} `)}` : `    ${esc(t)}`));
    out.push('');
    const g = this.guestAtDesk();
    out.push(g ? span('hi blink', `  >> ${g.name.toUpperCase()} WAITING TO BE ENTERED -- F1`) : '');
    const drop = s.keyDrop.length;
    out.push(drop ? span('warn', `  >> ${drop} KEY(S) IN THE DROP BOX -- CHECK THEM OUT (F2)`) : '');
    out.push(s.clock.past(3, 0) && !(this.audit && this.audit.done) ? span('warn', '  >> NIGHT AUDIT IS DUE -- F5') : '');
    while (out.length < 17) out.push('');
    out.push(line());
    out.push(` OCC ${rpad(occ, 2)}/28   VAC CLN ${rpad(vc, 2)}   DIRTY ${rpad(vd, 2)}   O-O-O ${oo}   ARR DUE ${due}`);
    out.push(this.foot('↑↓ + [ENTER], OR F1-F5 / 1-5     [ESC] STEP AWAY'));
    return out.join('\n');
  }

  render() {
    switch (this.screen) {
      case 'checkin': return this.renderCheckin();
      case 'checkout': return this.renderCheckout();
      case 'rooms': return this.renderRooms();
      case 'res': return this.renderRes();
      case 'audit': return this.renderAudit();
      default: return this.renderMain();
    }
  }
}

export { makeItem, cardExpired, Clock };
