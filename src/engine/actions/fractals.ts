// Fractals and domain colouring. The colour-filled ones are worked out
// pixel by pixel into a small picture each frame, then scaled smoothly into
// place; the line fractals are drawn level by level.

import { type Ctx, arrive, color, natural, num, registerAction, str } from '../actions';
import type { Pt } from '../geom';
import { complexMap } from '../graph/expr';
import { parseColor, withAlpha } from '../color';
import { fillGlyph, strokeGlyph } from '../shapes';
import { type Glyph, type Raster, Thing } from '../thing';
import { ScriptError, choice, clamp, ease } from '../util';
import { liveThing } from './graph';

// ---- Colours ----

type RGB = [number, number, number];

function paletteOf(ctx: Ctx): RGB[] {
  const p = ctx.spec.palette;
  const t = ctx.world.theme;
  const list = Array.isArray(p) ? p.map((c, i) => color({ ...ctx, spec: { c } }, 'c') ?? `#${i}`) : [t.background as string, t.shades.dark_blue ?? '#236b8e', t.shades.blue ?? '#58c4dd', t.shades.yellow ?? '#ffff00', '#ffffff', t.shades.orange ?? '#ff862f'];
  if (p !== undefined && !Array.isArray(p) && p !== 'theme') throw new ScriptError('must be a list of colours, or "theme".', `${ctx.where}.palette`);
  return list.map((c) => { const q = parseColor(typeof c === 'string' ? c : '#000') ?? [0, 0, 0, 1]; return [q[0], q[1], q[2]]; });
}

/** A smooth colour along the palette, repeating. */
function along(pal: RGB[], u: number): RGB {
  const x = ((u % 1) + 1) % 1 * (pal.length - 1);
  const i = Math.floor(x), f = x - i;
  const a = pal[i], b = pal[Math.min(i + 1, pal.length - 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function hsl(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// ---- The region a fill covers, and its view of the plane ----

interface Region { x0: number; y0: number; x1: number; y1: number; c: Pt; half: number; aspect: number }

/** The axes' box in a graph scene, or the whole frame. */
function regionOf(ctx: Ctx): Region {
  const { world } = ctx;
  const a = world.axes.size ? world.mainAxes(ctx.where) : undefined;
  if (a) {
    const o = a.o;
    return { x0: o.center[0] - o.width / 2, x1: o.center[0] + o.width / 2, y0: o.center[1] - o.height / 2, y1: o.center[1] + o.height / 2, c: [(a.x[0] + a.x[1]) / 2, (a.y[0] + a.y[1]) / 2], half: (a.y[1] - a.y[0]) / 2, aspect: (a.x[1] - a.x[0]) / (a.y[1] - a.y[0]) };
  }
  const W = world.frameW, H = world.frameH;
  return { x0: -W / 2, x1: W / 2, y0: -H / 2, y1: H / 2, c: [-0.5, 0], half: 1.3, aspect: W / H };
}

function makeRaster(ctx: Ctx, id: string, r: Region, paint: Raster['paint']): Thing {
  const th = new Thing(id, 'image', [{ contours: [{ closed: true, pts: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]] }], fill: false, stroke: false, key: 'raster', parts: [] }], [0, 0]);
  th.raster = { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, res: 360, paint };
  th.layer = -2;
  ctx.world.add(th, ctx.where);
  return th;
}

// ---- fractal ----

const KINDS = ['mandelbrot', 'julia', 'burning_ship', 'newton', 'sierpinski', 'koch', 'tree', 'dragon'] as const;

registerAction('fractal', {
  summary: 'Mandelbrot, Julia, burning ship and Newton fills that zoom; Sierpinski, Koch, tree and dragon drawn level by level.',
  worlds: ['graph', 'board'],
  params: ['kind', 'c', 'zoom_to', 'zoom', 'levels', 'palette', 'position', 'size', 'color', 'iterations'],
  build(ctx) {
    const { world, spec } = ctx;
    const kind = choice(spec.kind, KINDS, `${ctx.where}.kind`, 'mandelbrot');
    const id = str(ctx, 'id') ?? world.newId(kind);
    if (['sierpinski', 'koch', 'tree', 'dragon'].includes(kind)) return lineFractal(ctx, id, kind as 'sierpinski' | 'koch' | 'tree' | 'dragon');
    const r = regionOf(ctx);
    const pal = paletteOf(ctx);
    const d = natural(ctx, 3);
    const start = ctx.start;
    const zoom = typeof spec.zoom === 'number' ? spec.zoom : 1;
    if (!(zoom >= 1) || zoom > 1e12) throw new ScriptError('must be from 1 to 1e12.', `${ctx.where}.zoom`);
    const to: Pt = Array.isArray(spec.zoom_to) && spec.zoom_to.length === 2 && spec.zoom_to.every((v) => typeof v === 'number') ? spec.zoom_to as Pt : r.c;
    // Julia's number may follow named values.
    const cOf = (): Pt => {
      const c = spec.c;
      if (c === undefined) return [-0.8, 0.156];
      if (!Array.isArray(c) || c.length !== 2) throw new ScriptError('must be [re, im].', `${ctx.where}.c`);
      return c.map((v, i) => (typeof v === 'number' ? v : typeof v === 'string' && world.values.has(v) ? world.values.get(v)!.now : (() => { throw new ScriptError('must be numbers or names of values.', `${ctx.where}.c[${i}]`); })())) as Pt;
    };
    cOf();
    const viewAt = (t: number): { c: Pt; half: number } => {
      if (zoom <= 1) return { c: r.c, half: r.half };
      const u = t === Infinity ? 1 : ease('smooth', clamp((t - start) / d));
      // Zoom in evenly in scale; the middle moves so the target stays put on screen as it grows.
      const z = Math.pow(zoom, u);
      const k = 1 - 1 / z;
      return { c: [r.c[0] + (to[0] - r.c[0]) * (zoom > 1 ? k / (1 - 1 / zoom) : 0), r.c[1] + (to[1] - r.c[1]) * (zoom > 1 ? k / (1 - 1 / zoom) : 0)], half: r.half / z };
    };
    const iterFixed = typeof spec.iterations === 'number' ? spec.iterations : undefined;
    const roots: Pt[] = [[1, 0], [-0.5, Math.sqrt(3) / 2], [-0.5, -Math.sqrt(3) / 2]];
    const th = makeRaster(ctx, id, r, (t, w, h, data) => {
      const v = viewAt(t);
      const maxIt = iterFixed ?? Math.round(90 + 45 * Math.log10(v.half > 0 ? r.half / v.half : 1));
      const jc = kind === 'julia' ? cOf() : [0, 0];
      const hw = v.half * r.aspect;
      for (let py = 0; py < h; py++) {
        const im0 = v.c[1] + v.half - (2 * v.half * (py + 0.5)) / h;
        for (let px = 0; px < w; px++) {
          const re0 = v.c[0] - hw + (2 * hw * (px + 0.5)) / w;
          let col: RGB;
          if (kind === 'newton') {
            // z^3 = 1 by Newton's method: coloured by which root it reaches, darker the slower.
            let x = re0, y = im0, n = 0, which = -1;
            for (; n < 40; n++) {
              const x2 = x * x - y * y, y2 = 2 * x * y;
              const fx = x2 * x - y2 * y - 1, fy = x2 * y + y2 * x;
              const dx = 3 * x2, dy = 3 * y2;
              const den = dx * dx + dy * dy || 1e-12;
              x -= (fx * dx + fy * dy) / den; y -= (fy * dx - fx * dy) / den;
              which = roots.findIndex((q) => (x - q[0]) ** 2 + (y - q[1]) ** 2 < 1e-6);
              if (which >= 0) break;
            }
            const base = pal[2 + (which < 0 ? 0 : which) % Math.max(1, pal.length - 2)] ?? pal[1];
            const k = which < 0 ? 0.1 : 1 - Math.min(0.85, n / 25);
            col = [base[0] * k, base[1] * k, base[2] * k];
          } else {
            let x = kind === 'julia' ? re0 : 0, y = kind === 'julia' ? im0 : 0;
            const cr = kind === 'julia' ? jc[0] : re0, ci = kind === 'julia' ? jc[1] : im0;
            let n = 0, x2 = x * x, y2 = y * y;
            for (; n < maxIt && x2 + y2 <= 16; n++) {
              y = kind === 'burning_ship' ? Math.abs(2 * x * y) + ci : 2 * x * y + ci;
              x = x2 - y2 + cr;
              if (kind === 'burning_ship') y = -y;
              x2 = x * x; y2 = y * y;
            }
            if (n >= maxIt) col = pal[0];
            else {
              // Smooth bands, not steps.
              const s = n + 1 - Math.log2(Math.log2(Math.max(1.0001, x2 + y2)) / 2);
              col = along(pal.slice(1), s / 28);
            }
          }
          const o = (py * w + px) * 4;
          data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
        }
      }
    });
    arrive(ctx, th, 'fade', start, 0.8);
    // A zoom leaves the axes behind, so they fade out rather than disagree with it.
    if (zoom > 1 && world.axes.size) {
      const ax = world.mainAxes(ctx.where);
      ctx.act({ start, duration: 0.6, apply(u) { ax.thing.state.opacity *= 1 - u; } });
    }
    if (zoom > 1) ctx.sound('swell', start);
    return { end: start + (zoom > 1 ? d : 0.8), thing: th };
  },
}, ['fractals']);

// ---- Line fractals ----

function lineFractal(ctx: Ctx, id: string, kind: 'sierpinski' | 'koch' | 'tree' | 'dragon') {
  const { world, spec } = ctx;
  const maxLv = { sierpinski: 7, koch: 6, tree: 11, dragon: 14 }[kind];
  const levels = typeof spec.levels === 'number' ? Math.round(spec.levels) : { sierpinski: 5, koch: 4, tree: 9, dragon: 12 }[kind];
  if (levels < 0 || levels > maxLv) throw new ScriptError(`must be from 0 to ${maxLv} for ${kind}.`, `${ctx.where}.levels`);
  const size = num(ctx, 'size', 6);
  const at: Pt = spec.position !== undefined ? world.point(spec.position, `${ctx.where}.position`) : [0, 0];
  const col = color(ctx, 'color', world.theme.colors[0])!;
  const d = natural(ctx, 1 + levels * 0.6);
  const start = ctx.start;
  const shapes: Glyph[][] = [];
  for (let lv = 0; lv <= levels; lv++) shapes.push(fractalLevel(kind, lv, size, at, col));
  const th = liveThing(ctx, id, (t) => {
    const u = t === Infinity ? 1 : clamp((t - start) / d);
    return shapes[Math.min(levels, Math.floor(u * (levels + 1)))];
  }, ctx.where);
  arrive(ctx, th, 'fade', start, 0.4);
  for (let lv = 1; lv <= levels; lv++) ctx.sound('click', start + (lv * d) / (levels + 1));
  return { end: start + d, thing: th };
}

function fractalLevel(kind: 'sierpinski' | 'koch' | 'tree' | 'dragon', lv: number, size: number, at: Pt, col: string): Glyph[] {
  const P = (x: number, y: number): Pt => [at[0] + x, at[1] + y];
  switch (kind) {
    case 'sierpinski': {
      const tris: Pt[][] = [];
      const h = (size * Math.sqrt(3)) / 2;
      const go = (a: Pt, b: Pt, c: Pt, n: number) => {
        if (n === 0) { tris.push([a, b, c]); return; }
        const ab: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], bc: Pt = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2], ca: Pt = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
        go(a, ab, ca, n - 1); go(ab, b, bc, n - 1); go(ca, bc, c, n - 1);
      };
      go(P(-size / 2, -h / 2), P(size / 2, -h / 2), P(0, h / 2), lv);
      return [fillGlyph(tris.map((pts) => ({ closed: true, pts })), 'tri', { color: col })];
    }
    case 'koch': {
      const r = size / Math.sqrt(3);
      let pts: Pt[] = [0, 1, 2].map((k) => P(r * Math.cos(Math.PI / 2 - (2 * Math.PI * k) / 3), r * Math.sin(Math.PI / 2 - (2 * Math.PI * k) / 3)));
      pts.push(pts[0]);
      for (let n = 0; n < lv; n++) {
        const next: Pt[] = [];
        for (let i = 0; i + 1 < pts.length; i++) {
          const a = pts[i], b = pts[i + 1];
          const dx = (b[0] - a[0]) / 3, dy = (b[1] - a[1]) / 3;
          const p1: Pt = [a[0] + dx, a[1] + dy], p3: Pt = [a[0] + 2 * dx, a[1] + 2 * dy];
          const p2: Pt = [p1[0] + dx * 0.5 + dy * (Math.sqrt(3) / 2), p1[1] + dy * 0.5 - dx * (Math.sqrt(3) / 2)];
          next.push(a, p1, p2, p3);
        }
        next.push(pts[pts.length - 1]);
        pts = next;
      }
      return [fillGlyph([{ closed: true, pts }], 'flake', { color: withAlpha(col, 0.25) }), strokeGlyph([{ closed: true, pts }], 2.5, 'edge', { color: col })];
    }
    case 'tree': {
      const lines: { closed: boolean; pts: Pt[] }[] = [];
      const go = (p: Pt, ang: number, len: number, n: number) => {
        const q: Pt = [p[0] + len * Math.cos(ang), p[1] + len * Math.sin(ang)];
        lines.push({ closed: false, pts: [p, q] });
        if (n > 0) { go(q, ang + 0.45, len * 0.72, n - 1); go(q, ang - 0.45, len * 0.72, n - 1); }
      };
      go(P(0, -size / 2), Math.PI / 2, size * 0.3, lv);
      return [strokeGlyph(lines, 2.5, 'branch', { color: col })];
    }
    default: {
      // The dragon curve: fold a strip in half again and again.
      let turns: number[] = [];
      for (let n = 0; n < lv; n++) turns = [...turns, 1, ...turns.slice().reverse().map((x) => -x)];
      const step = size / Math.pow(Math.SQRT2, lv) / 1.6;
      let ang = (lv * Math.PI) / 4, p: Pt = P(-size * 0.25, 0);
      const pts: Pt[] = [p];
      for (let i = 0; i <= turns.length; i++) {
        p = [p[0] + step * Math.cos(ang), p[1] + step * Math.sin(ang)];
        pts.push(p);
        if (i < turns.length) ang += (turns[i] * Math.PI) / 2;
      }
      // Centre it on its place.
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2 - at[0], cy = (Math.min(...ys) + Math.max(...ys)) / 2 - at[1];
      return [strokeGlyph([{ closed: false, pts: pts.map((q) => [q[0] - cx, q[1] - cy] as Pt) }], 2, 'dragon', { color: col })];
    }
  }
}

// ---- domain_color ----

registerAction('domain_color', {
  summary: 'The complex plane coloured by where each point goes: hue for direction, brightness for size.',
  worlds: ['graph'],
  params: ['map', 'rings'],
  required: ['map'],
  build(ctx) {
    const { world, spec } = ctx;
    const f = complexMap(String(spec.map), `${ctx.where}.map`);
    const r = regionOf(ctx);
    const rings = spec.rings !== false;
    const th = makeRaster(ctx, str(ctx, 'id') ?? world.newId('domain'), r, (_t, w, h, data) => {
      const scope = world.scope();
      const hw = r.half * r.aspect;
      for (let py = 0; py < h; py++) {
        const y = r.c[1] + r.half - (2 * r.half * (py + 0.5)) / h;
        for (let px = 0; px < w; px++) {
          const x = r.c[0] - hw + (2 * hw * (px + 0.5)) / w;
          const [u, v] = f(x, y, scope);
          let col: RGB = [0, 0, 0];
          if (Number.isFinite(u) && Number.isFinite(v)) {
            const hue = (Math.atan2(v, u) / (2 * Math.PI) + 1) % 1;
            const m = Math.hypot(u, v);
            // Size as brightness, with soft rings at each doubling.
            let l = 0.5 * (2 / Math.PI) * Math.atan(m) + 0.15;
            if (rings) l *= 0.82 + 0.18 * ((Math.log2(m + 1e-12) % 1) + 1) % 1;
            col = hsl(hue, 0.85, Math.min(0.85, l));
          }
          const o = (py * w + px) * 4;
          data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
        }
      }
    });
    arrive(ctx, th, 'fade', ctx.start, 1);
    return { end: ctx.start + 1, thing: th };
  },
}, ['complex_colors']);
