// Drawing one finished frame onto a canvas.

import { mixColor, withAlpha } from './color';
import { type Mat, type Pt, apply, contourLength, mul, openPoints, partial } from './geom';
import type { CompiledScene, Layer, Movie } from './movie';
import { captionText } from './narration';
import { fontString } from './text';
import type { Glyph, GlyphState, Thing } from './thing';
import { clamp } from './util';

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

const TONES: Record<string, string> = { none: 'none', mono: 'grayscale(1) contrast(1.05)', faded: 'saturate(0.55) brightness(1.08) contrast(0.9)', warm: 'sepia(0.35) saturate(1.2)', cold: 'saturate(0.8) hue-rotate(12deg) brightness(0.98)' };

export class Renderer {
  private ctx: Ctx2D;
  private spare?: { canvas: AnyCanvas; ctx: Ctx2D };
  /** Captions drawn or not (the page's switch can change it). */
  captions = true;
  private hold?: { at: number; u: number };

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
    if (this.captions && scene.world.captions) this.drawCaptions(ctx, t, scene);
  }

  private drawLayer(ctx: Ctx2D, layer: Layer, t: number) {
    const W = this.movie.width, H = this.movie.height;
    ctx.save();
    if (layer.slide) ctx.translate(layer.slide[0] * W, -layer.slide[1] * H);
    this.drawScene(ctx, layer.scene, t);
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
    const view = scene.camera.viewAt(t);
    const k = (H / this.movie.frameH) * view.zoom;
    const base = ctx.getTransform();
    const camera: Mat = [k, 0, 0, -k, W / 2 - view.cx * k, H / 2 + view.cy * k];
    const rest: Mat = [H / this.movie.frameH, 0, 0, -H / this.movie.frameH, W / 2, H / 2];
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
    this.drawPaper(ctx, scene, camera, k, unit);

    const drawList = (list: Thing[], m: Mat) => {
      const sorted = list.map((th, i) => ({ th, i })).sort((a, b) => a.th.layer - b.th.layer || a.i - b.i);
      for (const { th } of sorted) this.drawThing(ctx, th, m, k, unit, scene);
    };
    drawList(scene.world.order.filter((th) => !th.screen && th.kind !== 'group'), camera);
    drawList(scene.world.order.filter((th) => th.screen && th.kind !== 'group'), rest);

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

  private drawPaper(ctx: Ctx2D, scene: CompiledScene, camera: Mat, k: number, unit: number) {
    const style = scene.background.style;
    if (style === 'plain' || style === 'gradient') return;
    const W = this.movie.width, H = this.movie.height;
    const step = scene.background.spacing;
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

  private drawThing(ctx: Ctx2D, th: Thing, view: Mat, k: number, unit: number, scene: CompiledScene) {
    if (!th.shown()) return;
    const s = th.state;
    const alpha = th.opacity() * (1 - s.dim) * (th.parent ? 1 - th.parent.state.dim : 1);
    if (alpha <= 0.002) return;
    const m = mul(view, th.matrix());
    const pxPerUnit = Math.hypot(m[0], m[1]);
    const theme = scene.world.theme;
    const own = s.color ?? th.base.color;
    const base = ctx.getTransform();
    ctx.save();
    ctx.globalAlpha = clamp(alpha);
    if (s.glow > 0) {
      ctx.shadowBlur = 24 * unit * s.glow;
      ctx.shadowColor = s.glowColor ?? resolve(own, theme.ink);
    }

    if (th.image) {
      this.drawImage(ctx, th, m, pxPerUnit, scene);
      ctx.restore();
      return;
    }

    if (th.text) {
      this.drawText(ctx, th, m, pxPerUnit, resolve(own, theme.ink), base);
      ctx.restore();
      return;
    }

    const glyphs = s.glyphs;
    const states = s.glyphStates;
    const n = glyphs.length;
    const zoomWidth = Math.sqrt(Math.max(0.2, k / (this.movie.height / this.movie.frameH))) * Math.sqrt(th.matrix()[0] ** 2 + th.matrix()[1] ** 2 || 1);
    for (let i = 0; i < n; i++) {
      const g = glyphs[i];
      const gs: GlyphState | undefined = states?.[i];
      const ga = gs ? gs.opacity : 1;
      if (ga <= 0.002) continue;
      let gm = m;
      if (gs && (gs.dx || gs.dy || gs.scale !== 1)) {
        const c = glyphCenter(g);
        const sc = gs.scale;
        const local: Mat = [sc, 0, 0, sc, c[0] - c[0] * sc + gs.dx, c[1] - c[1] * sc + gs.dy];
        gm = mul(m, local);
      }
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
        const p0 = apply(m, [box.x0, box.y0]), p1 = apply(m, [box.x0 + (box.x1 - box.x0) * reveal, box.y1]);
        ctx.save();
        ctx.beginPath();
        ctx.rect(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]) - 4, Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1]) + 8);
        ctx.clip();
      }

      if (g.text) {
        const at = apply(gm, g.text.at);
        ctx.fillStyle = col;
        ctx.font = fontString(400, true, 'serif', g.text.size * pxPerUnit);
        ctx.fillText(g.text.value, at[0], at[1]);
      }
      if (g.fill && fillAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(alpha * ga * fillAlpha * (g.fillOpacity ?? 1));
        ctx.fillStyle = col;
        ctx.beginPath();
        for (const c of g.contours) tracePts(ctx, c.pts.map((p) => apply(gm, p)), true);
        ctx.fill('nonzero');
        ctx.restore();
      }
      const outline = g.fill && !g.stroke && strokeFrac < 1 && fillAlpha < 1;
      if ((g.stroke || outline) && strokeFrac > 0) {
        ctx.strokeStyle = col;
        ctx.lineWidth = g.stroke ? (g.key === 'line' && th.kind === 'math' ? (g.width ?? 0.04) * pxPerUnit : (g.width ?? 4) * unit * zoomWidth) : 1.6 * unit;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (g.dash) ctx.setLineDash([14 * unit, 10 * unit]);
        if (outline) ctx.globalAlpha = clamp(alpha * ga * (1 - fillAlpha));
        ctx.beginPath();
        for (const c of g.contours) {
          const pts = strokeFrac >= 1 ? openPoints(c) : partial(c, strokeFrac);
          if (pts.length > 1) tracePts(ctx, pts.map((p) => apply(gm, p)), false);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (reveal < 1) ctx.restore();
    }
    ctx.restore();
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
    ctx.fillStyle = col;
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
