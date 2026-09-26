/* ============================================================
   clock.js -- seven at night to seven in the morning.

   Final Rental's clock turned three hours into about six minutes
   and stopped while the deputy talked. Twelve hours of motel would
   be an hour and a half at that rate, and most of it would be one
   in the morning. So the night runs at different speeds: the
   check-in rush and the breakfast rush are slow, full of things to
   do, and the dead hours go by quickly. A conversation runs the
   clock at half speed, and sitting on the stool with nothing
   waiting runs it fast until something needs you.
   ============================================================ */

export const SHIFT_START = 19 * 60;          // 7:00 PM
export const SHIFT_END = 31 * 60;            // 7:00 AM, next morning

/* Real seconds per game minute, by period. The whole shift is about
   forty real minutes if you never sit down. */
export const PERIODS = [
  { id: 'rush', from: 19 * 60, to: 21 * 60, spm: 3.4, label: 'evening check-in' },
  { id: 'evening', from: 21 * 60, to: 23 * 60, spm: 3.0, label: 'room problems, late arrivals' },
  { id: 'late', from: 23 * 60, to: 25 * 60, spm: 2.6, label: 'late travelers' },
  { id: 'dead', from: 25 * 60, to: 27 * 60, spm: 1.9, label: 'the quiet part' },
  { id: 'audit', from: 27 * 60, to: 28.5 * 60, spm: 2.4, label: 'night audit' },
  { id: 'prep', from: 28.5 * 60, to: 30 * 60, spm: 3.2, label: 'breakfast prep, wake-ups' },
  { id: 'morning', from: 30 * 60, to: 31 * 60, spm: 5.6, label: 'breakfast rush, checkouts' },
  { id: 'over', from: 31 * 60, to: 34 * 60, spm: 5.6, label: 'handoff' },
];

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export class Clock {
  /** @param date a JS Date for the evening the shift starts */
  constructor(date) {
    this.min = SHIFT_START;
    this.date = date;
    this.fast = 1;            // the stool
    this.slow = 1;            // conversations
  }

  period() {
    for (const p of PERIODS) if (this.min >= p.from && this.min < p.to) return p;
    return PERIODS[PERIODS.length - 1];
  }

  update(dt) {
    if (this.hold) return 0;          // June is showing you round; the night waits
    const p = this.period();
    const before = this.min;
    this.min += (dt / p.spm) * this.slow * this.fast;
    return this.min - before;
  }

  /** "7:05 PM" */
  label(m = this.min) {
    const t = Math.floor(m);
    let h = Math.floor(t / 60) % 24;
    const mm = t % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    h %= 12; if (h === 0) h = 12;
    return `${h}:${String(mm).padStart(2, '0')} ${ap}`;
  }
  /** "THU OCT 16" -- flips to the next day at midnight, the way the desk's clock does. */
  dayLabel() {
    const d = new Date(this.date.getTime());
    if (this.min >= 24 * 60) d.setDate(d.getDate() + 1);
    return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  }
  weekday(offset = 0) { const d = new Date(this.date.getTime()); d.setDate(d.getDate() + offset); return d.getDay(); }

  /** Minutes-of-shift for an hour on the clock: at(5, 15) is 5:15 AM. */
  static at(h, m = 0) { return (h < 12 ? h + 24 : h) * 60 + m; }
  static label(m) { return new Clock(new Date()).label(m); }

  /** 0 through the night, rising from half past five to full light at seven. */
  dawn() { return Math.max(0, Math.min(1, (this.min - Clock.at(5, 30)) / 90)); }

  past(h, m = 0) { return this.min >= Clock.at(h, m); }
  between(a, b) { return this.min >= a && this.min < b; }
  setHour(h, m = 0) { this.min = Clock.at(h, m); }
}
