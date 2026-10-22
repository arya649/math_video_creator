// Axes and number planes: the link between maths numbers and the sheet.
//
// An Axes keeps its ranges and any plane transforms as they are at the
// frame being drawn; actions change them, and everything drawn on the axes
// asks them where a point goes.

import type { Contour, Pt } from '../geom';
import { texToGlyphs } from '../tex';
import { type Glyph, Thing } from '../thing';
import { arrowHead, fillGlyph, strokeGlyph } from '../shapes';
import { withAlpha } from '../color';
import type { Theme } from '../themes';
import { ScriptError, isObject } from '../util';
import type { Scope } from './expr';

export interface AxesOptions {
  x: [number, number];
  y: [number, number];
  xStep?: number;
  yStep?: number;
  width: number;
  height: number;
  center: Pt;
  numbers: 'both' | 'x' | 'y' | 'none';
  labels: [string, string];
  grid: 'none' | 'faint' | 'full';
  ticks: 'plain' | 'pi';
  arrows: boolean;
  log: 'none' | 'x' | 'y' | 'both';
  polar: boolean;
  plane: boolean;
  complex: boolean;
}

/** A change of the whole plane over time: a matrix, a complex map, any map. */
export interface Warp {
  map(p: Pt): Pt;
  /** 0 to 1: how far it has gone at this frame. */
  u: number;
  ghost: boolean;
  /** Going back to the plain grid. */
  undo?: boolean;
}

export class Axes {
  /** Ranges at this frame (rescale changes them). */
  x: [number, number];
  y: [number, number];
  warps: Warp[] = [];
  /** Warps added at compile time, with when they run. */
  plan: { warp: Warp; start: number; duration: number }[] = [];
  thing!: Thing;

  constructor(public id: string, public o: AxesOptions) {
    this.x = [...o.x];
    this.y = [...o.y];
  }

  reset() {
    this.x = [...this.o.x];
    this.y = [...this.o.y];
    for (const w of this.warps) w.u = 0;
  }

  private tx(v: number, axis: 'x' | 'y'): number {
    const log = this.o.log === 'both' || this.o.log === axis;
    return log ? Math.log10(Math.max(1e-12, v)) : v;
  }

  /** Bend a maths point by the plane transforms that have run so far. */
  warp(p: Pt): Pt {
    let q = p;
    for (const w of this.warps) {
      if (w.u <= 0) continue;
      if (w.undo) { q = [q[0] + (p[0] - q[0]) * w.u, q[1] + (p[1] - q[1]) * w.u]; continue; }
      const m = w.map(q);
      q = [q[0] + (m[0] - q[0]) * w.u, q[1] + (m[1] - q[1]) * w.u];
    }
    return q;
  }

  /** A maths point to the sheet. */
  toSheet(p: Pt, warped = true): Pt {
    const q = warped ? this.warp(p) : p;
    const [x0, x1] = this.x.map((v) => this.tx(v, 'x'));
    const [y0, y1] = this.y.map((v) => this.tx(v, 'y'));
    const kx = this.o.width / (x1 - x0), ky = this.o.height / (y1 - y0);
    return [
      this.o.center[0] + (this.tx(q[0], 'x') - (x0 + x1) / 2) * kx,
      this.o.center[1] + (this.tx(q[1], 'y') - (y0 + y1) / 2) * ky,
    ];
  }

  /** How long one maths unit is on the sheet, across and up. */
  unit(): Pt {
    return [this.o.width / (this.x[1] - this.x[0]), this.o.height / (this.y[1] - this.y[0])];
  }

  /** The axes' outlines, numbers and grid at this frame. */
  glyphs(theme: Theme, labelColor?: string): Glyph[] {
    const o = this.o;
    const out: Glyph[] = [];
    const ink = theme.ink;
    const [x0, x1] = this.x, [y0, y1] = this.y;
    // About one number for every 1.3 sheet units across and 0.8 up, so small axes stay readable.
    const xs = o.log === 'x' || o.log === 'both' ? logTicks(x0, x1) : ticksFor(x0, x1, o.xStep, o.ticks === 'pi', Math.max(2, o.width / 1.3));
    const ys = o.log === 'y' || o.log === 'both' ? logTicks(y0, y1) : ticksFor(y0, y1, o.yStep, false, Math.max(2, o.height / 0.8));
    const S = (p: Pt) => this.toSheet(p);
    const line = (a: Pt, b: Pt, n = 2): Contour => ({ closed: false, pts: Array.from({ length: n }, (_, k) => S([a[0] + ((b[0] - a[0]) * k) / (n - 1), a[1] + ((b[1] - a[1]) * k) / (n - 1)])) });
    const curved = this.warps.length > 0;
    const seg = curved ? 80 : 2;

    // The background grid.
    if (o.plane || o.grid !== 'none') {
      const col = o.plane ? withAlpha(theme.shades.blue, 0.75) : theme.grid;
      const width = o.plane ? 2.2 : 1.5;
      const lines: Contour[] = [];
      // A number plane fills the frame: its lines run past the axes' ends.
      const ext = o.plane ? 3 : 0;
      const gx = o.plane ? ticksFor(x0 - (x1 - x0) * ext, x1 + (x1 - x0) * ext, xs.step, false) : xs;
      const gy = o.plane ? ticksFor(y0 - (y1 - y0) * ext, y1 + (y1 - y0) * ext, ys.step, false) : ys;
      const lx: [number, number] = o.plane ? [gx.values[0], gx.values[gx.values.length - 1]] : [x0, x1];
      const ly: [number, number] = o.plane ? [gy.values[0], gy.values[gy.values.length - 1]] : [y0, y1];
      for (const v of gx.values) if (Math.abs(v) > 1e-9 || !o.plane) lines.push(line([v, ly[0]], [v, ly[1]], curved ? seg * 4 : 2));
      for (const v of gy.values) if (Math.abs(v) > 1e-9 || !o.plane) lines.push(line([lx[0], v], [lx[1], v], curved ? seg * 4 : 2));
      if (this.warps.some((w) => w.ghost && w.u > 0)) {
        const ghost: Contour[] = [];
        for (const v of gx.values) ghost.push({ closed: false, pts: [this.toSheet([v, ly[0]], false), this.toSheet([v, ly[1]], false)] });
        for (const v of gy.values) ghost.push({ closed: false, pts: [this.toSheet([lx[0], v], false), this.toSheet([lx[1], v], false)] });
        out.push(strokeGlyph(ghost, 1.2, 'ghost', { color: withAlpha(ink, 0.18) }));
      }
      out.push(strokeGlyph(lines, width, 'grid', { color: col }));
      if (o.polar) {
        const rings: Contour[] = [];
        const rmax = Math.max(Math.abs(x0), Math.abs(x1), Math.abs(y0), Math.abs(y1));
        for (let r = xs.step; r <= rmax * 1.5; r += xs.step) {
          rings.push({ closed: true, pts: Array.from({ length: 96 }, (_, k) => S([r * Math.cos((k / 96) * 2 * Math.PI), r * Math.sin((k / 96) * 2 * Math.PI)])) });
        }
        for (let a = 0; a < 360; a += 30) rings.push(line([0, 0], [rmax * 1.5 * Math.cos((a * Math.PI) / 180), rmax * 1.5 * Math.sin((a * Math.PI) / 180)]));
        out.push(strokeGlyph(rings, 1.4, 'polar', { color: withAlpha(theme.shades.blue, 0.45) }));
      }
    }

    // The axis lines, through 0 when 0 is in range, else along the edges.
    const ax = Math.min(Math.max(0, y0), y1), ay = Math.min(Math.max(0, x0), x1);
    const xa = line([x0, ax], [x1, ax], seg), ya = line([ay, y0], [ay, y1], seg);
    out.push(strokeGlyph([xa, ya], o.plane ? 3 : 3.2, 'axis', { color: ink }));
    if (o.arrows && !curved) {
      const size = 0.18;
      out.push(fillGlyph([arrowHead(S([x1 - 0.01 * (x1 - x0), ax]), S([x1, ax]), size), arrowHead(S([ay, y1 - 0.01 * (y1 - y0)]), S([ay, y1]), size)], 'axis-tip', { color: ink }));
    }

    // Ticks and numbers.
    const tick = 0.08;
    const ticks: Contour[] = [];
    const showX = o.numbers === 'both' || o.numbers === 'x', showY = o.numbers === 'both' || o.numbers === 'y';
    const numSize = 0.26;
    const numColor = withAlpha(ink, 0.85);
    if (!curved) {
      for (const [k, v] of xs.values.entries()) {
        if (Math.abs(v - ay) < 1e-9 && ay === 0) continue;
        if (v <= x0 || v >= x1) continue;
        const p = S([v, ax]);
        ticks.push({ closed: false, pts: [[p[0], p[1] - tick], [p[0], p[1] + tick]] });
        if (showX) out.push(...numberGlyphs(xs.labels[k], [p[0], p[1] - tick - 0.08], 'below', numSize, numColor, o.complex ? '' : ''));
      }
      for (const [k, v] of ys.values.entries()) {
        if (Math.abs(v - ax) < 1e-9 && ax === 0) continue;
        if (v <= y0 || v >= y1) continue;
        const p = S([ay, v]);
        ticks.push({ closed: false, pts: [[p[0] - tick, p[1]], [p[0] + tick, p[1]]] });
        if (showY) out.push(...numberGlyphs(o.complex ? complexLabel(ys.labels[k]) : ys.labels[k], [p[0] - tick - 0.08, p[1]], 'left', numSize, numColor, ''));
      }
      if (ticks.length) out.push(strokeGlyph(ticks, 2.4, 'ticks', { color: ink }));
      const [lx, ly] = o.complex ? ['\\mathrm{Re}', '\\mathrm{Im}'] : o.labels;
      const lc = labelColor;
      if (lx) out.push(...numberGlyphs(lx, [Math.min(S([x1, ax])[0] - 0.05, this.o.center[0] + this.o.width / 2 - 0.3), S([x1, ax])[1] + 0.22], 'above', 0.4, lc ?? ink, ''));
      if (ly) out.push(...numberGlyphs(ly, [S([ay, y1])[0] + 0.25, S([ay, y1])[1] - 0.05], 'right', 0.4, lc ?? ink, ''));
    }
    return out;
  }
}

function complexLabel(s: string): string {
  if (s === '1') return 'i';
  if (s === '-1') return '-i';
  return `${s}i`;
}

/** A small piece of maths placed beside a point. */
export function numberGlyphs(tex: string, at: Pt, side: 'below' | 'left' | 'above' | 'right' | 'center', size: number, color: string, _key: string): Glyph[] {
  if (!tex) return [];
  const r = texToGlyphs(tex, size);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const g of r.glyphs) for (const c of g.contours) for (const [x, y] of c.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let dx: number, dy: number;
  switch (side) {
    case 'below': dx = at[0] - (x0 + x1) / 2; dy = at[1] - y1; break;
    case 'above': dx = at[0] - (x0 + x1) / 2; dy = at[1] - y0; break;
    case 'left': dx = at[0] - x1; dy = at[1] - (y0 + y1) / 2; break;
    case 'right': dx = at[0] - x0; dy = at[1] - (y0 + y1) / 2; break;
    default: dx = at[0] - (x0 + x1) / 2; dy = at[1] - (y0 + y1) / 2;
  }
  return r.glyphs.map((g) => ({
    ...g, color: g.color ?? color, key: 'num',
    contours: g.contours.map((c) => ({ closed: c.closed, pts: c.pts.map(([x, y]) => [x + dx, y + dy] as Pt) })),
  }));
}

/** Tick positions and their labels: a round step giving about ten ticks. */
export function ticksFor(a: number, b: number, step: number | undefined, pi: boolean, target = 10): { values: number[]; labels: string[]; step: number } {
  const span = Math.abs(b - a) || 1;
  let s = step;
  if (pi) s = s ?? niceStep(span / Math.PI, target) * Math.PI;
  if (!s) s = niceStep(span, target);
  const values: number[] = [];
  const start = Math.ceil(Math.min(a, b) / s - 1e-9) * s;
  for (let v = start; v <= Math.max(a, b) + 1e-9 && values.length < 400; v += s) values.push(Math.abs(v) < 1e-12 ? 0 : v);
  const decimals = Math.max(0, -Math.floor(Math.log10(s) + 1e-9));
  const labels = values.map((v) => (pi ? piLabel(v / Math.PI) : Number(v.toFixed(Math.min(6, decimals))).toString()));
  return { values, labels, step: s };
}

/** Ticks at powers of ten, for a log scale. */
function logTicks(a: number, b: number): { values: number[]; labels: string[]; step: number } {
  const values: number[] = [];
  for (let k = Math.ceil(Math.log10(Math.max(1e-12, a))); 10 ** k <= b * 1.0001; k++) values.push(10 ** k);
  return { values, labels: values.map((v) => (v >= 1 ? String(v) : v.toString())), step: 1 };
}

function niceStep(span: number, target = 10): number {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function piLabel(k: number): string {
  const r = Math.round(k * 4) / 4;
  if (r === 0) return '0';
  const frac: Record<string, string> = { '0.25': '\\frac{\\pi}{4}', '0.5': '\\frac{\\pi}{2}', '0.75': '\\frac{3\\pi}{4}' };
  const sign = r < 0 ? '-' : '';
  const a = Math.abs(r);
  if (frac[String(a)]) return sign + frac[String(a)];
  if (Number.isInteger(a)) return `${sign}${a === 1 ? '' : a}\\pi`;
  return `${sign}${a}\\pi`;
}

/** Read an axes spec (the `axes` action, or a graph scene's `axes`). */
export function readAxes(spec: Record<string, unknown>, frame: { w: number; h: number }, where: string): AxesOptions {
  const range = (v: unknown, key: string, d: [number, number]): { r: [number, number]; step?: number } => {
    if (v === undefined) return { r: d };
    if (!Array.isArray(v) || v.length < 2 || v.length > 3 || !v.every((n) => typeof n === 'number')) {
      throw new ScriptError('must be [from, to] or [from, to, step], such as [-5, 5] or [0, 10, 2].', `${where}.${key}`);
    }
    if (v[1] <= v[0]) throw new ScriptError('must go from smaller to larger.', `${where}.${key}`);
    return { r: [v[0], v[1]], step: v[2] };
  };
  const given = spec.x !== undefined || spec.y !== undefined;
  const xr = range(spec.x, 'x', [-frame.w / 2, frame.w / 2]);
  const yr = range(spec.y, 'y', [-frame.h / 2, frame.h / 2]);
  // Left out, the axes fill the frame with one unit per sheet unit; given
  // ranges fill most of the frame, or keep units square with `equal`.
  let width = typeof spec.width === 'number' ? spec.width : given ? frame.w * 0.86 : frame.w;
  // Given ranges leave a strip at the bottom of the frame for the captions.
  let height = typeof spec.height === 'number' ? spec.height : given ? frame.h * 0.74 : frame.h;
  if (spec.equal === true) {
    const k = Math.min(width / (xr.r[1] - xr.r[0]), height / (yr.r[1] - yr.r[0]));
    width = k * (xr.r[1] - xr.r[0]);
    height = k * (yr.r[1] - yr.r[0]);
  }
  const plane = spec.plane === true;
  const numbers = spec.numbers === false ? 'none' : spec.numbers === 'x' ? 'x' : spec.numbers === 'y' ? 'y' : 'both';
  const labels = Array.isArray(spec.labels) ? [String(spec.labels[0] ?? ''), String(spec.labels[1] ?? '')] as [string, string] : spec.labels === false ? ['', ''] as [string, string] : ['x', 'y'] as [string, string];
  const grid = spec.grid === true ? 'full' : spec.grid === 'faint' ? 'faint' : 'none';
  const log = spec.log === 'x' || spec.log === 'y' || spec.log === 'both' ? spec.log : 'none';
  if (spec.log !== undefined && log === 'none') throw new ScriptError('must be "x", "y" or "both".', `${where}.log`);
  if (spec.ticks !== undefined && spec.ticks !== 'pi') throw new ScriptError('can only be "pi".', `${where}.ticks`);
  return {
    x: xr.r, y: yr.r, xStep: xr.step, yStep: yr.step, width, height, center: [0, given && typeof spec.height !== 'number' ? frame.h * 0.06 : 0],
    numbers: plane && spec.numbers === undefined ? 'both' : numbers,
    labels, grid, ticks: spec.ticks === 'pi' ? 'pi' : 'plain', arrows: spec.arrows !== false && !plane, log,
    polar: spec.polar === true, plane, complex: spec.complex === true,
  };
}

export const AXES_KEYS = ['x', 'y', 'width', 'height', 'numbers', 'labels', 'grid', 'ticks', 'arrows', 'log', 'polar', 'plane', 'complex', 'equal', 'appear', 'position'] as const;

/** A graph drawn on axes: y as a function of x, with the scene's named values. */
export interface Graph {
  id: string;
  axes: Axes;
  f(x: number, scope: Scope): number;
  thing: Thing;
}

export const isAxesSpec = (v: unknown): v is Record<string, unknown> => isObject(v);
