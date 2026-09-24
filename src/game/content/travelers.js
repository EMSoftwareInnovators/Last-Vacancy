/* ============================================================
   travelers.js -- the people nobody wrote down in advance.

   Most of a motel's night is strangers: somebody driving to
   somewhere, stopping because they are tired, gone by eight. They
   are rolled from archetypes, not written one by one, but every
   archetype is a kind of person you would actually meet at a desk
   on Highway 71 in 1997, and each one talks like it.

   An archetype says what they look like (loosely), what they want
   from a room, how they pay, when they sleep, and how they answer
   the questions. The roll fills in a name, a face, a car.
   ============================================================ */
import { randomAppearance, randomName, CARRY, MARKS, SMELLS, HATS } from '../appearance.js';
import { money } from '../dialogue/runner.js';

const find = (tbl, id) => tbl.find((t) => t.id === id) || tbl[0];
const CAR_COLORS = ['white', 'gray', 'blue', 'red', 'black', 'green', 'tan', 'silver', 'maroon', 'gold', 'brown'];
const STATES = ['LA', 'LA', 'LA', 'TX', 'TX', 'MS', 'AR', 'OK', 'AL', 'TN'];
const plate = (rng) => `${rng.pick(STATES)} ${rng.int(9) + 1}${String.fromCharCode(65 + rng.int(26))}${String.fromCharCode(65 + rng.int(26))} ${100 + rng.int(899)}`;
const carDesc = (color, kind, make) => `${color[0].toUpperCase() + color.slice(1)} ${make || (kind === 'pickup' ? 'pickup' : kind === 'wagon' ? 'station wagon' : kind === 'van' ? 'van' : 'sedan')}`;

export const ARCHETYPES = [
  {
    id: 'retirees', weight: 1.2, tag: 'retired, driving to see the grandkids', gender: 'm', age: 'old',
    stay: (rng) => ({ party: 2, nights: 1, beds: rng.chance(0.5) ? 'QQ' : 'K', smoking: false, wants: ['groundFloor'], pay: rng.chance(0.4) ? 'TC' : rng.chance(0.5) ? 'CARD' : 'CASH', rateCode: rng.chance(0.5) ? 'COUPON' : 'RACK', coupon: 'book', partner: 'Me and the wife' }),
    car: ['sedan', 'Buick', 'Oldsmobile', 'Crown Victoria'],
    carry: 'suitcase', hair: ['gray', 'white'],
    lines: {
      greet: ['Evening. We\'d like a room, please. Just the one night. My wife has a coupon, and she\'s going to show it to you whether or not you want to see it.', 'Hello there. We\'re driving to Tyler. Our grandson turned two. We\'ve been driving since he was born, feels like.'],
      reservation: 'No, we don\'t do reservations. We just drive until Marlene says stop.',
      partyNights: 'Me and the wife. The one night. We\'re in Tyler by lunch if the Lord wills and the Buick doesn\'t overheat.',
      smokeBeds: (p) => `Non-smoking. ${p.stay.beds === 'QQ' ? 'Two beds. She kicks. Forty-one years, she kicks.' : 'One bed. We\'ve been sharing since Eisenhower.'}`,
      pay: (p) => (p.stay.pay === 'TC' ? 'Traveler\'s checks. American Express. I don\'t carry cash on the road, you hear stories.' : p.stay.pay === 'CARD' ? 'Visa. She keeps the Visa. Marlene -- the Visa.' : 'Cash. I still pay cash for everything. Bank\'s a racket.'),
      coupon: 'It\'s from the travel book. The one at the Shoney\'s. It says Sunday through Thursday, and it\'s Thursday, isn\'t it? It\'s Thursday.',
      systemWait: ['Is there a Shoney\'s around here? There\'s always a Shoney\'s.', 'We had a motel like this on our honeymoon. Hot Springs. The TV was a quarter an hour.'],
      keyThanks: (p, s, room) => `${room}. Is that downstairs? My knees would like to know.`,
      farewell: 'What time is breakfast? Six? We\'ll be there at five fifty-five. We always are.',
    },
    schedule: { bed: [22 * 60 + 10, 22 * 60 + 40], breakfast: [29 * 60 + 58, 30 * 60 + 15], checkout: [30 * 60 + 30, 30 * 60 + 55] },
    breakfast: { coffee: 'decaf', food: 'bagels', lingers: 25 },
  },
  {
    id: 'trucker', weight: 1.2, tag: 'is driving a truck, for a living', gender: 'm',
    stay: (rng) => ({ party: 1, nights: 1, beds: 'D', smoking: rng.chance(0.75), wants: ['groundFloor', 'nearOffice'], pay: 'CASH', rateCode: 'RACK', wake: 28 * 60 + 30 + rng.int(60) }),
    car: ['pickup', 'Chevy'], carry: 'duffel', hat: 'trucker',
    lines: {
      greet: ['Got a room? Just need somewhere to lay down for about six hours.', 'Evening. You got something with a bed in it? That\'s all I need. A bed in it.'],
      reservation: 'No.',
      partyNights: 'Just me. Till about five.',
      smokeBeds: (p) => `${p.stay.smoking ? 'Smoking.' : 'Non. I\'m quitting. Again.'} Whatever bed.`,
      pay: 'Cash.',
      vehicle: (p) => `${p.stay.vehicle.desc}. The rig's up on the shoulder, I'm not putting it in your lot.`,
      systemWait: ['(rubs his eyes with the heels of both hands)', 'Eleven hours today. Twelve tomorrow. Don\'t drive a truck.'],
      keyThanks: (p, s, room) => `${room}. You do wake-up calls?`,
      farewell: 'Night.',
    },
    wakeAsk: true,
    schedule: { bed: [23 * 60 + 30, 24 * 60 + 10], checkout: 'wake' },
    breakfast: null,
  },
  {
    id: 'oilfield', weight: 0.9, tag: 'works offshore, two weeks on and two off', gender: 'm',
    stay: (rng) => ({ party: rng.chance(0.3) ? 2 : 1, nights: 2, beds: 'QQ', smoking: rng.chance(0.5), wants: [], pay: 'CASH', rateCode: 'RACK' }),
    car: ['pickup', 'Dodge'], carry: 'duffel', hat: 'cap',
    lines: {
      greet: ['How y\'all doing. Need a room couple nights. Just came in off the rig, I\'m still walking like the floor\'s moving.', 'Evening. Two nights, if you got it. My crew change got pushed.'],
      reservation: 'No, the helicopter don\'t take reservations either.',
      partyNights: (p) => `${p.stay.party === 2 ? 'Me and my cousin, he\'s in the truck.' : 'Just me.'} Two nights. Maybe three if the weather\'s bad in the Gulf.`,
      smokeBeds: (p) => `${p.stay.smoking ? 'Smoking.' : 'Non.'} Two beds is good.`,
      pay: 'Cash. We get paid in cash, we spend it in cash. Well. We get paid in checks. Then we cash them.',
      systemWait: ['Fourteen days on, fourteen off. Out there you don\'t even notice what day it is. You notice what meal.', 'First thing I do off the rig is eat something that wasn\'t fried in the same oil as everything else.'],
      farewell: 'Where\'s good to eat around here? Peg\'s? Peg\'s it is.',
    },
    schedule: { bed: [24 * 60, 25 * 60], breakfast: [30 * 60 + 5, 30 * 60 + 30] },
    breakfast: { coffee: 'regular', food: 'waffle', lingers: 15 },
  },
  {
    id: 'student', weight: 0.8, tag: 'driving back to school', age: 'young',
    stay: (rng) => ({ party: rng.chance(0.5) ? 2 : 1, nights: 1, beds: 'QQ', smoking: false, wants: [], pay: 'CASH', rateCode: 'RACK', exact: true }),
    car: ['sedan', 'Civic', 'Corolla', 'Escort'], carry: 'backpack',
    lines: {
      greet: ['Hi. Um. How much is a room? For one night. The cheapest one.', 'Hey. Do you guys have, like, a cheap room?'],
      reservation: 'No. Was I supposed to? Sorry.',
      partyNights: (p) => `${p.stay.party === 2 ? 'Two of us. My roommate. She\'s asleep in the car.' : 'Just me.'} Just tonight. I've got a lab at one tomorrow in Baton Rouge.`,
      smokeBeds: 'Non. Whatever\'s cheapest. Two beds is fine. Is two beds more? It\'s not more? Okay.',
      pay: 'Cash. I think I have it. Hang on.',
      handCash: (p, s, bills) => `Okay, that's -- ${money(bills)}. Some of it's ones. Some of it's quarters. Sorry.`,
      systemWait: ['My mom made me promise not to drive after midnight. It\'s eleven-forty. I\'m keeping it.', 'Do you have a phone I can use? I have to tell my mom I stopped. It\'s a whole thing.'],
      keyThanks: (p, s, room) => `${room}. Thank you so much. Is breakfast free? Like, actually free?`,
      farewell: 'Is breakfast free? Like, actually free? Okay. Okay, cool.',
    },
    schedule: { bed: [24 * 60 + 30, 25 * 60 + 30], breakfast: [30 * 60 + 20, 30 * 60 + 45], checkout: [30 * 60 + 45, 31 * 60 + 20] },
    breakfast: { coffee: 'regular', food: 'waffle', lingers: 12, takesExtra: true },
  },
  {
    id: 'nurse', weight: 0.8, tag: 'a traveling nurse, between contracts', gender: 'f',
    stay: (rng) => ({ party: 1, nights: 2, beds: 'K', smoking: false, wants: ['quiet', 'upstairs'], pay: 'CARD', rateCode: 'RACK' }),
    car: ['sedan', 'Accord', 'Cavalier'], carry: 'suitcase',
    lines: {
      greet: ['Hi. I need a room for two nights, somewhere quiet, and I need to be asleep in about fifteen minutes.', 'Hi. Please tell me you have a king that isn\'t next to the ice machine.'],
      reservation: 'No. My contract in Monroe ended a day early. My next one starts Monday in Lake Charles. I\'m in between. This is between.',
      partyNights: 'Just me. Two nights.',
      smokeBeds: 'Non-smoking. King.',
      pay: 'Visa.',
      wants: 'Quiet. Upstairs if you have it. I\'ve worked nights for six years, I will sleep through anything except a door.',
      systemWait: ['Twelve-hour shifts. Seven to seven. You know the feeling. Well -- you\'re living it.', 'I\'ve slept in twenty-two motels this year. You learn which ones have real curtains.'],
      farewell: 'If anybody knocks before noon, they\'d better be on fire.',
    },
    schedule: { bed: [22 * 60 + 30, 23 * 60] },
    breakfast: null,
  },
  {
    id: 'brokedown', weight: 0.9, tag: 'car trouble', gender: 'm',
    stay: (rng) => ({ party: rng.chance(0.4) ? 2 : 1, nights: 1, beds: 'QQ', smoking: rng.chance(0.3), wants: [], pay: 'CASH', rateCode: 'RACK', noCar: true }),
    car: null, carry: 'duffel',
    lines: {
      greet: ['Hi. My car\'s at the Texaco and the Texaco\'s closed and the man says the part\'s coming from Alexandria at nine. So. A room.', 'You have a room? My alternator died a quarter mile that way. I walked. It\'s a long quarter mile.'],
      reservation: 'I didn\'t plan on being here, no. I didn\'t plan on being anywhere near here.',
      partyNights: (p) => `${p.stay.party === 2 ? 'Two of us. My brother. He\'s outside yelling at the Texaco.' : 'Just me.'} One night. God willing.`,
      smokeBeds: 'Whatever you\'ve got. Two beds is fine.',
      pay: 'Cash. What\'s left of it after the tow.',
      vehicle: 'Right now? None. It\'s a Pontiac, it\'s at the Texaco, it\'s dead.',
      systemWait: ['How much do alternators cost? Don\'t tell me. Don\'t tell me.', 'They towed it with me in it. That\'s legal? Apparently it\'s legal.'],
      farewell: 'Which way\'s the Texaco from here? I want to be there when it opens. I want to look it in the eye.',
    },
    walksIn: true,
    schedule: { bed: [23 * 60 + 30, 24 * 60 + 30], breakfast: [30 * 60, 30 * 60 + 20], checkout: [30 * 60 + 40, 31 * 60 + 10] },
    breakfast: { coffee: 'regular', food: 'pastry', lingers: 10 },
  },
  {
    id: 'moving', weight: 0.8, tag: 'moving to Dallas', gender: 'f',
    stay: (rng) => ({ party: 2, nights: 1, beds: 'K', smoking: false, wants: ['nearCar'], pay: 'CARD', rateCode: 'RACK', partner: 'Me and my husband -- well, my fiancé, well. It\'s complicated. Two of us' }),
    car: ['van', 'U-Haul'], carry: 'none',
    lines: {
      greet: ['Hi. We need a room, and we need to park a truck somewhere you can see it from the office. Everything we own is in it.', 'Hi! We\'re moving. To Dallas. Everything we own is in a truck in your parking lot.'],
      reservation: 'No. We were going to drive straight through. We did not drive straight through.',
      partyNights: 'Two of us. One night.',
      smokeBeds: 'Non. One bed.',
      pay: 'Visa. If it goes through. We just paid the deposit on an apartment we haven\'t seen.',
      wants: 'Near the truck. Please. If you can.',
      systemWait: ['He wanted to bring the couch. The couch is from college. The couch is coming to Dallas.', 'Do you think anybody would steal a truck full of boxes marked KITCHEN MISC? Don\'t answer.'],
      farewell: 'If you see anybody near the U-Haul, just -- yell. Anything.',
    },
    schedule: { bed: [23 * 60, 23 * 60 + 40], breakfast: [30 * 60 + 5, 30 * 60 + 25], checkout: [30 * 60 + 30, 31 * 60] },
    breakfast: { coffee: 'regular', food: 'bagels', lingers: 12 },
  },
  {
    id: 'fisherman', weight: 0.8, tag: 'going to Toledo Bend', gender: 'm', age: 'old',
    stay: (rng) => ({ party: rng.chance(0.5) ? 2 : 1, nights: 1, beds: 'QQ', smoking: rng.chance(0.4), wants: ['nearCar'], pay: rng.chance(0.6) ? 'TC' : 'CASH', rateCode: 'RACK', wake: 28 * 60 + 15 + rng.int(40) }),
    car: ['pickup', 'Ford'], carry: 'none', hat: 'cap',
    lines: {
      greet: ['Evening. Need a room till about four. We\'re going to Toledo Bend and the bass don\'t wait.', 'How you doing. A room for the night, and somewhere I can see the boat from the window.'],
      reservation: 'Nope.',
      partyNights: (p) => `${p.stay.party === 2 ? 'Me and my brother-in-law. He\'s the one that talks. I\'m the one that fishes.' : 'Just me.'} One night. Really half a night.`,
      smokeBeds: (p) => `${p.stay.smoking ? 'Smoking.' : 'Non.'} Two beds.`,
      pay: (p) => (p.stay.pay === 'TC' ? 'Traveler\'s checks. My wife makes me carry them. She thinks I\'ll lose cash. I lose everything. I lose the checks.' : 'Cash.'),
      systemWait: ['Caught a nine-pounder there in \'91. Nine pounds, two ounces. Didn\'t have a scale. But I know.', 'You fish? You ought to fish.'],
      keyThanks: (p, s, room) => `${room}. And a wake-up, can you do a wake-up?`,
      farewell: 'Four-something on the wake-up. Earlier is fine. Earlier is better.',
    },
    wakeAsk: true,
    schedule: { bed: [22 * 60 + 15, 22 * 60 + 45], checkout: 'wake' },
    breakfast: null,
  },
  {
    id: 'hiding', weight: 0.6, tag: 'needs a quiet night', gender: 'f',
    stay: (rng) => ({ party: 1, nights: 1, beds: 'K', smoking: rng.chance(0.3), wants: ['quiet'], pay: 'CASH', rateCode: 'RACK', noDisclose: true }),
    car: ['sedan', 'Cutlass', 'Corsica', 'Tempo'], carry: 'suitcase',
    lines: {
      greet: 'Hi. One room, one night. And -- if anybody calls asking if I\'m here, I\'m not here. Is that a thing you can do?',
      reservation: 'No.',
      partyNights: 'Just me. Just the one night.',
      smokeBeds: (p) => `${p.stay.smoking ? 'Smoking, God help me.' : 'Non-smoking.'} One bed.`,
      pay: 'Cash.',
      noDisclose: 'It\'s my sister. It\'s not -- it\'s not like that. It\'s just, she talks. She will call every motel between here and Shreveport and she will talk. I need one night where she doesn\'t know where I am.',
      systemWait: ['She found me at a Ramada once. The Ramada put her through. I\'m not saying anything about the Ramada.', '(checks the lot through the glass, then stops herself)'],
      keyThanks: (p, s, room) => `${room}. Thank you. And the thing? The not-here thing?`,
      farewell: 'Thank you. Really.',
    },
    schedule: { bed: [23 * 60, 23 * 60 + 30], checkout: [30 * 60 + 10, 30 * 60 + 40] },
    breakfast: { coffee: 'regular', food: 'fruit', lingers: 6 },
  },
  {
    id: 'rep', weight: 1, tag: 'sells something, on the road', gender: 'm',
    stay: (rng) => ({ party: 1, nights: 1, beds: 'K', smoking: rng.chance(0.3), wants: ['quiet'], pay: 'CARD', rateCode: rng.chance(0.4) ? 'AAA' : 'RACK', aaa: true }),
    car: ['sedan', 'Lumina', 'Taurus', 'Grand Am'], carry: 'briefcase',
    product: ['feed and seed', 'church furniture', 'industrial fasteners', 'restaurant napkins', 'hearing aids', 'agricultural insurance', 'water softeners'],
    lines: {
      greet: (p) => [`Evening. Room for one, one night. I sell ${p.product}, before you ask. Nobody asks.`, `Hey. One room. ${p.product[0].toUpperCase() + p.product.slice(1)}. That's what I do. That's the whole story.`],
      reservation: 'No. I was going to push on to Alexandria. My back said no.',
      partyNights: 'Just me. One night.',
      smokeBeds: (p) => `${p.stay.smoking ? 'Smoking.' : 'Non-smoking.'} King.`,
      pay: (p) => `Visa.${p.stay.rateCode === 'AAA' ? ' And I\'ve got the triple-A.' : ''}`,
      systemWait: (p) => [`You ever think about ${p.product}? Nobody does. That's the problem with ${p.product}.`, 'Three hundred and eleven miles today. I\'m going to dream about the stripe down the middle of the road.'],
      farewell: 'Where\'s open? Anything. I\'ll eat anything.',
    },
    schedule: { bed: [23 * 60, 23 * 60 + 45], breakfast: [29 * 60 + 55, 30 * 60 + 20], checkout: [30 * 60 + 20, 30 * 60 + 45] },
    breakfast: { coffee: 'regular', food: 'pastry', lingers: 8, channel: 'NEWS' },
  },
  {
    id: 'pastor', weight: 0.5, tag: 'a Baptist minister, on his way to a revival', gender: 'm',
    stay: (rng) => ({ party: 1, nights: 1, beds: 'K', smoking: false, wants: [], pay: 'CASH', rateCode: 'RACK' }),
    car: ['sedan', 'Grand Marquis'], carry: 'briefcase',
    lines: {
      greet: 'Good evening, friend. A room for the night, if the Lord and the Starlite Motor Lodge have one to spare.',
      reservation: 'No, I trust in Providence. Providence has been very reliable on this stretch of 71.',
      partyNights: 'Just myself. One night. I\'m preaching a revival in Many, Friday through Sunday. You\'d be welcome.',
      smokeBeds: 'Non-smoking. Whatever you have.',
      pay: 'Cash. And I\'ll ask for a receipt, if it\'s no trouble. The deacons are very thorough.',
      systemWait: ['You work nights? The night is a fine time to think. Also to sleep. Mostly to sleep.', 'Revival starts Friday. Three services a day. By Sunday I\'ll have no voice at all. That\'s when they listen.'],
      farewell: 'God bless. And good night. The two are not unrelated.',
    },
    schedule: { bed: [22 * 60, 22 * 60 + 30], breakfast: [29 * 60 + 58, 30 * 60 + 10], checkout: [30 * 60 + 15, 30 * 60 + 35] },
    breakfast: { coffee: 'regular', food: 'fruit', lingers: 12, newspaper: true },
  },
];

let seq = 1;
/** Roll one traveler of an archetype into a person definition the shift can use. */
export function rollTraveler(rng, arch) {
  const gender = arch.gender || (rng.chance(0.5) ? 'm' : 'f');
  const a = randomAppearance(rng, { gender });
  a.mark = find(MARKS, 'none');
  if (!rng.chance(0.15)) a.smell = find(SMELLS, 'none');
  a.carry = find(CARRY, arch.carry || 'none');
  if (a.hat && a.hat.id === 'hood') a.hat = find(HATS, 'none');
  if (arch.hat) a.hat = find(HATS, arch.hat);
  if (arch.age === 'old' && a.hair && a.hair.color) {
    const c = rng.pick(arch.hair || ['gray', 'white']);
    a.hair.color = c === 'white' ? { id: 'white', name: 'white', hex: '#cfcac0', dark: '#a5a099' } : { id: 'gray', name: 'gray', hex: '#8d8a84', dark: '#6a6862' };
  }
  const stay = arch.stay(rng);
  if (arch.car) {
    const kind = arch.car[0];
    const color = kind === 'van' && arch.id === 'moving' ? 'orange' : rng.pick(CAR_COLORS);
    const make = arch.car.length > 1 ? rng.pick(arch.car.slice(1)) : null;
    stay.vehicle = { color: color === 'orange' ? 'white' : color, kind, desc: arch.id === 'moving' ? 'U-Haul truck, fourteen feet' : carDesc(color, kind, make), plate: plate(rng) };
    if (arch.id === 'moving') stay.vehicle.kind = 'van';
  }
  if (stay.pay === 'CARD') stay.card = { type: rng.pick(['VISA', 'VISA', 'MC', 'DISCOVER']), name: '', exp: `${String(1 + rng.int(12)).padStart(2, '0')}/${rng.pick(['98', '99', '00'])}` };
  const name = randomName(rng, a.gender);
  if (stay.card) stay.card.name = name.toUpperCase();
  const def = {
    id: `T${seq++}`, name, tag: arch.tag, kind: 'traveler', arch: arch.id,
    app: a, stay, lines: arch.lines, breakfast: arch.breakfast, wakeAsk: !!arch.wakeAsk, walksIn: !!arch.walksIn,
    schedule: arch.schedule, volunteers: rng.chance(0.4) ? ['party'] : [],
  };
  if (arch.product) def.product = rng.pick(arch.product);
  return def;
}

export function pickArchetype(rng, exclude = []) {
  const pool = ARCHETYPES.filter((a) => !exclude.includes(a.id));
  const total = pool.reduce((n, a) => n + a.weight, 0);
  let r = rng() * total;
  for (const a of pool) { r -= a.weight; if (r <= 0) return a; }
  return pool[0];
}
