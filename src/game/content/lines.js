/* ============================================================
   lines.js -- how people talk at the front desk.

   Every guest answers the same handful of questions a night clerk
   asks: name, reservation, how many, how long, smoking, beds, how
   are you paying, what are you driving. What makes the desk worth
   standing behind is that nobody answers them the same way.

   A line is a string, an array of strings (one is picked, stably,
   per person), or a function of (person, shift) returning either.
   A character's table overrides an archetype's table, which
   overrides GENERIC. Missing keys fall through.

   The rule for all of it: the humor comes from the people. Nobody
   here knows they are funny.
   ============================================================ */
import { money } from '../dialogue/runner.js';

const first = (p) => p.name.split(' ')[0];
const last = (p) => p.name.split(' ').slice(-1)[0];
const withYou = (s, p) => (p.rosterId ? s.memory.guest(p.rosterId).withYou : 0);

/* ---------------- how a stay is said out loud ---------------- */
function nightsWord(n) { return n === 1 ? 'Just tonight' : n === 2 ? 'Two nights' : n === 3 ? 'Three nights' : `${n} nights`; }
function partyWord(p) {
  const n = p.stay.party;
  if (n === 1) return 'Just me';
  if (n === 2) return p.stay.partner || 'Two of us';
  if (n === 3) return 'Three of us';
  return `${n} of us`;
}
function bedsWord(p) {
  const b = p.stay.beds;
  return b === 'QQ' ? 'Two beds' : b === 'D' ? 'One bed is fine, whatever\'s cheapest' : 'A king if you have it';
}
function smokeWord(p) { return p.stay.smoking ? 'Smoking' : 'Non-smoking'; }
function payWord(p) {
  const pay = p.stay.pay;
  if (pay === 'CARD') return `${p.stay.card.type === 'MC' ? 'MasterCard' : p.stay.card.type === 'AMEX' ? 'American Express' : p.stay.card.type === 'DISCOVER' ? 'Discover' : 'Visa'}.`;
  if (pay === 'TC') return 'Traveler\'s checks. That all right?';
  if (pay === 'VOUCHER') return 'Company voucher.';
  return 'Cash.';
}

export const GENERIC = {
  greet: [
    'Hi. You have a room for tonight?',
    'Evening. Y\'all got anything left?',
    'Need a room, if you\'ve got one.',
    'Hey there. The sign said vacancy.',
    'Hi -- is it too late to get a room?',
  ],
  greetRes: ['Hi, checking in. Should be a reservation.', 'Evening. I called ahead, I think it\'s under my name.'],
  name: (p) => [`${last(p)}. ${p.name}.`, `${p.name}.`, `It's ${last(p)}. ${first(p)}.`],
  reservation: (p) => (p.stay.reservation ? ['Yes, I called last week.', 'Should be. I called from Beaumont.'] : ['No. Is that a problem?', 'No, we were just driving till we got tired.', 'No ma\'am -- no sir. Sorry. No.']),
  partyNights: (p) => `${partyWord(p)}. ${nightsWord(p.stay.nights)}.`,
  smokeBeds: (p) => `${smokeWord(p)}. ${bedsWord(p)}.`,
  pay: (p) => payWord(p),
  vehicle: (p) => (p.stay.vehicle ? [`${p.stay.vehicle.desc}. ${p.stay.vehicle.plate}.`, `It's the ${p.stay.vehicle.desc.toLowerCase()} out front. Plate's ${p.stay.vehicle.plate}, I think.`] : ['I walked. Well. I got dropped off.']),
  wants: [''],
  systemWait: ['Take your time.', 'Sure.', '(waits, reading the rate card)'],
  confirm: ['That\'s right.', 'Yep.', 'Sounds right.'],
  amount: (p, s, amt) => [`${money(amt)}. Okay.`, `All right.`, `${money(amt)}... okay, yeah.`],
  handCash: (p, s, bills) => [`Here's ${money(bills)}.`, `I've got ${money(bills)}.`],
  handCard: ['Here you go.', 'Here.'],
  sign: ['(signs)', 'Right here? (signs)'],
  change: ['Thanks.', 'Appreciate it.'],
  keyThanks: (p, s, room) => [`${room}. Thanks.`, `Great. Thank you.`, `Where's ${room}?`],
  farewell: ['Night.', 'Thanks. Good night.', 'Have a good one.'],
  wrongAmount: (p, s, what) => `Wait -- that's for ${what}. It's ${nightsWord(p.stay.nights).toLowerCase()}, ${p.stay.party === 1 ? 'just me' : `${p.stay.party} of us`}.`,
  waitAtDesk: ['Hello?', 'Anybody here?', '(rings the bell again)'],
  redundant: ['I think I said.', 'Like I said.'],
  checkout: ['Checking out.', 'We\'re heading out. Here\'s the key.', 'Morning. Checking out.'],
  checkoutThanks: ['Thanks. Coffee\'s good.', 'Thanks. Have a good one.', 'Thank you.'],
  roomLike: ['Room was fine.', 'Slept fine.', 'Bed was all right.'],
};

/* ============================================================
   THE ROSTER'S VOICES
   ============================================================ */
export const LINES = {
  EARL: {
    greet: (p, s) => (withYou(s, p) > 0
      ? ['Evening, kid. Maddox. You know the drill.', 'There he is. Maddox, the one night, the one Buick, the one room.']
      : ['Evening. You\'re new. Maddox -- Earl Maddox. I\'m in 105, I\'ve been in 105 since before they redid the carpet. Should be a reservation.']),
    name: (p, s) => (withYou(s, p) > 0 ? 'Kid, we\'ve done this before. Maddox.' : 'Maddox. M-A-D-D-O-X. Like mad, like ox.'),
    reservation: 'Tuesday, same as every week. June takes it herself. She writes it in pencil because she says she doesn\'t trust me not to cancel. I have never canceled.',
    partyNights: 'Just me, and the one night. It\'s always the one night. Alexandria tomorrow, Natchitoches Friday, home Saturday if the Buick holds.',
    smokeBeds: (p, s) => (withYou(s, p) > 0 ? 'Kid, we\'ve done this before. King. Non. 105.' : 'King, non-smoking. Quit in \'88. Still reach for them at every red light between here and Shreveport.'),
    pay: 'Visa. Same Visa. Company pays me back in six to eight weeks, which is what they say about everything.',
    vehicle: 'Maroon LeSabre. LA 4TK 219. It\'s parked where it\'s always parked.',
    systemWait: ['Take your time. You\'re paid by the hour, I\'m paid by the fryer.', 'You know what I sell? Fryers. Commercial. Every diner between here and Texarkana, I sold them the fryer.'],
    amount: (p, s, amt) => `${money(amt)}. That's been right since '94.`,
    handCard: 'There you go. It\'s good. Everything I own is good for exactly as long as I keep driving.',
    keyThanks: (p, s, room) => (room === '105' ? '105. You\'re learning.' : room === '112'
      ? '112. The new carpet. ...It\'s a nice room. The carpet\'s very loud about how new it is. I\'ll take it.'
      : `${room}. Huh. Okay. The world changes, a man adjusts.`),
    farewell: 'Is the coffee fresh in the morning? Don\'t answer that. I\'ll find out.',
    checkout: 'Key\'s on the counter. Folio to the Visa. Tell June the ice machine\'s making the noise again.',
    checkoutThanks: 'See you next Thursday. Or somebody will.',
    wrongAmount: 'Hang on, kid. It\'s one night. It\'s been one night for four years.',
  },
  KYLE: {
    greet: 'Hey. Hey. So -- we need a room. Again. It\'s the house. Don\'t ask about the house.',
    name: 'Mercer. Kyle. And Dana. She\'s getting the bag.',
    reservation: 'No. Nobody makes a reservation for "the ceiling came down." I mean -- part of it. The kitchen part.',
    partyNights: 'Two of us. Two nights? Two. The drywall guy says Friday. He said last Friday too.',
    smokeBeds: 'Non. One bed\'s fine. We\'re married. We\'re very married. We\'re renovating.',
    pay: 'Cash. Everything\'s cash now. We are a cash family. The contractor does not take checks from us anymore.',
    vehicle: 'White F-150. The one with the drywall in the back. That\'s not ours. I mean it is. We bought it. It\'s the wrong drywall.',
    wants: 'Close to the office, if you can? Dana likes to walk over and get coffee and not talk about the house.',
    systemWait: ['Do you know anything about breakers? Like, how many is normal?', 'We had the electric guy out. He said "huh." That was it. He said "huh" and then he left.'],
    keyThanks: (p, s, room) => `${room}. Great. Great. Thank you. Seriously.`,
    farewell: 'If a guy named Lloyd calls for me, I\'m not here. Or I am. Depends what he says about the joists.',
    handCash: (p, s, bills) => `Here. That's -- here's ${money(bills)}. That's grocery money but this is groceries now.`,
  },
  DANA: {
    greet: 'Hi. Sorry. Hi.',
    farewell: 'Thank you. You have no idea. A room with a ceiling.',
  },
  VERNA: {
    greet: 'Good evening. Ashby. There will be a reservation, I made it myself on Monday, and the young lady read it back to me.',
    name: 'Verna Ashby. A-S-H-B-Y. I\'ll wait while you find it.',
    reservation: 'Monday. Two nights. A king, ground floor, non-smoking, and I asked for the AAA rate, which I am entitled to. I have the card.',
    partyNights: 'Myself. Two nights. My sister is across town and her house has cats in it, which is her business.',
    smokeBeds: 'Non-smoking. I will know if it isn\'t.',
    pay: 'Cash. I don\'t believe in carrying a balance. I don\'t believe in a great many things.',
    vehicle: 'Blue Buick. It is not dirty. It was raining in Opelousas.',
    wants: 'Somewhere quiet, on the ground. I don\'t do stairs after supper.',
    systemWait: ['Your rate card has a typo, you know. "Continetal." Right there, by the door.', 'I used to do inventory for the parish library. Forty-one years. You can always tell who shelves by the spine.'],
    amount: (p, s, amt) => `${money(amt)}. With the AAA? Let me see that. ...Fine.`,
    handCash: (p, s, bills) => `Here is ${money(bills)}. Count it, please. In front of me. Thank you.`,
    keyThanks: (p, s, room) => `${room}. Thank you. What time does the breakfast open? Six. And what time does it actually open?`,
    farewell: 'That video store on Main charged me six dollars for a late tape last spring. I\'m only telling you so you know the kind of town it is.',
    wrongAmount: 'No. That is not the AAA rate. I did the arithmetic in the car.',
  },
  OTIS: {
    greet: 'Evening. Got a room? I\'ve got a coupon.',
    name: 'Bellweather. Otis. Two L\'s, two E\'s, one of everything else.',
    reservation: 'Nope. Didn\'t need one. I\'ve got the coupon.',
    partyNights: 'Just me. One night. The coupon\'s for one night.',
    smokeBeds: 'Smoking. King, if the coupon covers it. I believe it does.',
    pay: 'Cash. And the coupon.',
    vehicle: 'Tan Caprice. It\'s paid for. That\'s the best kind of car there is.',
    systemWait: ['You know the video place over on Main? Charged me six dollars for a late tape. Six. I brought it back the next day.', 'I have a coupon for just about everything in this parish.'],
    handCash: (p, s, bills) => `Here's ${money(bills)}. Less the coupon, that's change coming, right?`,
    keyThanks: (p, s, room) => `${room}. That's a good number. Is the breakfast included? With the coupon?`,
    farewell: 'I\'ll hold on to that coupon if you\'re not going to use it. Sentimental.',
  },
  PILLOWS: {
    greet: 'Good evening. One room, please, for one night, for one person, non-smoking. My name is Gene Lowery.',
    name: 'Lowery. Gene.',
    reservation: 'No reservation.',
    partyNights: 'One person. One night. As I said.',
    smokeBeds: 'Non-smoking, as I said. One bed is fine.',
    pay: 'Cash.',
    vehicle: 'Silver Camry. TX 8MM 330.',
    systemWait: ['(stands very still, hands folded)', 'This is a nice lobby.'],
    keyThanks: (p, s, room) => `${room}. Thank you. I may call down later with a small request. Nothing unusual.`,
    farewell: 'Good night.',
  },
  STORM: {
    greet: 'Hey! Hey, you got a room? West side if you got it. Facing west. You got a west window?',
    name: 'Kuykendall. Rusty. Everybody spells it wrong, just put a K and I\'ll know it\'s me.',
    reservation: 'No man, I don\'t know where I\'m gonna be till the radar tells me. Last night I was in Durant. Tonight I\'m here. Tomorrow, depends on the dryline.',
    partyNights: 'Just me and the gear. One night. The line\'s coming through at like five.',
    smokeBeds: 'Non. King. Doesn\'t matter, I\'m not sleeping, I\'m watching the Weather Channel with the sound off.',
    pay: 'MasterCard. It\'s good. It\'s probably good.',
    vehicle: 'White van, antennas. You can\'t miss it. People think it\'s the TV station. I let them.',
    wants: 'A west window. So I can see it come in. If it comes in.',
    systemWait: ['You feel that? Pressure\'s dropping. My ears. I got barometer ears.', 'Supercell outside Lawton, May of \'95, I got it on tape. Want to see it? I have it on me.'],
    handCard: 'Here. Try it. If it doesn\'t go, I got cash in the van. Some.',
    keyThanks: (p, s, room) => `${room}. Which way's it face? Doesn't matter. I'll go stand in the lot.`,
    farewell: 'If you hear a siren tonight, that\'s not me. I don\'t have a siren. I wanted one.',
  },
  MAGIC: {
    greet: 'Good evening! Good evening. The Amazing Delmar requires a room. The regular Delmar also requires a room. It\'s the same room.',
    name: 'Fitch. Delmar Fitch. On the van it\'s just Delmar. Fewer letters, more mystery.',
    reservation: 'I had one. At the Days Inn in Opelousas. They gave it to a bowling team. I have not recovered.',
    partyNights: 'Just myself. One night. I\'ve got a birthday party in Ville Platte at ten tomorrow and the child has requested doves. I do not have doves.',
    smokeBeds: 'Non. A king. I spread the cards out on the bed and practice. You understand.',
    pay: 'Cash! Which I\'ll produce from your ear. No. From my wallet. It\'s late.',
    vehicle: 'The van. It says THE AMAZING DELMAR on the side. It used to say THE AMAZING DELMAR AND LUCINDA. You can still see where.',
    wants: 'Ground floor, near the van, if possible. The equipment.',
    systemWait: ['Pick a card. No -- don\'t, I just realized I\'m holding the terminal manual. That\'s a joke. That\'s a real joke.', '(shuffles a deck one-handed without seeming to notice)'],
    handCash: (p, s, bills) => `There. ${money(bills)}. Check it's not all the same bill. That was a joke. It isn't.`,
    keyThanks: (p, s, room) => `${room}! Thank you. If you find a card anywhere tonight, it's mine. They get everywhere.`,
    farewell: 'Is the three of clubs on your counter? It was on your counter. Keep it.',
  },
  URN: {
    greet: 'Hi. I need a room with two beds. It\'s just me. I\'ll explain. Or I won\'t, I don\'t have to.',
    name: 'Haskins. Carol.',
    reservation: 'No. We didn\'t know where we\'d stop. Frank always said you don\'t plan a road trip, you just point the car.',
    partyNights: 'Just me. Well. It\'s me and Frank. Frank is -- he\'s here. He\'s in the urn. One night.',
    smokeBeds: 'Non-smoking. Two beds. He always wanted the bed by the door. I know. I know how it sounds.',
    pay: 'American Express. He always said don\'t leave home without it, and then he laughed, every single time.',
    vehicle: 'The gold Oldsmobile. He picked the color. I told him in 1989 it looked like a pudding.',
    wants: 'Near the pool, if you have one. He liked to sit by a pool at night. Just to sit.',
    systemWait: ['Forty-four years. We were going to drive to the Grand Canyon when he retired. So. We are.', 'He\'d have asked you where you\'re from by now. He asked everybody.'],
    keyThanks: (p, s, room) => `${room}. Thank you. Thank you for not making a face.`,
    farewell: 'Good night. Frank says good night. He doesn\'t. But he would have.',
  },
  ENCYC: {
    greet: 'Good evening, young man, good evening. One room, one night, and has anyone in your household considered the gift of knowledge?',
    name: 'Voss. Leonard Voss. Of the Voss family of Baton Rouge, and the Americana Encyclopedia company of Chicago, Illinois.',
    reservation: 'Leonard Voss has never needed a reservation. Leonard Voss has also never been in this town before. It\'s a coincidence.',
    partyNights: 'Just me. And twenty-six volumes, A through Z, plus the yearbook, and an index. One night.',
    smokeBeds: 'Smoking, if you have it. I know. I know. It\'s the one vice. The other one is encyclopedias.',
    pay: 'Cash. Door-to-door is a cash business. People hand you a check, you never see them again. You see the encyclopedias again.',
    vehicle: 'Brown wagon. It rides low. That\'s the books.',
    systemWait: ['They keep telling me the future is the CD-ROM. The whole encyclopedia, on one disc. You can\'t smell a CD-ROM. You can\'t leave a CD-ROM open on the coffee table to show the neighbors.', 'Volume M is the heaviest. You\'d think it\'d be S. It\'s M.'],
    keyThanks: (p, s, room) => `${room}. And if you ever want a volume -- just one -- I carry singles. Don't tell Chicago.`,
    farewell: 'You can\'t smell a CD-ROM. Remember that. Good night.',
  },
  BUDDY: {
    greet: 'Evening. Tri-Parish Paving. Should be four rooms under Guidry. We\'re the crew doing the overlay on 71 -- you heard the rollers, that\'s us.',
    name: 'Guidry. Buddy. No relation to the Guidrys at the diner. Well. Some relation. Everybody\'s some relation.',
    reservation: 'Four rooms, three nights. Company called it in. Voucher\'s right here.',
    partyNights: 'Four of us, four rooms. Three nights, unless it rains, and then it\'s whatever the state says.',
    smokeBeds: 'Smoking if you got it. Downstairs. Together if you can. These boys don\'t do stairs after twelve hours on a roller.',
    pay: 'Company voucher. Tri-Parish. It\'s all on there.',
    vehicle: 'Two white company trucks. TPP on the doors.',
    systemWait: ['We start at five-thirty. Asphalt don\'t wait on anybody.', 'Y\'all got a wake-up call? I\'m gonna need a wake-up call. Four-thirty.'],
    keyThanks: 'Appreciate it. These boys are gonna be asleep before their boots are off.',
    farewell: 'Wake-up\'s four-thirty. Don\'t let me sleep through it. I got a man in Opelousas with a paver and no patience.',
  },
  PRUITT: {
    greet: 'Hi. We need a room. Please. We need a room with two beds, for four people, one of whom has been kicking the back of my seat since Lake Charles.',
    name: 'Pruitt. Ron. That\'s Sherri. Those are the kids. Tyler, stop.',
    reservation: 'No. I thought we\'d make Beaumont. We did not make Beaumont.',
    partyNights: 'Four. Me, Sherri, Tyler, Amber. One night. Houston tomorrow. My mother-in-law\'s.',
    smokeBeds: 'Non-smoking. Two beds. It has to be two beds. It has to be.',
    pay: 'Discover card. Is that -- you take Discover? Tell me you take Discover.',
    vehicle: 'Green minivan. Mississippi plates. There\'s a Garfield on the window. That\'s not mine.',
    wants: 'Do you have a pool? They\'ve been promised a pool. I didn\'t promise it. Somebody promised it.',
    systemWait: ['Sherri, is Amber asleep? She\'s not asleep. Nobody\'s asleep.', 'How far is Houston from here? Don\'t tell me. Don\'t tell me.'],
    keyThanks: (p, s, room) => `${room}. Two beds? Two beds. Thank you. Thank you.`,
    farewell: 'What time\'s breakfast? Six? Is there a waffle machine? Don\'t -- if there is, don\'t tell them.',
    wrongAmount: 'Hold on, it says two nights? One night. One. We are leaving at seven if I have to carry them.',
  },
  SHERRI: { greet: 'Hi. Sorry. It\'s been a long day in a small car.' },
  KID1: { greet: 'Is there a pool? Dad said there\'s a pool.' },
  KID2: { greet: 'I\'m five.' },
  CONNIE: {
    greet: 'Hi -- Delacroix, Delta Medical. I don\'t have a reservation, I was supposed to be in Lafayette tonight and Lafayette had other ideas. One night, one king, non-smoking, upstairs, AAA.',
    name: 'Delacroix. Connie. D-E-L-A-C-R-O-I-X. It\'s on the card.',
    reservation: 'No. Like I said. Lafayette.',
    partyNights: 'Me, one night.',
    smokeBeds: 'Non-smoking. King. Upstairs -- I don\'t like people walking past the window.',
    pay: 'Amex. Corporate. And here\'s the AAA card. I\'m told it\'s ten percent.',
    vehicle: 'Red Taurus. Company car. LA DMS 06. Don\'t judge me by the Taurus.',
    wants: 'Upstairs, quiet. And a wake-up at five-fifteen. I have a hospital in Opelousas at seven and they don\'t wait.',
    systemWait: ['Do you know how many surgical staplers I sold today? Guess. Nine. That\'s good. That\'s actually good.', 'You should see what hospitals pay for a box of gauze. You shouldn\'t. Don\'t.'],
    keyThanks: (p, s, room) => `${room}. Great. Five-fifteen on the wake-up. Please don't forget. People forget.`,
    farewell: 'Is there somewhere that\'s open? Food. Anything with a drive-through.',
  },
  LATENIGHT: {
    greet: 'You still open? You\'re open. Good. I need about five hours in a bed and the chickens need me to be in Memphis by noon.',
    name: 'Hollins. Mike.',
    reservation: 'No.',
    partyNights: 'Me. Till about five-thirty.',
    smokeBeds: 'Smoking. Whatever bed\'s closest to the door.',
    pay: 'Cash.',
    vehicle: 'The red pickup. The rig\'s on the shoulder up the road, I\'m not getting it in your lot.',
    wants: 'Ground floor. Close. I\'m not climbing anything.',
    systemWait: ['(yawns so hard his jaw clicks)', 'Thirty-two thousand chickens. Live. Don\'t think about it.'],
    keyThanks: (p, s, room) => `${room}. Wake-up at five-thirty. I mean it. If I don't get it I'll sleep till Thursday.`,
    farewell: 'Night.',
  },
  HOLLIS: {
    greet: 'Evening. Just paying the week. It\'s Thursday, ain\'t it? Thursday.',
    farewell: 'Night. I\'ll be out on the walk if you need me. You won\'t need me.',
  },
  ABERNATHY: { greet: 'Hello, dear. Is it Thursday?' },
  DARNELL: { greet: 'Evening.' },
  WEXLER: { greet: 'Good evening.' },
  TAMMY: { greet: 'Hey, hon.' },
  DEPUTY: { greet: 'Evening.' },
};

/** Look up a line for a person. */
export function lineFor(p, key, s, ...args) {
  const tables = [p.rosterId && LINES[p.rosterId], p.lines, GENERIC];
  for (const t of tables) {
    if (!t || t[key] === undefined) continue;
    let v = t[key];
    if (typeof v === 'function') v = v(p, s, ...args);
    if (Array.isArray(v)) {
      if (!v.length) continue;
      const k = ((p.lineSeed || 0) + key.length * 7 + (p.lineUses ? (p.lineUses[key] || 0) : 0)) % v.length;
      if (p.lineUses) p.lineUses[key] = (p.lineUses[key] || 0) + 1;
      v = v[k];
    }
    if (v) return v;
  }
  return '';
}

export { first, last, withYou, nightsWord, partyWord };
