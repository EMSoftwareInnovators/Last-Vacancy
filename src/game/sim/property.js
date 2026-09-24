/* ============================================================
   property.js -- the parts of the Starlite that are not rooms.

   The ice machine, which jams. The drink machine, which now and
   then keeps somebody's dollar. The pool gate, which the parish
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
    this.soda = { stock: [6, 8, 3, 7, 0, 5], coins: 0, eats: false, empty: false };
    this.snack = { coins: 0 };
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

  /* ---------------- vending ---------------- */
  /** Somebody buys a soda. Returns true if the machine kept their money. */
  vend(p) {
    const ate = this.soda.eats || this.soda.stock.every((n) => n === 0);
    if (!ate) {
      const i = this.soda.stock.findIndex((n) => n > 0);
      this.soda.stock[i]--;
      this.soda.coins += 0.6;
      this.s.ledger.vendingMeter += 0.6;
    } else {
      this.soda.coins += 0.6;              // it took the money all right
      this.s.ledger.vendingMeter += 0.6;
    }
    if (this.soda.stock.filter((n) => n === 0).length >= 3) this.soda.empty = true;
    return ate;
  }
  refillSoda() { this.soda.stock = this.soda.stock.map((n) => Math.max(n, 8)); this.soda.empty = false; this.soda.eats = false; }
  collectCoins() {
    const amt = Math.round((this.soda.coins + this.snack.coins) * 100) / 100;
    this.soda.coins = 0; this.snack.coins = 0;
    return amt;
  }

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
