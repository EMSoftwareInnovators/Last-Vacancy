/* ============================================================
   texture.js -- every pixel in this game is generated at runtime.
   Textures are power-of-two Uint32Array (0xAABBGGRR) so the
   rasterizer can index them with (v << shift) + u.

   Carried over from Final Rental. The store's own texture set has
   moved out to the game (src/game/world/textures.js); what stays
   here is the machinery and the little drawing helpers every set
   is painted with.
   ============================================================ */
import { makeRng } from './mathx.js';

export function makeTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  return texFromCanvas(c);
}

export function texFromCanvas(c) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const d = g.getImageData(0, 0, c.width, c.height);
  return {
    px: new Uint32Array(d.data.buffer.slice(0)),
    w: c.width, h: c.height,
    wMask: c.width - 1, hMask: c.height - 1,
    shift: Math.round(Math.log2(c.width)),
    canvas: c,
  };
}

/**
 * Redraw a live texture in place.
 *
 * The rasterizer holds on to the texture object, not its pixels, so the
 * room board, the terminal glass and the breakfast television can be
 * repainted without anything that draws them having to know.
 */
export function repaintTex(tex, draw) {
  const c = tex.canvas;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  draw(g, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height);
  tex.px.set(new Uint32Array(d.data.buffer));
  return tex;
}

/* ---------------- little drawing helpers ---------------- */
export const R = makeRng(0xBEEF17);

export function fill(g, c, w, h) { g.fillStyle = c; g.fillRect(0, 0, w, h); }

export function noise(g, w, h, amt, alpha = 1, mono = true) {
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (mono) {
      const n = (R() - 0.5) * amt;
      p[i] += n; p[i + 1] += n; p[i + 2] += n;
    } else {
      p[i] += (R() - 0.5) * amt; p[i + 1] += (R() - 0.5) * amt; p[i + 2] += (R() - 0.5) * amt;
    }
    if (alpha < 1) p[i + 3] *= alpha;
  }
  g.putImageData(d, 0, 0);
}

export function speckle(g, w, h, n, colors, size = 1) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[R.int(colors.length)];
    g.fillRect(R.int(w), R.int(h), size, size);
  }
}

export function grime(g, w, h, strength = 0.22, n = 26) {
  for (let i = 0; i < n; i++) {
    const x = R.int(w), y = R.int(h), r = 3 + R.int(14);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${strength})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Centered text, the way every sign in both games is lettered. */
export function text(g, s, x, y, px, color, opts = {}) {
  g.save();
  g.font = `${opts.weight || 'bold'} ${px}px ${opts.face || '"Courier New",monospace'}`;
  g.textAlign = opts.align || 'center';
  g.textBaseline = opts.base || 'middle';
  if (opts.glow) { g.shadowColor = opts.glow; g.shadowBlur = opts.blur || 6; }
  g.fillStyle = color;
  g.fillText(s, x, y);
  g.restore();
}
