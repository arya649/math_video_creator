// The counting world: number lines (with hops, stretches and zooming),
// things to count (dots, objects, base-ten blocks, tally marks), fractions
// that split and join, and chance done visibly (coins, dice, spinners,
// cards), probability trees and grids of outcomes. Every throw lands where
// the script says, or on seeded random results that are the same every time.

import { evaluate } from 'mathjs';
import { type Ctx, type Done, arrive, color, natural, num, readAppear, registerAction, sizeOf, str, things } from '../actions';
import type { Contour, Pt } from '../geom';
import { numberGlyphs } from '../graph/axes';
import { formatNumber } from '../graph/expr';
import { arrowHead, circle, circlePts, fillGlyph, roundedRect, star, strokeGlyph } from '../shapes';
import { type Glyph, Thing } from '../thing';
import { withAlpha } from '../color';
import { ScriptError, choice, clamp, ease, hashString, isObject, rng } from '../util';
import type { SceneWorld } from '../world';
import { liveThing } from './graph';

const COUNTING: ['counting'] = ['counting'];

// ---- Small helpers ----

const shift = (gs: Glyph[], dx: number, dy: number, k = 1): Glyph[] =>
  gs.map((g) => ({ ...g, contours: g.contours.map((c) => ({ closed: c.closed, pts: c.pts.map(([x, y]) => [x * k + dx, y * k + dy] as Pt) })) }));

/** Squash glyphs sideways about x = cx (a coin or card turning). */
const squash = (gs: Glyph[], cx: number, k: number): Glyph[] =>
  gs.map((g) => ({ ...g, contours: g.contours.map((c) => ({ closed: c.closed, pts: c.pts.map(([x, y]) => [cx + (x - cx) * k, y] as Pt) })) }));

const turn = (gs: Glyph[], c: Pt, a: number): Glyph[] => {
  const co = Math.cos(a), si = Math.sin(a);
  return gs.map((g) => ({ ...g, contours: g.contours.map((ct) => ({ closed: ct.closed, pts: ct.pts.map(([x, y]) => [c[0] + (x - c[0]) * co - (y - c[1]) * si, c[1] + (x - c[0]) * si + (y - c[1]) * co] as Pt) })) }));
};

const disc = (c: Pt, r: number, col: string, key = 'disc'): Glyph => fillGlyph([circle(c, r)], key, { color: col });

/** Maths or a word as glyphs (a plain word is set as text). */
const word = (s: string) => (/^[-\d.,]+$/.test(s) || /\\/.test(s) ? s : `\\text{${s.replace(/[{}\\]/g, '')}}`);

/** A fraction written "3/4" as LaTeX. */
function fracTex(p: unknown): string {
  const s = String(p);
  const m = s.match(/^\s*(-?\d+)\s*\/\s*(\d+)\s*$/);
  return m ? `\\tfrac{${m[1]}}{${m[2]}}` : word(s);
}

function centerOf(ctx: Ctx, fallback: Pt = [0, 0]): Pt {
  return ctx.spec.position !== undefined ? ctx.world.point(ctx.spec.position, `${ctx.where}.position`) : fallback;
}

/** Things in a group made here, with how they are laid out. */
const LAYOUT = new WeakMap<Thing, { rows: number; cols: number }>();

// ---- Number lines ----

export interface NumberLine {
  id: string;
  y: number;
  left: number;
  right: number;
  /** The range at a time: zooms change it. */
  rangeAt(t: number): [number, number];
  zooms: { start: number; duration: number; to: [number, number] }[];
  step?: number;
  fractions: boolean;
  toSheet(v: number, t?: number): Pt;
}

function makeLine(world: SceneWorld, id: string, a: number, b: number, y: number, left: number, right: number, step: number | undefined, fractions: boolean): NumberLine {
  const L: NumberLine = {
    id, y, left, right, step, fractions, zooms: [],
    rangeAt(t) {
      let r: [number, number] = [a, b];
      for (const z of L.zooms) {
        if (t < z.start) break;
        const u = ease('smooth', clamp((t - z.start) / z.duration));
        // The middle moves evenly; the width changes evenly in scale, as a zoom does.
        const c0 = (r[0] + r[1]) / 2, c1 = (z.to[0] + z.to[1]) / 2;
        const w0 = r[1] - r[0], w1 = z.to[1] - z.to[0];
        const w = w0 * Math.pow(w1 / w0, u);
        const k = Math.abs(w1 - w0) < 1e-12 ? u : (w - w0) / (w1 - w0);
        const c = c0 + (c1 - c0) * k;
        r = [c - w / 2, c + w / 2];
      }
      return r;
    },
    toSheet(v, t) {
      const [ra, rb] = L.rangeAt(t ?? world.now);
      return [left + ((v - ra) / (rb - ra)) * (right - left), y];
    },
  };
  return L;
}

/** Steps that each divide the next, for marks that appear between marks as a line zooms. */
function stepChain(step: number | undefined, fractions: boolean): number[] {
  const out = new Set<number>();
  if (fractions && step) {
    for (let s = step, k = 0; k < 8; k++, s /= 2) out.add(s);
    const n = Math.round(1 / step);
    if (Math.abs(n * step - 1) < 1e-9) for (const s of [1, 5, 10, 50, 100, 500, 1000]) out.add(s);
  } else {
    const base = step ?? 1;
    for (let k = -6; k <= 6; k++) { out.add(base * 10 ** k); out.add(base * 5 * 10 ** k); }
  }
  return [...out].sort((a, b) => a - b);
}

function lineLabel(v: number, L: NumberLine, labelStep: number): string {
  if (Math.abs(v) < 1e-9) return '0';
  if (L.fractions && L.step && labelStep < 1) {
    const n = Math.round(1 / labelStep);
    const k = Math.round(v * n);
    if (Math.abs(k / n - v) < 1e-9 && k % n !== 0) {
      const g = gcd(Math.abs(k), n);
      return `${k < 0 ? '-' : ''}\\tfrac{${Math.abs(k) / g}}{${n / g}}`;
    }
  }
  const dec = Math.max(0, Math.min(6, -Math.floor(Math.log10(Math.abs(v) - Math.trunc(Math.abs(v)) || 1) - 1e-9)));
  return Number(v.toFixed(dec + 3)).toString();
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

function drawLine(L: NumberLine, t: number, ink: string, numbers: boolean | number[]): Glyph[] {
  const [a, b] = L.rangeAt(t);
  const perUnit = (L.right - L.left) / (b - a);
  const out: Glyph[] = [strokeGlyph([{ closed: false, pts: [[L.left - 0.25, L.y], [L.right + 0.25, L.y]] }], 3.5, 'line', { color: ink }),
    fillGlyph([arrowHead([L.left, L.y], [L.right + 0.45, L.y], 0.2), arrowHead([L.right, L.y], [L.left - 0.45, L.y], 0.2)], 'tips', { color: ink })];
  const chain = stepChain(L.step, L.fractions);
  const finest = chain.find((s) => s * perUnit >= 0.22) ?? chain[chain.length - 1];
  const li = chain.findIndex((s) => s * perUnit >= 0.95);
  const labelStep = chain[li >= 0 ? li : chain.length - 1];
  const nextLabel = chain[li + 1];
  const labelFade = clamp((labelStep * perUnit - 0.95) / 0.4);
  const divides = (s: number, v: number) => Math.abs(v / s - Math.round(v / s)) < 1e-6;
  const first = Math.ceil(a / finest - 1e-9), last = Math.floor(b / finest + 1e-9);
  for (let k = first; k <= last && k - first < 400; k++) {
    const v = k * finest;
    const level = [...chain].reverse().find((s) => s >= finest && divides(s, v)) ?? finest;
    const alpha = clamp((level * perUnit - 0.22) / 0.3);
    const x = L.left + (v - a) * perUnit;
    const h = level >= labelStep ? 0.16 : 0.09;
    out.push(strokeGlyph([{ closed: false, pts: [[x, L.y - h], [x, L.y + h]] }], 2.5, 'tick', { color: withAlpha(ink, alpha) }));
    const listed = Array.isArray(numbers) ? numbers.some((n) => Math.abs(n - v) < 1e-9) : numbers;
    if (listed && divides(labelStep, v)) {
      const la = Array.isArray(numbers) ? 1 : nextLabel !== undefined && divides(nextLabel, v) ? 1 : labelFade;
      if (la > 0.02) out.push(...numberGlyphs(lineLabel(v, L, labelStep), [x, L.y - 0.3], 'below', 0.32, withAlpha(ink, la), ''));
    }
  }
  return out;
}

export function lineOf(ctx: Ctx, key = 'on'): NumberLine {
  const v = ctx.spec[key];
  const name = typeof v === 'string' ? v : 'line';
  const L = ctx.world.numberLines.get(name) as NumberLine | undefined;
  if (!L) {
    const names = [...ctx.world.numberLines.keys()];
    throw new ScriptError(names.length ? `there is no number line called "${name}". Lines: ${names.join(', ')}.` : 'there is no number line yet; make one with "number_line" (or the scene\'s "number_line").', `${ctx.where}.${key}`);
  }
  return L;
}

function readNumber(v: unknown, where: string, inf = false): number {
  if (typeof v === 'number') return v;
  if (inf && (v === 'inf' || v === '+inf')) return Infinity;
  if (inf && v === '-inf') return -Infinity;
  if (typeof v === 'string' && /^\s*-?\d+\s*\/\s*\d+\s*$/.test(v)) { const [p, q] = v.split('/').map(Number); return p / q; }
  throw new ScriptError(`must be a number${inf ? ', "inf" or "-inf"' : ''}.`, where);
}

export function makeNumberLine(ctx: Ctx, spec: Record<string, unknown>, where: string): Thing {
  const { world } = ctx;
  const x = spec.x ?? [-5, 5];
  if (!Array.isArray(x) || x.length < 2) throw new ScriptError('must be [from, to] or [from, to, step].', `${where}.x`);
  const a = readNumber(x[0], `${where}.x[0]`), b = readNumber(x[1], `${where}.x[1]`);
  if (!(b > a)) throw new ScriptError('the end must be above the start.', `${where}.x`);
  const step = x[2] !== undefined ? readNumber(x[2], `${where}.x[2]`) : undefined;
  const width = typeof spec.width === 'number' ? spec.width : 13;
  const at = spec.position !== undefined ? world.point(spec.position, `${where}.position`) : [0, -1] as Pt;
  const id = typeof spec.id === 'string' ? spec.id : world.numberLines.has('line') ? world.newId('line') : 'line';
  const fractions = spec.fractions === true;
  if (fractions && !step) throw new ScriptError('with "fractions": true, give the step as a fraction: "x": [0, 1, "1/4"].', `${where}.x`);
  const L = makeLine(world, id, a, b, at[1], at[0] - width / 2, at[0] + width / 2, step, fractions);
  world.numberLines.set(id, L);
  const numbers = spec.numbers === false ? false : Array.isArray(spec.numbers) ? spec.numbers.map((n, i) => readNumber(n, `${where}.numbers[${i}]`)) : true;
  const ink = world.theme.ink;
  return liveThing(ctx, id, (t) => drawLine(L, t, ink, numbers), where);
}

registerAction('number_line', {
  summary: 'A number line; marks appear between marks as it zooms.',
  worlds: COUNTING,
  params: ['x', 'numbers', 'fractions', 'width', 'position', 'appear'],
  build(ctx) {
    const th = makeNumberLine(ctx, { ...ctx.spec, id: ctx.spec.id }, ctx.where);
    const { how } = readAppear(ctx, 'draw');
    const d = natural(ctx, 1.2);
    arrive(ctx, th, how, ctx.start, d);
    return { end: ctx.start + d, thing: th };
  },
}, ['numberline']);

registerAction('jump', {
  summary: 'A hop along the number line, with an arrow tip and a label.',
  worlds: COUNTING,
  params: ['on', 'from', 'by', 'to', 'label', 'count', 'color', 'side'],
  required: ['from'],
  build(ctx) {
    const { world, spec } = ctx;
    const L = lineOf(ctx);
    const from = readNumber(spec.from, `${ctx.where}.from`);
    if (spec.by === undefined && spec.to === undefined) throw new ScriptError('needs "by" (how far) or "to" (where it lands).', ctx.where);
    const by = spec.by !== undefined ? readNumber(spec.by, `${ctx.where}.by`) : readNumber(spec.to, `${ctx.where}.to`) - from;
    const count = typeof spec.count === 'number' ? Math.max(1, Math.round(spec.count)) : 1;
    const col = color(ctx, 'color', world.theme.colors[0])!;
    const below = spec.side === 'below';
    const per = ctx.duration !== undefined ? ctx.duration / count : 0.8 / ctx.speed;
    const start = ctx.start;
    const labels = Array.isArray(spec.label) ? spec.label.map(String) : spec.label !== undefined ? Array(count).fill(String(spec.label)) : Array(count).fill(by > 0 ? `+${formatNumber(by, Number.isInteger(by) ? 0 : 2)}` : formatNumber(by, Number.isInteger(by) ? 0 : 2));
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('jump'), (t) => {
      const out: Glyph[] = [];
      for (let k = 0; k < count; k++) {
        const u = t === Infinity ? 1 : clamp((t - start - k * per) / (per * 0.85));
        if (u <= 0) break;
        const p0 = L.toSheet(from + by * k, t), p1 = L.toSheet(from + by * (k + 1), t);
        const span = Math.abs(p1[0] - p0[0]);
        const h = (below ? -1 : 1) * clamp(span * 0.4, 0.35, 1.6);
        const n = 40;
        const pts: Pt[] = [];
        for (let i = 0; i <= Math.round(n * u); i++) {
          const s = i / n, x = p0[0] + (p1[0] - p0[0]) * s;
          // Only the part over the line is drawn (a zoom can carry hops off its ends).
          if (x >= L.left - 0.05 && x <= L.right + 0.05) pts.push([x, L.y + 0.08 * Math.sign(h) + 4 * h * s * (1 - s)]);
        }
        const whole = Math.min(p0[0], p1[0]) >= L.left - 0.05 && Math.max(p0[0], p1[0]) <= L.right + 0.05;
        if (pts.length > 1) out.push(strokeGlyph([{ closed: false, pts }], 4, 'hop', { color: col }));
        if (u >= 1 && whole && pts.length > 3) {
          out.push(fillGlyph([arrowHead(pts[pts.length - 3], pts[pts.length - 1], 0.18)], 'tip', { color: col }));
          out.push(...numberGlyphs(word(labels[k] ?? labels[0]), [(p0[0] + p1[0]) / 2, L.y + h + 0.1 * Math.sign(h)], below ? 'below' : 'above', 0.34, col, ''));
        }
      }
      return out;
    }, ctx.where);
    th.base.visible = true;
    for (let k = 0; k < count; k++) ctx.sound('pop', start + k * per + per * 0.8);
    return { end: start + per * count, thing: th };
  },
}, ['hop']);

registerAction('interval', {
  summary: 'A bold stretch of the number line, with filled or hollow ends.',
  worlds: COUNTING,
  params: ['on', 'from', 'to', 'open_start', 'open_end', 'color'],
  required: ['from', 'to'],
  build(ctx) {
    const { world, spec } = ctx;
    const L = lineOf(ctx);
    const a = readNumber(spec.from, `${ctx.where}.from`, true), b = readNumber(spec.to, `${ctx.where}.to`, true);
    const col = color(ctx, 'color', world.theme.colors[1])!;
    const bg = world.theme.background;
    const back = typeof bg === 'string' ? bg : bg[0];
    const d = natural(ctx, 1);
    const start = ctx.start;
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('interval'), (t) => {
      const u = t === Infinity ? 1 : ease('smooth', clamp((t - start) / d));
      const ra = Number.isFinite(a) ? L.toSheet(a, t)[0] : -Infinity, rb = Number.isFinite(b) ? L.toSheet(b, t)[0] : Infinity;
      if (rb < L.left || ra > L.right) return [];
      const xa = clamp(ra, L.left - 0.2, L.right + 0.2), xb = clamp(rb, L.left - 0.2, L.right + 0.2);
      const showA = Number.isFinite(a) && ra >= L.left - 0.05, showB = Number.isFinite(b) && rb <= L.right + 0.05;
      const x1 = xa + (xb - xa) * u;
      const y = L.y;
      const out: Glyph[] = [strokeGlyph([{ closed: false, pts: [[xa, y], [x1, y]] }], 10, 'stretch', { color: col })];
      if (!showB && u >= 1) out.push(fillGlyph([arrowHead([xa, y], [xb + 0.3, y], 0.3)], 'inf', { color: col }));
      if (!showA) out.push(fillGlyph([arrowHead([xb, y], [xa - 0.3, y], 0.3)], 'inf', { color: col }));
      const end = (x: number, open: boolean) => [disc([x, y], 0.13, col), ...(open ? [disc([x, y], 0.075, back, 'hole')] : [])];
      if (showA) out.push(...end(xa, spec.open_start === true));
      if (showB && u >= 1) out.push(...end(xb, spec.open_end === true));
      return out;
    }, ctx.where);
    th.layer = 1;
    arrive(ctx, th, 'fade', start, 0.2);
    return { end: start + d, thing: th };
  },
}, ['stretch']);

registerAction('point_on_line', {
  summary: 'A dot at a number on the number line, with a label; it stays on its number as the line zooms.',
  worlds: COUNTING,
  params: ['on', 'x', 'label', 'color', 'side'],
  required: ['x'],
  build(ctx) {
    const { world, spec } = ctx;
    const L = lineOf(ctx);
    const x = readNumber(spec.x, `${ctx.where}.x`);
    const col = color(ctx, 'color', world.theme.accent)!;
    const label = spec.label === true ? lineLabel(x, L, L.step ?? 1) : typeof spec.label === 'string' ? word(spec.label) : undefined;
    const below = spec.side === 'below';
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('point'), (t) => {
      const p = L.toSheet(x, t);
      if (p[0] < L.left - 0.05 || p[0] > L.right + 0.05) return [];
      return [disc(p, 0.12, col), ...(label ? numberGlyphs(label, [p[0], p[1] + (below ? -0.55 : 0.3)], below ? 'below' : 'above', 0.36, col, '') : [])];
    }, ctx.where);
    th.layer = 2;
    arrive(ctx, th, 'pop', ctx.start, 0.35);
    return { end: ctx.start + 0.4, thing: th };
  },
}, ['number_point', 'dot_on_line']);

registerAction('zoom_line', {
  summary: 'The number line zooms to a new range; finer marks appear as it goes.',
  worlds: COUNTING,
  params: ['who', 'x'],
  required: ['x'],
  build(ctx) {
    const L = lineOf(ctx, 'who');
    const x = ctx.spec.x;
    if (!Array.isArray(x) || x.length < 2) throw new ScriptError('must be [from, to].', `${ctx.where}.x`);
    const to: [number, number] = [readNumber(x[0], `${ctx.where}.x[0]`), readNumber(x[1], `${ctx.where}.x[1]`)];
    if (!(to[1] > to[0])) throw new ScriptError('the end must be above the start.', `${ctx.where}.x`);
    const d = natural(ctx, 2.5);
    L.zooms.push({ start: ctx.start, duration: d, to });
    L.zooms.sort((p, q) => p.start - q.start);
    ctx.sound('whoosh', ctx.start);
    return { end: ctx.start + d };
  },
}, ['zoom_number_line']);

// ---- Things to count ----

const ITEM_SHAPES = ['dot', 'square', 'star', 'apple', 'coin', 'person', 'ball', 'heart'] as const;
type ItemShape = (typeof ITEM_SHAPES)[number];

/** The body has no colour of its own, so the thing's colour (and highlights) show on it. */
function itemGlyphs(shape: ItemShape, r: number, world: SceneWorld): Glyph[] {
  const o: Pt = [0, 0];
  const col = undefined as unknown as string;
  switch (shape) {
    case 'square': return [fillGlyph([roundedRect(-r, -r, r, r, r * 0.18)], 'item', { color: col })];
    case 'star': return [fillGlyph([{ closed: true, pts: star(o, r * 1.15, 5) }], 'item', { color: col })];
    case 'apple': return [
      fillGlyph([{ closed: true, pts: circlePts([0, -r * 0.05], r, r * 0.92, 0, Math.PI * 2, 40).slice(0, -1) }], 'item', {}),
      strokeGlyph([{ closed: false, pts: [[0, r * 0.7], [r * 0.1, r * 1.15]] }], 3, 'stem', { color: '#7a4a24' }),
      fillGlyph([{ closed: true, pts: circlePts([r * 0.38, r * 1.0], r * 0.3, r * 0.14, 0, Math.PI * 2, 20).slice(0, -1) }], 'leaf', { color: '#6dbb4f' }),
    ];
    case 'coin': return [fillGlyph([circle(o, r)], 'item'), strokeGlyph([circle(o, r * 0.72)], 2, 'rim', { color: withAlpha('#000000', 0.25) })];
    case 'person': return [fillGlyph([circle([0, r * 0.62], r * 0.36)], 'item'), fillGlyph([roundedRect(-r * 0.62, -r, r * 0.62, r * 0.18, r * 0.4)], 'body')];
    case 'ball': return [fillGlyph([circle(o, r)], 'item'), disc([-r * 0.32, r * 0.32], r * 0.25, withAlpha('#ffffff', 0.55), 'shine')];
    case 'heart': {
      const pts: Pt[] = [];
      for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2; pts.push([r * 0.065 * 16 * Math.sin(a) ** 3, r * 0.065 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]); }
      return [fillGlyph([{ closed: true, pts }], 'item', { color: col })];
    }
    default: void world; void col; return [fillGlyph([circle(o, r)], 'item')];
  }
}

registerAction('dots', {
  summary: 'Things to count: dots, squares, stars, apples, coins, people, balls, hearts, in a row or an array.',
  worlds: COUNTING,
  params: ['count', 'rows', 'columns', 'shape', 'size', 'gap', 'color', 'position', 'lag', 'appear'],
  build(ctx) {
    const { world, spec } = ctx;
    let rows: number, cols: number, count: number;
    if (typeof spec.rows === 'number' || typeof spec.columns === 'number') {
      rows = typeof spec.rows === 'number' ? spec.rows : 1;
      cols = typeof spec.columns === 'number' ? spec.columns : 1;
      count = typeof spec.count === 'number' ? Math.min(spec.count, rows * cols) : rows * cols;
    } else {
      if (typeof spec.count !== 'number') throw new ScriptError('needs "count", or "rows" and "columns".', ctx.where);
      count = spec.count;
      cols = count <= 10 ? count : 10;
      rows = Math.ceil(count / cols);
    }
    if (!(count >= 1) || count > 400) throw new ScriptError('must be from 1 to 400 things.', `${ctx.where}.count`);
    const shape = choice(spec.shape, ITEM_SHAPES, `${ctx.where}.shape`, 'dot');
    const r = sizeOf(spec.size, { small: 0.13, medium: 0.2, large: 0.3, huge: 0.45 }, `${ctx.where}.size`, 'medium');
    const gap = num(ctx, 'gap', r * 1.4);
    const pitch = r * 2 + gap;
    const fallback = shape === 'apple' ? world.theme.shades.red ?? '#e04040' : shape === 'coin' ? world.theme.shades.gold ?? '#f0ac5f' : world.theme.colors[0];
    const col = color(ctx, 'color', fallback)!;
    const id = str(ctx, 'id') ?? world.newId('dots');
    const c = centerOf(ctx);
    const items: Thing[] = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols), column = i % cols;
      const p: Pt = [c[0] + (column - (cols - 1) / 2) * pitch, c[1] + ((rows - 1) / 2 - row) * pitch];
      const th = new Thing(`${id}.${i + 1}`, 'shape', itemGlyphs(shape, r, world), p);
      th.base.color = col;
      world.add(th, ctx.where);
      items.push(th);
    }
    const group = new Thing(id, 'group', [], [0, 0]);
    group.members = items;
    LAYOUT.set(group, { rows, cols });
    world.add(group, ctx.where);
    world.last = items[items.length - 1];
    const { how } = readAppear(ctx, 'pop');
    const lag = num(ctx, 'lag', Math.min(0.12, 2.5 / count));
    items.forEach((th, i) => arrive(ctx, th, how, ctx.start + i * lag, 0.35));
    return { end: ctx.start + (count - 1) * lag + 0.35, thing: group };
  },
}, ['objects', 'array', 'counters']);

registerAction('group_items', {
  summary: 'Rings round groups of counted things: by row, by column or in fives.',
  worlds: COUNTING,
  params: ['who', 'by', 'lag', 'color'],
  required: ['who', 'by'],
  build(ctx) {
    const { world, spec } = ctx;
    const group = world.get(spec.who, `${ctx.where}.who`);
    const items = things(ctx);
    const lay = LAYOUT.get(group);
    let sets: Thing[][];
    if (spec.by === 'row' || spec.by === 'column') {
      if (!lay) throw new ScriptError('grouping by row or column needs things made with "dots".', `${ctx.where}.by`);
      sets = spec.by === 'row'
        ? Array.from({ length: lay.rows }, (_, r) => items.filter((_, i) => Math.floor(i / lay.cols) === r))
        : Array.from({ length: lay.cols }, (_, c) => items.filter((_, i) => i % lay.cols === c));
    } else if (typeof spec.by === 'number' && spec.by >= 1) {
      sets = [];
      for (let i = 0; i < items.length; i += spec.by) sets.push(items.slice(i, i + spec.by));
    } else throw new ScriptError('must be "row", "column" or a number of things in each group.', `${ctx.where}.by`);
    const lag = num(ctx, 'lag', 0.4);
    const rings: Thing[] = [];
    sets.filter((s) => s.length).forEach((set, k) => {
      const boxes = set.map((t) => t.buildBox());
      const x0 = Math.min(...boxes.map((b) => b.x0)) - 0.14, x1 = Math.max(...boxes.map((b) => b.x1)) + 0.14;
      const y0 = Math.min(...boxes.map((b) => b.y0)) - 0.14, y1 = Math.max(...boxes.map((b) => b.y1)) + 0.14;
      const col = color(ctx, 'color', world.theme.colors[(k + 1) % world.theme.colors.length])!;
      const ring = new Thing(`${group.id}.group${k + 1}`, 'shape', [strokeGlyph([roundedRect(x0, y0, x1, y1, Math.min(x1 - x0, y1 - y0) / 2)], 3.5, 'ring', { color: col })], [0, 0]);
      world.add(ring, ctx.where);
      arrive(ctx, ring, 'draw', ctx.start + k * lag, 0.5);
      rings.push(ring);
    });
    const g = new Thing(`${group.id}.groups`, 'group', [], [0, 0]);
    g.members = rings;
    if (!world.things.has(g.id)) world.add(g, ctx.where);
    return { end: ctx.start + (rings.length - 1) * lag + 0.5, thing: g };
  },
}, ['group_by', 'ring']);

registerAction('count_items', {
  summary: 'Counted things light in turn, each with its number.',
  worlds: COUNTING,
  params: ['who', 'lag', 'color', 'from'],
  required: ['who'],
  build(ctx) {
    const { world } = ctx;
    const items = things(ctx);
    const lag = ctx.duration !== undefined ? ctx.duration / items.length : num(ctx, 'lag', Math.min(0.5, 6 / items.length));
    const col = color(ctx, 'color', world.theme.accent)!;
    const from = num(ctx, 'from', 1);
    items.forEach((th, i) => {
      const at = ctx.start + i * lag;
      const b = th.buildBox();
      const n = new Thing(world.newId('count'), 'math', numberGlyphs(String(from + i), [(b.x0 + b.x1) / 2, b.y1 + 0.08], 'above', 0.3, col, ''), [0, 0]);
      world.add(n, ctx.where);
      arrive(ctx, n, 'pop', at, 0.3);
      ctx.act({ start: at, duration: 0.4, apply(u) { th.state.scale *= 1 + 0.25 * Math.sin(Math.PI * u); th.state.color = col; } });
      ctx.sound('tick', at);
    });
    return { end: ctx.start + items.length * lag };
  },
}, ['count_up', 'count_them']);

registerAction('tally', {
  summary: 'Tally marks, drawn in fives.',
  worlds: COUNTING,
  params: ['count', 'position', 'lag', 'color', 'size'],
  required: ['count'],
  build(ctx) {
    const { world, spec } = ctx;
    if (typeof spec.count !== 'number' || spec.count < 1 || spec.count > 200) throw new ScriptError('must be a number from 1 to 200.', `${ctx.where}.count`);
    const n = Math.round(spec.count);
    const h = sizeOf(spec.size, { small: 0.5, medium: 0.85, large: 1.2, huge: 1.6 }, `${ctx.where}.size`, 'medium');
    const col = color(ctx, 'color', world.theme.ink)!;
    const id = str(ctx, 'id') ?? world.newId('tally');
    const c = centerOf(ctx);
    const groups = Math.ceil(n / 5);
    const gw = h * 0.95, gap = h * 0.45;
    const perRow = Math.max(1, Math.floor(13 / (gw + gap)));
    const rows = Math.ceil(groups / perRow);
    const lag = num(ctx, 'lag', Math.min(0.25, 5 / n));
    const marks: Thing[] = [];
    for (let i = 0; i < n; i++) {
      const g = Math.floor(i / 5), k = i % 5;
      const row = Math.floor(g / perRow), col0 = g % perRow;
      const across = Math.min(groups, perRow);
      const gx = c[0] + (col0 - (across - 1) / 2) * (gw + gap) - gw / 2;
      const gy = c[1] + ((rows - 1) / 2 - row) * (h * 1.5);
      const pts: Pt[] = k < 4 ? [[gx + (k + 0.5) * gw / 4.2, gy - h / 2], [gx + (k + 0.5) * gw / 4.2 + 0.02, gy + h / 2]] : [[gx - 0.1, gy - h * 0.3], [gx + gw + 0.05, gy + h * 0.3]];
      const m = new Thing(`${id}.${i + 1}`, 'shape', [strokeGlyph([{ closed: false, pts }], 4.5, 'mark', { color: col })], [0, 0]);
      world.add(m, ctx.where);
      arrive(ctx, m, 'draw', ctx.start + i * lag, Math.min(0.3, lag * 1.5));
      ctx.sound('tick', ctx.start + i * lag);
      marks.push(m);
    }
    const group = new Thing(id, 'group', [], [0, 0]);
    group.members = marks;
    world.add(group, ctx.where);
    return { end: ctx.start + n * lag + 0.3, thing: group };
  },
}, ['tally_marks']);

// ---- Base-ten blocks ----

interface Blocks { hundreds: Thing[]; tens: Thing[]; ones: Thing[]; origin: Pt; u: number; cols: [string, string, string] }
const BLOCKS = new Map<Thing, Blocks>();

function blockGlyphs(kind: 'h' | 't' | 'o', u: number, col: string): Glyph[] {
  const w = kind === 'o' ? u : kind === 't' ? u : u * 10, h = kind === 'o' ? u : u * 10;
  const lines: Contour[] = [];
  if (kind !== 'o') for (let k = 1; k < 10; k++) lines.push({ closed: false, pts: [[-w / 2, -h / 2 + k * u], [w / 2, -h / 2 + k * u]] });
  if (kind === 'h') for (let k = 1; k < 10; k++) lines.push({ closed: false, pts: [[-w / 2 + k * u, -h / 2], [-w / 2 + k * u, h / 2]] });
  return [
    fillGlyph([roundedRect(-w / 2, -h / 2, w / 2, h / 2, u * 0.12)], 'block', { color: col }),
    strokeGlyph([roundedRect(-w / 2, -h / 2, w / 2, h / 2, u * 0.12), ...lines], 1.5, 'edges', { color: withAlpha('#000000', 0.35) }),
  ];
}

/** Where each block goes: hundreds, then tens, then ones in columns of five. */
function blockPlaces(b: { h: number; t: number; o: number }, origin: Pt, u: number): { h: Pt[]; t: Pt[]; o: Pt[] } {
  const gap = u * 0.8;
  const hw = u * 10, top = origin[1] + u * 5;
  const total = b.h * (hw + gap) + b.t * (u + gap * 0.6) + Math.ceil(b.o / 5) * (u + gap * 0.4) + gap * 2;
  let x = origin[0] - total / 2;
  const h: Pt[] = [], t: Pt[] = [], o: Pt[] = [];
  for (let i = 0; i < b.h; i++) { h.push([x + hw / 2, origin[1]]); x += hw + gap; }
  if (b.h) x += gap;
  for (let i = 0; i < b.t; i++) { t.push([x + u / 2, origin[1]]); x += u + gap * 0.6; }
  if (b.t) x += gap;
  for (let i = 0; i < b.o; i++) { const c = Math.floor(i / 5), r = i % 5; o.push([x + c * (u + gap * 0.4) + u / 2, top - u / 2 - r * (u + gap * 0.4)]); }
  return { h, t, o };
}

function moveTo(ctx: Ctx, th: Thing, to: Pt, start: number, d: number) {
  const dx = to[0] - th.build.x, dy = to[1] - th.build.y;
  if (Math.abs(dx) + Math.abs(dy) < 1e-6) return;
  ctx.act({ start, duration: d, apply(u) { const e = ease('smooth', u); th.state.x += dx * e; th.state.y += dy * e; } });
  th.build.x = to[0];
  th.build.y = to[1];
}

registerAction('blocks', {
  summary: 'Base-ten blocks: hundreds as flats, tens as rods, ones as cubes.',
  worlds: COUNTING,
  params: ['number', 'hundreds', 'tens', 'ones', 'position', 'size', 'lag'],
  build(ctx) {
    const { world, spec } = ctx;
    const amount = (k: string, max: number) => {
      const v = spec[k];
      if (v === undefined) return 0;
      if (typeof v !== 'number' || v < 0 || v > max || !Number.isInteger(v)) throw new ScriptError(`must be a whole number from 0 to ${max}.`, `${ctx.where}.${k}`);
      return v;
    };
    let counts: { h: number; t: number; o: number };
    if (spec.number !== undefined) {
      if (typeof spec.number !== 'number' || spec.number < 0 || spec.number > 999 || !Number.isInteger(spec.number)) throw new ScriptError('must be a whole number from 0 to 999.', `${ctx.where}.number`);
      counts = { h: Math.floor(spec.number / 100), t: Math.floor(spec.number / 10) % 10, o: spec.number % 10 };
    } else if (spec.hundreds !== undefined || spec.tens !== undefined || spec.ones !== undefined) {
      // Amounts as they stand mid-sum, such as 1 ten and 12 ones before carrying.
      counts = { h: amount('hundreds', 9), t: amount('tens', 19), o: amount('ones', 19) };
    } else throw new ScriptError('needs "number", or "hundreds", "tens" and "ones".', ctx.where);
    const u = sizeOf(spec.size, { small: 0.13, medium: 0.18, large: 0.24, huge: 0.3 }, `${ctx.where}.size`, 'medium');
    const id = str(ctx, 'id') ?? world.newId('blocks');
    const origin = centerOf(ctx);
    const cols: [string, string, string] = [world.theme.colors[0], world.theme.colors[2 % world.theme.colors.length], world.theme.colors[1]];
    const places = blockPlaces(counts, origin, u);
    const make = (kind: 'h' | 't' | 'o', p: Pt, k: number) => {
      const th = new Thing(`${id}.${kind === 'h' ? 'hundred' : kind === 't' ? 'ten' : 'one'}${k}`, 'shape', blockGlyphs(kind, u, cols[kind === 'h' ? 0 : kind === 't' ? 1 : 2]), p);
      world.add(th, ctx.where);
      return th;
    };
    const B: Blocks = { hundreds: places.h.map((p, k) => make('h', p, k + 1)), tens: places.t.map((p, k) => make('t', p, k + 1)), ones: places.o.map((p, k) => make('o', p, k + 1)), origin, u, cols };
    const group = new Thing(id, 'group', [], [0, 0]);
    group.members = [...B.hundreds, ...B.tens, ...B.ones];
    world.add(group, ctx.where);
    BLOCKS.set(group, B);
    const lag = num(ctx, 'lag', 0.15);
    group.members.forEach((th, i) => arrive(ctx, th, 'pop', ctx.start + i * lag, 0.35));
    return { end: ctx.start + group.members.length * lag + 0.35, thing: group };
  },
}, ['base_ten', 'place_value_blocks']);

registerAction('regroup', {
  summary: 'Ten ones join into a ten (carry), or a ten breaks into ones (borrow).',
  worlds: COUNTING,
  params: ['who', 'carry', 'borrow'],
  required: ['who'],
  build(ctx) {
    const { world, spec } = ctx;
    const group = world.get(spec.who, `${ctx.where}.who`);
    const B = BLOCKS.get(group);
    if (!B) throw new ScriptError('must name blocks made with "blocks".', `${ctx.where}.who`);
    const d = natural(ctx, 2.2);
    const s = ctx.start;
    let n = 0;
    const counter = () => `${group.id}.new${++n + group.members.length}`;
    if (spec.carry === true) {
      if (B.ones.length < 10) throw new ScriptError(`a carry needs ten ones; there are ${B.ones.length}.`, `${ctx.where}.carry`);
      const ten = B.ones.slice(-10), rest = B.ones.slice(0, -10);
      const places = blockPlaces({ h: B.hundreds.length, t: B.tens.length + 1, o: rest.length }, B.origin, B.u);
      const rodAt = places.t[places.t.length - 1];
      // The ten ones line up into the shape of a rod, then become one.
      ten.forEach((th, k) => moveTo(ctx, th, [rodAt[0], rodAt[1] - B.u * 4.5 + k * B.u], s + k * 0.04, d * 0.45));
      B.hundreds.forEach((th, k) => moveTo(ctx, th, places.h[k], s, d * 0.45));
      B.tens.forEach((th, k) => moveTo(ctx, th, places.t[k], s, d * 0.45));
      rest.forEach((th, k) => moveTo(ctx, th, places.o[k], s, d * 0.45));
      const rod = new Thing(counter(), 'shape', blockGlyphs('t', B.u, B.cols[1]), rodAt);
      world.add(rod, ctx.where);
      arrive(ctx, rod, 'fade', s + d * 0.6, d * 0.3);
      ctx.act({ start: s + d * 0.6, duration: d * 0.3, apply(u) { for (const th of ten) { if (u >= 1) th.state.visible = false; else th.state.opacity *= 1 - u; } } });
      ctx.sound('chime', s + d * 0.75);
      B.tens.push(rod);
      B.ones = rest;
    } else if (spec.borrow === true) {
      if (!B.tens.length) throw new ScriptError('a borrow needs a ten to break.', `${ctx.where}.borrow`);
      const rod = B.tens.pop()!;
      const places = blockPlaces({ h: B.hundreds.length, t: B.tens.length, o: B.ones.length + 10 }, B.origin, B.u);
      const fresh: Thing[] = [];
      for (let k = 0; k < 10; k++) {
        const one = new Thing(counter(), 'shape', blockGlyphs('o', B.u, B.cols[2]), [rod.build.x, rod.build.y - B.u * 4.5 + k * B.u]);
        world.add(one, ctx.where);
        arrive(ctx, one, 'fade', s, 0.2);
        moveTo(ctx, one, places.o[B.ones.length + k], s + 0.4 + k * 0.05, d * 0.5);
        fresh.push(one);
      }
      ctx.act({ start: s, duration: 0.25, apply(u) { if (u >= 1) rod.state.visible = false; else rod.state.opacity *= 1 - u; } });
      B.hundreds.forEach((th, k) => moveTo(ctx, th, places.h[k], s + 0.4, d * 0.5));
      B.tens.forEach((th, k) => moveTo(ctx, th, places.t[k], s + 0.4, d * 0.5));
      B.ones.forEach((th, k) => moveTo(ctx, th, places.o[k], s + 0.4, d * 0.5));
      ctx.sound('pop', s);
      B.ones.push(...fresh);
    } else throw new ScriptError('needs "carry": true (ten ones become a ten) or "borrow": true (a ten becomes ten ones).', ctx.where);
    group.members = [...B.hundreds, ...B.tens, ...B.ones];
    return { end: s + d, thing: group };
  },
}, ['exchange', 'trade']);

// ---- Fractions ----

interface Fraction { as: 'bar' | 'pie' | 'grid' | 'line'; p0: number; s0: number; changes: { at: number; d: number; to: number }[]; w: number; h: number; col: string }
const FRACTIONS = new Map<Thing, Fraction>();

function partsAt(F: Fraction, t: number): { from: number; to: number; u: number } {
  let parts = F.p0;
  for (const c of F.changes) {
    if (t < c.at) break;
    if (t < c.at + c.d) return { from: parts, to: c.to, u: (t - c.at) / c.d };
    parts = c.to;
  }
  return { from: parts, to: parts, u: 1 };
}

function gridShape(n: number): [number, number] {
  let rows = Math.floor(Math.sqrt(n));
  while (n % rows) rows--;
  return [rows, n / rows];
}

function drawFraction(F: Fraction, t: number, ink: string): Glyph[] {
  const { from, to, u } = partsAt(F, t);
  const f = F.s0 / F.p0;
  const out: Glyph[] = [];
  const { w, h, col } = F;
  const edge = withAlpha(ink, 0.9);
  // Dividers: old ones stay, new ones grow in, ones going away fade.
  const dividers = (n: number) => Array.from({ length: n - 1 }, (_, k) => (k + 1) / n);
  const has = (list: number[], v: number) => list.some((x) => Math.abs(x - v) < 1e-9);
  const oldD = dividers(from), newD = dividers(to);
  const all = [...oldD, ...newD.filter((v) => !has(oldD, v))];
  const grow = (v: number) => (has(oldD, v) && has(newD, v) ? 1 : has(newD, v) ? ease('smooth', u) : 1 - ease('smooth', u));
  if (F.as === 'bar') {
    out.push(fillGlyph([{ closed: true, pts: [[-w / 2, -h / 2], [-w / 2 + w * f, -h / 2], [-w / 2 + w * f, h / 2], [-w / 2, h / 2]] }], 'shade', { color: col }));
    for (const v of all) { const g = grow(v); if (g > 0.01) out.push(strokeGlyph([{ closed: false, pts: [[-w / 2 + w * v, h / 2], [-w / 2 + w * v, h / 2 - h * (has(newD, v) && !has(oldD, v) ? g : 1)]] }], 2.5, 'cut', { color: withAlpha(ink, has(newD, v) || has(oldD, v) && !has(newD, v) ? (has(newD, v) ? 0.9 : 0.9 * g) : 0.9) })); }
    out.push(strokeGlyph([{ closed: true, pts: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] }], 3.5, 'edge', { color: edge }));
  } else if (F.as === 'pie') {
    const r = h / 2;
    if (f > 0) out.push(fillGlyph([{ closed: true, pts: [[0, 0], ...circlePts([0, 0], r, r, Math.PI / 2, Math.PI / 2 - 2 * Math.PI * f, 60)] }], 'shade', { color: col }));
    for (const v of [0, ...all]) {
      const g = v === 0 ? 1 : grow(v);
      if (g <= 0.01) continue;
      const a = Math.PI / 2 - 2 * Math.PI * v;
      const growing = v !== 0 && has(newD, v) && !has(oldD, v);
      out.push(strokeGlyph([{ closed: false, pts: [[0, 0], [r * (growing ? g : 1) * Math.cos(a), r * (growing ? g : 1) * Math.sin(a)]] }], 2.5, 'cut', { color: withAlpha(ink, growing ? 0.9 : 0.9 * (v === 0 ? 1 : g)) }));
    }
    out.push(strokeGlyph([circle([0, 0], r)], 3.5, 'edge', { color: edge }));
  } else if (F.as === 'grid') {
    const n = u < 0.5 ? from : to;
    const [rows, cols] = gridShape(n);
    const cw = w / cols, ch = h / rows;
    const shaded = Math.round(f * n);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const box = roundedRect(-w / 2 + c * cw + 0.03, h / 2 - (r + 1) * ch + 0.03, -w / 2 + (c + 1) * cw - 0.03, h / 2 - r * ch - 0.03, 0.04);
      if (i < shaded) out.push(fillGlyph([box], 'shade', { color: col }));
      out.push(strokeGlyph([box], 2, 'cell', { color: withAlpha(ink, 0.8) }));
    }
  } else {
    out.push(strokeGlyph([{ closed: false, pts: [[-w / 2, 0], [w / 2, 0]] }], 3, 'line', { color: ink }));
    out.push(strokeGlyph([{ closed: false, pts: [[-w / 2, 0], [-w / 2 + w * f, 0]] }], 9, 'shade', { color: col }));
    for (const v of [0, 1, ...all]) {
      const g = v === 0 || v === 1 ? 1 : grow(v);
      if (g > 0.01) out.push(strokeGlyph([{ closed: false, pts: [[-w / 2 + w * v, -0.14 * g], [-w / 2 + w * v, 0.14 * g]] }], 2.5, 'tick', { color: withAlpha(ink, g) }));
    }
    out.push(...numberGlyphs('0', [-w / 2, -0.3], 'below', 0.3, ink, ''), ...numberGlyphs('1', [w / 2, -0.3], 'below', 0.3, ink, ''));
    out.push(disc([-w / 2 + w * f, 0], 0.11, col));
  }
  return out;
}

registerAction('fraction', {
  summary: 'A fraction as a bar, a pie, a grid or on a line, with some parts shaded.',
  worlds: COUNTING,
  params: ['as', 'parts', 'shade', 'label', 'color', 'size', 'position', 'appear'],
  required: ['parts'],
  build(ctx) {
    const { world, spec } = ctx;
    if (typeof spec.parts !== 'number' || spec.parts < 1 || spec.parts > 100 || !Number.isInteger(spec.parts)) throw new ScriptError('must be a whole number from 1 to 100.', `${ctx.where}.parts`);
    const shade = spec.shade === undefined ? 0 : spec.shade;
    if (typeof shade !== 'number' || shade < 0 || shade > spec.parts || !Number.isInteger(shade)) throw new ScriptError(`must be a whole number from 0 to ${spec.parts}.`, `${ctx.where}.shade`);
    const as = choice(spec.as, ['bar', 'pie', 'grid', 'line'] as const, `${ctx.where}.as`, 'bar');
    const k = sizeOf(spec.size, { small: 0.6, medium: 1, large: 1.35, huge: 1.8 }, `${ctx.where}.size`, 'medium');
    const F: Fraction = { as, p0: spec.parts, s0: shade, changes: [], w: (as === 'pie' ? 3 : as === 'grid' ? 3 : 6) * k, h: (as === 'bar' ? 1 : 3) * k, col: color(ctx, 'color', world.theme.colors[0])! };
    if (as === 'grid') { const [rows, cols] = gridShape(spec.parts); F.h = (F.w * rows) / cols; }
    const id = str(ctx, 'id') ?? world.newId('fraction');
    const ink = world.theme.ink;
    const th = liveThing(ctx, id, (t) => drawFraction(F, t, ink), ctx.where);
    const c = centerOf(ctx);
    th.base.x = th.build.x = c[0];
    th.base.y = th.build.y = c[1];
    FRACTIONS.set(th, F);
    const { how } = readAppear(ctx, 'draw');
    const d = natural(ctx, 1.2);
    arrive(ctx, th, how, ctx.start, d);
    if (spec.label === true) {
      const lab = liveThing(ctx, `${id}.label`, (t) => {
        const { from, to, u } = partsAt(F, t);
        const n = u < 0.5 ? from : to;
        return numberGlyphs(`\\frac{${Math.round((F.s0 / F.p0) * n * 1e6) / 1e6}}{${n}}`, [0, 0], 'center', 0.55, ink, '');
      }, ctx.where, 'math');
      lab.base.x = lab.build.x = c[0] + (as === 'line' ? F.w / 2 + 0.8 : F.w / 2 + 0.75);
      lab.base.y = lab.build.y = c[1];
      lab.parent = th;
      lab.base.x = lab.build.x = (as === 'line' ? F.w / 2 + 0.8 : F.w / 2 + 0.75);
      lab.base.y = lab.build.y = 0;
      lab.base.visible = true;
      th.members = [lab];
    }
    return { end: ctx.start + d, thing: th };
  },
}, ['fraction_bar', 'pie']);

function fractionChange(ctx: Ctx, split: boolean): Done {
  const th = ctx.world.get(ctx.spec.who, `${ctx.where}.who`);
  const F = FRACTIONS.get(th);
  if (!F) throw new ScriptError('must name a fraction made with "fraction".', `${ctx.where}.who`);
  const now = partsAt(F, Infinity).to;
  const into = ctx.spec.into;
  if (typeof into !== 'number' || !Number.isInteger(into) || into < 1) throw new ScriptError('must be a whole number of parts.', `${ctx.where}.into`);
  if (split && into % now) throw new ScriptError(`must be a multiple of the ${now} parts there are now, so every part is cut the same way.`, `${ctx.where}.into`);
  if (!split && now % into) throw new ScriptError(`must divide the ${now} parts there are now.`, `${ctx.where}.into`);
  const f = F.s0 / F.p0;
  if (Math.abs(f * into - Math.round(f * into)) > 1e-9) throw new ScriptError(`the shaded part (${F.s0}/${F.p0}) cannot be made of whole parts out of ${into}.`, `${ctx.where}.into`);
  const d = natural(ctx, 1.5);
  F.changes.push({ at: ctx.start, d, to: into });
  ctx.sound(split ? 'click' : 'pop', ctx.start + d * 0.7);
  return { end: ctx.start + d, thing: th };
}

registerAction('split', {
  summary: 'Cut every part of a fraction into smaller equal parts (3/4 becomes 6/8).',
  worlds: COUNTING,
  params: ['who', 'into'],
  required: ['who', 'into'],
  build: (ctx) => fractionChange(ctx, true),
}, ['cut_parts']);

registerAction('combine', {
  summary: 'Join a fraction\'s parts into fewer, larger parts (6/8 becomes 3/4).',
  worlds: COUNTING,
  params: ['who', 'into'],
  required: ['who', 'into'],
  build: (ctx) => fractionChange(ctx, false),
}, ['join_parts']);

registerAction('line_up', {
  summary: 'Line fractions up one above the other, the same length, to compare them.',
  worlds: COUNTING,
  params: ['who', 'gap'],
  required: ['who'],
  build(ctx) {
    const { world } = ctx;
    const list = things(ctx).filter((t) => FRACTIONS.has(t));
    if (list.length < 2) throw new ScriptError('needs two or more fractions.', `${ctx.where}.who`);
    const d = natural(ctx, 1.2);
    const W = Math.max(...list.map((t) => FRACTIONS.get(t)!.w * t.build.scale));
    const heights = list.map((t) => FRACTIONS.get(t)!.h * (W / FRACTIONS.get(t)!.w));
    const gap = num(ctx, 'gap', 0.6);
    const total = heights.reduce((a, b) => a + b, 0) + gap * (list.length - 1);
    let y = total / 2;
    list.forEach((t, i) => {
      const F = FRACTIONS.get(t)!;
      const k = W / F.w;
      y -= heights[i] / 2;
      const to: Pt = [0, y];
      const s0 = t.build.scale;
      const dx = to[0] - t.build.x, dy = to[1] - t.build.y;
      ctx.act({ start: ctx.start, duration: d, apply(u) { const e = ease('smooth', u); t.state.x += dx * e; t.state.y += dy * e; t.state.scale *= 1 + (k / s0 - 1) * e; } });
      t.build.x = to[0]; t.build.y = to[1]; t.build.scale = k;
      y -= heights[i] / 2 + gap;
    });
    void world;
    return { end: ctx.start + d };
  },
}, ['compare_fractions']);

// ---- Chance ----

/** Small bars counting each outcome so far. */
function tallyGlyphs(outcomes: string[], counts: number[], at: Pt, ink: string, colors: string[]): Glyph[] {
  const out: Glyph[] = [];
  const max = Math.max(1, ...counts);
  const total = counts.reduce((a, b) => a + b, 0);
  const rowH = Math.min(0.42, 3.2 / outcomes.length);
  outcomes.forEach((o, i) => {
    const y = at[1] - i * rowH;
    out.push(...numberGlyphs(word(o), [at[0] - 0.15, y], 'left', rowH * 0.65, ink, ''));
    const len = (2.6 * counts[i]) / max;
    if (counts[i]) out.push(fillGlyph([roundedRect(at[0], y - rowH * 0.32, at[0] + len, y + rowH * 0.32, 0.04)], 'bar', { color: colors[i % colors.length] }));
    out.push(...numberGlyphs(String(counts[i]), [at[0] + len + 0.12, y], 'right', rowH * 0.6, withAlpha(ink, 0.8), ''));
  });
  out.push(...numberGlyphs(`\\text{${total} in all}`, [at[0] + 1.2, at[1] - outcomes.length * rowH - 0.05], 'below', 0.26, withAlpha(ink, 0.7), ''));
  return out;
}

interface Throws { at: number[]; per: number; end: number }
function throwTimes(ctx: Ctx, n: number, fallbackLag: number): Throws {
  const lag = num(ctx, 'lag', n > 12 ? Math.max(0.08, 6 / n) : fallbackLag);
  const per = Math.min(lag * 0.9, ctx.spec.random !== undefined && n > 12 ? 0.3 : 1.1);
  const at = Array.from({ length: n }, (_, i) => ctx.start + i * lag);
  return { at, per, end: at[n - 1] + per };
}

/** Which throw is happening at time t, and how far through it. */
function current(T: Throws, t: number): { i: number; u: number } {
  let i = -1;
  for (let k = 0; k < T.at.length; k++) if (t >= T.at[k]) i = k;
  if (t === Infinity) return { i: T.at.length - 1, u: 1 };
  return { i, u: i < 0 ? 0 : clamp((t - T.at[i]) / T.per) };
}

function readThrows<T>(ctx: Ctx, key: string, random: (r: () => number) => T, valid: (v: unknown) => T | undefined, what: string): T[] {
  const { spec } = ctx;
  if (typeof spec.random === 'number') {
    if (spec.random < 1 || spec.random > 500) throw new ScriptError('must be from 1 to 500 throws.', `${ctx.where}.random`);
    const r = rng(hashString(`${ctx.where}|${spec.seed ?? ''}`));
    return Array.from({ length: Math.round(spec.random) }, () => random(r));
  }
  const list = spec[key];
  if (!Array.isArray(list) || !list.length) throw new ScriptError(`needs "${key}" (a list of ${what}) or "random": a number of throws.`, `${ctx.where}.${key}`);
  return list.map((v, i) => {
    const ok = valid(v);
    if (ok === undefined) throw new ScriptError(`must be ${what}.`, `${ctx.where}.${key}[${i}]`);
    return ok;
  });
}

registerAction('coin', {
  summary: 'A coin flips and lands on the results given (or seeded random ones).',
  worlds: COUNTING,
  params: ['results', 'random', 'seed', 'lag', 'tally', 'position', 'size'],
  build(ctx) {
    const { world, spec } = ctx;
    const res = readThrows(ctx, 'results', (r) => (r() < 0.5 ? 'H' : 'T'), (v) => { const s = String(v).toUpperCase(); return s === 'H' || s === 'HEADS' ? 'H' : s === 'T' || s === 'TAILS' ? 'T' : undefined; }, '"H" or "T"');
    const R = sizeOf(spec.size, { small: 0.45, medium: 0.7, large: 1, huge: 1.4 }, `${ctx.where}.size`, 'medium');
    const T = throwTimes(ctx, res.length, 1.2);
    const gold = world.theme.shades.gold ?? '#f0ac5f';
    const ink = world.theme.ink;
    const c = centerOf(ctx, [spec.tally === true || spec.random !== undefined ? -3 : 0, 0.6]);
    const face = (s: string) => [disc([0, 0], R, gold), strokeGlyph([circle([0, 0], R * 0.8)], 2.5, 'rim', { color: withAlpha('#000000', 0.3) }), ...numberGlyphs(`\\text{${s}}`, [0, 0], 'center', R * 0.9, '#3a2a10', '')];
    const id = str(ctx, 'id') ?? world.newId('coin');
    const coin = liveThing(ctx, id, (t) => {
      const { i, u } = current(T, t);
      const result = i < 0 ? res[0] : res[i];
      const shadow = (lift: number) => (world.things.has('_table') ? [fillGlyph([{ closed: true, pts: circlePts([c[0], c[1] - R - 0.12], R * (1 - lift * 0.3), R * 0.18, 0, Math.PI * 2, 30).slice(0, -1) }], 'shadow', { color: withAlpha('#000000', 0.3 - lift * 0.15) })] : []);
      if (i < 0 || u >= 1) return [...shadow(0), ...shift(face(result), c[0], c[1])];
      // Turning over and over in the air, landing on its result.
      const turns = 5;
      const a = Math.PI * turns * ease('out', u);
      const showing = Math.floor(a / Math.PI + 0.5) % 2 === 0 ? (result === 'H' ? 'T' : 'H') : result;
      const k = Math.max(0.04, Math.abs(Math.cos(a)));
      const hop = 1.4 * R * 4 * u * (1 - u);
      return [...shadow(clamp(hop / (1.4 * R))), ...shift(squash(face(u > 0.97 ? result : showing), 0, k), c[0], c[1] + hop)];
    }, ctx.where);
    arrive(ctx, coin, 'pop', ctx.start - 0.3, 0.3);
    T.at.forEach((a) => { ctx.sound('whoosh', a); ctx.sound('tick', a + T.per); });
    const row = liveThing(ctx, `${id}.results`, (t) => {
      const { i, u } = current(T, t);
      const done = u >= 1 ? i + 1 : i;
      const shown = res.slice(Math.max(0, done - 14), done);
      return shown.length ? numberGlyphs(`\\text{${shown.join('  ')}}`, [c[0], c[1] - R - 0.45], 'below', 0.36, ink, '') : [];
    }, ctx.where, 'math');
    row.base.visible = true;
    if (spec.tally === true || spec.random !== undefined) {
      const tally = liveThing(ctx, `${id}.tally`, (t) => {
        const { i, u } = current(T, t);
        const done = res.slice(0, u >= 1 ? i + 1 : Math.max(0, i));
        return tallyGlyphs(['H', 'T'], [done.filter((x) => x === 'H').length, done.filter((x) => x === 'T').length], [c[0] + 3.2, c[1] + 0.4], ink, [gold, world.theme.colors[0]]);
      }, ctx.where, 'math');
      tally.base.visible = true;
    }
    return { end: T.end, thing: coin };
  },
}, ['flip', 'coins']);

const PIPS: Record<number, Pt[]> = {
  1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]], 4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
  5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]], 6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]],
};

function dieGlyphs(v: number, s: number, body: string, pip: string): Glyph[] {
  return [
    fillGlyph([roundedRect(-s / 2, -s / 2, s / 2, s / 2, s * 0.16)], 'die', { color: body }),
    strokeGlyph([roundedRect(-s / 2, -s / 2, s / 2, s / 2, s * 0.16)], 2, 'edge', { color: withAlpha('#000000', 0.3) }),
    fillGlyph(PIPS[v].map(([x, y]) => circle([x * s * 0.27, y * s * 0.27], s * 0.085)), 'pips', { color: pip }),
  ];
}

registerAction('dice', {
  summary: 'Dice roll and settle on the results given (or seeded random ones).',
  worlds: COUNTING,
  params: ['count', 'results', 'random', 'seed', 'lag', 'tally', 'position', 'size', 'total'],
  build(ctx) {
    const { world, spec } = ctx;
    const count = typeof spec.count === 'number' ? Math.round(spec.count) : 1;
    if (count < 1 || count > 4) throw new ScriptError('must be from 1 to 4 dice.', `${ctx.where}.count`);
    const face = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6 ? v : undefined);
    const res = readThrows<number[]>(ctx, 'results', (r) => Array.from({ length: count }, () => 1 + Math.floor(r() * 6)), (v) => {
      const list = Array.isArray(v) ? v : [v];
      if (list.length !== count) return undefined;
      const out = list.map(face);
      return out.every((x) => x !== undefined) ? (out as number[]) : undefined;
    }, count === 1 ? 'a number from 1 to 6' : `a list of ${count} numbers from 1 to 6`);
    const s = sizeOf(spec.size, { small: 0.7, medium: 1, large: 1.4, huge: 1.9 }, `${ctx.where}.size`, 'medium');
    const T = throwTimes(ctx, res.length, 1.4);
    const ink = world.theme.ink;
    const useTally = spec.tally === true || spec.random !== undefined;
    const c = centerOf(ctx, [useTally ? -3.2 : 0, 0.6]);
    const body = '#f6f3ea', pip = '#1d1d1d';
    const id = str(ctx, 'id') ?? world.newId('dice');
    const flicker = rng(hashString(ctx.where));
    const noise = Array.from({ length: 4000 }, () => 1 + Math.floor(flicker() * 6));
    const gap = s * 0.4;
    const xs = Array.from({ length: count }, (_, k) => c[0] + (k - (count - 1) / 2) * (s + gap));
    const dice = liveThing(ctx, id, (t) => {
      const { i, u } = current(T, t);
      const out: Glyph[] = [];
      if (world.things.has('_table')) for (let k = 0; k < count; k++) out.push(fillGlyph([{ closed: true, pts: circlePts([xs[k] + s * 0.08, c[1] - s / 2 - 0.06], s * 0.55, s * 0.12, 0, Math.PI * 2, 30).slice(0, -1) }], 'shadow', { color: withAlpha('#000000', 0.3) }));
      for (let k = 0; k < count; k++) {
        const final = i < 0 ? res[0][k] : res[i][k];
        if (i < 0 || u >= 1) { out.push(...shift(dieGlyphs(final, s, body, pip), xs[k], c[1])); continue; }
        // Tumbling: turning, faces changing, slowing to a stop.
        const e = ease('out', u);
        const step = Math.floor(e * 14);
        const v = u > 0.85 ? final : noise[(i * 31 + k * 7 + step) % noise.length];
        const a = (1 - e) * 5 * (k % 2 ? -1 : 1);
        const hop = s * 0.9 * Math.abs(Math.sin(Math.PI * 2.5 * e)) * (1 - e);
        out.push(...turn(shift(dieGlyphs(v, s, body, pip), xs[k], c[1] + hop), [xs[k], c[1] + hop], a));
      }
      if (count > 1 && spec.total !== false && (u >= 1 || i < 0)) {
        const sum = (i < 0 ? res[0] : res[i]).reduce((p, q) => p + q, 0);
        if (i >= 0) out.push(...numberGlyphs(`\\text{total } ${sum}`, [c[0], c[1] - s / 2 - 0.35], 'below', 0.38, ink, ''));
      }
      return out;
    }, ctx.where);
    arrive(ctx, dice, 'pop', ctx.start - 0.3, 0.3);
    T.at.forEach((a) => { ctx.sound('whoosh', a); ctx.sound('click', a + T.per * 0.6); ctx.sound('tick', a + T.per); });
    if (useTally) {
      const lo = count, hi = count * 6;
      const outcomes = Array.from({ length: hi - lo + 1 }, (_, k) => String(lo + k));
      const tally = liveThing(ctx, `${id}.tally`, (t) => {
        const { i, u } = current(T, t);
        const done = res.slice(0, u >= 1 ? i + 1 : Math.max(0, i));
        const counts = outcomes.map((o) => done.filter((r) => r.reduce((p, q) => p + q, 0) === Number(o)).length);
        return tallyGlyphs(outcomes, counts, [c[0] + 4.2, c[1] + 1.6], ink, world.theme.colors);
      }, ctx.where, 'math');
      tally.base.visible = true;
    }
    return { end: T.end, thing: dice };
  },
}, ['die', 'roll']);

registerAction('spinner', {
  summary: 'A spinner spins, slows and stops on the part given.',
  worlds: COUNTING,
  params: ['parts', 'result', 'results', 'random', 'seed', 'lag', 'tally', 'position', 'size'],
  required: ['parts'],
  build(ctx) {
    const { world, spec } = ctx;
    if (!Array.isArray(spec.parts) || spec.parts.length < 2 || spec.parts.length > 12) throw new ScriptError('must be a list of 2 to 12 parts (colours, or { "label", "color" }).', `${ctx.where}.parts`);
    const parts = spec.parts.map((p, i) => {
      const o: Record<string, unknown> = isObject(p) ? p : { color: p };
      const col = o.color !== undefined ? color({ ...ctx, spec: { c: o.color } }, 'c')! : world.theme.colors[i % world.theme.colors.length];
      return { label: typeof o.label === 'string' ? o.label : '', col, name: typeof o.label === 'string' ? o.label : String(o.color ?? i + 1) };
    });
    const n = parts.length;
    const pick = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= n ? v - 1 : undefined);
    const res = spec.result !== undefined && spec.results === undefined && spec.random === undefined
      ? [(() => { const p = pick(spec.result); if (p === undefined) throw new ScriptError(`must be a part number from 1 to ${n}.`, `${ctx.where}.result`); return p; })()]
      : readThrows(ctx, 'results', (r) => Math.floor(r() * n), pick, `a part number from 1 to ${n}`);
    const R = sizeOf(spec.size, { small: 1, medium: 1.5, large: 2, huge: 2.8 }, `${ctx.where}.size`, 'medium');
    const T = throwTimes(ctx, res.length, 2.6);
    T.per = Math.min(T.per * 2, num(ctx, 'lag', 2.6) * 0.9);
    if (res.length === 1) T.per = ctx.duration ?? 2.4;
    T.end = T.at[T.at.length - 1] + T.per;
    const useTally = spec.tally === true || spec.random !== undefined;
    const c = centerOf(ctx, [useTally ? -3 : 0, 0.3]);
    const ink = world.theme.ink;
    const jitter = rng(hashString(ctx.where + 'spin'));
    // The disc's turn after each spin: whole turns plus the chosen part under the pointer.
    const angles: number[] = [];
    let a = 0;
    for (const r of res) {
      const want = 2 * Math.PI * ((r + 0.2 + 0.6 * jitter()) / n);
      const base = a - (a % (2 * Math.PI));
      a = base + 2 * Math.PI * (3 + Math.floor(jitter() * 2)) + want;
      angles.push(a);
    }
    const id = str(ctx, 'id') ?? world.newId('spinner');
    const th = liveThing(ctx, id, (t) => {
      const { i, u } = current(T, t);
      const from = i <= 0 ? 0 : angles[i - 1];
      const rot = i < 0 ? 0 : from + (angles[i] - from) * (1 - (1 - u) ** 3);
      const out: Glyph[] = [];
      for (let k = 0; k < n; k++) {
        // Parts go clockwise from the top; turning the disc by rot brings part k under the pointer.
        const a0 = Math.PI / 2 - (2 * Math.PI * k) / n + rot, a1 = Math.PI / 2 - (2 * Math.PI * (k + 1)) / n + rot;
        out.push(fillGlyph([{ closed: true, pts: [c, ...circlePts(c, R, R, a0, a1, 30)] }], 'part', { color: parts[k].col }));
        if (parts[k].label) { const am = (a0 + a1) / 2; out.push(...numberGlyphs(word(parts[k].label), [c[0] + R * 0.62 * Math.cos(am), c[1] + R * 0.62 * Math.sin(am)], 'center', R * 0.2, '#1d1d1d', '')); }
      }
      out.push(strokeGlyph([circle(c, R)], 3.5, 'rim', { color: ink }), disc(c, R * 0.07, ink, 'hub'));
      out.push(fillGlyph([{ closed: true, pts: [[c[0] - R * 0.12, c[1] + R + 0.32], [c[0] + R * 0.12, c[1] + R + 0.32], [c[0], c[1] + R - 0.12]] }], 'pointer', { color: ink }));
      return out;
    }, ctx.where);
    arrive(ctx, th, 'pop', ctx.start - 0.4, 0.4);
    T.at.forEach((t0) => { for (let k = 0; k < 8; k++) ctx.sound('tick', t0 + T.per * (1 - (1 - k / 8) ** 0.5) * 0.95); ctx.sound('chime', t0 + T.per); });
    if (useTally) {
      const tally = liveThing(ctx, `${id}.tally`, (t) => {
        const { i, u } = current(T, t);
        const done = res.slice(0, u >= 1 ? i + 1 : Math.max(0, i));
        return tallyGlyphs(parts.map((p) => p.name), parts.map((_, k) => done.filter((r) => r === k).length), [c[0] + R + 2, c[1] + 1.2], ink, parts.map((p) => p.col));
      }, ctx.where, 'math');
      tally.base.visible = true;
    }
    return { end: T.end, thing: th };
  },
}, ['spin', 'wheel']);

const SUITS: Record<string, { tex: string; red: boolean }> = {
  '♠': { tex: '\\spadesuit', red: false }, S: { tex: '\\spadesuit', red: false },
  '♥': { tex: '\\heartsuit', red: true }, H: { tex: '\\heartsuit', red: true },
  '♦': { tex: '\\diamondsuit', red: true }, D: { tex: '\\diamondsuit', red: true },
  '♣': { tex: '\\clubsuit', red: false }, C: { tex: '\\clubsuit', red: false },
};

registerAction('cards', {
  summary: 'Playing cards turn over one by one: "A♠", "10♥", "KD".',
  worlds: COUNTING,
  params: ['results', 'lag', 'position', 'size'],
  required: ['results'],
  build(ctx) {
    const { world, spec } = ctx;
    if (!Array.isArray(spec.results) || !spec.results.length || spec.results.length > 10) throw new ScriptError('must be a list of 1 to 10 cards, such as "A♠" or "10H".', `${ctx.where}.results`);
    const cards = spec.results.map((v, i) => {
      const m = String(v).trim().match(/^(A|K|Q|J|10|[2-9])\s*([♠♥♦♣SHDC])$/i);
      if (!m) throw new ScriptError('must be a rank (A, 2 to 10, J, Q, K) and a suit (♠ ♥ ♦ ♣ or S H D C), such as "A♠" or "10H".', `${ctx.where}.results[${i}]`);
      return { rank: m[1].toUpperCase(), suit: SUITS[m[2].toUpperCase()] ?? SUITS[m[2]] };
    });
    const h = sizeOf(spec.size, { small: 1.3, medium: 1.9, large: 2.5, huge: 3.2 }, `${ctx.where}.size`, 'medium');
    const w = h * 0.7;
    const c = centerOf(ctx, [0, 0.4]);
    const lag = num(ctx, 'lag', 0.7);
    const flip = 0.5;
    const gap = w * 0.25;
    const back = world.theme.colors[0];
    const id = str(ctx, 'id') ?? world.newId('cards');
    const items: Thing[] = [];
    cards.forEach((card, k) => {
      const x = c[0] + (k - (cards.length - 1) / 2) * (w + gap);
      const at = ctx.start + 0.3 + k * lag;
      const ink = card.suit.red ? '#d03a3a' : '#1d1d1d';
      const faceG = [
        fillGlyph([roundedRect(-w / 2, -h / 2, w / 2, h / 2, w * 0.08)], 'card', { color: '#fbfaf6' }),
        strokeGlyph([roundedRect(-w / 2, -h / 2, w / 2, h / 2, w * 0.08)], 2, 'edge', { color: withAlpha('#000000', 0.3) }),
        ...numberGlyphs(`\\text{${card.rank}}`, [-w / 2 + w * 0.1, h / 2 - h * 0.08], 'right', h * 0.13, ink, '').map((g) => ({ ...g })),
        ...numberGlyphs(card.suit.tex, [0, 0], 'center', h * 0.32, ink, ''),
      ];
      const backG = [
        fillGlyph([roundedRect(-w / 2, -h / 2, w / 2, h / 2, w * 0.08)], 'card', { color: back }),
        strokeGlyph([roundedRect(-w / 2 + w * 0.1, -h / 2 + w * 0.1, w / 2 - w * 0.1, h / 2 - w * 0.1, w * 0.05)], 2, 'pattern', { color: withAlpha('#ffffff', 0.6) }),
      ];
      const th = liveThing(ctx, `${id}.${k + 1}`, (t) => {
        const u = t === Infinity ? 1 : clamp((t - at) / flip);
        const a = Math.PI * ease('smooth', u);
        return squash(a < Math.PI / 2 ? backG : faceG, 0, Math.max(0.03, Math.abs(Math.cos(a))));
      }, ctx.where);
      th.base.x = th.build.x = x;
      th.base.y = th.build.y = c[1];
      arrive(ctx, th, 'rise', ctx.start + k * 0.08, 0.3);
      ctx.sound('click', at + flip / 2);
      items.push(th);
    });
    const group = new Thing(id, 'group', [], [0, 0]);
    group.members = items;
    world.add(group, ctx.where);
    return { end: ctx.start + 0.3 + (cards.length - 1) * lag + flip, thing: group };
  },
}, ['card_draw', 'deal']);

// ---- Probability trees ----

registerAction('tree', {
  summary: 'A probability tree that grows level by level or path by path.',
  worlds: COUNTING,
  params: ['levels', 'grow', 'outcomes', 'position', 'width', 'height', 'lag', 'color'],
  required: ['levels'],
  build(ctx) {
    const { world, spec } = ctx;
    if (!Array.isArray(spec.levels) || !spec.levels.length || spec.levels.length > 4) throw new ScriptError('must be a list of 1 to 4 levels, each a list of branches.', `${ctx.where}.levels`);
    const levels = spec.levels.map((lv, i) => {
      if (!Array.isArray(lv) || lv.length < 2 || lv.length > 6) throw new ScriptError('must be a list of 2 to 6 branches: { "label", "p" }.', `${ctx.where}.levels[${i}]`);
      return lv.map((b, j) => {
        if (!isObject(b) || b.label === undefined) throw new ScriptError('must be { "label": ..., "p": ... }.', `${ctx.where}.levels[${i}][${j}]`);
        return { label: String(b.label), p: b.p === undefined ? undefined : String(b.p) };
      });
    });
    const grow = choice(spec.grow, ['level', 'path', 'all'] as const, `${ctx.where}.grow`, 'level');
    const id = str(ctx, 'id') ?? world.newId('tree');
    const W = num(ctx, 'width', 9), H = num(ctx, 'height', 6.4);
    const c = centerOf(ctx, [-0.6, 0]);
    const ink = world.theme.ink;
    const col = color(ctx, 'color', ink)!;
    const leaves = levels.reduce((a, l) => a * l.length, 1);
    const dx = W / levels.length;
    const x0 = c[0] - W / 2;
    // Every node, by its path ("HT"); leaves spread evenly down.
    interface Node { path: string[]; at: Pt; level: number; p?: string }
    const nodes: Node[] = [];
    const place = (path: string[], level: number, lo: number, hi: number, p?: string) => {
      const y = c[1] + H / 2 - ((lo + hi) / 2 / leaves) * H;
      nodes.push({ path, at: [x0 + level * dx, y], level, p });
      if (level === levels.length) return;
      const kids = levels[level];
      const span = (hi - lo) / kids.length;
      kids.forEach((b, k) => place([...path, b.label], level + 1, lo + k * span, lo + (k + 1) * span, b.p));
    };
    place([], 0, 0, leaves);
    const key = (p: string[]) => p.join('');
    const byKey = new Map(nodes.map((n) => [key(n.path), n]));
    const edges = new Map<string, Thing>();
    const lag = num(ctx, 'lag', grow === 'path' ? 0.5 : 0.8);
    const draw = 0.5;
    let last = ctx.start;
    const edgeTime = new Map<string, number>();
    if (grow === 'path') {
      let k = 0;
      for (const leaf of nodes.filter((n) => n.level === levels.length)) {
        for (let l = 1; l <= leaf.path.length; l++) {
          const kk = key(leaf.path.slice(0, l));
          if (!edgeTime.has(kk)) edgeTime.set(kk, ctx.start + k * lag + (l - 1) * draw * 0.8);
        }
        k++;
      }
    } else for (const n of nodes) if (n.level > 0) edgeTime.set(key(n.path), grow === 'all' ? ctx.start : ctx.start + (n.level - 1) * lag);
    for (const n of nodes) {
      if (n.level === 0) continue;
      const parent = byKey.get(key(n.path.slice(0, -1)))!;
      const from: Pt = [parent.at[0] + (parent.level ? 0.3 : 0.05), parent.at[1]], to: Pt = [n.at[0] - 0.3, n.at[1]];
      const glyphs: Glyph[] = [strokeGlyph([{ closed: false, pts: [from, to] }], 3, 'branch')];
      const mid: Pt = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      const up = to[1] >= from[1];
      if (n.p) glyphs.push(...numberGlyphs(fracTex(n.p), [mid[0] - 0.08, mid[1] + (up ? 0.12 : -0.12)], up ? 'above' : 'below', 0.3, world.theme.accent, ''));
      glyphs.push(...numberGlyphs(word(n.path[n.path.length - 1]), [n.at[0], n.at[1]], 'center', 0.38, ink, '').map((g) => ({ ...g, color: undefined })));
      const e = new Thing(`${id}.branch.${key(n.path)}`, 'shape', glyphs, [0, 0]);
      e.base.color = col;
      world.add(e, ctx.where);
      const t0 = edgeTime.get(key(n.path))!;
      arrive(ctx, e, 'draw', t0, draw);
      last = Math.max(last, t0 + draw);
      edges.set(key(n.path), e);
      if (n.level === levels.length && spec.outcomes === true) {
        const ps = levels.map((_, l) => byKey.get(key(n.path.slice(0, l + 1)))!.p);
        let tex = `\\text{${key(n.path)}}`;
        if (ps.every((p) => p !== undefined)) {
          try {
            const prod = evaluate(`fraction(${ps.map((p) => `(${p})`).join(' * ')})`) as { n: number; d: number; s: number };
            tex += prod.d === 1 ? `\\;\\; ${prod.s * prod.n}` : `\\;\\; \\tfrac{${prod.s * prod.n}}{${prod.d}}`;
          } catch { /* written without its chance */ }
        }
        const out = new Thing(`${id}.outcome.${key(n.path)}`, 'math', numberGlyphs(tex, [n.at[0] + 0.55, n.at[1]], 'right', 0.32, withAlpha(ink, 0.85), ''), [0, 0]);
        world.add(out, ctx.where);
        arrive(ctx, out, 'fade', t0 + draw, 0.4);
        last = Math.max(last, t0 + draw + 0.4);
      }
    }
    // A name for every path, holding the branches along it, for highlight.
    for (const n of nodes) {
      if (n.level === 0) continue;
      const g = new Thing(`${id}.${key(n.path)}`, 'group', [], [0, 0]);
      g.members = n.path.map((_, l) => edges.get(key(n.path.slice(0, l + 1)))!);
      if (!world.things.has(g.id)) world.add(g, ctx.where);
    }
    const root = new Thing(id, 'group', [], [0, 0]);
    root.members = [...edges.values()];
    world.add(root, ctx.where);
    ctx.sound('pen', ctx.start, last - ctx.start);
    return { end: last, thing: root };
  },
}, ['probability_tree']);

// ---- Grids of outcomes ----

registerAction('sample_space', {
  summary: 'A grid of every outcome of two things, with the cells of an event lit.',
  worlds: COUNTING,
  params: ['rows', 'columns', 'cell', 'light', 'count', 'position', 'size', 'lag', 'color'],
  required: ['rows', 'columns'],
  build(ctx) {
    const { world, spec } = ctx;
    const listOf = (k: string) => {
      const v = spec[k];
      if (typeof v === 'number' && v >= 1 && v <= 12) return Array.from({ length: v }, (_, i) => String(i + 1));
      if (Array.isArray(v) && v.length >= 1 && v.length <= 12) return v.map(String);
      throw new ScriptError('must be a list of 1 to 12 labels (or a number: 6 means 1 to 6).', `${ctx.where}.${k}`);
    };
    const rows = listOf('rows'), cols = listOf('columns');
    const val = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : s);
    const cellOf = (r: string, c: string): string => {
      if (typeof spec.cell !== 'string') return `${r},${c}`;
      try { const v = evaluate(spec.cell, { r: val(r), c: val(c) }); return typeof v === 'number' ? formatNumber(v, Number.isInteger(v) ? 0 : 2) : String(v); } catch (e) { throw new ScriptError(`could not be worked out: ${(e as Error).message}. Use r (the row's label) and c (the column's).`, `${ctx.where}.cell`); }
    };
    const lit = (r: string, c: string): boolean => {
      if (spec.light === undefined) return false;
      if (typeof spec.light !== 'string') throw new ScriptError('must be a rule in r and c, such as "r + c == 7".', `${ctx.where}.light`);
      try { return Boolean(evaluate(spec.light, { r: val(r), c: val(c) })); } catch (e) { throw new ScriptError(`could not be worked out: ${(e as Error).message}.`, `${ctx.where}.light`); }
    };
    const size = sizeOf(spec.size, { small: 0.45, medium: 0.6, large: 0.75, huge: 0.9 }, `${ctx.where}.size`, 'medium');
    const cw = size * (typeof spec.cell === 'string' ? 1.3 : 1.7), ch = size;
    const c0 = centerOf(ctx, [0, 0.2]);
    const W = cw * (cols.length + 1), H = ch * (rows.length + 1);
    const x0 = c0[0] - W / 2, y0 = c0[1] + H / 2;
    const ink = world.theme.ink, accent = color(ctx, 'color', world.theme.accent)!;
    const id = str(ctx, 'id') ?? world.newId('outcomes');
    const lag = num(ctx, 'lag', Math.min(0.3, 3 / rows.length));
    const ts = size * 0.45;
    const lines: Contour[] = [{ closed: false, pts: [[x0 + cw, y0], [x0 + cw, y0 - H]] }, { closed: false, pts: [[x0, y0 - ch], [x0 + W, y0 - ch]] }];
    const head: Glyph[] = [strokeGlyph(lines, 2.5, 'grid', { color: withAlpha(ink, 0.6) })];
    cols.forEach((cl, j) => head.push(...numberGlyphs(word(cl), [x0 + cw * (j + 1.5), y0 - ch / 2], 'center', ts, accent, '')));
    rows.forEach((rl, i) => head.push(...numberGlyphs(word(rl), [x0 + cw / 2, y0 - ch * (i + 1.5)], 'center', ts, accent, '')));
    const frame = new Thing(id, 'shape', head, [0, 0]);
    world.add(frame, ctx.where);
    arrive(ctx, frame, 'draw', ctx.start, 0.6);
    let litCount = 0;
    rows.forEach((rl, i) => {
      const glyphs: Glyph[] = [];
      cols.forEach((cl, j) => glyphs.push(...numberGlyphs(word(cellOf(rl, cl)), [x0 + cw * (j + 1.5), y0 - ch * (i + 1.5)], 'center', ts * 0.9, ink, '')));
      const row = new Thing(`${id}.row${i + 1}`, 'math', glyphs, [0, 0]);
      world.add(row, ctx.where);
      arrive(ctx, row, 'fade', ctx.start + 0.5 + i * lag, 0.3);
    });
    const lightAt = ctx.start + 0.6 + rows.length * lag;
    const backs: Glyph[] = [];
    rows.forEach((rl, i) => cols.forEach((cl, j) => {
      if (!lit(rl, cl)) return;
      litCount++;
      backs.push(fillGlyph([roundedRect(x0 + cw * (j + 1) + 0.04, y0 - ch * (i + 2) + 0.04, x0 + cw * (j + 2) - 0.04, y0 - ch * (i + 1) - 0.04, 0.06)], 'lit', { color: withAlpha(accent, 0.35) }));
    }));
    let end = lightAt;
    if (backs.length) {
      const light = new Thing(`${id}.lit`, 'decoration', backs, [0, 0]);
      light.layer = -1;
      world.add(light, ctx.where);
      arrive(ctx, light, 'fade', lightAt, 0.5);
      ctx.sound('chime', lightAt);
      end = lightAt + 0.5;
      if (spec.count !== false) {
        const total = rows.length * cols.length;
        const g = gcd(litCount, total);
        const note = new Thing(`${id}.count`, 'math', numberGlyphs(`\\text{${litCount} out of ${total}} = \\tfrac{${litCount / g}}{${total / g}}`, [c0[0], y0 - H - 0.3], 'below', 0.4, accent, ''), [0, 0]);
        world.add(note, ctx.where);
        arrive(ctx, note, 'rise', end, 0.5);
        end += 0.5;
      }
    }
    return { end, thing: frame };
  },
}, ['outcome_grid']);

// ---- The world itself ----

export function setupCountingWorld(ctx: Ctx, s: Record<string, unknown>, where: string) {
  const { world } = ctx;
  if (s.table === true) {
    const W = world.frameW, H = world.frameH;
    const top = new Thing('_table', 'decoration', [
      fillGlyph([roundedRect(-W, -H, W, 0.25, 0.3)], 'table', { color: withAlpha(world.theme.ink, 0.05) }),
      strokeGlyph([{ closed: false, pts: [[-W, 0.25], [W, 0.25]] }], 2, 'edge', { color: withAlpha(world.theme.ink, 0.12) }),
    ], [0, 0]);
    top.layer = -3;
    top.screen = true;
    top.base.visible = true;
    world.add(top, where);
  }
  if (s.number_line !== undefined && s.number_line !== false) {
    const spec = isObject(s.number_line) ? s.number_line : {};
    const th = makeNumberLine(ctx, spec, `${where}.number_line`);
    if (spec.appear === 'draw') arrive(ctx, th, 'draw', ctx.start, 1.2);
    else th.base.visible = true;
  }
}
