/* ============================================================
   textures.js -- the Starlite, painted a pixel at a time.

   Same method as Final Rental's texture set: power-of-two canvases
   drawn with a handful of helpers, aged with noise and grime, and
   dealt out in variants so a long wall never repeats itself. The
   palette is the motel's own: cream stucco, burnt-orange trim, doors
   that were teal in 1979, brown carpet, sodium orange outside and a
   lobby that is warmer than it needs to be.
   ============================================================ */
import { makeTex, fill, noise, speckle, grime, text, R } from '../../engine/texture.js';

/* Colors arrive as '#rrggbb' or as 'rgb(r,g,b)' (shade's own output, fed
   back in). Both have to parse: an unparsed one comes out as rgb(NaN...),
   which the canvas paints black. */
const rgbOf = (c) => {
  if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = c.match(/[\d.]+/g) || [0, 0, 0];
  return [+m[0], +m[1], +m[2]];
};
const hexA = (hex, a) => { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; };
const shade = (hex, k) => {
  const [r, g, b] = rgbOf(hex);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
};

export const PAL = {
  stucco: '#cdbb93', stuccoDark: '#a8966f', trim: '#a8502a', door: '#2d6f72', doorUp: '#2b6a6e',
  rail: '#d4cfc0', walk: '#8a857a', asphalt: '#1d1e23', paint: '#d8d2b6',
  lobbyWall: '#c9b48d', panel: '#5a3f26', carpet: '#5b3b24',
};

export function buildTextures() {
  const T = {};

  /* ============================================================
     OUTSIDE
     ============================================================ */
  /* Kept gentle: at night most of a wall is a few steps above black, and a
     busy texture down there dithers into salt and pepper. */
  const stucco = (base, dress) => makeTex(64, 64, (g, w, h) => {
    fill(g, base, w, h);
    speckle(g, w, h, 500, [shade(base, 0.96), shade(base, 1.04), shade(base, 0.93)]);
    noise(g, w, h, 5);
    if (dress) dress(g, w, h);
    grime(g, w, h, 0.05, 8);
  });
  T.stuccoSet = [
    stucco(PAL.stucco),
    stucco(PAL.stucco, (g, w, h) => { g.fillStyle = 'rgba(60,50,30,.18)'; g.fillRect(0, h - 10, w, 10); }),
    stucco(PAL.stucco, (g) => { g.strokeStyle = 'rgba(80,66,40,.35)'; g.beginPath(); g.moveTo(20, 0); g.lineTo(26, 30); g.lineTo(22, 64); g.stroke(); }),
    stucco(shade(PAL.stucco, 0.96)),
  ];
  T.stucco = T.stuccoSet[0];
  T.stuccoBack = stucco(PAL.stuccoDark);

  /* The burnt orange band that runs under every roofline, with the
     pinstripe somebody thought was a good idea in 1979. */
  T.fascia = makeTex(64, 16, (g, w, h) => {
    fill(g, PAL.trim, w, h);
    g.fillStyle = '#e0b04a'; g.fillRect(0, 3, w, 2);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 3, w, 3);
    noise(g, w, h, 10); grime(g, w, h, 0.15, 6);
  });
  T.roof = makeTex(64, 64, (g, w, h) => {
    fill(g, '#3d3630', w, h);
    speckle(g, w, h, 1400, ['#4a423a', '#2e2924', '#57504a', '#6a6258'], 1);
    noise(g, w, h, 12);
  });
  T.soffit = makeTex(64, 64, (g, w, h) => {
    fill(g, '#b9ad92', w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, 0, 1, h); }
    noise(g, w, h, 9); grime(g, w, h, 0.2, 10);
  });

  /* Room doors: flush steel, painted, with a peephole, a brass knob, a
     deadbolt and a security latch you can see the shape of. */
  const roomDoor = (base, worn) => makeTex(64, 128, (g, w, h) => {
    fill(g, base, w, h);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, 0, w, 3);
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1;
    g.strokeRect(6.5, 8.5, w - 13, 50); g.strokeRect(6.5, 66.5, w - 13, 52);
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(w / 2, 34, 1.6, 0, 7); g.fill();   // peephole
    g.fillStyle = '#b8953c'; g.beginPath(); g.arc(w - 10, 66, 3.2, 0, 7); g.fill();  // knob
    g.fillStyle = '#d8b95a'; g.fillRect(w - 11, 64, 2, 2);
    g.fillStyle = '#8d7a44'; g.beginPath(); g.arc(w - 10, 56, 2.4, 0, 7); g.fill();  // deadbolt
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, h - 10, w, 10);                    // kick scuffs
    if (worn) { g.fillStyle = 'rgba(210,200,170,.25)'; g.fillRect(w - 18, 58, 14, 16); }
    noise(g, w, h, 10); grime(g, w, h, 0.18, 10);
  });
  T.roomDoor = roomDoor(PAL.door, true);
  T.roomDoorUp = roomDoor(PAL.doorUp, false);
  T.doorInside = makeTex(64, 128, (g, w, h) => {
    fill(g, '#cfc5ae', w, h);
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.strokeRect(6.5, 8.5, w - 13, 50); g.strokeRect(6.5, 66.5, w - 13, 52);
    g.fillStyle = '#b8953c'; g.beginPath(); g.arc(w - 10, 66, 3, 0, 7); g.fill();
    // the fire-escape plan and the rates card on the back of the door
    g.fillStyle = '#efe9d8'; g.fillRect(14, 20, 34, 26);
    g.fillStyle = '#a3322a'; g.fillRect(14, 20, 34, 4);
    g.fillStyle = 'rgba(40,40,40,.6)'; for (let i = 0; i < 6; i++) g.fillRect(17, 28 + i * 3, 20 + R.int(8), 1);
    noise(g, w, h, 8);
  });
  T.steelDoor = makeTex(64, 128, (g, w, h) => {
    fill(g, '#6d7176', w, h);
    g.strokeStyle = 'rgba(20,26,32,.5)'; g.strokeRect(7.5, 8.5, w - 15, 110);
    g.fillStyle = '#c9c2ac'; g.fillRect(w - 12, 62, 6, 4);
    noise(g, w, h, 10); grime(g, w, h, 0.25, 12);
  });
  T.officeDoor = makeTex(64, 128, (g, w, h) => {
    fill(g, '#b9a784', w, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${90 + R.int(30)},${60 + R.int(20)},${30 + R.int(15)},.18)`; g.fillRect(R.int(w), 0, 1 + R.int(2), h); }
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.strokeRect(7.5, 10.5, w - 15, 45); g.strokeRect(7.5, 64.5, w - 15, 54);
    g.fillStyle = '#b8953c'; g.beginPath(); g.arc(w - 10, 66, 3, 0, 7); g.fill();
    noise(g, w, h, 8);
  });
  T.doorFrame = makeTex(32, 64, (g, w, h) => {
    fill(g, '#6a5a3c', w, h); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, 3, h); noise(g, w, h, 10);
  });
  T.bronze = makeTex(16, 64, (g, w, h) => {      // storefront aluminum, anodized bronze
    fill(g, '#4a3d2e', w, h); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(0, 0, 2, h); noise(g, w, h, 8);
  });

  /* Windows: the curtain seen from outside. Dark for a vacant room or a
     sleeping one; lit warm through the lining when somebody is up. */
  const curtain = (lit) => makeTex(64, 64, (g, w, h) => {
    fill(g, lit ? '#d9a15a' : '#2a2620', w, h);
    for (let x = 0; x < w; x += 6) {
      g.fillStyle = lit ? 'rgba(120,60,20,.35)' : 'rgba(0,0,0,.35)'; g.fillRect(x, 0, 2, h);
      g.fillStyle = lit ? 'rgba(255,220,150,.25)' : 'rgba(255,255,255,.04)'; g.fillRect(x + 3, 0, 1, h);
    }
    if (lit) { const gr = g.createRadialGradient(40, 30, 2, 40, 30, 40); gr.addColorStop(0, 'rgba(255,230,170,.5)'); gr.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    // the gap in the middle where the curtains never quite meet
    g.fillStyle = lit ? '#ffe2a8' : '#15130f'; g.fillRect(31, 0, 2, h);
    g.fillStyle = 'rgba(160,190,210,.10)';
    g.beginPath(); g.moveTo(0, 50); g.lineTo(28, 0); g.lineTo(38, 0); g.lineTo(6, 64); g.fill();
    noise(g, w, h, 6);
  });
  T.curtainDark = curtain(false);
  T.curtainLit = curtain(true);
  T.curtainTv = makeTex(64, 64, (g, w, h) => {
    fill(g, '#39465a', w, h);
    for (let x = 0; x < w; x += 6) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, 0, 2, h); }
    const gr = g.createRadialGradient(20, 36, 2, 20, 36, 30); gr.addColorStop(0, 'rgba(160,190,255,.45)'); gr.addColorStop(1, 'rgba(160,190,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9fb6e0'; g.fillRect(31, 0, 2, h);
    noise(g, w, h, 6);
  });
  T.acGrille = makeTex(32, 32, (g, w, h) => {
    fill(g, '#9e9a8e', w, h);
    g.fillStyle = '#4c4a44'; for (let y = 3; y < h - 3; y += 3) g.fillRect(3, y, w - 6, 1);
    g.fillStyle = 'rgba(80,50,20,.3)'; g.fillRect(0, h - 5, w, 5);
    noise(g, w, h, 10);
  });
  T.porchLight = makeTex(16, 16, (g, w, h) => {
    fill(g, '#fff0c4', w, h); g.fillStyle = 'rgba(160,110,40,.5)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  });
  T.walk = makeTex(64, 64, (g, w, h) => {
    fill(g, PAL.walk, w, h);
    speckle(g, w, h, 800, ['#7f7a70', '#96918a', '#75716a']);
    g.fillStyle = 'rgba(40,36,30,.5)'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h);   // expansion joints
    noise(g, w, h, 10); grime(g, w, h, 0.18, 10);
  });
  T.walkStain = makeTex(64, 64, (g, w, h) => {
    fill(g, PAL.walk, w, h);
    speckle(g, w, h, 800, ['#7f7a70', '#96918a', '#75716a']);
    g.fillStyle = 'rgba(40,36,30,.5)'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h);
    g.fillStyle = 'rgba(30,26,20,.28)'; g.beginPath(); g.ellipse(34, 38, 14, 9, 0.4, 0, 7); g.fill();   // oil, coffee, who knows
    noise(g, w, h, 10);
  });
  T.slab = makeTex(64, 64, (g, w, h) => {        // underside of the upper walkway
    fill(g, '#7a766c', w, h); speckle(g, w, h, 500, ['#6f6b62', '#858177']); noise(g, w, h, 8); grime(g, w, h, 0.2, 10);
  });
  T.curb = makeTex(64, 16, (g, w, h) => { fill(g, '#9a958a', w, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 4, w, 4); noise(g, w, h, 10); });
  T.curbYellow = makeTex(64, 16, (g, w, h) => { fill(g, '#b89a3a', w, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 4, w, 4); noise(g, w, h, 12); grime(g, w, h, 0.2, 6); });

  /* Asphalt, and the stall paint painted INTO the tiles rather than laid
     over them -- Final Rental learned that a decal a few millimetres over a
     floor is a coin toss for the depth buffer. */
  const asphalt = (dress) => makeTex(64, 64, (g, w, h) => {
    fill(g, PAL.asphalt, w, h);
    speckle(g, w, h, 900, ['#23252b', '#17181c', '#2a2c32', '#303238']);
    noise(g, w, h, 10);
    if (dress) dress(g, w, h);
  });
  T.asphaltSet = [
    asphalt(),
    asphalt((g) => { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(30, 34, 12, 8, 0.3, 0, 7); g.fill(); }),
    asphalt((g) => { g.strokeStyle = 'rgba(10,10,10,.6)'; g.beginPath(); g.moveTo(0, 40); g.lineTo(20, 36); g.lineTo(44, 44); g.lineTo(64, 38); g.stroke(); }),
  ];
  T.asphalt = T.asphaltSet[0];
  T.stallLine = asphalt((g, w, h) => { g.fillStyle = hexA(PAL.paint, 0.75); g.fillRect(0, 0, 3, h); speckle(g, 3, h, 30, ['#1d1e23']); });
  /* Two orientations: a line down a tile's max-x edge (running along z), and
     one across its min-z edge (running along x). See geo.floor for why. */
  T.stallLineX = asphalt((g, w, h) => { g.fillStyle = hexA(PAL.paint, 0.75); g.fillRect(0, 0, 3, h); });
  T.stallLineZ = asphalt((g, w, h) => { g.fillStyle = hexA(PAL.paint, 0.75); g.fillRect(0, 0, w, 3); });
  T.stallEnd = asphalt((g, w, h) => { g.fillStyle = hexA(PAL.paint, 0.75); g.fillRect(0, 0, 3, h); g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(34, 20, 14, 6, 0, 0, 7); g.fill(); });
  T.road = makeTex(64, 64, (g, w, h) => {
    fill(g, '#202127', w, h); speckle(g, w, h, 900, ['#26272d', '#1a1b20', '#2d2e34']); noise(g, w, h, 8);
  });
  T.roadLine = makeTex(64, 64, (g, w, h) => {
    fill(g, '#202127', w, h); speckle(g, w, h, 900, ['#26272d', '#1a1b20', '#2d2e34']);
    g.fillStyle = '#c9a53a'; g.fillRect(0, 29, w, 2); g.fillRect(0, 33, w, 2);
    noise(g, w, h, 8);
  });
  T.roadDash = makeTex(64, 64, (g, w, h) => {
    fill(g, '#202127', w, h); speckle(g, w, h, 900, ['#26272d', '#1a1b20', '#2d2e34']);
    g.fillStyle = '#bdb8a4'; g.fillRect(0, 31, 32, 2);
    noise(g, w, h, 8);
  });
  T.grass = makeTex(64, 64, (g, w, h) => {
    fill(g, '#26301c', w, h); speckle(g, w, h, 1600, ['#2d3a20', '#1f2817', '#35422a', '#3a3a22']); noise(g, w, h, 12);
  });
  T.gravel = makeTex(64, 64, (g, w, h) => {
    fill(g, '#4a463f', w, h); speckle(g, w, h, 1800, ['#5a554c', '#3a3731', '#686258', '#2f2d29'], 1); noise(g, w, h, 10);
  });

  /* Railings: painted steel pickets. Transparent between the pickets, so a
     whole bay of railing is one quad the rasterizer sees through. */
  T.railing = makeTex(64, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = PAL.rail;
    g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
    for (let x = 2; x < w; x += 6) g.fillRect(x, 3, 2, h - 6);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 2, w, 1);
  });
  T.railSolid = makeTex(16, 16, (g, w, h) => { fill(g, PAL.rail, w, h); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, h - 3, w, 3); noise(g, w, h, 8); });
  T.post = makeTex(16, 64, (g, w, h) => { fill(g, '#bfb9a8', w, h); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(w - 3, 0, 3, h); noise(g, w, h, 10); grime(g, w, h, 0.2, 5); });
  T.chainlink = makeTex(32, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#9ea39e';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x + y) % 8 === 0) || ((x - y + 64) % 8 === 0)) g.fillRect(x, y, 1, 1);
  });
  T.stair = makeTex(32, 32, (g, w, h) => {
    fill(g, '#8c877c', w, h); g.fillStyle = '#b8ab6a'; g.fillRect(0, 0, w, 3);   // yellow nosing
    speckle(g, w, h, 200, ['#7c776d', '#9a958b']); noise(g, w, h, 8);
  });
  T.stringer = makeTex(64, 16, (g, w, h) => { fill(g, '#9b968a', w, h); noise(g, w, h, 8); grime(g, w, h, 0.2, 5); });

  T.pole = makeTex(16, 64, (g, w, h) => { fill(g, '#55575a', w, h); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(0, 0, 3, h); noise(g, w, h, 8); });
  T.sodium = makeTex(16, 16, (g, w, h) => { fill(g, '#ffcf7a', w, h); g.fillStyle = '#fff1c8'; g.fillRect(3, 3, w - 6, h - 6); });
  T.lampHead = makeTex(16, 16, (g, w, h) => { fill(g, '#3b3d40', w, h); noise(g, w, h, 6); });
  T.dark = makeTex(8, 8, (g, w, h) => fill(g, '#060709', w, h));
  T.black = makeTex(8, 8, (g, w, h) => fill(g, '#000000', w, h));

  /* ---- the pool ---- */
  T.poolDeck = makeTex(64, 64, (g, w, h) => {
    fill(g, '#a39c8a', w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = ['#b1aa96', '#958e7c', '#aaa38f'][R.int(3)]; g.fillRect(R.int(w), R.int(h), 2, 2); }
    g.fillStyle = 'rgba(40,36,30,.4)'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h);
    noise(g, w, h, 8);
  });
  T.poolCoping = makeTex(64, 16, (g, w, h) => { fill(g, '#d8d2c0', w, h); g.fillStyle = '#2a6f8f'; g.fillRect(0, h - 4, w, 4); noise(g, w, h, 6); });
  T.poolTile = makeTex(32, 32, (g, w, h) => {
    fill(g, '#3a8fb4', w, h);
    g.strokeStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < w; i += 8) { g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, h); g.stroke(); g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(w, i + 0.5); g.stroke(); }
    noise(g, w, h, 6);
  });
  T.poolWater = [];
  for (let f = 0; f < 4; f++) {
    T.poolWater.push(makeTex(64, 64, (g, w, h) => {
      fill(g, '#2a8fbc', w, h);
      g.strokeStyle = 'rgba(190,240,255,.45)'; g.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        const y = (i * 7 + f * 3) % h, x = (i * 13 + f * 5) % w;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 3, x + 16, y); g.stroke();
      }
      g.fillStyle = '#1d6f97'; for (let y = 0; y < h; y += 16) g.fillRect(0, (y + f * 4) % h, w, 1);
      noise(g, w, h, 5);
    }));
  }
  T.lounger = makeTex(32, 64, (g, w, h) => {
    fill(g, '#d7d0bc', w, h);
    for (let y = 0; y < h; y += 5) { g.fillStyle = y % 10 ? '#3f7f9a' : '#e0dac8'; g.fillRect(0, y, w, 3); }
    noise(g, w, h, 12); grime(g, w, h, 0.2, 8);
  });
  T.whiteMetal = makeTex(16, 16, (g, w, h) => { fill(g, '#dcd6c6', w, h); noise(g, w, h, 8); });

  /* ---- signs ---- */
  const neonText = (g, s, x, y, px, hue, core = '#fff4ee') => {
    text(g, s, x, y, px, hue, { glow: hue, blur: 7 });
    text(g, s, x, y, px, hue, { glow: hue, blur: 3 });
    text(g, s, x, y, px - 1, core);
  };
  /* The pylon: a big two-sided cabinet by the highway. STARLITE in turquoise
     neon on a tilted board with a starburst, MOTOR LODGE on the yellow band,
     and the reader board that has said the same four things since 1988. */
  T.signTop = makeTex(128, 64, (g, w, h) => {
    fill(g, '#0d1f2a', w, h);
    g.strokeStyle = '#e8b04a'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    // the star
    g.save(); g.translate(22, 22);
    g.fillStyle = '#ffe28a'; g.shadowColor = '#ffd24a'; g.shadowBlur = 8;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 6 : 15; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.restore();
    neonText(g, 'Starlite', 76, 28, 24, '#4ff0e6');
    g.fillStyle = '#ff6a8a'; g.shadowBlur = 0;
    for (let x = 12; x < w - 8; x += 9) { g.beginPath(); g.arc(x, h - 9, 2, 0, 7); g.fill(); }
  });
  T.signBand = makeTex(128, 32, (g, w, h) => {
    fill(g, '#e2b440', w, h);
    text(g, 'MOTOR LODGE', w / 2, h / 2 + 1, 17, '#7a2a14');
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, h - 3, w, 3);
    noise(g, w, h, 6);
  });
  T.readerboard = makeTex(128, 64, (g, w, h) => {
    fill(g, '#f3eedc', w, h);
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
    const lines = ['COLOR TV • POOL', 'FREE CONTINENTAL', 'BREAKFAST', 'WEEKLY RATES'];
    lines.forEach((s, i) => text(g, s, w / 2, 10 + i * 14, 11, i === 1 || i === 2 ? '#8a1a14' : '#1a1a1a'));
    noise(g, w, h, 5);
  });
  T.vacancy = makeTex(64, 16, (g, w, h) => {
    fill(g, '#140806', w, h);
    text(g, 'NO', 9, h / 2 + 1, 9, '#3a1412');
    neonText(g, 'VACANCY', 38, h / 2 + 1, 10, '#ff3a2a');
  });
  T.noVacancy = makeTex(64, 16, (g, w, h) => {
    fill(g, '#140806', w, h);
    neonText(g, 'NO', 9, h / 2 + 1, 9, '#ff3a2a');
    neonText(g, 'VACANCY', 38, h / 2 + 1, 10, '#ff3a2a');
  });
  T.officeSign = makeTex(64, 16, (g, w, h) => { fill(g, '#0b1418', w, h); neonText(g, 'OFFICE', w / 2, h / 2 + 1, 11, '#4ff0e6'); });
  T.officeHours = makeTex(64, 32, (g, w, h) => {
    fill(g, '#efe7d2', w, h);
    text(g, 'OFFICE', w / 2, 7, 7, '#1a1a1a'); text(g, 'OPEN 24 HOURS', w / 2, 16, 6, '#8a1a14');
    text(g, 'RING BELL', w / 2, 25, 6, '#1a1a1a');
    noise(g, w, h, 6);
  });
  const plate = (s, bg = '#efe7d2', fg = '#1a1a1a', px = 7) => makeTex(64, 16, (g, w, h) => {
    fill(g, bg, w, h); g.strokeStyle = fg; g.lineWidth = 1; g.strokeRect(1.5, 1.5, w - 3, h - 3);
    text(g, s, w / 2, h / 2 + 1, px, fg); noise(g, w, h, 6);
  });
  T.iceSign = makeTex(64, 16, (g, w, h) => { fill(g, '#123a58', w, h); text(g, 'ICE', w / 2, h / 2 + 1, 11, '#d8f0ff'); noise(g, w, h, 6); });
  T.laundrySign = plate('GUEST LAUNDRY');
  T.maintSign = plate('EMPLOYEES ONLY', '#efe7d2', '#8a1a14', 6);
  T.poolRules = makeTex(32, 64, (g, w, h) => {
    fill(g, '#efe7d2', w, h);
    text(g, 'POOL', w / 2, 6, 7, '#123a58');
    text(g, 'NO LIFEGUARD', w / 2, 16, 4, '#8a1a14'); text(g, 'ON DUTY', w / 2, 21, 4, '#8a1a14');
    g.fillStyle = 'rgba(30,30,30,.7)'; for (let i = 0; i < 9; i++) g.fillRect(4, 28 + i * 3.4, 18 + R.int(6), 1);
    text(g, '7AM - 10PM', w / 2, 60, 4, '#1a1a1a');
    noise(g, w, h, 6);
  });
  /* Mr. Wexler's sign. Somebody will fix it eventually. */
  T.noPets = plate("NO PET'S", '#efe7d2', '#8a1a14', 8);
  T.noPetsFixed = plate('NO PETS', '#efe7d2', '#8a1a14', 8);
  T.checkoutSign = makeTex(64, 32, (g, w, h) => {
    fill(g, '#efe7d2', w, h);
    text(g, 'CHECK-OUT', w / 2, 8, 7, '#1a1a1a'); text(g, '11:00 AM', w / 2, 18, 8, '#8a1a14');
    text(g, 'NO PERSONAL CHECKS', w / 2, 27, 5, '#1a1a1a'); noise(g, w, h, 6);
  });
  T.ratesSign = makeTex(64, 64, (g, w, h) => {
    fill(g, '#efe7d2', w, h);
    text(g, 'ROOM RATES', w / 2, 7, 7, '#123a58');
    const r = [['1 PERSON', '32.95'], ['2 PERSONS', '36.95'], ['2 QUEEN', '42.95'], ['WEEKLY', '159.00'], ['ROLLAWAY', '5.00']];
    r.forEach(([a, b], i) => { text(g, a, 4, 18 + i * 8, 5, '#1a1a1a', { align: 'left' }); text(g, b, w - 4, 18 + i * 8, 5, '#1a1a1a', { align: 'right' }); });
    text(g, '+ TAX', w / 2, 60, 5, '#8a1a14'); noise(g, w, h, 6);
  });
  T.bfastSign = makeTex(64, 32, (g, w, h) => {
    fill(g, '#efe7d2', w, h);
    text(g, 'DELUXE', w / 2, 7, 6, '#8a1a14');
    text(g, 'CONTINENTAL', w / 2, 15, 6, '#1a1a1a'); text(g, 'BREAKFAST', w / 2, 22, 6, '#1a1a1a');
    text(g, '6 - 9 AM', w / 2, 29, 5, '#123a58'); noise(g, w, h, 6);
  });
  /* The diner across the highway, which you only ever see lit up. */
  T.dinerSign = makeTex(64, 32, (g, w, h) => {
    fill(g, '#0a0c10', w, h);
    neonText(g, "PEG'S", w / 2, 10, 11, '#ff7a3a');
    neonText(g, 'DINER', w / 2, 21, 9, '#4ff0e6');
    text(g, 'OPEN 24 HRS', w / 2, 29, 5, '#ffd24a');
  });
  T.gasSign = makeTex(32, 32, (g, w, h) => {
    fill(g, '#0a0c10', w, h); g.fillStyle = '#d8332a'; g.fillRect(4, 4, w - 8, 14);
    text(g, 'GAS', w / 2, 11, 9, '#fff'); text(g, '1.19⁹', w / 2, 25, 7, '#ffe28a');
  });

  /* Room number plates, brass numerals on a dark oval. */
  T.roomNo = {};
  const nums = [];
  for (let i = 101; i <= 115; i++) nums.push(String(i));
  for (let i = 201; i <= 213; i++) nums.push(String(i));
  for (const n of nums) {
    T.roomNo[n] = makeTex(32, 16, (g, w, h) => {
      fill(g, '#1f2a2c', w, h);
      g.strokeStyle = '#b8953c'; g.strokeRect(0.5, 0.5, w - 1, h - 1);
      text(g, n, w / 2, h / 2 + 1, 10, '#e0c268');
    });
  }

  /* ---- the backdrop: pines, the highway lights, the sky ---- */
  const backdrop = (phase) => makeTex(128, 64, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    if (phase === 'night') { sky.addColorStop(0, '#04060d'); sky.addColorStop(0.7, '#0b1020'); sky.addColorStop(1, '#141626'); }
    else if (phase === 'predawn') { sky.addColorStop(0, '#0a1024'); sky.addColorStop(0.6, '#26304e'); sky.addColorStop(1, '#4a4058'); }
    else { sky.addColorStop(0, '#3a5a86'); sky.addColorStop(0.55, '#8a8aa4'); sky.addColorStop(1, '#e0a878'); }
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    if (phase === 'night') for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,240,${0.2 + R() * 0.5})`; g.fillRect(R.int(w), R.int(h * 0.55), 1, 1); }
    // treeline: loblolly pines, which is to say ragged triangles on a dark mass
    g.fillStyle = phase === 'dawn' ? '#1a2016' : '#030504';
    g.fillRect(0, h - 16, w, 16);
    for (let x = 0; x < w; x += 3 + R.int(4)) {
      const th = 10 + R.int(16);
      g.beginPath(); g.moveTo(x - 4, h - 14); g.lineTo(x, h - 14 - th); g.lineTo(x + 4, h - 14); g.fill();
    }
    if (phase !== 'dawn') for (let i = 0; i < 6; i++) { g.fillStyle = R.chance(0.5) ? '#ffcf7a' : '#e8eef6'; g.fillRect(R.int(w), h - 6 - R.int(6), 1, 1); }
  });
  T.backdrop = { night: backdrop('night'), predawn: backdrop('predawn'), dawn: backdrop('dawn') };

  /* ============================================================
     THE OFFICE
     ============================================================ */
  T.lobbyTile = makeTex(64, 64, (g, w, h) => {        // 12" terracotta-look vinyl
    fill(g, '#8a5a3a', w, h);
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) {
      g.fillStyle = shade('#8a5a3a', 0.9 + R() * 0.2); g.fillRect(x + 1, y + 1, 30, 30);
    }
    g.fillStyle = 'rgba(40,24,14,.55)'; for (let i = 0; i <= w; i += 32) { g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
    speckle(g, w, h, 300, ['#9a6a48', '#7a4e32']); noise(g, w, h, 8); grime(g, w, h, 0.14, 8);
  });
  T.entryMat = makeTex(64, 64, (g, w, h) => {
    fill(g, '#2a2622', w, h); g.strokeStyle = '#4a443c'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
    for (let y = 8; y < h - 8; y += 3) { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(6, y, w - 12, 1); }
    text(g, 'STARLITE', w / 2, h / 2, 9, '#6a6258');
    noise(g, w, h, 12); grime(g, w, h, 0.3, 10);
  });
  T.bfastFloor = makeTex(64, 64, (g, w, h) => {        // checkerboard vinyl, a shade yellowed
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#2c2a26' : '#d8cfb4'; g.fillRect(x * 16, y * 16, 16, 16);
    }
    noise(g, w, h, 10); grime(g, w, h, 0.12, 10);
  });
  T.officeCarpet = makeTex(64, 64, (g, w, h) => {
    fill(g, '#4e3b2c', w, h); speckle(g, w, h, 1100, ['#5a4534', '#433225', '#62503e']); noise(g, w, h, 10); grime(g, w, h, 0.2, 10);
  });
  T.pantryFloor = makeTex(64, 64, (g, w, h) => {
    fill(g, '#b9b09a', w, h);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = shade('#b9b09a', 0.93 + R() * 0.12); g.fillRect(x + 1, y + 1, 14, 14); }
    noise(g, w, h, 8); grime(g, w, h, 0.18, 10);
  });
  /* The lobby walls: wallpaper over wood paneling, and a rail between them. */
  const wallpaper = (base, stripe, dress) => makeTex(64, 64, (g, w, h) => {
    fill(g, base, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = stripe; g.fillRect(x + 6, 0, 3, h); g.fillRect(x + 11, 0, 1, h); }
    for (let y = 4; y < h; y += 16) for (let x = 2; x < w; x += 16) { g.fillStyle = hexA(stripe, 0.8); g.fillRect(x, y, 2, 2); }
    noise(g, w, h, 8);
    if (dress) dress(g, w, h);
    grime(g, w, h, 0.08, 6);
  });
  T.wallpaperSet = [
    wallpaper('#c9b48d', 'rgba(140,96,54,.35)'),
    wallpaper('#c9b48d', 'rgba(140,96,54,.35)', (g) => { g.fillStyle = 'rgba(255,248,225,.12)'; g.fillRect(14, 10, 30, 34); }),
    wallpaper('#c4ae86', 'rgba(140,96,54,.35)'),
  ];
  T.wallpaper = T.wallpaperSet[0];
  T.bfastWall = wallpaper('#d6c38a', 'rgba(170,110,40,.28)');
  T.paneling = makeTex(64, 64, (g, w, h) => {
    fill(g, PAL.panel, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, 0, 1, h); g.fillStyle = 'rgba(255,220,170,.06)'; g.fillRect(x + 1, 0, 1, h); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${90 + R.int(40)},${60 + R.int(30)},${34 + R.int(20)},.45)`; g.fillRect(0, R.int(h), w, 1); }
    noise(g, w, h, 12);
  });
  T.rail = makeTex(64, 16, (g, w, h) => { fill(g, '#3a2818', w, h); g.fillStyle = '#4c3522'; g.fillRect(0, 2, w, 5); noise(g, w, h, 10); });
  T.baseboard = makeTex(64, 16, (g, w, h) => { fill(g, '#2e2218', w, h); noise(g, w, h, 8); });
  T.plainWall = makeTex(64, 64, (g, w, h) => { fill(g, '#bdb4a0', w, h); noise(g, w, h, 10); grime(g, w, h, 0.14, 10); });
  T.blockWall = makeTex(64, 64, (g, w, h) => {
    fill(g, '#a8a192', w, h);
    g.strokeStyle = 'rgba(60,56,48,.45)';
    for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); }
    for (let y = 0; y < h; y += 16) { const off = (y / 16) % 2 ? 0 : 16; for (let x = off; x <= w; x += 32) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 16); g.stroke(); } }
    noise(g, w, h, 12); grime(g, w, h, 0.22, 10);
  });

  const ceilingTile = (dress) => makeTex(64, 64, (g, w, h) => {
    fill(g, '#c4bca8', w, h);
    speckle(g, w, h, 1400, ['#b3ab97', '#d0c8b4', '#a8a08c'], 1);
    if (dress) dress(g, w, h);
    g.strokeStyle = '#7a735f'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
    noise(g, w, h, 8);
  });
  const stain = (g, x, y, r, a) => {
    const gr = g.createRadialGradient(x, y, 1, x, y, r);
    gr.addColorStop(0, `rgba(122,92,42,${a})`); gr.addColorStop(0.62, `rgba(138,110,58,${a * 0.45})`); gr.addColorStop(1, 'rgba(120,90,40,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  T.ceilingTiles = [
    ceilingTile(null), ceilingTile(null), ceilingTile((g) => stain(g, 44, 14, 14, 0.4)),
    ceilingTile((g, w, h) => { g.fillStyle = '#8e8a7c'; g.fillRect(10, 10, w - 20, h - 20); g.fillStyle = '#3c3a34'; for (let y = 14; y < h - 12; y += 5) g.fillRect(13, y, w - 26, 3); }),
  ];
  T.popcornCeiling = makeTex(64, 64, (g, w, h) => {       // the rooms have the textured kind
    fill(g, '#d8d2c0', w, h); speckle(g, w, h, 1600, ['#cfc8b4', '#e2dccb', '#c4bda9'], 1); noise(g, w, h, 10);
  });
  T.lightPanel = makeTex(64, 64, (g, w, h) => {
    fill(g, '#f0f2e4', w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(200,210,190,.5)'; g.fillRect(x, 0, 3, h); }
    g.fillStyle = '#8d9a8d'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  });
  T.glass = makeTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,150,160,.14)'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(0, 52); g.lineTo(30, 0); g.lineTo(42, 0); g.lineTo(8, 60); g.fill();
    g.fillStyle = 'rgba(40,50,40,.22)'; g.fillRect(0, 56, w, 8);
  });
  T.glassDoor = makeTex(64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,150,160,.14)'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(0, 77); g.lineTo(30, 6); g.lineTo(42, 6); g.lineTo(10, 90); g.fill();
    // the push bar and the decals everybody's door has
    g.fillStyle = '#9aa0a6'; g.fillRect(4, 70, w - 8, 4);
    g.fillStyle = 'rgba(230,220,190,.85)'; g.fillRect(12, 36, 40, 10);
    text(g, 'VISA  MC  AMEX', 32, 41, 5, '#1a3a78');
    g.fillStyle = 'rgba(230,220,190,.85)'; g.fillRect(16, 50, 32, 8);
    text(g, 'AAA', 32, 54, 6, '#a3222a');
    g.fillStyle = 'rgba(40,50,40,.22)'; g.fillRect(0, h - 11, w, 11);
  });

  /* Counter: wood-grain laminate front, a brown speckled formica top. */
  T.deskFront = makeTex(64, 64, (g, w, h) => {
    fill(g, '#6a4a2c', w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${70 + R.int(40)},${44 + R.int(24)},${22 + R.int(14)},.55)`; g.fillRect(0, R.int(h), w, 1 + R.int(2)); }
    g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 1, h);
    g.fillStyle = '#a8502a'; g.fillRect(0, 6, w, 3);       // the orange accent strip
    noise(g, w, h, 10); grime(g, w, h, 0.2, 8);
  });
  T.deskTop = makeTex(64, 64, (g, w, h) => {
    fill(g, '#8f7c62', w, h); speckle(g, w, h, 1200, ['#9c8a70', '#7c6a52', '#a8967c', '#6c5c46']); noise(g, w, h, 8); grime(g, w, h, 0.16, 10);
  });
  T.wood = makeTex(64, 64, (g, w, h) => {
    fill(g, '#5e4128', w, h);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${40 + R.int(40)},${26 + R.int(24)},${12 + R.int(14)},.55)`; g.fillRect(0, R.int(h), w, 1 + R.int(2)); }
    noise(g, w, h, 10);
  });
  T.woodLight = makeTex(64, 64, (g, w, h) => {
    fill(g, '#9a7a52', w, h);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${110 + R.int(40)},${80 + R.int(24)},${44 + R.int(14)},.5)`; g.fillRect(0, R.int(h), w, 1 + R.int(2)); }
    noise(g, w, h, 10);
  });
  T.formica = makeTex(64, 64, (g, w, h) => { fill(g, '#d8ceb2', w, h); speckle(g, w, h, 900, ['#c8bea2', '#e4dac0', '#b8ae94']); noise(g, w, h, 6); });
  T.metal = makeTex(32, 32, (g, w, h) => { fill(g, '#8a8c8e', w, h); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, w, 3); noise(g, w, h, 8); });
  T.darkMetal = makeTex(32, 32, (g, w, h) => { fill(g, '#2f3033', w, h); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, w, 2); noise(g, w, h, 6); });
  T.beige = makeTex(32, 32, (g, w, h) => { fill(g, '#cfc5a8', w, h); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 0, w, 3); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, h - 4, w, 4); noise(g, w, h, 6); grime(g, w, h, 0.12, 4); });
  T.brass = makeTex(16, 16, (g, w, h) => { fill(g, '#b8953c', w, h); g.fillStyle = '#e8c868'; g.fillRect(2, 2, 5, 3); noise(g, w, h, 8); });
  T.chrome = makeTex(16, 16, (g, w, h) => { fill(g, '#b8bcc0', w, h); g.fillStyle = '#f0f2f4'; g.fillRect(0, 2, w, 3); noise(g, w, h, 6); });
  T.plasticBlack = makeTex(16, 16, (g, w, h) => { fill(g, '#1c1c1f', w, h); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, w, 2); noise(g, w, h, 4); });
  T.white = makeTex(16, 16, (g, w, h) => { fill(g, '#e8e4d8', w, h); noise(g, w, h, 5); });
  T.paper = makeTex(32, 32, (g, w, h) => {
    fill(g, '#efe9d6', w, h); g.fillStyle = 'rgba(60,70,120,.35)'; for (let y = 6; y < h; y += 4) g.fillRect(2, y, w - 4, 1); noise(g, w, h, 5);
  });
  T.vinylOrange = makeTex(32, 32, (g, w, h) => { fill(g, '#b8602a', w, h); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(0, 0, w, 4); noise(g, w, h, 10); grime(g, w, h, 0.2, 5); });
  T.vinylBrown = makeTex(32, 32, (g, w, h) => { fill(g, '#5a3a22', w, h); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, w, 4); noise(g, w, h, 10); });
  T.plant = makeTex(32, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      g.strokeStyle = ['#2f5a2a', '#3f7a34', '#24461f'][R.int(3)]; g.lineWidth = 2;
      g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(R.int(w), h / 2, R.int(w), R.int(h / 2)); g.stroke();
    }
  });
  T.pot = makeTex(16, 16, (g, w, h) => { fill(g, '#8a4a2a', w, h); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, w, 3); noise(g, w, h, 8); });
  T.brochures = makeTex(64, 64, (g, w, h) => {
    fill(g, '#3a2a1c', w, h);
    const cols = ['#c8322a', '#2a6ab8', '#e0b440', '#3a8a4a', '#8a3a9a', '#e07a2a', '#2a9aa8'];
    const names = ['CAVERNS', 'GATOR', 'OUTLET', 'CASINO', 'CIVIL WAR', 'GOLF', 'BASS'];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = 3 + c * 15, y = 3 + r * 21, i = (r * 4 + c) % cols.length;
      g.fillStyle = cols[i]; g.fillRect(x, y, 13, 18);
      g.fillStyle = '#f0e8d0'; g.fillRect(x + 1, y + 11, 11, 5);
      text(g, names[i].slice(0, 5), x + 6.5, y + 13.5, 3, '#1a1a1a');
    }
    noise(g, w, h, 8);
  });
  T.corkboard = makeTex(64, 64, (g, w, h) => {
    fill(g, '#a8804a', w, h); speckle(g, w, h, 900, ['#98703e', '#b8905a']);
    const notes = [['#f0e8b0', 6, 6, 18, 14], ['#fff', 30, 4, 22, 18], ['#b8e0f0', 8, 26, 20, 16], ['#f0c0c0', 34, 30, 22, 20], ['#fff', 10, 46, 16, 14]];
    for (const [c, x, y, ww, hh] of notes) { g.fillStyle = c; g.fillRect(x, y, ww, hh); g.fillStyle = 'rgba(40,40,60,.45)'; for (let i = 3; i < hh - 2; i += 3) g.fillRect(x + 2, y + i, ww - 5, 1); g.fillStyle = '#c02020'; g.fillRect(x + ww / 2, y + 1, 2, 2); }
    noise(g, w, h, 8);
  });
  T.calendar = makeTex(32, 32, (g, w, h) => {
    fill(g, '#efe9d6', w, h); g.fillStyle = '#8a1a14'; g.fillRect(0, 0, w, 8);
    text(g, 'OCT 1997', w / 2, 4.5, 5, '#fff');
    g.fillStyle = 'rgba(0,0,0,.5)'; for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) g.fillRect(2 + c * 4, 11 + r * 4, 3, 3);
    g.fillStyle = '#c02020'; g.fillRect(2 + 4 * 4, 11 + 2 * 4, 3, 3);
  });
  T.clockFace = makeTex(32, 32, (g, w, h) => {
    fill(g, '#e8e0c8', w, h);
    g.strokeStyle = '#2a2418'; g.lineWidth = 2; g.beginPath(); g.arc(16, 16, 13, 0, 7); g.stroke();
    g.fillStyle = '#2a2418'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(16 + Math.sin(a) * 11 - 1, 16 - Math.cos(a) * 11 - 1, 2, 2); }
  });

  /* ---- desk equipment ---- */
  T.crtBody = makeTex(32, 32, (g, w, h) => { fill(g, '#cdc3a6', w, h); g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(0, h - 5, w, 5); for (let y = 6; y < 20; y += 3) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(4, y, w - 8, 1); } noise(g, w, h, 6); grime(g, w, h, 0.14, 4); });
  T.crtBezel = makeTex(64, 64, (g, w, h) => {
    fill(g, '#cdc3a6', w, h); g.fillStyle = '#b5ab8e'; g.fillRect(5, 5, w - 10, h - 16);
    g.fillStyle = '#6a6452'; text(g, 'ZENTEK', 12, h - 5, 5, '#6a6452', { align: 'left' });
    g.fillStyle = '#3aa84a'; g.fillRect(w - 10, h - 7, 3, 3);
    noise(g, w, h, 6);
  });
  T.keyboard = makeTex(64, 32, (g, w, h) => {
    fill(g, '#bdb396', w, h);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 15; c++) {
      g.fillStyle = r === 0 ? '#8e866e' : '#e4dcc4'; g.fillRect(2 + c * 4, 3 + r * 5.4, 3.2, 4);
    }
    g.fillStyle = '#e4dcc4'; g.fillRect(14, 25, 30, 4);
    noise(g, w, h, 5);
  });
  T.printerTop = makeTex(64, 32, (g, w, h) => {
    fill(g, '#cfc7ae', w, h); g.fillStyle = '#2a2824'; g.fillRect(6, 10, w - 12, 5);
    g.fillStyle = '#f2eee0'; g.fillRect(8, 2, w - 16, 9);
    g.fillStyle = 'rgba(60,160,60,.8)'; for (let x = 8; x < w - 8; x += 3) { g.fillRect(x, 3, 1, 1); g.fillRect(x, 9, 1, 1); }  // tractor feed holes
    g.fillStyle = '#3a8a3a'; g.fillRect(w - 8, h - 6, 3, 2);
    noise(g, w, h, 6);
  });
  T.imprinter = makeTex(32, 32, (g, w, h) => {
    fill(g, '#8a8c90', w, h); g.fillStyle = '#3a3c40'; g.fillRect(4, 8, w - 8, 16);
    g.fillStyle = '#d0d2d4'; g.fillRect(2, 4, w - 4, 3);
    text(g, 'ADDRESSOGRAPH', w / 2, h - 4, 3, '#1a1a1a');
    noise(g, w, h, 8);
  });
  T.bellTex = makeTex(16, 16, (g, w, h) => { fill(g, '#c8a24a', w, h); g.fillStyle = '#f2d880'; g.fillRect(3, 2, 5, 4); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, h - 4, w, 4); });
  T.binder = makeTex(32, 32, (g, w, h) => { fill(g, '#1f3a6a', w, h); g.fillStyle = '#efe9d6'; g.fillRect(6, 8, 20, 10); text(g, 'RESERV.', 16, 13, 4, '#1a1a1a'); noise(g, w, h, 6); });
  T.regCards = makeTex(32, 32, (g, w, h) => { fill(g, '#efe9d6', w, h); text(g, 'STARLITE', 16, 5, 4, '#8a1a14'); g.fillStyle = 'rgba(60,60,90,.4)'; for (let y = 10; y < h; y += 3) g.fillRect(3, y, 26, 1); noise(g, w, h, 5); });
  T.keyDrop = makeTex(32, 32, (g, w, h) => { fill(g, '#5a3a22', w, h); g.fillStyle = '#1a1210'; g.fillRect(5, 8, 22, 3); text(g, 'KEY', 16, 17, 6, '#e0c268'); text(g, 'DROP', 16, 24, 6, '#e0c268'); noise(g, w, h, 8); });
  T.registerBody = makeTex(64, 64, (g, w, h) => { fill(g, '#2f2e2a', w, h); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 0, w, 4); noise(g, w, h, 6); });
  T.registerKeys = makeTex(64, 64, (g, w, h) => {
    fill(g, '#39362f', w, h);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
      g.fillStyle = c > 3 ? '#9c3a26' : '#d8d0b8'; g.fillRect(4 + c * 9.6, 4 + r * 11, 8, 8);
    }
    noise(g, w, h, 5);
  });
  T.registerDisplay = makeTex(32, 16, (g, w, h) => { fill(g, '#0a1a0c', w, h); text(g, '0.00', w - 3, h / 2 + 1, 8, '#7effb0', { align: 'right' }); });

  /* ---- back office ---- */
  T.linenStack = makeTex(64, 64, (g, w, h) => {        // folded towels, white, in stacks
    fill(g, '#3a3632', w, h);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 6; r++) {
      g.fillStyle = r % 2 ? '#e8e6de' : '#d4d2ca'; g.fillRect(2 + c * 16, 2 + r * 10, 14, 9);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(2 + c * 16, 10 + r * 10, 14, 1);
    }
    noise(g, w, h, 6);
  });
  T.pillowStack = makeTex(64, 64, (g, w, h) => {
    fill(g, '#3a3632', w, h);
    for (let c = 0; c < 2; c++) for (let r = 0; r < 4; r++) { g.fillStyle = '#eae6da'; g.beginPath(); g.ellipse(16 + c * 32, 8 + r * 15, 14, 6.5, 0, 0, 7); g.fill(); }
    noise(g, w, h, 6);
  });
  T.blanketStack = makeTex(64, 64, (g, w, h) => {
    fill(g, '#3a3632', w, h);
    const cols = ['#7a2a24', '#2a4a6a', '#6a5a3a', '#8a7a52'];
    for (let r = 0; r < 6; r++) { g.fillStyle = cols[r % 4]; g.fillRect(2, 2 + r * 10, w - 4, 9); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(2, 2 + r * 10, w - 4, 1); }
    noise(g, w, h, 8);
  });
  T.suppliesBox = makeTex(64, 64, (g, w, h) => {
    fill(g, '#3a3632', w, h);
    const items = [['#f0e8d0', 'SOAP'], ['#c8e0f0', 'SHAMP'], ['#fff', 'T.P.'], ['#e0c8a0', 'BULBS'], ['#e8d040', 'AA'], ['#c8322a', 'MATCH']];
    items.forEach(([c, s], i) => { const x = 2 + (i % 3) * 21, y = 4 + Math.floor(i / 3) * 30; g.fillStyle = c; g.fillRect(x, y, 19, 24); text(g, s, x + 9.5, y + 12, 5, '#1a1a1a'); });
    noise(g, w, h, 6);
  });
  T.cardboard = makeTex(64, 64, (g, w, h) => {
    fill(g, '#9c7d52', w, h); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h / 2 - 1, w, 2);
    g.strokeStyle = 'rgba(60,44,26,.5)'; g.strokeRect(1.5, 1.5, w - 3, h - 3); noise(g, w, h, 11); grime(g, w, h, 0.2, 8);
  });
  T.steelShelf = makeTex(64, 64, (g, w, h) => { fill(g, '#6a675f', w, h); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 0, w, 3); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, h - 4, w, 4); noise(g, w, h, 10); grime(g, w, h, 0.3, 8); });
  T.fileCab = makeTex(32, 64, (g, w, h) => { fill(g, '#7a7a70', w, h); for (let y = 2; y < h; y += 16) { g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(2, y, w - 4, 1); g.fillStyle = '#c0c0b8'; g.fillRect(w / 2 - 4, y + 6, 8, 2); } noise(g, w, h, 8); });
  T.safe = makeTex(32, 32, (g, w, h) => { fill(g, '#3a3c38', w, h); g.fillStyle = '#9a9c98'; g.beginPath(); g.arc(16, 14, 5, 0, 7); g.fill(); g.fillStyle = '#2a2a28'; g.beginPath(); g.arc(16, 14, 3, 0, 7); g.fill(); text(g, 'MOSLER', 16, 26, 4, '#c0b890'); noise(g, w, h, 6); });
  T.breakerBox = makeTex(32, 64, (g, w, h) => {
    fill(g, '#9a9a90', w, h); g.fillStyle = '#6a6a62'; g.fillRect(3, 6, w - 6, h - 12);
    for (let r = 0; r < 10; r++) { g.fillStyle = '#2a2a2a'; g.fillRect(6, 9 + r * 5, 8, 3); g.fillRect(18, 9 + r * 5, 8, 3); }
    noise(g, w, h, 8);
  });
  T.timeclock = makeTex(32, 32, (g, w, h) => { fill(g, '#b0a890', w, h); g.fillStyle = '#e8e0c8'; g.beginPath(); g.arc(16, 12, 8, 0, 7); g.fill(); g.fillStyle = '#1a1a1a'; g.fillRect(10, 24, 12, 3); noise(g, w, h, 6); });
  T.mattress = makeTex(32, 32, (g, w, h) => { fill(g, '#d8d0bc', w, h); g.strokeStyle = 'rgba(120,110,90,.4)'; for (let i = 4; i < w; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); } noise(g, w, h, 8); });

  /* ---- pantry ---- */
  T.fridge = makeTex(32, 64, (g, w, h) => { fill(g, '#d8ceb0', w, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 22, w, 1); g.fillStyle = '#9a9072'; g.fillRect(w - 6, 8, 2, 10); g.fillRect(w - 6, 28, 2, 16); noise(g, w, h, 6); grime(g, w, h, 0.12, 5); });
  T.pantryStock = makeTex(64, 64, (g, w, h) => {
    fill(g, '#3a3632', w, h);
    const items = [['#6a3a1a', 'COFFEE'], ['#2a5a2a', 'DECAF'], ['#e0c050', 'WAFFLE'], ['#e07a2a', 'O.J.'], ['#c8322a', 'CEREAL'], ['#efe9d6', 'CUPS'], ['#b8864a', 'MUFFIN'], ['#d8b870', 'BAGEL'], ['#7a5a3a', 'FILTER']];
    items.forEach(([c, s], i) => { const x = 2 + (i % 3) * 21, y = 2 + Math.floor(i / 3) * 21; g.fillStyle = c; g.fillRect(x, y, 19, 18); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(x + 1, y + 6, 17, 6); text(g, s, x + 9.5, y + 9, 4, '#1a1a1a'); });
    noise(g, w, h, 6);
  });
  T.sink = makeTex(32, 32, (g, w, h) => { fill(g, '#b8bcc0', w, h); g.fillStyle = '#8a8e92'; g.fillRect(4, 4, w - 8, h - 8); g.fillStyle = '#4a4e52'; g.beginPath(); g.arc(16, 16, 2, 0, 7); g.fill(); noise(g, w, h, 6); });

  /* ---- breakfast ---- */
  T.cereal = makeTex(64, 32, (g, w, h) => {
    fill(g, '#2a2622', w, h);
    const boxes = [['#e0b030', 'FLAKES'], ['#c8322a', 'LOOPS'], ['#6a3a9a', 'RAISIN'], ['#2a7ab8', 'CRISP'], ['#e07a2a', 'PUFFS'], ['#3a8a3a', 'BRAN']];
    boxes.forEach(([c, s], i) => { const x = 1 + i * 10.5; g.fillStyle = c; g.fillRect(x, 4, 9.5, 26); g.fillStyle = '#fff'; g.fillRect(x + 1, 8, 7.5, 5); text(g, s.slice(0, 4), x + 4.75, 10.5, 3, '#1a1a1a'); });
    noise(g, w, h, 6);
  });
  T.muffins = makeTex(32, 32, (g, w, h) => {
    fill(g, '#d8d0bc', w, h);
    for (let i = 0; i < 9; i++) { const x = 5 + (i % 3) * 11, y = 5 + Math.floor(i / 3) * 11; g.fillStyle = i % 2 ? '#8a5a2a' : '#6a3a1a'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.fillStyle = 'rgba(40,20,60,.5)'; g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y + 1, 1, 1); }
    noise(g, w, h, 8);
  });
  T.danish = makeTex(32, 32, (g, w, h) => {
    fill(g, '#d8d0bc', w, h);
    for (let i = 0; i < 6; i++) { const x = 6 + (i % 3) * 10, y = 9 + Math.floor(i / 3) * 13; g.fillStyle = '#d0a060'; g.beginPath(); g.arc(x, y, 4.8, 0, 7); g.fill(); g.fillStyle = i % 2 ? '#b02a3a' : '#e8c040'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    noise(g, w, h, 8);
  });
  T.bagels = makeTex(32, 32, (g, w, h) => {
    fill(g, '#7a5a3a', w, h);
    for (let i = 0; i < 7; i++) { const x = 6 + (i % 3) * 10 + (i > 5 ? 5 : 0), y = 7 + Math.floor(i / 3) * 10; g.fillStyle = '#c89a5a'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.fillStyle = '#7a5a3a'; g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); }
    noise(g, w, h, 8);
  });
  T.fruit = makeTex(32, 32, (g, w, h) => {
    fill(g, '#6a4a2a', w, h);
    for (let i = 0; i < 5; i++) { g.fillStyle = '#c82a2a'; g.beginPath(); g.arc(6 + i * 5, 20 + (i % 2) * 4, 4, 0, 7); g.fill(); }
    g.fillStyle = '#e8d040'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(10 + i * 6, 10, 8, 3, 0.3, 0, 7); g.fill(); }
    noise(g, w, h, 8);
  });
  T.emptyTray = makeTex(32, 32, (g, w, h) => { fill(g, '#b8bcc0', w, h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(3, 3, w - 6, h - 6); speckle(g, w, h, 20, ['#c89a5a', '#8a5a2a']); noise(g, w, h, 6); });
  T.coffeeMaker = makeTex(32, 64, (g, w, h) => {
    fill(g, '#1e1e20', w, h); g.fillStyle = '#8a8c8e'; g.fillRect(2, 2, w - 4, 6);
    g.fillStyle = '#c02020'; g.fillRect(4, 12, 3, 3); g.fillStyle = '#2a2a2c'; g.fillRect(4, 18, w - 8, 3);
    text(g, 'BUNN', w / 2, 30, 6, '#d8d8d8');
    noise(g, w, h, 5);
  });
  T.potFull = makeTex(16, 16, (g, w, h) => { fill(g, '#3a1e0c', w, h); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(2, 0, 2, h); });
  T.potEmpty = makeTex(16, 16, (g, w, h) => { fill(g, '#4a5054', w, h); g.fillStyle = '#2a140a'; g.fillRect(0, h - 3, w, 3); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(2, 0, 2, h); });
  T.potDecaf = makeTex(16, 16, (g, w, h) => { fill(g, '#e07a2a', w, h); });   // the orange handle
  T.juice = makeTex(32, 64, (g, w, h) => {
    fill(g, '#9aa0a4', w, h); g.fillStyle = 'rgba(230,140,30,.95)'; g.fillRect(4, 14, w - 8, 36);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(6, 14, 3, 36);
    text(g, 'ORANGE', w / 2, 8, 5, '#1a1a1a'); noise(g, w, h, 5);
  });
  T.juiceEmpty = makeTex(32, 64, (g, w, h) => {
    fill(g, '#9aa0a4', w, h); g.fillStyle = 'rgba(200,210,215,.6)'; g.fillRect(4, 14, w - 8, 36);
    g.fillStyle = 'rgba(230,140,30,.9)'; g.fillRect(4, 46, w - 8, 4);
    text(g, 'ORANGE', w / 2, 8, 5, '#1a1a1a'); noise(g, w, h, 5);
  });
  T.waffleIron = makeTex(32, 32, (g, w, h) => {
    fill(g, '#2a2a2c', w, h); g.fillStyle = '#8a8c8e'; g.fillRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#3a3a3c'; for (let i = 6; i < w - 5; i += 5) { g.fillRect(i, 5, 2, h - 10); g.fillRect(5, i, w - 10, 2); }
    g.fillStyle = '#3aa84a'; g.fillRect(w - 6, h - 5, 3, 2);
    noise(g, w, h, 6);
  });
  T.waffleSmoke = makeTex(32, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(200,200,200,${0.1 + R() * 0.25})`; g.beginPath(); g.arc(R.int(w), R.int(h), 3 + R.int(6), 0, 7); g.fill(); }
  });
  T.batter = makeTex(16, 32, (g, w, h) => { fill(g, '#e8e2d0', w, h); g.fillStyle = 'rgba(230,200,120,.9)'; g.fillRect(2, 8, w - 4, h - 12); g.fillStyle = '#1a1a1a'; g.fillRect(4, h - 4, w - 8, 3); noise(g, w, h, 5); });
  T.plates = makeTex(16, 16, (g, w, h) => { fill(g, '#f0ece2', w, h); g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 2; y < h; y += 3) g.fillRect(0, y, w, 1); });
  T.cups = makeTex(16, 16, (g, w, h) => { fill(g, '#efe9d6', w, h); g.fillStyle = '#6a3a1a'; g.fillRect(0, 5, w, 3); });
  T.condiments = makeTex(32, 16, (g, w, h) => {
    fill(g, '#b8bcc0', w, h);
    const c = ['#e8d060', '#c02a3a', '#7a2a6a', '#efe9d6', '#e8a0b0'];
    for (let i = 0; i < 16; i++) { g.fillStyle = c[i % c.length]; g.fillRect(1 + (i % 8) * 4, 1 + Math.floor(i / 8) * 7, 3, 6); }
    noise(g, w, h, 5);
  });
  T.napkins = makeTex(16, 16, (g, w, h) => { fill(g, '#f6f2e6', w, h); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, h / 2, w, 1); });
  T.tableTop = makeTex(64, 64, (g, w, h) => { fill(g, '#b8a47a', w, h); speckle(g, w, h, 600, ['#a8946a', '#c8b48a']); g.strokeStyle = '#8a8c8e'; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2); noise(g, w, h, 6); });
  T.newsBundle = makeTex(32, 32, (g, w, h) => {
    fill(g, '#dcd6c6', w, h); g.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 3; y < h; y += 3) g.fillRect(0, y, w, 1);
    g.fillStyle = '#f0e8b0'; g.fillRect(0, 14, w, 3); g.fillRect(14, 0, 3, h);   // the strapping
  });
  T.newspaper = makeTex(64, 64, (g, w, h) => {
    fill(g, '#e2dccb', w, h);
    text(g, 'The Delphine Ledger', w / 2, 6, 6, '#1a1a1a', { face: 'Georgia,serif' });
    g.fillStyle = '#1a1a1a'; g.fillRect(3, 11, w - 6, 1);
    text(g, 'COUNCIL OKs', w / 2, 18, 7, '#1a1a1a'); text(g, 'OVERPASS', w / 2, 26, 7, '#1a1a1a');
    g.fillStyle = '#6a6a6a'; g.fillRect(4, 31, 26, 18);
    g.fillStyle = 'rgba(30,30,30,.55)'; for (let y = 32; y < h - 2; y += 2.2) { g.fillRect(33, y, 27, 1); if (y > 50) g.fillRect(4, y, 26, 1); }
    noise(g, w, h, 6);
  });
  T.trashCan = makeTex(32, 32, (g, w, h) => { fill(g, '#5a5e4a', w, h); g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 2, h); noise(g, w, h, 8); });
  T.bag = makeTex(16, 16, (g, w, h) => { fill(g, '#1c1c20', w, h); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(2, 2, 3, h - 4); });

  /* The breakfast television. Channels are little loops of frames; the
     news has a desk and a crawl, weather has the state, cartoons are loud. */
  T.channels = {};
  const tvFrame = (draw) => makeTex(64, 64, (g, w, h) => {
    draw(g, w, h);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < h; y += 2) g.fillRect(0, y, w, 1);
  });
  T.channels.NEWS = [0, 1, 2].map((f) => tvFrame((g, w, h) => {
    fill(g, '#1a2a5a', w, h);
    g.fillStyle = '#2a3a7a'; g.fillRect(0, 34, w, 20);
    g.fillStyle = '#c89a78'; g.beginPath(); g.arc(30, 22, 7, 0, 7); g.fill();     // the anchor
    g.fillStyle = '#2a2a3a'; g.fillRect(20, 29, 20, 12);
    g.fillStyle = '#1a1a1a'; g.fillRect(24, 14 + (f === 1 ? 1 : 0), 12, 5);
    g.fillStyle = '#c02020'; g.fillRect(0, 50, w, 7); text(g, 'KDLF 6 MORNING', w / 2, 53.5, 5, '#fff');
    g.fillStyle = '#e8e0c8'; g.fillRect(0, 57, w, 7);
    text(g, 'OVERPASS VOTE  •  TIGERS WIN', 32 - f * 8, 60.5, 4, '#1a1a1a');
  }));
  T.channels.WEATHER = [0, 1].map((f) => tvFrame((g, w, h) => {
    fill(g, '#2a5a2a', w, h);
    g.fillStyle = '#3a7a3a'; g.beginPath(); g.moveTo(8, 12); g.lineTo(50, 10); g.lineTo(54, 44); g.lineTo(30, 52); g.lineTo(10, 40); g.fill();
    g.fillStyle = f ? '#3a8ad8' : '#4a9ae8'; g.beginPath(); g.ellipse(24, 26, 10, 6, 0.3, 0, 7); g.fill();
    text(g, '64', 42, 22, 9, '#ffe28a'); text(g, '71', 20, 40, 9, '#ffe28a');
    g.fillStyle = '#1a1a3a'; g.fillRect(0, 54, w, 10); text(g, 'CLEAR - HIGH 78', w / 2, 59, 5, '#fff');
  }));
  T.channels.CARTOONS = [0, 1, 2].map((f) => tvFrame((g, w, h) => {
    fill(g, ['#e8d040', '#40c8e0', '#e05a9a'][f], w, h);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(24 + f * 6, 32, 12, 0, 7); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(20 + f * 6, 28, 2.5, 0, 7); g.arc(28 + f * 6, 28, 2.5, 0, 7); g.fill();
    g.fillStyle = '#c02020'; g.fillRect(19 + f * 6, 36, 10, 3);
    g.fillStyle = '#8a4a1a'; g.fillRect(44 - f * 4, 40, 10, 16);
  }));
  T.channels.INFOMERCIAL = [0, 1].map((f) => tvFrame((g, w, h) => {
    fill(g, '#e8e2d0', w, h);
    g.fillStyle = '#9aa0a8'; g.fillRect(14, 16, 36, 24);                 // the product
    g.fillStyle = '#c02020'; g.fillRect(18, 20, 28, 4);
    text(g, 'ONLY 3 EASY', w / 2, 8, 6, '#1a1a1a');
    g.fillStyle = f ? '#c02020' : '#1a3aa8'; g.fillRect(0, 46, w, 18);
    text(g, 'CALL NOW', w / 2, 51, 6, '#fff'); text(g, '1-800-555-0197', w / 2, 59, 5, '#ffe28a');
  }));
  T.channels.OFF = [makeTex(64, 64, (g, w, h) => { fill(g, '#1e2226', w, h); g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.ellipse(22, 20, 16, 10, -0.4, 0, 7); g.fill(); })];
  T.channels.STATIC = [0, 1, 2, 3].map(() => makeTex(64, 64, (g, w, h) => {
    const d = g.createImageData(w, h), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const v = R.chance(0.5) ? 20 + R.int(60) : 90 + R.int(150); p[i] = v; p[i + 1] = v; p[i + 2] = v + R.int(18); p[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }));
  T.tvShell = makeTex(32, 32, (g, w, h) => { fill(g, '#3b3830', w, h); g.fillStyle = '#2a2722'; g.fillRect(2, 2, w - 4, h - 4); noise(g, w, h, 8); });
  T.tvWood = makeTex(32, 32, (g, w, h) => { fill(g, '#5a3a22', w, h); for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(30,18,8,.4)'; g.fillRect(0, R.int(h), w, 1); } g.fillStyle = '#b8b0a0'; g.fillRect(w - 8, 6, 4, 4); g.fillRect(w - 8, 14, 4, 4); noise(g, w, h, 6); });

  /* ============================================================
     THE ROOMS
     ============================================================ */
  const carpet = (base, cols, pattern) => makeTex(64, 64, (g, w, h) => {
    fill(g, base, w, h);
    speckle(g, w, h, 900, cols);
    if (pattern) pattern(g, w, h);
    noise(g, w, h, 10); grime(g, w, h, 0.16, 10);
  });
  T.roomCarpet = [
    carpet('#6a4a2a', ['#7a5a36', '#5a3e22', '#8a6a3e']),                                           // brown shag, basically
    carpet('#3a5a52', ['#466a60', '#2e4a44', '#52766a'], (g, w, h) => { g.strokeStyle = 'rgba(200,170,90,.25)'; for (let i = 0; i < w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, h); g.stroke(); } }),
    carpet('#5a3a3a', ['#6a4444', '#4a3030', '#7a5050'], (g, w, h) => { g.fillStyle = 'rgba(210,180,110,.18)'; for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) g.fillRect(x + 6, y + 6, 4, 4); }),
  ];
  T.roomCarpetNew = carpet('#4a4e58', ['#525662', '#42464e', '#5a5e6a'], (g, w, h) => { g.strokeStyle = 'rgba(160,140,110,.25)'; for (let i = 0; i < w; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); } });
  T.bathTile = makeTex(64, 64, (g, w, h) => {
    fill(g, '#d8d0bc', w, h);
    g.fillStyle = 'rgba(120,110,90,.45)'; for (let i = 0; i <= w; i += 8) { g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
    noise(g, w, h, 6); grime(g, w, h, 0.1, 6);
  });
  T.bathWall = makeTex(64, 64, (g, w, h) => {
    fill(g, '#9ac0b8', w, h);                               // seafoam, the way God intended
    g.fillStyle = 'rgba(40,70,60,.35)'; for (let i = 0; i <= w; i += 16) { g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); }
    noise(g, w, h, 6);
  });
  const roomPaper = (base, motif) => makeTex(64, 64, (g, w, h) => {
    fill(g, base, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) { g.fillStyle = motif; g.beginPath(); g.ellipse(x + 4, y + 4, 2.5, 1.5, 0.6, 0, 7); g.fill(); }
    noise(g, w, h, 7); grime(g, w, h, 0.08, 5);
  });
  T.roomWall = [roomPaper('#cbbd98', 'rgba(140,110,60,.3)'), roomPaper('#c2b8a2', 'rgba(90,110,100,.3)'), roomPaper('#d0bfa0', 'rgba(150,80,60,.25)')];
  T.roomWallNew = makeTex(64, 64, (g, w, h) => { fill(g, '#d8d2c2', w, h); noise(g, w, h, 5); });
  T.roomWallSmoke = roomPaper('#b8a57a', 'rgba(120,90,40,.35)');
  const spread = (base, draw) => makeTex(64, 64, (g, w, h) => { fill(g, base, w, h); draw(g, w, h); noise(g, w, h, 10); grime(g, w, h, 0.1, 6); });
  T.bedspreads = [
    spread('#7a3a24', (g, w, h) => {         // rust and gold florals
      for (let i = 0; i < 18; i++) { const x = R.int(w), y = R.int(h); g.fillStyle = '#d8a040'; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 7; g.moveTo(x, y); g.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.2, 0, 7); } g.fill(); g.fillStyle = '#3a5a2a'; g.fillRect(x + 3, y + 3, 4, 1); }
    }),
    spread('#2a5a62', (g, w, h) => {         // teal geometrics
      g.strokeStyle = '#d8b060'; g.lineWidth = 2;
      for (let y = 0; y < h; y += 16) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, y + ((x / 8) % 2 ? 6 : 0)); g.stroke(); }
    }),
    spread('#5a3a22', (g, w, h) => {         // brown paisley, sort of
      for (let i = 0; i < 16; i++) { const x = R.int(w), y = R.int(h); g.fillStyle = i % 2 ? '#b8784a' : '#e0c08a'; g.beginPath(); g.ellipse(x, y, 5, 2.6, R() * 3, 0, 7); g.fill(); }
    }),
    spread('#6a2a3a', (g, w, h) => {         // burgundy quilted
      g.strokeStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < w; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
      g.fillStyle = 'rgba(230,200,140,.35)'; for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) g.fillRect(x, y, 1, 1);
    }),
  ];
  T.bedspreadNew = spread('#e0dac8', (g, w, h) => { g.fillStyle = '#3a4a6a'; g.fillRect(0, h - 14, w, 6); g.fillRect(0, 6, w, 2); });
  T.sheet = makeTex(32, 32, (g, w, h) => { fill(g, '#ece8dc', w, h); noise(g, w, h, 5); });
  T.pillow = makeTex(32, 16, (g, w, h) => { fill(g, '#f0ece2', w, h); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, h - 3, w, 3); noise(g, w, h, 4); });
  T.headboard = makeTex(64, 32, (g, w, h) => {
    fill(g, '#4a3220', w, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${60 + R.int(30)},${40 + R.int(20)},${20 + R.int(12)},.5)`; g.fillRect(0, R.int(h), w, 1); }
    g.strokeStyle = '#b8953c'; g.strokeRect(4.5, 4.5, w - 9, h - 9);
    noise(g, w, h, 8);
  });
  T.lampShade = makeTex(16, 16, (g, w, h) => { fill(g, '#f0dca8', w, h); g.fillStyle = 'rgba(160,110,50,.3)'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2); });
  T.lampBase = makeTex(16, 16, (g, w, h) => { fill(g, '#b8864a', w, h); g.fillStyle = '#e0b870'; g.fillRect(2, 0, 3, h); noise(g, w, h, 6); });
  T.acFront = makeTex(64, 32, (g, w, h) => {
    fill(g, '#d0c8b0', w, h); g.fillStyle = '#8a8472';
    for (let y = 4; y < 20; y += 3) g.fillRect(4, y, w - 24, 1);
    g.fillStyle = '#3a3a3a'; g.fillRect(w - 16, 6, 10, 4); g.fillRect(w - 16, 13, 10, 4);
    text(g, 'COOL  HEAT', w - 11, 24, 3, '#3a3a3a');
    text(g, 'AMANA', 12, 27, 4, '#6a6452');
    noise(g, w, h, 6); grime(g, w, h, 0.14, 5);
  });
  T.tvScreenRoom = makeTex(32, 32, (g, w, h) => { fill(g, '#22282c', w, h); g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(11, 10, 9, 5, -0.4, 0, 7); g.fill(); });
  T.tvRoomOn = makeTex(32, 32, (g, w, h) => { fill(g, '#5a7ab0', w, h); g.fillStyle = '#e8e0c8'; g.fillRect(4, 22, 24, 5); g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < h; y += 2) g.fillRect(0, y, w, 1); });
  T.tvRoomSnow = T.channels.STATIC[0];
  T.porcelain = makeTex(32, 32, (g, w, h) => { fill(g, '#ece8dc', w, h); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(2, 2, 4, h - 4); noise(g, w, h, 4); });
  T.tubInner = makeTex(32, 32, (g, w, h) => { fill(g, '#dcd6c8', w, h); g.fillStyle = 'rgba(120,120,110,.3)'; g.beginPath(); g.arc(8, 26, 2, 0, 7); g.fill(); noise(g, w, h, 4); });
  T.showerCurtain = makeTex(32, 64, (g, w, h) => { fill(g, '#dfe6e0', w, h); for (let x = 0; x < w; x += 5) { g.fillStyle = 'rgba(80,120,110,.25)'; g.fillRect(x, 0, 2, h); } g.fillStyle = '#9a9c98'; g.fillRect(0, 0, w, 2); });
  T.mirror = makeTex(32, 32, (g, w, h) => { fill(g, '#7a8a94', w, h); g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(0, 22); g.lineTo(18, 0); g.lineTo(26, 0); g.lineTo(6, 32); g.fill(); g.strokeStyle = '#b8b0a0'; g.strokeRect(0.5, 0.5, w - 1, h - 1); });
  T.vanityTop = makeTex(32, 32, (g, w, h) => { fill(g, '#e0d8c0', w, h); speckle(g, w, h, 200, ['#d0c8b0', '#c8a878']); g.fillStyle = '#c8c4b8'; g.beginPath(); g.ellipse(16, 16, 7, 5, 0, 0, 7); g.fill(); noise(g, w, h, 4); });
  T.towel = makeTex(16, 32, (g, w, h) => { fill(g, '#f2f0ea', w, h); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 5, w, 2); g.fillRect(0, h - 7, w, 2); noise(g, w, h, 5); });
  T.phoneRoom = makeTex(16, 16, (g, w, h) => { fill(g, '#cfc3a4', w, h); g.fillStyle = '#5a5446'; g.fillRect(3, 6, 10, 7); g.fillStyle = '#c02020'; g.fillRect(12, 2, 2, 2); noise(g, w, h, 4); });
  T.ashtray = makeTex(16, 16, (g, w, h) => { fill(g, '#3a5a8a', w, h); g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(8, 8, 4, 0, 7); g.fill(); g.fillStyle = '#e8e0c8'; g.fillRect(9, 6, 5, 1); });
  T.noSmoking = makeTex(16, 16, (g, w, h) => { fill(g, '#efe9d6', w, h); g.strokeStyle = '#c02020'; g.lineWidth = 2; g.beginPath(); g.arc(8, 8, 6, 0, 7); g.stroke(); g.beginPath(); g.moveTo(4, 4); g.lineTo(12, 12); g.stroke(); });
  T.iceBucket = makeTex(16, 16, (g, w, h) => { fill(g, '#b8864a', w, h); g.fillStyle = '#e0b870'; g.fillRect(0, 2, w, 2); noise(g, w, h, 6); });
  /* Motel art. Every room gets one, and none of them is any good. */
  const art = (draw) => makeTex(64, 32, (g, w, h) => { draw(g, w, h); g.strokeStyle = '#b8953c'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3); noise(g, w, h, 6); });
  T.art = [
    art((g, w, h) => { fill(g, '#8ab0c8', w, h); g.fillStyle = '#3a6a3a'; g.fillRect(0, 20, w, 12); g.fillStyle = '#6a4a2a'; for (let i = 0; i < 3; i++) g.fillRect(14 + i * 14, 18, 5, 3); }),       // ducks on a pond
    art((g, w, h) => { fill(g, '#e0a060', w, h); g.fillStyle = '#2a4a6a'; g.fillRect(0, 22, w, 10); g.fillStyle = '#efe9d6'; g.fillRect(42, 6, 4, 16); g.fillStyle = '#c02020'; g.fillRect(42, 10, 4, 3); }),  // lighthouse
    art((g, w, h) => { fill(g, '#d8cfb0', w, h); for (let i = 0; i < 5; i++) { g.fillStyle = ['#c02a3a', '#e0b030', '#8a3aa0'][i % 3]; g.beginPath(); g.arc(18 + i * 7, 14 + (i % 2) * 4, 4, 0, 7); g.fill(); } g.fillStyle = '#6a5a3a'; g.fillRect(24, 22, 16, 6); }), // flowers in a vase
    art((g, w, h) => { fill(g, '#6a8ab0', w, h); g.fillStyle = '#efe9d6'; g.beginPath(); g.moveTo(20, 24); g.lineTo(32, 6); g.lineTo(32, 24); g.fill(); g.fillStyle = '#5a3a22'; g.fillRect(16, 24, 26, 4); g.fillStyle = '#2a4a6a'; g.fillRect(0, 26, w, 6); }), // a sailboat
  ];

  /* ============================================================
     OTHER PLACES
     ============================================================ */
  T.iceMachine = makeTex(32, 64, (g, w, h) => {
    fill(g, '#b8bcc0', w, h); g.fillStyle = '#123a58'; g.fillRect(2, 4, w - 4, 12);
    text(g, 'ICE', w / 2, 10, 8, '#d8f0ff');
    g.fillStyle = '#6a6e72'; g.fillRect(6, 36, w - 12, 18);
    g.fillStyle = '#2a2e32'; g.fillRect(10, 40, w - 20, 10);
    noise(g, w, h, 6); grime(g, w, h, 0.18, 6);
  });
  T.sodaMachine = makeTex(32, 64, (g, w, h) => {
    fill(g, '#b8201a', w, h);
    g.fillStyle = '#fff'; g.fillRect(3, 4, 18, 36);
    text(g, 'Cola', 12, 22, 9, '#b8201a', { face: 'Georgia,serif', weight: 'italic bold' });
    for (let i = 0; i < 6; i++) { g.fillStyle = ['#b8201a', '#2a6ab8', '#e0b030', '#3a8a3a', '#e07a2a', '#6a3a9a'][i]; g.fillRect(23, 5 + i * 6, 6, 4); }
    g.fillStyle = '#1a1a1a'; g.fillRect(6, 46, 16, 8);
    text(g, '.60', 26, 44, 5, '#fff');
    noise(g, w, h, 6); grime(g, w, h, 0.14, 5);
  });
  T.snackMachine = makeTex(32, 64, (g, w, h) => {
    fill(g, '#2a2a30', w, h);
    g.fillStyle = 'rgba(160,190,210,.35)'; g.fillRect(2, 3, 21, 44);
    const c = ['#e0b030', '#c02a2a', '#2a6ab8', '#3a8a3a', '#e07a2a'];
    for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) { g.fillStyle = c[(r + k) % 5]; g.fillRect(3 + k * 5, 5 + r * 9, 4, 6); }
    g.fillStyle = '#9a9a9a'; for (let i = 0; i < 12; i++) g.fillRect(25 + (i % 2) * 3, 8 + Math.floor(i / 2) * 4, 2, 2);
    g.fillStyle = '#1a1a1a'; g.fillRect(4, 52, 18, 7);
    noise(g, w, h, 6);
  });
  T.machineSide = makeTex(16, 64, (g, w, h) => { fill(g, '#5a5c5e', w, h); noise(g, w, h, 8); });
  T.washer = makeTex(32, 32, (g, w, h) => { fill(g, '#e8e4d8', w, h); g.fillStyle = '#8a8c8e'; g.fillRect(0, 0, w, 6); g.fillStyle = '#c02020'; g.fillRect(3, 2, 3, 2); g.fillStyle = '#6a6e72'; g.fillRect(20, 1, 9, 4); text(g, '75¢', 16, 18, 7, '#1a1a1a'); noise(g, w, h, 5); });
  T.dryer = makeTex(32, 32, (g, w, h) => { fill(g, '#e8e4d8', w, h); g.fillStyle = '#8a8c8e'; g.beginPath(); g.arc(16, 18, 10, 0, 7); g.fill(); g.fillStyle = '#3a3e42'; g.beginPath(); g.arc(16, 18, 8, 0, 7); g.fill(); g.fillStyle = '#6a6e72'; g.fillRect(4, 2, 24, 4); noise(g, w, h, 5); });
  T.dumpster = makeTex(64, 32, (g, w, h) => { fill(g, '#2a4a3a', w, h); g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 2, h); text(g, 'NO DUMPING', w / 2, 10, 6, '#e8e0c8'); noise(g, w, h, 12); grime(g, w, h, 0.3, 10); });
  T.tools = makeTex(64, 64, (g, w, h) => {      // pegboard with tools hanging off it
    fill(g, '#8a7a5a', w, h);
    g.fillStyle = '#4a3e2a'; for (let y = 4; y < h; y += 8) for (let x = 4; x < w; x += 8) g.fillRect(x, y, 2, 2);
    g.fillStyle = '#c02020'; g.fillRect(8, 10, 4, 20); g.fillRect(4, 8, 12, 4);          // hammer
    g.fillStyle = '#6a6e72'; g.fillRect(24, 8, 3, 26); g.fillStyle = '#e0b030'; g.fillRect(22, 30, 7, 8); // screwdriver
    g.fillStyle = '#6a6e72'; g.fillRect(40, 10, 14, 4); g.fillRect(44, 14, 4, 14);        // wrench
    g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(18, 48, 8, 0, 7); g.fill(); g.fillStyle = '#8a7a5a'; g.beginPath(); g.arc(18, 48, 4, 0, 7); g.fill(); // tape
    g.fillStyle = '#c86a2a'; g.fillRect(40, 38, 16, 18);                                   // a box of bulbs
    text(g, 'BULBS', 48, 47, 4, '#1a1a1a');
    noise(g, w, h, 8);
  });
  T.plunger = makeTex(16, 16, (g, w, h) => { fill(g, '#8a2a1a', w, h); noise(g, w, h, 6); });
  T.mop = makeTex(16, 32, (g, w, h) => { fill(g, '#d8d0bc', w, h); for (let x = 0; x < w; x += 2) { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x, 0, 1, h); } });
  T.bucket = makeTex(32, 16, (g, w, h) => { fill(g, '#e0b030', w, h); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, w, 2); noise(g, w, h, 8); });
  T.spill = makeTex(32, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(230,140,30,.85)'; g.beginPath(); g.ellipse(16, 16, 12, 8, 0.4, 0, 7); g.fill();
    g.beginPath(); g.ellipse(24, 22, 5, 3, 0.2, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,220,160,.5)'; g.beginPath(); g.ellipse(13, 13, 4, 2, 0.4, 0, 7); g.fill();
  });
  T.spillCoffee = makeTex(32, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,30,12,.85)'; g.beginPath(); g.ellipse(16, 16, 12, 7, 0.3, 0, 7); g.fill();
    g.beginPath(); g.ellipse(6, 22, 4, 3, 0.2, 0, 7); g.fill();
  });
  T.spillBatter = makeTex(32, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(232,210,150,.95)'; g.beginPath(); g.ellipse(16, 16, 11, 9, 0.3, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,240,200,.6)'; g.beginPath(); g.ellipse(13, 13, 4, 3, 0.3, 0, 7); g.fill();
  });
  T.cards = makeTex(16, 16, (g, w, h) => { fill(g, '#f6f2e6', w, h); g.strokeStyle = '#1a1a1a'; g.strokeRect(0.5, 0.5, w - 1, h - 1); text(g, 'A♠', w / 2, h / 2, 7, '#1a1a1a'); });

  /* ---- vehicles, one body texture per paint ---- */
  T.car = {};
  const CAR_COLORS = {
    maroon: '#5a1a1e', white: '#d8d4c8', blue: '#2a4a7a', green: '#2a4a32', tan: '#a8926a', gray: '#6a6c70',
    black: '#1c1c20', red: '#8a1e1a', teal: '#2a6a6a', gold: '#8a7236', brown: '#4a3222', silver: '#9a9ca0',
  };
  for (const [name, hex] of Object.entries(CAR_COLORS)) {
    T.car[name] = {
      body: makeTex(64, 32, (g, w, h) => {
        fill(g, hex, w, h);
        g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 2, w, 2);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(24, 4, 1, h - 10); g.fillRect(40, 4, 1, h - 10);  // door seams
        g.fillStyle = '#b8bcc0'; g.fillRect(0, h - 11, w, 2);                                         // chrome strip
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, h - 5, w, 5);
        noise(g, w, h, 8); grime(g, w, h, 0.12, 6);
      }),
      top: makeTex(32, 32, (g, w, h) => { fill(g, shade(hex, 1.08), w, h); noise(g, w, h, 6); }),
      front: makeTex(32, 16, (g, w, h) => {
        fill(g, hex, w, h); g.fillStyle = '#9a9c9e'; g.fillRect(8, 5, 16, 6);
        g.fillStyle = '#3a3c3e'; for (let x = 9; x < 24; x += 2) g.fillRect(x, 6, 1, 4);
        g.fillStyle = '#e8e4d0'; g.fillRect(1, 5, 6, 5); g.fillRect(25, 5, 6, 5);
        g.fillStyle = '#b8bcc0'; g.fillRect(0, 12, w, 3);
      }),
      back: makeTex(32, 16, (g, w, h) => {
        fill(g, hex, w, h); g.fillStyle = '#9a1a14'; g.fillRect(1, 4, 7, 5); g.fillRect(24, 4, 7, 5);
        g.fillStyle = '#e8e2c8'; g.fillRect(11, 6, 10, 5); g.fillStyle = '#1a3a78'; g.fillRect(12, 7, 8, 1);
        g.fillStyle = '#b8bcc0'; g.fillRect(0, 12, w, 3);
      }),
    };
  }
  T.carGlass = makeTex(32, 16, (g, w, h) => { fill(g, '#1e2a34', w, h); g.fillStyle = 'rgba(170,190,210,.25)'; g.beginPath(); g.moveTo(4, h); g.lineTo(12, 0); g.lineTo(16, 0); g.lineTo(8, h); g.fill(); });
  T.tire = makeTex(16, 16, (g, w, h) => { fill(g, '#141414', w, h); g.fillStyle = '#8a8c8e'; g.beginPath(); g.arc(8, 8, 4, 0, 7); g.fill(); });
  T.headlight = makeTex(8, 8, (g, w, h) => fill(g, '#fff6d8', w, h));
  T.taillight = makeTex(8, 8, (g, w, h) => fill(g, '#ff3020', w, h));
  T.vanSide = {};
  T.vanSide.magic = makeTex(64, 32, (g, w, h) => {
    fill(g, '#e8e0c8', w, h); g.fillStyle = '#6a2a8a'; g.fillRect(0, 6, w, 14);
    text(g, 'THE AMAZING', w / 2, 10, 5, '#ffe28a'); text(g, 'DELMAR', w / 2, 16.5, 7, '#ffe28a');
    g.fillStyle = '#ffe28a'; g.fillRect(4, 8, 2, 2); g.fillRect(56, 14, 2, 2);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, h - 5, w, 5); noise(g, w, h, 8);
  });
  T.vanSide.storm = makeTex(64, 32, (g, w, h) => {
    fill(g, '#d8d4c8', w, h); g.fillStyle = '#2a4a7a'; g.fillRect(0, 8, w, 10);
    text(g, 'SEVERE WX INTERCEPT', w / 2, 13, 4, '#ffe28a');
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, h - 5, w, 5); noise(g, w, h, 8);
  });
  T.vanSide.bus = makeTex(64, 32, (g, w, h) => {
    fill(g, '#e8e2d0', w, h); g.fillStyle = '#1e2a34'; g.fillRect(0, 4, w, 10);
    g.fillStyle = '#c02a2a'; g.fillRect(0, 17, w, 3); text(g, 'BAYOU STAR TOURS', w / 2, 23.5, 5, '#1a3a78');
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, h - 4, w, 4); noise(g, w, h, 6);
  });
  T.vanSide.newspaper = makeTex(64, 32, (g, w, h) => { fill(g, '#d8d4c8', w, h); text(g, 'LEDGER', w / 2, 12, 8, '#1a1a1a'); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, h - 5, w, 5); noise(g, w, h, 8); });

  return T;
}
