/* ============================================================
   menus.js -- the front end: title, how-to, options, the controller
   screen, pause and quit.

   The options and controller screens are Final Rental's, down to the
   rule that the controller page must work with a pad none of whose
   buttons are bound yet. Options gain what a longer, wordier game
   wants: separate effects and ambience volume, text speed, and
   subtitles for the things people say near you. Everything here is
   saved now, not just the pad layout.
   ============================================================ */
import { PAD_ACTIONS, BINDABLE } from '../../engine/input.js';
import { glyph, glyphText, escape, currentScheme } from './ui.js';
import { clamp } from '../../engine/mathx.js';

export const RES = [[256, 192, '256x192'], [320, 240, '320x240'], [400, 300, '400x300'], [480, 360, '480x360']];

/* One row per setting: [label, key, kind, step/min/max]. */
export const OPTION_ROWS = [
  ['Look sensitivity', 'sens', 'bar', 0.1, 0.1, 1],
  ['Invert look', 'invert', 'toggle'],
  ['Master volume', 'vol', 'bar', 0.1, 0, 1],
  ['Effects volume', 'sfx', 'bar', 0.1, 0, 1],
  ['Ambience volume', 'amb', 'bar', 0.1, 0, 1],
  ['Text speed', 'textSpeed', 'bar', 0.25, 0.5, 2.5],
  ['Overheard talk', 'subs', 'toggle'],
  ['Subtitle size', 'subSize', 'bar', 0.1, 0.8, 1.5],
  ['Internal resolution', 'res', 'res'],
  ['Polygon jitter', 'snap', 'toggle'],
  ['Dither', 'dither', 'toggle'],
  ['Scanlines', 'scan', 'toggle'],
  ['VHS filter', 'vhs', 'toggle'],
  ['Controller', null, 'pad'],
  ['Back', null, 'back'],
];

export const DEFAULT_OPTS = {
  sens: 0.5, invert: false, vol: 0.8, sfx: 1, amb: 0.9, textSpeed: 1, subs: true, subSize: 1,
  res: 2, snap: false, dither: true, scan: true, vhs: false, grain: 0.3,
};

export function optionsHtml(o, pad) {
  const bar = (v, lo, hi) => `[${'#'.repeat(Math.round((v - lo) / (hi - lo) * 10)).padEnd(10, '.')}]`;
  const row = (r) => {
    const [label, key, kind, , lo, hi] = r;
    let v = '';
    if (kind === 'bar') v = bar(o[key], lo, hi);
    else if (kind === 'toggle') v = key === 'snap' ? (o.snap ? 'PS1 (ON)' : 'SMOOTH') : o[key] ? 'ON' : 'OFF';
    else if (kind === 'res') v = RES[o.res][2];
    else if (kind === 'pad') v = pad ? '' : '<span class="quiet">(none connected)</span>';
    return `<li class="opt">${label} &nbsp; ${v}</li>`;
  };
  return `<h2>OPTIONS</h2><ul>${OPTION_ROWS.map(row).join('')}</ul>
  <p class="pad-foot">${glyph('left')}${glyph('right')} adjust &nbsp;&middot;&nbsp; ${glyph('confirm')} select &nbsp;&middot;&nbsp; ${glyph('back')} back</p>
  <p class="pad-foot quiet">${pad ? `Controller: ${escape(pad)}` : 'No controller detected'}</p>`;
}

/** Nudge a setting left or right. Returns true if anything changed. */
export function adjustOption(o, i, d) {
  const r = OPTION_ROWS[i];
  if (!r || !r[1]) return false;
  const [, key, kind, step, lo, hi] = r;
  if (kind === 'bar') o[key] = Math.round(clamp(o[key] + d * step, lo, hi) * 100) / 100;
  else if (kind === 'toggle') o[key] = !o[key];
  else if (kind === 'res') o.res = clamp(o.res + d, 0, RES.length - 1);
  return true;
}

/** The controller screen (Final Rental's, unchanged). */
export function padHtml(p) {
  const row = (r) => {
    const on = r.capturing;
    const val = on ? '<span class="k">press a button&hellip;</span>'
      : r.buttons.length ? r.buttons.map((b) => `<span class="key btn">${b}</span>`).join(' ')
        : '<span class="quiet">unbound</span>';
    const also = !on && r.shared && r.shared.length ? ` <span class="quiet">(also ${escape(r.shared.join(', ').toLowerCase())})</span>` : '';
    return `<li class="opt">${escape(r.label)} &nbsp; ${val}${also}</li>`;
  };
  const live = p.down.length ? p.down.map((i) => `<span class="key btn">${i}</span>`).join(' ') : '<span class="quiet">nothing pressed</span>';
  const moving = (p.axes || []).map((v, i) => [i, v]).filter(([, v]) => Math.abs(v) > 0.12);
  const axes = moving.length ? moving.map(([i, v]) => `<span class="key btn">${i}</span>&#8202;${v.toFixed(2)}`).join(' &nbsp; ') : '<span class="quiet">all centred</span>';
  const warn = p.name && !p.trusted && !p.custom
    ? (p.known ? `<p class="pad-foot">This browser does not describe your controller's layout, but it is one we know &mdash; laid out below.</p>`
      : `<p class="pad-foot k">This browser does not recognize your controller's layout, so nothing is bound yet &mdash; any button will work a menu until you set it up here.</p>`)
    : '';
  return `<h2>CONTROLLER</h2>
  <p class="pad-foot">${p.name ? escape(p.name) : 'Nothing connected'}${p.name ? ` &nbsp;&middot;&nbsp; ${escape(p.mapping || 'non-standard')} mapping &nbsp;&middot;&nbsp; ${p.count} buttons` : ''}</p>
  ${warn}
  <ul>${p.rows.map(row).join('\n')}<li class="opt">Reset to defaults</li><li class="opt">Back</li></ul>
  <p class="pad-foot">Held down now: ${live}</p>
  <p class="pad-foot">Axes moving: ${axes}</p>
  <p class="pad-foot quiet">Highlight a line and press the button you want for it &mdash; one button can do several jobs. ESC on the keyboard leaves at any time.</p>`;
}

export function padView(i) {
  return {
    name: i.padId, mapping: i.padMapping, count: i.padButtonCount,
    trusted: i.padTrusted, custom: i.bindsAreUser,
    down: i.padDownIndices.slice(), known: i.knownAs || '',
    axes: i.padAxes.map((v) => Math.round(v * 100) / 100),
    rows: BINDABLE.map((id) => ({
      id, label: PAD_ACTIONS[id].label, buttons: i.bindsFor(id),
      shared: i.bindsFor(id).flatMap((b) => i.actionsOn(b)).filter((a) => a !== id).map((a) => PAD_ACTIONS[a].label),
      capturing: i.capturing === id,
    })),
  };
}

export function howToHtml() {
  const key = (g, what) => `<li class="plain">${glyph(g)} ${what}</li>`;
  const onPad = currentScheme() !== 'kbm';
  return `<div class="howto">
  <h2>WORKING THE NIGHT DESK${onPad ? ` <span class="quiet">&mdash; ${currentScheme() === 'playstation' ? 'PLAYSTATION' : 'XBOX'} PAD</span>` : ''}</h2>
  <div class="keys">
    <ul>${key('move', 'walk')}${key('run', 'hurry')}${key('look', 'look')}${key('pause', 'pause')}</ul>
    <ul>${key('interact', 'use / talk / take')}${onPad ? key('up', 'pick a reply') : `<li class="plain"><span class="key">1-6</span> pick a reply</li>`}${key('notes', 'your notepad')}</ul>
    <ul>${key('drop', 'put it down')}${key('wait', 'sit, let time pass')}</ul>
  </div>
  <div class="cols">
    <ul>
      <li><b>Check-ins.</b> Ask the guest what you need (name, how many, how long, smoking, beds, payment). Terminal: ${'F1'} (or 1), ENTER to post. Take the money, get the key off the rack behind you, hand it over.</li>
      <li><b>Money.</b> Cash: ring it up at the register, give back the change. Cards: check the date, imprint (hold ${glyphText('interact')}), they sign. Vouchers: the binder lists who we bill.</li>
      <li><b>The rack.</b> Tabs say CLEAN, DIRTY, OCC, RSVD. After a checkout, hang the key and flip the tab (${glyphText('drop')}).</li>
      <li><b>The phone.</b> Two lines. Never give out a room number: put the call through, or take a message.</li>
    </ul>
    <ul>
      <li><b>Requests</b> go on your notepad (${glyphText('notes')}). Linen and supplies are in the back office.</li>
      <li><b>Wake-ups</b> go on the sheet by the phone. When one is due, pick up the phone and call the room.</li>
      <li><b>Night audit</b> at three: ${'F5'}.</li>
      <li><b>Breakfast</b> from half past four: the pantry has coffee, trays and waffle mix; its fridge has juice and milk.</li>
      <li><b>Quiet?</b> Sit on the stool (${glyphText('wait')}) and the night goes faster.</li>
    </ul>
  </div>
  <p class="pad-foot">${glyph('back')} back</p></div>`;
}
