/* ============================================================
   chatter.js -- what people say when they are not talking to you.

   Barks are single lines somebody says near you: waiting at the
   desk, sitting down to breakfast, on the walk with a cigarette.
   Exchanges are two or three people at a table talking to each
   other, which is most of what a motel breakfast room is. Nobody
   is plot. Somebody is always about the weather.

   Also here: what is in tomorrow's Ledger, and what is on the
   breakfast television.
   ============================================================ */

export const BARKS = {
  wait: ['Hello?', 'Anybody working?', '(rings the bell again, apologetically)', 'I\'ll just... wait here.', 'Hello-o?'],
  waitLong: ['I\'ve been standing here a while.', 'Is there somebody I can call? Is that you?', 'I can hear the phone ringing. That\'s you, right? The phone?'],
  greet: ['Evening.', 'Hi there.', 'Hey.', 'Evening. Busy night?'],
  sitDown: ['(sets down a plate with great care)', 'Whew.', 'Now then.', '(pulls the chair out with a scrape)', 'Is anybody sitting -- no? Good.'],
  coffeeOld: ['This coffee\'s been here a while.', 'Coffee tastes like the pot.', 'Hm. That\'s last night\'s coffee.'],
  coffeeBurnt: ['This coffee is burnt. Like, on purpose burnt.', 'Oh, that\'s -- somebody needs to make a new pot.'],
  coffeeWeak: ['This coffee\'s see-through.', 'I can read the paper through this coffee.'],
  coffeeStrong: ['Whoo. That\'ll put hair on the carpet.', 'This coffee could strip a boat.'],
  coffeeEmpty: ['Coffee\'s out.', 'Is there more coffee? There\'s no more coffee.', 'The pot\'s empty. Somebody drank the pot.'],
  short: { pastry: 'No muffins left?', bagels: 'Out of bagels.', cereal: 'They\'re out of the good cereal. And the bad cereal.', fruit: 'No bananas. Just the one apple nobody wants.', juice: 'Juice is empty.', waffle: 'No batter for the waffles.' },
  waffleSmoke: ['Is that smoke? Is the waffle thing supposed to smoke?', 'Uh -- hey. Hey. The waffle.', 'It\'s doing a thing. The waffle maker\'s doing a thing.'],
  waffleStuck: ['It won\'t come out. It\'s welded in there.', 'My waffle is part of the machine now.'],
  waffleOff: ['How do you turn this waffle thing on?', 'Is the waffle iron broke or off?'],
  spill: ['Oh -- sorry! Sorry.', 'Oops. I got it. I don\'t got it.', 'Tyler!'],
  porch: ['(taps ash over the railing)', 'Nice night.', 'Hot one today.', '(nods at you)'],
  ice: ['Machine\'s working tonight. That\'s something.', '(ice rattles into the bucket)'],
  iceBroke: ['Ice machine\'s broke.', 'Nothing. It hums and then nothing.'],
  vendAte: ['It took my money.', 'Come on. Come on.', '(hits the machine, politely)'],
  lot: ['Which one\'s ours?', 'Did you lock it?', 'I locked it. I\'m going to go check.'],
  pool: ['(looks at the pool for a while)', 'Pool\'s closed, I guess.'],
  morning: ['Morning.', 'Mornin\'.', 'Morning. Coffee on?'],
  channel: { NEWS: 'Could we get the news on?', WEATHER: 'Can you put the Weather Channel on? I need to see the local on the eights.', CARTOONS: 'Can we watch cartoons? Please? Please?', INFOMERCIAL: 'Leave it. I want to see if the knife cuts the shoe.' },
  channelThanks: ['Thank you.', 'There we go.', 'Yes!'],
};

/* Two or three people at a table. `a` and `b` are roster ids or tags;
   `need` lists ids that must both be seated at the same table. */
export const EXCHANGES = [
  { need: ['EARL', 'WEXLER'], lines: [['EARL', 'Is the coffee fresh, you think?'], ['WEXLER', 'It is fresh-ish. "Fresh" admits no degrees, but this coffee is making an attempt.'], ['EARL', 'You taught school.'], ['WEXLER', 'Thirty-one years.'], ['EARL', 'I can tell. I mean that nice.']] },
  { need: ['EARL', 'CONNIE'], lines: [['EARL', 'What do you sell?'], ['CONNIE', 'Surgical supplies. Staplers, mostly. You?'], ['EARL', 'Fryers. Commercial.'], ['CONNIE', 'So we\'re both in the business of what happens after the diner.'], ['EARL', '(a long, appreciative pause) That\'s dark. I like that.']] },
  { need: ['KYLE', 'DANA'], lines: [['DANA', 'Did you call Lloyd?'], ['KYLE', 'I called Lloyd.'], ['DANA', 'What did Lloyd say?'], ['KYLE', 'Lloyd said "huh."'], ['DANA', '(puts her face in her hands, gently, the way you would set down something breakable)']] },
  { need: ['KYLE', 'EARL'], lines: [['KYLE', 'You know anything about joists?'], ['EARL', 'I know you want more of them than you think.'], ['KYLE', 'That\'s what I\'m -- that\'s exactly what I\'m worried about.']] },
  { need: ['VERNA', 'OTIS'], lines: [['OTIS', 'That video place on Main charged me six dollars for a late tape.'], ['VERNA', 'They did the same to me in the spring. I wrote a letter.'], ['OTIS', 'Did they write back?'], ['VERNA', 'They did not. Which tells you everything.']] },
  { need: ['MAGIC', 'KID1'], lines: [['MAGIC', 'Young man. Is this your card?'], ['KID1', 'I didn\'t pick a card.'], ['MAGIC', 'Then how did I know it was the four of hearts?'], ['KID1', '...Mom. MOM.']] },
  { need: ['MAGIC', 'KID2'], lines: [['MAGIC', 'Pick a card. Any card.'], ['KID2', '(takes the whole deck)'], ['MAGIC', 'That\'s -- all right. That works too. That\'s a trick.']] },
  { need: ['STORM', 'EARL'], lines: [['STORM', 'You see the sky out there? Shelf cloud. Beautiful.'], ['EARL', 'I saw it. I\'m driving into it.'], ['STORM', 'Lucky.'], ['EARL', 'That\'s not the word I had.']] },
  { need: ['HOLLIS', 'DARNELL'], lines: [['HOLLIS', 'Pipeline still running you to Cameron?'], ['DARNELL', 'Cameron, Hackberry, back to Cameron.'], ['HOLLIS', 'I hauled out of Hackberry in \'71. There was a café there did a catfish.'], ['DARNELL', 'Still there.'], ['HOLLIS', '(pleased) Still there.']] },
  { need: ['ABERNATHY', 'URN'], lines: [['ABERNATHY', 'Forgive me. Is that your husband?'], ['URN', 'Frank. Forty-four years.'], ['ABERNATHY', 'Forty-one, for me. Walter. He had the bed by the door.'], ['URN', '(a small laugh, surprised) So did Frank.'], ['ABERNATHY', 'They all do, dear. They think they\'re guarding something.']] },
  { need: ['ENCYC', 'PRUITT'], lines: [['ENCYC', 'Children that age are sponges. Sponges. Twenty-six volumes of sponge food.'], ['PRUITT', 'We\'re driving to Houston.'], ['ENCYC', 'The Houston entry is extensive.'], ['PRUITT', 'Sherri, is it time to go? It\'s time to go.']] },
  { need: ['ENCYC', 'WEXLER'], lines: [['ENCYC', 'A man of letters. I can always tell.'], ['WEXLER', 'I have an encyclopedia.'], ['ENCYC', 'Which edition?'], ['WEXLER', '1961.'], ['ENCYC', '(gently, like a doctor) Pluto has been discovered to have a moon.']] },
  { need: ['CONNIE', 'STORM'], lines: [['STORM', 'You\'re heading east? Don\'t head east.'], ['CONNIE', 'I have a hospital in Opelousas at seven.'], ['STORM', 'Then God bless you and your wipers.']] },
  { need: ['BUDDY', 'HOLLIS'], lines: [['BUDDY', 'Mr. Tate. Still smoking those Pall Malls?'], ['HOLLIS', 'Still paving that same mile?'], ['BUDDY', 'Different mile. It just looks the same.']] },
  { need: ['PILLOWS', 'EARL'], lines: [['EARL', 'Sleep all right?'], ['PILLOWS', 'Very well, thank you.'], ['EARL', '...Good.'], ['PILLOWS', 'Yes.']] },
  { need: ['WEXLER', 'VERNA'], lines: [['VERNA', 'Did you see the rate card? "Continetal."'], ['WEXLER', 'I have been staying here nine years, madam. I have seen the rate card.'], ['VERNA', 'And?'], ['WEXLER', 'I am taking it one sign at a time.']] },
  { need: ['KID1', 'KID2'], lines: [['KID1', 'I\'m having four waffles.'], ['KID2', 'You can\'t have four waffles.'], ['KID1', 'Watch me.'], ['KID2', 'MOM, HE\'S HAVING FOUR WAFFLES.']] },
];

/* Generic breakfast talk for strangers sharing a table. */
export const SMALLTALK = [
  [['a', 'Where you headed?'], ['b', 'Houston. You?'], ['a', 'Other way.']],
  [['a', 'They say rain.'], ['b', 'They always say rain.']],
  [['a', 'These muffins are all right.'], ['b', 'They\'re from a box.'], ['a', 'A good box.']],
  [['a', 'You staying another night?'], ['b', 'Lord, no.'], ['a', 'Me either. Nice place, though.'], ['b', 'Oh, it\'s fine. It\'s fine.']],
  [['a', 'Is that the news? Turn it up.'], ['b', 'It\'s the same news as yesterday.']],
];

/* ---------------- The Delphine Ledger ---------------- */
export const HEADLINES = [
  { h: 'PARISH COUNCIL TABLES STOP-SIGN VOTE FOR FOURTH MONTH', sub: 'Residents of Oak Street "tired of stopping on principle"' },
  { h: 'SWEET POTATO FESTIVAL QUEEN CROWNED', sub: 'Runner-up "very gracious," says festival chair' },
  { h: 'HWY 71 OVERLAY TO CONTINUE THROUGH NOVEMBER', sub: 'DOTD asks motorists for patience; motorists decline' },
  { h: 'DELPHINE WILDCATS FALL TO MANY, 21-20', sub: 'Coach cites "a bad hold, and also the weather"' },
  { h: 'LIBRARY FINE AMNESTY NETS 311 BOOKS, ONE ACCORDION', sub: '' },
  { h: 'LOCAL MAN GROWS 41-POUND SQUASH', sub: '"I talk to it," he says. "Mostly about football."' },
  { h: 'WATER TOWER REPAINT BIDS DUE FRIDAY', sub: 'Council split on "Delphine blue" versus "regular blue"' },
  { h: 'FRONT TO BRING STORMS, COOLER AIR', sub: 'Highs in the 70s by Saturday' },
  { h: 'CHURCH SUPPER RAISES $2,400 FOR NEW ROOF', sub: 'Jambalaya sold out by 6:15' },
  { h: 'SUNSET VIDEO ANNOUNCES "NO QUESTIONS" LATE-FEE WEEK', sub: 'Manager: "Some questions."' },
];
export const INSIDE = [
  'Classifieds: 1984 Bass boat, needs motor, needs trailer, needs work. $400 OBO.',
  'Police blotter: A cow was reported "in the road, again" on Parish Road 12. Owner contacted.',
  'Obituaries, Births, and the lunch menu at Delphine Elementary (Friday: fish sticks).',
  'Dear Abby: my brother-in-law parks in my spot.',
  'Weather: Thunderstorms likely before 8 AM, clearing by noon. Winds W 10-15.',
];

/* ---------------- the breakfast television ---------------- */
export const TV = {
  NEWS: ['...rain moving across the state this morning, heaviest along the 49 corridor...', '...the Dow closed up eleven points yesterday...', '...and in Shreveport, a dog has been named honorary fire chief...'],
  WEATHER: ['LOCAL ON THE 8s: DELPHINE -- 64° -- T-STORMS LIKELY -- WIND W 12', '...a line of strong storms will push through central Louisiana between five and seven...', '(smooth jazz, and the radar, forever)'],
  CARTOONS: ['(something is chasing something else, loudly)', '(a talking sponge? no -- a talking dog. with a car.)', '(anvil)'],
  INFOMERCIAL: ['...BUT WAIT. It cuts through a SHOE. Could your knife cut through a SHOE?', '...three easy payments of $19.95...', '...I lost thirty pounds and my marriage, and I\'m HAPPY...'],
};
