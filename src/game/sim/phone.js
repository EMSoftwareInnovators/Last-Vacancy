/* ============================================================
   phone.js -- the desk phone. Two outside lines, the rooms,
   HOLD and TRANSFER, and a ringer you can hear from the ice
   machine.

   Final Rental's phone was something you picked up to call out.
   This one calls you. A call rings on a line until somebody
   answers it or the caller gives up; a caller on hold waits, with
   a fuse, and then hangs up; a guest who rang from their room and
   got nobody puts their shoes on and walks to the office.
   ============================================================ */
import { DESK_PROPS } from '../world/layout.js';

let seq = 1;
const RING_EVERY = 3.4;

export class Phone {
  constructor(shift) {
    this.s = shift;
    this.lines = [{ n: 1, call: null }, { n: 2, call: null }];
    this.active = null;         // the call you are on
    this.ringT = 0;
    this.log = [];
  }

  /**
   * Somebody calls the desk.
   * @param c { who: {name, voicePitch, rough, app}, from: 'room'|'outside', room, script(ctx, call) -> node,
   *            ringFor (seconds before they give up), patience (seconds on hold), onMissed(call) }
   */
  incoming(c) {
    const line = this.lines.find((l) => !l.call);
    if (!line) { if (c.onBusy) c.onBusy(c); return null; }
    const call = {
      id: seq++, line: line.n, state: 'ringing', t: 0, holdT: 0, rings: 0,
      ringFor: 30, patience: 45, from: 'outside', ...c,
    };
    line.call = call;
    this.log.push(call);
    this.ringT = 0.01;
    return call;
  }

  ringing() { return this.lines.map((l) => l.call).filter((c) => c && c.state === 'ringing'); }
  onHold() { return this.lines.map((l) => l.call).filter((c) => c && c.state === 'hold'); }
  anyRinging() { return this.ringing().length > 0; }
  lineOf(call) { return this.lines.find((l) => l.call === call); }

  answer(call) {
    call.state = 'active';
    this.active = call;
    call.answeredAt = this.s.clock.min;
    return call;
  }
  hold(call, node) {
    call.state = 'hold'; call.holdT = 0; call.resume = node;
    if (this.active === call) this.active = null;
    this.s.stats.holds++;
  }
  end(call, outcome = 'done') {
    call.state = outcome;
    const l = this.lineOf(call);
    if (l) l.call = null;
    if (this.active === call) this.active = null;
  }

  update(dt) {
    for (const l of this.lines) {
      const c = l.call;
      if (!c) continue;
      c.t += dt;
      if (c.state === 'ringing' && c.t > c.ringFor) {
        this.end(c, 'missed');
        this.s.stats.missedCalls++;
        if (c.onMissed) c.onMissed(c);
      } else if (c.state === 'hold') {
        c.holdT += dt;
        if (c.holdT > c.patience) {
          this.end(c, 'hungup');
          this.s.stats.hungUpOnHold++;
          if (c.onMissed) c.onMissed(c, 'hold');
        }
      }
    }
    // the ringer: a burst every few seconds while anything is ringing
    const ringing = this.ringing();
    if (ringing.length) {
      this.ringT -= dt;
      if (this.ringT <= 0) {
        this.ringT = RING_EVERY;
        const p = DESK_PROPS.phone;
        const { gain, pan } = this.s.g.sound.at((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2, 60, this.s.indoor ? 1 : 0.55);
        this.s.g.sound.phoneRing(pan, Math.max(0.06, Math.sqrt(gain)), ringing[0].line);
        for (const c of ringing) c.rings++;
      }
    } else this.ringT = 0;
  }

  /** The line lamps, for the phone pad's header. */
  lampsHtml() {
    return this.lines.map((l) => {
      const c = l.call;
      const cls = !c ? '' : c.state === 'ringing' ? 'ring' : c.state === 'hold' ? 'hold' : 'on';
      return `<span class="${cls}">LINE ${l.n}</span>`;
    }).join('') + '<span>HOLD</span><span>XFER</span><span>ROOM</span><span>WAKE</span>';
  }
}
