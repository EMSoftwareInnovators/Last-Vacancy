/* ============================================================
   tasks.js -- what you have promised people, and when.

   The NOTEPAD is in your shirt pocket. Anything you tell somebody
   you will do goes on it: towels to 207, a look at the television
   in 112, batteries for the remote in 104. It is how you keep track
   of a night, and it is the only list on the screen -- the owner
   does not want a clerk who needs a computer to remember towels.

   The WAKE-UP SHEET is on the counter next to the phone. People ask
   for a call; you write the room and the time; when the time comes,
   you call. Final Rental's notepad held a suspect bulletin. This one
   holds towels.
   ============================================================ */
import { Clock } from './clock.js';

let seq = 1;

export class Tasks {
  constructor(shift) { this.s = shift; this.list = []; }

  /**
   * @param t { kind, room, who (person id), text, item, qty, due (minute), source }
   */
  add(t) {
    const task = { id: seq++, status: 'open', created: this.s.clock.min, ...t };
    this.list.push(task);
    this.s.g.sound.pen();
    this.s.g.ui.toast(`Notepad: ${task.text}`, 'note');
    return task;
  }
  open() { return this.list.filter((t) => t.status === 'open'); }
  find(pred) { return this.list.find((t) => t.status === 'open' && pred(t)) || null; }
  forRoom(no, kind) { return this.find((t) => t.room === String(no) && (!kind || t.kind === kind)); }
  complete(t, how = 'done') {
    if (!t || t.status !== 'open') return;
    t.status = how;
    t.doneAt = this.s.clock.min;
    this.s.stats.tasksDone += how === 'done' ? 1 : 0;
    if (how === 'done') this.s.g.ui.toast(`Done: ${t.text}`, 'good');
  }
  fail(t) { if (t && t.status === 'open') { t.status = 'failed'; this.s.stats.tasksFailed++; } }

  /** The notepad page, as HTML. */
  html() {
    const rows = [];
    const open = this.list.filter((t) => t.status === 'open');
    const done = this.list.filter((t) => t.status !== 'open').slice(-6);
    for (const t of open) {
      const late = t.due && this.s.clock.min > t.due;
      rows.push(`<li${late ? ' class="k"' : ''}>${t.room ? `<b>${t.room}</b> ` : ''}${esc(t.text)}${t.due ? ` <span class="quiet">(by ${Clock.label(t.due)})</span>` : ''}</li>`);
    }
    for (const t of done) rows.push(`<li class="done">${t.room ? `${t.room} ` : ''}${esc(t.text)}</li>`);
    const wake = this.s.wakeups.pending().slice(0, 4).map((w) => `${w.room} ${Clock.label(w.at)}`).join(' · ');
    return `<ul>${rows.join('') || '<li class="plain quiet">Nothing promised to anybody yet.</li>'}</ul>`
      + (wake ? `<p class="quiet" style="margin-top:1cqw">Wake-ups on the sheet: ${esc(wake)}</p>` : '');
  }

  save() { return this.list.filter((t) => t.status === 'open' && t.carry).map((t) => ({ ...t })); }
}

export class WakeSheet {
  constructor(shift) { this.s = shift; this.list = []; }
  add(room, at, who, o = {}) {
    const w = { room: String(room), at, who, name: o.name || '', status: 'pending', note: o.note || '', calledAt: null, tries: 0 };
    const old = this.list.find((x) => x.room === w.room && x.status === 'pending');
    if (old) Object.assign(old, w); else this.list.push(w);
    this.list.sort((a, b) => a.at - b.at);
    return w;
  }
  pending() { return this.list.filter((w) => w.status === 'pending'); }
  due(now) { return this.list.filter((w) => w.status === 'pending' && now >= w.at); }
  forRoom(no) { return this.list.find((w) => w.room === String(no) && w.status === 'pending') || null; }
  called(w, how) { w.status = how; w.calledAt = this.s.clock.min; }
  update() {
    const now = this.s.clock.min;
    for (const w of this.list) {
      if (w.status === 'pending' && now > w.at + 25) {
        w.status = 'missed';
        this.s.stats.wakeMissed++;
        this.s.wakeMissed(w);
      }
    }
  }

  /** The sheet on the counter, as paper. */
  html(sel = -1) {
    const rows = this.list.map((w, i) => {
      const st = w.status === 'pending' ? '' : w.status === 'missed' ? '<span class="bad">MISSED</span>' : `<span class="ok">✓ ${Clock.label(w.calledAt)}</span>`;
      return `<tr class="${i === sel ? 'sel' : ''}"><td><b>${w.room}</b></td><td>${Clock.label(w.at)}</td><td>${esc(w.name)}</td><td>${esc(w.note)}</td><td>${st}</td></tr>`;
    }).join('');
    return `<div class="sheet wake"><h2>WAKE-UP CALLS &mdash; ${esc(this.s.clock.dayLabel())}</h2>
      <table><tr><th>RM</th><th>TIME</th><th>NAME</th><th>NOTE</th><th></th></tr>${rows || '<tr><td colspan="5" class="quiet">(nobody yet)</td></tr>'}</table>
      <p class="foot">Call the room from the desk phone when it is time. &nbsp;${this.s.g.ui.keyHint('back')} put it down</p></div>`;
  }
}

function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
