/* ============================================================
   audio.js -- every sound is synthesized. No samples, no files.

   Carried over from Final Rental: the primitive voices (tone,
   noise, envelopes, the voice limiter), the room-tone bed, the
   dialogue blips pitched per character and the phone. Removed:
   the dread bed, stingers, heartbeat, jumpscare, siren and the
   tape chewing -- this phase of the game has no use for any of
   them.

   New: a motel. Positional loops (highway, ice machine, vending
   compressors, pool pump, air conditioners, the neon, the CRT)
   that the game places every frame, and the one-shots a night
   clerk hears: the desk bell, the two-line phone, the imprinter,
   the dot-matrix printer, keys, car doors, coffee and waffles,
   and birds when it gets light.
   ============================================================ */

export class Sound {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.masterVol = 0.8;
    this.sfxVol = 1;
    this.ambVol = 1;
    this.muted = false;
    this._loops = {};
    this.listener = { x: 0, z: 0, yaw: 0, indoor: 1 };
  }

  /** Must be called from a user gesture. */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.masterVol;
    this.master.connect(ctx.destination);

    /* The limiter sits on the effects path only -- Final Rental learned
       that the hard way: across the whole mix, every footstep ducked the
       room tone with it. */
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 4;
    comp.attack.value = 0.006; comp.release.value = 0.14;
    if (comp.knee) comp.knee.value = 14;
    comp.connect(this.master);

    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(comp);
    this.ambBus = ctx.createGain(); this.ambBus.gain.value = this.ambVol; this.ambBus.connect(this.master);

    // shared noise buffer (2s of white noise)
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    this.ready = true;
    this._startBeds();
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  get t() { return this.ctx.currentTime; }

  setVolumes(master, sfx, amb) {
    this.masterVol = master; this.sfxVol = sfx; this.ambVol = amb;
    if (!this.ready) return;
    this.master.gain.value = master;
    this.sfxBus.gain.value = sfx;
    this.ambBus.gain.value = amb;
  }

  /* ---------------- primitive voices ---------------- */
  _env(node, t0, gain, a, d, s = 0, sT = 0, r = 0.02) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + a);
    if (sT > 0) {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * s), t0 + a + d);
      g.gain.setValueAtTime(Math.max(0.0002, gain * s), t0 + a + d + sT);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + sT + r);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    }
    node.connect(g);
    return g;
  }

  tone(o = {}) {
    if (!this.ready || this.muted || this._busy()) return;
    if (o.gain !== undefined && o.gain < 0.0015) return;
    const ctx = this.ctx, t0 = (o.when || 0) + this.t;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq || 440, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + (o.slide || (o.a || 0.005) + (o.d || 0.2)));
    if (o.detune) osc.detune.value = o.detune;
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter; f.frequency.value = o.cutoff || 1200; f.Q.value = o.q || 1;
      osc.connect(f); node = f;
    }
    const g = this._env(node, t0, (o.gain === undefined ? 0.25 : o.gain), o.a || 0.005, o.d || 0.2, o.s, o.sT, o.r);
    this._out(g, o);
    osc.start(t0); osc.stop(t0 + (o.a || 0.005) + (o.d || 0.2) + (o.sT || 0) + (o.r || 0.02) + 0.05);
  }

  noise(o = {}) {
    if (!this.ready || this.muted || this._busy()) return;
    if (o.gain !== undefined && o.gain < 0.0015) return;
    const ctx = this.ctx, t0 = (o.when || 0) + this.t;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + (o.a || 0.005) + (o.d || 0.2));
    f.Q.value = o.q || 1;
    src.connect(f);
    const g = this._env(f, t0, o.gain === undefined ? 0.2 : o.gain, o.a || 0.005, o.d || 0.2, o.s, o.sT, o.r);
    this._out(g, o);
    src.start(t0); src.stop(t0 + (o.a || 0.005) + (o.d || 0.2) + (o.sT || 0) + (o.r || 0.02) + 0.05);
  }

  _out(g, o) {
    const ctx = this.ctx;
    const bus = o.bus || this.sfxBus;
    if (o.pan !== undefined && o.pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p); p.connect(bus);
    } else g.connect(bus);
  }

  /** True if we are already running as many one-shots as the graph wants. */
  _busy() {
    const now = this.ctx.currentTime;
    if (now - (this._voiceWindow || 0) > 0.1) { this._voiceWindow = now; this._voices = 0; }
    if (this._voices >= 18) return true;
    this._voices = (this._voices || 0) + 1;
    return false;
  }

  /* ---------------- where the listener is ---------------- */
  setListener(x, z, yaw, indoor) {
    const L = this.listener;
    L.x = x; L.z = z; L.yaw = yaw; L.indoor = indoor;
  }

  /** Distance/direction attenuation for a world sound. Same maths as Final Rental. */
  spatial(px, pz, yaw, x, z, maxDist = 12) {
    const dx = x - px, dz = z - pz;
    const d = Math.hypot(dx, dz);
    const gain = Math.max(0, 1 - d / maxDist);
    // yaw 0 looks toward +Z; right vector is +X rotated by yaw
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const pan = d < 0.001 ? 0 : Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d));
    return { gain: gain * gain, pan, dist: d };
  }

  /** {gain, pan} for a one-shot at (x, z) heard from the listener. */
  at(x, z, maxDist = 18, through = 1) {
    const L = this.listener;
    const s = this.spatial(L.x, L.z, L.yaw, x, z, maxDist);
    return { gain: s.gain * through, pan: s.pan * 0.8 };
  }

  /* ---------------- looping beds ---------------- */
  _startBeds() {
    const ctx = this.ctx;
    // fluorescent hum: 120Hz buzz + a little 240. The lobby's, not the store's.
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    this.humGain.connect(this.ambBus);
    for (const [f, g] of [[120, 1], [240, 0.4], [360, 0.15]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 700;
      const gg = ctx.createGain(); gg.gain.value = g * 0.25;
      o.connect(bp).connect(gg).connect(this.humGain); o.start();
    }
    // room tone: very low filtered noise
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    this.roomGain = ctx.createGain(); this.roomGain.gain.value = 0.04;
    n.connect(lp).connect(this.roomGain).connect(this.ambBus); n.start();
    // night air outside: wider, a little brighter, crickets live on top of it
    const n2 = ctx.createBufferSource(); n2.buffer = this.noiseBuf; n2.loop = true; n2.playbackRate.value = 0.7;
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 900; bp2.Q.value = 0.4;
    this.airGain = ctx.createGain(); this.airGain.gain.value = 0;
    n2.connect(bp2).connect(this.airGain).connect(this.ambBus); n2.start();
    for (const id of Object.keys(LOOPS)) this._makeLoop(id);
  }

  /** Build one positional loop out of the LOOPS table. */
  _makeLoop(id) {
    const ctx = this.ctx;
    const out = ctx.createGain(); out.gain.value = 0;
    let pan = null;
    if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); out.connect(pan).connect(this.ambBus); }
    else out.connect(this.ambBus);
    const voice = LOOPS[id](ctx, out, this.noiseBuf);
    this._loops[id] = { out, pan, voice, sent: 0, panSent: 0 };
  }

  /**
   * Place a loop this frame.
   * @param level 0..1 how loud the thing itself is right now (0 = off)
   * @param maxDist how far away it can still be heard
   * @param through extra attenuation for walls (0..1)
   */
  placeLoop(id, x, z, level, maxDist = 14, through = 1) {
    const L = this._loops[id];
    if (!L || !this.ready) return;
    const s = this.spatial(this.listener.x, this.listener.z, this.listener.yaw, x, z, maxDist);
    const g = this.muted ? 0 : level * s.gain * through;
    const t = this.t;
    if (Math.abs(g - L.sent) > 0.002) { L.sent = g; L.out.gain.setTargetAtTime(g, t, 0.12); }
    if (L.pan && Math.abs(s.pan - L.panSent) > 0.03) { L.panSent = s.pan; L.pan.pan.setTargetAtTime(s.pan * 0.8, t, 0.1); }
  }

  /**
   * Ambience upkeep: the lobby hum and the night air, faded by how far
   * indoors the listener is. Values are only sent when they have moved
   * enough to hear (Final Rental's rule: automation events are not free).
   */
  update(dt, dawn = 0) {
    if (!this.ready) return;
    const t = this.t;
    const ind = this.listener.indoor;
    const hum = this.muted ? 0 : 0.028 * ind * this.lightLevel();
    if (Math.abs(hum - (this._humSent || 0)) > 0.0006) { this._humSent = hum; this.humGain.gain.setTargetAtTime(hum, t, 0.2); }
    const air = this.muted ? 0 : 0.03 * (1 - ind * 0.85);
    if (Math.abs(air - (this._airSent || 0)) > 0.0006) { this._airSent = air; this.airGain.gain.setTargetAtTime(air, t, 0.25); }
    // crickets at night, birds when it gets light, both only really outside
    this._critT = (this._critT || 0) - dt;
    if (this._critT <= 0) {
      this._critT = 0.25 + Math.random() * 0.5;
      const out = (1 - ind * 0.9);
      if (dawn < 0.6 && Math.random() < 0.8) this.cricket(out * (1 - dawn) * 0.5);
      if (dawn > 0.25 && Math.random() < dawn * 0.35) this.bird(out * dawn * 0.6);
    }
  }

  lightLevel() { return this._lights === undefined ? 1 : this._lights; }
  setLights(v) { this._lights = v; }

  /* ============================================================
     THE LIBRARY
     ============================================================ */

  /* ---- doors, feet, hands ---- */
  /** The lobby door has a shop bell on a spring over it. */
  doorBell(pan = 0, k = 1) {
    for (let i = 0; i < 5; i++) {
      const f = 2300 + Math.random() * 900;
      this.tone({ freq: f, type: 'triangle', gain: 0.05 * k, a: 0.002, d: 0.25 + Math.random() * 0.2, when: i * 0.045 + Math.random() * 0.02, pan });
    }
  }
  doorOpen(pan = 0, k = 1) { this.noise({ filter: 'bandpass', freq: 500, to: 220, q: 2, gain: 0.14 * k, a: 0.01, d: 0.35, pan }); }
  /** A motel room door: hollow core, a spring hinge, and the latch. */
  doorClose(pan = 0, k = 1) {
    this.noise({ filter: 'lowpass', freq: 380, q: 1, gain: 0.22 * k, a: 0.002, d: 0.18, pan });
    this.tone({ freq: 95, type: 'sine', gain: 0.12 * k, a: 0.002, d: 0.14, pan });
    this.noise({ filter: 'bandpass', freq: 2600, q: 4, gain: 0.06 * k, a: 0.001, d: 0.04, when: 0.03, pan });
  }
  knock(n = 3, pan = 0, k = 1) {
    for (let i = 0; i < n; i++) {
      this.noise({ filter: 'lowpass', freq: 300, q: 1, gain: 0.2 * k, a: 0.001, d: 0.12, when: i * 0.21, pan });
      this.tone({ freq: 120 + Math.random() * 20, type: 'sine', gain: 0.1 * k, a: 0.001, d: 0.09, when: i * 0.21, pan });
    }
  }
  lockClick(locked) {
    this.tone({ freq: locked ? 180 : 240, type: 'square', gain: 0.12, a: 0.001, d: 0.06, filter: 'lowpass', cutoff: 900 });
    this.noise({ freq: 2400, q: 3, gain: 0.1, a: 0.001, d: 0.05 });
  }
  /** surface: 'carpet' | 'tile' | 'concrete' | 'metal' */
  footstep(pan = 0, run = false, surface = 'carpet', k = 1) {
    const g = (run ? 1.5 : 1) * k;
    if (surface === 'metal') {
      this.tone({ freq: 180 + Math.random() * 40, type: 'triangle', gain: 0.05 * g, a: 0.001, d: 0.12, pan });
      this.noise({ filter: 'bandpass', freq: 900, q: 3, gain: 0.07 * g, a: 0.001, d: 0.1, pan });
      return;
    }
    const f = surface === 'carpet' ? 240 : surface === 'tile' ? 900 : 620;
    this.noise({ filter: surface === 'carpet' ? 'lowpass' : 'bandpass', freq: f, q: 1, gain: (surface === 'carpet' ? 0.05 : 0.045) * g, a: 0.002, d: run ? 0.08 : 0.11, pan, rate: 0.6 + Math.random() * 0.3 });
  }
  pickup() { this.noise({ filter: 'bandpass', freq: 1800, q: 1.4, gain: 0.09, a: 0.002, d: 0.09 }); this.tone({ freq: 520, type: 'triangle', gain: 0.05, a: 0.002, d: 0.07 }); }
  drop() { this.noise({ filter: 'lowpass', freq: 700, q: 1, gain: 0.11, a: 0.002, d: 0.13 }); }
  cloth() { this.noise({ filter: 'lowpass', freq: 1200, q: 0.6, gain: 0.07, a: 0.02, d: 0.25, rate: 0.7 }); }
  /** A motel key: a brass key on a split ring with a big plastic fob. */
  keys(pan = 0) {
    for (let i = 0; i < 4; i++) this.tone({ freq: 3200 + Math.random() * 1800, type: 'triangle', gain: 0.03, a: 0.001, d: 0.08 + Math.random() * 0.08, when: i * 0.03 + Math.random() * 0.02, pan });
    this.noise({ filter: 'bandpass', freq: 1400, q: 2, gain: 0.05, a: 0.002, d: 0.05, when: 0.05, pan });
  }
  paper() { this.noise({ filter: 'highpass', freq: 2600, q: 0.7, gain: 0.08, a: 0.004, d: 0.22, rate: 1.6 }); }
  pen() { for (let i = 0; i < 6; i++) this.noise({ filter: 'highpass', freq: 4200, q: 0.8, gain: 0.018, a: 0.01, d: 0.07, when: i * 0.08 + Math.random() * 0.03, rate: 1.8 }); }
  snip() { this.noise({ filter: 'highpass', freq: 3800, gain: 0.12, a: 0.001, d: 0.05 }); this.tone({ freq: 1900, type: 'square', gain: 0.03, a: 0.001, d: 0.03, filter: 'lowpass', cutoff: 3000 }); }
  thump(pan = 0, k = 1) {
    this.noise({ filter: 'lowpass', freq: 220, gain: 0.28 * k, a: 0.002, d: 0.22, pan });
    this.tone({ freq: 70, type: 'sine', gain: 0.2 * k, a: 0.002, d: 0.2, pan });
  }

  /* ---- the desk ---- */
  /** Counter bell. Brass dome, one strike, a long ring with an inharmonic top. */
  deskBell(pan = 0, k = 1) {
    this.tone({ freq: 2093, type: 'sine', gain: 0.16 * k, a: 0.001, d: 1.4, pan });
    this.tone({ freq: 5420, type: 'sine', gain: 0.05 * k, a: 0.001, d: 0.5, pan });
    this.tone({ freq: 2112, type: 'sine', gain: 0.07 * k, a: 0.001, d: 1.2, pan });
    this.noise({ filter: 'bandpass', freq: 4000, q: 3, gain: 0.04 * k, a: 0.001, d: 0.02, pan });
  }
  registerBeep() { this.tone({ freq: 1760, type: 'square', gain: 0.07, a: 0.002, d: 0.05, filter: 'lowpass', cutoff: 3000 }); }
  kaching() {
    this.tone({ freq: 1568, type: 'triangle', gain: 0.11, a: 0.002, d: 0.28 });
    this.tone({ freq: 2093, type: 'triangle', gain: 0.08, a: 0.002, d: 0.35, when: 0.04 });
    this.noise({ filter: 'lowpass', freq: 900, gain: 0.1, a: 0.002, d: 0.2, when: 0.02 });
  }
  cashDrawer() { this.noise({ filter: 'lowpass', freq: 500, gain: 0.14, a: 0.003, d: 0.3 }); this.tone({ freq: 130, type: 'square', gain: 0.08, a: 0.003, d: 0.2, when: 0.14 }); }
  /** The imprinter. Slide the carriage over and back: CHUNK -- CHUNK. */
  imprint(half = 0) {
    const when = 0;
    this.noise({ filter: 'bandpass', freq: 700, to: 320, q: 1.5, gain: 0.22, a: 0.004, d: 0.18, when });
    this.tone({ freq: 90, type: 'square', gain: 0.14, a: 0.002, d: 0.12, when: when + 0.12, filter: 'lowpass', cutoff: 500 });
    this.noise({ filter: 'lowpass', freq: 300, gain: 0.25, a: 0.001, d: 0.1, when: when + 0.13 });
    void half;
  }
  /** Dot-matrix: a fast buzz of pins, carriage returns, and a line feed. */
  printer(lines = 4) {
    for (let l = 0; l < lines; l++) {
      const w = l * 0.42;
      this.tone({ freq: 1250 + Math.random() * 60, type: 'square', gain: 0.035, a: 0.01, d: 0.02, s: 1, sT: 0.28, r: 0.02, when: w, filter: 'bandpass', cutoff: 1500, q: 2 });
      this.noise({ filter: 'bandpass', freq: 2600, q: 1.2, gain: 0.03, a: 0.01, d: 0.02, s: 1, sT: 0.28, r: 0.02, when: w });
      this.noise({ filter: 'lowpass', freq: 400, gain: 0.07, a: 0.002, d: 0.06, when: w + 0.33 });
    }
  }
  /** A keyboard with real switches in it. */
  keyClick() { this.noise({ filter: 'bandpass', freq: 3000 + Math.random() * 1200, q: 3, gain: 0.05, a: 0.001, d: 0.025 }); }
  terminalBeep() { this.tone({ freq: 880, type: 'square', gain: 0.04, a: 0.002, d: 0.12, filter: 'lowpass', cutoff: 1800 }); }

  /* ---- the phone ---- */
  /**
   * A 1990s multi-line business set does not have a bell in it. It has an
   * electronic ringer: two tones trading places very fast, in bursts. The
   * line lamp flashes with it. `k` is how loud from where you stand.
   */
  phoneRing(pan = 0, k = 1, line = 1) {
    const base = line === 2 ? 1.06 : 1;
    const burst = (w) => {
      for (let i = 0; i < 14; i++) {
        this.tone({ freq: (i % 2 ? 1180 : 940) * base, type: 'square', gain: 0.045 * k, a: 0.002, d: 0.032, when: w + i * 0.036, filter: 'lowpass', cutoff: 2600, pan });
      }
    };
    burst(0); burst(0.62);
  }
  phonePickup() { this.noise({ filter: 'bandpass', freq: 1400, q: 2, gain: 0.1, a: 0.002, d: 0.1 }); }
  phoneHang() { this.tone({ freq: 200, type: 'square', gain: 0.08, a: 0.002, d: 0.08, filter: 'lowpass', cutoff: 800 }); this.noise({ filter: 'bandpass', freq: 900, gain: 0.08, a: 0.002, d: 0.12 }); }
  phoneButton() { this.noise({ filter: 'bandpass', freq: 2200, q: 2, gain: 0.05, a: 0.001, d: 0.03 }); }
  dialTone(digit) {
    const LOW = [941, 697, 697, 697, 770, 770, 770, 852, 852, 852];
    const HIGH = [1336, 1209, 1336, 1477, 1209, 1336, 1477, 1209, 1336, 1477];
    const i = digit % 10;
    this.tone({ freq: LOW[i], type: 'sine', gain: 0.07, a: 0.005, d: 0.14 });
    this.tone({ freq: HIGH[i], type: 'sine', gain: 0.07, a: 0.005, d: 0.14 });
  }
  /** An internal extension ringing in a room: what you hear down the line. */
  ringback() {
    for (let k = 0; k < 2; k++) {
      this.tone({ freq: 440, type: 'sine', gain: 0.05, a: 0.02, d: 0.02, s: 1, sT: 1.4, r: 0.05, when: k * 2.4 });
      this.tone({ freq: 480, type: 'sine', gain: 0.05, a: 0.02, d: 0.02, s: 1, sT: 1.4, r: 0.05, when: k * 2.4 });
    }
  }
  holdMusic() {
    // the tinny little loop the phone system plays to people on hold
    const N = [523, 587, 659, 587, 523, 494, 523];
    N.forEach((f, i) => this.tone({ freq: f, type: 'square', gain: 0.015, a: 0.01, d: 0.18, when: i * 0.22, filter: 'lowpass', cutoff: 1400 }));
  }

  /** Character voice: short blips whose pitch encodes the speaker. */
  blip(pitch = 1, rough = 0, k = 1, pan = 0) {
    const f = 180 * pitch * (0.94 + Math.random() * 0.12);
    this.tone({ freq: f, type: rough > 0.5 ? 'sawtooth' : 'square', gain: 0.04 * k, a: 0.004, d: 0.055, filter: 'lowpass', cutoff: 900 + rough * 1400, pan });
    this.tone({ freq: f * 2, type: 'sine', gain: 0.016 * k, a: 0.004, d: 0.04, pan });
  }

  /* ---- property ---- */
  /** Ice dropping into the bin, or into somebody's bucket. */
  iceDrop(pan = 0, k = 1) {
    for (let i = 0; i < 9; i++) {
      this.tone({ freq: 1400 + Math.random() * 2600, type: 'triangle', gain: 0.03 * k, a: 0.001, d: 0.05 + Math.random() * 0.05, when: Math.random() * 0.5, pan });
      this.noise({ filter: 'bandpass', freq: 1800 + Math.random() * 2000, q: 4, gain: 0.03 * k, a: 0.001, d: 0.04, when: Math.random() * 0.5, pan });
    }
  }
  /** A can coming down the chute of a soda machine. */
  vendDrop(pan = 0, k = 1) {
    this.noise({ filter: 'lowpass', freq: 500, gain: 0.16 * k, a: 0.004, d: 0.3, pan });
    this.thump(pan, 0.6 * k);
    this.tone({ freq: 620, type: 'triangle', gain: 0.05 * k, a: 0.002, d: 0.2, when: 0.26, pan });
  }
  coins(pan = 0, k = 1) {
    for (let i = 0; i < 7; i++) this.tone({ freq: 2500 + Math.random() * 2500, type: 'triangle', gain: 0.035 * k, a: 0.001, d: 0.09 + Math.random() * 0.1, when: i * 0.05 + Math.random() * 0.03, pan });
  }
  breakerClack() { this.noise({ filter: 'bandpass', freq: 1200, q: 2, gain: 0.2, a: 0.001, d: 0.05 }); this.tone({ freq: 110, type: 'square', gain: 0.1, a: 0.001, d: 0.08, filter: 'lowpass', cutoff: 500 }); }
  switchClick() { this.noise({ filter: 'bandpass', freq: 2400, q: 3, gain: 0.08, a: 0.001, d: 0.03 }); }
  tvOn(pan = 0) { this.tone({ freq: 60, to: 15700, type: 'sine', gain: 0.02, a: 0.01, d: 0.3, pan }); this.noise({ filter: 'bandpass', freq: 5000, gain: 0.04, a: 0.001, d: 0.12, pan }); }
  tvSmack(pan = 0) { this.thump(pan, 0.5); this.noise({ filter: 'highpass', freq: 3000, gain: 0.05, a: 0.001, d: 0.2, pan }); }
  flush(pan = 0, k = 1) {
    this.noise({ filter: 'lowpass', freq: 900, to: 300, gain: 0.2 * k, a: 0.05, d: 1.6, pan, rate: 0.8 });
    this.noise({ filter: 'bandpass', freq: 2200, gain: 0.06 * k, a: 0.2, d: 1.2, pan });
  }
  plunge(pan = 0) { this.noise({ filter: 'lowpass', freq: 260, gain: 0.2, a: 0.01, d: 0.18, pan }); this.tone({ freq: 90, to: 60, type: 'sine', gain: 0.1, a: 0.01, d: 0.16, pan }); }
  squeak(pan = 0) { this.tone({ freq: 1800, to: 2300, type: 'sine', gain: 0.03, a: 0.01, d: 0.12, pan }); }
  spray(pan = 0) { this.noise({ filter: 'highpass', freq: 3500, gain: 0.07, a: 0.01, d: 0.25, pan }); }
  mop(pan = 0) { this.noise({ filter: 'bandpass', freq: 700, q: 0.8, gain: 0.07, a: 0.04, d: 0.3, pan, rate: 0.6 }); }
  trashBag(pan = 0) { this.noise({ filter: 'highpass', freq: 1800, gain: 0.08, a: 0.02, d: 0.4, pan, rate: 1.3 }); }

  /* ---- outside ---- */
  carDoor(pan = 0, k = 1) {
    this.noise({ filter: 'lowpass', freq: 420, gain: 0.26 * k, a: 0.002, d: 0.2, pan });
    this.tone({ freq: 80, type: 'sine', gain: 0.16 * k, a: 0.002, d: 0.15, pan });
    this.noise({ filter: 'bandpass', freq: 3000, q: 3, gain: 0.04 * k, a: 0.001, d: 0.03, pan });
  }
  carPass(pan = 0, k = 1, dur = 3) {
    this.noise({ filter: 'lowpass', freq: 500, to: 260, q: 0.8, gain: 0.12 * k, a: dur * 0.45, d: dur * 0.55, pan });
    this.tone({ freq: 70, to: 52, type: 'sawtooth', gain: 0.03 * k, a: dur * 0.45, d: dur * 0.55, filter: 'lowpass', cutoff: 200, pan });
  }
  /** A tractor-trailer going by on the highway, taking its time about it. */
  truckPass(pan = 0, k = 1) {
    this.noise({ filter: 'lowpass', freq: 380, to: 180, q: 0.8, gain: 0.2 * k, a: 2.2, d: 2.8, pan });
    this.tone({ freq: 48, to: 40, type: 'sawtooth', gain: 0.05 * k, a: 2.2, d: 2.8, filter: 'lowpass', cutoff: 160, pan });
    this.noise({ filter: 'bandpass', freq: 1500, q: 1, gain: 0.04 * k, a: 2.0, d: 2.5, pan });
  }
  engineIdle(pan = 0, k = 1, dur = 2) { this.tone({ freq: 38, type: 'sawtooth', gain: 0.05 * k, a: 0.3, d: 0.2, s: 1, sT: dur, r: 0.5, filter: 'lowpass', cutoff: 180, pan }); }
  cricket(k = 0.4) {
    if (k < 0.02) return;
    const f = 4200 + Math.random() * 600, pan = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < 3; i++) this.tone({ freq: f, type: 'sine', gain: 0.008 * k, a: 0.004, d: 0.03, when: i * 0.055, pan });
  }
  bird(k = 0.4) {
    if (k < 0.02) return;
    const f = 2600 + Math.random() * 1600, pan = Math.random() * 1.6 - 0.8;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.tone({ freq: f, to: f * (1.2 + Math.random() * 0.4), type: 'sine', gain: 0.02 * k, a: 0.01, d: 0.09, when: i * 0.13, pan });
  }
  splash(pan = 0, k = 1) { this.noise({ filter: 'bandpass', freq: 1200, q: 0.6, gain: 0.12 * k, a: 0.01, d: 0.5, pan }); }

  /* ---- breakfast ---- */
  /** The drip machine finishing a pot: that gurgle, and the steam. */
  coffeeGurgle(pan = 0, k = 1) {
    for (let i = 0; i < 5; i++) this.noise({ filter: 'bandpass', freq: 300 + Math.random() * 300, q: 5, gain: 0.08 * k, a: 0.02, d: 0.12, when: i * 0.19 + Math.random() * 0.05, pan });
    this.noise({ filter: 'highpass', freq: 3000, gain: 0.02 * k, a: 0.2, d: 0.6, pan });
  }
  pour(pan = 0, k = 1) { this.noise({ filter: 'bandpass', freq: 1100, to: 1600, q: 1.5, gain: 0.07 * k, a: 0.05, d: 0.8, pan }); }
  sizzle(pan = 0, k = 1) { this.noise({ filter: 'highpass', freq: 2400, gain: 0.06 * k, a: 0.05, d: 0.9, pan, rate: 1.2 }); }
  waffleBeep(pan = 0, k = 1) { [0, 0.18, 0.36].forEach((w) => this.tone({ freq: 2200, type: 'square', gain: 0.03 * k, a: 0.002, d: 0.1, when: w, filter: 'lowpass', cutoff: 3000, pan })); }
  toasterPop(pan = 0) { this.noise({ filter: 'bandpass', freq: 1800, q: 2, gain: 0.1, a: 0.001, d: 0.06, pan }); this.tone({ freq: 400, type: 'triangle', gain: 0.05, a: 0.001, d: 0.08, pan }); }
  whisk() { for (let i = 0; i < 6; i++) this.noise({ filter: 'bandpass', freq: 1600, q: 1, gain: 0.05, a: 0.01, d: 0.07, when: i * 0.11 }); }
  splat(pan = 0, k = 1) { this.noise({ filter: 'lowpass', freq: 600, gain: 0.18 * k, a: 0.002, d: 0.16, pan }); this.noise({ filter: 'bandpass', freq: 1800, q: 1, gain: 0.05 * k, a: 0.004, d: 0.3, when: 0.05, pan }); }
  crunch() { this.noise({ filter: 'bandpass', freq: 2000, q: 0.8, gain: 0.05, a: 0.004, d: 0.1 }); }

  /* ---- interface ---- */
  clockTick() { this.noise({ filter: 'bandpass', freq: 3200, q: 8, gain: 0.02, a: 0.001, d: 0.03 }); }
  uiMove() { this.tone({ freq: 660, type: 'square', gain: 0.04, a: 0.002, d: 0.04, filter: 'lowpass', cutoff: 2200 }); }
  uiSelect() { this.tone({ freq: 880, type: 'square', gain: 0.05, a: 0.002, d: 0.07, filter: 'lowpass', cutoff: 2600 }); this.tone({ freq: 1320, type: 'square', gain: 0.04, a: 0.002, d: 0.09, when: 0.05 }); }
  uiBack() { this.tone({ freq: 320, type: 'square', gain: 0.05, a: 0.002, d: 0.09, filter: 'lowpass', cutoff: 1400 }); }
  error() { this.tone({ freq: 160, type: 'square', gain: 0.1, a: 0.002, d: 0.18, filter: 'lowpass', cutoff: 900 }); this.tone({ freq: 120, type: 'square', gain: 0.08, a: 0.002, d: 0.24, when: 0.12, filter: 'lowpass', cutoff: 700 }); }
  chimeGood() { [784, 988, 1319].forEach((f, i) => this.tone({ freq: f, type: 'sine', gain: 0.08, a: 0.005, d: 0.35, when: i * 0.08 })); }
  chimeSoft() { [659, 880].forEach((f, i) => this.tone({ freq: f, type: 'sine', gain: 0.06, a: 0.005, d: 0.3, when: i * 0.09 })); }
  shiftEnd() { [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, type: 'triangle', gain: 0.08, a: 0.01, d: 0.5, when: i * 0.16 })); }
}

/* ============================================================
   POSITIONAL LOOPS
   Each builds a small node graph into `out` and runs forever at
   zero gain until the game places it.
   ============================================================ */
const osc = (ctx, type, f, g, to) => {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
  const gg = ctx.createGain(); gg.gain.value = g;
  o.connect(gg).connect(to); o.start();
  return o;
};
const noiseSrc = (ctx, buf, rate = 1) => {
  const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true; n.playbackRate.value = rate; n.start();
  return n;
};
const filt = (ctx, type, f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };

const LOOPS = {
  /* The interstate, all night: a low roar that never quite stops. */
  highway(ctx, out, buf) {
    const n = noiseSrc(ctx, buf, 0.5);
    const lp = filt(ctx, 'lowpass', 340, 0.6);
    const g = ctx.createGain(); g.gain.value = 0.5;
    n.connect(lp).connect(g).connect(out);
    // swell as cars come and go
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 0.18;
    lfo.connect(lg).connect(g.gain); lfo.start();
  },
  /* Ice machine: a compressor and a fan, and a hiss of refrigerant. */
  ice(ctx, out, buf) {
    const lp = filt(ctx, 'lowpass', 300, 1);
    lp.connect(out);
    osc(ctx, 'sawtooth', 58, 0.25, lp);
    osc(ctx, 'sawtooth', 116, 0.08, lp);
    const n = noiseSrc(ctx, buf, 1.1);
    const bp = filt(ctx, 'bandpass', 1800, 0.8);
    const g = ctx.createGain(); g.gain.value = 0.12;
    n.connect(bp).connect(g).connect(out);
  },
  /* Two drink machines and a snack machine, all of them humming. */
  vending(ctx, out) {
    const lp = filt(ctx, 'lowpass', 520, 2);
    lp.connect(out);
    osc(ctx, 'square', 60, 0.18, lp);
    osc(ctx, 'sawtooth', 120, 0.1, lp);
    osc(ctx, 'sine', 180, 0.05, out);
  },
  /* Pool pump in its little shed, and water going over the skimmer. */
  pool(ctx, out, buf) {
    const lp = filt(ctx, 'lowpass', 220, 1);
    lp.connect(out);
    osc(ctx, 'sawtooth', 50, 0.2, lp);
    const n = noiseSrc(ctx, buf, 0.8);
    const bp = filt(ctx, 'bandpass', 900, 0.7);
    const g = ctx.createGain(); g.gain.value = 0.25;
    n.connect(bp).connect(g).connect(out);
  },
  /* A through-the-wall air conditioner running. */
  ac(ctx, out, buf) {
    const n = noiseSrc(ctx, buf, 0.9);
    const bp = filt(ctx, 'bandpass', 600, 0.6);
    const g = ctx.createGain(); g.gain.value = 0.35;
    n.connect(bp).connect(g).connect(out);
    osc(ctx, 'sawtooth', 62, 0.06, out);
  },
  /* Room 104's, which is the one that rattles. */
  acBad(ctx, out, buf) {
    const n = noiseSrc(ctx, buf, 0.9);
    const bp = filt(ctx, 'bandpass', 700, 0.6);
    const g = ctx.createGain(); g.gain.value = 0.35;
    n.connect(bp).connect(g).connect(out);
    const rattle = filt(ctx, 'bandpass', 240, 6);
    const rg = ctx.createGain(); rg.gain.value = 0;
    osc(ctx, 'square', 31, 1, rattle);
    rattle.connect(rg).connect(out);
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 0.31;
    const lg = ctx.createGain(); lg.gain.value = 0.25;
    lfo.connect(lg).connect(rg.gain); lfo.start();
  },
  /* The sign out front. Neon buzzes. */
  neon(ctx, out) {
    const bp = filt(ctx, 'bandpass', 240, 8);
    bp.connect(out);
    osc(ctx, 'sawtooth', 120, 0.5, bp);
  },
  /* A CRT sitting on and doing nothing. */
  crt(ctx, out) {
    osc(ctx, 'sine', 7860, 0.02, out);
    const lp = filt(ctx, 'lowpass', 300, 1); lp.connect(out);
    osc(ctx, 'sawtooth', 60, 0.05, lp);
  },
  /* The breakfast room television: somebody talking, under a bed of music. */
  tvTalk(ctx, out, buf) {
    const n = noiseSrc(ctx, buf, 1);
    const bp = filt(ctx, 'bandpass', 700, 2);
    const g = ctx.createGain(); g.gain.value = 0.15;
    n.connect(bp).connect(g).connect(out);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4.3;
    const lg = ctx.createGain(); lg.gain.value = 0.12;
    lfo.connect(lg).connect(g.gain); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.9;
    const lg2 = ctx.createGain(); lg2.gain.value = 350;
    lfo2.connect(lg2).connect(bp.frequency); lfo2.start();
  },
  /* A coffee maker on its warming plate: a faint electric tick and steam. */
  coffee(ctx, out, buf) {
    const n = noiseSrc(ctx, buf, 1.3);
    const hp = filt(ctx, 'highpass', 3500, 0.7);
    const g = ctx.createGain(); g.gain.value = 0.08;
    n.connect(hp).connect(g).connect(out);
  },
  /* Laundry: a dryer turning over with something in it. */
  dryer(ctx, out, buf) {
    const n = noiseSrc(ctx, buf, 0.6);
    const lp = filt(ctx, 'lowpass', 400, 1);
    const g = ctx.createGain(); g.gain.value = 0.3;
    n.connect(lp).connect(g).connect(out);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.8;
    const lg = ctx.createGain(); lg.gain.value = 0.15;
    lfo.connect(lg).connect(g.gain); lfo.start();
  },
  /* A motel room television heard through a door. */
  roomTv(ctx, out, buf) {
    const n = noiseSrc(ctx, buf, 0.9);
    const bp = filt(ctx, 'bandpass', 500, 1.5);
    const g = ctx.createGain(); g.gain.value = 0.12;
    n.connect(bp).connect(g).connect(out);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 3.1;
    const lg = ctx.createGain(); lg.gain.value = 0.1;
    lfo.connect(lg).connect(g.gain); lfo.start();
  },
};
export const LOOP_IDS = Object.keys(LOOPS);
