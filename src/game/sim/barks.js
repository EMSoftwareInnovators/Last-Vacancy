/* ============================================================
   barks.js -- people talking where you can hear them.

   A bark is one line, said out loud by somebody near you, shown as
   a subtitle with their name and voiced in their blips. It is how
   the motel sounds lived in: the man at the desk who has rung the
   bell twice, the woman on the walk, the waffle iron's audience.

   At breakfast, people at the same table talk to each other, and
   some of them are people you know, and some of those have things
   to say to one another. Those exchanges play out a line at a time
   whether you are listening or not; if you are in the room, you
   hear them.
   ============================================================ */
import { BARKS, EXCHANGES, SMALLTALK } from '../content/chatter.js';

export class Barks {
  constructor(shift) {
    this.s = shift;
    this.cool = new Map();
    this.exchange = null;          // { lines, i, t, who: {key: person} }
    this.exT = 12;
    this.usedEx = new Set();
  }

  /** Somebody says something. `key` is a BARKS key or a literal line (prefixed with '='). */
  say(p, key, o = {}) {
    if (!p || p.hidden) return false;
    const now = this.s.g.time;
    const k = `${p.id}:${key}`;
    if (!o.force && (this.cool.get(k) || -99) > now) return false;
    this.cool.set(k, now + (o.cool || 25));
    let text = key.startsWith('=') ? key.slice(1) : null;
    if (!text) {
      const pool = BARKS[key];
      if (!pool) return false;
      text = Array.isArray(pool) ? pool[Math.floor(this.s.rng() * pool.length)] : (o.sub ? pool[o.sub] : null);
      if (!text) return false;
    }
    return this.line(p, text, o);
  }

  /** Put a line on screen if the player is near enough to hear it. */
  line(p, text, o = {}) {
    const s = this.s, pl = s.g.player;
    const d = Math.hypot(p.x - pl.x, p.z - pl.z);
    const sameZone = s.g.zoneOf(p) === s.g.playerZone;
    const range = o.range || (sameZone ? 16 : 9);
    if (d > range || (p.lv || 0) !== (pl.lv || 0) && d > 5) return false;
    if (s.speaking === p) return false;
    s.g.ui.subtitle(p.name.split(' ')[0] === 'Deputy' ? p.name : p.name.split(' ')[0], text, d > 8);
    this.voice(p, text, d);
    return true;
  }

  voice(p, text, d) {
    const s = this.s;
    const n = Math.min(10, Math.ceil(text.length / 9));
    const pitch = (p.app.voice.pitch || 1) * (p.app.voicePitch || 1);
    const k = Math.max(0.12, 1 - d / 18);
    const pan = s.panOf(p.x, p.z);
    for (let i = 0; i < n; i++) setTimeout(() => s.g.quietly(() => s.g.sound.blip(pitch, p.app.voice.rough || 0, k * 0.7, pan)), i * 70);
  }

  sitDown(p) { if (this.s.rng() < 0.3) this.say(p, 'sitDown', { cool: 120 }); }

  /* ---------------- breakfast tables ---------------- */
  update(dt) {
    const s = this.s;
    if (this.exchange) {
      const ex = this.exchange;
      ex.t -= dt;
      if (ex.t <= 0) {
        const [who, text] = ex.lines[ex.i];
        const p = ex.who[who];
        if (p && !p.hidden && p.seat) this.line(p, text, { range: 14 });
        ex.i++;
        ex.t = 2.4 + text.length * 0.045;
        if (ex.i >= ex.lines.length || !p) this.exchange = null;
      }
      return;
    }
    this.exT -= dt;
    if (this.exT > 0) return;
    this.exT = 9 + s.rng() * 12;
    const diners = s.breakfast.diners();
    if (diners.length < 2) return;
    // a written exchange, if the right two people are at one table
    for (const ex of EXCHANGES) {
      const key = ex.need.join('+');
      if (this.usedEx.has(key)) continue;
      const found = ex.need.map((id) => diners.find((p) => p.rosterId === id));
      if (found.some((p) => !p)) continue;
      const near = found.every((p) => Math.hypot(p.x - found[0].x, p.z - found[0].z) < 4.5);
      if (!near) continue;
      this.usedEx.add(key);
      const who = {};
      ex.need.forEach((id, i) => { who[id] = found[i]; });
      this.exchange = { lines: ex.lines, i: 0, t: 0.5, who };
      return;
    }
    // otherwise strangers at a table make small talk
    for (const p of diners) {
      const mates = s.breakfast.tableMates(p);
      if (!mates.length || s.rng() < 0.5) continue;
      const lines = SMALLTALK[Math.floor(s.rng() * SMALLTALK.length)];
      this.exchange = { lines, i: 0, t: 0.5, who: { a: p, b: mates[0] } };
      return;
    }
  }
}
