// A clerk who never gets tired: plays a whole shift through the game's own
// systems (not the keyboard), fast, and reports what happened. It is a test,
// not a strategy guide -- it answers every question the first way offered.
//   node tools/autopilot.mjs [--until=7:30] [--sloppy]
import { launch } from './pw.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v === undefined ? true : v]));
const T = await launch();
await T.ev(() => { window.__game.sound.muted = true; });
await T.page.keyboard.press('Enter');
await T.wait(800);
await T.page.keyboard.press('Escape');
await T.wait(100);

const result = await T.ev(async (opts) => {
  const g = window.__game;
  let s = g.shift;
  const { makeItem } = await import('/src/game/sim/items.js');
  const { SPOTS } = await import('/src/game/world/layout.js');
  const { Clock } = await import('/src/game/sim/clock.js');
  const log = [];
  const errs = [];
  const say = (t) => log.push(`${s.clock.label()}  ${t}`);
  const fake = (keys) => { const set = new Set(keys); return { hit: (...k) => k.some((x) => set.has(x)), isDown: () => false, mousePressed: [false] }; };
  const park = () => { const p = g.player; p.x = SPOTS.clerk.x; p.z = SPOTS.clerk.z; p.lv = 0; p.yaw = 0; };
  const endAt = opts.until ? (() => { const [h, m] = opts.until.split(':').map(Number); return Clock.at(h, m); })() : Clock.at(7, 40);

  /** Walk a conversation: pick choices by a rule until it ends. */
  function converse(node, pick, max = 30) {
    const R = s.runner;
    let n = 0;
    while (R.node && n++ < max) {
      const ch = R.node.choices || [];
      if (!ch.length) { R.pick(); continue; }
      let i = pick ? pick(ch, R.node) : 0;
      if (i < 0 || i >= ch.length) i = 0;
      R.sel = i;
      R.pick();
    }
    if (R.node) { say(`  (conversation still open: "${R.node.text.slice(0, 60)}")`); R.cancel(); }
  }
  const label = (ch, re) => ch.findIndex((c) => re.test(c.label));

  function deskTurn(p) {
    const reason = p.deskReason;
    if (reason === 'checkin') return checkin(p);
    s.talkTo(p);
    if (reason === 'checkout') {
      converse(null, (ch) => { const i = label(ch, /receipt/i); return i >= 0 ? i : 0; });
      const f = s.ledger.folioForRoom(p.room);
      if (f && f.open) s.checkOutFolio(f);
      if (s.printerTray.length) s.tearPrinter();
      s.talkTo(p); converse(null, (ch) => { const i = label(ch, /Here's your receipt/); return i >= 0 ? i : 0; });
      // the key they handed over goes on the hook, the tab to dirty
      for (const k of s.heldAll('key')) { s.removeHeld(k); s.rooms.hangKey(k.room); const st = s.rooms.get(k.room); if (!st.guest && !(opts.sloppy && Math.random() < 0.5)) st.status = 'VD'; }
      return;
    }
    if (reason === 'rent') {
      converse();
      s.useRegister();
      s.talkTo(p); converse();
      return;
    }
    converse(null, (ch) => { const i = label(ch, /Let me move you|I'll|right over|I'm so sorry|Write a paid-out/); return i >= 0 ? i : 0; });
    // a room move or the wrong key: a key is wanted now
    if (p.ci && p.ci.stage === 'key' && s.desk.line.includes(p)) {
      fetchKeys(p); s.talkTo(p);
      converse(null, (ch) => { const i = ch.findIndex((c) => c.label === `(Hand over key ${p.ci.room}.)`); return i >= 0 ? i : 0; });
    }
    for (const k of s.heldAll('key')) { s.removeHeld(k); s.rooms.hangKey(k.room); }
  }

  function fetchKeys(p) {
    const rooms = p.groupRooms || [p.ci.room];
    for (const no of rooms) {
      if (s.heldOf('key', (k) => k.room === no)) continue;
      if (opts.sloppy && !p._sloppyKey && Math.random() < 0.3 && !p.groupRooms) {
        p._sloppyKey = true;
        const other = s.rooms.all().find((st) => st.keys > 0 && st.no !== no);
        if (other) { s.rooms.takeKey(other.no); s.giveItem(makeItem('key', { room: other.no }), true); say(`  (sloppy: grabbed key ${other.no} for ${no})`); continue; }
      }
      if (s.rooms.takeKey(no)) { s.giveItem(makeItem('key', { room: no }), true); const st = s.rooms.get(no); if (st.guest) st.status = 'OC'; }
    }
  }

  function checkin(p) {
    s.talkTo(p);
    // ask everything, then into the system
    converse(null, (ch) => { const i = ch.findIndex((c) => !/system/i.test(c.label)); return i >= 0 ? i : ch.length - 1; });
    if (!p.ci || p.ci.stage !== 'system') { say(`  ${p.name}: stage ${p.ci && p.ci.stage}`); return; }
    const t = s.terminal;
    t.go('checkin');
    let f = t.form;
    if (!f.p) { say(`  terminal: no guest for ${p.name}`); return; }
    if (opts.sloppy && Math.random() < 0.3) { f.party = null; f.beds = null; f.options = t.roomOptions(f); }
    for (let k = 0; k < 3 && t.form && t.form.p; k++) { t.sel = t.formRows(t.form).length - 1; t.handle(fake(['Enter'])); }
    if (p.ci.stage !== 'pay') {
      say(`  terminal did not post ${p.name}: ${t.msg}`);
      if (/NO VACANT/.test(t.msg)) { s.talkTo(p); converse(null, (ch) => { const i = label(ch, /full tonight/); return i >= 0 ? i : 0; }); say(`  turned ${p.name} away (full)`); if (!s.noVacancy) s.toggleVacancy(); }
      return;
    }
    say(`checked in ${p.name} -> ${(p.groupRooms || [p.ci.room]).join(',')}  (${p.stay.pay})`);
    // payment
    for (let loop = 0; loop < 8 && p.ci.stage !== 'key' && p.ci.stage !== 'done'; loop++) {
      const stage = p.ci.stage;
      if (stage === 'pay') { s.talkTo(p); converse(null, (ch) => { const i = label(ch, /expired/); if (i >= 0 && p.stay.card && /09\/97/.test(p.stay.card.exp)) return i; const d = label(ch, /key deposit/); if (d >= 0 && Math.random() < 0.5) return d; const j = label(ch, /That'll be|honor|nineteen|Sign them|take the payment|Run it|Take the/); return j >= 0 ? j : 0; }); continue; }
      if (stage === 'cash') { if (s.pendingSale && !s.pendingSale.rung) s.useRegister(); s.talkTo(p); converse(); continue; }
      if (stage === 'card') { if (!s.heldOf('slip')) s.imprint(); s.talkTo(p); converse(null, (ch) => { const i = label(ch, /Sign here/); return i >= 0 ? i : 0; }); continue; }
      if (stage === 'voucher') { s.talkTo(p); converse(); continue; }
      break;
    }
    if (p.ci.stage !== 'key') { say(`  payment stuck at ${p.ci.stage} for ${p.name}`); return; }
    fetchKeys(p);
    s.talkTo(p);
    converse(null, (ch) => { const want = p.groupRooms ? -1 : ch.findIndex((c) => c.label === `(Hand over key ${p.ci.room}.)`); const any = ch.findIndex((c) => /Hand over/.test(c.label)); return want >= 0 && !(opts.sloppy && p._sloppyKey && !p._sloppyUsed && (p._sloppyUsed = true)) ? want : any >= 0 ? any : 0; });
    if (opts.trace) say(`  after key: stage ${p.ci.stage} queue=[${p.queue.map((a) => a.kind).join(',')}] act=${p.act && p.act.kind} held=${s.g.player.held.map((h) => h.kind + (h.room || '')).join(',')}`);
    if (s.desk.line.includes(p)) say(`  ${p.name} still at desk, stage ${p.ci.stage}`);
  }

  function answerPhone() {
    const c = s.phone.ringing()[0] || s.phone.onHold()[0];
    if (!c) return;
    if (c.state === 'ringing') s.startCall(c); else s.resumeCall(c);
    const R = s.runner;
    let n = 0;
    while (R.node && n++ < 20) {
      const ch = s.phoneChoices(R.node).filter((x) => !/HOLD/.test(x.label));
      let i = 0;
      const tr = ch.findIndex((x) => /Transfer/.test(x.label));
      const pol = ch.findIndex((x) => /can't give out|don't have anyone/.test(x.label));
      if (pol >= 0) i = pol; else if (tr >= 0) i = tr;
      const c2 = ch[i];
      const next = c2 && c2.fn ? c2.fn() : null;
      R.node = next || null;
      if (R.node && R.node.choices && R.node.choices.some((x) => /^\d{3} -- /.test(x.label))) {
        // the room picker: find the right room if we can
        const target = c.target && s.npcs.find(c.target);
        let guard = 0;
        while (R.node && guard++ < 8) {
          const cc = R.node.choices;
          const hit = target ? cc.findIndex((x) => x.label.startsWith(target.room + ' ')) : -1;
          const more = cc.findIndex((x) => /More rooms/.test(x.label));
          const pick = hit >= 0 ? hit : more >= 0 ? more : 0;
          R.node = cc[pick].fn() || null;
        }
      }
    }
    s.endCall(c.state === 'hold' ? null : c);
    if (c.state !== 'done' && c.state !== 'hold') s.phone.end(c, 'done');
    s.mode = null;
    say(`answered a call (${c.who.name}${c.kind ? ' ' + c.kind : ''})`);
  }

  function wakeUps() {
    for (const w of s.wakeups.due(s.clock.min)) {
      if (w._sloppy === undefined) w._sloppy = !!opts.sloppy && Math.random() < 0.4;
      if (w._sloppy) continue;
      const { wakeCall } = window.__calls || {};
      const p = s.npcs.find(w.who);
      s.wakeDone(w, p);
      say(`wake-up call ${w.room} (${Clock.label(w.at)})`);
    }
  }

  function doTasks() {
    for (const t of s.tasks.open()) {
      if (t.done) continue;
      const p = t.who ? s.npcs.find(t.who) : null;
      switch (t.kind) {
        case 'deliver': {
          const kind = t.item === 'iron' ? 'iron' : t.item;
          for (let i = 0; i < (t.qty || 1); i++) s.giveItem(makeItem(kind), true);
          if (p && p.inRoom) { s.answerDoor(g.doors.room(t.room), p, t); converse(); }
          else s.tasks.complete(t);
          for (const h of s.heldAll(kind)) s.removeHeld(h);
          break;
        }
        case 'fix': {
          if (t.item) s.giveItem(makeItem(t.item), true);
          const fid = { tv: 'tv', ac: 'ac', toilet: 'toilet', faucet: 'vanity', lamp: 'nightstand' }[t.fix];
          s.useFixture(t.room, fid);
          for (const h of s.g.player.held.filter((x) => !x.pocket)) s.removeHeld(h);
          break;
        }
        case 'noise': if (p) { s.answerDoor(g.doors.room(t.room), p, t); converse(); } else s.tasks.complete(t); break;
        case 'ice': s.clearIce(); break;
        case 'gate': s.useGate('gateS'); s.useGate('gateN'); break;
        case 'breaker': s.resetBreaker(); break;
        case 'sign': s.fixSign(); break;
        default: s.tasks.complete(t);
      }
      say(`task: ${t.text} -> ${t.status}`);
    }
  }

  function audit() {
    const t = s.terminal;
    if (t.audit && t.audit.done) return;
    t.go('audit');
    for (let i = 0; i < 12 && !t.audit.done; i++) t.handle(fake(['Enter']));
    say(`audit: ${t.audit.results.map((r) => (r.ok ? 'ok' : 'LOOK')).join(' ')} | ${t.audit.results.flatMap((r) => r.lines).filter(Boolean).slice(0, 12).join(' / ')}`);
    t.screen = 'main';
    if (s.printerTray.length) { s.tearPrinter(); const pk = s.heldOf('packet'); if (pk) { s.removeHeld(pk); s.flags.packetLeft = true; } }
  }

  function breakfastPrep() {
    const B = s.breakfast;
    const give = (k, n = 1) => { for (let i = 0; i < n; i++) { if (s.memory.inv(k === 'muffins' ? 'muffins' : k) <= 0 && k !== 'mop') return; s.giveItem(makeItem(k), true); s.memory.use(k); } };
    if (!B.coffee.coffee.brewing && B.coffee.coffee.level < 0.25) { give('coffee'); s.useStation('coffee'); say('brewed coffee'); }
    if (!B.coffee.decaf.brewing && B.coffee.decaf.level < 0.1) { give('decaf'); s.useStation('decaf'); say('brewed decaf'); }
    if (B.juice.level < 0.2) { give('oj'); s.useStation('juice'); }
    if (B.milk.level < 0.2) { give('milk'); s.useStation('cereal'); }
    for (const [st, k] of [['pastry', 'muffins'], ['bagels', 'bagels'], ['cereal', 'cereal'], ['fruit', 'fruit']]) if (B.trays[st] < 3) { give(k); s.useStation(st); }
    if (B.waffle.batter < 0.1) { give('waffleMix'); s.useStation('waffle'); }
    if (!B.waffle.on && B.waffle.batter > 0.1) s.useStation('waffle');
    if (B.waffle.state !== 'ok') { s.useStation('waffle'); say('cleaned the waffle iron'); }
    if (B.tv.channel === 'OFF') B.nextChannel();
    for (const h of s.g.player.held.filter((x) => !x.pocket)) s.removeHeld(h);
    if (s.property.news.state === 'bundle') { s.pickUpNews(); s.useNewsRack(); say('stacked the papers'); }
    if (B.spills.length) { s.giveItem(makeItem('mop'), true); for (const sp of B.spills.slice()) s.mopSpill(sp); for (const h of s.heldAll('mop')) s.removeHeld(h); }
  }

  function keyDrop() {
    if (!s.keyDrop.length) return;
    s.emptyKeyDrop();
    for (const k of s.heldAll('key')) {
      const f = s.ledger.folioForRoom(k.room);
      if (f && f.open) s.checkOutFolio(f);
      s.removeHeld(k); s.rooms.hangKey(k.room); s.rooms.get(k.room).status = 'VD';
    }
    s.printerTray.length = 0;
    say('emptied the key drop');
  }

  const snaps = (opts.snap ? String(opts.snap).split(',') : []).map((t) => { const [h, m] = t.split(':').map(Number); return Clock.at(h, m); });
  const snapshot = () => say('SNAP ' + s.npcs.list.filter((p) => !p.gone && p.kind !== 'staff').map((p) => `${p.name.split(' ')[0]}${p.room ? '(' + p.room + ')' : ''}:${p.act ? p.act.kind : '-'}${p.asleep ? 'z' : ''}${p.hidden ? 'h' : ''}${p.path ? '[' + p.pathI + '/' + p.path.length + ']' : ''}@${p.x.toFixed(0)},${p.z.toFixed(0)}`).join(' '));
  let ticks = 0;
  const maxTicks = 400000;
  const reports = [];
  const nShifts = Number(opts.shifts || 1);
  for (let shiftI = 0; shiftI < nShifts; shiftI++) {
  if (shiftI > 0) {
    g.ui.hidePanel(); g.toTitle(); g.beginShift(true); s = g.shift; s.closeOverlay();
    say(`===== SHIFT ${s.memory.shiftNo}: ${s.clock.dayLabel()} group=${s.director.variant.group} in-house=${s.npcs.list.filter((p) => p.inHouse).map((p) => p.name.split(' ')[0] + '(' + p.room + ')').join(' ')}`);
  }
  ticks = 0;
  while (!s.shiftOver && s.clock.min < endAt && ticks < maxTicks) {
    try {
      park();
      s.update(0.05, 'PLAY');
      if (snaps.length && s.clock.min >= snaps[0]) { snaps.shift(); snapshot(); }
      if (opts.trace) {
        const tp = s.npcs.find(opts.trace);
        if (tp) { const k = `${tp.act ? tp.act.kind : '-'}|q${tp.queue.length}|${tp.hidden ? 'h' : ''}|${tp.deskReason || ''}`; if (k !== tp._tk) { tp._tk = k; say(`TRACE ${tp.name} ${k} @${tp.x.toFixed(1)},${tp.z.toFixed(1)} queue=[${tp.queue.map((a) => a.kind).join(',')}]`); } }
      }
      if (s.mode === 'paper' || s.mode === 'picker' || s.mode === 'terminal' || s.mode === 'board') s.closeOverlay();
      if (ticks % 10 === 0) {
        if (s.phone.ringing().length || s.phone.onHold().length) answerPhone();
        const front = s.desk.front();
        if (front && front.x && Math.hypot(front.x - SPOTS.guestDesk.x, front.z - SPOTS.guestDesk.z) < 0.5) deskTurn(front);
        wakeUps();
        if (ticks % 40 === 0) doTasks();
        if (s.clock.past(3, 5)) audit();
        if (s.clock.past(4, 50) && !s.clock.past(7, 0)) breakfastPrep();
        if (s.clock.past(5, 0)) keyDrop();
        const luz = s.npcs.find('LUZ');
        if (luz && !luz.hidden && !luz.flags.briefed && Math.hypot(luz.x - 1.6, luz.z + 3.3) < 1.5) { s.talkTo(luz); converse(); say('briefed Luz'); }
        const tr = s.npcs.find('TRAVIS');
        if (tr && !tr.hidden && s.clock.past(6, 58) && Math.hypot(tr.x - 4.2, tr.z + 3.1) < 1.5) { s.talkTo(tr); converse(); say('handed off to Travis'); }
      }
    } catch (e) {
      errs.push(`${s.clock.label()} ${String(e.stack || e).split('\n').slice(0, 5).join(' | ')}`);
      if (errs.length > 8) break;
      if (s.runner.node) s.runner.cancel();
      s.mode = null;
    }
    ticks++;
  }
  reports.push({ day: s.clock.dayLabel(), group: s.director.variant.group, checkins: s.stats.checkins, checkouts: s.stats.checkouts, calls: s.stats.calls, served: { ...s.breakfast.served }, shortages: { ...s.breakfast.shortages }, pots: s.stats.pots, note: (g.ui.el.panelBody.innerText || '').split('Tonight, on the desk:')[1] || '' });
  }
  const st = s.stats;
  return {
    log, errs, ticks, end: s.clock.label(), over: s.shiftOver, state: g.state,
    stats: { checkins: st.checkins, checkouts: st.checkouts, calls: st.calls, missedCalls: st.missedCalls, wakes: st.wakesMade, wakeMissed: st.wakeMissed, tasksDone: st.tasksDone, drawer: st.drawerDelta, rackOff: st.rackOff, pots: st.pots, spills: st.spills, waffle: st.waffleIncidents },
    served: s.breakfast.served, shortages: s.breakfast.shortages,
    desk: s.desk.line.map((p) => `${p.name}:${p.deskReason}:${p.ci ? p.ci.stage : ''}`),
    stuck: s.npcs.list.filter((p) => !p.hidden && p.stuckT > 2).map((p) => `${p.name}@${p.x.toFixed(1)},${p.z.toFixed(1)} ${p.act && p.act.kind}`),
    openTasks: s.tasks.open().map((t) => t.text),
    reports,
    note: g.ui.el.panelBody ? g.ui.el.panelBody.innerText.slice(0, 1800) : '',
  };
}, args);

// frame time where it is busiest: --perf=x,z,yaw
if (args.perf) {
  const [x, z, yaw] = String(args.perf).split(',').map(Number);
  const r = await T.ev(async ({ x, z, yaw }) => {
    const g = window.__game; const p = g.player; p.x = x; p.z = z; p.yaw = yaw; p.pitch = -0.05; g.shift.mode = null;
    const t0 = performance.now(); let n = 0;
    await new Promise((res) => { const tick = () => { n++; if (performance.now() - t0 > 4000) res(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    return { fps: n / ((performance.now() - t0) / 1000), tris: g.stats.tris, people: g.shift.people().length };
  }, { x, z, yaw });
  console.log('PERF', JSON.stringify(r));
}
// pictures, after the run stops: --shots="name:x,z,yaw,pitch[,lv];..."
if (args.shots) {
  const { mkdirSync } = await import('node:fs');
  mkdirSync('shots', { recursive: true });
  for (const spec of String(args.shots).split(';').filter(Boolean)) {
    const [name, rest] = spec.split(':');
    const [x, z, yaw, pitch, lv] = rest.split(',').map(Number);
    await T.ev(({ x, z, yaw, pitch, lv }) => { const g = window.__game; const p = g.player; p.x = x; p.z = z; p.yaw = yaw; p.pitch = pitch; p.lv = lv || 0; p.vx = p.vz = 0; g.shift.mode = null; window.__game.ui.hideDialogue(); }, { x, z, yaw, pitch, lv });
    await T.wait(900);
    await T.page.screenshot({ path: `shots/ap-${name}.png` });
    console.log('shot', name);
  }
}
for (const l of result.log) console.log(l);
console.log('---');
console.log(JSON.stringify({ ...result, log: undefined, note: undefined }, null, 1));
if (result.note) console.log('--- END SCREEN ---\n' + result.note);
if (args.endshot && result.over) { await T.wait(600); await T.page.screenshot({ path: 'shots/ap-end.png' }); console.log('shot end'); }
T.check('no exceptions during the shift', result.errs.length === 0);
T.check('shift reached handoff', result.over || !!args.until);
process.exit(await T.done() ? 1 : 0);
