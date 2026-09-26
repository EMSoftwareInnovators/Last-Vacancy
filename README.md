# LAST VACANCY

*Starlite Motor Lodge · Highway 71 · Delphine, Louisiana · October 1997 · the night desk.*

A first-person night-clerk simulator. Seven at night to seven in the morning: check people
in, take their money, hand them the right key, answer two phone lines, bring towels to 207,
call the wake-ups, run the night audit at three, make the coffee, stack the papers, survive
the waffle iron, and hand the desk to Travis when he asks if it was a quiet night.

It is a spiritual successor to [Final Rental](https://github.com/EMSoftwareInnovators/Final-Rental)
and runs on the same engine (see [`docs/ENGINE_REUSE.md`](docs/ENGINE_REUSE.md) for what was
reused, what was adapted, and what is new). There is no horror in it. It is a motel.

## Running it

```sh
npm install        # only needed for the Electron build and the headless tools
npm start          # serves the game at http://localhost:8080
```

Or open `index.html` through any static file server. `npm run app` runs it in Electron,
`npm run dist` builds a desktop package.

## Working the desk

| | Keyboard / mouse | Pad |
|---|---|---|
| Walk / look | WASD, mouse | left stick, right stick |
| Hurry | Shift | either trigger |
| Use / talk / take | E | A / ✕ |
| Pick a reply | 1–6, or arrows + E | d-pad + A |
| Put something down / flip a tab on the rack | G | X / □ |
| Step away from the rack, the terminal, a paper, a shelf or a machine | Q (or Backspace) | B / ○ |
| Notepad | Tab | Y / △ |
| Sit on the stool (the night goes faster) | F | RB / R1 |
| Pause | Esc | Start |
| Terminal | F1–F5 or 1–5, arrows, ENTER, Q to go back | d-pad, A, B |

Escape only ever pauses: while the mouse is held, browsers keep that key for themselves, so
nothing in the motel waits on it. Every binding can be moved on the controller screen in
Options; sensitivity, invert Y, volumes, text speed, subtitles and their size, resolution and
the screen effects are all saved.

**A check-in**: talk to the guest and ask what you need (name, how many, how long, smoking,
beds, how they are paying) → the terminal, **F1**, check the form, ENTER → tell them the
total and take the money (cash to the register, a card through the imprinter, a voucher
against the binder) → the key off the rack behind you → across the counter.

## What is in a night

- 28 rooms that are not alike: 104's air conditioner, 108 next to the ice machine, 110 that
  smells like 1974, 112's new carpet, 201's television, 207's shower, and 213, which is a
  number.
- A room rack and a property system that are allowed to disagree, and an audit at three that
  notices.
- Regulars who remember you (Earl Maddox, Thursdays, room 105, *is the coffee fresh?*), the
  Mercers and their house, Mr. Wexler and the sign, Tammy from Peg's Diner across the road,
  weekly residents, and people you will tell somebody about: nine pillows, a storm chaser, a
  magician, a woman traveling with her husband's ashes, the last encyclopedia salesman.
- Your first night is the first night of the job, and June Whitfield, the owner, works it with
  you. She gives you the tour before anybody arrives (the desk, the back office, the pantry,
  breakfast, the machines, where you fill your first column of Coke and pull your first coin
  box, the laundry, and back to the register), then follows you all night: out of the way at
  the end of the desk, on the walk while you are in a room. Talk to her and she answers
  questions, tells you what needs doing, and walks you to it if you ask. She goes home at a
  quarter to seven; after that she is a note on the desk. (Worked a desk before? Tell her, and
  she skips the tour.)
- The vending machines are yours: the drink and snack machines in the alcove by the ice, and
  the soap machine in the guest laundry. They sell down all night. Open one to see what is out,
  carry a case or a box over from the shelf in the supply room next door, and load it. When a
  machine is full, the coin box comes out, and the coins go in the register, where the audit
  expects them. An empty column, a coin box too full to take a quarter, or a drink machine
  that keeps somebody's money all bring a guest to the desk.
- Groups from the second night: the paving crew, a twelve-and-under travel team, a tour bus.
- The phone: towels, remotes, wrong numbers, somebody's sister, somebody's mother-in-law, a
  man who would like a large pepperoni.
- Breakfast from six: the Deluxe Continental, which means two kinds of muffin.
- A handwritten note from the owner, June Whitfield, at the start of every shift. No stars.

Each night is re-rolled; CONTINUE picks up the next evening with the same motel, the same
people, and everything they remember.

## Project layout

```
src/engine/          Final Rental's engine: software rasterizer, post, input, audio, save
src/game/world/      the Starlite on paper (layout.js) and as meshes, collision, nav, doors, light
src/game/sim/        clock, rooms, ledger, phone, desk, tasks, property, vending, breakfast, cars,
                     NPCs, barks, the director that plans each night, and June's first night
src/game/dialogue/   the desk (check-in, payment, keys, checkout, complaints), phone calls, cast,
                     June
src/game/content/    who comes (people, travelers, groups), how they talk, overheard talk, notes
src/game/ui/         HUD, menus, the terminal, the key rack, papers and shelves, the machines
src/game/shift.js    one night: focus, the systems in order, the hooks, the HUD, the handoff
```

## Checking it

The tools drive the real game in the pre-installed headless Chromium:

```sh
npm run check                      # boot + a simulated hour, then four check-ins by keyboard
node tools/autopilot.mjs           # a clerk plays a whole shift through the game's systems
node tools/autopilot.mjs --shifts=4            # June's first night, then crew, ball team, bus
node tools/autopilot.mjs --sloppy              # wrong keys, missed wake-ups: see the audit
node tools/autopilot.mjs --novend --shifts=3    # never touch the machines: see who comes down about it
node tools/locktest.mjs                         # Escape, Q and the mouse
node tools/tourtest.mjs                         # night one: June's tour, start to finish
node tools/uishots.mjs             # screenshots of the note, desk, dialogue, terminal, rack, phone
```

© 2026 EM Software Innovators.
