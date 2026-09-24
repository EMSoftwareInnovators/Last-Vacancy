/* ============================================================
   game.js -- the shift. Owns the loop, the front end, and the
   state machine; everything the motel actually does lives in the
   systems under sim/, and everything anybody says lives under
   dialogue/.

   Final Rental's game.js was four thousand lines because it was the
   whole game. This one is the switchboard: it builds the world,
   runs the systems in order, routes input to whatever has focus
   (the world, a conversation, the phone, the terminal, the key
   rack, a piece of paper), and draws.
   ============================================================ */
import { Raster } from '../engine/raster.js';
import { PostFX } from '../engine/postfx.js';
import { Input, normaliseBinds } from '../engine/input.js';
import { Sound } from '../engine/audio.js';
import { loadSettings, saveSettings, loadBinds, saveBinds, hasGame } from '../engine/save.js';
import { clamp } from '../engine/mathx.js';
import { buildTextures } from './world/textures.js';
import { buildWorld } from './world/build.js';
import { buildNav } from './world/nav.js';
import { Doors } from './world/doors.js';
import { zoneAt, roomAt, INDOOR } from './world/layout.js';
import { buildActorMeshes } from './actor.js';
import { createPlayer, updatePlayer } from './player.js';
import { renderFrame } from './render.js';
import { UI, setScheme, setPadBinds } from './ui/ui.js';
import { RES, DEFAULT_OPTS, OPTION_ROWS, optionsHtml, adjustOption, padHtml, padView, howToHtml } from './ui/menus.js';
import { Shift } from './shift.js';

export const ST = {
  BOOT: 'BOOT', TITLE: 'TITLE', HOWTO: 'HOWTO', OPTIONS: 'OPTIONS', PADCFG: 'PADCFG',
  INTRO: 'INTRO', PLAY: 'PLAY', PAUSE: 'PAUSE', QUIT: 'QUIT', END: 'END',
};

export class Game {
  constructor() {
    this.canvas = document.getElementById('screen');
    this.ui = new UI();
    this.input = new Input(this.canvas);
    this.sound = new Sound();
    this.state = ST.BOOT;
    this.opts = loadSettings(DEFAULT_OPTS);
    this.menuSel = 0; this.optSel = 0; this.padSel = 0;
    this.wantLock = false;
    this.fade = 1; this.fadeTo = 0;
    this.time = 0;
    this.timeScale = 1;
    this.draws = [];
    this.stats = {};
    this.frame = this.frame.bind(this);
    this.shift = null;
  }

  /* ============================================================
     BOOT
     ============================================================ */
  async boot() {
    const [rw, rh] = RES[this.opts.res] || RES[2];
    this.raster = new Raster(rw, rh);
    this.post = new PostFX(this.canvas, rw, rh);
    this.T = buildTextures();
    this.world = buildWorld(this.T);
    this.solids = this.world.solids;
    this.nav = buildNav(this.solids);
    this.doors = new Doors();
    this.actorMeshes = buildActorMeshes();

    this.input.onLockChange = (locked) => {
      const ours = this.time - (this._lockAskedT || -99) < 0.6;
      if (locked) { this.wantLock = true; return; }
      if (ours) return;
      if (this.state === ST.PLAY && !this.focus()) this.pause();
    };
    this.input.onGesture = () => {
      if (!this.wantLock || this.input.locked) return;
      if (this.state !== ST.PLAY || this.focus()) return;
      this.grabLock();
    };
    addEventListener('resize', () => this.layout());
    this.applyOptions();

    this.player = createPlayer();
    this.titleT = 0;
    this.toTitle();
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  layout() {
    const [rw, rh] = RES[this.opts.res] || RES[2];
    if (this.raster.w !== rw) { this.raster.resize(rw, rh); this.post.resize(rw, rh); }
  }

  /* ============================================================
     MAIN LOOP
     ============================================================ */
  frame(now) {
    this.input.poll();
    if (this.input.scheme !== this._scheme) {
      this._scheme = this.input.scheme;
      setScheme(this._scheme);
      setPadBinds(this.input.bindsAreUser ? this.input.binds : null);
      this.onSchemeChanged();
    }
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    dt *= this.timeScale;
    this.time += dt;
    this.fade += (this.fadeTo - this.fade) * Math.min(1, dt * 3.2);
    this.ui.fade(this.fade);
    this.draws.length = 0;

    try {
      switch (this.state) {
        case ST.TITLE: this.updateTitle(dt); break;
        case ST.HOWTO: case ST.OPTIONS: this.updatePanelMenu(); break;
        case ST.PADCFG: this.updatePadMenu(); break;
        case ST.INTRO: case ST.PLAY: case ST.END: if (this.shift) this.shift.update(dt, this.state); break;
        case ST.PAUSE: this.updatePause(); if (this.shift) this.shift.idleDraw(); break;
        case ST.QUIT: this.updateQuitConfirm(); if (this.shift) this.shift.idleDraw(); break;
        default: break;
      }
    } catch (err) {
      console.error(err);
      this._lastError = err;
    }

    this.sound.update(dt, this.clock ? this.clock.dawn() : 0);
    const typed = this.ui.update(dt);
    if (typed >= 0 && this.shift) this.shift.voiceBlip(typed);
    this.playerZone = zoneAt(this.player.x, this.player.z, this.player.lv);
    this.playerRoom = roomAt(this.player.x, this.player.z, this.player.lv);
    renderFrame(this, dt);
    this.input.endFrame();
    requestAnimationFrame(this.frame);
  }

  /* What has the player's hands at the moment, if anything other than the world. */
  focus() { return this.shift ? this.shift.focus() : null; }
  people() { return this.shift ? this.shift.people() : []; }
  zoneOf(c) { return zoneAt(c.x, c.z, c.lv || 0); }
  get clock() { return this.shift ? this.shift.clock : null; }
  get rooms() { return this.shift ? this.shift.rooms : null; }
  tvFrame() { return this.shift && this.shift.breakfast ? this.shift.breakfast.tvFrame() : null; }

  /* ---------------- input helpers (Final Rental's) ---------------- */
  confirmHit() {
    const i = this.input;
    if (i.hit('Enter', 'KeyE', 'Space')) return true;
    return !i.bindsFor('confirm').length && i.hit('PadAny');
  }
  backHit() { return this.input.hit('Escape', 'UiBack'); }
  confirmOrClick() { return this.confirmHit() || this.input.mousePressed[0]; }
  quietly(fn) { try { fn(); } catch (err) { this._audioDead = err; } }
  grabLock() { this._lockAskedT = this.time; this.input.requestLock(); }
  dropLock() { this._lockAskedT = this.time; this.input.exitLock(); }

  onSchemeChanged() {
    if (this.state === ST.HOWTO) this.ui.showPanel(howToHtml());
    else if (this.state === ST.OPTIONS) { this.showOptions(); }
    else if (this.state === ST.PADCFG) this.showPadMenu();
    else if (this.state === ST.PAUSE) this.showPauseMenu();
    if (this.shift) this.shift.onSchemeChanged();
  }

  /* ============================================================
     THE FRONT END
     ============================================================ */
  titleItems() {
    const items = [];
    const saved = hasGame();
    if (saved) items.push({ label: 'CONTINUE', sub: 'clock in for your next shift', act: () => this.beginShift(true) });
    items.push({ label: saved ? 'START OVER' : 'CLOCK IN', sub: saved ? 'a new first night; the motel forgets you' : 'seven at night to seven in the morning', act: () => this.beginShift(false) });
    items.push({ label: 'HOW TO WORK THE DESK', act: () => { this.state = ST.HOWTO; this.ui.showPanel(howToHtml()); } });
    items.push({ label: 'OPTIONS', act: () => { this.state = ST.OPTIONS; this.optSel = 0; this.showOptions(); } });
    return items;
  }

  toTitle() {
    this.state = ST.TITLE;
    this.menuSel = 0;
    this._titleItems = this.titleItems();
    this.ui.showTitle(true, this._titleItems);
    this.ui.titleSelect(0);
    this.ui.setHudVisible(false);
    this.ui.hidePanel();
    this.ui.cinema(false);
    this.fadeTo = 0;
    if (this.shift) { this.shift.dispose(); this.shift = null; }
    this.player = createPlayer();
    this.player.frozen = true;
  }

  updateTitle(dt) {
    this.titleT += dt;
    // a slow drift across the lot at night, looking at the rooms and the sign
    const t = this.titleT, p = this.player;
    p.x = -2 + Math.sin(t * 0.045) * 7;
    p.z = 5.5 + Math.cos(t * 0.04) * 3;
    p.footY = -0.12; p.lv = 0;
    p.yaw = 0.25 + Math.sin(t * 0.06) * 0.9;
    p.pitch = 0.06 + Math.sin(t * 0.09) * 0.04;
    this.doors.update(dt, []);
    this.sound.setListener(p.x, p.z, p.yaw, 0);
    this.placeAmbience(null);
    const i = this.input, items = this._titleItems, n = items.length;
    if (i.hit('ArrowUp', 'KeyW')) { this.menuSel = (this.menuSel + n - 1) % n; this.quietly(() => { this.sound.init(); this.sound.uiMove(); }); }
    if (i.hit('ArrowDown', 'KeyS')) { this.menuSel = (this.menuSel + 1) % n; this.quietly(() => { this.sound.init(); this.sound.uiMove(); }); }
    this.ui.titleSelect(this.menuSel);
    if (this.confirmOrClick()) {
      this.quietly(() => { this.sound.init(); this.sound.resume(); this.sound.uiSelect(); this.applyOptions(); });
      items[this.menuSel].act();
    }
  }

  beginShift(cont) {
    this.ui.showTitle(false);
    this.shift = new Shift(this, { continue: cont });
    this.shift.start();
  }

  showOptions() {
    this.ui.showPanel(optionsHtml(this.opts, this.input.padId));
    this.ui.panelSelect(this.optSel);
  }

  updatePanelMenu() {
    const i = this.input;
    if (this.state === ST.HOWTO) {
      if (i.hit('ArrowDown', 'KeyS')) this.ui.scrollPanel(90);
      if (i.hit('ArrowUp', 'KeyW')) this.ui.scrollPanel(-90);
      if (this.confirmHit() || this.backHit()) {
        this.quietly(() => this.sound.uiBack());
        this.ui.hidePanel();
        if (this._fromPause) { this._fromPause = false; this.showPauseMenu(); } else this.toTitle();
      }
      return;
    }
    const N = OPTION_ROWS.length;
    if (i.hit('ArrowUp', 'KeyW')) { this.optSel = (this.optSel + N - 1) % N; this.quietly(() => this.sound.uiMove()); }
    if (i.hit('ArrowDown', 'KeyS')) { this.optSel = (this.optSel + 1) % N; this.quietly(() => this.sound.uiMove()); }
    const d = (i.hit('ArrowRight', 'KeyD') ? 1 : 0) - (i.hit('ArrowLeft', 'KeyA') ? 1 : 0);
    if (d && adjustOption(this.opts, this.optSel, d)) {
      this.quietly(() => this.sound.uiMove());
      this.applyOptions(); this.showOptions();
    }
    this.ui.panelSelect(this.optSel);
    const row = OPTION_ROWS[this.optSel];
    const back = this.backHit();
    if (this.confirmHit() || back) {
      if (back || row[2] === 'back') {
        this.quietly(() => this.sound.uiBack());
        saveSettings(this.opts);
        if (this._fromPause) { this._fromPause = false; this.showPauseMenu(); } else { this.ui.hidePanel(); this.toTitle(); }
      } else if (row[2] === 'pad') {
        this.quietly(() => this.sound.uiSelect());
        this.state = ST.PADCFG; this.padSel = 0; this.input.cancelCapture(); this.showPadMenu();
      } else if (row[2] === 'toggle') {
        adjustOption(this.opts, this.optSel, 1); this.applyOptions(); this.showOptions();
      }
    }
  }

  showPadMenu() { this.ui.showPanel(padHtml(padView(this.input))); this.ui.panelSelect(this.padSel); }

  updatePadMenu() {
    const i = this.input;
    const N = padView(i).rows.length + 2, RESET = N - 2, BACK = N - 1;
    const leave = () => {
      i.cancelCapture(); this.quietly(() => this.sound.uiBack());
      this.state = ST.OPTIONS; this.showOptions();
    };
    if (this.backHit()) { leave(); return; }
    let moved = false;
    if (i.hit('ArrowUp', 'KeyW')) { this.padSel = (this.padSel + N - 1) % N; moved = true; }
    if (i.hit('ArrowDown', 'KeyS')) { this.padSel = (this.padSel + 1) % N; moved = true; }
    if (moved) { i.cancelCapture(); this.quietly(() => this.sound.uiMove()); this.showPadMenu(); return; }
    if (this.padSel === RESET || this.padSel === BACK) {
      if (this.confirmHit() || i.hit('PadAny') || i.hit('Enter')) {
        if (this.padSel === BACK) { leave(); return; }
        i.resetBinds(); this.savePadBinds(); this.quietly(() => this.sound.uiSelect()); this.showPadMenu();
      }
      return;
    }
    const action = padView(i).rows[this.padSel].id;
    if (i.capturing !== action) {
      i.capture(action);
      i.onCaptured = () => {
        i.onCaptured = null; this.savePadBinds(); this.quietly(() => this.sound.uiSelect());
        if (this.state === ST.PADCFG) this.showPadMenu();
        this.onSchemeChanged();
      };
      this.showPadMenu();
    }
  }

  savePadBinds() { setPadBinds(this.input.bindsAreUser ? this.input.binds : null); saveBinds(this.input.binds); }
  loadPadBinds() {
    const b = loadBinds();
    if (b && typeof b === 'object' && Object.keys(b).length) {
      this.input.binds = normaliseBinds(b); this.input.bindsAreUser = true; setPadBinds(this.input.binds);
    }
  }

  applyOptions() {
    this.loadPadBinds();
    const o = this.opts;
    this.input.sensitivity = 0.0009 + o.sens * 0.0032;
    this.input.invertY = o.invert;
    this.sound.setVolumes(o.vol, o.sfx, o.amb);
    if (this.raster) this.raster.snap = o.snap ? 1 : 0;
    this.ui.textSpeed = o.textSpeed;
    this.ui.setSubtitleSize(o.subSize);
    if (this.raster) this.layout();
  }

  /* ---------------- pause ---------------- */
  pause() {
    if (this.state !== ST.PLAY) return;
    this.wantLock = false;
    this.dropLock();
    this.ui.setPrompt('');
    if (this.shift) this.shift.onPause();
    this.pauseSel = 0;
    this.showPauseMenu();
  }
  showPauseMenu() {
    this.state = ST.PAUSE;
    const held = this.shift && this.shift.heldFocus;
    this.ui.showPanel(`<h2>SHIFT PAUSED</h2>
      <ul><li class="opt sel">${held ? 'Back to what you were doing' : 'Back to the desk'}</li>
      <li class="opt">How to work the desk</li><li class="opt">Options</li><li class="opt">Quit to title</li></ul>
      <p class="pad-foot">${this.ui.keyHint('confirm')} select &nbsp;&middot;&nbsp; ${this.ui.keyHint('up')}${this.ui.keyHint('down')} move</p>
      <p class="pad-foot quiet">The motel saves when you hand the shift over at seven.</p>`);
    this.ui.panelSelect(this.pauseSel || 0);
  }
  updatePause() {
    const i = this.input, N = 4;
    if (i.hit('ArrowUp', 'KeyW')) { this.pauseSel = (this.pauseSel + N - 1) % N; this.quietly(() => this.sound.uiMove()); }
    if (i.hit('ArrowDown', 'KeyS')) { this.pauseSel = (this.pauseSel + 1) % N; this.quietly(() => this.sound.uiMove()); }
    this.ui.panelSelect(this.pauseSel);
    if (this.backHit()) { this.resume(); return; }
    if (!this.confirmHit()) return;
    this.quietly(() => this.sound.uiSelect());
    if (this.pauseSel === 0) this.resume();
    else if (this.pauseSel === 1) { this.state = ST.HOWTO; this._fromPause = true; this.ui.showPanel(howToHtml()); }
    else if (this.pauseSel === 2) { this.state = ST.OPTIONS; this.optSel = 0; this._fromPause = true; this.showOptions(); }
    else this.showQuitConfirm();
  }
  showQuitConfirm(sel = 0) {
    this.state = ST.QUIT; this.quitSel = sel;
    this.ui.showPanel(`<h2>QUIT TO TITLE?</h2>
      <p class="quiet">Tonight's shift ends here and is not saved. The motel remembers everything up to the last shift you finished.</p>
      <ul><li class="opt sel">No &mdash; back to the shift</li><li class="opt">Yes, quit</li></ul>
      <p class="pad-foot">${this.ui.keyHint('confirm')} select &nbsp;&middot;&nbsp; ${this.ui.keyHint('back')} back</p>`);
    this.ui.panelSelect(this.quitSel);
  }
  updateQuitConfirm() {
    const i = this.input;
    if (i.hit('ArrowUp', 'KeyW', 'ArrowDown', 'KeyS')) { this.quitSel = 1 - this.quitSel; this.quietly(() => this.sound.uiMove()); }
    this.ui.panelSelect(this.quitSel);
    if (this.backHit()) { this.pauseSel = 3; this.showPauseMenu(); return; }
    if (!this.confirmHit()) return;
    if (this.quitSel === 0) { this.pauseSel = 3; this.showPauseMenu(); return; }
    this.ui.hidePanel();
    this.toTitle();
  }
  resume() {
    this.ui.hidePanel();
    this._fromPause = false;
    this.state = ST.PLAY;
    if (this.shift) this.shift.onResume();
  }

  /* ---------------- the world, for systems ---------------- */
  /** Put every positional loop where it is. Called by the shift each frame. */
  placeAmbience(shift) {
    const s = this.sound;
    const zone = zoneAt(this.player.x, this.player.z, this.player.lv);
    const inOffice = zone === 'desk' || zone === 'lobby' || zone === 'breakfast' || zone === 'pantry' || zone === 'backoffice';
    const through = INDOOR(zone) ? 0.35 : 1;
    const title = !shift;
    s.setScene(title ? 'title' : 'play');
    s.placeLoop('highway', this.player.x, -22, title ? 0.06 : 0.2, 70, INDOOR(zone) ? 0.25 : 1);
    s.placeLoop('ice', 8.2, 33.8, 0.45, 16, through);
    s.placeLoop('vending', 6.5, 33.8, 0.35, 12, through);
    s.placeLoop('pool', 5.2, 28.2, 0.35, 14, through);
    s.placeLoop('neon', -17.5, -14.2, title ? 0.1 : 0.18, 10, through);
    s.placeLoop('crt', 1.4, -4.7, inOffice ? 0.25 : 0, 4, 1);
    const r104 = shift && shift.rooms ? shift.rooms.get('104') : null;
    const acOn = !title && (!r104 || r104.occupied);
    s.placeLoop('acBad', -14.6, 16.6, acOn ? 0.5 : 0.2, 11, zone === 'room:104' ? 1.4 : through);
    const nearAc = shift && shift.rooms ? shift.rooms.nearestRunningAc(this.player.x, this.player.z, this.player.lv) : null;
    if (nearAc) s.placeLoop('ac', nearAc.x, nearAc.z, 0.35, 8, through);
    else s.placeLoop('ac', 0, 0, 0, 1, 0);
    if (shift && shift.breakfast) shift.breakfast.placeAmbience(s, zone);
    else { s.placeLoop('tvTalk', 0, 0, 0, 1, 0); s.placeLoop('coffee', 0, 0, 0, 1, 0); }
    s.placeLoop('dryer', 0.6, 37.5, shift && shift.laundryRunning ? 0.4 : 0, 9, zone === 'laundry' ? 1 : 0.4);
    const tvRoom = shift && shift.rooms ? shift.rooms.nearestTv(this.player.x, this.player.z, this.player.lv) : null;
    if (tvRoom) s.placeLoop('roomTv', tvRoom.x, tvRoom.z, 0.3, 6, zone.startsWith('room') ? 1 : 0.55);
    else s.placeLoop('roomTv', 0, 0, 0, 1, 0);
  }

  updateWalk(dt, ctx) {
    const SUB = 1 / 30;
    let remain = dt;
    while (remain > 0.0001) {
      const h = Math.min(remain, SUB);
      remain -= h;
      updatePlayer(this.player, h, this.input, ctx);
    }
  }

  saveOptionsNow() { saveSettings(this.opts); }
  clampRes() { this.opts.res = clamp(this.opts.res, 0, RES.length - 1); }
}
