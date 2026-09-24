/* ============================================================
   cast.js -- the people you get to know.

   Anybody on the property can be talked to. Most of the time it is
   a line or two -- a man on the walk with a cigarette, a woman at
   the ice machine -- and that is the job too: being the person in
   the building who is awake and says good evening back. Some of
   them are regulars and remember you; a few will turn up tomorrow
   night and say so.

   Also here: the visits (Tammy on her break, the deputy on his
   rounds, the man who ordered a pizza), the door (knocking with
   towels, fixing the television, asking the kids upstairs to stop
   jumping), and the staff: Luz, who runs housekeeping, and Travis,
   who takes the desk at seven and asks if it was a quiet night.
   ============================================================ */
import { say, reply, beat, money } from './runner.js';
import { withYou } from '../content/lines.js';
import { makeItem } from '../sim/items.js';
import { Clock } from '../sim/clock.js';

const end = () => null;
const ok = (label = 'Good night.') => [reply(label, end)];

/* ============================================================
   JUST TALKING
   ============================================================ */
export function chatNode(s, p) {
  const id = p.rosterId;
  const zone = s.g.zoneOf(p);
  const fn = CHAT[id];
  if (fn) { const n = fn(s, p, zone); if (n) return n; }
  if (p.kind === 'staff') return staffNode(s, p);
  if (zone === 'breakfast') return say(p, s.rng.pick(['Morning.', 'Morning. Good coffee. Well. Coffee.', 'Is it always this busy? It\'s six-fifteen.', 'Do you know if it\'s supposed to rain toward Shreveport?']), ok('Morning.'));
  if (p.porch) return say(p, s.rng.pick(['Nice night.', 'Just sitting.', 'Hot one.']), ok());
  if (p.ci && p.ci.stage === 'done') return say(p, s.rng.pick(['Thanks again.', 'Which way\'s the ice?', 'Night.']), [
    reply('Ice is past the pool, north end.', end), reply('Good night.', end),
  ]);
  return say(p, s.rng.pick(['Evening.', 'Hi.', 'Hey there.']), ok('Evening.'));
}

const CHAT = {
  EARL(s, p, zone) {
    if (zone === 'breakfast' || s.clock.past(5, 30)) {
      const q = s.breakfast.quality('coffee');
      const fresh = q.age === 'fresh' && q.strength === 'normal';
      return say(p, 'Is the coffee fresh?', [
        reply('Fresh. I just made it.', () => {
          if (fresh) { s.memory.flag('EARL', 'coffeeTruth'); s.memory.opinion('EARL', 1); return say(p, 'You\'re learning.', ok('Morning, Mr. Maddox.')); }
          s.memory.flag('EARL', 'coffeeLie'); s.memory.opinion('EARL', -2); s.stats.lies++;
          return say(p, q.age === 'empty' ? 'Kid. The pot is empty. I can see the pot.' : '(sips) Kid. Don\'t lie to a man about coffee. It\'s the one thing I\'ve got left that I can trust.', ok('Sorry.'));
        }),
        reply(q.age === 'empty' ? 'There isn\'t any yet -- I\'m on it.' : `Honestly? It's been sitting ${q.minutes} minutes.`, () => {
          s.memory.flag('EARL', 'coffeeTruth'); s.memory.opinion('EARL', 1);
          return say(p, q.age === 'fresh' || q.age === 'ok' ? 'That\'s honest. Honest coffee I can work with.' : 'Then I\'ll wait for a new one. I\'ve got till six-thirty. Tell me when.', ok('I\'ll make a fresh pot.'));
        }),
      ]);
    }
    if (p.inRoom || p.asleep) return null;
    return say(p, withYou(s, p) > 0 ? 'Kid. Quiet night so far?' : 'You like it here? The night shift?', [
      reply('So far.', () => say(p, 'It gets quieter. Then about five it gets loud all at once. Make the coffee before the loud.', ok())),
      reply('Still learning.', () => say(p, 'Everybody\'s still learning. I\'ve been selling fryers since Carter. Still learning. Last week a man in Leesville bought two. Nobody needs two fryers.', ok())),
    ]);
  },
  HOLLIS(s, p) {
    if (!p.porch) return say(p, 'Evening.', ok('Evening, Mr. Tate.'));
    const n = (p.chats = (p.chats || 0) + 1);
    if (n === 1) return say(p, withYou(s, p) > 0 ? 'There he is. Sit down if you want. There\'s no second chair. Sit on the rail.' : 'You\'re the new one. Hollis. 102. I been in 102 since June. Before that I was in a Kenworth for forty years, so this is roomy.', [
      reply('Forty years driving?', () => say(p, 'Forty-one. Two million miles, give or take. I never saw the Grand Canyon. Drove past it twice. Had a load both times.', [
        reply('You could go now.', () => say(p, '(thinks about it for a long time) ...I could. Huh. I could. Well. Maybe after Christmas.', ok())),
        reply('That\'s a lot of road.', () => say(p, 'It\'s all the same road. It just changes its name at the state line.', ok())),
      ])),
      reply('Good night, Mr. Tate.', end),
    ]);
    return say(p, s.rng.pick(['My daughter\'s in Tulsa. Calls Sundays. It\'s Thursday. I\'m just saying it\'s Thursday.', 'See the fella with the van with the antennas? Weather man. Thinks there\'s a storm coming. There\'s always a storm coming.', 'You get used to the highway. Then one night it stops for a minute and you sit straight up in bed.']), ok());
  },
  ABERNATHY(s, p) {
    return say(p, s.rng.pick([
      'I just like to hear the ice machine, dear. It sounds like somebody\'s home.',
      'Walter always said never trust a motel that doesn\'t have a pool. This one has a pool. Nobody\'s been in it since August. But it has one.',
      'The couple in the minivan had a disagreement about a Garfield. I don\'t know which side I\'m on.',
      'Do you know the young man with the magic? He found a quarter behind my ear. He\'s a nice boy. It was my quarter.',
    ]), ok('Good night, Mrs. Abernathy.'));
  },
  WEXLER(s, p, zone) {
    if (zone === 'breakfast') return say(p, s.memory.d.signFixed ? 'I noticed the sign. Thank you. You have done a small good thing, and small good things are the only kind anybody gets to do.' : 'Good morning. I see the apostrophe persists.', ok('Morning, Mr. Wexler.'));
    return say(p, 'Good evening.', ok('Good evening, Mr. Wexler.'));
  },
  URN(s, p) {
    if (p.flags.talked) return say(p, 'He\'d have liked it here. He liked anywhere with a pool and a vending machine.', ok());
    p.flags.talked = true;
    return say(p, '(She is sitting on a lounger by the pool with the urn in her lap.) Oh -- hi. I know. It\'s closed. We\'re just sitting.', [
      reply('Take all the time you want.', () => say(p, 'Thank you. He used to sit by the pool at every motel, every trip. Forty-four years of motel pools. He said it was the only time a pool was quiet.', [
        reply('What was he like?', () => say(p, 'He talked to everybody. He\'d have asked you where you were from and what your dad did and whether you liked the work. He\'d have told you about his carburetor. You\'d have liked him. People did.', [
          reply('I think I would have.', () => { s.memory.flag('URN', 'kind'); p.mood += 10; return say(p, '(smiles at the pool) Frank, the night man says he would have liked you. ...He says likewise.', ok()); }),
        ])),
        reply('Good night, Mrs. Haskins.', end),
      ])),
      reply('The pool\'s actually closed after ten -- county rule.', () => { p.mood -= 5; return say(p, 'Oh. Of course. We\'ll go in.', ok('Sorry.')); }),
    ]);
  },
  STORM(s, p) {
    if (s.clock.past(5, 0)) return say(p, 'Look at it! LOOK at it. That\'s a shelf cloud. That\'s a textbook shelf cloud. I\'ve been chasing that since Tuesday and it came to me.', [
      reply('It\'s just rain, isn\'t it?', () => say(p, 'Just rain. JUST rain. Man, it\'s ALL just rain. That\'s the beautiful part.', ok('Good luck.'))),
      reply('It\'s something, all right.', () => say(p, 'It\'s something all right! You get it. You\'re a weather person. I knew it when I walked in.', ok('I\'m a night clerk.'))),
    ]);
    return say(p, 'You feel that? Pressure\'s dropping. Something\'s coming through around five. Keep an eye on the west.', ok('I will.'));
  },
  MAGIC(s, p) {
    return say(p, 'Pick a card.', [
      reply('(Pick a card.)', () => say(p, '(You pick the seven of diamonds. He does not look at it.) Put it back. Shuffle. ...Now. Check your shirt pocket.', [
        reply('(Check your shirt pocket.)', () => say(p, '(It is the three of clubs.) ...Hm. That\'s not it. That\'s from Tuesday. Keep it.', ok('Thanks, I guess.'))),
      ])),
      reply('I\'m on the clock.', () => say(p, 'So is everybody. So is the rabbit. Good night.', ok())),
    ]);
  },
  ENCYC(s, p) {
    return say(p, 'Young man. Does the Starlite Motor Lodge have an encyclopedia? For the guests?', [
      reply('We have a phone book.', () => say(p, 'A phone book. (He closes his eyes.) A phone book is a list of people. An encyclopedia is a list of everything else.', ok())),
      reply('How much for one volume?', () => say(p, 'For you? Volume M, five dollars. It\'s the heaviest. You get the most encyclopedia per dollar.', [
        reply('I\'ll think about it.', () => say(p, 'That\'s all I ask. You can\'t smell a CD-ROM. Think about that too.', ok())),
      ])),
    ]);
  },
  OTIS(s, p) {
    return say(p, 'That video place charged me six dollars for a late tape.', [
      reply('I don\'t work there.', () => { s.flags.videoLine = true; return say(p, 'I know. I\'m just saying.', ok()); }),
      reply('Six dollars?', () => say(p, 'Six. For one day. I told the young man I\'d been coming there since it was a Western Auto. He said "okay."', ok())),
    ]);
  },
  VERNA(s, p, zone) {
    if (zone === 'breakfast') {
      const t = s.breakfast.trays;
      const lines = [];
      if (t.pastry < 6) lines.push(`There are ${t.pastry} muffins. There ought to be more than ${t.pastry} muffins at six in the morning.`);
      if (s.breakfast.coffee.decaf.level <= 0.02) lines.push('The decaf is empty. The decaf is always empty. People assume nobody drinks decaf. Somebody drinks decaf.');
      if (s.breakfast.juice.level < 0.3) lines.push('The juice is low, and I believe it has been watered.');
      if (!lines.length) lines.push('Everything\'s in order. I counted. You\'d be surprised what I count.');
      return say(p, lines[0], ok('Yes ma\'am.'));
    }
    return say(p, 'Is it always this loud? The highway.', [reply('All night, I\'m afraid.', () => say(p, 'Well. At least it\'s consistent.', ok()))]);
  },
  PILLOWS(s, p) {
    return say(p, 'Good evening.', [
      reply('Can I ask about the pillows?', () => say(p, 'You can ask.', [reply('...Good night, Mr. Lowery.', () => say(p, 'Good night.', ok('...')))])),
      reply('Good night.', end),
    ]);
  },
  KYLE(s, p) {
    return say(p, s.rng.pick(['You ever redo a bathroom? Don\'t.', 'The house is going to be great. Everybody says. It\'s going to be great.', 'Dana\'s not mad. She\'s just -- she\'s quiet in a way that has walls.']), ok());
  },
  DANA(s, p, zone) {
    if (zone === 'breakfast' && s.flags.breakerReset) return say(p, 'He tripped the breaker last night, didn\'t he. The shop vac. At midnight. In a motel.', ok('I couldn\'t possibly say.'));
    return say(p, 'Hi. Sorry. Hi.', ok());
  },
  DARNELL(s, p) {
    if (s.g.zoneOf(p) === 'laundry' && !p.flags.quarters) {
      return say(p, 'You got change for a five? The machine takes quarters and I got every kind of money but quarters.', [
        reply('Sure -- I\'ll get you a roll from the drawer.', () => {
          p.flags.quarters = true; s.memory.opinion('DARNELL', 1);
          s.tasks.add({ kind: 'change', who: p.id, text: 'Quarters for Mr. Pike (laundry)', item: 'coinBag', where: 'laundry' });
          return say(p, 'Appreciate you. I\'ll be here. I\'ll be here a while.', ok());
        }),
        reply('Sorry -- I can\'t open the drawer for change.', () => { p.flags.quarters = true; return say(p, 'All right. I\'ll run it tomorrow.', ok()); }),
      ]);
    }
    return say(p, s.clock.past(4, 30) ? 'Coffee on?' : 'Evening.', ok());
  },
  BUDDY(s, p) {
    if (s.clock.past(4, 0)) return say(p, 'Morning. Thanks for the call. Boys are loading up.', ok('Be safe out there.'));
    return say(p, 'Evening. Boys are down for the count. Four-thirty on the wake-up.', ok());
  },
  PRUITT(s, p, zone) {
    if (zone === 'breakfast') return say(p, 'Is the waffle iron supposed to smoke? Tyler says it\'s supposed to smoke.', ok('It is not.'));
    return null;
  },
  CONNIE(s, p) { return say(p, 'Any chance there\'s coffee before six? I\'m on the road at six-fifteen.', ok('I\'ll have a pot on by quarter till.')); },
  TAMMY(s, p) { return visitNode(s, p); },
  DEPUTY(s, p) { return visitNode(s, p); },
};

/* ============================================================
   VISITS -- people who come by the desk and are not staying
   ============================================================ */
export function visitNode(s, p) {
  const id = p.rosterId || p.visitId;
  if (id === 'TAMMY') return tammy(s, p);
  if (id === 'DEPUTY') return deputy(s, p);
  if (id === 'GORDY') return gordy(s, p);
  if (id === 'WEXLER') return wexlerSign(s, p);
  if (id === 'KYLE') return kyleBreaker(s, p);
  return say(p, 'Just stopping in.', ok());
}

function tammy(s, p) {
  const seen = s.memory.guest('TAMMY').withYou;
  const leave = () => { s.finishDesk(p, 'visit'); return null; };
  return say(p, seen > 0
    ? 'Hey, hon. On my break. Peg sent pie again. Peg thinks everybody on nights is starving. She\'s right, but still.'
    : 'Hey, hon. You\'re the new night man. Tammy. From Peg\'s, across the road. I\'m on my break -- Peg sent pie. Peg sends pie to everybody she feels sorry for. Don\'t take it personal.', [
    reply('Thank you. What kind?', () => {
      s.memory.flag('TAMMY', 'tookPie');
      return say(p, 'Chess. It\'s always chess on Thursday. Earl Maddox in tonight? He eats at Peg\'s every Thursday, sits at the counter, orders the catfish and complains about it. Twelve years.', [
        reply('He\'s in. 105.', () => { s.stats.privacy += 0; return say(p, 'Course he is. Tell him the catfish misses him.', [
          reply('Ray come by the diner tonight?', () => say(p, 'Ray comes by at two for pie. You could set a clock. Ray\'s a sweetheart. Ray\'s been single since the flood.', [reply('Good night, Tammy.', leave)])),
          reply('Good night, Tammy.', leave),
        ]); }),
        reply('I\'m not supposed to say who\'s staying here.', () => { s.memory.opinion('TAMMY', 1); s.stats.privacyKept++; return say(p, '(laughs) Look at you. Rules. June hired a good one. That\'s his Buick out there, hon. I can see it from the grill.', [reply('Good night, Tammy.', leave)]); }),
      ]);
    }),
    reply('I\'m fine, thanks -- tell Peg thank you.', () => say(p, 'I\'ll leave it right here. You\'ll want it at three. Everybody wants pie at three.', [reply('Good night, Tammy.', leave)])),
  ]);
}

function deputy(s, p) {
  const leave = () => { s.finishDesk(p, 'visit'); return null; };
  const storm = s.npcs.find('STORM');
  return say(p, 'Evening. Ray Sills. Just making the rounds -- I stop in, I use the facilities, I have a cup of whatever you got. Anything I ought to know about?', [
    reply('Quiet night. Nothing to report.', () => say(p, 'That\'s what I like to hear. Quiet\'s the job. Front\'s coming through around five, they say. Tie down anything that likes to blow around.', [reply('Will do.', leave)])),
    ...(storm && storm.room ? [reply('There\'s a van in the lot with antennas on it -- a storm chaser.', () => say(p, 'Oh, I saw it. I thought it was Channel 6. I almost waved.', [reply('Good night, Deputy.', leave)]))] : []),
    reply('The drink machine keeps eating people\'s money.', () => say(p, 'That\'s not a police matter. But I\'ll say, that machine took a dollar off me in 1994. I have not forgotten.', [reply('Good night, Deputy.', leave)])),
  ]);
}

function gordy(s, p) {
  const leave = () => { s.finishDesk(p, 'visit'); return null; };
  return say(p, 'I\'m here for the pepperoni. Gordy.', [
    reply('Sir, this is a motel.', () => say(p, '(looks around the lobby, slowly: the rate card, the rack of keys, the breakfast room, you) ...Huh. It sure is.', [
      reply('Peg\'s is across the road. They\'ll make you a sandwich.', () => say(p, 'A sandwich. (He weighs this.) All right. All right. That\'s not nothing.', [reply('Good night.', leave)])),
    ])),
  ]);
}

function wexlerSign(s, p) {
  const leave = () => { s.finishDesk(p, 'visit'); return null; };
  if (s.memory.d.signFixed) return say(p, 'Good evening. I only came down to look at the sign. (He looks at it.) Good. Good night.', [reply('Good night, Mr. Wexler.', leave)]);
  const again = s.memory.hasFlag('WEXLER', 'signAsked');
  s.memory.flag('WEXLER', 'signAsked');
  return say(p, again
    ? 'Good evening. I see the sign remains. I raise it again only because I would like to die in a world with one fewer apostrophe in it.'
    : 'Good evening. Harold Wexler, 205. Forgive me. The sign on the front of your desk. "No pet\'s." The apostrophe. It is not a possessive -- the pets do not own the prohibition. It has troubled me for six years.', [
    reply('I\'ll fix it tonight.', () => {
      s.tasks.add({ kind: 'sign', text: 'Fix the NO PET\'S sign (marker, front of the desk)', where: 'sign' });
      s.memory.opinion('WEXLER', 1);
      return say(p, 'You are a young man of rare character. There is a marker in every desk drawer in America.', [reply('Good night, Mr. Wexler.', leave)]);
    }),
    reply('The owner made that sign.', () => say(p, 'Then the owner is wrong, and she is wrong in public, in red letters. Good night.', [reply('Good night, Mr. Wexler.', leave)])),
  ]);
}

function kyleBreaker(s, p) {
  const leave = () => { s.finishDesk(p, 'visit'); return null; };
  return say(p, 'Hey. So. The power\'s out in our room. Just ours. I was -- okay, I had the shop vac going. It\'s a long story. There was a spill in the truck. Dana\'s sitting in the dark. She\'s not saying anything. That\'s worse.', [
    reply('The breakers are in the maintenance room. I\'ll reset it.', () => {
      s.tasks.add({ kind: 'breaker', room: p.room, who: p.id, text: `Reset the breaker for ${p.room} (maintenance room)`, where: 'maint' });
      return say(p, 'You know breakers? How many is normal? Ours has twenty-two. Lloyd says twenty-two is a lot.', [reply('Twenty-two is a lot.', leave)]);
    }),
  ]);
}

/* ============================================================
   THE DOOR: knocking, delivering, fixing
   ============================================================ */
export function doorNode(s, p, task) {
  const pl = s.g.player;
  if (!task) return say(p, p.asleep ? '(through the door, thick with sleep) ...Yeah? What?' : '(opens the door a crack) Yes?', [
    reply('Sorry -- wrong door. Good night.', () => { p.mood -= 3; return null; }),
  ]);
  switch (task.kind) {
    case 'deliver': {
      const have = s.heldAll(task.item).length;
      const need = task.qty || 1;
      if (!have) return say(p, '(opens the door) Oh -- hi. Did you bring the ' + itemWord(task.item) + '?', [reply('I\'ll be right back with them.', end)]);
      return say(p, '(opens the door) Oh -- hi.', [reply(`Here you go -- ${need > 1 ? `${Math.min(have, need)} ` : ''}${itemWord(task.item)}.`, () => {
        const give = Math.min(have, need);
        for (let i = 0; i < give; i++) s.removeHeld(s.heldOf(task.item));
        s.g.sound.cloth();
        task.given = (task.given || 0) + give;
        if (task.given < need) return say(p, `That's ${task.given}. I asked for ${need}.`, [reply('The rest are coming.', end)]);
        s.tasks.complete(task);
        p.mood += 4;
        if (task.pillowAsk !== undefined) return pillowThanks(s, p, task);
        return say(p, s.rng.pick(['Thank you so much.', 'You\'re a lifesaver.', 'Great. Thanks. Good night.']), ok());
      })]);
    }
    case 'fix':
      return say(p, `(opens the door) Oh, good. Come on in -- it's the ${fixWord(task.fix)}.`, [reply('(Go in and take a look.)', () => { s.letIn(p, task); return null; })]);
    case 'noise':
      return say(p, noiseAnswer(p), [
        reply('Sorry to bother you -- the room next door says it\'s a little loud.', () => { s.tasks.complete(task); p.quiet = true; s.quietDown(p); return say(p, 'Oh -- sorry. Sorry! We\'ll keep it down.', ok()); }),
      ]);
    case 'message':
      return say(p, '(opens the door) Yes?', [reply(`There was a call for you. ${task.message}`, () => { s.tasks.complete(task); p.mood += 3; return say(p, p.rosterId === 'URN' ? 'My daughter. She worries. ...Thank you. I\'ll call her now. I\'ll call her from the room.' : 'Oh. Thank you.', ok()); })]);
    case 'breaker':
      return say(p, 'Is it -- is the power coming back? Dana wants to know. Dana isn\'t asking. I\'m asking for Dana.', [reply('I\'m on my way to the breaker panel.', end)]);
    default:
      return say(p, '(opens the door) Hi?', ok());
  }
}
const itemWord = (k) => ({ towels: 'towels', pillow: 'pillows', blanket: 'blanket', batteries: 'batteries', toiletries: 'soap and shampoo', tp: 'toilet paper', bulb: 'bulb', iron: 'iron' }[k] || k);
const fixWord = (f) => ({ tv: 'TV', toilet: 'toilet', faucet: 'faucet', ac: 'air conditioner', lamp: 'lamp' }[f] || f);
function noiseAnswer(p) {
  if (p.rosterId === 'PRUITT') return '(the door opens on chaos: a bed with no sheets on it, a child standing on the other bed) Sorry. Sorry. They got a second wind.';
  if (p.kind === 'crew') return '(a TV going loud, somebody laughing) Hey man -- sorry, sorry.';
  return '(opens the door) Yeah?';
}
function pillowThanks(s, p, task) {
  if (task.pillowAsk === 2) {
    s.memory.flag('PILLOWS', 'nine');
    return say(p, '(He takes the last four pillows. Behind him the room looks perfectly ordinary. The bedspread is smooth. There is no sign of the other five.) Thank you. That will be all.', ok('...Good night, Mr. Lowery.'));
  }
  return say(p, 'Thank you very much.', ok());
}

/* ============================================================
   THE STAFF
   ============================================================ */
export function staffNode(s, p) {
  if (p.rosterId === 'LUZ') return luz(s, p);
  if (p.rosterId === 'TRAVIS') return travis(s, p);
  return say(p, 'Morning.', ok('Morning.'));
}

function luz(s, p) {
  if (p.flags.briefed) return say(p, 'I got it, mijo. Go home soon.', ok('Thanks, Luz.'));
  const dirty = s.rooms.all().filter((r) => r.status === 'VD').map((r) => r.no);
  const stay = s.rooms.all().filter((r) => r.status === 'OC').map((r) => r.no);
  return say(p, `Morning. What have I got? I see ${dirty.length ? `${dirty.length} dirty on the board -- ${dirty.slice(0, 6).join(', ')}${dirty.length > 6 ? '...' : ''}` : 'nothing dirty on the board yet'}, and ${stay.length} stayovers.`, [
    reply('That\'s right.', () => { p.flags.briefed = true; s.luzBriefed(dirty); return say(p, luzAside(s), ok('Thanks, Luz.')); }),
    reply('Some of those checked out -- I haven\'t flipped the tabs yet.', () => {
      p.flags.briefed = true; s.stats.luzWaited++;
      s.luzBriefed(dirty, true);
      return say(p, 'Then flip them, mijo. I don\'t clean what\'s not on the board. Thirty-one years, I don\'t clean what\'s not on the board.', ok('Flipping them now.'));
    }),
  ]);
}
function luzAside(s) {
  if (s.memory.hasFlag('PILLOWS', 'nine') && s.flags.pillowsOut) return 'The man in the pillows room checked out? Nine pillows on the bed. Made. Stacked. Like a cake. I don\'t ask. Thirty-one years, I don\'t ask.';
  if (s.flags.smokedInNon) return `Somebody smoked in ${s.flags.smokedInNon}. I can smell it from here. June is going to have a feeling about it.`;
  return 'Good. Go get coffee before the Pruitt kids get the waffle machine.';
}

function travis(s, p) {
  if (!s.clock.past(6, 50)) return say(p, 'Hey. I\'m early. Don\'t tell anybody. I\'m going to sit in my car and finish this coffee.', ok('Morning, Travis.'));
  return handoffNode(s, p);
}

/** Seven in the morning. The other clerk comes in and asks the question. */
export function handoffNode(s, p) {
  const st = s.stats;
  const busy = st.checkins + st.calls + st.tasksDone;
  const finish = () => { s.endShift(); return null; };
  return say(p, 'Morning. Quiet night?', [
    reply('Quiet.', () => say(p, busy > 18 ? '(looks at the check-in cards, the wake-up sheet, the notepad, the waffle iron) ...Sure. Okay. Quiet.' : 'Nice. Nice. I love a quiet night. I had a quiet night in August. Anything I should know?', handoffChoices(s, p, finish))),
    reply('Not exactly.', () => say(p, 'Yeah, it\'s never exactly. Anything I should know?', handoffChoices(s, p, finish))),
    reply('Define quiet.', () => say(p, '(sips his coffee) That bad, huh. Anything I should know?', handoffChoices(s, p, finish))),
  ]);
}
function handoffChoices(s, p, finish) {
  const out = [];
  const open = s.ledger.folios.filter((f) => f.open && f.departed);
  if (open.length) out.push(reply(`${open.map((f) => f.room).join(', ')} left but I didn't check them out in the system.`, () => say(p, 'I\'ll run them. That\'s why they pay me the big money. Six an hour.', [reply('Thanks, Travis.', finish)])));
  const late = s.tasks.open();
  if (late.length) out.push(reply(`There's a couple things on the notepad I didn't get to -- ${late[0].text.toLowerCase()}.`, () => say(p, 'Got it. I\'ll get Luz on it, or I\'ll do it, or it\'ll become a whole thing. One of those.', [reply('Thanks, Travis.', finish)])));
  out.push(reply('The waffle iron. That\'s all I\'ll say.', () => say(p, 'The waffle iron. Yeah. Go home. Go to bed. You look like the waffle iron.', [reply('Night, Travis. Morning. Whichever.', finish)])));
  out.push(reply('You\'re all set. Go get \'em.', () => say(p, 'Go home. Sleep. Come back tonight and do it again, huh?', [reply('See you tonight.', finish)])));
  return out.slice(0, 4);
}

export { Clock, money, makeItem, beat };
