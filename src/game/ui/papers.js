/* ============================================================
   papers.js -- everything on the desk that is made of paper, and
   every shelf you take something off.

   The binder (policies, the accounts we bill, the group blocks,
   the do-not-disclose list), tonight's registration cards in the
   card box, the wake-up sheet, June's note, the Ledger. And the
   pickers for the linen shelf, the supply shelf and the pantry:
   look at the shelf, choose what you want, carry it.
   ============================================================ */
import { ACCOUNTS, RATES, nightly, withTax } from '../sim/ledger.js';
import { BED_LABEL } from '../world/layout.js';
import { Clock } from '../sim/clock.js';
import { HEADLINES, INSIDE } from '../content/chatter.js';
import { money } from '../dialogue/runner.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function binderHtml(s) {
  const acc = ACCOUNTS.map((a) => `<tr><td><b>${esc(a.name)}</b></td><td>${money(a.rate)}</td><td>${esc(a.note)}</td></tr>`).join('');
  const groups = s.director.reservations.filter((r) => r.group).map((r) => `<li>${esc(r.name)} &mdash; ${r.rooms} rooms, ${r.nights} nights, ${esc(r.note || '')}</li>`).join('');
  const dnd = s.rooms.all().filter((st) => st.noDisclose).map((st) => `<li>Rm ${st.no} &mdash; ${esc(st.guestName)}</li>`).join('');
  return `<div class="sheet binder"><h2>FRONT DESK BINDER</h2>
    <h3>RATES (per night, before 10% tax)</h3>
    <table><tr><td>1 person</td><td>${money(nightly('K', 1, 'RACK'))}</td><td>2 people</td><td>${money(nightly('K', 2, 'RACK'))}</td><td>2 queens</td><td>${money(nightly('QQ', 2, 'RACK'))}</td></tr>
    <tr><td>AAA</td><td>10% off</td><td>Travel-book coupon</td><td>$29.95 SUN&ndash;THU</td><td>Weekly</td><td>$159.00</td></tr></table>
    <h3>ACCOUNTS WE BILL DIRECT (vouchers OK)</h3><table>${acc}</table>
    ${groups ? `<h3>GROUP BLOCKS TONIGHT</h3><ul>${groups}</ul>` : ''}
    <h3>DO NOT DISCLOSE</h3>${dnd ? `<ul>${dnd}</ul>` : '<p class="quiet">(nobody tonight)</p>'}
    <h3>RULES (J.W.)</h3><ul>
      <li>We never say what room anybody is in. Not to family. Not on the phone. Put the call through or take a message.</li>
      <li>Cards: check the date and the name. Imprint, then they sign. Merchant copy in the box.</li>
      <li>Traveler's checks get signed in front of you.</li>
      <li>Cash goes in the register and gets rung up. Paid-outs get a slip.</li>
      <li>Cash guests leave a $10 key deposit. It goes back to them, out of the drawer, with a slip, when the key does.</li>
      <li>No pets. No local checks. Pool closes at 10 &mdash; lock the gate.</li>
      <li>Wake-ups: write it on the sheet, and then CALL.</li>
      <li>Audit at 3. Coffee by 5:45. Breakfast out at 6.</li>
    </ul><p class="foot">${s.g.ui.keyHint('back')} close</p></div>`;
}

export function regCardsHtml(s) {
  const f = s.ledger.folios.filter((x) => x.open).sort((a, b) => Number(a.room) - Number(b.room));
  const rows = f.map((x) => `<tr><td><b>${x.room}</b></td><td>${esc(x.name)}</td><td>${x.party}</td><td>${x.nights}</td><td>${esc(x.pay)}</td><td>${s.rooms.get(x.room) && s.rooms.get(x.room).noDisclose ? '<span class="bad">DO NOT DISCLOSE</span>' : ''}</td></tr>`).join('');
  return `<div class="sheet"><h2>REGISTRATION CARDS &mdash; IN HOUSE</h2>
    <table><tr><th>RM</th><th>NAME</th><th>PTY</th><th>NTS</th><th>PAY</th><th></th></tr>${rows || '<tr><td colspan="6" class="quiet">(empty box)</td></tr>'}</table>
    <p class="foot">For your eyes. Not the caller's. &nbsp;${s.g.ui.keyHint('back')} close</p></div>`;
}

export function newsHtml(s) {
  const k = s.memory.shiftNo;
  const a = HEADLINES[(k * 3) % HEADLINES.length], b = HEADLINES[(k * 3 + 1) % HEADLINES.length], c = HEADLINES[(k * 3 + 2) % HEADLINES.length];
  const d = new Date(s.clock.date.getTime()); d.setDate(d.getDate() + 1);
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  return `<div class="sheet news"><h1>The Delphine Ledger</h1>
    <p class="quiet" style="text-align:center">${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, 1997 &middot; 35&cent;</p>
    <h3>${esc(a.h)}</h3><p>${esc(a.sub)}</p><h3>${esc(b.h)}</h3><p>${esc(b.sub)}</p><h3>${esc(c.h)}</h3><p>${esc(c.sub)}</p>
    <p class="quiet">${esc(INSIDE[k % INSIDE.length])}</p><p class="foot">${s.g.ui.keyHint('back')} fold it back up</p></div>`;
}

/* ============================================================
   SHELVES
   A shelf is a list of { kind, label, stock() , take() }.
   ============================================================ */
export class Picker {
  constructor(shift, title, items, note) { this.s = shift; this.title = title; this.items = items; this.sel = 0; this.note = note || ''; this.msg = ''; }
  handle(i) {
    const n = this.items.length;
    if (i.hit('KeyQ', 'UiBack', 'Backspace')) return false;
    if (i.hit('ArrowUp', 'KeyW')) { this.sel = (this.sel + n - 1) % n; this.s.g.sound.uiMove(); this.msg = ''; }
    if (i.hit('ArrowDown', 'KeyS')) { this.sel = (this.sel + 1) % n; this.s.g.sound.uiMove(); this.msg = ''; }
    const d = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].findIndex((k) => i.hit(k));
    if (d >= 0 && d < n) this.sel = d;
    if (i.hit('KeyE', 'Enter', 'Space') || d >= 0) {
      const it = this.items[this.sel];
      const r = it.take();
      this.msg = r || '';
      if (r === true) { this.msg = ''; return it.close ? false : true; }
    }
    return true;
  }
  render() {
    const rows = this.items.map((it, i) => {
      const st = it.stock ? it.stock() : null;
      return `<tr class="${i === this.sel ? 'sel' : ''}"><td>${i + 1}.</td><td>${esc(it.label)}</td><td>${st === null ? '' : st <= 0 ? '<span class="bad">OUT</span>' : st}</td></tr>`;
    }).join('');
    return `<div class="sheet shelf"><h2>${esc(this.title)}</h2>${this.note ? `<p class="quiet">${esc(this.note)}</p>` : ''}
      <table>${rows}</table>${this.msg ? `<p class="bad">${esc(this.msg)}</p>` : ''}
      <p class="foot">${this.s.g.ui.keyHint('interact')} take &nbsp; ${this.s.g.ui.keyHint('back')} done &nbsp; &middot; &nbsp; hands: ${esc(this.s.handsText() || 'empty')}</p></div>`;
  }
}

export { Clock, BED_LABEL, RATES, withTax };
