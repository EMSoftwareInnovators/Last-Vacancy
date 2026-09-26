/* ============================================================
   training.js -- the first night, with June.

   Night one is the first night of the job, and the owner works it
   with you. She is waiting at the desk when you clock in, and the
   clock waits too while she walks you round the place: the desk,
   the back office, the pantry, the breakfast room, the machines
   out by the ice -- where you fill the Coke and pull your first
   coin box -- the laundry, and back to the register to ring the
   coins in. Then Earl pulls in, and it is your desk.

   After the tour she keeps a few steps behind you all night. She
   stands out of the way at the end of the desk while you work it,
   waits on the walk while you are in a room, says the thing a
   trainer says when you are about to need it, and answers what you
   ask. Ask her what to do next and she will tell you; ask her to
   show you and she walks you there. At a quarter to seven she goes
   home. On the second night, she is a note again.
   ============================================================ */
import { angleTowards } from '../../engine/mathx.js';
import { zoneAt, toWorld, ROOM_BY_NO } from '../world/layout.js';
import { TOUR, introNode, askNode, farewellLine, PLACES } from '../dialogue/june.js';
import { MACHINES, MACHINE_IDS, PRODUCTS } from './vending.js';
import { walkOff } from './npcs.js';
import { Clock } from './clock.js';

/* Out of the way behind the desk: the west end, past the printer. */
const DESK_CORNER = { x: -0.5, z: -6.4, lv: 0 };
const WHERE = {
  desk: 'at the desk', lobby: 'in the lobby', breakfast: 'in the breakfast room', pantry: 'in the pantry',
  backoffice: 'in the back office', laundry: 'in the laundry', maint: 'in the supply room', alcove: 'by the machines', outside: 'outside',
};

export class Training {
  constructor(shift) {
    this.s = shift;
    this.june = null;
    this.phase = 'off';        // off | tour | ride | leaving | gone
    this.i = 0;                // which stop
    this.goal = null;          // where she is walking to
    this.routed = null;
    this.arrived = false;
    this.talked = -1;          // the stop whose talk has been had
    this.lead = null;          // somewhere she is walking you to, when asked
    this.said = new Set();
    this.cool = {};
    this.lastSeen = 0;
    this.stats0 = {};
  }
  get active() { return this.phase === 'tour' || this.phase === 'ride' || this.phase === 'leaving'; }
  get touring() { return this.phase === 'tour'; }

  /* ============================================================
     START AND FINISH
     ============================================================ */
  /** Seven o'clock, night one: June is at the desk and starts talking. */
  begin() {
    const s = this.s;
    const j = s.director.person('JUNE');
    j.kind = 'staff';
    j.x = TOUR[0].at.x; j.z = TOUR[0].at.z; j.lv = 0; j.hidden = false;
    j.yaw = Math.atan2(s.g.player.x - j.x, s.g.player.z - j.z);
    j.speed *= 1.05;
    this.june = j;
    s.npcs.push(j, this.brain());
    this.phase = 'tour';
    this.i = 0;
    s.clock.hold = true;
    this.stats0 = { ...s.stats };
    s.startTalk(j, introNode(s, this, j));
  }
  /** The tour is over (or skipped): the clock starts, the night starts. */
  startRide() {
    const s = this.s;
    this.phase = 'ride';
    this.goal = null;
    s.clock.hold = false;
    this.wakes0 = s.wakeups.list.length;   // the standing ones (Hollis, the residents) are not yours
    s.log('June showed you round.', 'plain');
  }
  skipTour() {
    this.machineTasks();
    this.startRide();
    this.said.add('tourSkipped');
  }
  /** Straight to the night from anywhere in the tour: the "skip" reply, and the headless tools. */
  skipNow() {
    const s = this.s;
    if (s.runner.node && s.runner.person === this.june) s.runner.cancel();
    if (this.phase === 'tour') this.skipTour();
  }
  /** What the tour found wrong with the machines goes on the notepad. */
  machineTasks() {
    const s = this.s;
    for (const id of MACHINE_IDS) {
      const e = s.vending.empties(id);
      if (e.length && !s.tasks.find((t) => t.kind === 'vend' && t.machine === id && t.why === 'empty')) {
        s.tasks.add({ kind: 'vend', machine: id, why: 'empty', where: id, text: `Fill the ${MACHINES[id].name.replace(/^the /, '')} (${e.map((k) => PRODUCTS[k].short.toLowerCase()).join(', ')} out)` });
      }
    }
  }
  nextStop(skip = 1) {
    this.i = Math.min(TOUR.length - 1, this.i + skip);
    this.arrived = false; this.talked = -1; this.waitT = 0;
    this.setGoal(TOUR[this.i].at);
    return null;
  }
  /** Walk the clerk somewhere they asked to be shown. */
  leadTo(place) {
    if (!place) return;
    this.lead = { ...place, t: 0 };
    this.setGoal(place);
  }

  /* ============================================================
     HER FEET
     ============================================================ */
  setGoal(g) {
    if (!g) { this.goal = null; return; }
    const moved = !this.goal || Math.hypot(g.x - this.goal.x, g.z - this.goal.z) > 1.0 || (g.lv || 0) !== (this.goal.lv || 0);
    this.goal = { x: g.x, z: g.z, lv: g.lv || 0 };
    if (moved) { this.routed = null; this.arrived = false; }
  }
  /** The activity that walks her: to the goal if there is one, then face the clerk. */
  brain() {
    const T = this;
    return {
      kind: 'june',
      update(p, dt, s, n) {
        if (T.phase === 'gone') return true;
        const g = T.goal, pl = s.g.player;
        if (g && !(s.speaking === p)) {
          const d = Math.hypot(g.x - p.x, g.z - p.z);
          if (d > 0.3 || (p.lv || 0) !== g.lv) {
            if (!T.routed) { n.route(p, g.x, g.z, g.lv); T.routed = { ...g }; }
            p.rushing = Math.hypot(pl.x - p.x, pl.z - p.z) > 9 && T.phase !== 'tour';
            if (p.path) n.step(p, dt);
            else if (n.approach(p, g.x, g.z, dt)) T.routed = null;
            T.arrived = false;
            return false;
          }
          T.arrived = true;
          p.rushing = false;
        }
        p.yaw = angleTowards(p.yaw, Math.atan2(pl.x - p.x, pl.z - p.z), dt * 4);
        return false;
      },
    };
  }

  /* ============================================================
     EVERY FRAME
     ============================================================ */
  update(dt) {
    const s = this.s, j = this.june;
    if (!j || this.phase === 'off' || this.phase === 'gone') return;
    if (j.gone) { this.phase = 'gone'; return; }
    const pl = s.g.player;
    const d = Math.hypot(pl.x - j.x, pl.z - j.z);
    const near = d < 3.4 && (pl.lv || 0) === (j.lv || 0);
    if (near) this.lastSeen = s.g.time;
    if (this.phase === 'tour') { this.tour(dt, near); return; }
    if (this.phase === 'leaving') return;
    // a quarter to seven: she goes home
    if (s.clock.past(6, 45) && !s.mode) { this.leave(); return; }
    if (this.lead) {
      this.lead.t += dt;
      if (this.arrived && near) { this.bark(`${this.lead.label.charAt(0).toUpperCase() + this.lead.label.slice(1)}. Here.`, 'lead', 0, true); this.lead = null; }
      else if (this.lead.t > 90) this.lead = null;
      return;
    }
    // where to stand is worked out a couple of times a second, not every frame: a route is a search
    this.followT = (this.followT || 0) - dt;
    if (this.followT <= 0) { this.followT = 0.4; this.follow(d); }
    this.coach(dt);
  }

  /** The tour: walk to the stop, wait for the clerk, say the stop, or wait for the job to be done. */
  tour(dt, near) {
    const s = this.s, stop = TOUR[this.i], j = this.june;
    if (!this.goal) this.setGoal(stop.at);
    if (s.mode) return;
    if (stop.handsOn) {
      if (stop.done(s)) { if (stop.doneLine) this.bark(stop.doneLine, 'done' + stop.id, 0, true); this.nextStop(); return; }
      return;
    }
    if (!this.arrived) return;
    if (!near) {
      this.waitT = (this.waitT || 0) + dt;
      if (this.waitT > 22) { this.waitT = 0; this.bark(['Over here.', 'This way.', 'Come on, I\'m not getting younger.'][Math.floor(s.rng() * 3)], 'wait', 0, true); }
      return;
    }
    if (this.talked !== this.i && stop.node) {
      this.talked = this.i;
      s.startTalk(j, stop.node(s, this, j));
    }
  }

  /** A few steps behind, out of the way at the desk, on the walk while you are in a room. */
  follow(d) {
    const s = this.s, pl = s.g.player, zone = zoneAt(pl.x, pl.z, pl.lv || 0);
    let g = null;
    if (zone === 'desk') g = DESK_CORNER;
    else if (zone.startsWith('room:')) {
      const r = ROOM_BY_NO[zone.slice(5)];
      const [x, z] = toWorld(r, r.doorHi ? r.door.x0 - 1.1 : r.door.x1 + 1.1, -1.3);
      g = { x, z, lv: r.lv };
    } else if (d > 2.8 || (pl.lv || 0) !== (this.june.lv || 0)) {
      g = { x: pl.x - Math.sin(pl.yaw) * 1.6, z: pl.z - Math.cos(pl.yaw) * 1.6, lv: pl.lv || 0 };
    }
    if (g) this.setGoal(g);
    else if (this.arrived || d < 2.2) this.goal = null;
  }

  leave() {
    const s = this.s, j = this.june;
    this.phase = 'leaving';
    this.goal = null;
    s.barks.line(j, farewellLine(s), { range: 30 });
    s.npcs.clear(j);
    s.npcs.push(j, walkOff(5.2, -16.8));
    s.log('June went home at a quarter to seven.', 'plain');
  }

  /* ============================================================
     WHAT A TRAINER SAYS
     ============================================================ */
  /** Say something, once (or once per `cool` game minutes), if she is near enough to be heard. */
  bark(text, key, cool = 0, force = false) {
    const s = this.s, now = s.clock.min;
    if (!force) {
      if (cool === 0 && this.said.has(key)) return false;
      if (cool > 0 && now < (this.cool[key] || -999)) return false;
    }
    const ok = s.barks.line(this.june, text, { range: 18 });
    if (!ok) return false;
    this.said.add(key);
    if (cool > 0) this.cool[key] = now + cool;
    return true;
  }
  coach() {
    const s = this.s;
    if (s.mode === 'talk' || s.mode === 'phone') return;
    this.coachT = (this.coachT || 0) + 1;
    if (this.coachT % 20) return;       // a few times a second is plenty
    const front = s.desk.front(), ci = front && front.ci;
    const zone = s.g.playerZone;
    const st = s.stats, st0 = this.stats0;
    const tryOne = (key, cond, text, cool = 0) => cond && this.bark(typeof text === 'function' ? text() : text, key, cool);
    if (tryOne('phone', s.phone.anyRinging(), 'Phone. "Starlite Motor Lodge." Always.')) return;
    if (tryOne('firstGuest', front && front.deskReason === 'checkin' && (!ci || ci.stage === 'talk'), () => `That's ${front.name.split(' ')[0]}. Go on -- name, how many, how long, how they're paying.`)) return;
    if (tryOne('firstSystem', ci && ci.stage === 'system', 'Now the terminal. F1. Check the form, then Enter.')) return;
    if (tryOne('firstPay', ci && ci.stage === 'pay', 'Tell them the total. Out loud. People like to hear it.')) return;
    if (tryOne('firstCash', s.pendingSale && !s.pendingSale.rung, 'Cash to the register. Ring it up, then the change.')) return;
    if (tryOne('firstCard', ci && ci.stage === 'card', 'Card: look at the date before anything. Then lean on the imprinter.')) return;
    if (tryOne('firstKey', ci && ci.stage === 'key', 'The key off the rack. Look at the fob before it goes across.')) return;
    if (tryOne('awayFromDesk', front && zone !== 'desk' && zone !== 'lobby', 'Somebody\'s at the desk.', 12)) return;
    if (tryOne('wakeSheet', s.wakeups.list.length > (this.wakes0 || 0), 'That wake-up is on the sheet now. When it comes due, you call the room.')) return;
    if (tryOne('wakeDue', s.wakeups.due(s.clock.min).length > 0, 'Wake-up. Now. The desk phone.', 8)) return;
    if (tryOne('wrongKey', st.wrongKeys > (st0.wrongKeys || 0), 'Look at the fob. Every time.')) return;
    if (tryOne('privacy', st.privacy > (st0.privacy || 0), 'We don\'t give out rooms. Ever. That one I\'d have fired you for, if it wasn\'t your first night.')) return;
    if (tryOne('vendComplaint', s.desk.line.some((p) => p.complaint && p.complaint.kind === 'vending'), 'Told you somebody would be down about the machines.')) return;
    if (tryOne('coinsHeld', !!s.heldOf('vendCoins') && zone !== 'desk', 'Those coins go in the register. Not your pocket.', 25)) return;
    if (tryOne('gate', s.clock.past(22, 0) && !s.property.gate.locked, 'Ten o\'clock. Pool gates, both of them.', 30)) return;
    if (tryOne('audit', s.clock.past(3, 0) && !(s.terminal.audit && s.terminal.audit.done), 'It\'s three. Audit: F5.', 20)) return;
    if (tryOne('coffee', s.clock.past(5, 0) && s.breakfast.coffee.coffee.level < 0.3 && !s.breakfast.coffee.coffee.brewing, 'Coffee by a quarter to six. Pantry.', 20)) return;
    if (tryOne('papers', s.property.news.state === 'bundle', 'The papers are out front.', 20)) return;
    // the long quiet part of the night: she talks, a little
    if (s.g.player.sitting && s.clock.past(1, 30) && !s.clock.past(4, 30)) {
      const stories = [
        'My husband put up the sign in 1974. The NO has been out since \'91. I keep meaning to.',
        'I worked this shift nine years before I hired anybody for it. Don\'t let the quiet fool you. The quiet is when the ice machine plans things.',
        'Earl has stayed here two hundred and some nights. He\'s never once asked for a different room. He\'s asked for a different coffee.',
        'Luz has been here longer than the carpet. Do what Luz says.',
      ];
      const k = this.said.size % stories.length;
      tryOne('story' + k, true, stories[k], 0);
    }
  }

  /* ============================================================
     THE REST OF THE SHIFT, ASKING
     ============================================================ */
  talkNode() { return askNode(this.s, this, this.june); }
  /** Things the panels and the register tell the night. */
  event(kind) {
    if (this.phase !== 'tour') return;
    const stop = TOUR[this.i];
    if (kind === 'vendTaken' && stop.id === 'coke') this.bark('That\'s the one. Both arms.', 'tookCase');
  }

  /** The line on screen that says what to do. Null: the usual one. */
  objective() {
    const s = this.s, j = this.june;
    if (this.phase === 'tour') {
      const stop = TOUR[this.i];
      if (stop.handsOn) return [stop.task, false];
      if (!this.arrived || Math.hypot(s.g.player.x - j.x, s.g.player.z - j.z) > 3.4) {
        // where she is now, or where she is waiting for you
        const where = this.arrived && stop.where ? stop.where : WHERE[zoneAt(j.x, j.z, j.lv || 0)];
        return [`Follow June${where ? ` -- she's ${where}` : ''}.`, false];
      }
      return ['June wants a word.', true];
    }
    if (this.lead) return [`Follow June to ${this.lead.label}.`, false];
    return null;
  }
}

export { PLACES, Clock };
