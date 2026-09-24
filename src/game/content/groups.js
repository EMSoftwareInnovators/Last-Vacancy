/* ============================================================
   groups.js -- the nights somebody books half the motel.

   A group is one person at the desk with a list and a lot of
   people in the lot behind them. The system checks the whole block
   in at once, the rack gives up a fistful of keys, and in the
   morning the breakfast room gets hit by a weather system.

     CREW  Tri-Parish Paving: four rooms, weeknights, a voucher, a
           four-thirty wake-up, gone by five-thirty-five.
     TEAM  A twelve-and-under travel baseball team back from a
           tournament: fourteen rooms, one tired coach, a booster
           club Visa, and three pots of coffee gone by six-twenty.
     BUS   Bayou Star Tours: ten rooms of retirees doing the fall
           casinos, a tour guide with a clipboard, a driver named
           Otto who gets his room free, and a breakfast that starts
           at five-fifty whether it is open or not.
   ============================================================ */
import { Clock } from '../sim/clock.js';

const at = Clock.at;
const H = (id, name, hex, dark, style, styleName) => ({ id, name, hex, dark, style, styleName: styleName || style });
const J = (id, name, hex, kind) => ({ id, name, hex, kind });
const C = (id, name, hex) => ({ id, name, hex });

export const GROUPS = {
  TEAM: {
    id: 'TEAM', name: 'ACADIANA STORM 12U', title: 'Acadiana Storm 12U (Coach Fontenot)',
    rooms: 14, nights: 1, beds: 'QQ', arrive: [at(21, 40), at(22, 15)], visible: 8, virtualDiners: 26,
    breakfast: [at(6, 0), at(6, 35)], checkout: [at(6, 45), at(6, 55)], note: 'CARD (BOOSTER CLUB). 2 QUEENS. KEEP THEM TOGETHER.',
    leader: {
      id: 'COACH', name: 'Darrell Fontenot', tag: 'coaches twelve-and-under baseball', kind: 'group', seed: 0xC0AC4,
      app: {
        gender: 'm', height: 'average', build: 'heavy', facial: 'goatee', glasses: 'none', hat: 'cap', gait: 'normal', carry: 'none', voice: 'loud',
        hair: H('brown', 'dark brown', '#3d2a1a', '#2a1c11', 'short'), jacket: J('navy', 'navy', '#1e2a4a', 'windbreaker'),
        shirt: C('teal', 'teal', '#1c5157'), pants: C('gray', 'gray', '#4a4a50'), skin: '#d8ab84',
      },
      stay: { party: 1, nights: 1, beds: 'QQ', smoking: false, pay: 'CARD', card: { type: 'VISA', name: 'ACADIANA STORM BOOSTER', exp: '05/99' }, rateCode: 'RACK', reservation: true },
      lines: {
        greet: 'Evening. Fontenot, Acadiana Storm, twelve-and-under. We\'ve got fourteen rooms. Please tell me we\'ve got fourteen rooms. We lost in the semis on a balk call and I have been in a van with that balk call for two hours.',
        reservation: 'Booked in August. Fourteen rooms, two queens each, all together if you can. The booster club Visa\'s paying, don\'t let any of these parents tell you different.',
        partyNights: 'Fourteen rooms, about forty people, most of them twelve. Just tonight. We play at nine in Alexandria.',
        smokeBeds: 'Non-smoking. Two queens. Every room. They pile in.',
        pay: 'Booster club Visa. Here. The treasurer made me sign a thing saying I would not buy anything else with it. I bought gas. Don\'t tell her.',
        systemWait: ['Tyler! Put the -- put it back. Put the ice bucket back.', 'Is the pool open? Don\'t tell me. If it\'s open they\'ll hear you.', 'It was a balk. It was not a balk. Everybody saw it was not a balk.'],
        keyThanks: 'Thank you. Thank you. If anybody calls about noise, it\'s not us. It\'s us. I\'m sorry in advance.',
        farewell: 'Six o\'clock breakfast? They\'ll be there at five fifty-nine. Make more coffee than you think. Then make more.',
        checkout: 'That\'s all fourteen keys. I think it\'s fourteen. Somebody count them. Not me.',
        checkoutThanks: 'Thank you for putting up with us. The waffle thing -- I\'m sorry about the waffle thing.',
      },
      members: [
        { name: 'Paula Broussard', gender: 'f', tag: 'team mom' }, { name: 'Wayne Hebert', gender: 'm', tag: 'a dad, holding the scorebook' },
        { name: 'Renee Guilbeau', gender: 'f', tag: 'a mom with a cooler' },
        { name: 'Tyler Broussard', gender: 'm', child: true, tag: 'shortstop' }, { name: 'Cody Hebert', gender: 'm', child: true, tag: 'catcher' },
        { name: 'Jace Guilbeau', gender: 'm', child: true, tag: 'left field, mostly' }, { name: 'Blake Thibodeaux', gender: 'm', child: true, tag: 'pitcher. It was not a balk.' },
        { name: 'Mason Landry', gender: 'm', child: true, tag: 'right field, unfortunately' },
      ],
      vehicles: [{ color: 'white', kind: 'van', desc: 'White van, STORM BASEBALL on the back glass', plate: 'LA 12U 001' }, { color: 'blue', kind: 'wagon', desc: 'Blue minivan', plate: 'LA 7PB 332' }, { color: 'red', kind: 'wagon', desc: 'Red minivan', plate: 'LA 3HB 918' }, { color: 'gold', kind: 'wagon', desc: 'Gold minivan', plate: 'LA 5RG 207' }],
    },
  },
  BUS: {
    id: 'BUS', name: 'BAYOU STAR TOURS', title: 'Bayou Star Tours (Peggy Lamartiniere)',
    rooms: 10, nights: 1, beds: 'QQ', arrive: [at(20, 5), at(20, 35)], visible: 7, virtualDiners: 12,
    breakfast: [at(5, 50), at(6, 25)], checkout: [at(6, 35), at(6, 45)], note: 'VOUCHER, BAYOU STAR. DRIVER COMP. WAKE-UP 5:30 ALL ROOMS.',
    leader: {
      id: 'GUIDE', name: 'Peggy Lamartiniere', tag: 'Bayou Star Tours, tour escort', kind: 'group', seed: 0xB05E,
      app: {
        gender: 'f', height: 'short', build: 'average', facial: 'clean', glasses: 'round', hat: 'none', gait: 'brisk', carry: 'briefcase', voice: 'loud',
        hair: H('red', 'red', '#8a3a1c', '#642713', 'curly', 'red, and a great deal of it'), jacket: J('teal', 'teal', '#1c5157', 'blazer'),
        shirt: C('white', 'white', '#c8c4b4'), pants: C('navy', 'navy', '#1e2a4a'), skin: '#e8c39e',
      },
      stay: { party: 1, nights: 1, beds: 'QQ', smoking: false, pay: 'VOUCHER', account: 'BAYOUSTAR', rateCode: 'CORP', reservation: true },
      lines: {
        greet: 'Good evening! Bayou Star Tours, Fall Foliage and Casinos, day four of six. Ten rooms under Bayou Star, and the driver\'s is comp -- that\'s Otto, he\'s parking the bus, he\'ll be a minute, he\'s very thorough about the bus.',
        reservation: 'Ten rooms, all two queens, the voucher\'s right here. It\'s all on the rooming list. I have typed it and I have typed it again.',
        partyNights: 'Twenty-two of us including me and Otto. One night. Natchez tomorrow, the paddlewheel.',
        smokeBeds: 'Non-smoking. Mrs. Dupuis will want to be near the ice machine, and Mr. Dupuis will want to be far from it. Put them anywhere. They\'ll trade.',
        pay: 'Company voucher. Bayou Star. You have an account with us -- we\'re in your binder. We\'re in everybody\'s binder.',
        systemWait: ['They\'ve been on the bus since Lake Charles. They\'re mostly asleep. The ones who aren\'t asleep are going to ask you about the pool.', 'Could you do a wake-up call to every room at five-thirty? I know. I know. They like it. It\'s part of the trip for them.'],
        keyThanks: 'Wonderful. Wonderful. I\'ll hand these out on the bus like party favors.',
        farewell: 'Breakfast at six? They\'ll be in there at five-fifty with their coats on. Just so you know.',
        checkout: 'All ten keys, counted twice, and one room is missing a towel, and I am going to find out who.',
        checkoutThanks: 'Thank you, dear. You were lovely. Otto says the lot was very easy to turn around in, and Otto does not say that.',
      },
      members: [
        { name: 'Otto Guidroz', gender: 'm', tag: 'drives the bus, very thoroughly' }, { name: 'Alma Dupuis', gender: 'f', tag: 'wants to be near the ice machine', old: true },
        { name: 'Lucien Dupuis', gender: 'm', tag: 'wants to be far from it', old: true }, { name: 'Edna Robichaux', gender: 'f', tag: 'on her fourth tour this year', old: true },
        { name: 'Myrtle Savoie', gender: 'f', tag: 'won eleven dollars in Lake Charles', old: true }, { name: 'Hubert Savoie', gender: 'm', tag: 'lost the eleven dollars', old: true },
        { name: 'Inez Boudreaux', gender: 'f', tag: 'has a question about the pool', old: true },
      ],
      vehicles: [{ color: 'white', kind: 'bus', side: 'bus', desc: 'Bayou Star Tours motorcoach', plate: 'LA BUS 44' }],
    },
  },
};

/** Lines group members say at breakfast, to each other or to nobody. */
export const GROUP_CHATTER = {
  TEAM: [
    [['a', 'It was a balk.'], ['b', 'It was NOT a balk.'], ['a', 'Coach said it was a balk.'], ['b', 'Coach says a lot of things.']],
    [['a', 'How many waffles have you had?'], ['b', 'Four.'], ['a', 'You can have five. Nobody said you can\'t have five.']],
    [['a', 'Is there more coffee? For the grownups?'], ['b', 'There was.']],
  ],
  BUS: [
    [['a', 'Did you sleep?'], ['b', 'Like a rock. The ice machine went off every twenty minutes.'], ['a', 'That\'s what I said. Like a rock.']],
    [['a', 'Eleven dollars, in Lake Charles.'], ['b', 'You lost it in Lake Charles too.'], ['a', 'I was up eleven dollars, Hubert.']],
    [['a', 'Is the pool open?'], ['b', 'Inez, it\'s six in the morning.'], ['a', 'I\'m only asking.']],
  ],
};
