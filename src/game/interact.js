/* ============================================================
   interact.js -- everything you can put your hands on.

   Final Rental's interaction was a ray from the eye and a short
   list of things it could hit: shelves, the counter, the doors, a
   customer. The motel's list is long, because the job is long: the
   terminal and the rack and the phone and the imprinter; the
   linen shelf and the pantry; every coffee pot and every tray on
   the breakfast counter; the ice machine, the drink machine, the
   dumpster, the pool gate; every room door on the property; and,
   inside a room, whatever in it you were called about.

   A target is a box (or a person's cylinder), a prompt that says
   what E would do right now (or null), and what it does. Some want
   the button held: imprinting a card, plunging a toilet, clearing
   the ice machine.
   ============================================================ */
import {
  DESK_PROPS, BOARD, LINEN, SUPPLY, MGR_DESK, PANTRY_SHELF, FRIDGE, STATIONS, BFAST_COUNTER, BTV, NEWS_RACK, BTRASH,
  ICE_MACHINE, VENDING, NEWS_DROP, DUMPSTER, ROOMS, toWorld, MAINT, GATES, DESK,
} from './world/layout.js';
import { roomFurniture } from './world/roombuild.js';
import { castInteract } from './player.js';
import { makeItem, itemLabel } from './sim/items.js';
import { money } from './dialogue/runner.js';
import { Clock } from './sim/clock.js';
import { Picker, binderHtml, regCardsHtml, newsHtml } from './ui/papers.js';
import { noteHtml, firstNote } from './content/notes.js';

export const MOP_HOME = { x: -7.45, z: -8.45 };
const box = (b) => ({ x0: b.x0, x1: b.x1, y0: b.y0 !== undefined ? b.y0 : 0, y1: b.y1 !== undefined ? b.y1 : (b.top || 1.2), z0: b.z0, z1: b.z1 });
const around = (x, z, r, y0 = 0, y1 = 1.2) => ({ x0: x - r, x1: x + r, y0, y1, z0: z - r, z1: z + r });

export class Interact {
  constructor(shift) {
    this.s = shift;
    this.targets = this.buildStatic();
    this.hot = null;
    this.holdT = 0;
    this.holding = null;
  }

  /* ============================================================
     THE STATIC LIST
     ============================================================ */
  buildStatic() {
    const s = this.s, T = [];
    const add = (t) => { T.push(t); return t; };
    const P = DESK_PROPS;

    /* ---------------- the desk ---------------- */
    add({ id: 'terminal', aabb: box(P.terminal), prompt: () => 'Use the terminal', use: () => s.openTerminal() });
    add({ id: 'board', aabb: { x0: BOARD.x0, x1: BOARD.x1, y0: BOARD.y0, y1: BOARD.y1, z0: BOARD.z - 0.15, z1: BOARD.z + 0.05 }, prompt: () => 'Key rack', use: () => s.openBoard() });
    add({ id: 'phone', aabb: box(P.phone), prompt: () => s.phonePrompt(), use: () => s.usePhone() });
    add({ id: 'printer', aabb: box(P.printer), prompt: () => (s.printerTray.length ? `Tear off: ${s.printerTray[0].label}` : null), use: () => s.tearPrinter() });
    add({ id: 'wakeup', aabb: { ...box(P.wakeup), y1: P.wakeup.y1 + 0.05 }, prompt: () => `Wake-up sheet${s.wakeups.due(s.clock.min + 2).length ? ' (one is due)' : ''}`, use: () => s.openPaper(s.wakeups.html()) });
    add({ id: 'cards', aabb: { ...box(P.cards), y1: P.cards.y1 + 0.08 }, prompt: () => 'Registration cards', use: () => s.openPaper(regCardsHtml(s)) });
    add({
      id: 'imprinter', aabb: { ...box(P.imprinter), y1: P.imprinter.y1 + 0.08 }, hold: 0.7,
      prompt: () => { const c = s.heldOf('card'); return c ? `Imprint the ${c.card.type} card` : null; },
      use: () => s.imprint(),
    });
    add({ id: 'register', aabb: box(P.register), prompt: () => s.registerPrompt(), use: () => s.useRegister() });
    add({ id: 'binder', aabb: { ...box(P.binder), y1: P.binder.y1 + 0.08 }, prompt: () => 'Front desk binder', use: () => s.openPaper(binderHtml(s)) });
    add({
      id: 'keydrop', aabb: { ...box(P.keydrop), z0: P.keydrop.z0 - 0.3 },
      prompt: () => (s.keyDrop.length ? `Empty the key drop (${s.keyDrop.length} key${s.keyDrop.length > 1 ? 's' : ''})` : 'Key drop (empty)'),
      use: () => s.emptyKeyDrop(),
    });
    add({ id: 'stool', aabb: around(P.stool.x, P.stool.z, 0.25, 0, 0.8), prompt: () => (s.g.player.sitting ? 'Get up' : 'Sit on the stool'), use: () => s.toggleStool() });
    add({
      id: 'sign', aabb: { x0: 3.15, x1: 3.85, y0: 0.4, y1: 0.72, z0: DESK.z1 - 0.02, z1: DESK.z1 + 0.12 }, hold: 1.2,
      prompt: () => (s.memory.d.signFixed ? null : s.tasks.find((t) => t.kind === 'sign') ? 'Fix the sign with a marker' : 'The sign says NO PET\'S'),
      use: () => s.fixSign(),
    });

    /* ---------------- the back office ---------------- */
    add({ id: 'linen', aabb: { ...box(LINEN), y1: LINEN.top, z1: LINEN.z1 + 0.05 }, prompt: () => 'Linen shelves', use: () => s.openPicker(this.linenPicker()) });
    add({ id: 'supply', aabb: { ...box(SUPPLY), y1: SUPPLY.top, z1: SUPPLY.z1 + 0.05 }, prompt: () => 'Supply cabinet', use: () => s.openPicker(this.supplyPicker()) });
    add({ id: 'mgrdesk', aabb: { x0: MGR_DESK.x0, x1: MGR_DESK.x1, y0: 0, y1: MGR_DESK.y + 0.1, z0: MGR_DESK.z0, z1: MGR_DESK.z1 }, prompt: () => 'June\'s desk: read her note', use: () => s.openPaper(noteHtml(s.juneLines, { date: 'on the back of a Sysco invoice', foot: '[ESC] put it down' })) });
    add({ id: 'breakerOffice', aabb: { x0: 2.0, x1: 2.4, y0: 0.55, y1: 1.45, z0: -7.2, z1: -7.0 }, prompt: () => 'Breaker panel (office)', use: () => s.toast('Office breakers. All on. Leave them that way.') });

    /* ---------------- the pantry ---------------- */
    add({ id: 'pantry', aabb: { ...box(PANTRY_SHELF), y1: PANTRY_SHELF.top, x1: PANTRY_SHELF.x1 + 0.05 }, prompt: () => 'Pantry shelves', use: () => s.openPicker(this.pantryPicker()) });
    add({ id: 'fridge', aabb: { ...box(FRIDGE), y1: FRIDGE.top, z1: FRIDGE.z1 + 0.05 }, prompt: () => 'Refrigerator', use: () => s.openPicker(this.fridgePicker()) });
    add({
      id: 'mop', aabb: around(MOP_HOME.x, MOP_HOME.z, 0.3, 0, 1.2),
      prompt: () => (s.heldOf('mop') ? 'Put the mop back' : s.mopOut ? null : 'Take the mop and bucket'),
      use: () => s.toggleMop(),
    });

    /* ---------------- the breakfast counter ---------------- */
    const X0 = BFAST_COUNTER.x0, X1 = BFAST_COUNTER.x1, Y = BFAST_COUNTER.y;
    for (const st of STATIONS) {
      add({
        id: 'st:' + st.id, station: st.id,
        aabb: { x0: X0, x1: X1 + 0.1, y0: Y - 0.1, y1: Y + 0.55, z0: st.z - 0.26, z1: st.z + 0.26 },
        prompt: () => s.stationPrompt(st.id),
        hold: () => s.stationHold(st.id),
        use: () => s.useStation(st.id),
      });
    }
    add({ id: 'btv', aabb: { x0: BTV.x - 0.45, x1: BTV.x + 0.45, y0: BTV.y - 0.35, y1: BTV.y + 0.35, z0: BTV.z - 0.3, z1: BTV.z + 0.3 }, reach: 3.2, prompt: () => `Change the channel (${s.breakfast.tv.channel === 'OFF' ? 'off' : s.breakfast.tv.channel.toLowerCase()})`, use: () => s.breakfast.nextChannel() });
    add({
      id: 'newsrack', aabb: { ...box(NEWS_RACK), y1: 0.75 }, hold: () => (s.heldOf('newsBundle') ? 1.4 : 0),
      prompt: () => (s.heldOf('newsBundle') ? 'Cut the string and stack the papers' : s.property.news.state === 'stacked' ? 'Read the Ledger' : 'Newspaper rack (empty)'),
      use: () => s.useNewsRack(),
    });
    add({ id: 'btrash', aabb: { ...box(BTRASH), y1: 0.8 }, prompt: () => (s.property.trash.breakfast > 0.45 ? 'Pull the trash bag' : 'Trash can (fine for now)'), use: () => s.pullTrash('breakfast') });
    add({ id: 'ltrash', aabb: around(7.6, -0.5, 0.25, 0, 0.8), prompt: () => (s.property.trash.lobby > 0.6 ? 'Pull the lobby trash bag' : null), use: () => s.pullTrash('lobby') });

    /* ---------------- outside ---------------- */
    add({ id: 'news', aabb: around(NEWS_DROP.x, NEWS_DROP.z, 0.4, -0.2, 0.4), prompt: () => (s.property.news.state === 'bundle' ? 'Pick up the newspaper bundle' : null), use: () => s.pickUpNews() });
    add({
      id: 'ice', aabb: { ...box(ICE_MACHINE), y1: ICE_MACHINE.top, z0: ICE_MACHINE.z0 - 0.05 }, hold: () => (s.property.ice.jammed ? 2.0 : 0),
      prompt: () => (s.property.ice.jammed ? 'Clear the jam (reach up into the chute)' : 'Ice machine (working)'),
      use: () => s.clearIce(),
    });
    const soda = VENDING[0];
    add({
      id: 'soda', aabb: { ...box(soda), y1: soda.top, z0: soda.z0 - 0.05 }, hold: () => (s.property.soda.eats ? 1.0 : 0),
      prompt: () => s.sodaPrompt(), use: () => s.useSoda(),
    });
    add({ id: 'snack', aabb: { ...box(VENDING[1]), y1: VENDING[1].top, z0: VENDING[1].z0 - 0.05 }, prompt: () => 'Snack machine. Somebody bought all the Funyuns.', use: () => {} });
    add({ id: 'dumpster', aabb: { ...box(DUMPSTER), y1: 1.4 }, prompt: () => (s.heldOf('trash') ? 'Toss the bag in the dumpster' : null), use: () => s.tossTrash() });
    for (const g of GATES) {
      const cx = g.hx + g.w / 2;
      add({ id: 'gate:' + g.id, aabb: { x0: g.hx, x1: g.hx + g.w, y0: 0, y1: 1.2, z0: g.hz - 0.2, z1: g.hz + 0.2 }, prompt: () => s.gatePrompt(g.id), use: () => s.useGate(g.id) });
      void cx;
    }

    /* ---------------- maintenance ---------------- */
    add({ id: 'breakers', aabb: { x0: MAINT.x1 - 0.25, x1: MAINT.x1 - 0.02, y0: 0.55, y1: 1.45, z0: 32.8, z1: 33.2 }, hold: () => (s.tasks.find((t) => t.kind === 'breaker') ? 1.0 : 0), prompt: () => (s.tasks.find((t) => t.kind === 'breaker') ? `Reset the breaker for ${s.tasks.find((t) => t.kind === 'breaker').room}` : 'Room breakers. Twenty-eight of them.'), use: () => s.resetBreaker() });
    add({ id: 'tools', aabb: { x0: 2.7, x1: 4.5, y0: 0.4, y1: 1.6, z0: MAINT.z1 - 0.3, z1: MAINT.z1 - 0.02 }, prompt: () => 'Tool wall', use: () => s.openPicker(this.toolPicker()) });
    add({ id: 'sodacases', aabb: { x0: MAINT.x0 + 0.1, x1: MAINT.x0 + 0.7, y0: 0, y1: 1.9, z0: MAINT.z0 + 1.0, z1: MAINT.z0 + 3.4 }, prompt: () => (s.memory.inv('sodaCases') ? 'Take a case of soda' : 'Shelves (no soda left)'), use: () => s.takeSodaCase() });

    return T;
  }

  /* ============================================================
     SHELVES
     ============================================================ */
  item(kind, label, stockKey, extra) {
    const s = this.s;
    return {
      label, stock: stockKey ? () => s.memory.inv(stockKey) : null,
      take: () => {
        if (stockKey && s.memory.inv(stockKey) <= 0) return 'There isn\'t any left.';
        const it = makeItem(kind, extra || {});
        if (!s.canHold(it)) return 'Your hands are full.';
        if (stockKey) s.memory.use(stockKey);
        s.giveItem(it);
        s.g.sound.pickup();
        return true;
      },
    };
  }
  linenPicker() {
    return new Picker(this.s, 'LINEN SHELVES', [
      this.item('towels', 'Towels (bath set)', 'towels'), this.item('pillow', 'Pillow', 'pillows'),
      this.item('blanket', 'Blanket', 'blankets'), this.item('toiletries', 'Soap & shampoo', 'toiletries'), this.item('tp', 'Toilet paper', 'tp'),
    ], 'Pillows are one to a hand. You have two hands and a chin.');
  }
  supplyPicker() {
    return new Picker(this.s, 'SUPPLY CABINET', [
      this.item('bulb', '60-watt bulb', 'bulbs'), this.item('batteries', 'AA batteries', 'batteries'),
      this.item('remote', 'Spare TV remote', null), this.item('iron', 'Iron (and the board, which is in the closet)', null),
      this.item('plunger', 'Plunger', null),
    ]);
  }
  toolPicker() {
    return new Picker(this.s, 'TOOL WALL', [this.item('plunger', 'Plunger', null), this.item('bulb', 'Bulb, 60W', 'bulbs')]);
  }
  pantryPicker() {
    return new Picker(this.s, 'PANTRY', [
      this.item('coffee', 'Coffee, one pot pack', 'coffee'), this.item('decaf', 'Decaf, one pot pack', 'decaf'),
      this.item('muffins', 'Muffins, a tray', 'muffins'), this.item('bagels', 'Bagels', 'bagels'),
      this.item('cereal', 'Cereal, six little boxes', 'cereal'), this.item('fruit', 'Bananas and apples', 'fruit'),
      this.item('waffleMix', 'Waffle mix', 'waffleMix'),
    ], 'Stock is what is on the shelf. The truck comes Tuesday.');
  }
  fridgePicker() {
    return new Picker(this.s, 'REFRIGERATOR', [this.item('oj', 'Orange juice concentrate', 'oj'), this.item('milk', 'Milk, gallon', 'milk')]);
  }

  /* ============================================================
     THE DYNAMIC PART: people, doors, spills, what is in a room
     ============================================================ */
  dynamicTargets() {
    const s = this.s, pl = s.g.player, out = [];
    // people
    for (const p of s.npcs.list) {
      if (p.hidden || p.culled) continue;
      if (Math.abs(p.x - pl.x) > 4 || Math.abs(p.z - pl.z) > 4) continue;
      const h = 1.75 * ((p.app.height && p.app.height.scale) || 1);
      const y = p.y || 0;
      out.push({ id: 'p:' + p.id, person: p, cyl: { x: p.x, z: p.z, r: 0.34, y0: y, y1: y + h }, reach: 2.6, prompt: () => s.personPrompt(p), use: () => s.talkTo(p) });
    }
    // doors near you
    for (const d of s.g.doors.list) {
      if (d.lv !== pl.lv || d.auto) continue;
      const cx = d.hx + Math.cos(d.a) * d.w / 2, cz = d.hz - Math.sin(d.a) * d.w / 2;
      if (Math.abs(cx - pl.x) > 3 || Math.abs(cz - pl.z) > 3) continue;
      const ext = 0.15;
      const ax = Math.abs(Math.cos(d.a)) * d.w / 2 + ext, az = Math.abs(Math.sin(d.a)) * d.w / 2 + ext;
      out.push({ id: 'd:' + d.id, door: d, aabb: { x0: cx - ax, x1: cx + ax, y0: d.y, y1: d.y + 2.1, z0: cz - az, z1: cz + az }, prompt: () => s.doorPrompt(d), use: () => s.useDoor(d) });
    }
    // spills on the floor
    for (const sp of s.breakfast.spills) {
      out.push({ id: 'sp:' + sp.id, spill: sp, aabb: around(sp.x, sp.z, 0.4, -0.05, 0.12), reach: 2.8, hold: () => (s.heldOf('mop') ? 1.2 : 0), prompt: () => (s.heldOf('mop') ? 'Mop it up' : `A ${sp.kind} spill. You need the mop (pantry).`), use: () => s.mopSpill(sp) });
    }
    // the room you are standing in
    const r = s.g.playerRoom;
    if (r) {
      for (const f of roomFurniture(r)) {
        if (!['tv', 'ac', 'toilet', 'vanity', 'nightstand', 'nightstand2', 'bed'].includes(f.id)) continue;
        const lx0 = r.doorHi ? 3.6 - f.x1 : f.x0, lx1 = r.doorHi ? 3.6 - f.x0 : f.x1;
        const a = toWorld(r, lx0, f.z0), b = toWorld(r, lx1, f.z1);
        const aabb = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: r.y, y1: r.y + (f.id === 'tv' ? 1.25 : f.y1 + 0.15), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]) };
        out.push({ id: `rf:${r.no}:${f.id}`, fixture: f.id, room: r.no, aabb, hold: () => s.fixtureHold(r.no, f.id), prompt: () => s.fixturePrompt(r.no, f.id), use: () => s.useFixture(r.no, f.id) });
      }
    }
    return out;
  }

  /* ============================================================
     PER FRAME
     ============================================================ */
  update(dt, input) {
    const s = this.s, pl = s.g.player, ui = s.g.ui;
    const all = this.targets.concat(this.dynamicTargets());
    let hit = castInteract(pl, all.filter((t) => !t.aabb || Math.abs((t.aabb.x0 + t.aabb.x1) / 2 - pl.x) < 5 && Math.abs((t.aabb.z0 + t.aabb.z1) / 2 - pl.z) < 5));
    let prompt = hit ? hit.prompt() : null;
    if (hit && !prompt) hit = null;
    this.hot = hit;
    const holdSecs = hit ? (typeof hit.hold === 'function' ? hit.hold() : hit.hold || 0) : 0;
    ui.setReticle(!!hit);
    if (hit) ui.setPrompt(`${ui.keyHint('interact')} ${escape(prompt)}${holdSecs ? ' <span class="quiet">(hold)</span>' : ''}`);
    else ui.setPrompt(this.idlePrompt());
    // press or hold
    const down = input.isDown('KeyE', 'PadA') || input.isDown('Enter');
    if (hit && holdSecs > 0) {
      if (down && (this.holding === hit.id || input.hit('KeyE', 'Enter', 'Space'))) {
        this.holding = hit.id;
        this.holdT += dt;
        ui.setHold(this.holdT / holdSecs);
        if (this.holdT >= holdSecs) { this.holdT = 0; this.holding = null; ui.setHold(0); hit.use(); this.afterUse(); }
      } else if (!down) { this.holdT = 0; this.holding = null; ui.setHold(0); }
      return;
    }
    if (this.holding) { this.holding = null; this.holdT = 0; ui.setHold(0); }
    if (hit && input.hit('KeyE', 'Enter', 'Space')) { hit.use(); this.afterUse(); }
  }
  afterUse() { this.s.dirtyHands = true; }

  idlePrompt() {
    const s = this.s;
    const top = s.g.player.held.length ? s.g.player.held[s.g.player.held.length - 1] : null;
    return top ? `<span class="quiet">${s.g.ui.keyHint('drop')} put down ${escape(itemLabel(top).toLowerCase())}</span>` : '';
  }
}

function escape(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
export { money, Clock, ROOMS, firstNote };
