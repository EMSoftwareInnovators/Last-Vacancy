/* ============================================================
   runner.js -- conversations, exactly as Final Rental has them.

   A node is a plain object with a line of speech and up to four
   replies; each reply is a closure that changes the world and
   returns the next node (or null to end the exchange). Because
   nodes are built on demand they always see live state: the room
   that is actually free, the card actually in your hand, how many
   times this person has stayed here before.
   ============================================================ */

export class DialogueRunner {
  constructor() { this.node = null; this.sel = 0; this.person = null; this.onEnd = null; }
  get active() { return !!this.node; }
  start(person, node, onEnd) {
    this.person = person; this.node = node; this.sel = 0; this.onEnd = onEnd || null;
    return node;
  }
  move(d) {
    if (!this.node || !this.node.choices || !this.node.choices.length) return false;
    const n = this.node.choices.length;
    this.sel = (this.sel + d + n) % n;
    return true;
  }
  /** Take the selected reply (or advance a reply-less node). Returns true if the talk continues. */
  pick() {
    if (!this.node) return false;
    const ch = this.node.choices;
    let next = null;
    if (ch && ch.length) {
      const c = ch[Math.min(this.sel, ch.length - 1)];
      if (c.disabled) return true;
      next = c.fn ? c.fn() : null;
    } else if (this.node.next) {
      next = this.node.next();
    }
    this.node = next || null;
    this.sel = 0;
    if (!this.node) { const p = this.person; this.person = null; if (this.onEnd) this.onEnd(p); }
    return !!this.node;
  }
  cancel() {
    const p = this.person;
    this.node = null; this.person = null;
    if (this.onEnd) this.onEnd(p);
  }
}

/* ---------------- node helpers ---------------- */
export const say = (person, text, choices, extra = {}) => ({ person, text, choices: choices || null, ...extra });
export const reply = (label, fn, opts = {}) => ({ label, fn, ...opts });
/** A line with a single way on. */
export const beat = (person, text, label, fn, extra = {}) => say(person, text, [reply(label, fn)], extra);

export const money = (v) => `$${(Math.round(v * 100) / 100).toFixed(2)}`;
export const round2 = (v) => Math.round(v * 100) / 100;
/** Pick from a list with the conversation's rng. */
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
