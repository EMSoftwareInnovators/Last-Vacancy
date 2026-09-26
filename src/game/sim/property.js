/* ============================================================
   property.js -- the parts of the Starlite that are not rooms.

   The ice machine, which jams. The pool gate, which the parish
   says has to be shut and latched at ten. The trash in the lobby.
   The bundle of newspapers the Ledger's man throws at the office
   door at five in the morning without slowing down.

   None of these is a crisis. They are the things that make a night
   clerk get up off the stool.
   ============================================================ */
import { NEWS_DROP, NEWS_RACK } from '../world/layout.js';
import { Clock } from './clock.js';

export class Property {
  constructor(shift) {
    this.s = shift;
    this.ice = { level: 1, jammed: false };
    this.gate = { mustLock: false, locked: false };
    this.trash = { lobby: 0.35, breakfast: 0.1 };
    this.news = { state: 'none', count: 0, taken: 0, at: null };
    this.lostItems = [];
  }

  /* ---------------- ice ---------------- */
  iceWorking() { return !this.ice.jammed && this.ice.level > 0.05; }
  iceTaken() { this.ice.level = Math.max(0, this.ice.level - 0.08); }
  jamIce() { this.ice.jammed = true; }
  resetIce() {
    this.ice.jammed = false; this.ice.level = Math.max(this.ice.level, 0.4);
    this.s.g.sound.breakerClack();
    this.s.g.sound.iceDrop(0, 0.8);
  }

  /* The drink, snack and soap machines are vending.js's. */

  /* ---------------- newspapers ---------------- */
  newsDelivered(count) {
    this.news = { state: 'bundle', count, taken: 0, at: this.s.clock.min };
  }
  newsAvailable() { return this.news.state === 'stacked' ? this.news.count - this.news.taken : 0; }
  takePaper() { if (this.newsAvailable() > 0) { this.news.taken++; return true; } return false; }

  update(dt) {
    const s = this.s;
    // the lobby trash fills up as the evening goes, the breakfast trash as breakfast does
    this.trash.lobby = Math.min(1.2, this.trash.lobby + dt * 0.0006);
    if (!this.gate.mustLock && s.clock.past(22, 0)) {
      this.gate.mustLock = true;
      if (!this.gate.locked && s.g.doors.get('gateS')) s.gateReminder();
    }
  }

  /** Dynamic props: the bundle on the walk, the stack on the rack. */
  draw(draws, M) {
    if (this.news.state === 'bundle') {
      draws.push({ mesh: M.newsBundle, x: NEWS_DROP.x, y: 0.0, z: NEWS_DROP.z, yaw: 0.4, r: 0.6 });
    }
    if (this.news.state === 'stacked') {
      const left = this.news.count - this.news.taken;
      if (left > 0) {
        const cx = (NEWS_RACK.x0 + NEWS_RACK.x1) / 2, cz = (NEWS_RACK.z0 + NEWS_RACK.z1) / 2;
        const h = Math.min(1, left / 20);
        draws.push({ mesh: M.newspapers, x: cx, y: 0.53, z: cz, yaw: Math.PI / 2, r: 0.5, scale: 0.6 + h * 0.4 });
      }
    }
  }

  static paperDueAt(rng) { return Clock.at(4, 52) + rng() * 20; }
}
