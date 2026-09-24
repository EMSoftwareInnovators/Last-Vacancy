# Last Vacancy — what comes from Final Rental, and what does not

Last Vacancy is built on the Final Rental codebase. Final Rental is not a
reference here, it is the engine: its renderer, its character pipeline, its
dialogue model, its input stack and its UI conventions are carried over and
extended, not re-invented. This file records exactly what was reused, what had
to change to fit a motel instead of a video store, and what is new.

Source inspected: `EMSoftwareInnovators/Final-Rental` at `5946346`.

---

## 1. Reused directly (copied, unchanged or near-unchanged)

| Final Rental file | In Last Vacancy | Notes |
|---|---|---|
| `src/engine/mathx.js` | `src/engine/mathx.js` | Verbatim. 3x4 affine matrices, seeded xorshift RNG. |
| `src/engine/mesh.js` | `src/engine/mesh.js` | Verbatim. `MeshBuilder` quads, subdivided plates, lofted solids, boxes, merge. |
| `src/engine/raster.js` | `src/engine/raster.js` | Verbatim. Software rasterizer: vertex snap, affine UVs, baked vertex shade + fog, `F_EMIT/F_BLEND/F_ADD/F_DOUBLE`. |
| `src/engine/postfx.js` | `src/engine/postfx.js` | Verbatim. Dither, scanlines, vignette, optional VHS damage. Defaults changed in the game, not here. |
| `src/game/actor.js` | `src/game/actor.js` | Lofted low-poly humans, shared animation driver. Extended with a seated pose and a few carried props (see 2). |
| `src/game/appearance.js` | `src/game/appearance.js` | Trait tables, 128x128 skin atlas painter, 64x64 portrait painter, names. Extended with motel-appropriate garments/props. |
| `specials.js` `fixedApp()` | `src/game/content/people.js` | The authored-character recipe: a locked appearance spec + seed = the same face every visit. Every named person in Last Vacancy is made this way. |
| `dialogue.js` `DialogueRunner`, `say`, `reply` | `src/game/dialogue/runner.js` | Verbatim. Closure-built nodes that read live state; `risk/cost/good` reply tags. |
| `ui.js` glyph system, dialogue box, phone pad, panels, options, controller screen | `src/game/ui/*.js` | Button-glyph table (keyboard / Xbox / PlayStation), typewriter dialogue with voice blips and portrait, paper "pad" panels, options and controller rebinding screens are carried over. |
| `input.js` | `src/engine/input.js` | Keyboard, pointer lock, gamepads, stick-to-menu navigation, known-layout table, rebinding with multiple actions per button. Only the action table changed (see 2). |
| `serve.cjs`, `electron/main.js` | same paths | Zero-dependency dev server and the `game://` protocol desktop wrapper. Strings renamed. |
| `style.css` structure | `src/style.css` | `cqw`-scaled 4:3 cabinet, layer model, pad panels, dialogue box, key caps. Palette and title changed. |
| `tools/*.mjs` harness pattern | `tools/*.mjs` | Headless Chromium drives the real game through `window.__game` and real key presses. |

## 2. Reused with adaptation

| System | Final Rental | Last Vacancy change | Why |
|---|---|---|---|
| Audio (`audio.js`) | Synth voices, beds, dread drone, stingers, jumpscare | Primitive voices (`tone`, `noise`, envelopes, spatial pan) and the room-tone bed kept. Dread bed, stingers, heartbeat, jumpscare, siren, tape-chew **removed**. Added a motel library: desk bell, multi-line phone warble, key jingle, imprinter chunk, dot-matrix printer, CRT whine, coffee brew, waffle iron, ice machine, vending hum, AC units, pool pump, highway traffic, trucks, car doors, birds, newspaper thump. Separate effects / ambience volume. | No horror in this phase. |
| Textures (`texture.js`) | One store texture set in the engine file | Engine file keeps `makeTex`, `texFromCanvas` and the drawing helpers (`fill`, `noise`, `speckle`, `grime`) and adds `repaintTex` for live textures. The motel's texture set lives in `src/game/world/textures.js`. | Engine vs. content split. |
| World (`world.js`) | One baked static mesh, one floor, one hard-coded nav graph | `src/game/world/*`: the same builder idioms (subdivided walls, tile-by-tile floors, dealt-out wall/ceiling variants, `hash2`, sign plates, baked `lightAt`) but the motel is split into **chunks** with bounds, culled per frame, and room interiors are only drawn when they can be seen. Collision has **levels** and **stairs** (two-storey walkways). The nav graph is generic Dijkstra fed by a node list built from the floor plan. Doors are a generic list rather than two named doors. | 28 rooms on two floors would not fit one draw call or one flat plane. |
| Player (`player.js`) | Carries up to three tapes, cash in hand | Same controller, head bob, raycast. Adds floor level / height, generic held items (keys, towels, cards, slips, supplies, newspaper bundle), and the cash-in-hand / change model unchanged. | Motel job has more than one kind of thing to carry. |
| Customer state machine (`customer.js`) | Browse → line → counter → leave | `src/game/sim/npc.js` keeps its movement code (`step`, `directStep`, path following, footsteps, anim driving) and replaces the store states with schedule-driven motel states (arrive by car, desk, walk to room, in room, errands, breakfast, checkout, drive off). | Guests live here for a night, or for months. |
| Money (`game.js` cash/drawer/change) | Bill in hand → ring up → count change → hand back | Kept as-is for cash and traveler's checks. Added card imprinter slips, corporate vouchers, travel-book coupons, and folio postings for the night audit. | 1997 motel payments. |
| Phone (`dialogue.js buildPhoneCall`, `ui.showPhone`) | One outgoing line to dispatch | Same paper phone pad UI. Now a two-line console with HOLD, TRANSFER, ROOM and WAKE-UP, incoming calls with ring timeouts, callers with patience. | The desk phone is a core loop. |
| Notepad (`Tab`) | Suspect bulletin vs. person in view | Your own pocket notepad: the things you have promised people tonight. | Same button, same paper, ordinary content. |
| Action `bolt` (`F`) | Throw the back-room bolt | Replaced by `wait`: sit on the desk stool and let a quiet stretch pass faster until something needs you. | No bolts needed. |
| End-of-night report | Score and letter grade | Replaced with a handwritten note from the owner the next evening. No stars, no grades. | Brief: performance must be communicated naturally. |
| Options | Pad bindings saved; everything else lost on reload | All settings persisted, plus effects/ambience volume, text speed, overheard-talk subtitles, subtitle size. Polygon jitter and VHS damage default **off**. | Settings persistence; avoid unpleasant warping. |

## 3. New in Last Vacancy

- **Shift clock with periods** (`sim/clock.js`): 7 PM–7 AM, busy periods run slower in real time, quiet ones faster, conversations run the clock at half speed.
- **Room model** (`sim/rooms.js`): 28 rooms with traits (quiet, noisy AC, near ice, smell, renovated, poolside, TV reception, weak shower, adjoining pair, smoking), status, occupant, issues, key location.
- **Key rack / room board**: physical keys on hooks with status tabs, live texture on the wall and a close-up view.
- **Property system** (`ui/terminal.js`): STARLITE MOTOR LODGE PROPERTY SYSTEM v2.4: F1 check-in, F2 check-out, F3 rooms, F4 reservations, F5 night audit.
- **Payments**: cash and change, credit card imprinter (hold to chunk), traveler's checks, corporate vouchers against an account list, travel-book coupons with conditions.
- **Phone console** with two lines, hold, transfer, privacy flags (DO NOT DISCLOSE), room calls and wake-ups.
- **Requests and property tasks** (`sim/tasks.js`): deliveries, fixes (TV, AC, toilet, bulb, remote batteries, breaker), rollaway, noise complaints, vending refill and refunds, ice machine, pool gate, laundry, trash, spills.
- **Wake-up sheet** on the counter.
- **Night audit** worksheet comparing the system against the drawer, the slip box and the key rack.
- **Breakfast**: pantry inventory, coffee (regular / decaf / hot water, freshness read through dialogue), juice, stocked trays, waffle station with occasional chaos, newspapers to fetch and cut, breakfast TV channels, spills, trash.
- **Shift director** (`sim/director.js`, `content/shifts.js`): data-driven nights, reservations, walk-ins, group bookings, phone calls and events with preconditions and time windows; seeded so each replay differs.
- **Persistent memory** (`engine/save.js`, `sim/memory.js`): guest histories, room assignments, relationships, residents, inventory, the owner's notes.
- **Overheard talk** (`sim/barks.js`): NPC-to-NPC exchanges shown as subtitles within earshot.
- **Staff**: the owner's notes, the housekeeper, the morning clerk and the handoff.

## 4. Deliberately not carried over

Everything that belongs to Final Rental's horror: the killer, the deputy's
bulletin, identification notepad, arrests, deaths, endings, tension/distress
post effects, dread audio. The motel is just a motel for now.

## 5. Implementation plan (as executed)

1. Scaffold from the Final Rental engine (this document, copied engine, dev server, Electron).
2. Motel world: layout data → chunked meshes, doors, levels/stairs, collision, nav graph, lighting.
3. Player, held items, interaction targets, HUD.
4. Room model, key rack, property terminal, payments and drawer.
5. Phone console, wake-ups, requests and tasks.
6. NPC runtime, characters through the Final Rental appearance pipeline, dialogue.
7. Shift director and events; weekly residents; overheard exchanges.
8. Night audit, newspapers, breakfast and coffee and the waffle iron, checkouts, housekeeping and handoff.
9. Owner's notes, save/continue, settings persistence.
10. Headless checks and screenshots.
