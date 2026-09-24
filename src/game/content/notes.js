/* ============================================================
   notes.js -- June Whitfield's notes, and the shift log.

   Nobody gets a star rating at the Starlite. The owner leaves a
   note on the desk at the start of every shift, in blue ballpoint,
   on the back of whatever was nearest, and it says what she thinks
   of how the last one went. She is fair. She is also June.

   The shift log is what the motel knows at seven in the morning:
   who came, who called, what went wrong, what you caught.
   ============================================================ */
import { money } from '../dialogue/runner.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/** The first night: the note that is waiting on the desk when you start. */
export function firstNote() {
  return [
    'Welcome to nights.',
    'Seven to seven. The rack is behind you, the system is the green one, the imprinter sticks -- lean on it. Cash in the register gets rung up, not put in your shirt pocket, I don\'t care how busy it gets.',
    'Tonight: Tri-Parish Paving has four rooms (voucher, direct bill, they\'re in the binder). Earl Maddox is Thursday -- 105 -- and if you give him anything else you will hear about it. Mr. Wexler in 205 is on night two of three. He is going to mention the sign. I know about the sign.',
    'Wake-ups go on the sheet by the phone and you CALL them. Audit runs at three. Papers come at five. Coffee on by a quarter to six, breakfast out at six, and nobody under twelve touches the waffle iron alone.',
    'Somebody will ask if we\'d renumber 213. It\'s a number. People need to get over it.',
  ];
}

/**
 * The note June leaves after a shift.
 * @param r the shift report (see Shift.report())
 */
export function juneNote(r) {
  const out = [];
  // the opening depends on how it went overall, but she never says "good job" plainly
  const bad = r.missedWakes + r.privacy + r.drawerOff + r.wrongKeys + r.lostGuests + (r.walkedReservation || 0);
  const k = r.shiftNo || 1;
  const pick = (arr) => arr[k % arr.length];
  if (bad === 0 && r.checkins > 0) out.push(pick([
    'Went through the folios. Went through the drawer. Went through them again, because I didn\'t believe it the first time.',
    'Audit balanced. I checked it with a pencil. It still balanced.',
    'Nothing on the audit. I read it twice looking for the catch. There is always a catch. I\'ll find it Tuesday.',
  ]));
  else if (bad <= 2) out.push(pick(['Read the audit. Mostly fine. "Mostly" is doing some work in that sentence, so here:', 'Audit\'s close. Close counts in horseshoes and at the Starlite, a little. Here:', 'Not bad. Not nothing, either:']));
  else out.push(pick(['Read the audit. Then I made coffee and read it again. We\'ll talk. Here\'s the list:', 'I have a list. You won\'t like the list. I didn\'t like writing the list:']));

  if (r.drawerOff > 0) out.push(`Drawer was ${r.drawerDelta < 0 ? 'short' : 'over'} ${money(Math.abs(r.drawerDelta))}. ${r.drawerDelta < 0 ? 'Short I can find. ' : 'Over is worse than short -- over means somebody didn\'t get their change.'}`);
  if (r.missedWakes) out.push(`${r.missedWakes === 1 ? 'A wake-up call didn\'t get made' : `${r.missedWakes} wake-up calls didn't get made`}. ${r.missedWakeNames ? `${r.missedWakeNames} told me about it at the desk.` : ''} The sheet is by the phone for a reason.`);
  if (r.privacy) out.push('Somebody called and you told them what room a guest was in. We don\'t do that. Not for family, not for the police without paper, not for anybody. Put them through or take a message.');
  if (r.privacyKept) out.push('The woman who asked not to be found wasn\'t found. Good.');
  if (r.expiredTaken) out.push('Ran a card that expired in September. The bank is going to send it back to me with a note, and my note to you is this note.');
  if (r.caughtExpired) out.push('Caught an expired card. Earl would say you\'re learning. I\'m saying it too.');
  if (r.wrongKeys) out.push(`${r.wrongKeys === 1 ? 'Somebody' : `${r.wrongKeys} people`} walked to the wrong door with the key you gave them. Look at the fob before it goes across the counter.`);
  if (r.rackOff) out.push(`The rack and the system disagreed about ${r.rackOff} room${r.rackOff > 1 ? 's' : ''} at audit. Luz cleans by the rack. The rack is the truth. Keep it the truth.`);
  if (r.earl105 === false) out.push('Earl called me from Alexandria to tell me about his room. For eleven minutes.');
  if (r.earl105 === true) out.push('Earl says you\'re "coming along." From Earl that\'s a parade.');
  if (r.earlCoffee === 'lie') out.push('Also: Earl says you told him the coffee was fresh. Never lie to Earl about coffee. It\'s the one thing he has.');
  if (r.homemadeCoupon) out.push('Otis Bellweather\'s coupon is not a coupon. It is the back of a Winn-Dixie receipt. We have been over this with Otis. Now we are over it with you.');
  if (r.petAllowed) out.push('Somebody had a dog in 1-something. I found a little bowl. Sign on the desk says NO PETS.');
  if (r.signFixed) out.push('And somebody wrote on my sign. ...Harold Wexler sent me a thank-you card. A card. With a stamp. Leave it.');
  if (r.waffle) out.push(`The waffle iron: ${r.waffle}.`);
  if (r.breakfastShort) out.push(`Breakfast ran out of ${r.breakfastShort}. We have a pantry. It's twenty feet from the counter.`);
  if (r.coffeeGood) out.push('Coffee was on time. People noticed. People always notice coffee, they just only tell you when it\'s wrong.');
  if (r.longWaits >= 2) out.push(`${r.longWaits === 2 ? 'Two people' : `${r.longWaits} people`} told me they stood at the desk a long time. I believe them; they were specific about it. If you have to be away from the desk, be away fast.`);
  else if (r.longWaits === 1) out.push('Somebody waited at the desk a while. It happens. The bell is loud for a reason.');
  if (r.tasksLeft) out.push(`${r.tasksLeft} thing${r.tasksLeft > 1 ? 's' : ''} somebody asked for didn't get done. I heard about ${r.tasksLeft > 1 ? 'some of them' : 'it'} from Travis, who heard about it from the guest, who heard about it from nobody, which was the problem.`);
  if (r.noVacancyMiss) out.push('We were full and the sign still said VACANCY. People pulled in to find that out. The switch is by the key rack.');
  if (r.turnedAwayWithRooms) out.push('You sent somebody up the road to the Ramada with clean rooms on the rack. The Ramada thanks you.');
  if (r.walkedReservation) out.push('Somebody with a reservation got walked. That is the one thing we do not do. I called them myself this morning.');
  if (r.calledJune > 1) out.push('You called me at home. Twice. If nothing\'s on fire, write it down.');
  if (out.length < 3) {
    const filler = [
      'Somebody put a quarter in the ice machine. I don\'t know why. Neither does the ice machine.',
      'The Coke man says we\'re his favorite stop. He says that to everybody. I still liked hearing it.',
      'Hollis says you\'re "all right." He said the last one was "a person." So.',
      'Mrs. Abernathy wants you to know the ice machine sounded very nice last night.',
    ];
    out.push(r.pruitts ? 'The Pruitt boy wrote on the breakfast table in syrup. I don\'t blame you for that. I just wanted somebody else to know.' : filler[(r.shiftNo || 1) % filler.length]);
  }
  out.push(r.shiftNo <= 1 ? 'Same time tonight.' : 'Same time tonight. Don\'t let the waffle iron win.');
  return out;
}

export function noteHtml(lines, o = {}) {
  const date = o.date ? `<p class="quiet" style="text-align:right">${esc(o.date)}</p>` : '';
  return `<div class="sheet note">${date}${lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p class="sig">-- J.</p>${o.foot ? `<p class="foot">${o.foot}</p>` : ''}</div>`;
}

/** The end-of-shift summary: what happened, plainly. */
export function reportHtml(r) {
  const row = (k, v, cls = '') => `<tr><td>${esc(k)}</td><td class="${cls}">${esc(v)}</td></tr>`;
  return `<div class="sheet report"><h2>SHIFT LOG &mdash; ${esc(r.dateLabel)}</h2>
    <table>
      ${row('Check-ins', `${r.checkins} (${r.walkIns} walk-in${r.walkIns === 1 ? '' : 's'})`)}
      ${row('Check-outs', r.checkouts)}
      ${row('Occupancy at audit', `${r.occupied} of 28`)}
      ${row('Phone calls answered', `${r.calls}${r.missedCalls ? ` (${r.missedCalls} rang out)` : ''}`)}
      ${row('Wake-up calls', `${r.wakesMade} made${r.missedWakes ? `, ${r.missedWakes} missed` : ''}`, r.missedWakes ? 'bad' : '')}
      ${row('Requests handled', `${r.tasksDone}${r.tasksLeft ? `, ${r.tasksLeft} still on the notepad` : ''}`, r.tasksLeft ? 'bad' : '')}
      ${row('Drawer at audit', r.audited ? (r.drawerOff ? `${r.drawerDelta < 0 ? 'short' : 'over'} ${money(Math.abs(r.drawerDelta))}` : 'balanced') : 'audit not run', r.drawerOff || !r.audited ? 'bad' : 'ok')}
      ${row('Coffee', `${r.pots} pot${r.pots === 1 ? '' : 's'}, ${r.cups} cups`)}
      ${row('Breakfast', `${r.plates} plates, ${r.waffles} waffles${r.spills ? `, ${r.spills} spills` : ''}`)}
    </table>
    ${r.notes.length ? `<h3>NOTED</h3><ul>${r.notes.map((n) => `<li class="${n.kind}">${esc(n.text)}</li>`).join('')}</ul>` : ''}
  </div>`;
}
