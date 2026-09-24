/* ============================================================
   desk.js -- the front desk, from the guest's side of it.

   People come in and stand at the counter. If you are behind it,
   they say good evening. If you are not -- if you are upstairs with
   an armful of towels -- they ring the bell, and you hear it across
   the lot, and they wait. Then they ring it again. A line forms the
   way Final Rental's line formed: first come, first served, and
   everybody has a fuse whose length depends on who they are.

   Nobody storms off into the night over a few minutes. But they
   remember, and so does the owner.
   ============================================================ */
import { SPOTS, DESK_PROPS } from '../world/layout.js';

export class Desk {
  constructor(shift) {
    this.s = shift;
    this.line = [];            // people, front first
    this.bellT = 0;
  }

  join(p, reason, o = {}) {
    if (this.line.includes(p)) return;
    p.deskReason = reason; p.deskDone = false; p.deskWait = 0; p.bellRung = 0; p.deskOpts = o;
    this.line.push(p);
  }
  leave(p) {
    const i = this.line.indexOf(p);
    if (i >= 0) this.line.splice(i, 1);
  }
  isFront(p) { return this.line[0] === p; }
  front() { return this.line[0] || null; }
  done(p) { return !!p.deskDone; }
  finish(p) { p.deskDone = true; this.leave(p); }
  waiting() { return this.line.filter((p) => !p.hidden); }

  spotFor(p) {
    const i = this.line.indexOf(p);
    if (i < 0) return null;
    if (i === 0) return SPOTS.guestDesk;
    const q = SPOTS.queue[Math.min(i - 1, SPOTS.queue.length - 1)];
    return { x: q.x, z: q.z, yaw: Math.atan2(SPOTS.guestDesk.x - q.x, SPOTS.guestDesk.z - q.z) };
  }

  clerkAtDesk() {
    const pl = this.s.g.player;
    return pl.lv === 0 && pl.x > -1 && pl.x < 7.2 && pl.z > -7 && pl.z < -4.9;
  }

  /** Somebody reached the counter. */
  arrived(p) {
    if (!this.clerkAtDesk()) this.ring(p);
    else this.s.greet(p);
  }

  ring(p) {
    p.bellRung++;
    this.s.bell();
  }

  update(dt) {
    for (const p of this.line) {
      if (p.hidden || p !== this.line[0] && Math.random() < 0.5) continue;
      if (this.s.speaking === p) { p.deskWait = 0; continue; }
      p.deskWait += dt;
      // the bell again, if you still are not there, and each time they sound a little less patient
      const again = 18 + p.patience * 0.12;
      if (this.isFront(p) && !this.clerkAtDesk() && p.deskWait > again * (p.bellRung || 1)) {
        this.ring(p);
        if (p.bellRung === 3) this.s.bark(p, 'wait');
      }
      if (p.deskWait > p.patience) p.mood = Math.max(0, p.mood - dt * 0.6);
      if (p.deskWait > p.patience * 1.6 && !p.flags.longWait) {
        p.flags.longWait = true;
        this.s.stats.longWaits = (this.s.stats.longWaits || 0) + 1;
        this.s.log(`${p.name} stood at the desk a long time.`, 'note');
        this.s.bark(p, 'waitLong');
      }
    }
  }

  /** Where the bell is, for the sound. */
  bellPos() { return DESK_PROPS.bell; }
}
