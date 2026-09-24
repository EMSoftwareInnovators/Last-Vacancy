/* ============================================================
   shift.js -- one night on the desk at the Starlite.

   The shift owns the night: the clock and every system that runs
   on it, the director's plan, the conversation you are in, the
   phone call you are on, whatever overlay has your hands (the
   terminal, the key rack, a piece of paper, a shelf). Each frame it
   routes input to whatever has focus, runs the systems in order,
   works out what the HUD should say, and hands the renderer what
   to draw.

   Most of what is below is the glue the systems call back into:
   a guest who walked to the wrong door, a man at the ice machine
   with an empty bucket, a waffle iron beginning to smoke. Each
   hook is short, and says what the motel does about it.
   ============================================================ */
import { ST } from './game.js';
import { makeRng, angleTowards } from '../engine/mathx.js';
import { SPOTS, zoneAt, INDOOR, ROOM_BY_NO, DESK_PROPS, STATION_BY_ID, NEWS_DROP, BTV, GATES } from './world/layout.js';
import { createPlayer, topItem, dropTop } from './player.js';
import { DialogueRunner, say, reply, money, round2 } from './dialogue/runner.js';
import { Clock } from './sim/clock.js';
import { Rooms } from './sim/rooms.js';
import { Ledger } from './sim/ledger.js';
import { Memory } from './sim/memory.js';
import { NPCs, walkTo, toDesk, exitRoom, enterRoom, inRoom, idle, until } from './sim/npcs.js';
import { Cars } from './sim/cars.js';
import { Desk } from './sim/desk.js';
import { Phone } from './sim/phone.js';
import { Tasks, WakeSheet } from './sim/tasks.js';
import { Property } from './sim/property.js';
import { Breakfast } from './sim/breakfast.js';
import { Barks } from './sim/barks.js';
import { Director } from './sim/director.js';
import { makeItem, itemLabel } from './sim/items.js';
import { BARKS } from './content/chatter.js';
import { firstNote, juneNote, noteHtml, reportHtml } from './content/notes.js';
import { checkinNode, checkoutNode, rentNode, complaintNode } from './dialogue/desk.js';
import { chatNode, visitNode, doorNode, staffNode, handoffNode } from './dialogue/cast.js';
import { wakeCall, callJune, locatorCall, pillowCall } from './dialogue/calls.js';
import { Interact, MOP_HOME } from './interact.js';
import { Terminal } from './ui/terminal.js';
import { Board } from './ui/board.js';
import { newsHtml } from './ui/papers.js';
import { choicesHtml } from './ui/ui.js';

const at = Clock.at;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class Shift {
  constructor(game, o = {}) {
    this.g = game;
    const saved = o.continue ? Memory.load() : null;
    if (!o.continue) Memory.clear();
    this.memory = saved || Memory.fresh();
    this.seed = (Math.random() * 4294967295) >>> 0;
    this.rng = makeRng(this.seed);
    this.clock = new Clock(this.memory.date());
    this.clock.minDelta = 0;
    this.rooms = new Rooms();
    this.ledger = new Ledger();
    this.npcs = new NPCs(this);
    this.cars = new Cars(this);
    this.desk = new Desk(this);
    this.phone = new Phone(this);
    this.tasks = new Tasks(this);
    this.wakeups = new WakeSheet(this);
    this.property = new Property(this);
    this.breakfast = new Breakfast(this);
    this.barks = new Barks(this);
    this.director = new Director(this);
    this.runner = new DialogueRunner();
    this.terminal = new Terminal(this);
    this.board = new Board(this);
    this.interact = null;
    this.stats = {
      holds: 0, missedCalls: 0, hungUpOnHold: 0, tasksDone: 0, tasksFailed: 0, wakeMissed: 0, pots: 0, shortages: 0, spills: 0,
      corrections: 0, caughtExpired: 0, wrongKeys: 0, refunds: 0, putOff: 0, privacy: 0, privacyKept: 0, reservationsTaken: 0,
      calledJune: 0, lies: 0, luzWaited: 0, checkins: 0, walkIns: 0, checkouts: 0, calls: 0, departures: 0, rackOff: 0,
      drawerDelta: 0, audited: false, expiredTaken: 0, occupied: 0, wakesMade: 0, lostGuests: 0, misTransfers: 0, waffleIncidents: 0,
    };
    this.flags = {};
    this.notesLog = [];
    this.speaking = null;
    this.mode = null;             // null | talk | phone | terminal | board | paper | picker
    this.call = null;
    this.picker = null;
    this.pendingSale = null;
    this.keyDrop = [];
    this.printerTray = [];
    this.floorItems = [];
    this.laundryRunning = false;
    this.indoor = true;
    this.mopOut = false;
    this.notesOpen = false;
    this.shiftOver = false;
    this.objT = 0;
    this.juneLines = this.memory.d.lastShift && this.memory.d.lastShift.note ? this.memory.d.lastShift.note : firstNote();
  }

  get dynSolids() { return this.g.doors.solids.concat(this.cars.solids); }

  /* ============================================================
     START
     ============================================================ */
  start() {
    const g = this.g;
    g.player = createPlayer();
    const p = g.player;
    p.x = SPOTS.clerk.x; p.z = SPOTS.clerk.z; p.yaw = 0; p.pitch = -0.12;
    this.interact = new Interact(this);
    this.director.setup();
    this.rooms.refreshGlow();
    g.state = ST.PLAY;
    g.ui.setHudVisible(true);
    g.ui.cinema(false);
    g.fade = 1; g.fadeTo = 0;
    this.openPaper(noteHtml(this.juneLines, { date: this.memory.shiftNo === 1 ? 'on the back of a Sysco invoice, paper-clipped to the terminal' : 'on the back of last night\'s D-report', foot: `${g.ui.keyHint('back')} put it down and clock in` }));
    g.wantLock = true;
    g.grabLock();
  }

  dispose() {
    const ui = this.g.ui;
    ui.hideDialogue(); ui.hidePhone(); ui.hideTerminal(); ui.hideBoard(); ui.hidePaper(); ui.hideNotes();
    ui.clearSubtitles(); ui.setPrompt(''); ui.setObjective(''); ui.setHold(0);
  }

  /* ============================================================
     THE FRAME
     ============================================================ */
  update(dt, state) {
    const g = this.g;
    if (state === ST.END) { this.updateEnd(); return; }
    const input = g.input;

    // Escape backs out of whatever you are looking at, and pauses if nothing is open
    if (input.hit('Escape') && (!this.mode || this.mode === 'talk' || this.mode === 'phone')) { g.pause(); return; }
    if (input.hit('Tab') && !this.mode) { this.notesOpen = !this.notesOpen; g.sound.paper(); }

    /* ---- the clock ---- */
    const talking = this.mode === 'talk' || this.mode === 'phone';
    this.clock.slow = talking ? 0.5 : this.mode ? 0.65 : 1;
    this.clock.fast = this.stoolFast();
    const before = this.clock.min;
    this.clock.update(dt);
    this.clock.minDelta = this.clock.min - before;

    /* ---- the systems ---- */
    this.director.update(dt);
    this.npcs.update(dt);
    const vis = this.npcs.list.filter((p) => !p.hidden);
    this.cars.update(dt, vis, g.player);
    this.desk.update(dt);
    this.phone.update(dt);
    this.wakeups.update();
    this.property.update(dt);
    this.breakfast.update(dt);
    this.barks.update(dt);
    this.faceSpeaker(dt);
    this.cull();

    /* ---- focus ---- */
    switch (this.mode) {
      case 'talk': this.updateTalk(); break;
      case 'phone': this.updatePhone(); break;
      case 'terminal': if (!this.terminal.handle(input)) this.closeOverlay(); else g.ui.showTerminal(this.terminal.render()); break;
      case 'board': if (!this.board.handle(input)) this.closeOverlay(); else { const b = this.board.render(); g.ui.showBoard(b.grid, b.info); } break;
      case 'paper': if (input.hit('Escape', 'UiBack', 'KeyE', 'Enter', 'Space', 'Backspace') || g.input.mousePressed[0]) this.closeOverlay(); break;
      case 'picker': if (!this.picker.handle(input)) this.closeOverlay(); else g.ui.showPaper(this.picker.render()); break;
      default: this.updateWorld(dt); break;
    }

    /* ---- doors, the listener, ambience ---- */
    const pl = g.player;
    const people = vis.map((p) => p);
    people.push({ x: pl.x, z: pl.z, lv: pl.lv, isPlayer: true, moving: true, hidden: false });
    const opened = g.doors.update(dt, people);
    for (const d of opened) {
      const { gain, pan } = g.sound.at(d.hx, d.hz, 14, this.indoor ? 1 : 0.6);
      if (d.bell) g.sound.doorBell(pan, Math.max(0.1, gain));
      else if (gain > 0.02) g.sound.doorOpen(pan, gain);
    }
    const zone = zoneAt(pl.x, pl.z, pl.lv);
    this.indoor = INDOOR(zone);
    g.sound.setListener(pl.x, pl.z, pl.yaw, this.indoor ? 1 : 0);
    g.placeAmbience(this);
    this.rooms.refreshGlow();

    /* ---- the HUD ---- */
    this.hud(dt);
    this.collectDraws();

    /* ---- seven o'clock ---- */
    if (this.clock.past(7, 25) && !this.mode && !this.shiftOver) {
      const t = this.npcs.find('TRAVIS');
      if (t && !t.hidden) this.talkTo(t);
    }
  }

  /** Walking about: move, look, use things. */
  updateWorld(dt) {
    const g = this.g, pl = g.player, input = g.input;
    const ctx = { solids: g.solids, dynSolids: this.dynSolids, playerStep: (run) => this.playerStep(run) };
    if (pl.sitting) {
      pl.eye += (1.22 - pl.eye) * Math.min(1, dt * 6);
      if (input.hit('KeyF', 'PadRB') || (input.moveX || input.moveZ)) this.standUp();
    } else pl.eye += (1.62 - pl.eye) * Math.min(1, dt * 6);
    g.updateWalk(dt, ctx);
    if (!pl.sitting && input.hit('KeyF', 'PadRB') && g.playerZone === 'desk') this.sitDown();
    if (input.hit('KeyG', 'PadX')) this.dropItem();
    this.interact.update(dt, input);
    // a paper you picked up off the floor
    if (this.notesOpen) g.ui.showNotes(this.tasks.html(), `${g.ui.keyHint('notes')} close`); else g.ui.hideNotes();
  }

  idleDraw() { this.collectDraws(); }

  /* ============================================================
     TIME: the stool
     ============================================================ */
  needsYou() {
    return this.phone.anyRinging() || this.desk.waiting().length > 0 || this.wakeups.due(this.clock.min).length > 0 || (this.pendingSale && !this.pendingSale.rung);
  }
  stoolFast() {
    const pl = this.g.player;
    if (!pl.sitting || this.mode) return 1;
    if (this.needsYou()) { this.standUp('Somebody needs you.'); return 1; }
    return 5;
  }
  sitDown() {
    const pl = this.g.player;
    pl.sitting = true;
    pl.x = DESK_PROPS.stool.x; pl.z = DESK_PROPS.stool.z;
    this.g.sound.cloth();
  }
  standUp(why) {
    const pl = this.g.player;
    if (!pl.sitting) return;
    pl.sitting = false;
    if (why) this.toast(why, 'note');
  }
  toggleStool() { if (this.g.player.sitting) this.standUp(); else this.sitDown(); }

  /* ============================================================
     HANDS
     ============================================================ */
  held() { return this.g.player.held; }
  heldOf(kind, pred) { return this.g.player.held.find((h) => h.kind === kind && (!pred || pred(h))) || null; }
  heldAll(kind) { return this.g.player.held.filter((h) => h.kind === kind); }
  canHold(it) {
    const H = this.g.player.held;
    if (it.pocket) return H.filter((h) => h.pocket).length < 12;
    const hands = H.filter((h) => !h.pocket);
    if (it.bulky) return hands.length === 0;
    if (hands.some((h) => h.bulky)) return false;
    return hands.length < 3;
  }
  giveItem(it, quiet) {
    if (!this.canHold(it)) { this.toast('Your hands are full. (G puts something down.)', 'bad'); return false; }
    this.g.player.held.push(it);
    if (!quiet) this.g.sound.pickup();
    return true;
  }
  removeHeld(it) {
    const H = this.g.player.held, i = H.indexOf(it);
    if (i >= 0) H.splice(i, 1);
    return i >= 0;
  }
  handsText() { return this.g.player.held.map((h) => itemLabel(h).toLowerCase()).join(', '); }
  dropItem() {
    const pl = this.g.player;
    const top = [...pl.held].reverse().find((h) => !h.pocket) || topItem(pl);
    if (!top) return;
    if (top.kind === 'mop') { this.toggleMop(true); return; }
    this.removeHeld(top);
    const fx = Math.sin(pl.yaw) * 0.6, fz = Math.cos(pl.yaw) * 0.6;
    this.floorItems.push({ item: top, x: pl.x + fx, z: pl.z + fz, lv: pl.lv, y: pl.y });
    this.g.sound.drop();
  }

  /* ============================================================
     TALKING
     ============================================================ */
  personPrompt(p) {
    if (this.desk.line.includes(p)) {
      if (!this.desk.isFront(p)) return `${p.name.split(' ')[0]} is waiting in line`;
      const why = { checkin: 'Help', checkout: 'Check out', rent: 'Take the week\'s rent from', complaint: 'Talk to', visit: 'Talk to', upset: 'Talk to' }[p.deskReason] || 'Talk to';
      return `${why} ${p.name}`;
    }
    if (p.kind === 'staff') return `Talk to ${p.name.split(' ')[0]}`;
    if (p.asleep) return null;
    return `Talk to ${p.known && p.known.name || p.rosterId && this.memory.known(p.rosterId) && this.memory.guest(p.rosterId).withYou ? p.name : p.tagLine ? `the ${p.kind === 'crew' ? 'man in orange' : 'guest'}` : p.name}`;
  }

  talkTo(p) {
    if (this.desk.line.includes(p) && !this.desk.isFront(p)) {
      p.mood += 2;
      this.barks.line(p, this.rng.pick(['Take your time.', 'No hurry.', 'I\'m next, I think.']), { range: 6 });
      return;
    }
    let node = null;
    if (this.desk.line.includes(p)) node = this.deskNode(p);
    else if (p.kind === 'staff') node = staffNode(this, p);
    else if (p.atDoor) node = doorNode(this, p, p.atDoor === true ? null : p.atDoor);
    else node = chatNode(this, p);
    if (!node) return;
    this.startTalk(p, node);
  }

  deskNode(p) {
    switch (p.deskReason) {
      case 'checkin': return checkinNode(this, p);
      case 'checkout': return checkoutNode(this, p);
      case 'rent': return rentNode(this, p);
      case 'visit': return visitNode(this, p);
      case 'upset': return this.upsetNode(p);
      case 'complaint': case 'question': default: return complaintNode(this, p);
    }
  }

  startTalk(p, node) {
    const g = this.g;
    this.standUp();
    this.mode = 'talk';
    this.speaking = p;
    p.talkYaw = Math.atan2(g.player.x - p.x, g.player.z - p.z);
    this.runner.start(p, node, (pp) => this.endTalk(pp));
    g.ui.setPrompt(''); g.ui.setReticle(false); g.ui.hideNotes();
    g.ui.showDialogue(node, 0);
  }

  updateTalk() {
    const g = this.g, i = g.input, R = this.runner;
    if (!R.node) { this.mode = null; g.ui.hideDialogue(); return; }
    const n = R.node.choices ? R.node.choices.length : 0;
    if (i.hit('ArrowUp', 'KeyW')) { R.move(-1); g.sound.uiMove(); }
    if (i.hit('ArrowDown', 'KeyS')) { R.move(1); g.sound.uiMove(); }
    const dig = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].findIndex((k) => i.hit(k));
    let go = i.hit('KeyE', 'Enter', 'Space') || i.mousePressed[0];
    if (dig >= 0 && dig < n) { R.sel = dig; go = true; }
    if (go) {
      if (g.ui.typing) { g.ui.finishTyping(); return; }
      g.sound.uiSelect();
      R.pick();
    }
    if (R.node) g.ui.showDialogue(R.node, R.sel);
  }

  endTalk(p) {
    this.mode = null;
    this.speaking = null;
    this.g.ui.hideDialogue();
    if (p) { p.talkYaw = undefined; if (p.atDoor) this.closeDoorVisit(p); }
    this.g.wantLock = true;
  }

  faceSpeaker(dt) {
    const p = this.speaking, pl = this.g.player;
    if (!p || !p.x) return;
    if (p.sit && !p.porch) return;
    p.yaw = angleTowards(p.yaw, Math.atan2(pl.x - p.x, pl.z - p.z), dt * 5);
  }

  /** Somebody you gave a room to, and then gave the key to their sister. */
  upsetNode(p) {
    return say(p, 'My sister just called my room. My ROOM. Twenty minutes ago she didn\'t know what state I was in.', [
      reply('I\'m so sorry. That was my mistake.', () => { p.mood -= 10; this.finishDesk(p, 'complaint'); return say(p, '...Okay. Okay. It\'s done. Can you at least not put her through again?', [reply('Nobody gets through. I promise.', () => null)]); }),
    ]);
  }

  /* ---------------- the desk's side of the conversation ---------------- */
  onGuestToSystem(p) {
    this.g.sound.cloth();
  }

  /** The terminal posted a check-in. */
  onRegistered(p, rooms, folios, form) {
    const ci = p.ci;
    ci.stage = 'pay';
    ci.folio = folios[0];
    ci.room = rooms[0];
    ci.said = false;
    p.room = rooms[0];
    this.stats.checkins++;
    if (!p.stay.reservation && !p.inHouse) this.stats.walkIns++;
    if (rooms.length > 1) { p.groupRooms = rooms; p.groupFolios = folios; }
    const r = this.rooms.def(rooms[0]);
    // what they will notice once they are in the room
    p.bedMismatch = !p.groupRooms && p.stay.party >= 3 && r.beds !== 'QQ';
    p.smokeMismatch = !p.groupRooms && !p.stay.smoking && r.smoking;
    if (!p.groupRooms && p.stay.smoking && !r.smoking) this.flags.smokedInNon = r.no;
    if (p.rosterId) this.memory.stayed(p.rosterId, rooms[0], null);
    const res = this.director.reservationFor(p);
    if (res) res.arrived = true;
    this.log(`Checked in ${p.name} to ${rooms.join(', ')}.`, 'plain');
  }

  finishDesk(p, reason) {
    this.desk.finish(p);
    if (reason === 'checkin') {
      if (p.rekey) { p.rekey = false; return; }      // a new key for a stay already under way
      const ci = p.ci;
      if (p.rosterId && ci) { const g = this.memory.guest(p.rosterId); if (ci.liked === false) g.opinion--; }
      this.director.afterCheckin(p);
      this.scheduleGuestEvents(p);
    }
    if (reason === 'checkout') this.stats.checkouts++;
  }

  /** Per-guest things that happen later in the night, once they have a room. */
  scheduleGuestEvents(p) {
    const s = this, D = this.director;
    if (p.rosterId === 'PILLOWS') {
      [30, 58, 86].forEach((m, i) => D.after(m + this.rng() * 8, () => { if (!p.asleep && p.inRoom) s.incoming(pillowCall(s, p, i)); }, 'pillows'));
    }
    if (p.rosterId === 'URN') {
      D.at(Math.max(this.clock.min + 30, at(23, 35) + this.rng() * 40), () => s.incoming(locatorCall(s, p, {
        opener: 'Hi -- I\'m sorry, it\'s so late. My mother\'s staying there, I think. Carol Haskins? She\'s driving to Arizona with my father\'s -- with my father. She won\'t answer the car phone. I just want to know she stopped.',
        message: 'Call Julie. She just wants to hear your voice.', pitch: 1.3,
      })), 'urn daughter');
      D.at(Math.max(this.clock.min + 20, at(23, 0)), () => { if (p.inRoom && !p.asleep) { s.npcs.interrupt(p, exitRoom()); p.queue.splice(1, 0, walkTo(3.2, 21.6, 0), idle(360, { face: 0, sit: false }), enterRoom(), inRoom(p.bedAt)); } }, 'urn pool');
    }
    if (p.def && p.def.arch === 'hiding') {
      D.after(40 + this.rng() * 30, () => s.incoming(locatorCall(s, p, { opener: `Hi, is there a ${p.name} staying there? This is her sister. It's important. It's not important. But it's important.`, pitch: 1.3 })), 'sister');
    }
    if (p.rosterId === 'PRUITT') {
      D.at(Math.max(this.clock.min + 25, at(21, 40) + this.rng() * 30), () => s.incoming(locatorCall(s, p, {
        opener: 'Is Ron Pruitt there? This is his mother-in-law. They were supposed to call when they stopped. They never call when they stop.',
        afterPolicy: 'Put me through, then. I\'ll wait. I\'m very good at waiting. Ask Ron.', message: 'Call Sherri\'s mother.', pitch: 1.2, rough: 0.5,
      })), 'mil');
    }
    if (p.rosterId === 'KYLE') {
      D.at(Math.max(this.clock.min + 40, at(23, 40) + this.rng() * 40), () => {
        if (!p.inRoom) return;
        const st = this.rooms.get(p.room); st.powerOut = true; st.lightsOn = false; st.tvOn = false;
        p.visitId = 'KYLE';
        s.npcs.interrupt(p, exitRoom());
        p.queue.splice(1, 0, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0), toDesk('visit'), enterRoom(), inRoom(p.bedAt));
      }, 'breaker');
    }
    if (p.rosterId === 'MAGIC') {
      // cards turn up
      const spots = [{ x: 7.3, z: -2.9, label: 'THREE OF CLUBS' }, { x: 8.0, z: 32.3, label: 'SEVEN OF DIAMONDS' }, { x: -4.9, z: -5.4, label: 'JACK OF HEARTS' }];
      D.after(20, () => { for (const c of spots) this.floorItems.push({ item: makeItem('lost', { what: `PLAYING CARD: ${c.label}`, owner: p.id, mesh: 'card' }), x: c.x, z: c.z, lv: 0, y: 0 }); }, 'cards');
    }
    if (p.rosterId === 'STORM') p.wantsChannel = 'WEATHER';
    if (p.def && p.def.dog) this.flags.petAllowed = true;
  }

  /** Moving a guest to a different room, mid-stay. */
  moveGuest(p, no) {
    const old = p.room;
    const f = this.ledger.folioForRoom(old);
    this.rooms.checkout(old);
    this.rooms.register(no, p, p.stay.party);
    if (f) f.room = no;
    p.room = no; p.rekey = true;
    for (const id of p.party) { const c = this.npcs.find(id); if (c) { c.room = no; } }
    if (p.keyFor) { this.giveItem(makeItem('key', { room: p.keyFor, from: p.id })); p.keyFor = null; }
    p.ci = p.ci || {};
    p.ci.stage = 'key'; p.ci.room = no; p.ci.wakeAsked = true;
    p.deskReason = 'checkin';
    p.complaint = null;
    this.log(`Moved ${p.name} from ${old} to ${no}.`, 'plain');
  }

  /** A guest in their room decides to walk over to the office about something. */
  guestComesDown(p, complaint) {
    if (!p || p.gone || p.asleep) return;
    p.complaint = complaint;
    if (p.inRoom) {
      this.npcs.interrupt(p, exitRoom());
      p.queue.splice(1, 0, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0), toDesk('complaint'), enterRoom(), inRoom(p.bedAt));
    } else {
      this.npcs.interrupt(p, walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0));
      p.queue.splice(1, 0, toDesk('complaint'), enterRoom(), inRoom(p.bedAt));
    }
  }

  checkOutFolio(f) {
    const L = this.ledger;
    f.open = false;
    this.rooms.checkout(f.room);
    this.printerTray.push({ kind: 'receipt', room: f.room, label: `receipt, Rm ${f.room}` });
    const i = this.keyDrop.findIndex((k) => k.room === f.room);
    if (i >= 0 && !f.keyCollected) { /* the key is still in the drop box; that's fine */ }
    this.stats.checkouts += f.departed ? 0 : 0;
    this.log(`Checked out ${f.room} (${f.name}). Balance ${money(L.balance(f))}.`, 'plain');
  }

  departed(p) { /* the director marks the folio; nothing else to do */ }

  /* ============================================================
     THE PHONE
     ============================================================ */
  incoming(call) {
    const c = this.phone.incoming(call);
    if (!c && call.onBusy) call.onBusy(call);
    return c;
  }
  phonePrompt() {
    const r = this.phone.ringing()[0];
    if (r) return `Answer the phone -- LINE ${r.line}${r.from === 'room' ? ` (Rm ${r.room})` : ''}`;
    const h = this.phone.onHold()[0];
    if (h) return `Pick up LINE ${h.line} (on hold)`;
    return 'Phone';
  }
  usePhone() {
    const r = this.phone.ringing().sort((a, b) => b.t - a.t)[0];
    if (r) { this.startCall(r); return; }
    const h = this.phone.onHold()[0];
    if (h) { this.resumeCall(h); return; }
    this.outboundMenu();
  }
  startCall(call) {
    const g = this.g;
    this.standUp();
    this.phone.answer(call);
    g.sound.phonePickup();
    this.call = call;
    this.stats.calls++;
    const node = call.script(this, call);
    this.mode = 'phone';
    this.runner.start(call.who, node, () => this.endCall(call));
    this.showPhoneNode();
  }
  resumeCall(call) {
    this.phone.answer(call);
    this.call = call;
    this.g.sound.phonePickup();
    this.mode = 'phone';
    this.runner.start(call.who, call.resume || say(call.who, 'Hello? You still there?', [reply('Sorry about that.', () => null)]), () => this.endCall(call));
    this.showPhoneNode();
  }
  endCall(call) {
    if (call && call.holding) { call.holding = false; }
    else if (call) { this.phone.end(call, 'done'); this.g.sound.phoneHang(); }
    this.call = null;
    this.mode = null;
    this.g.ui.hidePhone();
  }
  /** The choices on the phone pad, plus HOLD when something else wants you. */
  phoneChoices(node) {
    const ch = (node.choices || []).slice();
    const other = this.phone.ringing().find((c) => c !== this.call);
    if (this.call && (other || this.desk.waiting().length)) {
      ch.push(reply(other ? `(HOLD -- answer LINE ${other.line}.)` : '(HOLD -- somebody\'s at the desk.)', () => {
        const call = this.call;
        call.holding = true;
        this.phone.hold(call, this.runner.node);
        this.g.sound.phoneButton();
        if (other) setTimeout(() => {}, 0);
        this._answerNext = other || null;
        return null;
      }));
    }
    return ch;
  }
  showPhoneNode() {
    const R = this.runner;
    if (!R.node) return;
    const node = { ...R.node, choices: this.phoneChoices(R.node) };
    this._phoneNode = node;
    this.g.ui.showPhone(node, R.sel, this.phone.lampsHtml());
  }
  updatePhone() {
    const g = this.g, i = g.input, R = this.runner;
    if (!R.node) { this.mode = null; g.ui.hidePhone(); return; }
    const node = this._phoneNode || R.node;
    const n = (node.choices || []).length;
    if (i.hit('ArrowUp', 'KeyW')) { R.sel = (R.sel + n - 1) % Math.max(1, n); g.sound.uiMove(); }
    if (i.hit('ArrowDown', 'KeyS')) { R.sel = (R.sel + 1) % Math.max(1, n); g.sound.uiMove(); }
    const dig = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].findIndex((k) => i.hit(k));
    let go = i.hit('KeyE', 'Enter', 'Space') || i.mousePressed[0];
    if (dig >= 0 && dig < n) { R.sel = dig; go = true; }
    if (go) {
      if (g.ui.typing) { g.ui.finishTyping(); return; }
      g.sound.phoneButton();
      const ch = node.choices && node.choices[R.sel];
      if (ch && ch.fn) {
        const next = ch.fn();
        R.node = next || null; R.sel = 0;
        if (!R.node) { const cb = R.onEnd; R.person = null; if (cb) cb(); }
      } else if (!n) { R.node = null; const cb = R.onEnd; if (cb) cb(); }
      if (this._answerNext) { const nx = this._answerNext; this._answerNext = null; if (nx.state === 'ringing') this.startCall(nx); return; }
    }
    if (R.node) this.showPhoneNode();
  }

  /** Calling out: a room, or June. */
  outboundMenu() {
    const due = this.wakeups.pending().filter((w) => w.at <= this.clock.min + 12);
    const choices = due.slice(0, 3).map((w) => reply(`Call ${w.room} -- wake-up, ${Clock.label(w.at)}`, () => { this.g.sound.dialTone(w.room); return wakeCall(this, w); }));
    choices.push(reply('Call a room...', () => this.roomPicker(0, (st) => this.callRoom(st))));
    choices.push(reply('Call June at home', () => callJune(this)));
    choices.push(reply('(Put the phone down.)', () => null));
    const who = { name: 'DIAL TONE' };
    this.mode = 'phone';
    this.call = null;
    this.g.sound.phonePickup();
    this.runner.start(who, say(who, due.length ? `(dial tone) The wake-up sheet says ${due.map((w) => `${w.room} at ${Clock.label(w.at)}`).join(', ')}.` : '(dial tone)', choices), () => { this.mode = null; this.g.ui.hidePhone(); this.g.sound.phoneHang(); });
    this.showPhoneNode();
  }
  roomPicker(page, fn, filter) {
    const list = this.rooms.all().filter((st) => st.guest && (!filter || filter(st)));
    const per = 4;
    const slice = list.slice(page * per, page * per + per);
    const ch = slice.map((st) => reply(`${st.no} -- ${st.guestName.split(' ').slice(-1)[0]}`, () => fn(st)));
    if (list.length > (page + 1) * per) ch.push(reply('More rooms...', () => this.roomPicker(page + 1, fn, filter)));
    else if (page > 0) ch.push(reply('Back to the start...', () => this.roomPicker(0, fn, filter)));
    return say({ name: 'ROOM' }, list.length ? 'Which room? (from the registration cards)' : 'Nobody is registered.', ch.length ? ch : [reply('(Hang up.)', () => null)]);
  }
  callRoom(st) {
    const p = this.npcs.list.find((x) => x.room === st.no && !x.followsLeader && x.stay);
    const w = this.wakeups.forRoom(st.no);
    if (w && w.at <= this.clock.min + 12) return wakeCall(this, w);
    const who = { name: `ROOM ${st.no}` };
    if (!p || !p.inRoom) return say(who, '(It rings. And rings.)', [reply('(Hang up.)', () => null)]);
    if (p.asleep) { p.mood -= 8; return say(who, '(a long time, then) ...Hello? What time is it? Is something wrong?', [reply('Sorry -- wrong room. Good night.', () => null)]); }
    return say(who, 'Hello?', [reply('Just checking everything\'s all right in the room.', () => { p.mood += 1; return say(who, 'Oh. Yeah. It\'s fine. Thanks.', [reply('Good night.', () => null)]); })]);
  }
  transferPicker(who, target, o) {
    return this.roomPicker(0, (st) => {
      if (target && st.guest === target.id) { this.completeTransfer(target); return null; }
      this.stats.misTransfers++;
      return say(who, '(You hear it ring in some other room, and a stranger answer it, confused. The caller hangs up.)', [reply('(Oh.)', () => null)]);
    });
  }
  completeTransfer(target) {
    this.g.sound.phoneButton();
    this.toast(`Put through to ${target.room}.`, 'good');
    if (target.rosterId === 'URN') this.memory.flag('URN', 'daughterThrough');
    target.mood += 4;
  }
  wakeDone(w, p) {
    this.wakeups.called(w, 'called');
    this.stats.wakesMade++;
    if (p) { p.wakeAt = Math.min(p.wakeAt || Infinity, this.clock.min + 3); p.woke = true; }
  }

  /* ============================================================
     OVERLAYS
     ============================================================ */
  openTerminal() { this.standUp(); this.mode = 'terminal'; this.terminal.open(); this.g.ui.showTerminal(this.terminal.render()); }
  openBoard() { this.standUp(); this.mode = 'board'; this.board.open(); const b = this.board.render(); this.g.ui.showBoard(b.grid, b.info); }
  openPaper(html) { this.mode = 'paper'; this.g.sound.paper(); this.g.ui.showPaper(html); }
  openPicker(p) { this.mode = 'picker'; this.picker = p; this.g.ui.showPaper(p.render()); }
  closeOverlay() {
    const ui = this.g.ui;
    if (this.mode === 'terminal') ui.hideTerminal();
    if (this.mode === 'board') ui.hideBoard();
    if (this.mode === 'paper' || this.mode === 'picker') ui.hidePaper();
    this.mode = null; this.picker = null;
    this.g.sound.uiBack();
  }

  /* ============================================================
     THE DESK'S MACHINES
     ============================================================ */
  imprint() {
    const card = this.heldOf('card');
    if (!card) return;
    const f = this.ledger.folio(card.folio) || null;
    const amt = f ? this.ledger.balance(f) : 0;
    this.g.sound.imprint(0); setTimeout(() => this.g.quietly(() => this.g.sound.imprint(1)), 180);
    const slip = makeItem('slip', { card: card.card, owner: card.owner, amount: amt, folio: card.folio, signed: false });
    this.giveItem(slip, true);
    this.toast(`CHUNK-CHUNK. Slip for ${money(amt)}. Now they sign it.`, 'note');
  }
  registerPrompt() {
    const sale = this.pendingSale, pl = this.g.player;
    if (sale && !sale.rung && pl.cash.tendered > 0.004) return `Ring up ${money(sale.amount)} -- Rm ${sale.folio.room} (${sale.tc ? 'traveler\'s checks' : 'cash'} ${money(sale.tendered)})`;
    if (this.tasks.find((t) => t.kind === 'change') && !this.heldOf('coinBag')) return 'Make change: a roll of quarters';
    if (pl.cash.tendered > 0.004) return 'Put the loose cash in the drawer';
    return null;
  }
  useRegister() {
    const sale = this.pendingSale, pl = this.g.player, L = this.ledger, snd = this.g.sound;
    if (sale && !sale.rung && pl.cash.tendered > 0.004) {
      L.ringUp(sale.tendered);
      const change = round2(sale.tendered - sale.amount);
      if (change > 0) { L.takeFromDrawer(change); pl.changeInHand = round2(pl.changeInHand + change); }
      L.pay(sale.folio, sale.tc ? 'TC' : 'CASH', sale.amount, sale.tc ? (sale.tcSigned ? 'SIGNED' : 'UNSIGNED') : '', this.clock.min);
      pl.cash.tendered = round2(pl.cash.tendered - sale.tendered);
      sale.rung = true;
      snd.registerBeep(); snd.kaching(); snd.cashDrawer();
      this.toast(change > 0 ? `Rung up. Change: ${money(change)} -- in your hand.` : 'Rung up. Exact.', 'good');
      const p = sale.p;
      if (change <= 0.004 && p.ci && p.ci.stage === 'cash') p.ci.stage = 'key';
      this.pendingSale = null;
      return;
    }
    if (this.tasks.find((t) => t.kind === 'change')) {
      this.giveItem(makeItem('coinBag', { amount: 5 }));
      snd.cashDrawer();
      this.toast('A roll of quarters. Ten dollars in, ten out. The drawer does not care.', 'note');
      return;
    }
    if (pl.cash.tendered > 0.004) { L.ringUp(pl.cash.tendered); pl.cash.tendered = 0; snd.cashDrawer(); this.toast('In the drawer. It is not on anybody\'s folio.', 'note'); }
  }
  tearPrinter() {
    const t = this.printerTray.shift();
    if (!t) return;
    this.giveItem(makeItem(t.kind === 'receipt' ? 'receipt' : 'receipt', { room: t.room, label: t.label }));
    this.g.sound.paper();
  }
  emptyKeyDrop() {
    if (!this.keyDrop.length) return;
    for (const k of this.keyDrop) this.giveItem(makeItem('key', { room: k.room, from: k.who }), true);
    this.toast(`${this.keyDrop.length} key${this.keyDrop.length > 1 ? 's' : ''}: ${this.keyDrop.map((k) => k.room).join(', ')}. Check them out (F2) and hang them up.`, 'note');
    this.keyDrop = [];
    this.g.sound.keys(0);
  }
  fixSign() {
    if (this.memory.d.signFixed) return;
    const t = this.tasks.find((x) => x.kind === 'sign');
    if (!t) { this.toast('Mr. Wexler would have opinions.', 'note'); return; }
    this.memory.d.signFixed = true;
    this.flags.signFixed = true;
    const T = this.g.T;
    // the texture on the desk front is the one the mesh holds; paint the fix into it
    const src = T.noPetsFixed.px;
    T.noPets.px.set(src);
    this.g.sound.pen();
    this.tasks.complete(t);
    this.memory.opinion('WEXLER', 2);
    this.log('Fixed the NO PET\'S sign.', 'good');
  }

  /* ============================================================
     THE PROPERTY
     ============================================================ */
  toggleMop(drop) {
    const m = this.heldOf('mop');
    if (m) { this.removeHeld(m); this.mopOut = false; this.g.sound.drop(); return; }
    if (drop) return;
    const it = makeItem('mop');
    if (this.giveItem(it)) this.mopOut = true;
  }
  mopSpill(sp) {
    if (!this.heldOf('mop')) return;
    this.breakfast.mop(sp);
    this.toast('Mopped.', 'good');
  }
  useNewsRack() {
    const b = this.heldOf('newsBundle');
    if (b) {
      this.removeHeld(b);
      this.property.news.state = 'stacked';
      this.g.sound.snip();
      this.toast('Cut the string. Twenty-four Ledgers, stacked.', 'good');
      const t = this.tasks.find((x) => x.kind === 'papers'); if (t) this.tasks.complete(t);
      return;
    }
    if (this.property.news.state === 'stacked') this.openPaper(newsHtml(this));
  }
  pickUpNews() {
    const it = makeItem('newsBundle');
    if (!this.giveItem(it)) return;
    this.property.news.state = 'carried';
  }
  pullTrash(which) {
    if (this.property.trash[which] < (which === 'lobby' ? 0.6 : 0.45)) return;
    const it = makeItem('trash');
    if (!this.giveItem(it)) return;
    this.property.trash[which] = 0.05;
    this.g.sound.trashBag(0);
  }
  tossTrash() {
    const t = this.heldOf('trash');
    if (!t) return;
    this.removeHeld(t);
    this.g.sound.thump(0, 0.6);
    this.stats.trash = (this.stats.trash || 0) + 1;
  }
  clearIce() {
    if (!this.property.ice.jammed) return;
    this.property.resetIce();
    const t = this.tasks.find((x) => x.kind === 'ice'); if (t) this.tasks.complete(t);
    this.toast('Cleared a block of ice the size of a shoebox out of the chute.', 'good');
  }
  sodaPrompt() {
    const P = this.property.soda;
    if (P.eats) return 'Whack the drink machine where it sticks';
    if (this.heldOf('sodaCase')) return 'Restock the drink machine';
    if (P.coins > 3) return `Pull the coin box (${money(P.coins)})`;
    return 'Drink machine';
  }
  useSoda() {
    const P = this.property.soda;
    if (P.eats) { P.eats = false; this.g.sound.thump(0, 0.8); this.toast('Something inside it drops into place. It will behave for a while.', 'good'); const t = this.tasks.find((x) => x.kind === 'vend'); if (t) this.tasks.complete(t); return; }
    const c = this.heldOf('sodaCase');
    if (c) { this.removeHeld(c); this.property.refillSoda(); this.g.sound.vendDrop(0, 0.5); this.toast('Restocked.', 'good'); return; }
    if (P.coins > 3) { const amt = this.property.collectCoins(); this.ledger.vendingBag = round2(this.ledger.vendingBag + amt); this.g.sound.coins(0, 1); this.toast(`${money(amt)} in quarters. It goes in the vending bag, not the drawer.`, 'note'); }
  }
  takeSodaCase() {
    if (!this.memory.inv('sodaCases')) return;
    const it = makeItem('sodaCase');
    if (this.giveItem(it)) this.memory.use('sodaCases');
  }
  gatePrompt(id) {
    const g = this.property.gate;
    if (!this.clock.past(22, 0)) return 'Pool gate';
    return g.locked ? 'Pool gate (locked)' : 'Lock the pool gate';
  }
  useGate(id) {
    if (!this.clock.past(22, 0)) { this.g.doors.open(id, 2); return; }
    const gt = this.property.gate;
    gt.lockedIds = gt.lockedIds || {};
    gt.lockedIds[id] = true;
    this.g.doors.close(id);
    const d = this.g.doors.get(id); if (d) { d.auto = false; d.locked = true; }
    this.g.sound.lockClick(true);
    if (GATES.every((g) => gt.lockedIds[g.id])) {
      gt.locked = true;
      const t = this.tasks.find((x) => x.kind === 'gate'); if (t) this.tasks.complete(t);
    } else this.toast('One gate locked. There\'s another on the far side.', 'note');
  }
  resetBreaker() {
    const t = this.tasks.find((x) => x.kind === 'breaker');
    if (!t) return;
    const st = this.rooms.get(t.room);
    st.powerOut = false; st.lightsOn = true;
    this.g.sound.breakerClack();
    this.tasks.complete(t);
    this.flags.breakerReset = true;
    this.toast(`${t.room}: the breaker labeled ${t.room} -- ICE MACH? -- clacks back on.`, 'good');
  }

  /* ---------------- the breakfast counter ---------------- */
  stationPrompt(id) {
    const B = this.breakfast;
    if (id === 'coffee' || id === 'decaf') {
      const pot = B.coffee[id];
      const pack = this.heldAll(id);
      if (pot.brewing) return `${id === 'coffee' ? 'Coffee' : 'Decaf'} is brewing`;
      if (pack.length) return `Brew a pot of ${id === 'coffee' ? 'coffee' : 'decaf'}${pack.length >= 2 ? ' (both packs: strong)' : ''}`;
      if (pot.level <= 0.02) return `${id === 'coffee' ? 'Coffee' : 'Decaf'} pot: empty (coffee packs are in the pantry)`;
      const brewed = pot.brewedAt !== null ? `brewed ${Clock.label(pot.brewedAt)}` : '';
      const lvl = pot.level > 0.7 ? 'nearly full' : pot.level > 0.35 ? 'about half' : 'low';
      if (pot.level < 0.4) return `${id === 'coffee' ? 'Coffee' : 'Decaf'}: ${lvl}, ${brewed} -- top it off with hot water?`;
      return `${id === 'coffee' ? 'Coffee' : 'Decaf'}: ${lvl}, ${brewed}. Dump it?`;
    }
    if (id === 'water') return 'Hot water';
    if (id === 'juice') return this.heldOf('oj') ? 'Mix a pitcher of juice' : `Juice: ${B.juice.level > 0.5 ? 'full enough' : B.juice.level > 0.05 ? 'low' : 'empty (concentrate is in the fridge)'}`;
    if (id === 'waffle') {
      const W = B.waffle;
      if (this.heldOf('waffleMix')) return 'Mix the waffle batter';
      if (W.state === 'smoking' || W.state === 'stuck') return W.state === 'smoking' ? 'Scrape the iron and spray it (it\'s smoking)' : 'Pry the stuck waffle out and spray the iron';
      if (!W.on) return W.batter > 0.02 ? 'Turn the waffle iron on' : 'Waffle iron (no batter -- mix is in the pantry)';
      return `Waffle iron: on, batter ${W.batter > 0.5 ? 'plenty' : W.batter > 0.02 ? 'getting low' : 'empty'}. Turn it off?`;
    }
    const stockKind = { cereal: 'cereal', pastry: 'muffins', bagels: 'bagels', fruit: 'fruit' }[id];
    const n = B.trays[id];
    if (this.heldOf(stockKind)) return `Fill the ${STATION_BY_ID[id].label.toLowerCase()} (${n} out now)`;
    return `${STATION_BY_ID[id].label}: ${n <= 0 ? 'empty' : n < 4 ? 'a few left' : 'plenty'}`;
  }
  stationHold(id) {
    const W = this.breakfast.waffle;
    if (id === 'waffle' && (W.state === 'smoking' || W.state === 'stuck')) return 1.4;
    if ((id === 'coffee' || id === 'decaf') && this.heldAll(id).length) return 0.6;
    return 0;
  }
  useStation(id) {
    const B = this.breakfast, snd = this.g.sound, s = this;
    if (id === 'coffee' || id === 'decaf') {
      const pot = B.coffee[id];
      if (pot.brewing) return;
      const packs = this.heldAll(id);
      if (packs.length) {
        const n = Math.min(2, packs.length);
        for (let i = 0; i < n; i++) this.removeHeld(packs[i]);
        B.brew(id, n);
        pot.level = 0;
        snd.pour(0, 0.6);
        this.toast(`${id === 'coffee' ? 'Coffee' : 'Decaf'} brewing. Six minutes.`, 'good');
        const t = this.tasks.find((x) => x.kind === 'coffee'); if (t && id === 'coffee') this.tasks.complete(t);
        return;
      }
      if (pot.level <= 0.02) return;
      if (pot.level < 0.4) { B.stretch(id); snd.pour(0, 0.5); this.toast('Topped it off with hot water. It looks like coffee.', 'note'); return; }
      pot.level = 0; pot.brewedAt = null; snd.pour(0, 0.8); this.toast('Poured it down the sink.', 'note');
      return;
    }
    if (id === 'juice') {
      const oj = this.heldOf('oj');
      if (!oj) return;
      this.removeHeld(oj); B.juice.level = 1; snd.pour(0, 0.8); snd.whisk();
      return;
    }
    if (id === 'waffle') {
      const W = B.waffle, mix = this.heldOf('waffleMix');
      if (mix) { this.removeHeld(mix); W.batter = 1; snd.whisk(); this.toast('Batter mixed. The jug says "do not overfill." Everybody overfills.', 'note'); return; }
      if (W.state !== 'ok') { B.cleanWaffle(); this.toast('Scraped and sprayed. Good as it gets.', 'good'); return; }
      if (W.batter <= 0.02 && !W.on) return;
      W.on = !W.on;
      snd.switchClick();
      if (W.on) setTimeout(() => s.g.quietly(() => snd.waffleBeep(s.panOf(-7.6, STATION_BY_ID.waffle.z), 0.8)), 900);
      return;
    }
    const stockKind = { cereal: 'cereal', pastry: 'muffins', bagels: 'bagels', fruit: 'fruit' }[id];
    const it = this.heldOf(stockKind);
    if (!it) return;
    this.removeHeld(it);
    const add = { cereal: 6, pastry: 8, bagels: 6, fruit: 6 }[id];
    B.trays[id] += add;
    snd.cloth();
  }

  /* ---------------- doors ---------------- */
  doorPrompt(d) {
    const pl = this.g.player;
    if (d.kind !== 'room' || !d.room) return d.target ? 'Close the door' : 'Open the door';
    const r = ROOM_BY_NO[d.room];
    const inside = this.g.playerRoom === r;
    if (inside) return d.target ? 'Close the door' : 'Open the door';
    if (d.target) return null;
    const occ = this.occupant(d.room);
    const task = this.tasks.forRoom(d.room);
    if (occ) return `Knock on ${d.room}${task ? ` -- ${task.text.split(' --')[0].toLowerCase()}` : ''}`;
    if (task && task.kind === 'message') return `Slide the message under ${d.room}'s door`;
    void pl;
    return `Open ${d.room} with the master key`;
  }
  occupant(no) {
    return this.npcs.list.find((p) => p.room === no && p.inRoom && !p.followsLeader && !p.gone) || null;
  }
  useDoor(d) {
    const doors = this.g.doors;
    if (d.kind !== 'room' || !d.room || this.g.playerRoom === ROOM_BY_NO[d.room]) {
      if (d.target) { d.stay = false; doors.close(d); this.g.sound.doorClose(0, 0.7); }
      else { d.stay = true; doors.open(d, 99); this.g.sound.doorOpen(0, 0.7); }
      return;
    }
    const occ = this.occupant(d.room);
    const task = this.tasks.forRoom(d.room);
    if (occ) {
      this.g.sound.knock(3, 0, 1);
      setTimeout(() => this.g.quietly(() => this.answerDoor(d, occ, task)), 900);
      return;
    }
    if (task && task.kind === 'message') { this.tasks.complete(task); this.g.sound.paper(); return; }
    this.g.sound.lockClick(false);
    doors.open(d, 6);
    this.g.sound.doorOpen(0, 0.8);
  }
  answerDoor(d, p, task) {
    if (this.mode) return;
    if (p.asleep && !task) { p.mood -= 6; this.barks.line(p, '(from inside, muffled) ...Who is it? It\'s one in the morning.', { range: 6 }); return; }
    const r = ROOM_BY_NO[d.room];
    p._doorFrom = { x: p.x, z: p.z, yaw: p.yaw, sit: p.sit };
    p.x = r.inside.x; p.z = r.inside.z; p.yaw = r.faceOut; p.sit = false;
    this.g.doors.open(d, 99);
    p.atDoor = task || true;
    this.talkTo(p);
  }
  closeDoorVisit(p) {
    const d = this.g.doors.room(p.room);
    const letIn = p.letIn;
    p.atDoor = null;
    if (letIn) return;           // they're holding it open for you
    if (p._doorFrom) { p.x = p._doorFrom.x; p.z = p._doorFrom.z; p.yaw = p._doorFrom.yaw; p.sit = p._doorFrom.sit; p._doorFrom = null; }
    if (d) { d.hold = 0.5; d.stay = false; }
  }
  letIn(p, task) {
    p.letIn = true;
    const d = this.g.doors.room(p.room);
    if (d) { d.stay = true; this.g.doors.open(d, 99); }
    task.letIn = true;
  }
  quietDown(p) { p.noisy = false; const st = this.rooms.get(p.room); if (st) st.tvOn = false; }

  /* ---------------- in a room ---------------- */
  fixtureTask(no, fix) { return this.tasks.find((t) => t.room === no && t.kind === 'fix' && t.fix === fix); }
  fixtureOf(fid) { return { tv: 'tv', ac: 'ac', toilet: 'toilet', vanity: 'faucet', nightstand: 'lamp', nightstand2: 'lamp' }[fid] || null; }
  fixturePrompt(no, fid) {
    const fix = this.fixtureOf(fid);
    if (!fix) return null;
    const t = this.fixtureTask(no, fix);
    const st = this.rooms.get(no);
    if (!t && !st.issues.has(fix)) return fid === 'tv' ? 'Television' : null;
    if (fix === 'toilet' && !this.heldOf('plunger')) return 'The toilet. You need the plunger (supply cabinet).';
    if (fix === 'lamp' && !this.heldOf('bulb')) return 'The lamp. You need a bulb (supply cabinet).';
    return { tv: 'Check the cable and give it the smack', ac: 'Try to make the air unit stop rattling', toilet: 'Plunge it and jiggle the handle', faucet: 'Tighten the faucet', lamp: 'Change the bulb' }[fix];
  }
  fixtureHold(no, fid) {
    const fix = this.fixtureOf(fid);
    if (!fix) return 0;
    const t = this.fixtureTask(no, fix);
    return t || this.rooms.get(no).issues.has(fix) ? 1.5 : 0;
  }
  useFixture(no, fid) {
    const fix = this.fixtureOf(fid);
    const st = this.rooms.get(no);
    const t = this.fixtureTask(no, fix);
    if (!t && !st.issues.has(fix)) return;
    const snd = this.g.sound;
    if (fix === 'toilet') { if (!this.heldOf('plunger')) return; snd.plunge(0); setTimeout(() => this.g.quietly(() => snd.flush(0, 1)), 400); }
    if (fix === 'lamp') { const b = this.heldOf('bulb'); if (!b) return; this.removeHeld(b); snd.switchClick(); }
    if (fix === 'tv') { snd.tvSmack(0); setTimeout(() => this.g.quietly(() => snd.tvOn(0)), 500); st.tvOn = true; }
    if (fix === 'faucet') snd.squeak(0);
    if (fix === 'ac') {
      snd.thump(0, 0.8);
      if (no === '104') { this.toast('You kick the front panel. It rattles in a slightly different key.', 'note'); if (t) this.tasks.complete(t); return; }
    }
    st.issues.delete(fix);
    if (t) this.tasks.complete(t);
    const p = this.occupant(no);
    if (p && t) { p.mood += 5; this.barks.line(p, this.rng.pick(['Oh, there it goes. Thank you.', 'You\'re a genius.', 'That\'s it? Huh. Thanks.']), { range: 8 }); }
    if (p) { p.letIn = false; if (p._doorFrom) { p.x = p._doorFrom.x; p.z = p._doorFrom.z; p.yaw = p._doorFrom.yaw; p.sit = p._doorFrom.sit; p._doorFrom = null; } }
    const d = this.g.doors.room(no); if (d) d.stay = false;
  }

  /* ============================================================
     HOOKS THE SYSTEMS CALL
     ============================================================ */
  panOf(x, z) { return this.g.sound.at(x, z, 30).pan; }
  near(x, z, maxDist = 14) { return this.g.sound.at(x, z, maxDist, this.indoor ? 0.6 : 1).gain; }
  footstep(p) {
    const pl = this.g.player;
    if (Math.abs(p.x - pl.x) > 12 || Math.abs(p.z - pl.z) > 12 || p.culled) return;
    const { gain, pan } = this.g.sound.at(p.x, p.z, 12, (p.lv || 0) === (pl.lv || 0) ? 1 : 0.5);
    if (gain < 0.02) return;
    const zone = this.g.zoneOf(p);
    this.g.sound.footstep(pan, false, zone === 'outside' ? 'concrete' : zone === 'lobby' || zone === 'desk' || zone === 'breakfast' ? 'tile' : 'carpet', gain * 0.7);
  }
  playerStep(run) {
    const z = this.g.playerZone;
    this.g.sound.footstep(0, run, z === 'outside' || z === 'alcove' || z === 'maint' ? 'concrete' : z === 'lobby' || z === 'desk' || z === 'breakfast' || z === 'pantry' || z === 'laundry' ? 'tile' : 'carpet');
  }
  carDoor(car) { const { gain, pan } = this.g.sound.at(car.x, car.z, 24, this.indoor ? 0.4 : 1); if (gain > 0.01) this.g.sound.carDoor(pan, gain); }
  engineStart(car) { const { gain, pan } = this.g.sound.at(car.x, car.z, 30, this.indoor ? 0.4 : 1); if (gain > 0.01) this.g.sound.engineIdle(pan, gain, 2.5); }
  honk(car) { const { gain, pan } = this.g.sound.at(car.x, car.z, 30, this.indoor ? 0.5 : 1); this.g.sound.tone({ freq: 392, type: 'square', gain: 0.05 * gain, a: 0.01, d: 0.3, pan, filter: 'lowpass', cutoff: 1400 }); }
  wrongKey(p) {
    p.complaint = { kind: 'wrongKey', had: p.keyFor };
    this.barks.line(p, '(tries the key, then tries it again) ...Huh.', { range: 10 });
    p.queue.unshift(walkTo(SPOTS.lobbyIn.x, SPOTS.lobbyIn.z, 0), toDesk('complaint'), enterRoom());
  }
  enteredRoom(p) {
    const st = this.rooms.get(p.room);
    if (st) { st.occupied = true; st.awake = true; st.lightsOn = !st.powerOut; }
    if (p.bedMismatch && !p.flags.bedComplained) {
      p.flags.bedComplained = true;
      this.director.after(8 + this.rng() * 8, () => this.guestComesDown(p, { kind: 'beds' }), 'beds');
    }
    if (p.smokeMismatch && !p.flags.smellComplained) {
      p.flags.smellComplained = true;
      this.director.after(6 + this.rng() * 6, () => this.guestComesDown(p, { kind: 'smell' }), 'smell');
    }
    if (st && st.def.traits.includes('noisyAC') && p.stay && (p.stay.wants || []).includes('quiet') && !p.flags.acComplained) {
      p.flags.acComplained = true;
      this.director.after(15 + this.rng() * 10, () => this.guestComesDown(p, { kind: 'noiseAc' }), 'ac104');
    }
  }
  withGuest(p) { return this.speaking === p; }
  iceBroken(p) {
    this.barks.say(p, 'iceBroke', { force: true });
    if (!this.tasks.find((t) => t.kind === 'ice') && !p.flags.iceComplained) { p.flags.iceComplained = true; this.guestComesDown(p, { kind: 'ice' }); }
  }
  vendAte(p) {
    this.barks.say(p, 'vendAte', { force: true });
    if (!p.flags.refunded) { p.flags.refunded = true; this.guestComesDown(p, { kind: 'refund' }); }
  }
  porchChair() {}
  greet(p) { this.barks.say(p, 'greet', { cool: 60 }); }
  bell() {
    const b = DESK_PROPS.bell;
    const { gain, pan } = this.g.sound.at(b.x, b.z, 70, this.indoor ? 1 : 0.7);
    this.g.sound.deskBell(pan, Math.max(0.08, Math.sqrt(gain)));
  }
  bark(p, key) { this.barks.say(p, key); }
  gateReminder() { this.tasks.add({ kind: 'gate', text: 'Lock both pool gates (it\'s ten o\'clock)' }); }
  wakeMissed(w) {
    const p = this.npcs.find(w.who);
    this.log(`Missed the ${Clock.label(w.at)} wake-up for ${w.room}.`, 'bad');
    if (!p) return;
    p.wakeAt = w.at + 35 + this.rng() * 15;
    p.flags.overslept = true;
    this.director.at(p.wakeAt + 4, () => this.guestComesDown(p, { kind: 'lateWake', at: w.at }), 'late wake');
  }
  breakfastShort(p, id) { this.barks.say(p, 'short', { sub: id, force: true }); }
  reactToCoffee(p, q, id) {
    const key = q.age === 'burnt' ? 'coffeeBurnt' : q.age === 'old' ? 'coffeeOld' : q.strength === 'weak' ? 'coffeeWeak' : 'coffeeStrong';
    this.barks.say(p, key, { force: true });
    if (p.rosterId === 'EARL') this.memory.flag('EARL', 'badCoffee');
  }
  waffleOff(p) { this.barks.say(p, 'waffleOff', { force: true }); }
  waffleTrouble(p, state) { this.barks.say(p, state === 'stuck' ? 'waffleStuck' : 'waffleSmoke', { force: true }); }
  waffleSmokes(p) {
    this.stats.waffleIncidents++;
    const others = this.breakfast.diners().filter((x) => x !== p);
    this.barks.say(others[0] || p, 'waffleSmoke', { force: true });
    this.log(`The waffle iron smoked (${p.name.split(' ')[0]}).`, 'note');
  }
  waffleSticks(p) { this.stats.waffleIncidents++; this.barks.say(p, 'waffleStuck', { force: true }); }
  waffleMess(p) { this.barks.say(p, 'spill', { force: true }); }
  channelRequest(p) { this.barks.say(p, 'channel', { sub: p.wantsChannel, force: true }); }
  channelChanged(ch) {
    for (const p of this.breakfast.diners()) if (p.wantsChannel === ch) { this.barks.say(p, 'channelThanks', { force: true }); p.mood += 3; }
  }
  breakfastOpens() {
    const B = this.breakfast;
    const ready = B.coffee.coffee.level > 0.5 || B.coffee.coffee.brewing;
    const trays = Object.values(B.trays).filter((n) => n > 0).length;
    this.flags.coffeeOnTime = ready;
    this.flags.breakfastReady = ready && trays >= 3 && B.juice.level > 0.3;
    this.toast(this.flags.breakfastReady ? 'Six o\'clock. Breakfast is out.' : 'Six o\'clock. Breakfast is supposed to be out.', this.flags.breakfastReady ? 'good' : 'bad');
  }
  luzBriefed(dirty, notFlipped) {
    this.flags.luzBriefed = true;
    if (!notFlipped) this.log(`Luz took ${dirty.length} dirty rooms off the board.`, 'plain');
  }

  /* ============================================================
     WHO IS DRAWN
     ============================================================ */
  cull() {
    const g = this.g;
    for (const p of this.npcs.list) {
      p.culled = false;
      if (p.hidden) continue;
      const z = zoneAt(p.x, p.z, p.lv || 0);
      if (!z.startsWith('room:')) continue;
      const no = z.slice(5);
      if (g.playerRoom && g.playerRoom.no === no) continue;
      const d = g.doors.room(no);
      if (d && d.swing > 0.05) continue;
      p.culled = true;
    }
  }
  people() { return this.npcs.list.filter((p) => !p.hidden && !p.culled); }
  focus() { return this.mode; }
  get heldFocus() { return !!this.mode; }

  collectDraws() {
    const g = this.g, draws = g.draws, M = g.world.dyn.items;
    this.cars.draw(draws, this.clock.dawn());
    this.property.draw(draws, M);
    this.breakfast.draw(draws);
    if (!this.mopOut && M.mop) draws.push({ mesh: M.mop, x: MOP_HOME.x, y: 0, z: MOP_HOME.z, yaw: 0.6, r: 0.8 });
    for (const f of this.floorItems) {
      const mesh = M[f.item.mesh] || M.box;
      draws.push({ mesh, x: f.x, y: (f.y || 0) + 0.02, z: f.z, yaw: f.item.id * 1.7, r: 0.5, lv: f.lv });
    }
    for (const t of this.printerTray.slice(0, 1)) {
      const P = DESK_PROPS.printer;
      if (M.receipt) draws.push({ mesh: M.receipt, x: (P.x0 + P.x1) / 2, y: P.y1, z: P.z0 + 0.06, yaw: 0, r: 0.3 });
      void t;
    }
  }

  /* ============================================================
     THE HUD
     ============================================================ */
  hud(dt) {
    const g = this.g, ui = g.ui, pl = g.player;
    ui.setClock(this.clock.label(), this.clock.dayLabel(), this.clock.fast > 1);
    // hands
    const bits = pl.held.map((h) => `<span class="item">${esc(itemLabel(h))}</span>`);
    if (pl.cash.tendered > 0.004) bits.push(`<span class="warn">CASH ${money(pl.cash.tendered)} (ring it up)</span>`);
    if (pl.changeInHand > 0.004) bits.push(`<span class="warn">CHANGE ${money(pl.changeInHand)} (owed back)</span>`);
    ui.setHands(bits.join('<br>'));
    // what is waiting on you
    const w = [];
    for (const c of this.phone.ringing()) w.push(`<span class="ring">☎ LINE ${c.line}</span>`);
    for (const c of this.phone.onHold()) w.push(`<span class="dim">☎ LINE ${c.line} HOLD</span>`);
    const dq = this.desk.waiting().length;
    if (dq) w.push(`<span class="bell">🛎 DESK ${dq > 1 ? `×${dq}` : ''}</span>`);
    const due = this.wakeups.due(this.clock.min);
    if (due.length) w.push(`<span class="due">WAKE-UP ${due.map((x) => x.room).join(' ')}</span>`);
    if (this.clock.fast > 1) w.push('<span class="dim">(on the stool)</span>');
    ui.setWaiting(w.join(' &nbsp; '));
    // what you should probably do next
    this.objT -= dt;
    if (this.objT <= 0) { this.objT = 0.3; const [o, pulse] = this.objective(); ui.setObjective(o, pulse); }
  }

  objective() {
    const s = this, c = this.clock;
    if (this.mode === 'paper' && !this.clockedIn) return ['', false];
    if (this.phone.anyRinging()) return ['The phone is ringing.', true];
    const front = this.desk.front();
    if (front && front.deskReason === 'checkin' && front.ci) {
      const ci = front.ci, n = front.name.split(' ').slice(-1)[0];
      if (ci.stage === 'system') return [`Put ${n} in the system: terminal, F1 CHECK-IN.`, false];
      if (ci.stage === 'cash' && this.pendingSale && !this.pendingSale.rung) return [`Ring up ${n}'s cash at the register.`, false];
      if (ci.stage === 'cash' && this.g.player.changeInHand > 0.004) return [`Give ${n} the change.`, false];
      if (ci.stage === 'card' && !this.heldOf('slip')) return [`Run ${n}'s card through the imprinter.`, false];
      if (ci.stage === 'card') return [`Have ${n} sign the slip.`, false];
      if (ci.stage === 'voucher') return ['Check the voucher against the binder, then tell them.', false];
      if (ci.stage === 'key') {
        const rooms = front.groupRooms || [ci.room];
        const have = rooms.every((r) => s.heldOf('key', (k) => k.room === r));
        return [have ? `Hand ${n} the key${rooms.length > 1 ? 's' : ''}.` : `Get key${rooms.length > 1 ? 's' : ''} ${rooms.join(', ')} off the rack.`, false];
      }
      if (ci.stage === 'pay') return [`Tell ${n} the total.`, false];
    }
    if (front) return [`${front.name.split(' ')[0]} is at the desk.`, true];
    const due = this.wakeups.due(c.min);
    if (due.length) return [`Wake-up call due: ${due[0].room} at ${Clock.label(due[0].at)}. Call from the desk phone.`, true];
    if (this.printerTray.length && this.printerTray[0].kind === 'receipt' && this.desk.line.some((p) => p.deskReason === 'checkout')) return ['Tear the receipt off the printer.', false];
    if (c.past(3, 0) && !c.past(4, 30) && !(this.terminal.audit && this.terminal.audit.done)) return ['Run the night audit: terminal, F5.', false];
    if (this.keyDrop.length && c.past(5, 0)) return [`Keys in the drop box (${this.keyDrop.length}). Check them out and hang them up.`, false];
    if (c.past(4, 30) && !c.past(6, 0)) {
      const B = this.breakfast;
      if (!B.coffee.coffee.brewing && B.coffee.coffee.level < 0.3 && c.past(5, 0)) return ['Make coffee (packs are on the pantry shelf).', false];
      if (this.property.news.state === 'bundle') return ['The papers are out front. Bring them in and stack them.', false];
      if (Object.values(B.trays).some((n) => n <= 0)) return ['Stock the breakfast counter from the pantry.', false];
      if (B.juice.level < 0.2) return ['Mix the juice (concentrate, pantry fridge).', false];
      if (B.waffle.batter < 0.05) return ['Mix the waffle batter.', false];
      if (!B.waffle.on) return ['Turn the waffle iron on.', false];
      if (B.tv.channel === 'OFF') return ['Turn on the breakfast TV.', false];
    }
    if (c.past(6, 45)) {
      const t = this.npcs.find('TRAVIS');
      if (t && !t.hidden) return ['Travis is here. Hand over the desk.', true];
      const luz = this.npcs.find('LUZ');
      if (luz && !luz.flags.briefed && !luz.hidden) return ['Luz wants to know which rooms are dirty.', false];
    }
    const t = this.tasks.open()[0];
    if (t) return [`Notepad: ${t.text}`, false];
    return [c.period().label, false];
  }

  toast(text, kind) { this.g.ui.toast(text, kind); }
  log(text, kind = 'plain') { this.notesLog.push({ text, kind, at: this.clock.min }); }

  /* ============================================================
     THE END OF THE SHIFT
     ============================================================ */
  auditDone(A) {
    this.log('Ran the night audit.', 'good');
    this.printerTray.push({ kind: 'report', label: 'the audit packet for June' });
  }

  report() {
    const st = this.stats, B = this.breakfast;
    const tasksLeft = this.tasks.open().filter((t) => t.kind !== 'gate' || !this.property.gate.locked).length;
    const earl = this.npcs.find('EARL');
    const earlGuest = this.memory.d.guests.EARL;
    const missedNames = this.wakeups.list.filter((w) => w.status === 'missed').map((w) => { const p = this.npcs.find(w.who); return p ? p.name.split(' ')[0] : null; }).filter(Boolean);
    const short = Object.entries(B.shortages).sort((a, b) => b[1] - a[1])[0];
    const r = {
      shiftNo: this.memory.shiftNo, dateLabel: `${this.clock.dayLabel()} (shift ${this.memory.shiftNo})`,
      checkins: st.checkins, walkIns: st.walkIns, checkouts: st.checkouts, occupied: st.occupied || this.rooms.all().filter((x) => x.sys === 'OC').length,
      calls: st.calls, missedCalls: st.missedCalls, wakesMade: st.wakesMade, missedWakes: st.wakeMissed, missedWakeNames: missedNames.join(' and '),
      tasksDone: st.tasksDone, tasksLeft, audited: st.audited, drawerDelta: st.drawerDelta, drawerOff: st.audited && Math.abs(st.drawerDelta) > 0.004 ? 1 : 0,
      pots: st.pots, cups: B.served.cups, plates: B.served.plates, waffles: B.served.waffles, spills: st.spills,
      privacy: st.privacy, privacyKept: st.privacyKept, expiredTaken: st.expiredTaken, caughtExpired: st.caughtExpired, wrongKeys: st.wrongKeys,
      rackOff: st.rackOff, earl105: earl && earl.room ? earl.room === '105' : undefined,
      earlCoffee: earlGuest && earlGuest.flags.coffeeLie ? 'lie' : null,
      homemadeCoupon: !!this.flags.homemadeCoupon, petAllowed: !!this.flags.petAllowed, signFixed: !!this.flags.signFixed,
      waffle: st.waffleIncidents ? (st.waffleIncidents === 1 ? 'one incident. The ceiling tile above it is a new color' : `${st.waffleIncidents} incidents. I have started calling it "the situation"`) : '',
      breakfastShort: short && short[1] >= 2 ? ({ pastry: 'muffins', bagels: 'bagels', cereal: 'cereal', fruit: 'fruit', juice: 'juice', coffee: 'coffee', decaf: 'decaf', waffle: 'waffle batter' }[short[0]]) : '',
      coffeeGood: !!this.flags.coffeeOnTime && !st.shortages, calledJune: st.calledJune,
      lostGuests: st.lostGuests, noVacancyMiss: false,
      notes: this.notesLog.filter((n) => n.kind !== 'plain').slice(-10),
    };
    return r;
  }

  endShift() {
    if (this.shiftOver) return;
    this.shiftOver = true;
    const g = this.g, mem = this.memory;
    const r = this.report();
    const note = juneNote(r);
    // what carries into tomorrow night
    const inHouse = [];
    for (const p of this.npcs.list) {
      if (p.gone || p.followsLeader || !p.room || !p.stay || p.kind === 'staff' || p.kind === 'resident') continue;
      if (p.rosterId === 'WEXLER' || p.rosterId === 'HOLLIS' || p.rosterId === 'ABERNATHY' || p.rosterId === 'DARNELL') continue;
      const left = (p.stay.nights || 1) - 1;
      if (left > 0 && p.rosterId && p.kind !== 'crew') inHouse.push({ id: p.rosterId, room: p.room, nightsLeft: left });
    }
    mem.d.inHouse = inHouse;
    mem.d.flags.crewIn = false;
    mem.d.lastShift = { report: { checkins: r.checkins, missedWakes: r.missedWakes, drawerDelta: r.drawerDelta }, note };
    mem.d.rooms = null;
    // the truck comes, some of what ran out gets replaced
    const inv = mem.d.inventory;
    for (const [k, v] of Object.entries({ coffee: 4, decaf: 2, muffins: 18, bagels: 12, cereal: 22, fruit: 12, oj: 3, milk: 2, waffleMix: 1 })) inv[k] = Math.max(inv[k] || 0, v);
    for (const [k, v] of Object.entries({ towels: 30, pillows: 14, blankets: 8, toiletries: 20, tp: 24, bulbs: 6, batteries: 8, sodaCases: 2 })) inv[k] = Math.max(inv[k] || 0, v);
    mem.advanceDay();
    mem.save();
    g.sound.shiftEnd();
    g.state = ST.END;
    g.dropLock();
    this.dispose();
    g.ui.setHudVisible(false);
    g.ui.showPanel(`${reportHtml(r)}<div style="margin-top:1.2cqw">${noteHtml(note, { date: 'Tonight, on the desk:' })}</div>
      <p class="pad-foot">${g.ui.keyHint('confirm')} clock out &nbsp;&middot;&nbsp; The motel has been saved. CONTINUE on the title starts tomorrow night.</p>`);
    g.fadeTo = 0.25;
  }

  updateEnd() {
    const g = this.g;
    if (g.confirmHit() || g.backHit()) { g.ui.hidePanel(); g.toTitle(); }
  }

  /* ============================================================
     GAME PLUMBING
     ============================================================ */
  voiceBlip(typed) {
    if (typed % 3 !== 0) return;
    const R = this.runner;
    const p = R.person;
    if (!p) return;
    const app = p.app || (p.person && p.person.app);
    const pitch = app ? (app.voice.pitch || 1) * (app.voicePitch || 1) : (p.pitch || 1);
    const rough = app ? app.voice.rough || 0 : (p.rough || 0.2);
    this.g.quietly(() => this.g.sound.blip(pitch, rough, this.mode === 'phone' ? 0.55 : 0.8, 0));
  }
  onSchemeChanged() {
    if (this.mode === 'terminal') this.g.ui.showTerminal(this.terminal.render());
    if (this.mode === 'board') { const b = this.board.render(); this.g.ui.showBoard(b.grid, b.info); }
  }
  onPause() { this.standUp(); }
  onResume() { this.g.wantLock = !this.mode; if (!this.mode) this.g.grabLock(); }
}

export { BARKS, choicesHtml, NEWS_DROP, BTV, round2, until, inRoom };
