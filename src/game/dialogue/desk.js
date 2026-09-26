/* ============================================================
   desk.js -- conversations across the front desk.

   The check-in is the job. It is a conversation (what do you
   need, how many, how long, how are you paying), then the
   terminal (type it in, pick a room), then money changing hands
   for real (bills to the register and change back, a card through
   the imprinter and a slip to sign, a voucher checked against the
   binder), then a key off the rack and across the counter. Every
   step is something you do, and every step can go a little wrong
   in a way somebody notices later.

   Checkouts, weekly rent, complaints and the man whose drink the
   machine kept are here too.
   ============================================================ */
import { say, reply, beat, money, round2 } from './runner.js';
import { lineFor, withYou, nightsWord } from '../content/lines.js';
import { ACCOUNTS, withTax, nightly } from '../sim/ledger.js';
import { BED_LABEL } from '../world/layout.js';
import { Clock } from '../sim/clock.js';
import { makeItem } from '../sim/items.js';
import { PRODUCTS, MACHINES } from '../sim/vending.js';

const YOU = { name: 'YOU' };
const L = (s, p, k, ...a) => lineFor(p, k, s, ...a);
const q = (text) => text;

/* ---------------- what the clerk knows ---------------- */
export function learn(p, what) {
  const k = p.known;
  switch (what) {
    case 'name': k.name = true; break;
    case 'reservation': k.reservation = true; break;
    case 'party': k.party = true; break;
    case 'nights': k.nights = true; break;
    case 'partyNights': k.party = k.nights = true; break;
    case 'smoking': k.smoking = true; break;
    case 'beds': k.beds = true; break;
    case 'smokeBeds': k.smoking = k.beds = true; break;
    case 'pay': k.pay = true; break;
    case 'vehicle': k.vehicle = true; break;
    case 'wants': k.wants = true; break;
    default: k[what] = true;
  }
}

/** What the clerk has on the card so far, said back. */
export function recap(p) {
  const k = p.known, st = p.stay, bits = [];
  if (k.name) bits.push(p.name);
  if (k.reservation) bits.push(st.reservation ? 'reservation' : 'no reservation');
  if (k.party) bits.push(st.party === 1 ? 'one person' : `${st.party} people`);
  if (k.nights) bits.push(nightsWord(st.nights).toLowerCase());
  if (k.beds) bits.push(BED_LABEL[st.beds].toLowerCase());
  if (k.smoking) bits.push(st.smoking ? 'smoking' : 'non-smoking');
  if (k.pay) bits.push(st.pay === 'CARD' ? st.card.type : st.pay === 'TC' ? 'traveler\'s checks' : st.pay.toLowerCase());
  if (k.wants && st.wants && st.wants.length) bits.push(st.wants.map(wantWord).join(', '));
  return bits.length ? bits.join(', ') : 'nothing yet';
}
const wantWord = (w) => ({ quiet: 'somewhere quiet', groundFloor: 'ground floor', upstairs: 'upstairs', nearOffice: 'near the office', nearCar: 'near the car', pool: 'near the pool', poolside: 'poolside', west: 'a west window', twoBeds: 'two beds', together: 'rooms together' }[w] || w);

function isRegularWithYou(s, p) { return p.rosterId && withYou(s, p) > 0; }

/* ============================================================
   CHECK-IN
   ============================================================ */
export function checkinNode(s, p) {
  const ci = p.ci || (p.ci = { stage: 'talk', greeted: false });
  switch (ci.stage) {
    case 'talk': return talkNode(s, p, ci);
    case 'system': return say(p, L(s, p, 'systemWait'), [
      reply('One second -- I\'m putting you in now.', () => null),
      reply('Remind me what you need?', () => say(p, `(you read it back) ${recap(p)}.`, [reply('Right. One second.', () => null)])),
      ...askChoices(s, p, ci).slice(0, 2),
      ...(!p.group && !s.rooms.vacantClean().length ? [fullUp(s, p)] : []),
    ]);
    case 'pay': return payNode(s, p, ci);
    case 'cash': return cashNode(s, p, ci);
    case 'card': return cardNode(s, p, ci);
    case 'voucher': return voucherNode(s, p, ci);
    case 'key': return keyNode(s, p, ci);
    default: return null;
  }
}

function talkNode(s, p, ci) {
  if (!ci.greeted) {
    ci.greeted = true;
    for (const v of (p.def && p.def.volunteers) || []) learn(p, v);
    if (p.lines && p.lines.noDisclose) { p.known.noDisclose = true; }
    const greet = L(s, p, 'greet');
    // regulars volunteer what the motel should already know
    if (p.rosterId === 'EARL') { learn(p, 'name'); learn(p, 'reservation'); }
    if (p.rosterId === 'CONNIE') { learn(p, 'name'); learn(p, 'reservation'); learn(p, 'partyNights'); learn(p, 'smokeBeds'); }
    if (p.rosterId === 'PILLOWS') { learn(p, 'name'); learn(p, 'reservation'); learn(p, 'partyNights'); learn(p, 'smoking'); }
    if (p.rosterId === 'VERNA' || p.rosterId === 'BUDDY') { learn(p, 'name'); learn(p, 'reservation'); }
    if (p.rosterId === 'MAGIC') learn(p, 'name');
    return say(p, greet, talkChoices(s, p, ci));
  }
  return say(p, L(s, p, 'systemWait'), talkChoices(s, p, ci));
}

function askChoices(s, p, ci) {
  const k = p.known, st = p.stay, out = [];
  if (!k.name) out.push(reply('Name for the card?', () => { learn(p, 'name'); return answer(s, p, ci, L(s, p, 'name')); }));
  if (!k.reservation) out.push(reply('Do you have a reservation with us?', () => { learn(p, 'reservation'); return answer(s, p, ci, L(s, p, 'reservation')); }));
  if (!k.party || !k.nights) out.push(reply('How many of you, and how many nights?', () => {
    const redundant = k.party && k.nights;
    learn(p, 'partyNights');
    let t = L(s, p, 'partyNights');
    if (redundant) t = `${L(s, p, 'redundant')} ${t}`;
    return answer(s, p, ci, t, 'partyNights');
  }));
  if (!k.smoking || !k.beds) out.push(reply('Smoking or non? And what kind of bed?', () => {
    learn(p, 'smokeBeds');
    return answer(s, p, ci, L(s, p, 'smokeBeds'), 'smokeBeds');
  }));
  if (!k.pay) out.push(reply('How will you be paying?', () => {
    learn(p, 'pay');
    let t = L(s, p, 'pay');
    if (st.coupon) t += ` ${L(s, p, 'coupon') || 'And I have a coupon.'}`;
    return answer(s, p, ci, t);
  }));
  if (!k.vehicle && st.vehicle && out.length < 3) out.push(reply('What are you driving? It goes on the card.', () => { learn(p, 'vehicle'); return answer(s, p, ci, L(s, p, 'vehicle')); }));
  return out;
}

function talkChoices(s, p, ci) {
  const out = askChoices(s, p, ci).slice(0, 3);
  out.push(reply(out.length ? 'Let me get you in the system.' : 'All right -- let me get you in the system.', () => {
    ci.stage = 'system';
    s.onGuestToSystem(p);
    return null;
  }));
  if (!p.group && !s.rooms.vacantClean().length) out.push(fullUp(s, p));
  return out;
}

/** No rooms. It happens. You say so nicely, and they go on to the Ramada. */
function fullUp(s, p) {
  return reply('I\'m sorry -- we\'re full tonight.', () => {
    const free = s.rooms.vacantClean().length;
    const res = s.director.reservationFor(p);
    s.stats.turnedAway++;
    if (free > 0) { s.stats.turnedAwayWithRooms++; s.log(`Turned ${p.name} away with ${free} clean room${free > 1 ? 's' : ''} on the rack.`, 'bad'); }
    if (res) { s.stats.walkedReservation++; s.log(`Had no room for ${p.name}, who had a reservation.`, 'bad'); }
    if (!s.noVacancy && !free) s.stats.noVacancyMiss++;
    p.mood -= res ? 30 : 6;
    s.finishDesk(p, 'turnedAway');
    return say(p, res ? 'I have a reservation. I called. ...Where am I supposed to go?' : s.rng.pick(['Oh. Okay. Is there anything up the road?', 'Full. On a Thursday. Huh. Okay.', 'Well. Thanks anyway.']),
      [reply(res ? 'I\'ll call the Ramada for you -- I\'m so sorry.' : 'The Ramada\'s twenty minutes up 71.', () => null)]);
  });
}

/** An answer, plus whatever they volunteer about the room on the back of it. */
function answer(s, p, ci, text, topic) {
  const st = p.stay;
  let t = text;
  if ((topic === 'partyNights' || topic === 'smokeBeds') && !p.known.wants && st.wants && st.wants.length) {
    const w = L(s, p, 'wants');
    if (w) { t += `\n\n${w}`; learn(p, 'wants'); }
  }
  return say(p, t, talkChoices(s, p, ci));
}

/* ---------------- money ---------------- */
function billsFor(s, amt, exact) {
  if (exact) return round2(Math.ceil(amt));
  const r = s.rng();
  if (r < 0.18 && amt < 100) return 100;
  if (r < 0.3 && amt < 50) return 50;
  return Math.ceil(amt / 20) * 20;
}

function payNode(s, p, ci) {
  const f = ci.folio, st = p.stay;
  const amt = s.ledger.balance(f) > 0 ? s.ledger.balance(f) : s.ledger.stayTotal(f);
  ci.amount = amt;
  const nights = f.nights;
  const lead = `That'll be ${money(amt)} -- ${nights === 1 ? 'one night' : `${nights} nights`}, tax included.`;
  const cashNoDeposit = (st.pay === 'CASH' || st.pay === 'TC') && !ci.deposit && !p.groupRooms && !f.charges.some((c) => c.desc === 'KEY DEPOSIT');
  const choices = [reply(lead, () => {
    // they check it against what they came in for
    const wrong = [];
    if (f.nights !== st.nights) wrong.push(nightsWord(f.nights).toLowerCase().replace('just ', ''));
    if (f.party !== st.party && !(p.kind === 'crew')) wrong.push(f.party === 1 ? 'one person' : `${f.party} people`);
    if (wrong.length && !ci.checked) {
      ci.checked = true;
      return say(p, L(s, p, 'wrongAmount', wrong.join(', ')), [
        reply('You\'re right -- let me fix that.', () => {
          f.nights = st.nights; f.party = st.party;
          f.rate = nightly(p.stay.beds === f.beds ? f.beds : f.beds, st.party, f.rateCode, f.accountObj);
          s.ledger.recharge(f, s.clock.min);
          s.stats.corrections++;
          s.g.sound.keyClick(); s.g.sound.keyClick();
          return payNode(s, p, ci);
        }),
      ]);
    }
    if (st.coupon && !ci.coupon) return couponNode(s, p, ci);
    return tender(s, p, ci);
  })];
  if (st.pay === 'CARD') choices.push(reply('Could I see your card and an ID?', () => tender(s, p, ci)));
  if (cashNoDeposit) choices.push(reply(`${money(amt)}, plus a ten-dollar key deposit -- you get it back at checkout.`, () => {
    ci.deposit = true;
    s.ledger.charge(f, 'KEY DEPOSIT', 10, s.clock.min);
    f.deposit = 10;
    return say(p, p.rosterId === 'OTIS' ? 'Ten dollars for a key. For a KEY. ...Fine. It comes back, you said. It comes back.' : s.rng.pick(['Sure, that\'s fine.', 'Okay. For the key. Sure.', 'Ten more. Okay.']), [reply('(take the payment)', () => { if (st.coupon && !ci.coupon) return couponNode(s, p, ci); return tender(s, p, ci); })]);
  }));
  return say(p, ci.said ? L(s, p, 'systemWait') : L(s, p, 'confirm'), choices);
}

function couponNode(s, p, ci) {
  ci.coupon = true;
  const f = ci.folio;
  const homemade = p.stay.coupon === 'homemade';
  const weekday = s.clock.weekday();
  const valid = !homemade && weekday >= 0 && weekday <= 4;
  const text = homemade
    ? '(He slides it across. It is the back of a Winn-Dixie receipt. In blue ballpoint, carefully: STARLITE MOTOR LODGE -- ONE ROOM -- $19.95 -- GOOD ANY NIGHT. Under that, smaller: -O.B.)'
    : `(A coupon torn from one of the travel books in the rack at Shoney's: TRAVELER DISCOUNT GUIDE -- STARLITE MOTOR LODGE, DELPHINE LA -- $29.95 SGL/DBL -- VALID SUN-THU -- NOT VALID WITH OTHER DISCOUNTS -- EXPIRES 12/31/97.)`;
  return say(p, text, [
    reply(homemade ? 'We can do nineteen ninety-five.' : 'We\'ll honor that -- twenty-nine ninety-five.', () => {
      f.rateCode = 'COUPON';
      f.rate = homemade ? 19.95 : 29.95;
      s.ledger.recharge(f, s.clock.min);
      if (homemade) { s.flags.homemadeCoupon = true; s.memory.flag('OTIS', 'couponHonored'); s.log('Honored a homemade coupon ($19.95) for O. Bellweather.', 'note'); }
      else if (!valid) { s.flags.badCoupon = true; s.log('Took a travel-book coupon on a night it is not valid.', 'note'); }
      p.mood += 5;
      return say(p, homemade ? 'I knew you\'d see it my way. It\'s a very reasonable coupon.' : 'There we go. Marlene, he took it.', [reply('(take the payment)', () => tender(s, p, ci))]);
    }),
    reply(homemade ? 'I\'m sorry -- that\'s not one of ours.' : 'That coupon isn\'t good tonight, I\'m afraid.', () => {
      if (homemade) s.memory.flag('OTIS', 'couponRefused');
      p.mood -= homemade ? 3 : 8;
      return say(p, homemade
        ? 'Well, it is now. I made it. ...All right. All right. I\'ll hang on to it. It may be good somewhere else.'
        : (valid ? 'It says Sunday through Thursday right on it. It\'s Thursday. ...Fine. Fine. The regular rate.' : 'Well, that\'s -- fine. The regular rate, then.'),
      [reply('(take the payment)', () => tender(s, p, ci))]);
    }),
  ]);
}

/** They hand you the money, however they pay. */
function tender(s, p, ci) {
  const st = p.stay, f = ci.folio;
  const amt = s.ledger.balance(f);
  ci.amount = amt;
  if (amt <= 0.001) { ci.stage = 'key'; return keyNode(s, p, ci); }
  const payWith = ci.payOverride || st.pay;
  if (payWith === 'CASH' || payWith === 'TC') {
    const bills = billsFor(s, amt, st.exact);
    ci.tendered = bills; ci.tc = payWith === 'TC';
    if (ci.tc) {
      return say(p, `(Two books of American Express traveler's checks come out of a jacket pocket, and a pen.) How many do you need? ${Math.round(bills / 20)} twenties?`, [
        reply('Sign them here, in front of me, please.', () => {
          ci.tcSigned = true;
          s.g.sound.pen();
          return handCash(s, p, ci, bills, '(signs each one slowly, on the counter, in front of you) There.');
        }),
        reply('Just hand them over.', () => handCash(s, p, ci, bills, '(They are already signed, both lines. Signed in the car, at some point.)')),
      ]);
    }
    return handCash(s, p, ci, bills, L(s, p, 'handCash', bills));
  }
  if (payWith === 'CARD') {
    const card = makeItem('card', { card: { ...st.card }, owner: p.id, folio: f.id, folios: (p.groupFolios || [f]).map((x) => x.id) });
    s.giveItem(card);
    ci.stage = 'card';
    s.g.sound.paper();
    return say(p, `${L(s, p, 'handCard')}\n\n(${cardText(st.card)})`, [
      reply('(Run it through the imprinter.)', () => null),
      ...cardChecks(s, p, ci),
    ]);
  }
  if (payWith === 'VOUCHER') {
    const v = makeItem('voucher', { company: accountName(st.account), account: st.account, owner: p.id, folio: f.id, rooms: p.groupRooms ? p.groupRooms.length : 1 });
    s.giveItem(v);
    ci.stage = 'voucher';
    s.g.sound.paper();
    return voucherNode(s, p, ci);
  }
  // direct bill: nothing changes hands
  s.ledger.pay(f, 'DIRECT', amt, st.account, s.clock.min);
  ci.stage = 'key';
  return keyNode(s, p, ci);
}

function handCash(s, p, ci, bills, text) {
  s.g.player.cash.tendered = round2(s.g.player.cash.tendered + bills);
  s.pendingSale = { p, folio: ci.folio, amount: ci.amount, tendered: bills, tc: ci.tc, tcSigned: !!ci.tcSigned };
  ci.stage = 'cash';
  s.g.sound.paper();
  return say(p, text, [reply(`(Take the ${ci.tc ? 'checks' : 'money'} to the register.)`, () => null)]);
}

function cashNode(s, p, ci) {
  const pl = s.g.player;
  const sale = s.pendingSale;
  if (sale && sale.p === p && !sale.rung) {
    return say(p, '(waits while you ring it up)', [reply('(Ring it up at the register.)', () => null)]);
  }
  if (pl.changeInHand > 0.004) {
    const ch = pl.changeInHand;
    return say(p, '(holds out a hand for the change)', [
      reply(`Here's your change -- ${money(ch)}.`, () => {
        pl.changeInHand = 0;
        s.g.sound.coins(0, 0.6);
        ci.stage = 'key';
        return say(p, L(s, p, 'change'), [reply('And your key --', () => keyNode(s, p, ci))]);
      }),
    ]);
  }
  ci.stage = 'key';
  return keyNode(s, p, ci);
}

/* ---------------- cards ---------------- */
export function cardText(c) { return `${c.type} -- ${c.name} -- EXP ${c.exp}`; }
export function cardExpired(c, clock) {
  const [mm, yy] = c.exp.split('/').map(Number);
  const y = yy < 50 ? 2000 + yy : 1900 + yy;
  const d = clock.date;
  return y < d.getFullYear() || (y === d.getFullYear() && mm < d.getMonth() + 1);
}
function cardChecks(s, p, ci) {
  const c = p.stay.card;
  return [reply('This card is expired.', () => {
    if (!cardExpired(c, s.clock)) {
      p.mood -= 6;
      return say(p, `No it isn't. It says ${c.exp}. Right there.`, [reply('My mistake. Sorry.', () => say(p, 'It happens.', [reply('(Run it through the imprinter.)', () => null)]))]);
    }
    // they look at it
    s.stats.caughtExpired++;
    const card = s.heldOf('card', (it) => it.owner === p.id);
    if (card) s.removeHeld(card);
    ci.payOverride = 'CASH';
    s.log(`Caught an expired card (${c.type}, ${c.exp}) before imprinting it.`, 'good');
    const t = p.rosterId === 'STORM'
      ? '...Huh. Huh. September. It was good in September. Okay. Okay. I got cash in the van. Some. Hang on.'
      : '(looks at it for a long moment) Well, would you look at that. I have cash. Hang on.';
    ci.stage = 'pay';
    return say(p, t, [reply('Thanks. Sorry about that.', () => tender(s, p, ci))]);
  })];
}

/** Called when the player comes back with an imprinted slip. */
function cardNode(s, p, ci) {
  const slip = s.heldOf('slip', (it) => it.owner === p.id && !it.signed);
  const card = s.heldOf('card', (it) => it.owner === p.id);
  if (!slip) {
    return say(p, '(waits)', [
      reply('(Run it through the imprinter.)', () => null),
      ...(card ? cardChecks(s, p, ci) : []),
      ...(!card ? [reply('Could I see that card again?', () => { const c = makeItem('card', { card: { ...p.stay.card }, owner: p.id, folio: ci.folio.id }); s.giveItem(c); return say(p, `(${cardText(p.stay.card)})`, [reply('(Take it to the imprinter.)', () => null)]); })] : []),
    ]);
  }
  return say(p, '(looks at the slip)', [
    reply(`Sign here, please -- ${money(slip.amount)}.`, () => {
      slip.signed = true;
      slip.sigMatches = true;
      s.g.sound.pen();
      if (card) s.removeHeld(card);
      s.removeHeld(slip);
      s.ledger.slips.push({ folio: slip.folio, card: slip.card, amount: slip.amount, signed: true, expired: cardExpired(slip.card, s.clock), room: ci.folio.room, name: p.name });
      for (const id of slip.folios || [slip.folio]) { const fo = s.ledger.folio(id); if (fo) s.ledger.pay(fo, 'CARD', s.ledger.balance(fo), slip.card.type, s.clock.min); }
      ci.stage = 'key';
      return say(p, `${L(s, p, 'sign')}\n\n(You tear off the customer copy, hand it back with the card, and drop the merchant copy in the box under the counter.)`, [reply('And your key --', () => keyNode(s, p, ci))]);
    }),
  ]);
}

/* ---------------- vouchers ---------------- */
function accountName(id) { const a = ACCOUNTS.find((x) => x.id === id); return a ? a.name : String(id || 'UNKNOWN'); }
function voucherNode(s, p, ci) {
  const v = s.heldOf('voucher', (it) => it.owner === p.id);
  const onFile = ACCOUNTS.some((a) => a.id === p.stay.account);
  const text = v
    ? `(A carbon voucher on company letterhead: ${accountName(p.stay.account)} -- ${p.groupRooms ? `${p.groupRooms.length} ROOMS` : '1 ROOM'} -- ${p.stay.nights} NIGHTS -- DIRECT BILL. AUTHORIZED: T. BROUSSARD.) The accounts we bill are in the binder, if you need to check.`
    : '(waits)';
  return say(p, text, [
    reply('That account\'s on file. You\'re all set.', () => {
      if (v) s.removeHeld(v);
      s.ledger.vouchers.push({ company: accountName(p.stay.account), account: p.stay.account, folio: ci.folio.id, onFile, rooms: p.groupRooms ? p.groupRooms.length : 1 });
      const folios = p.groupFolios || [ci.folio];
      for (const f of folios) s.ledger.pay(f, 'VOUCHER', s.ledger.balance(f), p.stay.account, s.clock.min);
      if (!onFile) s.log(`Took a voucher from ${accountName(p.stay.account)}, which has no account with us.`, 'bad');
      ci.stage = 'key';
      return keyNode(s, p, ci);
    }),
    reply('I\'ll need to check the binder -- one second.', () => null),
  ]);
}

/* ---------------- keys ---------------- */
function keyNode(s, p, ci) {
  const rooms = p.groupRooms || [ci.room];
  const keys = s.heldAll('key');
  const right = keys.filter((k) => rooms.includes(k.room));
  const choices = [];
  if (p.groupRooms) {
    if (right.length) {
      choices.push(reply(`(Hand over ${right.length === rooms.length ? 'all the keys' : `${right.length} of ${rooms.length} keys`}: ${right.map((k) => k.room).join(', ')}.)`, () => {
        for (const k of right) { s.removeHeld(k); p.groupKeys = (p.groupKeys || []).concat(k.room); s.g.sound.keys(0); }
        if ((p.groupKeys || []).length >= rooms.length) return keysDone(s, p, ci);
        return say(p, `That's ${p.groupKeys.length}. We need ${rooms.length}.`, [reply('The rest are coming.', () => null)]);
      }));
    }
  } else {
    for (const k of keys) {
      choices.push(reply(`(Hand over key ${k.room}.)`, () => {
        if (k.from === p.id && k.room !== ci.room) {
          return say(p, `That's the one I just gave you. ${k.room}. It doesn't open ${ci.room}.`, [reply('Right -- sorry.', () => keyNode(s, p, ci))]);
        }
        s.removeHeld(k);
        s.g.sound.keys(0);
        p.keyFor = k.room;
        if (k.room !== ci.room) { s.stats.wrongKeys++; }
        return keysDone(s, p, ci);
      }));
    }
  }
  if (!choices.length) {
    return say(p, rooms.length > 1 ? '(waits for the keys)' : '(waits for the key)', [reply(rooms.length > 1 ? `Keys for ${rooms.join(', ')} -- one second.` : `Your key's right behind me -- ${ci.room}. One second.`, () => null)]);
  }
  return say(p, '(holds out a hand)', choices.slice(0, 4));
}

function keysDone(s, p, ci) {
  const room = p.groupRooms ? p.groupRooms[0] : p.keyFor;
  let t = L(s, p, 'keyThanks', room);
  const r = s.rooms.def(ci.room);
  // did they get what they asked for
  const st = p.stay;
  const wants = st.wants || [];
  const miss = [];
  if (wants.includes('groundFloor') && r.lv === 1) miss.push('Upstairs? ...Okay. It\'s fine. It\'s stairs.');
  if (wants.includes('upstairs') && r.lv === 0 && !p.groupRooms) miss.push('Downstairs. All right. I\'ll pull the curtain.');
  if (p.rosterId === 'EARL') s.memory.flag('EARL', 'got105', ci.room === '105');
  ci.liked = miss.length === 0;
  if (miss.length && !p.groupRooms) { t += `\n\n${miss[0]}`; p.mood -= 5; }
  // a wake-up, if they want one
  const wake = st.wake || (p.def && p.def.schedule && p.def.schedule.wake) || null;
  const choices = [];
  if (wake && !ci.wakeAsked) {
    ci.wakeAsked = true;
    const at = typeof wake === 'number' ? wake : wake[0];
    const tt = Clock.label(at);
    return say(p, `${t}\n\nCan I get a wake-up call? ${tt}.`, [
      reply(`${tt}. I'll put you on the sheet.`, () => {
        s.wakeups.add(p.groupRooms ? p.groupRooms[0] : ci.room, at, p.id, { name: p.name.split(' ').slice(-1)[0].toUpperCase() });
        s.g.sound.pen();
        p.wakeWanted = at;
        return closing(s, p, ci);
      }),
      reply('There\'s an alarm clock in the room, but I\'ll call too.', () => {
        s.wakeups.add(p.groupRooms ? p.groupRooms[0] : ci.room, at, p.id, { name: p.name.split(' ').slice(-1)[0].toUpperCase() });
        s.g.sound.pen();
        p.wakeWanted = at;
        return closing(s, p, ci);
      }),
    ]);
  }
  choices.push(reply('Checkout\'s at eleven. Breakfast is six to nine, in the room through there.', () => { p.mood += 2; return closing(s, p, ci); }));
  choices.push(reply('Have a good night.', () => closing(s, p, ci)));
  return say(p, t, choices);
}

function closing(s, p, ci) {
  ci.stage = 'done';
  return say(p, L(s, p, 'farewell'), [reply('Good night.', () => { s.finishDesk(p, 'checkin'); return null; })]);
}

/* ============================================================
   CHECK-OUT
   ============================================================ */
export function checkoutNode(s, p) {
  const co = p.co || (p.co = { stage: 'hello' });
  const f = s.ledger.folioForRoom(p.room);
  if (co.stage === 'hello') {
    co.stage = 'printing';
    // the key comes across the counter first -- or, for a group, a coffee can of them
    if (p.groupRooms) {
      for (const no of p.groupRooms) {
        const st = s.rooms.get(no);
        const out = 2 - st.keys;
        for (let i = 0; i < out; i++) s.giveItem(makeItem('key', { room: no, from: p.id }), true);
        const fo = s.ledger.folioForRoom(no); if (fo) fo.departed = true;
      }
      p.keyFor = null; p.extraKeys = [];
      s.g.sound.keys(0);
    } else if (p.keyFor) {
      s.giveItem(makeItem('key', { room: p.keyFor, from: p.id }));
      p.keyFor = null;
      s.g.sound.keys(0);
    }
    const like = roomReview(s, p);
    const next = [
      reply('Let me print your receipt.', () => { co.wantsReceipt = true; return null; }),
      reply(f && s.ledger.balance(f) <= 0.004 ? 'You\'re all paid up. Safe travels.' : 'You\'re all set. Safe travels.', () => { co.skipReceipt = true; return goodbye(s, p, co); }),
    ];
    const opening = `${L(s, p, 'checkout')}${like ? `\n\n${like}` : ''}`;
    if (f && f.deposit) {
      return say(p, `${opening}\n\nAnd the deposit. The ten dollars, for the key.`, [
        reply('(Ten dollars out of the drawer, and a paid-out slip.) Here you go.', () => {
          co.refunded = true; f.deposit = 0;
          s.ledger.payOut(10, 'KEY DEPOSIT REFUND', true);
          s.g.sound.cashDrawer(); s.g.sound.pen();
          return say(p, 'Thanks.', next);
        }),
      ]);
    }
    return say(p, opening, next);
  }
  const rc = s.heldOf('receipt', (it) => it.room === p.room);
  if (rc) {
    return say(p, '(waits)', [reply('Here\'s your receipt.', () => { s.removeHeld(rc); s.g.sound.paper(); return goodbye(s, p, co); })]);
  }
  return say(p, '(waits for the receipt)', [
    reply('It\'s printing -- one second.', () => null),
    reply('Actually, you\'re all set. Safe travels.', () => { co.skipReceipt = true; return goodbye(s, p, co); }),
  ]);
}
function goodbye(s, p, co) {
  co.stage = 'done';
  return say(p, L(s, p, 'checkoutThanks'), [reply('Take care.', () => { s.finishDesk(p, 'checkout'); return null; })]);
}

/** What somebody says about the room on the way out. The room's traits, as experienced. */
export function roomReview(s, p) {
  const r = p.room && s.rooms.def(p.room);
  if (!r) return '';
  const t = r.traits;
  if (t.includes('noisyAC')) return 'That air conditioner. I dreamed I was on a train.';
  if (t.includes('shower')) return 'Shower in there -- the water sort of... leans out. You have to go find it.';
  if (t.includes('ice')) return 'Every twenty minutes, all night, the ice machine. Like somebody dropping a bag of marbles in a bathtub.';
  if (t.includes('tv')) return 'The TV in that room gets channels I\'ve never heard of. Somebody was selling knives in Spanish. Beautiful picture.';
  if (t.includes('smell')) return 'The room smelled like 1974. That\'s not a complaint. I was there in 1974.';
  if (t.includes('renovated')) return 'Nice room. New carpet. You can tell. The carpet wants you to tell.';
  if (t.includes('213')) return 'Two thirteen, huh. Slept fine. Nothing happened. I kept waiting for something to happen.';
  if (t.includes('drip')) return 'The faucet drips. I counted. I didn\'t mean to count.';
  if (t.includes('stairs')) return 'Folks going up and down those stairs all night. Big feet on this route.';
  if (t.includes('poolside')) return 'Nice to wake up and see the pool. Even with the leaves in it.';
  return s.rng() < 0.5 ? L(s, p, 'roomLike') : '';
}

/* ============================================================
   WEEKLY RENT
   ============================================================ */
export function rentNode(s, p) {
  const rn = p.rent || (p.rent = { stage: 'hello' });
  const f = s.ledger.folioForRoom(p.room);
  if (rn.stage === 'hello') {
    const amt = round2(withTax(159));
    rn.amount = amt;
    return say(p, p.rosterId === 'HOLLIS'
      ? `Paying the week. That's ${money(amt)}, same as last week, same as the week before. Here's ${money(180)}.`
      : `Here's the week. ${money(amt)}, isn't it?`, [
      reply('(Take the money to the register.)', () => {
        rn.stage = 'cash';
        s.ledger.charge(f, 'ROOM WEEKLY', 159, s.clock.min);
        s.ledger.charge(f, 'TAX', round2(159 * 0.1), s.clock.min);
        s.g.player.cash.tendered = round2(s.g.player.cash.tendered + 180);
        s.pendingSale = { p, folio: f, amount: amt, tendered: 180 };
        s.g.sound.paper();
        return null;
      }),
    ]);
  }
  const pl = s.g.player;
  if (s.pendingSale && s.pendingSale.p === p && !s.pendingSale.rung) return say(p, '(waits)', [reply('(Ring it up.)', () => null)]);
  if (pl.changeInHand > 0.004) {
    const ch = pl.changeInHand;
    return say(p, '(waits for his change)', [reply(`Your change -- ${money(ch)}.`, () => {
      pl.changeInHand = 0; s.g.sound.coins(0, 0.6);
      return say(p, p.rosterId === 'HOLLIS' ? 'Thank you. Put the dime in the Jerry\'s Kids can. I always do.' : 'Thank you, dear.', [reply('Good night.', () => { s.finishDesk(p, 'rent'); return null; })]);
    })]);
  }
  return say(p, 'Thank you.', [reply('Good night.', () => { s.finishDesk(p, 'rent'); return null; })]);
}

/* ============================================================
   COMPLAINTS AND REQUESTS, IN PERSON
   ============================================================ */
export function complaintNode(s, p) {
  const c = p.complaint;
  if (!c) return beat(p, 'Never mind. Never mind.', 'Okay.', () => { s.finishDesk(p, 'complaint'); return null; });
  switch (c.kind) {
    case 'wrongKey': return wrongKeyNode(s, p, c);
    case 'beds': return moveNode(s, p, c, 'There\'s one bed. There are four of us, and one bed. I said two beds. I\'m almost sure I said two beds.', (r) => r.beds === 'QQ');
    case 'smell': return moveNode(s, p, c, 'The room smells like an ashtray. Like, like the inside of an ashtray. I asked for non-smoking.', (r) => !r.smoking);
    case 'noiseAc': return moveNode(s, p, c, 'The air conditioner in my room sounds like a truck downshifting. Every nine seconds. I timed it.', (r) => !r.traits.includes('noisyAC'), true);
    case 'refund': return vendingNode(s, p, { machine: 'soda', why: 'ate', product: 'coke' });
    case 'vending': return vendingNode(s, p, c);
    case 'ice': return beat(p, 'The ice machine\'s not giving any ice. It\'s making a noise like it wants to, but it isn\'t.', 'I\'ll go take a look at it.', () => {
      s.tasks.add({ kind: 'ice', text: 'Clear the ice machine (north end, by the vending)', where: 'ice' });
      s.finishDesk(p, 'complaint');
      return null;
    });
    case 'lateWake': return lateWakeNode(s, p, c);
    case 'question': return questionNode(s, p, c);
    default: return requestNode(s, p, c);
  }
}

function wrongKeyNode(s, p, c) {
  return say(p, `This key doesn't open ${p.room}. It says ${c.had} on it. I tried it anyway. It doesn't.`, [
    reply('I\'m so sorry -- let me get you the right one.', () => {
      s.giveItem(makeItem('key', { room: c.had, from: p.id }));
      p.keyFor = null;
      p.ci = p.ci || {};
      p.ci.stage = 'key';
      p.ci.room = p.room;
      p.deskReason = 'checkin';
      p.rekey = true;
      p.mood -= 6;
      s.log(`Gave ${p.name} the key to ${c.had} instead of ${p.room}.`, 'bad');
      return say(p, 'It\'s fine. It\'s late. Everybody\'s tired.', [reply(`(Get key ${p.room} off the rack.)`, () => null)]);
    }),
  ]);
}

/** A room move: pick where to put them from what is actually clean and empty. */
function moveNode(s, p, c, text, fits, canFix) {
  const options = s.rooms.vacantClean().map((st) => st.def).filter((r) => fits(r) && !r.traits.includes('213')).slice(0, 3);
  const choices = options.map((r) => reply(`Let me move you to ${r.no} -- ${s.rooms.describe(r.no)}.`, () => {
    s.moveGuest(p, r.no);
    p.mood += 4;
    return say(p, 'Thank you. Here\'s the old key.', [reply(`(Get key ${r.no} off the rack.)`, () => null)]);
  }));
  if (canFix) choices.push(reply('Let me come take a look at it first.', () => {
    s.tasks.add({ kind: 'ac', room: p.room, who: p.id, text: `Look at the air conditioner in ${p.room}` });
    s.finishDesk(p, 'complaint');
    return say(p, 'I\'ll be up. I\'ll be very up.', [reply('Be right there.', () => null)]);
  }));
  if (!options.length) choices.push(reply('I\'m sorry -- we\'re full up. I don\'t have anything else tonight.', () => {
    p.mood -= 10;
    s.log(`Couldn't move ${p.name} out of ${p.room}.`, 'note');
    s.finishDesk(p, 'complaint');
    return say(p, 'Well. Okay. Okay.', [reply('I\'m sorry.', () => null)]);
  }));
  return say(p, text, choices);
}

/* ============================================================
   THE MACHINES
   Somebody walked all the way down from their room about a Coke.
   ============================================================ */
function vendingNode(s, p, c) {
  const M = MACHINES[c.machine], P0 = PRODUCTS[c.product] || PRODUCTS[M.slots[0]];
  const P = { ...P0, label: P0.spoken || P0.label };      // what people call it out loud
  const V = s.vending;
  const task = (why, text) => {
    if (!s.tasks.find((t) => t.kind === 'vend' && t.machine === c.machine && t.why === why)) {
      s.tasks.add({ kind: 'vend', machine: c.machine, why, where: c.machine, text });
    }
  };
  const done = (text, label = 'Good night.') => { s.finishDesk(p, 'complaint'); return say(p, text, [reply(label, () => null)]); };
  const fixName = M.name.replace(/^the /, '');
  if (c.why === 'ate') {
    const price = P.price;
    const out = [
      reply(`(Write a paid-out slip and give them ${money(price)} from the drawer.)`, () => {
        s.ledger.payOut(price, 'VENDING REFUND', true);
        s.g.sound.cashDrawer(); s.g.sound.pen();
        s.stats.refunds++;
        task('ate', `Clear the jam in the ${fixName} (it's eating money)`);
        return done('Thanks. It\'s the principle. It\'s not the sixty cents. It\'s a little bit the sixty cents.', 'I\'ll go fix it.');
      }),
      reply(`(Give them ${money(price)} out of your own pocket.)`, () => {
        s.stats.ownPocket = (s.stats.ownPocket || 0) + price;
        task('ate', `Clear the jam in the ${fixName} (it's eating money)`);
        return done('Oh -- you don\'t have to -- well. Thank you.', 'It\'s all right.');
      }),
      reply('I\'m sorry. I\'ll go see what\'s stuck in it.', () => {
        p.mood -= 5;
        task('ate', `Clear the jam in the ${fixName} (it's eating money)`);
        return done('And the sixty cents? ...No. Okay. Okay.', 'Sorry.');
      }),
    ];
    return say(p, `${cap(M.name)} took my money. ${money(price)}. It lit up and everything, and then nothing. I hit it. Politely.`, out);
  }
  if (c.why === 'full') {
    return say(p, c.machine === 'soap'
      ? 'The soap machine won\'t take my quarters. They go in the top and come straight out the bottom. I have a load of whites sitting in the washer, dry, waiting on it.'
      : `${cap(M.name)} won't take quarters. They go in, and they come right back out the bottom. I tried a dollar. It gave the dollar back like it was offended.`, [
      reply('The coin box is full -- that\'s on me. I\'ll go empty it.', () => {
        task('full', `Empty the coin box in the ${fixName}`);
        p.mood -= 1;
        return done('A full coin box. At a motel. Huh. Okay.', 'Give me ten minutes.');
      }),
      reply('It does that. Try it again in the morning.', () => {
        p.mood -= 7;
        return done('In the morning. I wanted it now. That\'s the whole thing about a machine.', 'Sorry.');
      }),
    ]);
  }
  // sold out, and somebody already said they'd fill it
  const empties = V.empties(c.machine);
  const promised = s.tasks.find((t) => t.kind === 'vend' && t.machine === c.machine && t.why === 'empty');
  if (promised) {
    return say(p, `${cap(M.name)}'s still out of ${P.label}. ${promised.created < s.clock.min - 90 ? 'It\'s been out since I got here, and I got here a while ago.' : 'The man next door said somebody said they\'d fill it.'}`, [
      reply('I\'m sorry -- I\'ll go fill it right now.', () => { p.mood -= 3; return done('Right now. Okay. I\'ll give it ten minutes.', 'Ten minutes.'); }),
      reply('It\'s on my list.', () => { p.mood -= 8; return done('It\'s on a list. Good. I\'ll drink the list.', 'Sorry.'); }),
    ]);
  }
  let text;
  if (c.machine === 'soap') text = `There's no ${P.short === 'TIDE' ? 'soap' : P.label.toLowerCase()} in the soap machine. I've got a load of whites in the washer, sitting there in their natural state.`;
  else if (c.machine === 'snack') text = empties.length >= 3 ? 'The snack machine\'s got nothing I want in it, which is fine, but it\'s also got nothing anybody wants in it. It\'s just Nabs. Row after row of Nabs.' : `The snack machine's out of ${P.label}. I put my money in, it gave it back, and a little light came on. The light said SOLD OUT. I know. I can see.`;
  else { const o = PRODUCTS[empties.find((k) => k !== c.product) || empties[0]]; text = `Your drink machine's out of ${P.label}. I pushed ${P.label}, it gave me my money back and a little red light.${empties.length > 1 ? ` I pushed ${o.spoken || o.label}. Same light.` : ''}`; }
  const choices = [
    reply('I\'ll fill it tonight. Sorry about that.', () => {
      task('empty', `Fill the ${fixName} (${empties.map((k) => PRODUCTS[k].short.toLowerCase()).join(', ') || P.short.toLowerCase()} out)`);
      return done(c.machine === 'soap' ? 'Tonight. Okay. The whites will wait. The whites have nowhere to be.' : 'Tonight. Okay. I\'ll come back down.', 'I\'ll get it.');
    }),
    reply(c.machine === 'soap' ? 'There\'s a laundromat in town. Opens at eight.' : 'Try the Texaco. It\'s two miles up.', () => {
      p.mood -= 7;
      return done(c.machine === 'soap' ? 'At eight. It\'s eleven.' : 'Two miles. For a Coke. Okay.', 'Sorry.');
    }),
  ];
  return say(p, text, choices);
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function lateWakeNode(s, p, c) {
  return say(p, `I asked for a wake-up at ${Clock.label(c.at)}. It's ${s.clock.label()}. I asked for it, you wrote it down, I watched you write it down.`, [
    reply('I\'m sorry. That\'s on me.', () => { p.mood -= 4; s.finishDesk(p, 'complaint'); return say(p, 'Yeah. Well. I\'m up now.', [reply('It won\'t happen again.', () => null)]); }),
    reply('The phone must not have gone through.', () => { p.mood -= 10; s.finishDesk(p, 'complaint'); return say(p, 'The phone. Uh huh.', [reply('...', () => null)]); }),
  ]);
}

const QUESTIONS = [
  { q: 'Is there anywhere to eat that\'s open? Anything.', good: 'Peg\'s Diner, across the highway. Open all night.', goodR: 'Across the highway? I can walk that. I can walk anything for pie.', bad: 'Everything around here closes at nine, I\'m afraid.', badR: 'Oh. Okay. There\'s a vending machine, right?' },
  { q: 'Do y\'all have an iron? I have a thing in the morning.', good: 'I\'ll bring one down from the back.', task: { kind: 'deliver', item: 'iron', text: 'Bring an iron' }, goodR: 'You\'re a lifesaver.', bad: 'Sorry, we don\'t have irons.', badR: 'Wrinkled it is.' },
  { q: 'What channel is HBO?', good: 'We don\'t get HBO -- but 201 gets about everything else.', goodR: 'No HBO. Well. I\'ll watch the Weather Channel like an animal.', bad: 'Channel 4, I think.', badR: '(comes back ten minutes later) Channel 4 is a church.' },
  { q: 'Can I get a late checkout? Like noon?', good: 'Noon\'s fine. I\'ll leave a note for the day desk.', goodR: 'Thank you. Thank you.', bad: 'Checkout\'s eleven, sorry.', badR: 'Eleven. Okay.' },
  { q: 'Where\'s the laundry? And do I need quarters?', good: 'Past the pool, north end. Quarters -- I can change a few dollars for you.', goodR: 'Perfect.', bad: 'North end. It takes quarters.', badR: 'I don\'t have quarters. Nobody has quarters.' },
];
function questionNode(s, p, c) {
  const Q = QUESTIONS[c.i % QUESTIONS.length];
  return say(p, Q.q, [
    reply(Q.good, () => { p.mood += 3; if (Q.task) s.tasks.add({ ...Q.task, room: p.room, who: p.id, text: `${Q.task.text} to ${p.room}` }); s.finishDesk(p, 'question'); return say(p, Q.goodR, [reply('Good night.', () => null)]); }),
    reply(Q.bad, () => { p.mood -= 2; s.finishDesk(p, 'question'); return say(p, Q.badR, [reply('Good night.', () => null)]); }),
  ]);
}

/** Towels, pillows, the TV. Things somebody walks over to ask for instead of calling. */
function requestNode(s, p, c) {
  return say(p, c.text || 'Could I get some more towels?', [
    reply(c.accept || 'I\'ll bring them right over.', () => {
      s.tasks.add({ kind: c.kind, room: p.room, who: p.id, item: c.item, qty: c.qty || 1, text: c.task || `${c.item} to ${p.room}` });
      s.finishDesk(p, 'complaint');
      return say(p, 'Thanks.', [reply('Be right there.', () => null)]);
    }),
    ...(c.item && s.heldOf(c.item) ? [reply('Here -- I\'ve got some right here.', () => {
      s.removeHeld(s.heldOf(c.item));
      s.g.sound.cloth();
      p.mood += 5; s.stats.tasksDone++;
      s.finishDesk(p, 'complaint');
      return say(p, 'Oh! Well. Look at you.', [reply('Good night.', () => null)]);
    })] : []),
  ]);
}

export { YOU, q };
