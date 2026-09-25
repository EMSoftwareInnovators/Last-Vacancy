/* ============================================================
   ui.js -- everything drawn as DOM over the framebuffer.

   Carried over from Final Rental: the button-glyph tables that
   re-label every prompt for keyboard, Xbox or PlayStation; the
   typewriter dialogue box with its painted portrait and voice
   blips; the paper phone pad; the panels; the options and the
   controller screen that works with a pad whose buttons do
   nothing yet.

   Changed for the motel: the HUD says what time it is and what day,
   what is in your hands (keys, cards, towels, cash), what is waiting
   on you at the desk, and a line of subtitles for people talking
   near you who are not talking to you.
   ============================================================ */
import { PAD_ACTIONS } from '../../engine/input.js';
import { paintPortrait } from '../appearance.js';

const $ = (id) => document.getElementById(id);

/* ============================================================
   BUTTON GLYPHS (Final Rental's, unchanged)
   ============================================================ */
const PAD_BUTTONS = {
  0: ['A', '✕', 'x-a', 'p-x'], 1: ['B', '○', 'x-b', 'p-o'], 2: ['X', '□', 'x-x', 'p-s'],
  3: ['Y', '△', 'x-y', 'p-t'], 4: ['LB', 'L1', 'x-m', 'p-m'], 5: ['RB', 'R1', 'x-m', 'p-m'],
  6: ['LT', 'L2', 'x-m', 'p-m'], 7: ['RT', 'R2', 'x-m', 'p-m'], 8: ['⧉', 'CREATE', 'x-m', 'p-m'],
  9: ['☰', '☰', 'x-m', 'p-m'], 10: ['L3', 'L3', 'x-m', 'p-m'], 11: ['R3', 'R3', 'x-m', 'p-m'],
  12: ['↑', '↑', 'x-d', 'p-d'], 13: ['↓', '↓', 'x-d', 'p-d'],
  14: ['←', '←', 'x-d', 'p-d'], 15: ['→', '→', 'x-d', 'p-d'],
};
const CAPS = {
  interact: 'E', confirm: 'E', back: 'Q', pause: 'ESC', notes: 'TAB',
  drop: 'G', wait: 'F', run: 'SHIFT',
  up: '↑', down: '↓', left: '←', right: '→',
};
const STICKS = {
  move: ['WASD', '◎ L', 'x-d', 'p-d'],
  look: ['MOUSE', '◎ R', 'x-d', 'p-d'],
};
let USER_BINDS = null;
export function setPadBinds(binds) { USER_BINDS = binds || null; }
const ALIAS = { interact: 'confirm' };
function buttonsFor(name) {
  const action = ALIAS[name] || name;
  if (USER_BINDS) {
    const out = [];
    for (const k of Object.keys(USER_BINDS)) if ((USER_BINDS[k] || []).includes(action)) out.push(+k);
    if (out.length) return out.sort((a, b) => a - b);
  }
  const a = PAD_ACTIONS[action];
  return (a && a.def) || [];
}
let SCHEME = 'kbm';
export function setScheme(s) { SCHEME = s || 'kbm'; }
export function currentScheme() { return SCHEME; }
function padGlyph(i) {
  const b = PAD_BUTTONS[i];
  if (!b) return `<span class="key btn x-m">${i}</span>`;
  const ps = SCHEME === 'playstation';
  return `<span class="key btn ${ps ? b[3] : b[2]}">${ps ? b[1] : b[0]}</span>`;
}
function padText(i) {
  const b = PAD_BUTTONS[i];
  if (!b) return `BUTTON ${i}`;
  return SCHEME === 'playstation' ? b[1] : b[0];
}
export function glyph(action) {
  const stick = STICKS[action];
  if (stick) {
    if (SCHEME === 'kbm') return `<span class="key">${stick[0]}</span>`;
    const ps = SCHEME === 'playstation';
    return `<span class="key btn ${ps ? stick[3] : stick[2]}">${stick[1]}</span>`;
  }
  if (SCHEME === 'kbm') return `<span class="key">${CAPS[action] || escape(String(action).toUpperCase())}</span>`;
  const on = buttonsFor(action);
  if (!on.length) return `<span class="key">${CAPS[action] || escape(String(action).toUpperCase())}</span>`;
  return on.slice(0, 2).map(padGlyph).join('<span class="key-or"> </span>');
}
export function glyphText(action) {
  const stick = STICKS[action];
  if (stick) return SCHEME === 'kbm' ? stick[0] : stick[1];
  if (SCHEME === 'kbm') return CAPS[action] || String(action).toUpperCase();
  const on = buttonsFor(action);
  if (!on.length) return CAPS[action] || String(action).toUpperCase();
  return on.slice(0, 2).map(padText).join('/');
}

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), clock: $('clock'), clockTime: $('clock-time'), clockDay: $('clock-day'),
      hands: $('hands'), reticle: $('reticle'), prompt: $('prompt'), toasts: $('toasts'),
      objective: $('objective'), subtitles: $('subtitles'), waiting: $('waiting'),
      dialogue: $('dialogue'), dlgFace: $('dlg-face'), dlgName: $('dlg-name'),
      dlgText: $('dlg-text'), dlgChoices: $('dlg-choices'),
      notes: $('notes'), notesBody: $('notes-body'), notesFoot: $('notes-foot'),
      phone: $('phone-ui'), phoneLines: $('phone-lines'), phoneHdr: $('phone-hdr'), phoneText: $('phone-text'), phoneChoices: $('phone-choices'),
      terminal: $('terminal'), termScreen: $('term-screen'),
      board: $('board'), boardGrid: $('board-grid'), boardInfo: $('board-info'),
      paper: $('paper'), paperBody: $('paper-body'),
      title: $('title'), titleMenu: $('title-menu'),
      panel: $('panel'), panelBody: $('panel-body'),
      fade: $('fade'),
    };
    this._portraitOf = null;
    this._toasts = [];
    this._subs = [];
    this._typed = '';
    this._typeTarget = '';
    this._typeT = 0;
    this.textSpeed = 1;
  }

  /* ---------------- HUD ---------------- */
  setClock(time, day, faster) {
    if (this._clockTxt !== time) { this._clockTxt = time; this.el.clockTime.textContent = time; }
    if (this._dayTxt !== day) { this._dayTxt = day; this.el.clockDay.textContent = day; }
    this.el.clock.classList.toggle('faster', !!faster);
  }
  setHands(html) { if (this._handsHtml !== html) { this._handsHtml = html; this.el.hands.innerHTML = html; } }
  setWaiting(html) { if (this._waitHtml !== html) { this._waitHtml = html; this.el.waiting.innerHTML = html; } }
  setPrompt(html) { if (this.el.prompt.innerHTML !== (html || '')) this.el.prompt.innerHTML = html || ''; }
  setReticle(hot) { this.el.reticle.classList.toggle('hot', !!hot); }
  setHold(f) {
    const on = f > 0.001;
    if (on !== this._holdOn) { this._holdOn = on; this.el.reticle.classList.toggle('holding', on); }
    if (on) this.el.reticle.style.setProperty('--hold', String(Math.min(1, f)));
  }
  setObjective(text, pulse) {
    if (this._obj !== text) { this._obj = text; this.el.objective.textContent = text || ''; }
    this.el.objective.classList.toggle('pulse', !!pulse);
  }
  toast(text, kind = '') {
    const d = document.createElement('div');
    d.className = `toast ${kind}`;
    d.textContent = text;
    this.el.toasts.appendChild(d);
    this._toasts.push({ el: d, t: kind === 'note' ? 5.2 : 3.6 });
    while (this._toasts.length > 5) { const o = this._toasts.shift(); o.el.remove(); }
  }
  /** A line somebody nearby said, to nobody in particular. */
  subtitle(name, text, far) {
    const d = document.createElement('div');
    d.className = 'line' + (far ? ' far' : '');
    d.innerHTML = `<b>${escape(name)}:</b> ${escape(text)}`;
    this.el.subtitles.appendChild(d);
    this._subs.push({ el: d, t: 2.4 + text.length * 0.055 });
    while (this._subs.length > 3) { const o = this._subs.shift(); o.el.remove(); }
  }
  clearSubtitles() { for (const s of this._subs) s.el.remove(); this._subs = []; }
  setSubtitleSize(k) { document.documentElement.style.setProperty('--subs', `${(2.3 * k).toFixed(2)}cqw`); document.documentElement.style.setProperty('--dlg', `${(2.7 * Math.min(1.25, k)).toFixed(2)}cqw`); }

  update(dt) {
    for (let i = this._toasts.length - 1; i >= 0; i--) {
      const r = this._toasts[i];
      r.t -= dt;
      if (r.t < 0.5) r.el.classList.add('fade');
      if (r.t <= 0) { r.el.remove(); this._toasts.splice(i, 1); }
    }
    for (let i = this._subs.length - 1; i >= 0; i--) {
      const r = this._subs[i];
      r.t -= dt;
      if (r.t <= 0) { r.el.remove(); this._subs.splice(i, 1); }
    }
    if (this._typed.length < this._typeTarget.length) {
      this._typeT += dt;
      const cps = 62 * this.textSpeed;
      const n = Math.min(this._typeTarget.length, Math.floor(this._typeT * cps));
      if (n !== this._typed.length) {
        this._typed = this._typeTarget.slice(0, n);
        this._typeEl.textContent = this._typed;
        return this._typed.length;
      }
    }
    return -1;
  }
  get typing() { return this._typed.length < this._typeTarget.length; }
  finishTyping() { this._typed = this._typeTarget; if (this._typeEl) this._typeEl.textContent = this._typed; }

  /* ---------------- dialogue ---------------- */
  showDialogue(node, sel) {
    this.el.dialogue.classList.remove('hidden');
    document.body.classList.add('talking');
    const p = node.person;
    const isPlayer = !!node.asPlayer;
    const name = isPlayer ? 'YOU' : (p && p.name) || '';
    const tagTxt = !isPlayer && p && (p.tagLine || (p.personality && p.personality.tag));
    const tag = tagTxt ? `<span class="tag"> - ${escape(tagTxt)}</span>` : '';
    this.el.dlgName.innerHTML = `${escape(name)}${tag}`;
    this._typeEl = this.el.dlgText;
    if (this._typeTarget !== node.text) {
      this._typeTarget = node.text; this._typed = ''; this._typeT = 0;
      this.el.dlgText.textContent = '';
    }
    if (p && p.app && this._portraitOf !== p) {
      this._portraitOf = p;
      paintPortrait(p.app, this.el.dlgFace);
    }
    this.el.dlgChoices.innerHTML = choicesHtml(node.choices || [], sel);
  }
  hideDialogue() {
    this.el.dialogue.classList.add('hidden');
    document.body.classList.remove('talking');
    this._typeTarget = ''; this._typed = ''; this._portraitOf = null;
  }

  /* ---------------- notepad ---------------- */
  showNotes(html, foot) {
    this.el.notes.classList.remove('hidden');
    if (this._notesHtml !== html) { this._notesHtml = html; this.el.notesBody.innerHTML = html; }
    this.el.notesFoot.innerHTML = foot || '';
  }
  hideNotes() { this.el.notes.classList.add('hidden'); this._notesHtml = null; }

  /* ---------------- phone ---------------- */
  showPhone(node, sel, lines) {
    this.el.phone.classList.remove('hidden');
    document.body.classList.add('talking');
    this.el.phoneHdr.textContent = node.person ? node.person.name : 'LINE 1';
    this.el.phoneLines.innerHTML = lines || '';
    this._typeEl = this.el.phoneText;
    if (this._typeTarget !== node.text) {
      this._typeTarget = node.text; this._typed = ''; this._typeT = 0;
      this.el.phoneText.textContent = '';
    }
    const ch = node.choices || [];
    this.el.phoneChoices.innerHTML = ch.length ? ch.map((c, i) => `<li class="${i === sel ? 'sel' : ''}${c.disabled ? ' dis' : ''}">${i + 1}. `
      + `${c.risk ? '<span class="rec">[!]</span> ' : ''}${escape(c.label)}</li>`).join('') : `<li class="sel">continue</li>`;
  }
  hidePhone() { this.el.phone.classList.add('hidden'); document.body.classList.remove('talking'); this._typeTarget = ''; this._typed = ''; }

  /* ---------------- overlays ---------------- */
  showTerminal(html) { this.el.terminal.classList.remove('hidden'); document.body.classList.add('talking'); if (this._termHtml !== html) { this._termHtml = html; this.el.termScreen.innerHTML = html; } }
  hideTerminal() { this.el.terminal.classList.add('hidden'); document.body.classList.remove('talking'); this._termHtml = null; }
  showBoard(grid, info) {
    this.el.board.classList.remove('hidden'); document.body.classList.add('talking');
    if (this._bg !== grid) { this._bg = grid; this.el.boardGrid.innerHTML = grid; }
    if (this._bi !== info) { this._bi = info; this.el.boardInfo.innerHTML = info; }
  }
  hideBoard() { this.el.board.classList.add('hidden'); document.body.classList.remove('talking'); this._bg = null; this._bi = null; }
  showPaper(html) { this.el.paper.classList.remove('hidden'); document.body.classList.add('talking'); if (this._ph !== html) { this._ph = html; this.el.paperBody.innerHTML = html; } }
  hidePaper() { this.el.paper.classList.add('hidden'); document.body.classList.remove('talking'); this._ph = null; }

  /* ---------------- panels ---------------- */
  showPanel(html) {
    this.el.panel.classList.remove('hidden');
    document.body.classList.add('panel-open');
    if (this._panelHtml !== html) { this._panelHtml = html; this.el.panelBody.innerHTML = html; this.el.panelBody.scrollTop = 0; }
  }
  hidePanel() { this.el.panel.classList.add('hidden'); document.body.classList.remove('panel-open'); this._panelHtml = null; }
  /** Keep the highlighted row of a long menu in view. */
  scrollPanel(dy) { this.el.panelBody.scrollTop += dy; }
  panelSelect(i) {
    const opts = this.el.panelBody.querySelectorAll('li.opt');
    opts.forEach((o, n) => o.classList.toggle('sel', n === i));
    const sel = opts[i];
    if (sel) {
      const box = this.el.panelBody, top = sel.offsetTop, bot = top + sel.offsetHeight;
      if (top < box.scrollTop) box.scrollTop = top - 8;
      else if (bot > box.scrollTop + box.clientHeight) box.scrollTop = bot - box.clientHeight + 8;
    }
    return opts.length;
  }
  showTitle(show, items) {
    this.el.title.classList.toggle('hidden', !show);
    if (items) this.el.titleMenu.innerHTML = items.map((it) => `<li>${escape(it.label)}${it.sub ? `<span class="sub">${escape(it.sub)}</span>` : ''}</li>`).join('');
  }
  titleSelect(i) {
    const items = this.el.titleMenu.querySelectorAll('li');
    items.forEach((o, n) => o.classList.toggle('sel', n === i));
    return items.length;
  }
  keyHint(action) { return glyph(action); }
  setHudVisible(v) { this.el.hud.classList.toggle('hidden', !v); }
  fade(to) { this.el.fade.style.opacity = String(to); }
  cinema(on) { document.body.classList.toggle('cine', !!on); }
}

export function choicesHtml(ch, sel) {
  if (!ch.length) return `<li class="sel">[${glyphText('interact')}] continue</li>`;
  return ch.map((c, i) => {
    const bits = [];
    if (c.risk) bits.push('<span class="risk">!</span>');
    if (c.cost) bits.push(`<span class="cost">${escape(c.cost)}</span>`);
    if (c.good) bits.push(`<span class="cost">+${escape(c.good)}</span>`);
    const tag = bits.length ? `<span class="tag-in">[${bits.join(' ')}]</span> ` : '';
    return `<li class="${i === sel ? 'sel' : ''}${c.disabled ? ' dis' : ''}">${i + 1}. ${tag}${escape(c.label)}</li>`;
  }).join('');
}

export function escape(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
