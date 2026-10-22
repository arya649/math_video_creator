// The geometry world: points, lines, circles and polygons that depend on
// each other; constructions (with compass steps), angles, marks,
// measurements, dragging, transformations, and cutting shapes into pieces.

import { type Ctx, type Done, arrive, color, num, readAppear, registerAction, str, natural } from '../actions';
import { type Contour, type Pt } from '../geom';
import {
  type GObj, type GVal, add, angleAt, centroid, circleThrough, clipHalf, cross, dot, foot, incircle, len, lerpPt, lineVal,
  meet, memo, mid, mul, norm, orthocenter, perp, pointAlong, reflectIn, rotateAbout, sub,
} from '../geometry/geo';
import { numberGlyphs } from '../graph/axes';
import { formatNumber } from '../graph/expr';
import { Param } from '../graph/param';
import { arrowHead, fillGlyph, strokeGlyph } from '../shapes';
import { type Glyph, Thing } from '../thing';
import { withAlpha } from '../color';
import { EASES, ScriptError, choice, clamp, didYouMean, ease, isObject } from '../util';
import type { SceneWorld } from '../world';
import { liveThing } from './graph';

const GEO: ['geometry'] = ['geometry'];
const FAR = 60;

// ---- Finding geometry by name ----

function fixed(id: string, p: Pt): GObj {
  const v: GVal = { k: 'point', p };
  return { id, at: () => v };
}

/** A geometry object named in a script: "A", "tri", "tri.B", "tri.AB", "c.center", or any position. */
function gref(ctx: Ctx, ref: unknown, where: string, want?: GVal['k']): GObj {
  const { world } = ctx;
  let g: GObj | undefined;
  if (typeof ref === 'string') {
    g = world.geo.get(ref);
    if (!g && ref.includes('.')) {
      const [head, spot] = ref.split('.');
      const base = world.geo.get(head);
      if (base) {
        const v = base.at(Infinity);
        if (v?.k === 'polygon') {
          const names = v.names;
          if (names.includes(spot)) {
            const i = names.indexOf(spot);
            g = memo(ref, (t) => { const pv = base.at(t); return pv?.k === 'polygon' ? { k: 'point', p: pv.pts[i] } : null; });
          } else {
            const pair = splitSide(spot, names);
            if (pair) {
              const [i, j] = pair;
              g = memo(ref, (t) => { const pv = base.at(t); return pv?.k === 'polygon' ? lineVal(pv.pts[i], pv.pts[j], 'segment') : null; });
            }
          }
        } else if (v?.k === 'circle' && spot === 'center') {
          g = memo(ref, (t) => { const cv = base.at(t); return cv?.k === 'circle' ? { k: 'point', p: cv.c } : null; });
        } else if (v?.k === 'line' && (spot === 'start' || spot === 'end' || spot === 'middle')) {
          g = memo(ref, (t) => { const lv = base.at(t); return lv?.k === 'line' ? { k: 'point', p: spot === 'start' ? lv.a : spot === 'end' ? lv.b : mid(lv.a, lv.b) } : null; });
        }
        if (!g) throw new ScriptError(`"${head}" has no corner, side or spot called "${spot}".`, where);
      }
    }
    if (!g && world.things.has(ref.split('.')[0]) && !want) g = fixed(ref, world.point(ref, where));
    if (!g && !world.things.has(ref.split('.')[0])) {
      const names = [...world.geo.keys()].filter((k) => !k.startsWith('_'));
      throw new ScriptError(`there is no point, line, circle or shape called "${ref}" yet.${didYouMean(ref, names)}${names.length ? ` So far: ${names.join(', ')}.` : ''}`, where);
    }
  } else {
    g = fixed('_at', world.point(ref, where));
  }
  if (!g) throw new ScriptError(`"${String(ref)}" is not geometry.`, where);
  const v = g.at(Infinity);
  if (want && v && v.k !== want && !(want === 'line' && v.k === 'line')) {
    throw new ScriptError(`"${String(ref)}" is a ${v.k}, but a ${want} is needed here.`, where);
  }
  return g;
}

/** "AB" from corner names ["A", "B", "C"] (names may be longer than one letter). */
function splitSide(spot: string, names: string[]): [number, number] | null {
  for (let i = 0; i < names.length; i++) {
    if (!spot.startsWith(names[i])) continue;
    const j = names.indexOf(spot.slice(names[i].length));
    if (j >= 0) return [i, j];
  }
  return null;
}

/** Let positions name geometry points ("A", "tri.B"). */
export function enableGeometryNames(world: SceneWorld) {
  world.geoPoint = (ref) => {
    const g = world.geo.get(ref);
    const v = g?.at(world.now);
    if (v?.k === 'point') return v.p;
    if (ref.includes('.')) {
      const [head, spot] = ref.split('.');
      const b = world.geo.get(head)?.at(world.now);
      if (b?.k === 'polygon' && b.names.includes(spot)) return b.pts[b.names.indexOf(spot)];
      if (b?.k === 'circle' && spot === 'center') return b.c;
    }
    return undefined;
  };
}

function register(ctx: Ctx, g: GObj, where: string) {
  if (ctx.world.geo.has(g.id)) throw new ScriptError(`there is already something called "${g.id}".`, where);
  ctx.world.geo.set(g.id, g);
}

// ---- Drawing geometry ----

const circlePts = (c: Pt, r: number, a0 = 0, a1 = Math.PI * 2, n = 96): Pt[] =>
  Array.from({ length: n + 1 }, (_, k) => [c[0] + r * Math.cos(a0 + ((a1 - a0) * k) / n), c[1] + r * Math.sin(a0 + ((a1 - a0) * k) / n)] as Pt);

const dotGlyph = (p: Pt, r: number, col: string) => fillGlyph([{ closed: true, pts: circlePts(p, r, 0, Math.PI * 2, 24).slice(0, -1) }], 'dot', { color: col });

function lineContour(v: Extract<GVal, { k: 'line' }>): Contour {
  if (v.kind === 'segment') return { closed: false, pts: [v.a, v.b] };
  if (v.kind === 'ray') return { closed: false, pts: [v.a, add(v.a, mul(v.d, FAR))] };
  return { closed: false, pts: [sub(v.p, mul(v.d, FAR)), add(v.p, mul(v.d, FAR))] };
}

function shapeGlyphs(v: GVal, col: string, lw: number, opts: { fill?: string; dash?: boolean; r?: number } = {}): Glyph[] {
  switch (v.k) {
    case 'point': return [dotGlyph(v.p, opts.r ?? 0.08, col)];
    case 'line': return [strokeGlyph([lineContour(v)], lw, 'line', { color: col, dash: opts.dash })];
    case 'circle': {
      const c: Contour = { closed: true, pts: circlePts(v.c, v.r).slice(0, -1) };
      return [...(opts.fill ? [fillGlyph([c], 'fill', { color: opts.fill })] : []), strokeGlyph([c], lw, 'circle', { color: col, dash: opts.dash })];
    }
    case 'polygon': {
      const c: Contour = { closed: true, pts: v.pts };
      return [...(opts.fill ? [fillGlyph([c], 'fill', { color: opts.fill })] : []), strokeGlyph([c], lw, 'polygon', { color: col, dash: opts.dash })];
    }
  }
}

/** A label beside a point, pushed away from `from` (the middle of its figure). */
function labelAt(text: string, p: Pt, from: Pt | undefined, col: string, size = 0.42): Glyph[] {
  const d = from && len(sub(p, from)) > 1e-6 ? norm(sub(p, from)) : norm([1, 1]);
  const at = add(p, mul(d, 0.3));
  return numberGlyphs(text, at, 'center', size, col, '');
}

function geoThing(ctx: Ctx, g: GObj, draw: (v: GVal, t: number) => Glyph[], where: string, id = g.id): Thing {
  return liveThing(ctx, id, (t) => {
    const v = g.at(t === Infinity ? Infinity : t);
    return v ? draw(v, t) : [];
  }, where);
}

const lw = (ctx: Ctx, d = 4) => num(ctx, 'line_width', d);
const inkOf = (ctx: Ctx) => color(ctx, 'color', ctx.world.theme.ink)!;

/** Make the thing arrive and return the beat's end. */
function show(ctx: Ctx, th: Thing, how: 'draw' | 'pop' | 'fade' = 'draw', d = 0.9): Done {
  if (ctx.spec.hidden === true) return { end: ctx.start, thing: th };
  const { how: h } = readAppear(ctx, how);
  const dur = natural(ctx, d);
  arrive(ctx, th, h, ctx.start, dur);
  return { end: ctx.start + dur, thing: th };
}

// ---- Points ----

interface Free { x: Param; y: Param; t?: Param }
const FREE = new Map<GObj, Free>();

/** A free point in the geometry world (the `point` action). */
export function geoPoint(ctx: Ctx): Done {
  const { world } = ctx;
  const id = str(ctx, 'id');
  if (!id) throw new ScriptError('needs an "id" in the geometry world, such as "A".', ctx.where);
  const p = world.point(ctx.spec.position, `${ctx.where}.position`);
  const free: Free = { x: new Param(p[0]), y: new Param(p[1]) };
  const g = memo(id, (t) => ({ k: 'point', p: [free.x.at(t), free.y.at(t)] }));
  register(ctx, g, ctx.where);
  FREE.set(g, free);
  return showPoint(ctx, g, id);
}

function showPoint(ctx: Ctx, g: GObj, id: string): Done {
  const col = color(ctx, 'color', ctx.world.theme.accent)!;
  const r = num(ctx, 'radius', 0.08);
  const label = ctx.spec.label === true ? id : typeof ctx.spec.label === 'string' ? ctx.spec.label : undefined;
  const th = geoThing(ctx, g, (v) => {
    if (v.k !== 'point') return [];
    return [dotGlyph(v.p, r, col), ...(label ? labelAt(label, v.p, figureMiddle(ctx.world, v.p), ctx.world.theme.ink) : [])];
  }, ctx.where);
  th.layer = 2;
  return show(ctx, th, 'pop', 0.5);
}

/** The middle of all the points so far: labels sit on the side away from it. */
function figureMiddle(world: SceneWorld, p: Pt): Pt | undefined {
  const pts: Pt[] = [];
  for (const g of world.geo.values()) {
    const v = g.at(world.now);
    if (v?.k === 'point') pts.push(v.p);
    else if (v?.k === 'polygon') pts.push(...v.pts);
  }
  const c = pts.length > 1 ? centroid(pts) : undefined;
  return c && len(sub(c, p)) > 0.05 ? c : undefined;
}

// ---- Lines, circles, polygons ----

function pointOf(ctx: Ctx, ref: unknown, where: string): (t: number) => Pt {
  const g = gref(ctx, ref, where, 'point');
  return (t) => {
    const v = g.at(t);
    if (!v || v.k !== 'point') throw new ScriptError(`"${String(ref)}" is not a point.`, where);
    return v.p;
  };
}

function makeLine(ctx: Ctx, kind: 'segment' | 'line' | 'ray'): Done {
  const id = str(ctx, 'id') ?? ctx.world.newId(kind);
  let a: (t: number) => Pt, b: (t: number) => Pt;
  if (kind === 'line') {
    const th = ctx.spec.through;
    if (!Array.isArray(th) || th.length !== 2) throw new ScriptError('needs "through": two points.', `${ctx.where}.through`);
    a = pointOf(ctx, th[0], `${ctx.where}.through[0]`);
    b = pointOf(ctx, th[1], `${ctx.where}.through[1]`);
  } else {
    a = pointOf(ctx, ctx.spec.from, `${ctx.where}.from`);
    b = pointOf(ctx, kind === 'ray' ? ctx.spec.through : ctx.spec.to, `${ctx.where}.${kind === 'ray' ? 'through' : 'to'}`);
  }
  const g = memo(id, (t) => lineVal(a(t), b(t), kind));
  register(ctx, g, ctx.where);
  const col = inkOf(ctx), w = lw(ctx), dash = ctx.spec.dash === true;
  const th = geoThing(ctx, g, (v) => shapeGlyphs(v, col, w, { dash }), ctx.where);
  return show(ctx, th);
}

registerAction('segment', { summary: 'A straight line between two points.', worlds: GEO, params: ['from', 'to', 'color', 'line_width', 'dash', 'appear'], required: ['from', 'to'], build: (ctx) => makeLine(ctx, 'segment') });
registerAction('line', { summary: 'A straight line through two points, running to the edge of the frame.', worlds: GEO, params: ['through', 'color', 'line_width', 'dash', 'appear'], required: ['through'], build: (ctx) => makeLine(ctx, 'line') });
registerAction('ray', { summary: 'A line from a point, through another, on and on.', worlds: GEO, params: ['from', 'through', 'color', 'line_width', 'dash', 'appear'], required: ['from', 'through'], build: (ctx) => makeLine(ctx, 'ray') });

registerAction('circle', {
  summary: 'A circle: by centre and radius, centre and a point on it, or through three points.',
  worlds: GEO,
  params: ['center', 'radius', 'through', 'color', 'line_width', 'dash', 'fill', 'fill_opacity', 'appear'],
  build(ctx) {
    const id = str(ctx, 'id') ?? ctx.world.newId('circle');
    let rule: (t: number) => GVal | null;
    const th = ctx.spec.through;
    if (Array.isArray(th) && th.length === 3) {
      const ps = th.map((p, i) => pointOf(ctx, p, `${ctx.where}.through[${i}]`));
      rule = (t) => { const c = circleThrough(ps[0](t), ps[1](t), ps[2](t)); return c ? { k: 'circle', ...c } : null; };
    } else {
      if (ctx.spec.center === undefined) throw new ScriptError('needs "center" (with "radius" or "through"), or "through": three points.', ctx.where);
      const c = pointOf(ctx, ctx.spec.center, `${ctx.where}.center`);
      if (typeof ctx.spec.radius === 'number') { const r = ctx.spec.radius; rule = (t) => ({ k: 'circle', c: c(t), r }); }
      else if (typeof ctx.spec.radius === 'string') {
        const s = gref(ctx, ctx.spec.radius, `${ctx.where}.radius`, 'line');
        rule = (t) => { const v = s.at(t); return v?.k === 'line' ? { k: 'circle', c: c(t), r: len(sub(v.b, v.a)) } : null; };
      } else if (th !== undefined) {
        const p = pointOf(ctx, th, `${ctx.where}.through`);
        rule = (t) => ({ k: 'circle', c: c(t), r: len(sub(p(t), c(t))) });
      } else throw new ScriptError('needs "radius" (a number or a segment) or "through" (a point on it).', ctx.where);
    }
    const g = memo(id, rule);
    register(ctx, g, ctx.where);
    const col = color(ctx, 'color', ctx.world.theme.shades.blue)!;
    const fill = ctx.spec.fill !== undefined ? withAlpha(color(ctx, 'fill')!, num(ctx, 'fill_opacity', 0.3)) : undefined;
    const thg = geoThing(ctx, g, (v) => shapeGlyphs(v, col, lw(ctx), { fill, dash: ctx.spec.dash === true }), ctx.where);
    return show(ctx, thg, 'draw', 1.2);
  },
});

function cornerLabels(v: Extract<GVal, { k: 'polygon' }>, col: string): Glyph[] {
  const c = centroid(v.pts);
  return v.pts.flatMap((p, i) => (v.names[i] && !v.names[i].startsWith('_') ? labelAt(v.names[i], p, c, col) : []));
}

registerAction('polygon', {
  summary: 'A polygon through points; its corners keep their names.',
  worlds: GEO,
  params: ['points', 'names', 'color', 'line_width', 'fill', 'fill_opacity', 'labels', 'appear'],
  required: ['points'],
  build(ctx) {
    const id = str(ctx, 'id') ?? ctx.world.newId('polygon');
    if (!Array.isArray(ctx.spec.points) || ctx.spec.points.length < 3) throw new ScriptError('needs "points": three or more.', `${ctx.where}.points`);
    const refs = ctx.spec.points;
    const ps = refs.map((p, i) => pointOf(ctx, p, `${ctx.where}.points[${i}]`));
    const names = Array.isArray(ctx.spec.names) ? ctx.spec.names.map(String) : refs.map((r, i) => (typeof r === 'string' ? r : `_${i}`));
    const g = memo(id, (t) => ({ k: 'polygon', pts: ps.map((p) => p(t)), names }));
    register(ctx, g, ctx.where);
    const col = color(ctx, 'color', ctx.world.theme.shades.teal)!;
    const fill = ctx.spec.fill !== undefined ? withAlpha(color(ctx, 'fill')!, num(ctx, 'fill_opacity', 0.3)) : undefined;
    // Corners named by "names" (not by existing points, which show their own labels) are labelled.
    const labels = ctx.spec.labels === true || (ctx.spec.labels !== false && Array.isArray(ctx.spec.names));
    const th = geoThing(ctx, g, (v) => (v.k === 'polygon' ? [...shapeGlyphs(v, col, lw(ctx), { fill }), ...(labels ? cornerLabels(v, ctx.world.theme.ink) : [])] : []), ctx.where);
    return show(ctx, th, 'draw', 1.2);
  },
});

registerAction('triangle', {
  summary: 'A triangle made in one go, with free corners named A, B, C.',
  worlds: GEO,
  params: ['kind', 'size', 'position', 'names', 'color', 'line_width', 'fill', 'fill_opacity', 'appear'],
  build(ctx) {
    const { world } = ctx;
    const id = str(ctx, 'id') ?? world.newId('triangle');
    const kind = choice(ctx.spec.kind, ['any', 'right', 'equilateral', 'isosceles'] as const, `${ctx.where}.kind`, 'any');
    const s = num(ctx, 'size', 4);
    const c = ctx.spec.position !== undefined ? world.point(ctx.spec.position, `${ctx.where}.position`) : [0, -0.3] as Pt;
    const shape: Pt[] = kind === 'right' ? [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.45]]
      : kind === 'equilateral' ? [[-0.5, -0.29], [0.5, -0.29], [0, 0.577]]
        : kind === 'isosceles' ? [[-0.38, -0.4], [0.38, -0.4], [0, 0.6]]
          : [[-0.55, -0.4], [0.5, -0.4], [0.15, 0.5]];
    const names = Array.isArray(ctx.spec.names) ? ctx.spec.names.map(String) : ['A', 'B', 'C'];
    const ids = names.map((n) => (world.geo.has(n) ? `${id}_${n}` : n));
    const ps = shape.map(([x, y], i) => {
      const free: Free = { x: new Param(c[0] + x * s), y: new Param(c[1] + y * s) };
      const g = memo(ids[i], (t) => ({ k: 'point', p: [free.x.at(t), free.y.at(t)] }));
      register(ctx, g, ctx.where);
      FREE.set(g, free);
      return g;
    });
    const g = memo(id, (t) => ({ k: 'polygon', pts: ps.map((p) => (p.at(t) as Extract<GVal, { k: 'point' }>).p), names }));
    register(ctx, g, ctx.where);
    const col = color(ctx, 'color', world.theme.shades.teal)!;
    const fill = ctx.spec.fill !== undefined ? withAlpha(color(ctx, 'fill')!, num(ctx, 'fill_opacity', 0.3)) : undefined;
    const th = geoThing(ctx, g, (v) => (v.k === 'polygon' ? [...shapeGlyphs(v, col, lw(ctx), { fill }), ...cornerLabels(v, world.theme.ink)] : []), ctx.where);
    return show(ctx, th, 'draw', 1.2);
  },
});

// ---- Constructions ----

const MAKES = [
  'midpoint', 'perpendicular', 'parallel', 'bisector', 'intersection', 'foot', 'reflect_point', 'tangent',
  'circumcircle', 'incircle', 'centroid', 'orthocenter', 'circumcenter', 'incenter', 'on',
] as const;

/** The two ends of a segment named by `of`: a segment, or two points. */
function endsOf(ctx: Ctx, of: unknown, where: string): (t: number) => [Pt, Pt] {
  if (Array.isArray(of) && of.length === 2) {
    const a = pointOf(ctx, of[0], `${where}[0]`), b = pointOf(ctx, of[1], `${where}[1]`);
    return (t) => [a(t), b(t)];
  }
  const s = gref(ctx, of, where, 'line');
  return (t) => { const v = s.at(t) as Extract<GVal, { k: 'line' }>; return [v.a, v.b]; };
}

function lineOf(ctx: Ctx, ref: unknown, where: string): (t: number) => Extract<GVal, { k: 'line' }> {
  const g = gref(ctx, ref, where, 'line');
  return (t) => g.at(t) as Extract<GVal, { k: 'line' }>;
}

function triangleOf(ctx: Ctx, ref: unknown, where: string): (t: number) => [Pt, Pt, Pt] {
  const g = gref(ctx, ref, where, 'polygon');
  return (t) => {
    const v = g.at(t) as Extract<GVal, { k: 'polygon' }>;
    if (v.pts.length !== 3) throw new ScriptError(`"${String(ref)}" is not a triangle.`, where);
    return [v.pts[0], v.pts[1], v.pts[2]];
  };
}

/** Compass and ruler marks for a construction, worked out from its parts. */
type Steps = ((t: number) => Contour[])[];

function arcAround(center: Pt, r: number, toward: Pt, half = 0.32): Contour {
  const a = Math.atan2(toward[1] - center[1], toward[0] - center[0]);
  return { closed: false, pts: circlePts(center, r, a - half, a + half, 24) };
}

registerAction('construct', {
  summary: 'Make a new point, line or circle from others, by a rule; optionally with its compass steps.',
  worlds: GEO,
  params: ['make', 'of', 'from', 'to', 'through', 'in', 'angle', 'which', 'touch', 'on', 't', 'label', 'color', 'line_width', 'show_steps', 'extend', 'dash'],
  required: ['make'],
  build(ctx) {
    const { world, spec } = ctx;
    const make = choice(spec.make, MAKES, `${ctx.where}.make`);
    const id = str(ctx, 'id') ?? world.newId(make);
    const w = ctx.where;
    let rule: (t: number) => GVal | null;
    let steps: Steps = [];
    const which = typeof spec.which === 'number' ? spec.which : 1;
    switch (make) {
      case 'midpoint': {
        const e = endsOf(ctx, spec.of, `${w}.of`);
        rule = (t) => { const [a, b] = e(t); return { k: 'point', p: mid(a, b) }; };
        steps = bisectorSteps(e);
        break;
      }
      case 'bisector': {
        if (Array.isArray(spec.angle) && spec.angle.length === 3) {
          const [pa, pb, pc] = spec.angle.map((r, i) => pointOf(ctx, r, `${w}.angle[${i}]`));
          rule = (t) => {
            const A = pb(t), u = norm(sub(pa(t), A)), v = norm(sub(pc(t), A));
            return lineVal(A, add(A, add(u, v)), 'ray');
          };
          steps = [
            (t) => { const A = pb(t), r = 0.55 * Math.min(len(sub(pa(t), A)), len(sub(pc(t), A))); const u = angleAt(pa(t), A, pc(t)) > Math.PI; const a0 = Math.atan2(pa(t)[1] - A[1], pa(t)[0] - A[0]); const sweep = angleAt(pa(t), A, pc(t)); return [{ closed: false, pts: circlePts(A, r, u ? a0 + sweep - Math.PI * 2 - 0.15 : a0 - 0.15, u ? a0 + 0.15 : a0 + sweep + 0.15, 40) }]; },
            (t) => {
              const A = pb(t), r = 0.55 * Math.min(len(sub(pa(t), A)), len(sub(pc(t), A)));
              const U = add(A, mul(norm(sub(pa(t), A)), r)), V = add(A, mul(norm(sub(pc(t), A)), r));
              const W = add(A, mul(norm(add(sub(U, A), sub(V, A))), r * 1.6));
              const rr = len(sub(W, U));
              return [arcAround(U, rr, W), arcAround(V, rr, W)];
            },
          ];
        } else {
          const e = endsOf(ctx, spec.of, `${w}.of`);
          rule = (t) => { const [a, b] = e(t); const m = mid(a, b); return lineVal(m, add(m, perp(sub(b, a))), 'line'); };
          steps = bisectorSteps(e);
        }
        break;
      }
      case 'perpendicular': case 'foot': {
        const P = pointOf(ctx, spec.from, `${w}.from`);
        const L = lineOf(ctx, spec.to, `${w}.to`);
        if (make === 'foot') rule = (t) => ({ k: 'point', p: foot(P(t), L(t)) });
        else if (spec.extend === true) rule = (t) => { const f = foot(P(t), L(t)); const p = P(t); return lineVal(len(sub(p, f)) > 1e-9 ? p : f, len(sub(p, f)) > 1e-9 ? f : add(f, perp(L(t).d)), 'line'); };
        else rule = (t) => { const f = foot(P(t), L(t)); return lineVal(P(t), f, 'segment'); };
        if (make === 'perpendicular') {
          steps = [
            (t) => {
              const p = P(t), l = L(t), f = foot(p, l);
              const r = Math.max(0.8, len(sub(p, f)) * 1.4);
              const pts = meet({ k: 'circle', c: p, r }, { ...l, kind: 'line' });
              return pts.map((q) => arcAround(p, r, q, 0.22));
            },
            (t) => {
              const p = P(t), l = L(t), f = foot(p, l);
              const r = Math.max(0.8, len(sub(p, f)) * 1.4);
              const [y1, y2] = meet({ k: 'circle', c: p, r }, { ...l, kind: 'line' });
              if (!y1 || !y2) return [];
              const away = len(sub(p, f)) > 1e-6 ? norm(sub(f, p)) : perp(l.d);
              const z = add(f, mul(away, r * 0.9));
              const rr = len(sub(z, y1));
              return [arcAround(y1, rr, z), arcAround(y2, rr, z)];
            },
          ];
        }
        break;
      }
      case 'parallel': {
        const P = pointOf(ctx, spec.through, `${w}.through`);
        const L = lineOf(ctx, spec.to, `${w}.to`);
        rule = (t) => { const p = P(t); return lineVal(p, add(p, L(t).d), 'line'); };
        break;
      }
      case 'intersection': {
        if (!Array.isArray(spec.of) || spec.of.length !== 2) throw new ScriptError('needs "of": two lines or circles.', `${w}.of`);
        const [x, y] = spec.of.map((r, i) => gref(ctx, r, `${w}.of[${i}]`));
        rule = (t) => {
          const a = x.at(t), b = y.at(t);
          if (!a || !b) return null;
          const as = a.k === 'line' ? { ...a, kind: 'line' as const } : a;
          const bs = b.k === 'line' ? { ...b, kind: 'line' as const } : b;
          const ps = meet(as, bs);
          const p = ps[Math.min(which, ps.length) - 1];
          return p ? { k: 'point', p } : null;
        };
        if (!rule(Infinity)) throw new ScriptError(`"${String(spec.of[0])}" and "${String(spec.of[1])}" do not meet.`, `${w}.of`);
        break;
      }
      case 'reflect_point': {
        const P = pointOf(ctx, spec.of, `${w}.of`);
        const m = gref(ctx, spec.in, `${w}.in`);
        rule = (t) => {
          const v = m.at(t);
          if (v?.k === 'line') return { k: 'point', p: reflectIn(P(t), v) };
          if (v?.k === 'point') return { k: 'point', p: sub(mul(v.p, 2), P(t)) };
          return null;
        };
        break;
      }
      case 'tangent': {
        const C = gref(ctx, spec.to, `${w}.to`, 'circle');
        if (spec.touch !== undefined) {
          const T = pointOf(ctx, spec.touch, `${w}.touch`);
          rule = (t) => { const c = C.at(t) as Extract<GVal, { k: 'circle' }>; const p = T(t); return lineVal(p, add(p, perp(sub(p, c.c))), 'line'); };
        } else {
          const P = pointOf(ctx, spec.from, `${w}.from`);
          rule = (t) => {
            const c = C.at(t) as Extract<GVal, { k: 'circle' }>;
            const p = P(t);
            const d = len(sub(p, c.c));
            if (d <= c.r) return null;
            // The touching points are where the circle on CP as diameter meets the circle.
            const touch = meet({ k: 'circle', c: c.c, r: c.r }, { k: 'circle', c: mid(p, c.c), r: d / 2 });
            const q = touch[Math.min(which, touch.length) - 1];
            return q ? lineVal(p, q, 'line') : null;
          };
        }
        break;
      }
      case 'circumcircle': case 'incircle': {
        const T = triangleOf(ctx, spec.of, `${w}.of`);
        rule = (t) => { const [a, b, c] = T(t); const r = make === 'incircle' ? incircle(a, b, c) : circleThrough(a, b, c); return r ? { k: 'circle', ...r } : null; };
        break;
      }
      case 'centroid': case 'orthocenter': case 'circumcenter': case 'incenter': {
        const T = triangleOf(ctx, spec.of, `${w}.of`);
        rule = (t) => {
          const [a, b, c] = T(t);
          const p = make === 'centroid' ? centroid([a, b, c]) : make === 'orthocenter' ? orthocenter(a, b, c) : make === 'circumcenter' ? circleThrough(a, b, c)?.c : incircle(a, b, c).c;
          return p ? { k: 'point', p } : null;
        };
        break;
      }
      case 'on': {
        const base = gref(ctx, spec.on, `${w}.on`);
        const tp = new Param(num(ctx, 't', 0.25));
        rule = (t) => { const v = base.at(t); const p = v ? pointAlong(v, tp.at(t)) : null; return p ? { k: 'point', p } : null; };
        const g = memo(id, rule);
        register(ctx, g, w);
        FREE.set(g, { x: new Param(0), y: new Param(0), t: tp });
        return showPoint(ctx, g, id);
      }
    }
    const g = memo(id, rule);
    register(ctx, g, w);
    const first = g.at(Infinity);
    if (!first) throw new ScriptError('does not exist for the figure as it is (the parts do not meet).', w);
    // The compass steps first, faintly; then the result.
    let start = ctx.start;
    if (spec.show_steps === true) {
      if (!steps.length) throw new ScriptError(`there are no compass steps for "${make}"; they are drawn for midpoint, bisector and perpendicular.`, `${w}.show_steps`);
      const faint = withAlpha(world.theme.ink, 0.45);
      for (const step of steps) {
        const m = liveThing(ctx, world.newId('step'), (t) => [strokeGlyph(step(t), 2.5, 'arc', { color: faint })], w);
        m.layer = -1;
        arrive(ctx, m, 'draw', start, 0.7);
        start += 0.75;
      }
    }
    if (first.k === 'point') {
      const sub2: Ctx = { ...ctx, start };
      return showPoint(sub2, g, id);
    }
    const col = color(ctx, 'color', first.k === 'circle' ? world.theme.shades.blue : world.theme.accent)!;
    const th = geoThing(ctx, g, (v) => {
      const out = shapeGlyphs(v, col, lw(ctx), { dash: spec.dash === true });
      // A perpendicular from a point shows its right angle where it lands.
      if (make === 'perpendicular' && v.k === 'line' && v.kind === 'segment') {
        const L = lineOf(ctx, spec.to, `${w}.to`)(world.now === Infinity ? Infinity : world.now);
        const f = v.b, s = 0.18, u = norm(sub(v.a, f)), d = L.d;
        const sq = [add(f, mul(u, s)), add(add(f, mul(u, s)), mul(d, s)), add(f, mul(d, s))];
        out.push(strokeGlyph([{ closed: false, pts: sq }], 2.5, 'right', { color: col }));
      }
      return out;
    }, w);
    const d = natural(ctx, 0.9);
    arrive(ctx, th, 'draw', start, d);
    return { end: start + d, thing: th };
  },
}, ['build']);

function bisectorSteps(e: (t: number) => [Pt, Pt]): Steps {
  const r = (a: Pt, b: Pt) => len(sub(b, a)) * 0.68;
  return [
    (t) => { const [a, b] = e(t); const ps = meet({ k: 'circle', c: a, r: r(a, b) }, { k: 'circle', c: b, r: r(a, b) }); return ps.map((q) => arcAround(a, r(a, b), q)); },
    (t) => { const [a, b] = e(t); const ps = meet({ k: 'circle', c: a, r: r(a, b) }, { k: 'circle', c: b, r: r(a, b) }); return ps.map((q) => arcAround(b, r(a, b), q)); },
    (t) => { const [a, b] = e(t); const ps = meet({ k: 'circle', c: a, r: r(a, b) }, { k: 'circle', c: b, r: r(a, b) }); return ps.length === 2 ? [{ closed: false, pts: [ps[0], ps[1]] }] : []; },
  ];
}

// ---- Angles, equal marks, measurements ----

registerAction('angle', {
  summary: 'An angle mark: an arc (or a square for a right angle), with its size or a name.',
  worlds: GEO,
  params: ['points', 'show', 'arcs', 'right', 'units', 'fill', 'color', 'radius', 'appear'],
  required: ['points'],
  build(ctx) {
    const { world } = ctx;
    const ref = ctx.spec.points;
    if (!Array.isArray(ref) || ref.length !== 3) throw new ScriptError('needs "points": one arm, the corner, the other arm, such as ["B", "A", "C"].', `${ctx.where}.points`);
    const [pa, pb, pc] = ref.map((r, i) => pointOf(ctx, r, `${ctx.where}.points[${i}]`));
    const col = color(ctx, 'color', world.theme.accent)!;
    const arcs = Math.max(1, Math.min(3, Math.round(num(ctx, 'arcs', 1))));
    const radius = num(ctx, 'radius', 0.5);
    const units = choice(ctx.spec.units, ['degrees', 'radians'] as const, `${ctx.where}.units`, world.geoSettings.units);
    const fill = ctx.spec.fill !== undefined ? withAlpha(color(ctx, 'fill')!, 0.35) : undefined;
    const showWhat = ctx.spec.show ?? 'none';
    const id = str(ctx, 'id') ?? world.newId('angle');
    const th = liveThing(ctx, id, (t) => {
      let A = pa(t), B = pb(t), C = pc(t);
      let sweep = angleAt(A, B, C);
      if (sweep > Math.PI) { [A, C] = [C, A]; sweep = 2 * Math.PI - sweep; }
      const a0 = Math.atan2(A[1] - B[1], A[0] - B[0]);
      const out: Glyph[] = [];
      const isRight = ctx.spec.right === true || (ctx.spec.right !== false && Math.abs(sweep - Math.PI / 2) < 0.004);
      const r = Math.min(radius, 0.4 * len(sub(A, B)), 0.4 * len(sub(C, B)));
      if (isRight) {
        const u = norm(sub(A, B)), v = norm(sub(C, B)), s = r * 0.6;
        out.push(strokeGlyph([{ closed: false, pts: [add(B, mul(u, s)), add(add(B, mul(u, s)), mul(v, s)), add(B, mul(v, s))] }], 3, 'right', { color: col }));
      } else {
        if (fill) out.push(fillGlyph([{ closed: true, pts: [B, ...circlePts(B, r, a0, a0 + sweep, 40)] }], 'slice', { color: fill }));
        const rings: Contour[] = [];
        for (let k = 0; k < arcs; k++) rings.push({ closed: false, pts: circlePts(B, r + k * 0.08, a0, a0 + sweep, 40) });
        out.push(strokeGlyph(rings, 3, 'arc', { color: col }));
      }
      let text = '';
      if (showWhat === 'value') {
        text = units === 'degrees'
          ? `${formatNumber((sweep * 180) / Math.PI, world.geoSettings.angleDecimals)}^\\circ`
          : formatNumber(sweep, Math.max(2, world.geoSettings.decimals));
      } else if (showWhat === 'name') text = id.startsWith('_') ? '' : id;
      else if (typeof showWhat === 'string' && showWhat !== 'none') text = showWhat;
      if (text) {
        const am = a0 + sweep / 2;
        const tr = r + 0.38 + (arcs - 1) * 0.08;
        out.push(...numberGlyphs(text, [B[0] + tr * Math.cos(am), B[1] + tr * Math.sin(am)], 'center', 0.34, col, ''));
      }
      return out;
    }, ctx.where);
    th.layer = 1;
    return show(ctx, th, 'draw', 0.7);
  },
}, ['angle_mark']);

function sideOf(ctx: Ctx, ref: unknown, where: string): (t: number) => [Pt, Pt] {
  return endsOf(ctx, ref, where);
}

registerAction('equal', {
  summary: 'Small ticks on sides to show they are equal (or arrows to show lines are parallel).',
  worlds: GEO,
  params: ['who', 'ticks', 'as', 'color'],
  required: ['who'],
  build(ctx) {
    const list = Array.isArray(ctx.spec.who) ? ctx.spec.who : [ctx.spec.who];
    const n = Math.max(1, Math.min(4, Math.round(num(ctx, 'ticks', 1))));
    const as = choice(ctx.spec.as, ['ticks', 'arrows'] as const, `${ctx.where}.as`, 'ticks');
    const col = color(ctx, 'color', ctx.world.theme.ink)!;
    const sides = list.map((r, i) => sideOf(ctx, r, `${ctx.where}.who[${i}]`));
    const th = liveThing(ctx, str(ctx, 'id') ?? ctx.world.newId('equal'), (t) => {
      const cs: Contour[] = [];
      for (const s of sides) {
        const [a, b] = s(t);
        const m = mid(a, b), d = norm(sub(b, a)), q = perp(d);
        for (let k = 0; k < n; k++) {
          const c = add(m, mul(d, (k - (n - 1) / 2) * 0.1));
          if (as === 'ticks') cs.push({ closed: false, pts: [add(c, mul(q, 0.13)), sub(c, mul(q, 0.13))] });
          else cs.push({ closed: false, pts: [add(sub(c, mul(d, 0.1)), mul(q, 0.1)), add(c, mul(d, 0.04)), sub(sub(c, mul(d, 0.1)), mul(q, 0.1))] });
        }
      }
      return [strokeGlyph(cs, 3, 'ticks', { color: col })];
    }, ctx.where);
    th.layer = 1;
    return show(ctx, th, 'draw', 0.5);
  },
}, ['tick_marks']);

registerAction('measure', {
  summary: 'A measuring line beside a segment, with its length, updating as the figure changes.',
  worlds: GEO,
  params: ['who', 'show', 'text', 'color', 'side'],
  required: ['who'],
  build(ctx) {
    const { world } = ctx;
    const s = sideOf(ctx, ctx.spec.who, `${ctx.where}.who`);
    const col = color(ctx, 'color', withAlpha(world.theme.ink, 0.8))!;
    const flip = ctx.spec.side === 'right' ? -1 : 1;
    const text = typeof ctx.spec.text === 'string' ? ctx.spec.text : undefined;
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('measure'), (t) => {
      let [a, b] = s(t);
      // Away from the middle of the figure, unless told which side.
      const d = norm(sub(b, a));
      let q = perp(d);
      const c = figureMiddle(world, mid(a, b));
      if (c && dot(q, sub(mid(a, b), c)) < 0 && ctx.spec.side === undefined) q = mul(q, -1);
      q = mul(q, flip * 0.42);
      a = add(a, q); b = add(b, q);
      const L = len(sub(s(t)[1], s(t)[0]));
      const out: Glyph[] = [
        strokeGlyph([{ closed: false, pts: [a, b] }, { closed: false, pts: [sub(a, mul(q, 0.3)), add(a, mul(q, 0.3))] }, { closed: false, pts: [sub(b, mul(q, 0.3)), add(b, mul(q, 0.3))] }], 2.2, 'measure', { color: col }),
        fillGlyph([arrowHead(mid(a, b), a, 0.14), arrowHead(mid(a, b), b, 0.14)], 'tips', { color: col }),
      ];
      out.push(...numberGlyphs(text ?? formatNumber(L, world.geoSettings.decimals), add(mid(a, b), mul(norm(q), 0.28)), 'center', 0.34, col, ''));
      return out;
    }, ctx.where);
    return show(ctx, th, 'draw', 0.7);
  },
}, ['length', 'dimension']);

// ---- Dragging ----

registerAction('drag', {
  summary: 'Move a free point; the whole figure follows.',
  worlds: GEO,
  params: ['who', 'to', 'path', 'ease'],
  required: ['who'],
  build(ctx) {
    const g = ctx.world.geo.get(String(ctx.spec.who));
    const free = g ? FREE.get(g) : undefined;
    if (!free) throw new ScriptError(`"${String(ctx.spec.who)}" is not a free point; only points made with "point", the corners of "triangle", and points "on" something can be dragged.`, `${ctx.where}.who`);
    const e = choice(ctx.spec.ease, EASES, `${ctx.where}.ease`, 'smooth');
    if (free.t) {
      if (typeof ctx.spec.to !== 'number') throw new ScriptError('must be a number from 0 to 1: how far along.', `${ctx.where}.to`);
      const d = natural(ctx, 2);
      free.t.to(ctx.spec.to, ctx.start, d, e);
      return { end: ctx.start + d };
    }
    const stops: Pt[] = ctx.spec.path !== undefined
      ? (Array.isArray(ctx.spec.path) ? ctx.spec.path : []).map((p, i) => ctx.world.point(p, `${ctx.where}.path[${i}]`))
      : [ctx.world.point(ctx.spec.to, `${ctx.where}.to`)];
    if (!stops.length) throw new ScriptError('needs "to" (a position) or "path" (a list of positions).', ctx.where);
    const d = natural(ctx, 1.5 * stops.length);
    const per = d / stops.length;
    stops.forEach((p, i) => {
      free.x.to(p[0], ctx.start + i * per, per, stops.length > 1 ? 'linear' : e);
      free.y.to(p[1], ctx.start + i * per, per, stops.length > 1 ? 'linear' : e);
    });
    return { end: ctx.start + d };
  },
}, ['wiggle_point']);

// ---- Transformations ----

type Map2 = (p: Pt, k: number) => Pt;

function transformOf(src: GVal, f: Map2, k: number, names: (n: string) => string): GVal {
  switch (src.k) {
    case 'point': return { k: 'point', p: f(src.p, k) };
    case 'line': return { ...lineVal(f(src.a, k), f(src.b, k), src.kind) };
    case 'circle': {
      const c = f(src.c, k), edge = f(add(src.c, [src.r, 0]), k);
      return { k: 'circle', c, r: len(sub(edge, c)) };
    }
    case 'polygon': return { k: 'polygon', pts: src.pts.map((p) => f(p, k)), names: src.names.map(names) };
  }
}

function transformAction(kind: 'translate' | 'rotate' | 'reflect' | 'enlarge') {
  return (ctx: Ctx): Done => {
    const { world, spec } = ctx;
    const src = gref(ctx, spec.who, `${ctx.where}.who`);
    const id = str(ctx, 'id') ?? world.newIdFor(src.id);
    const k = new Param(0);
    const d = natural(ctx, 1.4);
    k.to(1, ctx.start, d, choice(spec.ease, EASES, `${ctx.where}.ease`, 'smooth'));
    let f: (t: number) => Map2;
    let extra: ((t: number) => Contour[]) | undefined;
    switch (kind) {
      case 'translate': {
        if (!Array.isArray(spec.by) || spec.by.length !== 2) throw new ScriptError('needs "by": [right, up].', `${ctx.where}.by`);
        const v: Pt = [Number(spec.by[0]), Number(spec.by[1])];
        f = () => (p, u) => add(p, mul(v, u));
        if (spec.arrow === true) extra = (t) => { const s = src.at(t); const c = s ? centerOf(s) : [0, 0] as Pt; return [{ closed: false, pts: [c, add(c, v)] }]; };
        break;
      }
      case 'rotate': {
        const by = (num(ctx, 'by', 90) * Math.PI) / 180;
        const C = spec.around !== undefined ? pointOf(ctx, spec.around, `${ctx.where}.around`) : (t: number) => { const s = src.at(t); return s ? centerOf(s) : [0, 0] as Pt; };
        f = (t) => { const c = C(t); return (p, u) => rotateAbout(p, c, by * u); };
        break;
      }
      case 'reflect': {
        const m = gref(ctx, spec.in, `${ctx.where}.in`);
        f = (t) => {
          const v = m.at(t);
          if (v?.k === 'line') return (p, u) => lerpPt(p, reflectIn(p, v), u);
          if (v?.k === 'point') return (p, u) => lerpPt(p, sub(mul(v.p, 2), p), u);
          return (p) => p;
        };
        if (spec.lines === true) extra = (t) => { const s = src.at(t); const map = f(t); return s ? pointsOf(s).map((p) => ({ closed: false, pts: [p, map(p, 1)] })) : []; };
        break;
      }
      case 'enlarge': {
        const by = num(ctx, 'by', 2);
        const C = spec.center !== undefined ? pointOf(ctx, spec.center, `${ctx.where}.center`) : (t: number) => { const s = src.at(t); return s ? centerOf(s) : [0, 0] as Pt; };
        f = (t) => { const c = C(t); return (p, u) => add(c, mul(sub(p, c), 1 + (by - 1) * u)); };
        if (spec.rays === true) extra = (t) => { const s = src.at(t); const c = C(t); const map = f(t); return s ? pointsOf(s).map((p) => ({ closed: false, pts: [c, ...(by >= 1 ? [map(p, 1)] : [p])] })) : []; };
        break;
      }
    }
    const g = memo(id, (t) => { const s = src.at(t); return s ? transformOf(s, f(t), k.at(t), (n) => (n.startsWith('_') ? n : `${n}'`)) : null; });
    register(ctx, g, ctx.where);
    const first = src.at(Infinity);
    const col = color(ctx, 'color', world.theme.shades.pink)!;
    const th = geoThing(ctx, g, (v) => [...shapeGlyphs(v, col, lw(ctx), { fill: first?.k === 'polygon' ? withAlpha(col, 0.2) : undefined }), ...(v.k === 'polygon' ? cornerLabels(v, col) : [])], ctx.where);
    ctx.act({ start: ctx.start, duration: 0.3, apply(u) { th.state.visible = true; th.state.opacity *= u; } });
    if (spec.ghost === true) {
      // The original stays as a faint dashed outline.
      const srcThing = world.things.get(src.id);
      if (srcThing) ctx.act({ start: ctx.start, duration: 0.5, apply(u) { srcThing.state.opacity *= 1 - 0.65 * u; } });
    }
    if (extra) {
      const ex = liveThing(ctx, world.newId('guide'), (t) => [strokeGlyph(extra!(t), 2.2, 'guide', { color: withAlpha(world.theme.ink, 0.55), dash: true })], ctx.where);
      ex.layer = -1;
      arrive(ctx, ex, 'draw', ctx.start, Math.min(0.8, d));
    }
    return { end: ctx.start + d, thing: th };
  };
}

function pointsOf(v: GVal): Pt[] {
  if (v.k === 'point') return [v.p];
  if (v.k === 'line') return [v.a, v.b];
  if (v.k === 'circle') return [v.c];
  return v.pts;
}

function centerOf(v: GVal): Pt {
  return v.k === 'circle' ? v.c : centroid(pointsOf(v));
}

const TF_KEYS = ['who', 'id', 'ghost', 'color', 'line_width', 'ease'];
registerAction('translate', { summary: 'Slide a figure by a vector.', worlds: GEO, params: [...TF_KEYS, 'by', 'arrow'], required: ['who', 'by'], build: transformAction('translate') });
registerAction('rotate', { summary: 'Turn a figure about a point.', worlds: GEO, params: [...TF_KEYS, 'by', 'around'], required: ['who', 'by'], build: transformAction('rotate') });
registerAction('reflect', { summary: 'Mirror a figure in a line or a point.', worlds: GEO, params: [...TF_KEYS, 'in', 'lines'], required: ['who', 'in'], build: transformAction('reflect') });
registerAction('enlarge', { summary: 'Enlarge a figure from a centre.', worlds: GEO, params: [...TF_KEYS, 'by', 'center', 'rays'], required: ['who', 'by'], build: transformAction('enlarge') });

// ---- Cutting and rearranging ----

interface Piece { thing: Thing; /** Its pose as cut: where its anchor is, and its turn. */ home: Pt; turn: number; size: Pt }
const PIECES = new Map<string, Piece[]>();

registerAction('cut', {
  summary: 'Cut a shape into pieces, for proofs by rearranging.',
  worlds: GEO,
  params: ['who', 'into', 'count', 'rows', 'columns', 'lines', 'color', 'colors'],
  required: ['who', 'into'],
  build(ctx) {
    const { world } = ctx;
    const ref = String(ctx.spec.who);
    const into = choice(ctx.spec.into, ['sectors', 'strips', 'grid', 'lines'] as const, `${ctx.where}.into`);
    const id = str(ctx, 'id') ?? world.newIdFor(ref);
    const count = Math.max(2, Math.min(64, Math.round(num(ctx, 'count', 8))));
    const g = world.geo.get(ref);
    const v = g?.at(Infinity);
    // The outline to cut: a geometry circle or polygon, or a drawn shape.
    let circle: { c: Pt; r: number } | undefined;
    let outline: Pt[] | undefined;
    if (v?.k === 'circle') circle = { c: v.c, r: v.r };
    else if (v?.k === 'polygon') outline = v.pts;
    else {
      const th = world.get(ref, `${ctx.where}.who`);
      const c = th.build.glyphs.flatMap((gl) => gl.contours).find((k) => k.closed);
      if (!c) throw new ScriptError(`"${ref}" has no closed outline to cut.`, `${ctx.where}.who`);
      outline = c.pts.map(([x, y]) => [th.build.x + x * th.build.scale, th.build.y + y * th.build.scale] as Pt);
    }
    const colors = Array.isArray(ctx.spec.colors) ? ctx.spec.colors.map((c, i) => color({ ...ctx, spec: { c } }, 'c')!) : [color(ctx, 'color', world.theme.shades.blue)!, world.theme.shades.teal];
    void colors;
    const parts: { pts: Pt[]; anchor: Pt; turn: number }[] = [];
    if (into === 'sectors') {
      if (!circle) throw new ScriptError('"sectors" cuts a circle; use "strips", "grid" or "lines" for other shapes.', `${ctx.where}.into`);
      for (let i = 0; i < count; i++) {
        const a0 = (2 * Math.PI * i) / count, a1 = (2 * Math.PI * (i + 1)) / count;
        // Each slice is kept with its tip at its anchor and its middle pointing up.
        const am = (a0 + a1) / 2;
        const local = [[0, 0] as Pt, ...circlePts([0, 0], circle.r, Math.PI / 2 - (am - a0), Math.PI / 2 + (a1 - am), 16)];
        parts.push({ pts: local, anchor: circle.c, turn: am - Math.PI / 2 });
      }
    } else {
      let poly = outline ?? circlePts(circle!.c, circle!.r, 0, Math.PI * 2, 96).slice(0, -1);
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      let pieces: Pt[][] = [];
      if (into === 'strips' || into === 'grid') {
        const cols = into === 'grid' ? Math.max(1, Math.round(num(ctx, 'columns', count))) : count;
        const rows = into === 'grid' ? Math.max(1, Math.round(num(ctx, 'rows', count))) : 1;
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          let p = clipHalf(poly, [x0 + ((x1 - x0) * i) / cols, 0], [0, -1]);
          p = clipHalf(p, [x0 + ((x1 - x0) * (i + 1)) / cols, 0], [0, 1]);
          p = clipHalf(p, [0, y0 + ((y1 - y0) * j) / rows], [1, 0]);
          p = clipHalf(p, [0, y0 + ((y1 - y0) * (j + 1)) / rows], [-1, 0]);
          if (p.length >= 3) pieces.push(p);
        }
      } else {
        if (!Array.isArray(ctx.spec.lines)) throw new ScriptError('needs "lines": the segments or lines to cut along.', `${ctx.where}.lines`);
        pieces = [poly];
        ctx.spec.lines.forEach((r, i) => {
          const l = lineOf(ctx, r, `${ctx.where}.lines[${i}]`)(Infinity);
          pieces = pieces.flatMap((p) => [clipHalf(p, l.p, l.d), clipHalf(p, l.p, mul(l.d, -1))]).filter((p) => p.length >= 3);
        });
      }
      poly = [];
      for (const p of pieces) {
        const c = centroid(p);
        parts.push({ pts: p.map((q) => sub(q, c)), anchor: c, turn: 0 });
      }
    }
    // The original goes; the pieces take its place, eased a little apart.
    const source = world.things.get(ref);
    if (source) ctx.act({ start: ctx.start, duration: 0, apply() { source.state.visible = false; } });
    const list: Piece[] = [];
    const base = color(ctx, 'color', world.theme.shades.blue)!;
    const alt = world.theme.shades.teal;
    parts.forEach((part, i) => {
      const col = Array.isArray(ctx.spec.colors) ? colors[i % colors.length] : i % 2 ? alt : base;
      const pieceTh = new Thing(`${id}.${i + 1}`, 'shape', [
        fillGlyph([{ closed: true, pts: part.pts }], 'piece', { color: withAlpha(col, 0.55) }),
        strokeGlyph([{ closed: true, pts: part.pts }], 2.4, 'edge', { color: col }),
      ], part.anchor);
      pieceTh.base.rotation = part.turn;
      world.add(pieceTh, ctx.where);
      const xs = part.pts.map((p) => p[0]), ys = part.pts.map((p) => p[1]);
      list.push({ thing: pieceTh, home: part.anchor, turn: part.turn, size: [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)] });
      const out = into === 'sectors' ? [Math.cos(part.turn + Math.PI / 2) * 0.08, Math.sin(part.turn + Math.PI / 2) * 0.08] as Pt : mul(norm(sub(part.anchor, circle?.c ?? centroid(parts.map((q) => q.anchor)))), 0.06);
      ctx.act({
        start: ctx.start, duration: 0.6,
        apply(u) {
          const e = ease('smooth', u);
          pieceTh.state.visible = true;
          pieceTh.state.x += out[0] * e;
          pieceTh.state.y += out[1] * e;
        },
      });
      pieceTh.build.x += out[0];
      pieceTh.build.y += out[1];
      list[list.length - 1].home = [pieceTh.build.x, pieceTh.build.y];
    });
    const group = new Thing(id, 'group', [], [0, 0]);
    group.members = list.map((p) => p.thing);
    world.add(group, ctx.where);
    PIECES.set(id, list);
    ctx.sound('click', ctx.start);
    return { end: ctx.start + 0.6, thing: group };
  },
});

registerAction('rearrange_pieces', {
  summary: 'Move the pieces of a cut shape into a new arrangement.',
  worlds: GEO,
  params: ['who', 'into', 'places', 'gap', 'ease'],
  required: ['who'],
  build(ctx) {
    const id = String(ctx.spec.who);
    const pieces = PIECES.get(id);
    if (!pieces) throw new ScriptError(`"${id}" is not a set of pieces made with cut.`, `${ctx.where}.who`);
    const into = ctx.spec.places !== undefined ? 'places' : choice(ctx.spec.into, ['strip', 'row', 'stack'] as const, `${ctx.where}.into`, 'strip');
    const gap = num(ctx, 'gap', 0.05);
    const targets: { at: Pt; turn: number }[] = [];
    const middle = centroid(pieces.map((p) => p.home));
    if (into === 'places') {
      if (!Array.isArray(ctx.spec.places) || ctx.spec.places.length !== pieces.length) throw new ScriptError(`must list ${pieces.length} places, one per piece: { "position": ..., "turn": degrees }.`, `${ctx.where}.places`);
      ctx.spec.places.forEach((p, i) => {
        if (!isObject(p)) throw new ScriptError('must be { "position": ..., "turn": degrees }.', `${ctx.where}.places[${i}]`);
        targets.push({ at: ctx.world.point(p.position, `${ctx.where}.places[${i}].position`), turn: (pieces[i].turn) + ((typeof p.turn === 'number' ? p.turn : 0) * Math.PI) / 180 });
      });
    } else if (into === 'strip' && pieces.every((p) => p.thing.build.glyphs[0].contours[0].pts[0][0] === 0 && p.thing.build.glyphs[0].contours[0].pts[0][1] === 0)) {
      // Slices of a circle, tips alternately down and up: nearly a parallelogram.
      const n = pieces.length;
      const r = Math.max(...pieces.map((p) => p.size[1]));
      const s = (2 * Math.PI * r) / n;
      const width = (n / 2) * s;
      pieces.forEach((_p, i) => {
        const k = Math.floor(i / 2);
        const up = i % 2 === 0;
        const x = middle[0] - width / 2 + k * s + (up ? s / 2 : s);
        targets.push({ at: [x, up ? middle[1] - r / 2 : middle[1] + r / 2], turn: up ? 0 : Math.PI });
      });
    } else {
      // A row (or stack) keeping each piece's turn.
      const along = into === 'stack' ? 1 : 0;
      const total = pieces.reduce((a, p) => a + p.size[along] + gap, -gap);
      let cur = -total / 2;
      for (const p of pieces) {
        const c = cur + p.size[along] / 2;
        targets.push({ at: along ? [middle[0], middle[1] - c] : [middle[0] + c, middle[1]], turn: p.turn });
        cur += p.size[along] + gap;
      }
    }
    const d = natural(ctx, 2.5);
    const e = choice(ctx.spec.ease, EASES, `${ctx.where}.ease`, 'smooth');
    pieces.forEach((p, i) => {
      const from = [p.thing.build.x, p.thing.build.y] as Pt;
      const fromTurn = p.turn;
      const to = targets[i];
      let dt = to.turn - fromTurn;
      while (dt > Math.PI) dt -= 2 * Math.PI;
      while (dt < -Math.PI) dt += 2 * Math.PI;
      // Each piece sets off a moment after the one before.
      const lag = Math.min(0.5, d * 0.4) * (i / Math.max(1, pieces.length - 1));
      const dur = d - Math.min(0.5, d * 0.4);
      ctx.act({
        start: ctx.start + lag, duration: dur,
        apply(u) {
          const k = ease(e, u);
          p.thing.state.x += (to.at[0] - from[0]) * k;
          p.thing.state.y += (to.at[1] - from[1]) * k;
          p.thing.state.rotation += dt * k;
        },
      });
      p.thing.build.x = to.at[0];
      p.thing.build.y = to.at[1];
      p.turn = fromTurn + dt;
      p.home = to.at;
    });
    return { end: ctx.start + d };
  },
}, ['dissect']);

/** A geometry scene's settings: grid, numbers, units, decimals. */
export function setupGeometryWorld(ctx: Ctx, s: Record<string, unknown>, where: string) {
  const { world } = ctx;
  enableGeometryNames(world);
  world.geoSettings.units = choice(s.units, ['degrees', 'radians'] as const, `${where}.units`, 'degrees');
  if (typeof s.decimals === 'number') { world.geoSettings.decimals = s.decimals; world.geoSettings.angleDecimals = s.decimals; }
  if (s.grid === undefined || s.grid === false) return;
  const faint = s.grid === 'faint';
  const W = world.frameW, H = world.frameH;
  const glyphs: Glyph[] = [];
  const lines: Contour[] = [];
  for (let x = Math.ceil(-W); x <= W; x++) lines.push({ closed: false, pts: [[x, -H], [x, H]] });
  for (let y = Math.ceil(-H); y <= H; y++) lines.push({ closed: false, pts: [[-W, y], [W, y]] });
  glyphs.push(strokeGlyph(lines, faint ? 1.2 : 1.8, 'grid', { color: world.theme.grid }));
  if (s.numbers === true) {
    const axes: Contour[] = [{ closed: false, pts: [[-W, 0], [W, 0]] }, { closed: false, pts: [[0, -H], [0, H]] }];
    glyphs.push(strokeGlyph(axes, 2.4, 'axis', { color: withAlpha(world.theme.ink, 0.5) }));
    const col = withAlpha(world.theme.ink, 0.6);
    for (let x = Math.ceil(-W / 2) + 1; x < W / 2; x++) if (x) glyphs.push(...numberGlyphs(String(x), [x, -0.12], 'below', 0.24, col, ''));
    for (let y = Math.ceil(-H / 2) + 1; y < H / 2; y++) if (y) glyphs.push(...numberGlyphs(String(y), [-0.12, y], 'left', 0.24, col, ''));
  }
  const grid = new Thing('_grid', 'shape', glyphs, [0, 0]);
  grid.layer = -3;
  grid.base.visible = true;
  world.add(grid, where);
}

export const _test = { gref, cross, clamp };
