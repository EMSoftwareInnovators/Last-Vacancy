/* ============================================================
   calls.js -- who calls the front desk, and what they want.

   The phone is half the job. Rooms call for towels and batteries
   and to say the television is snow. People call from the road to
   ask the rate and whether you take dogs. Somebody's daughter calls
   looking for her mother, and somebody's sister calls looking for a
   woman who asked you, specifically, to say she is not here.

   Privacy is the rule under all of it: you do not tell a caller who
   is staying here or in what room. You can put them through. You
   can take a message. You do not say "Room 106."

   A call is { id, from, who, room?, script(s, call) -> node }.
   ============================================================ */
import { say, reply, money } from './runner.js';
import { Clock } from '../sim/clock.js';
import { nightly, withTax } from '../sim/ledger.js';

const voice = (name, pitch = 1, rough = 0.2) => ({ name, pitch, rough });
const end = () => null;

/* ============================================================
   ROOM CALLS -- a guest, on the room phone
   ============================================================ */
export const ROOM_CALLS = {
  towels: {
    text: (p) => (p.stay && p.stay.party > 2 ? 'Hi, this is -- we\'re in the room. Could we get some more towels? The kids used all of them on the floor. For a reason. There was a reason.' : 'Hi. Could I get a couple more towels? There\'s one and it\'s -- it\'s more of a washcloth that\'s been stretched.'),
    task: { kind: 'deliver', item: 'towels', text: 'Towels' },
  },
  pillow: {
    text: () => 'Hi, front desk? Could I get an extra pillow? The ones in here are sort of... flat. Like they gave up.',
    task: { kind: 'deliver', item: 'pillow', text: 'A pillow' },
  },
  blanket: {
    text: () => 'Is there any way to get another blanket? The air unit only has one setting and it\'s "Minnesota."',
    task: { kind: 'deliver', item: 'blanket', text: 'A blanket' },
  },
  batteries: {
    text: () => 'The remote doesn\'t work. I think it\'s the batteries. I took them out and licked them, which I know is not a real test.',
    task: { kind: 'deliver', item: 'batteries', text: 'Batteries for the remote' },
  },
  tv: {
    text: (p, s, room) => (room === '201' ? 'The TV\'s -- no, it\'s fine. Actually it\'s great. I just wanted to tell somebody. We get a station from Monterrey.' : 'The TV\'s just snow. Every channel. I hit it on the side like you\'re supposed to and it went snow-er.'),
    task: { kind: 'fix', fix: 'tv', text: 'Look at the TV' },
    skipIf: (room) => room === '201',
  },
  toilet: {
    text: () => 'Hi, um. The toilet won\'t stop running. It\'s not an emergency. It\'s a very steady non-emergency.',
    task: { kind: 'fix', fix: 'toilet', item: 'plunger', text: 'Fix the toilet (bring the plunger)' },
  },
  drip: {
    text: () => 'The faucet in the bathroom drips. It\'s not loud. I\'m just the kind of person who can hear it.',
    task: { kind: 'fix', fix: 'faucet', text: 'Look at the dripping faucet' },
  },
  ac: {
    text: () => 'The air conditioner makes a noise like a truck downshifting. Is there -- is there a trick to it?',
    task: { kind: 'fix', fix: 'ac', text: 'Look at the air conditioner' },
  },
  bulb: {
    text: () => 'The lamp by the bed\'s out. I tried the switch four ways. It\'s the bulb, I think. Or the lamp has made a decision.',
    task: { kind: 'fix', fix: 'lamp', item: 'bulb', text: 'Replace the lamp bulb' },
  },
  toiletries: {
    text: () => 'Could I get some shampoo? There\'s the little soap but the shampoo\'s just -- the bottle\'s there but it\'s empty. Somebody drank it. I\'m kidding. I hope I\'m kidding.',
    task: { kind: 'deliver', item: 'toiletries', text: 'Soap and shampoo' },
  },
};

/** A guest calls down about something in the room. */
export function roomCall(s, p, kind) {
  const R = ROOM_CALLS[kind];
  const room = p.room;
  return {
    from: 'room', room, who: { name: `ROOM ${room}`, app: p.app, person: p }, kind, person: p,
    ringFor: 32, patience: 40,
    onMissed: () => s.guestComesDown(p, { kind: R.task.kind, item: R.task.item, text: `I called. Nobody answered. ${R.text(p, s, room)}`, task: `${R.task.text} to ${room}`, fix: R.task.fix }),
    script: (sh, call) => say(call.who, R.text(p, s, room), [
      reply(R.task.kind === 'deliver' ? 'I\'ll bring some right over.' : 'I\'ll come take a look.', () => {
        s.tasks.add({ kind: R.task.kind, fix: R.task.fix, item: R.task.item, room, who: p.id, text: `${R.task.text} -- ${room}`, due: s.clock.min + 30 });
        p.mood += 2;
        return say(call.who, 'Thank you. Thanks.', [reply('(Hang up.)', end)]);
      }),
      ...(R.task.kind === 'deliver' ? [reply('Housekeeping comes at seven -- can it wait till then?', () => {
        p.mood -= 8;
        return say(call.who, '...Seven. In the morning. Okay. Sure.', [reply('(Hang up.)', end)]);
      })] : [reply('Maintenance will be in the morning -- I\'m sorry.', () => {
        p.mood -= 6; s.stats.putOff++;
        s.rooms.get(room).issues.add(R.task.fix);
        return say(call.who, 'In the morning. Right. Okay.', [reply('(Hang up.)', end)]);
      })]),
    ]),
  };
}

/* ---------------- the man in the pillows ---------------- */
const PILLOW_ASKS = [
  { n: 1, text: 'Good evening. This is Gene Lowery, in {room}. Could I trouble you for an extra pillow? One is fine.' },
  { n: 2, text: 'Hello again. Gene Lowery, {room}. I\'m sorry to bother you. Could I get two more pillows? Two.' },
  { n: 4, text: 'It\'s Gene Lowery. In {room}. I realize this is the third time. I would need four more pillows. I understand if that\'s a problem. It isn\'t a problem for me.' },
];
export function pillowCall(s, p, i) {
  const A = PILLOW_ASKS[i];
  const room = p.room;
  return {
    from: 'room', room, who: { name: `ROOM ${room}`, app: p.app, person: p }, kind: 'pillow', person: p, ringFor: 40, patience: 60,
    onMissed: () => { p.flags.pillowMissed = true; },
    script: () => say({ name: `ROOM ${room}` }, A.text.replace('{room}', room), [
      reply(A.n === 1 ? 'I\'ll bring one right over.' : `${A.n === 2 ? 'Two' : 'Four'} more. I'll bring them over.`, () => {
        s.tasks.add({ kind: 'deliver', item: 'pillow', qty: A.n, room, who: p.id, text: `${A.n} pillow${A.n > 1 ? 's' : ''} -- ${room}`, pillowAsk: i });
        return say({ name: `ROOM ${room}` }, 'Thank you very much.', [reply('(Hang up.)', end)]);
      }),
      ...(i > 0 ? [reply('Can I ask what they\'re for?', () => {
        p.flags.askedWhy = true;
        return say({ name: `ROOM ${room}` }, i === 1 ? 'It\'s a personal matter. Nothing unusual.' : 'I\'d rather not go into it. It\'s not a problem. It\'s a preference.', [
          reply('Of course. I\'ll bring them over.', () => { s.tasks.add({ kind: 'deliver', item: 'pillow', qty: A.n, room, who: p.id, text: `${A.n} pillows -- ${room}`, pillowAsk: i }); return null; }),
        ]);
      })] : []),
    ]),
  };
}

/* ============================================================
   OUTSIDE CALLS
   ============================================================ */
export const OUTSIDE_CALLS = [
  {
    id: 'rates', weight: 1.4, when: [19 * 60 + 10, 24 * 60],
    make: (s) => {
      const who = voice('OUTSIDE LINE', s.rng.pick([0.9, 1.25]), 0.3);
      const vac = s.rooms.vacantClean().length;
      const rate = withTax(nightly('K', 1, 'RACK'));
      return {
        from: 'outside', who,
        script: () => say(who, 'Yeah, hi, how much is a room? Just one person. We\'re up the road, we\'re deciding between y\'all and the Ramada.', [
          reply(`${money(nightly('K', 1, 'RACK'))} for a single, plus tax -- ${money(rate)}. We have rooms.`, () => {
            if (vac > 0 && s.rng.chance(0.6)) s.director.addWalkIn(40 + s.rng() * 30, 'called ahead');
            return say(who, vac > 0 ? 'The Ramada\'s forty-nine. We\'ll see you in a bit.' : 'Okay. Okay, thanks.', [reply('(Hang up.)', end)]);
          }),
          reply('We\'re about full tonight, honestly.', () => say(who, 'Oh. Okay. Ramada, then.', [reply('(Hang up.)', end)])),
        ]),
      };
    },
  },
  {
    id: 'pets', weight: 1, when: [19 * 60 + 30, 23 * 60],
    make: (s) => {
      const who = voice('OUTSIDE LINE', 1.28, 0.2);
      return {
        from: 'outside', who,
        script: () => say(who, 'Hi! Do y\'all take pets? It\'s a small dog. It\'s a very small dog. You could fit him in a purse. People have.', [
          reply('I\'m sorry -- no pets. It\'s on the sign.', () => say(who, 'Not even -- okay. No, I understand. He does too. He\'s looking at me.', [reply('(Hang up.)', end)])),
          reply('If he\'s small, and quiet, I didn\'t see him.', () => {
            s.flags.petAllowed = true;
            s.director.addWalkIn(25 + s.rng() * 30, 'dog');
            return say(who, 'Oh, bless you. You won\'t see him. Nobody ever sees him.', [reply('(Hang up.)', end)]);
          }),
        ]),
      };
    },
  },
  {
    id: 'wrongPeg', weight: 1, when: [19 * 60, 30 * 60],
    make: (s) => {
      const who = voice('OUTSIDE LINE', 0.8, 0.8);
      return {
        from: 'outside', who,
        script: () => say(who, 'Is this Peg\'s? Is Loretta on tonight?', [
          reply('This is the Starlite. Peg\'s is across the highway.', () => say(who, 'The Starlite. Huh. Well, you\'re right across from Peg\'s. You could holler.', [
            reply('I\'m not going to holler.', () => say(who, 'Fair enough. Fair enough.', [reply('(Hang up.)', end)])),
            reply('(Hang up.)', end),
          ])),
        ]),
      };
    },
  },
  {
    id: 'wrongVet', weight: 0.8, when: [21 * 60, 27 * 60],
    make: (s) => {
      const who = voice('OUTSIDE LINE', 1.2, 0.1);
      return {
        from: 'outside', who,
        script: () => say(who, 'Is this the animal clinic? My goat ate a sock.', [
          reply('This is the Starlite Motor Lodge. I think you want Dr. Fontenot -- he\'s in the book.', () => say(who, 'A motel. At -- okay. Is he going to be all right? The goat.', [
            reply('I\'m sure he\'ll be fine.', () => say(who, 'You\'re sure? Okay. Okay. That helps. Thank you.', [reply('(Hang up.)', end)])),
            reply('I really couldn\'t say. I work at a motel.', () => say(who, 'Right. Right. Sorry.', [reply('(Hang up.)', end)])),
          ])),
        ]),
      };
    },
  },
  {
    id: 'gordy', weight: 0.9, cameo: true, when: [21 * 60 + 30, 24 * 60 + 30],
    make: (s) => {
      const who = voice('OUTSIDE LINE', 0.98, 0.5);
      return {
        from: 'outside', who,
        script: () => say(who, 'Yeah, I\'d like a large pepperoni, extra cheese, for pickup. Name\'s Gordy.', [
          reply('Sir, this is a motel. The Starlite Motor Lodge.', () => say(who, 'Uh huh. How long on the pepperoni?', [
            reply('It\'s a motel. There\'s no pepperoni.', () => say(who, 'Last time I called a number off a magnet it was a video store. Before that, it was a video store. I\'m not an idiot. I dialed the number on the magnet.', [
              reply('What does the magnet say?', () => say(who, '(a pause) ...Starlite Motor Lodge, Delphine, Louisiana, Clean Rooms, Color TV. ...Huh. Where\'d I get this?', [
                reply('(Hang up.)', () => { s.flags.gordyCalled = true; return null; }),
              ])),
              reply('(Hang up.)', () => { s.flags.gordyCalled = true; return null; }),
            ])),
            reply('Twenty minutes.', () => {
              s.flags.gordyCalled = true; s.flags.gordyPromised = true;
              s.director.addVisit('GORDY', 22 + s.rng() * 10);
              return say(who, 'Twenty. Great. I\'ll be there in twenty.', [reply('(Hang up. Think about what you have done.)', end)]);
            }),
          ])),
        ]),
      };
    },
  },
  {
    id: 'reservation', weight: 1, when: [19 * 60 + 20, 23 * 60 + 30],
    make: (s) => {
      const who = voice('OUTSIDE LINE', 1.15, 0.2);
      const name = s.rng.pick(['Theriot', 'Burkhalter', 'Nguyen', 'Delahoussaye', 'Pickering', 'Ybarra']);
      const nextDay = s.rng.pick(['Friday after next', 'next Thursday', 'the twenty-fourth']);
      return {
        from: 'outside', who,
        script: () => say(who, `Hi, I'd like to make a reservation? For ${nextDay}. Two nights, two beds. The name is ${name}.`, [
          reply('Let me write that down. Two queens, two nights. Can I get a card to hold it?', () => {
            s.memory.addReservation({ name, nights: 2, beds: 'QQ', forDay: nextDay, takenShift: s.memory.shiftNo });
            s.stats.reservationsTaken++;
            s.g.sound.pen();
            return say(who, 'Visa. (reads it out, slowly, twice) Thank you, you\'ve been very nice. You\'d be surprised how many people aren\'t.', [reply('We\'ll see you then.', end)]);
          }),
          reply('You\'ll want to call back in the daytime -- the manager does reservations.', () => {
            s.stats.putOff++;
            return say(who, 'Oh. She -- okay. I\'ll call back.', [reply('(Hang up.)', end)]);
          }),
        ]),
      };
    },
  },
  {
    id: 'june', weight: 0, when: [20 * 60 + 40, 21 * 60 + 30], fixed: true,
    make: (s) => {
      const who = voice('JUNE (OWNER)', 1.08, 0.6);
      const earl = s.npcs.find('EARL');
      const earlIn = earl && earl.room;
      const crew = s.ledger.folios.filter((f) => f.account === 'TRIPARISH').length;
      return {
        from: 'outside', who,
        script: () => say(who, `It's June. I'm not checking on you. I'm checking on the motel. ${crew ? 'The paving boys got in?' : 'Did the Tri-Parish boys show up yet?'}`, [
          reply(crew ? `They're in -- ${crew} rooms, downstairs.` : 'Not yet.', () => say(who, `${crew ? 'Good. They\'re good boys. They leave the rooms like a hurricane went through politely.' : 'They will. Buddy called me from Opelousas at six, which means seven-thirty.'} ${earlIn ? `Earl's in ${earl.room === '105' ? '105, good' : `${earl.room}? He'll live`}.` : 'And Earl\'s coming. Earl always comes. Give him 105 or he\'ll talk about it until Christmas.'}`, [
            reply('Anything else?', () => say(who, 'The coffee maker on the left runs hot. Don\'t let the waffle iron alone with anybody under twelve. And if anybody asks about 213 --', [
              reply('It\'s a number.', () => { s.flags.juneImpressed = true; return say(who, 'It\'s a number. People need to get over it. Good night.', [reply('Good night, June.', end)]); }),
              reply('What about 213?', () => say(who, 'Nothing about 213. That\'s my point. It\'s a number. People need to get over it. Good night.', [reply('Good night, June.', end)])),
            ])),
            reply('Got it. Good night, June.', end),
          ])),
        ]),
      };
    },
  },
  {
    id: 'triparish', weight: 0, fixed: true,
    make: (s) => {
      const who = voice('TRI-PARISH PAVING', 0.95, 0.4);
      return {
        from: 'outside', who,
        script: () => say(who, 'Evening, this is Tammy Broussard at Tri-Parish Paving -- not the Tammy from the diner, everybody asks. Just confirming the four rooms for Buddy Guidry\'s crew, direct bill, three nights. They should be there by seven-thirty.', [
          reply('We have them down. Four rooms, three nights, on the account.', () => say(who, 'Wonderful. And they\'re not to make phone calls on the account. Buddy knows. The other three need reminding.', [reply('Got it.', end)])),
        ]),
      };
    },
  },
  {
    id: 'circulation', weight: 0, fixed: true,
    make: (s) => {
      const who = voice('THE DELPHINE LEDGER', 0.85, 0.7);
      return {
        from: 'outside', who,
        script: () => say(who, 'Starlite? Ledger circulation. Driver says he\'s running about twenty minutes behind, press broke down in Alexandria. You\'ll have your twenty-four papers by five-fifteen. Maybe five-twenty.', [
          reply('Thanks for the call.', () => say(who, 'Uh huh. Nobody ever says that.', [reply('(Hang up.)', end)])),
        ]),
      };
    },
  },
];

/* ---------------- somebody asking for a guest ---------------- */
/**
 * The guest-locator call: somebody on the outside asks for somebody on
 * the inside. The right answer is always the same, and the caller is
 * always nice about it, and it is still easy to say the room number.
 */
export function locatorCall(s, target, o = {}) {
  const who = voice(o.header || 'OUTSIDE LINE', o.pitch || 1.15, o.rough || 0.2);
  const guestName = target ? target.name : o.name;
  const noDisclose = target && (target.noDisclose || (target.stay && target.stay.noDisclose));
  const opener = o.opener || `Hi, I'm trying to reach ${guestName}? Is ${guestName.split(' ')[0]} staying there?`;
  const bad = (how) => {
    s.stats.privacy++;
    s.log(`Told a caller ${how} about ${guestName}.`, 'bad');
    if (target) { target.flags.disclosed = true; if (noDisclose) s.director.upsetNoDisclose(target); }
  };
  return {
    from: 'outside', who, target: target ? target.id : null, locator: true, ringFor: 30, patience: 50,
    script: () => say(who, opener, [
      reply('I can\'t give out guest information -- but I can put you through to a room if they\'re here.', () => {
        if (noDisclose) {
          return say(who, 'I don\'t know the room. That\'s the -- can you just tell me if she\'s there? I\'m her sister. I\'m family.', [
            reply('I\'m sorry. I don\'t have anyone by that name.', () => { s.stats.privacyKept++; target.flags.protected = true; return say(who, '...Okay. Okay. If she -- never mind. Thank you.', [reply('(Hang up.)', end)]); }),
            reply('I can take a message, if you like.', () => { bad('she might be here'); return say(who, 'A message. So she is there. Thank you. Thank you so much.', [reply('(Hang up. Oh no.)', end)]); }),
            reply('She\'s in ' + (target.room || '?') + ' -- I\'ll put you through.', () => { bad('the room number'); return transferNode(s, who, target, true); }),
          ]);
        }
        return say(who, o.afterPolicy || 'Oh -- of course. Please.', [
          reply('(Transfer the call...)', () => s.transferPicker(who, target, o)),
          reply('Can I take a message instead?', () => {
            if (target) s.tasks.add({ kind: 'message', room: target.room, who: target.id, text: `Message for ${guestName.split(' ').slice(-1)[0]} (${target.room || '?'}): ${o.message || 'call home'}`, message: o.message || 'Call home.' });
            return say(who, 'Please. Tell them to call. Thank you.', [reply('I\'ll see they get it.', end)]);
          }),
        ]);
      }),
      reply(target && target.room ? `Yes -- they're in ${target.room}.` : 'Let me check... no, nobody by that name.', () => {
        if (target && target.room) { bad('the room number'); return say(who, `${target.room}. Thank you.`, [reply('(Hang up.)', end)]); }
        return say(who, 'Oh. Okay. Thanks.', [reply('(Hang up.)', end)]);
      }),
    ]),
  };
}

function transferNode(s, who, target) {
  return say(who, 'Thank you.', [reply(`(Transfer to ${target.room}.)`, () => { s.completeTransfer(target); return null; })]);
}

/* ============================================================
   CALLING OUT: wake-ups and the rest
   ============================================================ */
const WAKE_ANSWERS = {
  EARL: ['I\'ve been up since four-thirty, kid. But thanks. It\'s nice to be asked.', 'Yep. Up. Is the coffee on?'],
  BUDDY: ['(a long pause) ...Yep. Yep. I\'m up. I\'m up. Boys! (the line goes dead)'],
  CONNIE: ['Thank you. I\'m up. I\'ve been up. I was waiting to see if you\'d call. You called.'],
  DARNELL: ['Appreciate it. Up.'],
  LATENIGHT: ['(nothing, then) ...chickens. Right. Thanks, man. Thanks.'],
};
export function wakeCall(s, w) {
  const p = s.npcs.find(w.who) || null;
  const who = { name: `ROOM ${w.room}`, app: p ? p.app : null };
  const lines = (p && p.rosterId && WAKE_ANSWERS[p.rosterId]) || ['(a groan) ...Yeah. Thanks. What time is it? No. Don\'t tell me.', 'Mm. Okay. Okay. I\'m up. Thank you.', '(fumbling, the phone hits the nightstand) ...hello? Oh. Oh, right. Thanks.'];
  const text = lines[Math.floor(s.rng() * lines.length)];
  return say(who, text, [reply('Good morning. It\'s ' + s.clock.label() + '.', () => { s.wakeDone(w, p); return null; })]);
}

/** June, at home, at an hour June does not appreciate. */
export function callJune(s) {
  const who = voice('JUNE (AT HOME)', 1.08, 0.7);
  const late = s.clock.min > 23 * 60;
  s.stats.calledJune++;
  return say(who, late ? '(six rings) ...Is anything on fire?' : 'Starlite -- oh, it\'s you. What\'s wrong?', [
    reply('No -- nothing\'s on fire.', () => say(who, late ? 'Then write it down, and leave it on my desk, and go back to work. Good night.' : 'Then handle it. You can handle it. That\'s why I hired you. Good night.', [reply('Good night, June.', end)])),
    reply('I just wanted to check about something.', () => say(who, 'Does the something have a guest attached to it who is yelling?', [
      reply('No.', () => say(who, 'Then it\'ll keep till morning. Write it on my note. Good night.', [reply('Good night.', end)])),
    ])),
  ]);
}

export { voice, Clock };
