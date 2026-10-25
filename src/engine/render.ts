// Drawing one finished frame onto a canvas.

import { mixColor, withAlpha } from './color';
import { type Mat, type Pt, apply, contourLength, mul, openPoints, partial } from './geom';
import { type CompiledScene, END_SCREEN_ZONES, type Layer, type Movie } from './movie';
import type { View } from './camera';
import { captionText } from './narration';
import { matchGlyphs, morphAt, planMorph } from './match';
import { fontString } from './text';
import type { Glyph, GlyphState, Thing } from './thing';
import { clamp, hashString } from './util';
import { type Look, drawMarker, fillShape, strokeLines, textPaint } from './styles';

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Pictures opened with the script, decoded, by file name. */
export const pictures = new Map<string, CanvasImageSource & { width: number; height: number }>();

const GRADES: Record<string, string> = {
  warm: 'sepia(0.22) saturate(1.15) brightness(1.02)', cold: 'hue-rotate(-12deg) saturate(0.85) brightness(1.02)',
  faded: 'saturate(0.7) contrast(0.86) brightness(1.06)', mono: 'grayscale(1) contrast(1.05)', vivid: 'saturate(1.4) contrast(1.08)', none: 'none',
};

let grainPat: CanvasPattern | null | undefined;
function grainPattern(ctx: Ctx2D): CanvasPattern | null {
  if (grainPat !== undefined) return grainPat;
  const c = makeCanvas(96, 96);
  const g = c.getContext('2d') as Ctx2D;
  const img = g.createImageData(96, 96);
  let seed = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = seed % 2 ? 255 : 0;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = (seed >> 3) % 22;
  }
  g.putImageData(img, 0, 0);
  grainPat = ctx.createPattern(c as CanvasImageSource, 'repeat');
  return grainPat;
}

const TONES: Record<string, string> = { none: 'none', mono: 'grayscale(1) contrast(1.05)', faded: 'saturate(0.55) brightness(1.08) contrast(0.9)', warm: 'sepia(0.35) saturate(1.2)', cold: 'saturate(0.8) hue-rotate(12deg) brightness(0.98)' };

/** From the sheet to pixels: flat (a plain matrix), or seen at an angle when the camera tilts. */
interface Proj { affine?: Mat; at(q: Pt, z: number): Pt; scaleAt(q: Pt): number }

function flatProj(m: Mat): Proj {
  const k = Math.hypot(m[0], m[1]);
  return { affine: m, at: (q) => apply(m, q), scaleAt: () => k };
}

/** The sheet seen by a camera `elevation` degrees above it (90 is flat on), turned by `angle`. */
function tiltProj(view: View, W: number, H: number, frameH: number): Proj {
  const k = (H / frameH) * view.zoom;
  const phi = ((view.elevation ?? 90) * Math.PI) / 180, th = ((view.angle ?? 0) * Math.PI) / 180;
  const dist = (frameH * 1.9) / view.zoom;
  const F = k * dist;
  const cphi = Math.cos(phi), sphi = Math.sin(phi), ct = Math.cos(th), st = Math.sin(th);
  const at = (q: Pt, z: number): Pt => {
    const dx = q[0] - view.cx, dy = q[1] - view.cy;
    const x = dx * ct - dy * st, y = dx * st + dy * ct;
    // Eye at (0, -dist cos φ, dist sin φ), looking at the middle.
    const vy = y + dist * cphi, vz = z - dist * sphi;
    const depth = Math.max(0.05 * dist, vy * cphi - vz * sphi);
    const up = vy * sphi + vz * cphi;
    return [W / 2 + (x * F) / depth, H / 2 - (up * F) / depth];
  };
  return {
    at,
    scaleAt: (q) => { const a = at(q, 0), b = at([q[0] + 0.01, q[1]], 0); return Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.01; },
  };
}

/** The flat matrix that best matches a projection near one thing (for words and pictures). */
function localMatrix(P: Proj, thM: Mat, lift: number): Mat {
  if (P.affine) return mul(P.affine, thM);
  const o = P.at(apply(thM, [0, 0]), lift), ex = P.at(apply(thM, [0.01, 0]), lift), ey = P.at(apply(thM, [0, 0.01]), lift);
  return [(ex[0] - o[0]) / 0.01, (ex[1] - o[1]) / 0.01, (ey[0] - o[0]) / 0.01, (ey[1] - o[1]) / 0.01, o[0], o[1]];
}

export class Renderer {
  private ctx: Ctx2D;
  private spare?: { canvas: AnyCanvas; ctx: Ctx2D };
  /** Captions drawn or not (the page's switch can change it). */
  captions = true;
  /** Guides that only the preview shows (where the end-screen buttons go). */
  guides = false;
  private hold?: { at: number; u: number };
  private lookOf: Look = 'vector';
  /** Things left out of the next scene drawn (they are morphing). */
  private skip?: Set<string>;

  constructor(public canvas: AnyCanvas, public movie: Movie) {
    canvas.width = movie.width;
    canvas.height = movie.height;
    this.ctx = canvas.getContext('2d') as Ctx2D;
    this.captions = movie.captions.on;
  }

  private buffer(): { canvas: AnyCanvas; ctx: Ctx2D } {
    if (!this.spare) {
      const canvas = makeCanvas(this.movie.width, this.movie.height);
      this.spare = { canvas, ctx: canvas.getContext('2d') as Ctx2D };
    }
    return this.spare;
  }

  /** Draw the frame at video time T. */
  render(T: number) {
    const { ctx, movie } = this;
    const W = movie.width, H = movie.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    // The script's clock stands still during a wait.
    const { t, hold } = movie.toScript(T);
    this.hold = hold;
    const layers = movie.frame(t);
    if (layers.some((l) => l.xf || l.page !== undefined)) {
      // Behind pictures that move or turn: the sheet's own colour, a little darker.
      const bg = layers[0].scene.world.theme.background;
      ctx.fillStyle = mixColor(typeof bg === 'string' ? bg : bg[1] ?? bg[0], '#000000', 0.35);
      ctx.fillRect(0, 0, W, H);
    }
    layers.forEach((layer, i) => {
      if (i === 0 && layer.alpha >= 1 && !layer.slide && layer.wipe === undefined) {
        this.drawLayer(ctx, layer, t);
        return;
      }
      if (i === 0) {
        this.drawLayer(ctx, layer, t);
        return;
      }
      const b = this.buffer();
      b.ctx.setTransform(1, 0, 0, 1, 0, 0);
      b.ctx.clearRect(0, 0, W, H);
      this.drawLayer(b.ctx, layer, t);
      if (layer.rub !== undefined) this.rubOut(b.ctx, layer.rub);
      ctx.save();
      ctx.globalAlpha = layer.alpha;
      if (layer.wipe !== undefined) {
        ctx.beginPath();
        ctx.rect(0, 0, W * layer.wipe, H);
        ctx.clip();
      }
      ctx.drawImage(b.canvas as CanvasImageSource, 0, 0);
      ctx.restore();
    });
    const scene = layers[layers.length - 1].scene;
    const mo = layers[layers.length - 1].morph;
    if (mo) this.drawMorph(ctx, mo.from, scene, t, mo.u);
    this.finishFrame(scene, T);
    if (this.captions && scene.world.captions) this.drawCaptions(ctx, t, scene);
    if (this.guides && movie.endScreen && T >= movie.duration - movie.endScreen) {
      // Where YouTube's end-screen buttons will go (shown in the preview only).
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      for (const z of END_SCREEN_ZONES) ctx.strokeRect(z.x0 * W, z.y0 * H, (z.x1 - z.x0) * W, (z.y1 - z.y0) * H);
      ctx.restore();
    }
  }

  private post?: { canvas: AnyCanvas; ctx: Ctx2D };

  /** The whole picture's look: colour grade, glow, film grain. */
  private finishFrame(scene: CompiledScene, T: number) {
    const { ctx, movie } = this;
    const W = movie.width, H = movie.height;
    const f = scene.world.finish;
    const grain = scene.world.theme.grain ?? 0;
    if (f.grade === 'none' && f.glow <= 0 && grain <= 0) return;
    if (!this.post) { const c = makeCanvas(W, H); this.post = { canvas: c, ctx: c.getContext('2d') as Ctx2D }; }
    const p = this.post;
    const unit = Math.min(W, H) / 1080;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (f.grade !== 'none' && 'filter' in ctx) {
      p.ctx.setTransform(1, 0, 0, 1, 0, 0);
      p.ctx.clearRect(0, 0, W, H);
      p.ctx.drawImage(this.canvas as CanvasImageSource, 0, 0);
      ctx.filter = GRADES[f.grade];
      ctx.drawImage(p.canvas as CanvasImageSource, 0, 0);
      ctx.filter = 'none';
    }
    if (f.glow > 0 && 'filter' in p.ctx) {
      // Bloom: a blurred copy of the bright picture added on top.
      p.ctx.setTransform(1, 0, 0, 1, 0, 0);
      p.ctx.clearRect(0, 0, W, H);
      p.ctx.filter = `blur(${(14 * unit).toFixed(1)}px) contrast(2.2) brightness(0.95)`;
      p.ctx.drawImage(this.canvas as CanvasImageSource, 0, 0);
      p.ctx.filter = 'none';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * f.glow;
      ctx.drawImage(p.canvas as CanvasImageSource, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (grain > 0) {
      // Grain that moves each frame, the same in every render.
      const pat = grainPattern(ctx);
      if (pat) {
        const k = Math.floor(T * movie.fps);
        ctx.translate((k * 37) % 96, (k * 53) % 96);
        ctx.globalAlpha = Math.min(1, grain * 2.5);
        ctx.fillStyle = pat;
        ctx.fillRect(-96, -96, W + 192, H + 192);
      }
    }
    ctx.restore();
  }

  /** The old scene wiped off a board in strokes, left to right, row by row. */
  private rubOut(ctx: Ctx2D, u: number) {
    const W = this.movie.width, H = this.movie.height;
    const rows = 5;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = (H / rows) * 1.35;
    const total = u * rows;
    ctx.beginPath();
    for (let r = 0; r < rows && r < total; r++) {
      const k = Math.min(1, total - r);
      const y = (H * (r + 0.5)) / rows;
      const leftToRight = r % 2 === 0;
      const x0 = leftToRight ? -W * 0.1 : W * 1.1, x1 = leftToRight ? W * 1.1 : -W * 0.1;
      ctx.moveTo(x0, y);
      // A gentle wave, as an arm sweeps.
      const n = 24;
      for (let i = 1; i <= Math.round(n * k); i++) ctx.lineTo(x0 + ((x1 - x0) * i) / n, y + Math.sin(i * 0.9 + r) * H * 0.025);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Things with the same id in both scenes glide and change shape. */
  private drawMorph(ctx: Ctx2D, a: CompiledScene, b: CompiledScene, t: number, u: number) {
    const m = b.morph;
    if (!m) return;
    const W = this.movie.width, H = this.movie.height, fh = this.movie.frameH;
    const projOf = (v: View) => {
      const k = (H / fh) * v.zoom;
      const tilted = Math.abs((v.elevation ?? 90) - 90) > 0.05 || Math.abs(v.angle ?? 0) > 0.05;
      return tilted ? tiltProj(v, W, H, fh) : flatProj([k, 0, 0, -k, W / 2 - v.cx * k, H / 2 + v.cy * k]);
    };
    const rest = flatProj([H / fh, 0, 0, -H / fh, W / 2, H / 2]);
    // The old scene's things as they are now (it was just drawn at t).
    a.applyState(t, this.hold);
    const Pa = projOf(a.camera.viewAt(t));
    const unit = Math.min(W, H) / 1080;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const [id, sn] of m.snap) {
      const ta = a.world.things.get(id)!, tb = b.world.things.get(id)!;
      if (!ta.shown()) continue;
      const toPx = (th: Thing, st: Thing['state'], P: Proj) => {
        const saved = th.state;
        th.state = st;
        const M = th.matrix();
        th.state = saved;
        return st.glyphs.map((g) => ({ ...g, contours: g.contours.map((c) => ({ closed: c.closed, pts: c.pts.map((p) => P.at(apply(M, p), 0)) })) }));
      };
      const ga = toPx(ta, ta.state, ta.screen ? rest : Pa), gb = toPx(tb, sn.state, tb.screen ? rest : projOf(sn.view));
      // Equations pair symbol with symbol (as in a step); other things part by part.
      const pairs = ta.kind === 'math' && tb.kind === 'math' ? matchGlyphs(ta.state.glyphs, sn.state.glyphs) : Array.from({ length: Math.max(ga.length, gb.length) }, (_, i) => ({ from: i < ga.length ? i : undefined, to: i < gb.length ? i : undefined }));
      const ca = centerOfGlyphs(ga), cb = centerOfGlyphs(gb);
      const theme = b.world.theme;
      const colA = resolve(ta.state.color ?? ta.base.color, a.world.theme.ink), colB = resolve(sn.state.color ?? tb.base.color, theme.ink);
      ctx.globalAlpha = clamp(ta.opacity() * (1 - u) + sn.state.opacity * u);
      for (const pr of pairs) {
        const g1 = pr.from !== undefined ? ga[pr.from] : dotGlyph(cb), g2 = pr.to !== undefined ? gb[pr.to] : dotGlyph(ca);
        const g = morphAt(g1, g2, planMorph(g1, g2), u);
        const col = mixColor(resolve(g1.color, colA), resolve(g2.color, colB), u);
        if (g.fill) { ctx.fillStyle = col; ctx.beginPath(); for (const c of g.contours) tracePts(ctx, c.pts, true); ctx.fill('nonzero'); }
        if (g.stroke) { ctx.strokeStyle = col; ctx.lineWidth = (g.width ?? 4) * unit; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); for (const c of g.contours) tracePts(ctx, c.pts, c.closed); ctx.stroke(); }
      }
    }
    ctx.restore();
  }

  private drawLayer(ctx: Ctx2D, layer: Layer, t: number) {
    const W = this.movie.width, H = this.movie.height;
    ctx.save();
    if (layer.slide) ctx.translate(layer.slide[0] * W, -layer.slide[1] * H);
    if (layer.xf) ctx.transform(layer.xf.z, 0, 0, layer.xf.z, layer.xf.tx, layer.xf.ty);
    if (layer.page !== undefined) {
      // Turning away about the left edge: narrower, lifting at the far edge, darkening.
      const e = layer.page;
      ctx.transform(Math.max(0.001, Math.cos((e * Math.PI) / 2)), -0.18 * Math.sin(e * Math.PI), 0, 1, 0, 0);
    }
    this.skip = layer.skip;
    this.drawScene(ctx, layer.scene, t);
    this.skip = undefined;
    if (layer.page !== undefined) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      const w = W * Math.max(0.001, Math.cos((layer.page * Math.PI) / 2));
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, `rgba(0,0,0,${0.1 * layer.page})`);
      g.addColorStop(1, `rgba(0,0,0,${0.55 * layer.page})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, H);
    }
    if (layer.black) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = clamp(layer.black);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  /** The scene's picture at time t. */
  drawScene(ctx: Ctx2D, scene: CompiledScene, t: number) {
    const W = this.movie.width, H = this.movie.height;
    const theme = scene.world.theme;
    scene.applyState(t, this.hold);
    const view = { ...scene.camera.viewAt(t) };
    const cs = scene.world.finish.cameraStyle;
    if (cs === 'drift') { view.cx += 0.12 * Math.sin(t * 0.21); view.cy += 0.07 * Math.sin(t * 0.17 + 1); }
    else if (cs === 'breathe') view.zoom *= 1 + 0.018 * Math.sin(t * 0.45);
    const k = (H / this.movie.frameH) * view.zoom;
    const base = ctx.getTransform();
    const camera: Mat = [k, 0, 0, -k, W / 2 - view.cx * k, H / 2 + view.cy * k];
    const rest: Mat = [H / this.movie.frameH, 0, 0, -H / this.movie.frameH, W / 2, H / 2];
    const tilted = Math.abs((view.elevation ?? 90) - 90) > 0.05 || Math.abs(view.angle ?? 0) > 0.05;
    const camProj = tilted ? tiltProj(view, W, H, this.movie.frameH) : flatProj(camera);
    const unit = Math.min(W, H) / 1080;

    // Background.
    ctx.globalAlpha = 1;
    const bg = scene.background.colors ?? (Array.isArray(theme.background) ? theme.background : [theme.background]);
    if (bg.length > 1 || scene.background.style === 'gradient') {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
      g.addColorStop(0, bg[0]);
      g.addColorStop(1, bg[1] ?? bg[0]);
      ctx.fillStyle = g;
    } else ctx.fillStyle = bg[0];
    ctx.fillRect(0, 0, W, H);
    const bgImage = scene.background.image;
    if (bgImage) {
      const pic = pictures.get(bgImage.file);
      if (pic) {
        // Covering the frame, keeping its shape.
        const z = Math.max(W / pic.width, H / pic.height) * (1 + bgImage.blur * 0.06);
        ctx.save();
        if ('filter' in ctx && bgImage.blur > 0) ctx.filter = `blur(${(bgImage.blur * 24 * unit).toFixed(1)}px)`;
        ctx.drawImage(pic, (W - pic.width * z) / 2, (H - pic.height * z) / 2, pic.width * z, pic.height * z);
        ctx.restore();
        ctx.fillStyle = `rgba(0,0,0,${bgImage.dim})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    this.drawPaper(ctx, scene, camera, k, unit, camProj, view);

    const drawList = (list: Thing[], P: Proj) => {
      const sorted = list.map((th, i) => ({ th, i })).sort((a, b) => a.th.layer - b.th.layer || (a.th.lift ?? 0) - (b.th.lift ?? 0) || a.i - b.i);
      for (const { th } of sorted) if (!this.skip?.has(th.id)) this.drawThing(ctx, th, P, k, unit, scene);
    };
    drawList(scene.world.order.filter((th) => !th.screen && th.kind !== 'group'), camProj);
    drawList(scene.world.order.filter((th) => th.screen && th.kind !== 'group'), flatProj(rest));

    if (theme.vignette > 0) {
      ctx.setTransform(base);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${theme.vignette})`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.setTransform(base);
    ctx.globalAlpha = 1;
  }

  private drawPaper(ctx: Ctx2D, scene: CompiledScene, camera: Mat, k: number, unit: number, P: Proj, view: View) {
    const style = scene.background.style;
    if (style === 'plain' || style === 'gradient' || style === 'image') return;
    const W = this.movie.width, H = this.movie.height;
    const step = scene.background.spacing;
    if (!P.affine) {
      // A tilted sheet: its lines seen in perspective, out to the distance.
      const r = (this.movie.frameW * 1.6) / view.zoom;
      const x0 = Math.floor((view.cx - r) / step) * step, y0 = Math.floor((view.cy - r) / step) * step;
      ctx.save();
      ctx.strokeStyle = scene.world.theme.grid;
      ctx.fillStyle = scene.world.theme.grid;
      ctx.lineWidth = Math.max(1, 1.3 * unit);
      ctx.beginPath();
      for (let x = x0; x <= view.cx + r; x += step) for (let y = y0; y <= view.cy + r; y += step) {
        if (style === 'dots') { const p = P.at([x, y], 0); ctx.moveTo(p[0] + 2 * unit, p[1]); ctx.arc(p[0], p[1], 2 * unit, 0, Math.PI * 2); continue; }
        const a = P.at([x, y], 0), bx = P.at([x + step, y], 0), by = P.at([x, y + step], 0);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(bx[0], bx[1]);
        if (style === 'grid') { ctx.moveTo(a[0], a[1]); ctx.lineTo(by[0], by[1]); }
      }
      if (style === 'dots') ctx.fill(); else ctx.stroke();
      ctx.restore();
      return;
    }
    const inv = (px: number, py: number): Pt => [(px - camera[4]) / camera[0], (py - camera[5]) / camera[3]];
    const [x0, y1] = inv(0, 0), [x1, y0] = inv(W, H);
    ctx.save();
    const base = ctx.getTransform();
    ctx.setTransform(base);
    ctx.strokeStyle = scene.world.theme.grid;
    ctx.fillStyle = scene.world.theme.grid;
    ctx.lineWidth = Math.max(1, 1.5 * unit);
    const toPx = (x: number, y: number) => apply(camera, [x, y]);
    if (style === 'dots') {
      for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
        const p = toPx(x, y);
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2.2 * unit, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      if (style === 'grid') for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) { const p = toPx(x, 0); ctx.moveTo(p[0], 0); ctx.lineTo(p[0], H); }
      for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) { const p = toPx(0, y); ctx.moveTo(0, p[1]); ctx.lineTo(W, p[1]); }
      ctx.stroke();
    }
    void k;
    ctx.restore();
  }

  private drawThing(ctx: Ctx2D, th: Thing, P: Proj, k: number, unit: number, scene: CompiledScene) {
    if (!th.shown()) return;
    const s = th.state;
    const alpha = th.opacity() * (1 - s.dim) * (th.parent ? 1 - th.parent.state.dim : 1);
    if (alpha <= 0.002) return;
    const thM = th.matrix();
    const lift = th.lift ?? (th.parent?.lift ?? 0);
    const z = lift * 0.3;
    const m = localMatrix(P, thM, z);
    const pxPerUnit = Math.hypot(m[0], m[1]);
    const px = (local: Mat | null, p: Pt): Pt => (P.affine ? apply(local ? mul(m, local) : m, p) : P.at(apply(local ? mul(thM, local) : thM, p), z));
    const theme = scene.world.theme;
    const own = s.color ?? th.base.color;
    const base = ctx.getTransform();
    ctx.save();
    ctx.globalAlpha = clamp(alpha);
    if (s.glow > 0) {
      ctx.shadowBlur = 24 * unit * s.glow;
      ctx.shadowColor = s.glowColor ?? resolve(own, theme.ink);
    }

    if (th.raster) {
      this.drawRaster(ctx, th, m, scene);
      ctx.restore();
      return;
    }

    if (th.image) {
      this.drawImage(ctx, th, m, pxPerUnit, scene);
      ctx.restore();
      return;
    }

    this.lookOf = scene.world.look;
    if (th.text) {
      this.drawText(ctx, th, m, pxPerUnit, resolve(own, theme.ink), base);
      ctx.restore();
      return;
    }

    const look: Look = th.look ?? scene.world.look;
    const seed = hashString(th.id) % 1000;
    let tip: Pt | undefined;
    const glyphs = s.glyphs;
    const states = s.glyphStates;
    const n = glyphs.length;
    const kHere = P.affine ? k : P.scaleAt(apply(thM, [0, 0]));
    const zoomWidth = Math.sqrt(Math.max(0.2, kHere / (this.movie.height / this.movie.frameH))) * Math.sqrt(thM[0] ** 2 + thM[1] ** 2 || 1);
    for (let i = 0; i < n; i++) {
      const g = glyphs[i];
      const gs: GlyphState | undefined = states?.[i];
      const ga = gs ? gs.opacity : 1;
      if (ga <= 0.002) continue;
      let local: Mat | null = null;
      if (gs && (gs.dx || gs.dy || gs.scale !== 1)) {
        const c = glyphCenter(g);
        const sc = gs.scale;
        local = [sc, 0, 0, sc, c[0] - c[0] * sc + gs.dx, c[1] - c[1] * sc + gs.dy];
      }
      const toPx = (p: Pt) => px(local, p);
      let col = resolve(g.color ?? own, theme.ink);
      if (own?.startsWith('mix:') && g.color) col = resolve(own, g.color);
      if (gs?.color) col = resolve(gs.color, col);
      ctx.globalAlpha = clamp(alpha * ga);

      // How far drawn this glyph is.
      let strokeFrac = 1, fillAlpha = 1, reveal = 1;
      if (s.drawn < 1) {
        if (s.drawStyle === 'write') {
          const lag = n > 1 ? 0.6 / (n - 1) : 0;
          const gp = clamp((s.drawn - lag * i) / Math.max(0.0001, 1 - lag * (n - 1)));
          strokeFrac = clamp(gp * 1.6);
          fillAlpha = clamp(gp * 2.2 - 1.2);
        } else if (s.drawStyle === 'draw') {
          strokeFrac = clamp(s.drawn * 1.15);
          fillAlpha = clamp(s.drawn * 2 - 1);
        } else reveal = s.drawn;
      }
      if (reveal <= 0) continue;
      if (reveal < 1) {
        const box = thingBox(glyphs);
        const p0 = px(null, [box.x0, box.y0]), p1 = px(null, [box.x0 + (box.x1 - box.x0) * reveal, box.y1]);
        ctx.save();
        ctx.beginPath();
        ctx.rect(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]) - 4, Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1]) + 8);
        ctx.clip();
      }

      if (g.text) {
        const at = toPx(g.text.at);
        ctx.fillStyle = col;
        ctx.font = fontString(400, true, 'serif', g.text.size * pxPerUnit);
        ctx.fillText(g.text.value, at[0], at[1]);
      }
      if (g.fill && fillAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(alpha * ga * fillAlpha * (g.fillOpacity ?? 1));
        if (lift > 0 && !P.affine) {
          // Lifted off a tilted sheet: its shadow lies on the sheet below.
          ctx.save();
          ctx.globalAlpha *= 0.28;
          ctx.fillStyle = '#000';
          ctx.beginPath();
          for (const c of g.contours) tracePts(ctx, c.pts.map((p) => P.at(apply(local ? mul(thM, local) : thM, p), 0)), true);
          ctx.fill('nonzero');
          ctx.restore();
        }
        fillShape(ctx, g.contours.map((c) => c.pts.map(toPx)), col, look, unit, seed + i);
        ctx.restore();
      }
      const outline = g.fill && !g.stroke && strokeFrac < 1 && fillAlpha < 1;
      if ((g.stroke || outline) && strokeFrac > 0) {
        ctx.save();
        const width = g.stroke ? (g.key === 'line' && th.kind === 'math' ? (g.width ?? 0.04) * pxPerUnit : (g.width ?? 4) * unit * zoomWidth) : 1.6 * unit;
        if (g.dash) ctx.setLineDash([14 * unit, 10 * unit]);
        if (outline) ctx.globalAlpha = clamp(alpha * ga * (1 - fillAlpha));
        const lines = g.contours.map((c) => (strokeFrac >= 1 ? openPoints(c) : partial(c, strokeFrac)).map(toPx)).filter((l) => l.length > 1);
        strokeLines(ctx, lines, lines.map(() => false), col, width, look, unit, seed + i);
        if (strokeFrac < 1 && lines.length) { const l = lines[lines.length - 1]; tip = l[l.length - 1]; }
        ctx.restore();
      }
      if (reveal < 1) ctx.restore();
    }
    if (tip && look === 'whiteboard' && s.drawn < 1) drawMarker(ctx, tip, resolve(own, theme.ink), unit);
    ctx.restore();
  }

  private rasters = new Map<Thing, { canvas: AnyCanvas; t: number }>();

  private drawRaster(ctx: Ctx2D, th: Thing, m: Mat, scene: CompiledScene) {
    const r = th.raster!;
    const w = r.res, h = Math.max(1, Math.round((r.res * (r.y1 - r.y0)) / (r.x1 - r.x0)));
    let c = this.rasters.get(th);
    const t = scene.world.now;
    if (!c || c.t !== t) {
      const canvas = c?.canvas ?? makeCanvas(w, h);
      const g = canvas.getContext('2d') as Ctx2D;
      const img = g.createImageData(w, h);
      r.paint(t, w, h, img.data);
      g.putImageData(img, 0, 0);
      c = { canvas, t };
      this.rasters.set(th, c);
    }
    const p0 = apply(m, [r.x0, r.y1]), px = apply(m, [r.x1, r.y1]), py = apply(m, [r.x0, r.y0]);
    ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([(px[0] - p0[0]) / w, (px[1] - p0[1]) / w, (py[0] - p0[0]) / h, (py[1] - p0[1]) / h, p0[0], p0[1]])));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha *= th.state.drawn < 1 ? th.state.drawn : 1;
    ctx.drawImage(c.canvas as CanvasImageSource, 0, 0);
  }

  private drawImage(ctx: Ctx2D, th: Thing, m: Mat, pxPerUnit: number, scene: CompiledScene) {
    const img = th.image!;
    const theme = scene.world.theme;
    const pic = pictures.get(img.file);
    // Drawn in pixels, y down, turned and placed like the thing.
    const p = pxPerUnit;
    const w = img.w * p, h = img.h * p;
    const a = th.state.drawn;
    ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([m[0] / p, m[1] / p, m[2] / p, m[3] / p, m[4], m[5]])));
    ctx.scale(1, -1);
    ctx.globalAlpha *= a < 1 ? clamp(a) : 1;
    // Polaroid: a white card with room for the caption under the picture.
    const border = img.frame === 'polaroid' ? Math.min(w, h) * 0.05 : 0;
    const bottom = img.frame === 'polaroid' ? border * 3.2 : 0;
    if (img.frame === 'polaroid') {
      ctx.save();
      ctx.shadowBlur = 0.15 * p; ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.fillStyle = '#fbfaf6';
      ctx.fillRect(-w / 2 - border, -h / 2 - border, w + border * 2, h + border + bottom);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    if (img.frame === 'circle') ctx.ellipse(0, 0, Math.min(w, h) / 2, Math.min(w, h) / 2, 0, 0, Math.PI * 2);
    else if (img.frame === 'rounded') roundRectPath(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.05);
    else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
    if (pic) {
      // A slow move while it is seen.
      const u = clamp((scene.world.now - img.start) / Math.max(0.5, img.length));
      const z = img.motion === 'in' ? 1 + 0.08 * u : img.motion === 'out' ? 1.08 - 0.08 * u : img.motion === 'none' ? 1 : 1.08;
      const dx = img.motion === 'left' ? (0.5 - u) * 0.07 * w : img.motion === 'right' ? (u - 0.5) * 0.07 * w : 0;
      // Cover the box, keeping the picture's shape.
      const k = Math.max(w / pic.width, h / pic.height) * z;
      const pw = pic.width * k, ph = pic.height * k;
      if ('filter' in ctx) ctx.filter = TONES[img.tone] ?? 'none';
      ctx.drawImage(pic, -pw / 2 + dx, -ph / 2, pw, ph);
      if ('filter' in ctx) ctx.filter = 'none';
    } else {
      // Not opened yet: a plain box with the file's name.
      ctx.fillStyle = withAlpha(theme.ink, 0.12);
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = withAlpha(theme.ink, 0.6);
      ctx.font = fontString(500, false, 'sans-serif', Math.min(w, h) * 0.08);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(img.file, 0, 0);
    }
    ctx.restore();
    if (img.caption) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cs = Math.max(0.2 * p, Math.min(w, h) * 0.07);
      ctx.font = fontString(500, false, theme.fonts.text, cs);
      if (img.frame === 'polaroid') { ctx.fillStyle = '#2b2b2b'; ctx.fillText(img.caption, 0, h / 2 + bottom / 2); }
      else { ctx.fillStyle = withAlpha(theme.ink, 0.8); ctx.fillText(img.caption, 0, h / 2 + cs * 1.1); }
    }
  }

  private drawText(ctx: Ctx2D, th: Thing, m: Mat, pxPerUnit: number, col: string, base: DOMMatrix) {
    const L = th.text!;
    const s = th.state;
    const fontPx = L.size * pxPerUnit;
    ctx.setTransform(base.multiply(new DOMMatrix([m[0] / pxPerUnit, m[1] / pxPerUnit, m[2] / pxPerUnit, m[3] / pxPerUnit, m[4], m[5]])));
    ctx.scale(1, -1);
    if (s.drawn < 1) {
      const b = L.box;
      ctx.beginPath();
      const w = (b.x1 - b.x0) * pxPerUnit;
      ctx.rect(b.x0 * pxPerUnit - 4, -b.y1 * pxPerUnit - fontPx, w * s.drawn + 8, (b.y1 - b.y0) * pxPerUnit + fontPx * 2);
      ctx.clip();
    }
    ctx.font = fontString(L.weight, L.italic, L.font, fontPx);
    textPaint(ctx, col, th.look ?? this.lookOf, Math.min(this.movie.width, this.movie.height) / 1080);
    ctx.textBaseline = 'alphabetic';
    for (const line of L.lines) {
      // Words next to each other are drawn together, so letters keep their spacing.
      let run = '';
      let runX = 0;
      const flush = () => { if (run) ctx.fillText(run, runX * pxPerUnit, -line.y * pxPerUnit); run = ''; };
      for (const r of line.runs) {
        if (r.kind === 'text') {
          if (!run) runX = r.x;
          run += r.text!;
          continue;
        }
        flush();
        if (r.glyphs) {
          ctx.beginPath();
          for (const g of r.glyphs) {
            if (!g.fill) continue;
            for (const c of g.contours) tracePts(ctx, c.pts.map(([x, y]) => [(x + r.x) * pxPerUnit, -(y + line.y) * pxPerUnit] as Pt), true);
          }
          ctx.fill('nonzero');
        }
      }
      flush();
    }
  }

  private drawCaptions(ctx: Ctx2D, t: number, scene: CompiledScene) {
    const { movie } = this;
    const line = movie.narration.lines.find((l) => t >= l.start && t < l.end + 0.25);
    if (!line || !line.words.length) return;
    const W = movie.width, H = movie.height;
    const theme = scene.world.theme;
    const cap = movie.captions;
    const px = cap.size * (H / movie.frameH);
    const font = fontString(600, false, theme.fonts.text, px);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = font;
    ctx.textBaseline = 'middle';
    const y = cap.position === 'top' ? H * 0.1 : H * (W < H ? 0.78 : 0.9);
    const words = line.words.map((w) => (cap.maths ? captionText(w.text) : w.text.replace(/\$/g, '')));
    const maxW = W * 0.8;
    if (cap.style === 'plain') {
      const text = cap.maths ? captionText(line.text) : line.text;
      const rows = wrap(ctx, text, maxW);
      const lh = px * 1.3;
      rows.forEach((row, i) => {
        const w = ctx.measureText(row).width;
        const ry = y - ((rows.length - 1) * lh) / 2 + i * lh;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(W / 2 - w / 2 - px * 0.4, ry - lh / 2, w + px * 0.8, lh);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(row, W / 2, ry);
      });
      ctx.restore();
      return;
    }
    // Karaoke: a few words at a time, the spoken one lit.
    const now = Math.max(0, line.words.findIndex((w) => t < w.end));
    const groups: number[][] = [];
    let cur: number[] = [], width = 0;
    const space = ctx.measureText(' ').width;
    words.forEach((w, i) => {
      const ww = ctx.measureText(w).width;
      if (cur.length && (cur.length >= 6 || width + ww > maxW * 0.75)) { groups.push(cur); cur = []; width = 0; }
      cur.push(i);
      width += ww + space;
    });
    if (cur.length) groups.push(cur);
    const group = groups.find((g) => g.includes(now)) ?? groups[groups.length - 1];
    const widths = group.map((i) => ctx.measureText(words[i]).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (group.length - 1);
    let x = W / 2 - total / 2;
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.lineWidth = px * 0.18;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    group.forEach((i, k) => {
      const spoken = line.words[i].start <= t;
      ctx.strokeText(words[i], x, y);
      ctx.fillStyle = i === now && t < line.end ? theme.accent : spoken ? '#ffffff' : 'rgba(255,255,255,0.82)';
      ctx.fillText(words[i], x, y);
      x += widths[k] + space;
    });
    ctx.restore();
  }
}

function wrap(ctx: Ctx2D, text: string, maxW: number): string[] {
  const rows: string[] = [];
  let row = '';
  for (const w of text.split(/\s+/)) {
    const test = row ? `${row} ${w}` : w;
    if (ctx.measureText(test).width > maxW && row) { rows.push(row); row = w; } else row = test;
  }
  if (row) rows.push(row);
  return rows;
}

function tracePts(ctx: Ctx2D, pts: Pt[], close: boolean) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

/** Colour of a thing or glyph; "mix:k:colour" blends from `under` towards colour. */
function resolve(c: string | undefined, under: string): string {
  if (!c) return under;
  if (c.startsWith('mix:')) {
    const [, k, col] = c.match(/^mix:([^:]+):(.*)$/)!;
    return mixColor(under, col, Number(k));
  }
  return c;
}

function centerOfGlyphs(gs: Glyph[]): Pt {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const g of gs) for (const c of g.contours) for (const [x, y] of c.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return Number.isFinite(x0) ? [(x0 + x1) / 2, (y0 + y1) / 2] : [0, 0];
}

const dotGlyph = (c: Pt): Glyph => ({ contours: [{ closed: true, pts: [[c[0], c[1]], [c[0] + 0.5, c[1]], [c[0], c[1] + 0.5]] }], fill: true, stroke: false, key: 'dot', parts: [] });

function glyphCenter(g: Glyph): Pt {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of g.contours) for (const [x, y] of c.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

function thingBox(glyphs: Glyph[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const g of glyphs) for (const c of g.contours) for (const [x, y] of c.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1 };
}

export const _test = { resolve, contourLength, withAlpha };

function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
