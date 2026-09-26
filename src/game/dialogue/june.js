/* ============================================================
   june.js -- June Whitfield, in person, on your first night.

   Every other night she is a note on the desk. The first night she
   is standing next to you when you clock in, and she stays until
   Travis comes at seven: a tour of the place first, then a night of
   watching you do it, answering whatever you ask, and walking you
   over to whatever needs doing if you ask her to show you.

   She is the note in a cardigan: fair, dry, specific, and not in
   the business of saying "good job" out loud.
   ============================================================ */
import { say, reply, money } from './runner.js';
import { Clock } from '../sim/clock.js';
import { PRODUCTS, MACHINES, MACHINE_IDS } from '../sim/vending.js';
import { SPOTS, ROOM_BY_NO, VEND_BY_ID } from '../world/layout.js';

/* Places she can walk you to. */
export const PLACES = {
  desk: { x: 3.1, z: -5.9, lv: 0, label: 'the desk' },
  register: { x: 4.6, z: -5.8, lv: 0, label: 'the register' },
  linen: { x: 2.4, z: -12.6, lv: 0, label: 'the linen shelves' },
  cabinet: { x: 5.2, z: -12.6, lv: 0, label: 'the supply cabinet' },
  mgrdesk: { x: 6.4, z: -11.1, lv: 0, label: 'June\'s desk' },
  pantry: { x: -4.6, z: -11.0, lv: 0, label: 'the pantry' },
  breakfast: { x: -5.6, z: -4.4, lv: 0, label: 'the breakfast counter' },
  machines: { x: 7.0, z: 31.9, lv: 0, label: 'the drink and snack machines' },
  supply: { x: 3.2, z: 33.0, lv: 0, label: 'the supply room' },
  laundry: { x: 0.4, z: 33.6, lv: 0, label: 'the laundry' },
  ice: { x: 8.25, z: 32.4, lv: 0, label: 'the ice machine' },
  gate: { x: 0.0, z: 19.8, lv: 0, label: 'the pool gate' },
};
export function roomPlace(no) {
  const r = ROOM_BY_NO[no];
  return r ? { x: r.outside.x, z: r.outside.z, lv: r.lv, label: `room ${no}` } : null;
}
export function machinePlace(id) {
  const v = VEND_BY_ID[id];
  if (id === 'soap') return { ...PLACES.laundry, label: 'the soap machine' };
  return { x: (v.x0 + v.x1) / 2 + 0.3, z: v.z0 - 1.4, lv: 0, label: MACHINES[id].name };
}

const ok = (T, label = 'Okay.', fn) => [reply(label, () => (fn ? fn() : null))];

/* ============================================================
   THE TOUR
   Each stop is what she says when you have caught up with her.
   The last reply of each one sends her on to the next.
   ============================================================ */
export function introNode(s, T, june) {
  return say(june, 'There you are. June Whitfield -- I own the place, which mostly means I own the problems. It\'s your first night, so tonight I\'m not leaving you a note. I\'m staying. All night.', [
    reply('All night?', () => introTwo(s, T, june, 'All night. ')),
    reply('Good to meet you, June.', () => introTwo(s, T, june, 'Likewise. ')),
  ]);
}
function introTwo(s, T, june, lead) {
  return say(june, `${lead}You work, I watch, and when you don't know something you ask me instead of guessing. Guessing is how 213 got a reputation. First, the tour. Ten minutes. Nobody's due till Earl, and Earl is early for nothing but coffee.`, [
    reply('Lead the way.', () => deskOne(s, T, june)),
    reply('I\'ve worked a desk before. Skip the tour.', () => say(june, 'Then I\'ll watch. Three things you won\'t know: the machines outside are ours now -- the vending company quit on us -- the supply room is the steel door by the laundry, and the coins from the machines go in the register. Everything else you\'ll find. Go on.', ok(T, 'Got it.', () => { T.skipTour(); return null; }))),
  ]);
}
function deskOne(s, T, june) {
  return say(june, 'The desk. The green screen is the system: F1 checks people in, F2 checks them out, F5 is the night audit at three. The register is at the end, and every dollar gets rung up. Not put in your shirt. I don\'t care how busy it gets.', [
    reply('Every dollar.', () => say(june, 'The imprinter: card in, lean on it. The phone has two lines, and wake-ups go on the sheet next to it, and then you CALL them. The sheet doesn\'t call anybody. Behind you is the key rack. The rack is the truth -- Luz cleans by the rack.', [
      reply('The rack is the truth.', () => say(june, 'Good. The back office. Follow me.', ok(T, '(Follow her.)', () => T.nextStop()))),
    ])),
  ]);
}

export const TOUR = [
  { id: 'desk', at: { x: 3.25, z: -5.75, lv: 0 } },
  {
    id: 'back', at: { x: 4.3, z: -9.7, lv: 0 }, where: 'in the back office',
    node: (s, T, j) => say(j, 'Back office. Linen along the back wall: towels, pillows, blankets, the little soaps. The cabinet next to it has bulbs, batteries, the spare remote, a plunger. When a room calls down about something, what they need is in here.', [
      reply('Okay.', () => say(j, 'That\'s my desk. At three the audit prints a packet; it goes on my desk, square to the corner. Next, the pantry. Through here.', ok(T, '(Follow her.)', () => T.nextStop()))),
    ]),
  },
  {
    id: 'pantry', at: { x: -4.4, z: -11.0, lv: 0 }, where: 'in the pantry',
    node: (s, T, j) => say(j, 'Pantry. Coffee packs, muffins, bagels, cereal and the waffle mix on the shelf; juice and milk in the fridge. Breakfast is yours from half past four. The truck comes Tuesday, so don\'t waste muffins.', [
      reply('Half past four.', () => say(j, 'And through there.', ok(T, '(Follow her.)', () => T.nextStop()))),
    ]),
  },
  {
    id: 'breakfast', at: { x: -5.0, z: -4.4, lv: 0 }, where: 'in the breakfast room',
    node: (s, T, j) => say(j, 'The Deluxe Continental. Deluxe means two kinds of muffin. Coffee is on by a quarter to six -- people always notice coffee, they just only say so when it\'s wrong. The waffle iron: nobody under twelve alone, and don\'t you walk away from it either. Papers come at five and go on the rack by the door.', [
      reply('Nobody under twelve.', () => say(j, 'Now outside. The machines.', ok(T, '(Follow her.)', () => T.nextStop()))),
    ]),
  },
  {
    id: 'machines', at: { x: 7.3, z: 31.7, lv: 0 }, where: 'outside, at the vending machines by the ice',
    node: (s, T, j) => say(j, 'Drink machine, snack machine, ice. The vending company quit on us in March, so these are ours now, which means they\'re yours. You fill them, you pull the coins, the coins go in the register. See the red light on the drink machine? SOLD OUT. On Coke. In this parish that\'s a crime.', [
      reply('What do I do?', () => say(j, 'The supply room is the steel door two down, past the laundry. Inside there\'s a shelf for each machine -- SODA, SNACKS, SOAP. Take a case of Coke off the SODA shelf, carry it back here, and press E on the machine. It loads itself. Anything you took and don\'t need goes back on its shelf.', ok(T, 'On it.', () => T.nextStop()))),
    ]),
  },
  {
    id: 'coke', at: { x: 7.3, z: 31.7, lv: 0 }, handsOn: true,
    task: 'Take a case of Coke off the SODA shelf in the supply room (the steel door past the laundry), carry it back, and press E on the drink machine.',
    done: (s) => s.vending.count('soda', 'coke') >= MACHINES.soda.cap,
    doneLine: 'There. Full.',
  },
  {
    id: 'coins', at: { x: 7.3, z: 31.7, lv: 0 },
    node: (s, T, j) => say(j, 'Now it\'s full, the coin box can come out. Open it again: the coin box is the bottom line. Only when a machine is full, mind -- I count the coin box against the fill sheet, and the sheet says full.', ok(T, 'Okay.', () => T.nextStop())),
  },
  {
    id: 'pull', at: { x: 7.3, z: 31.7, lv: 0 }, handsOn: true,
    task: 'Open the drink machine again and pull the coin box.',
    done: (s) => !!s.heldOf('vendCoins') || s.vending.machine('soda').coins < 0.01,
    doneLine: 'Coins stay in your pocket till the register. The register, not your pocket. Laundry next.',
  },
  {
    id: 'laundry', at: { x: 0.5, z: 33.5, lv: 0 }, where: 'in the guest laundry',
    node: (s, T, j) => say(j, 'Guest laundry. Seventy-five cents a load. That\'s the soap machine -- ours too -- and it\'s out of Tide. Somebody will be down about that tonight, sure as anything. The snack machine\'s out of Funyuns and honey buns, same story.', [
      reply('I\'ll fill them.', () => {
        T.machineTasks();
        return say(j, 'Then it goes on your notepad. Tab. Everything you promise anybody goes on the notepad; that\'s how you remember towels at two in the morning. The pool gates get locked at ten, both of them. Now back to the office.', ok(T, '(Follow her.)', () => T.nextStop()));
      }),
    ]),
  },
  {
    id: 'register', at: { x: 5.7, z: -5.9, lv: 0 }, where: 'back behind the desk',
    node: (s, T, j) => (s.heldOf('vendCoins')
      ? say(j, 'Register. Ring in the coins.', ok(T, 'Okay.', () => T.nextStop()))
      : say(j, 'Back where we started.', ok(T, 'Okay.', () => T.nextStop(2)))),
  },
  {
    id: 'ring', at: { x: 5.7, z: -5.9, lv: 0 }, handsOn: true,
    task: 'Ring the coin box into the register (end of the counter).',
    done: (s) => !s.heldOf('vendCoins'),
    doneLine: 'Good.',
  },
  {
    id: 'done', at: { x: 5.7, z: -5.9, lv: 0 },
    node: (s, T, j) => say(j, 'That\'s the whole place. Earl Maddox is due any minute -- he\'s Thursday, 105, it\'s blocked for him on the rack. From here on it\'s you. I\'ll be right behind you, and if you get stuck, ask me. That\'s what I\'m for tonight.', ok(T, 'Thanks, June.', () => { T.startRide(); return null; })),
  },
];

/* ============================================================
   AFTER THE TOUR: WHAT YOU CAN ASK HER
   ============================================================ */
export function askNode(s, T, j) {
  if (T.phase === 'leaving') return say(j, farewellLine(s), ok(T, 'Night, June. Morning. Whichever.'));
  if (T.phase === 'tour') {
    return say(j, 'Keep up. We\'re almost done.', [
      reply('Okay.', () => null),
      reply('Can we skip the rest?', () => say(j, 'Suit yourself. The machines are yours, the supply room is by the laundry, the coins go in the register. Go.', ok(T, 'Got it.', () => { T.skipTour(); return null; }))),
    ]);
  }
  const hi = ['What do you need?', 'Ask.', 'Mm?', 'Go ahead.'][Math.floor(s.rng() * 4)];
  return say(j, hi, [
    reply('What should I be doing right now?', () => nextNode(s, T, j)),
    reply('How does a check-in go again?', () => say(j, 'Talk to them first: name, how many, how many nights, smoking, what beds, how they\'re paying. Then the terminal, F1, and Enter posts it. Tell them the total. Take the money -- cash to the register, a card through the imprinter, a voucher against the binder. Then the key off the rack, and look at the fob before it goes across the counter.', ok(T, 'Got it.'))),
    reply('The machines -- walk me through it again.', () => say(j, 'Open a machine and it shows you what\'s out. The supply room is the steel door by the laundry, and there\'s a shelf for each machine: SODA, SNACKS, SOAP. The top line on each takes what that machine needs. Carry it over and press E on the machine; it loads. Took too much? Put it back: pick it on the shelf, or just G in the supply room. When a machine\'s full, open it, pull the coin box, and ring it in at the register.', [
      reply('Show me the supply room.', () => { T.leadTo(PLACES.supply); return say(j, 'Come on.', ok(T, '(Follow her.)')); }),
      reply('Got it.', () => null),
    ])),
    reply('Something else...', () => moreNode(s, T, j)),
    reply('Nothing. Just making sure you\'re still here.', () => say(j, s.clock.min > Clock.at(25, 0) ? 'Still here. I\'ve been here since 1981. Where would I go?' : 'Still here. Unfortunately for both of us.', ok(T, '(Back to work.)'))),
  ]);
}

function moreNode(s, T, j) {
  return say(j, 'What else?', [
    reply('Somebody on the phone wants to know what room a guest is in.', () => say(j, 'We don\'t give out rooms. Not to family, not to a sister, not to anybody who says it\'s an emergency. Put the call through to the room, or take a message. That\'s the one thing I\'ll fire you for.', ok(T, 'Never give out a room.'))),
    reply('The night audit?', () => say(j, 'At three: F5. It walks you through it: room and tax get posted, then it holds the drawer against the system. If the drawer is off, it\'s off because of something earlier in the night, not something at three. Tear the packet off the printer and put it on my desk.', ok(T, 'F5 at three.'))),
    reply('Wake-up calls?', () => say(j, 'Write the room and the time on the sheet by the phone when they ask. When it comes due, pick up the phone and call the room. A wake-up you forget is a man who misses his job in Shreveport and tells everybody why.', ok(T, 'I call them.'))),
    reply('Where is everything, again?', () => whereNode(s, T, j)),
    reply('Never mind.', () => null),
  ]);
}

function whereNode(s, T, j) {
  const show = (k) => reply(`Show me ${PLACES[k].label}.`, () => { T.leadTo(PLACES[k]); return say(j, 'This way.', ok(T, '(Follow her.)')); });
  return say(j, 'Linen and the supply cabinet are in the back office. Pantry\'s off the breakfast room. The supply room -- vending stock, breakers, tools -- is the steel door at the north end by the laundry, and the ice machine is past it. What do you want to see?', [
    show('linen'), show('pantry'), show('supply'), show('laundry'),
  ]);
}

/* ---------------- "What should I be doing?" ---------------- */
/** What June would do next, and where it is. */
export function nextThing(s, T) {
  const c = s.clock;
  if (s.phone.anyRinging()) return { text: 'The phone. Get the phone.', where: PLACES.desk };
  const front = s.desk.front();
  if (front) return { text: `${front.name.split(' ')[0]} is at the desk. Go on.`, where: PLACES.desk };
  if (s.pendingSale && !s.pendingSale.rung) return { text: 'You\'ve got cash in your hand. Register.', where: PLACES.register };
  const due = s.wakeups.due(c.min);
  if (due.length) return { text: `Wake-up for ${due[0].room}, due now. The desk phone.`, where: PLACES.desk };
  const coins = s.heldAll('vendCoins');
  if (coins.length) return { text: `Those coins -- ${money(coins.reduce((a, b) => a + b.amount, 0))} -- go in the register.`, where: PLACES.register };
  const pack = s.heldOf('vendPack');
  if (pack) return { text: `You've got a ${pack.pack} of ${PRODUCTS[pack.product].label}. It goes in ${MACHINES[PRODUCTS[pack.product].machine].name}.`, where: machinePlace(PRODUCTS[pack.product].machine) };
  const t = s.tasks.open()[0];
  if (t) return { text: `Your notepad says: ${t.text.charAt(0).toLowerCase() + t.text.slice(1)}.`, where: taskPlace(s, t) };
  for (const id of MACHINE_IDS) {
    const tr = s.vending.trouble(id);
    if (tr) return { text: `${MACHINES[id].name.charAt(0).toUpperCase() + MACHINES[id].name.slice(1)}: ${tr}. Supply room first.`, where: s.vending.empties(id).length ? PLACES.supply : machinePlace(id) };
  }
  if (c.past(22, 0) && !s.property.gate.locked) return { text: 'Pool gates. Both of them.', where: PLACES.gate };
  const [obj] = s.objective(true);
  if (obj && obj !== c.period().label) return { text: obj, where: null };
  return { text: 'Nothing, right now. Sit on the stool if you want -- F. When something needs you, you\'ll know. The bell is loud for a reason.', where: null };
}
function taskPlace(s, t) {
  if (t.machine) return t.why === 'empty' ? PLACES.supply : machinePlace(t.machine);
  if (t.room) return roomPlace(t.room);
  if (t.where === 'ice') return PLACES.ice;
  if (t.where === 'laundry') return PLACES.laundry;
  if (t.kind === 'gate') return PLACES.gate;
  if (t.item && ['towels', 'pillow', 'blanket', 'toiletries', 'tp'].includes(t.item)) return PLACES.linen;
  return null;
}
function nextNode(s, T, j) {
  const n = nextThing(s, T);
  const out = [];
  if (n.where) out.push(reply('Show me.', () => { T.leadTo(n.where); return say(j, 'Come on.', ok(T, '(Follow her.)')); }));
  out.push(reply('Got it.', () => null));
  return say(j, n.text, out);
}

/* ---------------- seven o'clock ---------------- */
export function farewellLine(s) {
  const bad = s.stats.wakeMissed + s.stats.privacy + s.stats.wrongKeys;
  return bad ? 'I\'m going home. We\'ll talk about the list tomorrow. You did the rest all right.' : 'I\'m going home. Tomorrow night it\'s just you. You\'ll be fine. Don\'t tell anybody I said so.';
}

export { SPOTS };
