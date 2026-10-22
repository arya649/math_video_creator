// The graph world: axes, plots, values, points, tangents, areas, vectors,
// fields and transforms of the plane.

import {
  type Ctx, TEXT_SIZES, arrive, color, num, readAppear, registerAction, str, natural, sheetText,
} from '../actions';
import { type Contour, type Pt, dist } from '../geom';
import { Axes, type Graph, type Warp, numberGlyphs, readAxes, AXES_KEYS } from '../graph/axes';
import { type Scope, complexMap, curveOf, fn, formatNumber, relationOf, roots, slope } from '../graph/expr';
import { Param } from '../graph/param';
import { arrowHead, fillGlyph, strokeGlyph } from '../shapes';
import { type Glyph, Thing } from '../thing';
import { withAlpha, mixColor } from '../color';
import { EASES, ScriptError, choice, clamp, ease, isObject, rng } from '../util';
import type { SceneWorld } from '../world';

const GRAPH: ['graph'] = ['graph'];

// ---- Helpers ----

/** Add a thing whose outlines are worked out every frame. */
function liveThing(ctx: Ctx, id: string, draw: (t: number) => Glyph[], where: string, kind: Thing['kind'] = 'shape'): Thing {
  const th = new Thing(id, kind, [], [0, 0]);
  const glyphs = draw(Infinity);
  th.base.glyphs = glyphs;
  th.build.glyphs = glyphs;
  ctx.world.add(th, where);
  ctx.world.livers.push((t) => {
    if (th.shown()) th.state.glyphs = draw(t);
  });
  return th;
}

function axesOf(ctx: Ctx, key = 'on'): Axes {
  const v = ctx.spec[key];
  if (v === undefined) return ctx.world.mainAxes(ctx.where);
  const a = ctx.world.axes.get(String(v));
  if (!a) {
    const g = ctx.world.graphs.get(String(v));
    if (g) return g.axes;
    throw new ScriptError(`there are no axes called "${String(v)}".`, `${ctx.where}.${key}`);
  }
  return a;
}

function graphOf(ctx: Ctx, ref: unknown, where: string): Graph {
  const g = typeof ref === 'string' ? ctx.world.graphs.get(ref) : undefined;
  if (!g) {
    const names = [...ctx.world.graphs.keys()];
    throw new ScriptError(`must name a graph drawn with plot${names.length ? ` (graphs so far: ${names.join(', ')})` : ''}, not ${JSON.stringify(ref)}.`, where);
  }
  return g;
}

/** A number, or the name of a value, read at each frame. */
function numberOrValue(world: SceneWorld, v: unknown, where: string): () => number {
  if (typeof v === 'number') return () => v;
  if (typeof v === 'string') {
    if (world.values.has(v)) return () => world.values.get(v)!.now;
    const f = fn(v, where);
    return () => f(world.scope());
  }
  throw new ScriptError(`must be a number, a value's name or a sum such as "a + 1", not ${JSON.stringify(v)}.`, where);
}

function rangeOf(world: SceneWorld, v: unknown, where: string): [() => number, () => number] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length !== 2) throw new ScriptError('must be [from, to].', where);
  return [numberOrValue(world, v[0], `${where}[0]`), numberOrValue(world, v[1], `${where}[1]`)];
}

const lineWidth = (ctx: Ctx, d = 4.5) => num(ctx, 'line_width', d);

/** The colour of something named in `symbols`, else the next theme colour. */
function graphColor(ctx: Ctx, id: string | undefined): string {
  const given = color(ctx, 'color');
  if (given) return given;
  if (id && ctx.world.symbolColors[id]) return ctx.world.symbolColors[id];
  const n = ctx.world.graphs.size + ctx.world.order.filter((t) => t.kind === 'shape' && t.id.startsWith('_curve')).length;
  return ctx.world.theme.colors[n % ctx.world.theme.colors.length];
}

/** Sample y = f(x) into contours on the sheet, broken where the curve jumps or leaves the axes. */
function sampleCurve(axes: Axes, f: (x: number) => number, a: number, b: number, n = 480, breaks = true): Contour[] {
  const out: Contour[] = [];
  const [y0, y1] = axes.y;
  const span = y1 - y0;
  const lo = y0 - span * 0.02, hi = y1 + span * 0.02;
  let cur: Pt[] = [];
  let prev: { x: number; y: number } | null = null;
  const flush = () => { if (cur.length > 1) out.push({ closed: false, pts: cur }); cur = []; };
  for (let k = 0; k <= n; k++) {
    const x = a + ((b - a) * k) / n;
    const y = f(x);
    const ok = Number.isFinite(y);
    if (!ok) { flush(); prev = null; continue; }
    if (prev && breaks && Math.abs(y - prev.y) > span * 0.9 && Math.sign(y - prev.y) !== 0) {
      // A jump (an asymptote): stop the line and start again.
      flush();
    }
    const inside = y >= lo && y <= hi;
    const pinside = prev ? prev.y >= lo && prev.y <= hi : false;
    if (prev && inside !== pinside) {
      // Cut the line where it crosses the edge of the axes.
      const edge = inside ? (prev.y < lo ? lo : hi) : (y < lo ? lo : hi);
      const u = (edge - prev.y) / (y - prev.y);
      const xe = prev.x + (x - prev.x) * u;
      cur.push(axes.toSheet([xe, edge]));
      if (!inside) flush();
    }
    if (inside) cur.push(axes.toSheet([x, y]));
    prev = { x, y };
  }
  flush();
  return out;
}

/** Contours where F(x, y) = 0, by marching squares, joined into lines. */
function implicitContours(axes: Axes, F: (x: number, y: number) => number, nx = 180, ny = 110): Contour[] {
  const [x0, x1] = axes.x, [y0, y1] = axes.y;
  const vals: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const row: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const v = F(x0 + ((x1 - x0) * i) / nx, y0 + ((y1 - y0) * j) / ny);
      row.push(v === 0 ? 1e-12 : v);
    }
    vals.push(row);
  }
  const P = (i: number, j: number): Pt => [x0 + ((x1 - x0) * i) / nx, y0 + ((y1 - y0) * j) / ny];
  // Each crossing is named by the grid edge it lies on, so the two cells that
  // share an edge agree exactly on where the curve crosses it.
  const point = new Map<string, Pt>();
  const cross = (i: number, j: number, horizontal: boolean): string => {
    const id = `${horizontal ? 'h' : 'v'}${i},${j}`;
    if (!point.has(id)) {
      const [i2, j2] = horizontal ? [i + 1, j] : [i, j + 1];
      const va = vals[j][i], vb = vals[j2][i2];
      const a = P(i, j), b = P(i2, j2);
      const u = va / (va - vb);
      point.set(id, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
    return id;
  };
  const segs: [string, string][] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = vals[j][i], b = vals[j][i + 1], c = vals[j + 1][i + 1], d = vals[j + 1][i];
    if (![a, b, c, d].every(Number.isFinite)) continue;
    const edges: string[] = [];
    if (a * b < 0) edges.push(cross(i, j, true));
    if (b * c < 0) edges.push(cross(i + 1, j, false));
    if (c * d < 0) edges.push(cross(i, j + 1, true));
    if (d * a < 0) edges.push(cross(i, j, false));
    if (edges.length === 2) segs.push([edges[0], edges[1]]);
    else if (edges.length === 4) { segs.push([edges[0], edges[1]]); segs.push([edges[2], edges[3]]); }
  }
  const byEnd = new Map<string, number[]>();
  segs.forEach((sg, k) => { for (const e of sg) { if (!byEnd.has(e)) byEnd.set(e, []); byEnd.get(e)!.push(k); } });
  const used = new Set<number>();
  const out: Contour[] = [];
  for (let k = 0; k < segs.length; k++) {
    if (used.has(k)) continue;
    used.add(k);
    const line = [segs[k][0], segs[k][1]];
    for (const dir of [1, -1]) {
      for (;;) {
        const end = dir === 1 ? line[line.length - 1] : line[0];
        const next = (byEnd.get(end) ?? []).find((m) => !used.has(m));
        if (next === undefined) break;
        used.add(next);
        const other = segs[next][0] === end ? segs[next][1] : segs[next][0];
        if (dir === 1) line.push(other); else line.unshift(other);
      }
    }
    const closed = line.length > 3 && line[0] === line[line.length - 1];
    out.push({ closed, pts: (closed ? line.slice(0, -1) : line).map((e) => axes.toSheet(point.get(e)!)) });
  }
  return out;
}

// ---- axes ----

function makeAxes(ctx: Ctx, id: string, spec: Record<string, unknown>, where: string, fromStart: boolean): Axes {
  const { world } = ctx;
  const o = readAxes(spec, { w: world.frameW, h: world.frameH }, where);
  if (spec.position !== undefined) o.center = world.point(spec.position, `${where}.position`);
  const a = new Axes(id, o);
  world.axes.set(id, a);
  let cacheKey = '';
  let cache: Glyph[] = [];
  const th = liveThing(ctx, id, () => {
    const k = `${a.x}|${a.y}|${a.warps.map((w) => w.u.toFixed(4)).join(',')}`;
    if (k !== cacheKey) { cache = a.glyphs(world.theme); cacheKey = k; }
    return cache;
  }, where);
  th.layer = -2;
  a.thing = th;
  if (fromStart) th.base.visible = true;
  return a;
}

/** A graph scene's own axes, made before its beats. */
export function makeWorldAxes(ctx: Ctx, spec: unknown, where: string) {
  if (spec === false) return;
  const s = spec === undefined ? {} : spec;
  if (!isObject(s)) throw new ScriptError('must be false, or the axes\' settings, such as { "x": [-5, 5], "y": [-3, 8] }.', where);
  for (const k of Object.keys(s)) if (!(AXES_KEYS as readonly string[]).includes(k)) throw new ScriptError(`"${k}" is not a setting of axes. Settings: ${AXES_KEYS.join(', ')}.`, where);
  const appear = s.appear === 'draw';
  const a = makeAxes({ ...ctx, spec: s }, 'axes', s, where, !appear);
  if (appear) arrive(ctx, a.thing, 'draw', ctx.start, 1.5);
}

registerAction('axes', {
  summary: 'Another set of axes, or a number plane.',
  worlds: GRAPH,
  params: [...AXES_KEYS],
  build(ctx) {
    const id = str(ctx, 'id') ?? (ctx.world.axes.has('axes') ? ctx.world.newId('axes') : 'axes');
    const a = makeAxes(ctx, id, ctx.spec, ctx.where, false);
    const { how } = readAppear(ctx, 'draw');
    const d = natural(ctx, 1.4);
    arrive(ctx, a.thing, how, ctx.start, d);
    return { end: ctx.start + d, thing: a.thing };
  },
}, ['coordinate_system']);

registerAction('rescale', {
  summary: 'Change the range of axes smoothly; everything on them follows.',
  worlds: GRAPH,
  params: ['who', 'x', 'y', 'ease'],
  build(ctx) {
    const a = axesOf(ctx, 'who');
    const read = (k: 'x' | 'y') => {
      const v = ctx.spec[k];
      if (v === undefined) return undefined;
      if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === 'number') || v[1] <= v[0]) throw new ScriptError('must be [from, to].', `${ctx.where}.${k}`);
      return v as [number, number];
    };
    const tx = read('x'), ty = read('y');
    const fx = [...a.o.x] as [number, number], fy = [...a.o.y] as [number, number];
    const d = natural(ctx, 1.5);
    const e = choice(ctx.spec.ease, EASES, `${ctx.where}.ease`, 'smooth');
    ctx.act({
      start: ctx.start, duration: d,
      apply(u) {
        const k = ease(e, u);
        // Each rescale moves from where the axes are now.
        if (tx) { const from = [...a.x]; a.x = [from[0] + (tx[0] - from[0]) * k, from[1] + (tx[1] - from[1]) * k]; }
        if (ty) { const from = [...a.y]; a.y = [from[0] + (ty[0] - from[0]) * k, from[1] + (ty[1] - from[1]) * k]; }
      },
    });
    void fx; void fy;
    return { end: ctx.start + d };
  },
});

// ---- plot ----

registerAction('plot', {
  summary: 'Draw a graph on axes.',
  worlds: GRAPH,
  params: ['on', 'math', 'tex', 'x_of_t', 'y_of_t', 't', 'r_of_theta', 'theta', 'implicit', 'x', 'label', 'label_at', 'color', 'line_width', 'dash', 'glow', 'draw', 'breaks', 'fill', 'fill_opacity', 'appear'],
  build(ctx) {
    const { spec, world } = ctx;
    const axes = axesOf(ctx);
    const id = str(ctx, 'id');
    const col = graphColor(ctx, id);
    const lw = lineWidth(ctx);
    const dash = spec.dash === true;
    if (spec.tex !== undefined && spec.math === undefined) {
      throw new ScriptError('graphs are written in plain maths with "math", such as "x^2 - 2" (LaTeX can be used for the label).', `${ctx.where}.tex`);
    }
    const xr = rangeOf(world, spec.x, `${ctx.where}.x`);
    const xRange = (): [number, number] => (xr ? [xr[0](), xr[1]()] : [axes.x[0], axes.x[1]]);
    let draw: (t: number) => Glyph[];
    let graph: Graph | undefined;
    let endPoint: () => Pt | undefined = () => undefined;
    const breaks = spec.breaks !== false;

    if (typeof spec.math === 'string' && /[<>≤≥]/.test(spec.math)) {
      // An inequality: shade where it is true, and draw its edge.
      const r = relationOf(spec.math, `${ctx.where}.math`)!;
      const fillCol = color(ctx, 'fill', col)!;
      const fo = num(ctx, 'fill_opacity', 0.35);
      draw = () => {
        const s = world.scope();
        const [x0, x1] = axes.x, [y0, y1] = axes.y;
        const cols = 220, rows = 160;
        const strips: Contour[] = [];
        const truth = (x: number, y: number) => {
          const v = r.lhs(x, y, s);
          return r.rel === '<' || r.rel === '<=' ? v < 0 : v > 0;
        };
        for (let i = 0; i < cols; i++) {
          const xa = x0 + ((x1 - x0) * i) / cols, xb = x0 + ((x1 - x0) * (i + 1.04)) / cols, xm = (xa + xb) / 2;
          let runStart: number | null = null;
          for (let j = 0; j <= rows; j++) {
            const y = y0 + ((y1 - y0) * j) / rows;
            const on = j < rows && truth(xm, y);
            if (on && runStart === null) runStart = y;
            if (!on && runStart !== null) {
              const p = [axes.toSheet([xa, runStart]), axes.toSheet([xb, runStart]), axes.toSheet([xb, y]), axes.toSheet([xa, y])];
              strips.push({ closed: true, pts: p });
              runStart = null;
            }
          }
        }
        const edge = implicitContours(axes, (x, y) => r.lhs(x, y, s));
        return [
          fillGlyph(strips, 'region', { color: withAlpha(fillCol, fo) }),
          strokeGlyph(edge, lw, 'curve', { color: col, dash: r.rel === '<' || r.rel === '>' || dash }),
        ];
      };
    } else if (typeof spec.math === 'string') {
      const c = curveOf(spec.math, `${ctx.where}.math`);
      for (const n of c.names) {
        if (!world.values.has(n)) throw new ScriptError(`uses "${n}", which is not a value in this scene. Make it first with { "do": "value", "name": "${n}", "start": 1 }.`, `${ctx.where}.math`);
      }
      graph = { id: id ?? world.newId('graph'), axes, thing: undefined as unknown as Thing, f: versioned(world, c.f) };
      const g = graph;
      draw = () => {
        const s = world.scope();
        const [a, b] = xRange();
        return [strokeGlyph(sampleCurve(axes, (x) => g.f(x, s), a, b, 480, breaks), lw, 'curve', { color: col, dash })];
      };
      endPoint = () => {
        const s = world.scope();
        const [a, b] = xRange();
        for (let k = 0; k <= 200; k++) {
          const x = b - ((b - a) * k) / 200;
          const y = g.f(x, s);
          if (Number.isFinite(y) && y >= axes.y[0] && y <= axes.y[1]) return axes.toSheet([x, y]);
        }
        return undefined;
      };
    } else if (spec.x_of_t !== undefined || spec.y_of_t !== undefined) {
      const fx = fn(String(spec.x_of_t ?? 't'), `${ctx.where}.x_of_t`), fy = fn(String(spec.y_of_t ?? 't'), `${ctx.where}.y_of_t`);
      const tr = rangeOf(world, spec.t ?? [0, 2 * Math.PI], `${ctx.where}.t`)!;
      draw = () => {
        const s = world.scope();
        const a = tr[0](), b = tr[1]();
        const pts: Pt[] = [];
        for (let k = 0; k <= 600; k++) {
          const t = a + ((b - a) * k) / 600;
          const p: Pt = [fx({ ...s, t }), fy({ ...s, t })];
          if (Number.isFinite(p[0]) && Number.isFinite(p[1])) pts.push(axes.toSheet(p));
        }
        return [strokeGlyph([{ closed: false, pts }], lw, 'curve', { color: col, dash })];
      };
    } else if (spec.r_of_theta !== undefined) {
      const fr = fn(String(spec.r_of_theta), `${ctx.where}.r_of_theta`);
      const tr = rangeOf(world, spec.theta ?? [0, 2 * Math.PI], `${ctx.where}.theta`)!;
      draw = () => {
        const s = world.scope();
        const a = tr[0](), b = tr[1]();
        const pts: Pt[] = [];
        for (let k = 0; k <= 720; k++) {
          const th = a + ((b - a) * k) / 720;
          const r = fr({ ...s, theta: th });
          if (Number.isFinite(r)) pts.push(axes.toSheet([r * Math.cos(th), r * Math.sin(th)]));
        }
        return [strokeGlyph([{ closed: false, pts }], lw, 'curve', { color: col, dash })];
      };
    } else if (typeof spec.implicit === 'string') {
      const r = relationOf(spec.implicit, `${ctx.where}.implicit`);
      if (!r || r.rel !== '=') throw new ScriptError('must be an equation in x and y, such as "x^2 + y^2 = 9".', `${ctx.where}.implicit`);
      draw = () => {
        const s = world.scope();
        return [strokeGlyph(implicitContours(axes, (x, y) => r.lhs(x, y, s)), lw, 'curve', { color: col, dash })];
      };
    } else {
      throw new ScriptError('needs what to draw: "math" (y in terms of x, or an inequality), "x_of_t" and "y_of_t", "r_of_theta", or "implicit".', ctx.where);
    }

    const th = liveThing(ctx, graph?.id ?? id ?? world.newId('curve'), draw, ctx.where);
    if (spec.glow === true) th.base.glow = 1;
    th.base.glowColor = col;
    if (graph) { graph.thing = th; world.graphs.set(graph.id, graph); }
    const how = spec.draw === 'all' ? 'fade' : readAppear(ctx, 'draw').how;
    const d = natural(ctx, 1.6);
    arrive(ctx, th, how, ctx.start, d);

    if (typeof spec.label === 'string') {
      const lab = sheetText(ctx, world.newId('graphlabel'), spec.label, TEXT_SIZES.medium, [0, 0], { color: col });
      world.add(lab, `${ctx.where}.label`);
      const at = spec.label_at !== undefined && isObject(spec.label_at) && graph
        ? world.mathPoint({ on: graph.id, ...spec.label_at }, `${ctx.where}.label_at`)
        : endPoint;
      const place = () => {
        const p = at?.();
        if (!p) return;
        const b = lab.text!.box;
        lab.state.x = Math.min(p[0] + 0.15 - b.x0, world.frameW / 2 - 0.2 - b.x1);
        lab.state.y = Math.min(p[1] + 0.15 - b.y0, world.frameH / 2 - 0.25 - b.y1);
      };
      const p0 = at?.();
      if (p0) { lab.base.x = lab.build.x = p0[0] + 0.15 - lab.text!.box.x0; lab.base.y = lab.build.y = p0[1] + 0.15 - lab.text!.box.y0; }
      world.livers.push(() => { if (lab.shown()) place(); });
      arrive(ctx, lab, 'rise', ctx.start + d * 0.8, 0.5);
    }
    return { end: ctx.start + d, thing: th };
  },
}, ['graph', 'curve', 'function']);

/** A graph's function, which `shift_graph` can change over time. */
interface Version { start: number; duration: number; f: (x: number, s: Scope) => number }
const VERSIONS = new WeakMap<object, Version[]>();

function versioned(world: SceneWorld, f0: (x: number, s: Scope) => number): (x: number, s: Scope) => number {
  const versions: Version[] = [];
  const g = (x: number, s: Scope) => {
    let f = f0;
    let prev = f0;
    for (const v of versions) {
      if (world.now < v.start) break;
      prev = f;
      f = v.f;
      const u = v.duration <= 0 ? 1 : clamp((world.now - v.start) / v.duration);
      if (u < 1) {
        const k = ease('smooth', u);
        const a = prev(x, s), b = f(x, s);
        return a + (b - a) * k;
      }
    }
    return f(x, s);
  };
  VERSIONS.set(g, versions);
  return g;
}

// ---- values ----

registerAction('value', {
  summary: 'A named number that can change over time; everything that uses it follows.',
  params: ['name', 'start', 'slider', 'show', 'decimals', 'color'],
  required: ['name'],
  build(ctx) {
    const { world } = ctx;
    const name = str(ctx, 'name', true)!;
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) throw new ScriptError('must be a letter or a short name, such as "a" or "speed".', `${ctx.where}.name`);
    if (['x', 'y', 't', 'z', 'e', 'pi', 'i', 'theta'].includes(name)) throw new ScriptError(`"${name}" is kept for graphs; choose another name.`, `${ctx.where}.name`);
    if (world.values.has(name)) throw new ScriptError(`there is already a value called "${name}".`, `${ctx.where}.name`);
    const start = num(ctx, 'start', 1);
    const decimals = Math.round(num(ctx, 'decimals', 2));
    const v = { start, now: start, decimals };
    world.values.set(name, v);
    const col = color(ctx, 'color') ?? world.symbolColors[name] ?? world.theme.accent;
    const label = (val: number) => `${name} = ${formatNumber(val, decimals)}`;
    const readout = (at: Pt, side: 'right' | 'center') => numberGlyphs(label(v.now), at, side, 0.36, col, '');
    let thing: Thing | undefined;
    if (isObject(ctx.spec.slider)) {
      const sl = ctx.spec.slider;
      const range = Array.isArray(sl.range) && sl.range.length === 2 ? sl.range.map(Number) as [number, number] : [Math.min(0, start), Math.max(start * 2, 1)] as [number, number];
      const at = world.point(sl.position ?? 'top_right', `${ctx.where}.slider.position`);
      const w = 3;
      thing = liveThing(ctx, ctx.spec.id ? String(ctx.spec.id) : world.newId('slider'), () => {
        const u = clamp((v.now - range[0]) / (range[1] - range[0]));
        const x0 = at[0] - w / 2, x = x0 + w * u;
        return [
          strokeGlyph([{ closed: false, pts: [[x0, at[1]], [x0 + w, at[1]]] }], 4, 'track', { color: withAlpha(world.theme.ink, 0.45) }),
          strokeGlyph([{ closed: false, pts: [[x0, at[1]], [x, at[1]]] }], 4, 'track', { color: col }),
          fillGlyph([{ closed: true, pts: Array.from({ length: 24 }, (_, k) => [x + 0.12 * Math.cos((k / 24) * Math.PI * 2), at[1] + 0.12 * Math.sin((k / 24) * Math.PI * 2)] as Pt) }], 'knob', { color: col }),
          ...readout([at[0], at[1] + 0.42], 'center'),
        ];
      }, ctx.where);
      thing.screen = true;
    } else if (ctx.spec.show !== undefined) {
      const at = world.point(ctx.spec.show, `${ctx.where}.show`);
      thing = liveThing(ctx, ctx.spec.id ? String(ctx.spec.id) : world.newId('readout'), () => readout(at, 'center'), ctx.where);
      thing.screen = true;
    }
    if (thing) arrive(ctx, thing, 'fade', ctx.start, 0.5);
    return { end: ctx.start + (thing ? 0.5 : 0), thing };
  },
}, ['parameter']);

registerAction('set', {
  summary: 'Change a value over the beat.',
  params: ['name', 'to', 'ease'],
  required: ['name', 'to'],
  build(ctx) {
    const name = str(ctx, 'name', true)!;
    const v = ctx.world.values.get(name);
    if (!v) throw new ScriptError(`there is no value called "${name}". Make it first with { "do": "value", "name": "${name}" }.`, `${ctx.where}.name`);
    const list = Array.isArray(ctx.spec.to) ? ctx.spec.to : [ctx.spec.to];
    if (!list.every((n) => typeof n === 'number')) throw new ScriptError('must be a number or a list of numbers.', `${ctx.where}.to`);
    const e = choice(ctx.spec.ease, EASES, `${ctx.where}.ease`, 'smooth');
    const d = natural(ctx, 1.5 * list.length);
    const per = d / list.length;
    list.forEach((to, i) => {
      ctx.act({
        start: ctx.start + i * per, duration: per,
        apply(u) { const from = v.now; v.now = from + ((to as number) - from) * ease(e, u); },
      });
    });
    return { end: ctx.start + d };
  },
});

// ---- points ----

interface Tracked { param: Param; where: (x: number) => Pt; graph?: Graph }
const TRACKED = new WeakMap<Thing, Tracked>();

registerAction('point', {
  summary: 'A dot on a graph or axes, which can slide.',
  worlds: GRAPH,
  params: ['position', 'label', 'drops', 'coords', 'trace', 'color', 'radius'],
  required: ['position'],
  build(ctx) {
    const { world } = ctx;
    const pos = ctx.spec.position;
    const col = color(ctx, 'color', world.theme.accent)!;
    const r = num(ctx, 'radius', 0.09);
    let tracked: Tracked;
    if (isObject(pos) && typeof pos.on === 'string' && world.graphs.has(pos.on)) {
      const g = world.graphs.get(pos.on)!;
      if (typeof pos.x !== 'number') throw new ScriptError('needs "x": a number, where on the graph.', `${ctx.where}.position.x`);
      tracked = { param: new Param(pos.x), graph: g, where: (x) => g.axes.toSheet([x, g.f(x, world.scope())]) };
    } else if (isObject(pos) && ('x' in pos || 'y' in pos)) {
      // On axes: x moves along; y stays.
      const a = typeof pos.on === 'string' ? world.axes.get(pos.on) ?? world.mainAxes(ctx.where) : world.mainAxes(ctx.where);
      const y = typeof pos.y === 'number' ? pos.y : 0;
      tracked = { param: new Param(typeof pos.x === 'number' ? pos.x : 0), where: (x) => a.toSheet([x, y]) };
    } else {
      const p = world.point(pos, `${ctx.where}.position`);
      tracked = { param: new Param(0), where: () => p };
    }
    const axes = tracked.graph?.axes ?? (world.axes.size ? world.mainAxes(ctx.where) : undefined);
    const id = str(ctx, 'id') ?? world.newId('point');
    const traceCol = typeof ctx.spec.trace === 'string' ? color(ctx, 'trace')! : col;
    const th = liveThing(ctx, id, (t) => {
      const x = tracked.param.at(t === Infinity ? Infinity : t);
      const p = tracked.where(x);
      const out: Glyph[] = [];
      if (ctx.spec.trace !== undefined && ctx.spec.trace !== false && t !== Infinity) {
        const from = tracked.param.firstChange();
        if (from !== undefined && t > from) {
          const pts: Pt[] = [];
          for (let k = 0; k <= 60; k++) pts.push(tracked.where(tracked.param.at(from + ((t - from) * k) / 60)));
          out.push(strokeGlyph([{ closed: false, pts }], 4, 'trace', { color: traceCol }));
        }
      }
      if ((ctx.spec.drops !== undefined && ctx.spec.drops !== false) && axes) {
        const xv = (p[0] - axes.o.center[0]) / axes.unit()[0] + (axes.x[0] + axes.x[1]) / 2;
        const yv = (p[1] - axes.o.center[1]) / axes.unit()[1] + (axes.y[0] + axes.y[1]) / 2;
        const lines: Contour[] = [];
        if (ctx.spec.drops !== 'y') lines.push({ closed: false, pts: [p, axes.toSheet([xv, Math.min(Math.max(0, axes.y[0]), axes.y[1])])] });
        if (ctx.spec.drops !== 'x') lines.push({ closed: false, pts: [p, axes.toSheet([Math.min(Math.max(0, axes.x[0]), axes.x[1]), yv])] });
        out.push(strokeGlyph(lines, 2.5, 'drop', { color: withAlpha(col, 0.8), dash: true }));
      }
      out.push(fillGlyph([{ closed: true, pts: Array.from({ length: 24 }, (_, k) => [p[0] + r * Math.cos((k / 24) * Math.PI * 2), p[1] + r * Math.sin((k / 24) * Math.PI * 2)] as Pt) }], 'dot', { color: col }));
      if (ctx.spec.coords === true && axes) {
        const xv = tracked.graph ? x : (p[0] - axes.o.center[0]) / axes.unit()[0] + (axes.x[0] + axes.x[1]) / 2;
        const yv = tracked.graph ? tracked.graph.f(x, world.scope()) : (p[1] - axes.o.center[1]) / axes.unit()[1] + (axes.y[0] + axes.y[1]) / 2;
        out.push(...numberGlyphs(`(${formatNumber(xv)},\\ ${formatNumber(yv)})`, [p[0] + 0.18, p[1] + 0.18], 'right', 0.34, world.theme.ink, ''));
      }
      if (typeof ctx.spec.label === 'string') out.push(...numberGlyphs(ctx.spec.label, [p[0] - 0.15, p[1] + 0.15], 'left', 0.42, col, ''));
      return out;
    }, ctx.where);
    TRACKED.set(th, tracked);
    const d = natural(ctx, 0.5);
    arrive(ctx, th, 'pop', ctx.start, d);
    return { end: ctx.start + d, thing: th };
  },
}, ['dot_on']);

registerAction('slide', {
  summary: 'Move a point, tangent or secant along what it is on.',
  worlds: GRAPH,
  params: ['who', 'to', 'ease'],
  required: ['who', 'to'],
  build(ctx) {
    const th = ctx.world.get(ctx.spec.who, `${ctx.where}.who`);
    const tr = TRACKED.get(th);
    if (!tr) throw new ScriptError(`"${th.id}" cannot slide; points, tangents and secants can.`, `${ctx.where}.who`);
    const to = ctx.spec.to;
    const target = typeof to === 'number' ? to : isObject(to) && typeof to.x === 'number' ? to.x : NaN;
    if (!Number.isFinite(target)) throw new ScriptError('must be a number (the new x), or { "x": a number }.', `${ctx.where}.to`);
    const d = natural(ctx, 2);
    tr.param.to(target, ctx.start, d, choice(ctx.spec.ease, EASES, `${ctx.where}.ease`, 'smooth'));
    return { end: ctx.start + d };
  },
});

// ---- tangent and secant ----

registerAction('tangent', {
  summary: 'A line touching a graph, which can slide along it.',
  worlds: GRAPH,
  params: ['on', 'x', 'length', 'slope', 'triangle', 'color', 'line_width'],
  required: ['on', 'x'],
  build(ctx) {
    const { world } = ctx;
    const g = graphOf(ctx, ctx.spec.on, `${ctx.where}.on`);
    const col = color(ctx, 'color', world.theme.accent)!;
    const len = num(ctx, 'length', 4);
    const param = new Param(num(ctx, 'x', 0));
    const lw = lineWidth(ctx, 4);
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('tangent'), (t) => {
      const s = world.scope();
      const f = (x: number) => g.f(x, s);
      const x = param.at(t);
      const y = f(x), m = slope(f, x);
      if (!Number.isFinite(y) || !Number.isFinite(m)) return [];
      const p = g.axes.toSheet([x, y]);
      const q = g.axes.toSheet([x + 1, y + m]);
      const dl = dist(p, q) || 1;
      const ux = (q[0] - p[0]) / dl, uy = (q[1] - p[1]) / dl;
      const out: Glyph[] = [
        strokeGlyph([{ closed: false, pts: [[p[0] - ux * len / 2, p[1] - uy * len / 2], [p[0] + ux * len / 2, p[1] + uy * len / 2]] }], lw, 'tangent', { color: col }),
        fillGlyph([{ closed: true, pts: Array.from({ length: 20 }, (_, k) => [p[0] + 0.08 * Math.cos((k / 20) * Math.PI * 2), p[1] + 0.08 * Math.sin((k / 20) * Math.PI * 2)] as Pt) }], 'dot', { color: col }),
      ];
      if (ctx.spec.triangle === true) {
        const run = 1;
        const a = g.axes.toSheet([x + run, y]), b = g.axes.toSheet([x + run, y + m * run]);
        out.push(strokeGlyph([{ closed: false, pts: [p, a, b] }], 3, 'triangle', { color: withAlpha(world.theme.ink, 0.85) }));
        out.push(...numberGlyphs('dx', [(p[0] + a[0]) / 2, a[1] - 0.12 * Math.sign(m || 1)], m >= 0 ? 'below' : 'above', 0.32, world.theme.ink, ''));
        out.push(...numberGlyphs('dy', [a[0] + 0.12, (a[1] + b[1]) / 2], 'right', 0.32, world.theme.ink, ''));
      }
      // The slope's value sits beside the touching point, on the side away from the curve.
      if (ctx.spec.slope === true) out.push(...numberGlyphs(`\\text{slope} = ${formatNumber(m)}`, [p[0] + (m > 0 ? -0.35 : 0.35), p[1] + 0.55], m > 0 ? 'left' : 'right', 0.36, col, ''));
      return out;
    }, ctx.where);
    TRACKED.set(th, { param, where: (x) => g.axes.toSheet([x, g.f(x, world.scope())]), graph: g });
    const d = natural(ctx, 0.9);
    arrive(ctx, th, 'draw', ctx.start, d);
    return { end: ctx.start + d, thing: th };
  },
}, ['slope_line']);

registerAction('secant', {
  summary: 'A line through two points of a graph; it can close in to the tangent.',
  worlds: GRAPH,
  params: ['on', 'x', 'dx', 'close_in', 'color', 'length'],
  required: ['on', 'x'],
  build(ctx) {
    const { world } = ctx;
    const g = graphOf(ctx, ctx.spec.on, `${ctx.where}.on`);
    const col = color(ctx, 'color', world.theme.shades.green)!;
    const x0 = num(ctx, 'x', 0);
    const dx = new Param(num(ctx, 'dx', 2));
    const d = natural(ctx, ctx.spec.close_in === true ? 4 : 0.9);
    if (ctx.spec.close_in === true) dx.to(0.001, ctx.start + 0.9, d - 0.9, 'smooth', true);
    const ext = num(ctx, 'length', 1.5);
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('secant'), (t) => {
      const s = world.scope();
      const h = dx.at(t);
      const a: Pt = [x0, g.f(x0, s)], b: Pt = [x0 + h, g.f(x0 + h, s)];
      if (![...a, ...b].every(Number.isFinite)) return [];
      const pa = g.axes.toSheet(a), pb = g.axes.toSheet(b);
      const L = dist(pa, pb) || 1e-6;
      const ux = (pb[0] - pa[0]) / L, uy = (pb[1] - pa[1]) / L;
      const dot = (p: Pt) => fillGlyph([{ closed: true, pts: Array.from({ length: 20 }, (_, k) => [p[0] + 0.08 * Math.cos((k / 20) * Math.PI * 2), p[1] + 0.08 * Math.sin((k / 20) * Math.PI * 2)] as Pt) }], 'dot', { color: col });
      return [
        strokeGlyph([{ closed: false, pts: [[pa[0] - ux * ext, pa[1] - uy * ext], [pb[0] + ux * ext, pb[1] + uy * ext]] }], 4, 'secant', { color: col }),
        dot(pa), dot(pb),
      ];
    }, ctx.where);
    arrive(ctx, th, 'draw', ctx.start, 0.9);
    return { end: ctx.start + d, thing: th };
  },
}, ['chord']);

// ---- area ----

interface AreaInfo { n: Param }
const AREAS = new WeakMap<Thing, AreaInfo>();

registerAction('area', {
  summary: 'Fill the area under a graph or between two, or fill it with rectangles.',
  worlds: GRAPH,
  params: ['on', 'between', 'x', 'rectangles', 'rule', 'value', 'color', 'fill_from', 'fill_opacity'],
  required: ['x'],
  build(ctx) {
    const { world } = ctx;
    let top: Graph, bottom: Graph | undefined;
    if (Array.isArray(ctx.spec.between)) {
      if (ctx.spec.between.length !== 2) throw new ScriptError('must name two graphs.', `${ctx.where}.between`);
      top = graphOf(ctx, ctx.spec.between[0], `${ctx.where}.between[0]`);
      bottom = graphOf(ctx, ctx.spec.between[1], `${ctx.where}.between[1]`);
    } else top = graphOf(ctx, ctx.spec.on, `${ctx.where}.on`);
    const axes = top.axes;
    const xr = rangeOf(world, ctx.spec.x, `${ctx.where}.x`)!;
    const col = color(ctx, 'color', world.symbolColors[top.id] ?? world.theme.shades.blue)!;
    const fo = num(ctx, 'fill_opacity', 0.5);
    const rule = choice(ctx.spec.rule, ['left', 'right', 'middle', 'trapezium'] as const, `${ctx.where}.rule`, 'left');
    const n = new Param(typeof ctx.spec.rectangles === 'number' ? ctx.spec.rectangles : 0);
    const from = choice(ctx.spec.fill_from, ['left', 'bottom'] as const, `${ctx.where}.fill_from`, 'left');
    let th: Thing;
    const draw = (t: number): Glyph[] => {
      const s = world.scope();
      const f = (x: number) => top.f(x, s);
      const g = bottom ? (x: number) => bottom!.f(x, s) : () => 0;
      const a = xr[0](), bRaw = xr[1]();
      const shown = t === Infinity ? 1 : clamp(th?.state.drawn ?? 1);
      const b = from === 'left' ? a + (bRaw - a) * shown : bRaw;
      const k = from === 'bottom' ? shown : 1;
      const rects = Math.round(n.at(t));
      const out: Glyph[] = [];
      if (rects > 0) {
        const w = (bRaw - a) / rects;
        const cs: Contour[] = [];
        for (let i = 0; i < rects; i++) {
          const xa = a + i * w, xb = xa + w;
          if (xa >= b) break;
          const h = rule === 'left' ? f(xa) : rule === 'right' ? f(xb) : rule === 'middle' ? f((xa + xb) / 2) : NaN;
          const base = g((xa + xb) / 2);
          if (rule === 'trapezium') {
            cs.push({ closed: true, pts: [axes.toSheet([xa, base]), axes.toSheet([xa, base + (f(xa) - base) * k]), axes.toSheet([xb, base + (f(xb) - base) * k]), axes.toSheet([xb, base])] });
          } else if (Number.isFinite(h)) {
            cs.push({ closed: true, pts: [axes.toSheet([xa, base]), axes.toSheet([xa, base + (h - base) * k]), axes.toSheet([xb, base + (h - base) * k]), axes.toSheet([xb, base])] });
          }
        }
        out.push(fillGlyph(cs, 'rects', { color: withAlpha(col, fo) }));
        out.push(strokeGlyph(cs, Math.max(0.8, 2.5 - rects / 40), 'rect-edges', { color: withAlpha(col, 0.95) }));
      } else {
        const N = 160;
        const upper: Pt[] = [], lower: Pt[] = [];
        for (let i = 0; i <= N; i++) {
          const x = a + ((b - a) * i) / N;
          const base = g(x);
          const y = f(x);
          if (!Number.isFinite(y) || !Number.isFinite(base)) continue;
          upper.push(axes.toSheet([x, base + (y - base) * k]));
          lower.push(axes.toSheet([x, base]));
        }
        if (upper.length > 1) out.push(fillGlyph([{ closed: true, pts: [...upper, ...lower.reverse()] }], 'area', { color: withAlpha(col, fo) }));
      }
      if (ctx.spec.value === true && t !== Infinity && shown >= 1) {
        // Simpson's rule for the true area.
        const N = 200, h = (bRaw - a) / N;
        let sum = 0;
        for (let i = 0; i <= N; i++) {
          const x = a + i * h;
          const v = f(x) - g(x);
          sum += (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * (Number.isFinite(v) ? v : 0);
        }
        const area = (sum * h) / 3;
        const mid = (a + bRaw) / 2;
        const p = axes.toSheet([mid, (f(mid) + g(mid)) / 2]);
        const label = rects > 0 ? `\\approx ${formatNumber(rectSum(f, g, a, bRaw, rects, rule))}` : `= ${formatNumber(area)}`;
        out.push(...numberGlyphs(label, p, 'center', 0.4, world.theme.ink, ''));
      }
      // Drawing on is done by the sweep above, so the picture is shown whole.
      if (th && t !== Infinity) th.state.drawn = 1;
      return out;
    };
    th = liveThing(ctx, str(ctx, 'id') ?? world.newId('area'), draw, ctx.where);
    th.layer = -1;
    AREAS.set(th, { n });
    const d = natural(ctx, 1.4);
    ctx.act({ start: ctx.start, duration: d, apply(u) { th.state.visible = true; th.state.drawn = ease('smooth', u); } });
    return { end: ctx.start + d, thing: th };
  },
}, ['integral', 'shade']);

function rectSum(f: (x: number) => number, g: (x: number) => number, a: number, b: number, n: number, rule: string): number {
  const w = (b - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const xa = a + i * w, xb = xa + w;
    const h = rule === 'left' ? f(xa) : rule === 'right' ? f(xb) : rule === 'middle' ? f((xa + xb) / 2) : (f(xa) + f(xb)) / 2;
    s += (h - g((xa + xb) / 2)) * w;
  }
  return s;
}

registerAction('refine', {
  summary: 'Make the rectangles of an area thinner and more numerous.',
  worlds: GRAPH,
  params: ['who', 'to'],
  required: ['who', 'to'],
  build(ctx) {
    const th = ctx.world.get(ctx.spec.who, `${ctx.where}.who`);
    const info = AREAS.get(th);
    if (!info || info.n.last <= 0) throw new ScriptError(`"${th.id}" is not an area made with rectangles.`, `${ctx.where}.who`);
    const to = num(ctx, 'to', 64);
    const d = natural(ctx, 3);
    info.n.to(to, ctx.start, d, 'smooth', true);
    return { end: ctx.start + d };
  },
});

// ---- marks on graphs ----

const FINDS = ['roots', 'max', 'min', 'turning', 'intersections', 'y_intercept', 'inflection'] as const;

registerAction('mark', {
  summary: 'Find and mark special points of a graph.',
  worlds: GRAPH,
  params: ['on', 'find', 'label', 'color'],
  required: ['on', 'find'],
  build(ctx) {
    const { world } = ctx;
    const find = choice(ctx.spec.find, FINDS, `${ctx.where}.find`);
    const ons = Array.isArray(ctx.spec.on) ? ctx.spec.on : [ctx.spec.on];
    const gs = ons.map((o, i) => graphOf(ctx, o, `${ctx.where}.on${Array.isArray(ctx.spec.on) ? `[${i}]` : ''}`));
    const g = gs[0];
    const s = world.scope();
    const f = (x: number) => g.f(x, s);
    const [a, b] = g.axes.x;
    let xs: number[];
    switch (find) {
      case 'roots': xs = roots(f, a, b); break;
      case 'y_intercept': xs = [0]; break;
      case 'intersections': {
        if (gs.length !== 2) throw new ScriptError('needs two graphs in "on" to find where they meet.', `${ctx.where}.on`);
        xs = roots((x) => f(x) - gs[1].f(x, s), a, b);
        break;
      }
      case 'inflection': xs = roots((x) => slope((z) => slope(f, z, 1e-3), x, 1e-3), a, b, 400); break;
      default: {
        const turning = roots((x) => slope(f, x), a, b);
        const second = (x: number) => slope((z) => slope(f, z), x, 1e-3);
        xs = turning.filter((x) => (find === 'max' ? second(x) < 0 : find === 'min' ? second(x) > 0 : true));
      }
    }
    xs = xs.filter((x) => { const y = f(x); return Number.isFinite(y) && y >= g.axes.y[0] && y <= g.axes.y[1]; });
    if (!xs.length) throw new ScriptError(`found no ${find.replace('_', ' ')} of "${g.id}" inside the axes.`, ctx.where);
    const col = color(ctx, 'color', world.theme.accent)!;
    const label = ctx.spec.label;
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('mark'), () => {
      const sc = world.scope();
      const out: Glyph[] = [];
      for (const x of xs) {
        const y = g.f(x, sc);
        const p = g.axes.toSheet([x, y]);
        out.push(fillGlyph([{ closed: true, pts: Array.from({ length: 24 }, (_, k) => [p[0] + 0.1 * Math.cos((k / 24) * Math.PI * 2), p[1] + 0.1 * Math.sin((k / 24) * Math.PI * 2)] as Pt) }], 'dot', { color: col }));
        const text = label === 'coords' || label === true ? `(${formatNumber(x)},\\ ${formatNumber(y)})` : typeof label === 'string' ? label : '';
        if (text) out.push(...numberGlyphs(text, [p[0] + 0.15, p[1] + 0.2], 'right', 0.34, col, ''));
      }
      return out;
    }, ctx.where);
    const d = natural(ctx, 0.6);
    arrive(ctx, th, 'pop', ctx.start, d);
    return { end: ctx.start + d, thing: th };
  },
}, ['feature']);

registerAction('asymptote', {
  summary: 'A dashed line a graph comes closer and closer to.',
  worlds: GRAPH,
  params: ['on', 'x', 'y', 'color'],
  build(ctx) {
    const a = axesOf(ctx);
    if (typeof ctx.spec.x !== 'number' && typeof ctx.spec.y !== 'number') throw new ScriptError('needs "x" (an upright line) or "y" (a level one).', ctx.where);
    const col = color(ctx, 'color', withAlpha(ctx.world.theme.ink, 0.6))!;
    const th = liveThing(ctx, str(ctx, 'id') ?? ctx.world.newId('asymptote'), () => {
      const p = typeof ctx.spec.x === 'number'
        ? [a.toSheet([ctx.spec.x, a.y[0]]), a.toSheet([ctx.spec.x, a.y[1]])]
        : [a.toSheet([a.x[0], ctx.spec.y as number]), a.toSheet([a.x[1], ctx.spec.y as number])];
      return [strokeGlyph([{ closed: false, pts: p }], 3, 'asymptote', { color: col, dash: true })];
    }, ctx.where);
    const d = natural(ctx, 0.8);
    arrive(ctx, th, 'draw', ctx.start, d);
    return { end: ctx.start + d, thing: th };
  },
});

registerAction('limit', {
  summary: 'Dots run along a graph towards x, from one side or both, showing their values.',
  worlds: GRAPH,
  params: ['on', 'x', 'from', 'color'],
  required: ['on', 'x'],
  build(ctx) {
    const { world } = ctx;
    const g = graphOf(ctx, ctx.spec.on, `${ctx.where}.on`);
    const x = num(ctx, 'x', 0);
    const sides = choice(ctx.spec.from, ['both', 'left', 'right'] as const, `${ctx.where}.from`, 'both');
    const col = color(ctx, 'color', world.theme.accent)!;
    const d = natural(ctx, 3);
    const span = (g.axes.x[1] - g.axes.x[0]) * 0.25;
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('limit'), (t) => {
      const u = t === Infinity ? 1 : clamp((t - ctx.start) / d);
      const gap = span * 0.004 ** ease('out', u);
      const out: Glyph[] = [];
      for (const side of sides === 'both' ? [-1, 1] : sides === 'left' ? [-1] : [1]) {
        const xv = x + side * gap;
        const y = g.f(xv, world.scope());
        if (!Number.isFinite(y)) continue;
        const p = g.axes.toSheet([xv, y]);
        out.push(fillGlyph([{ closed: true, pts: Array.from({ length: 20 }, (_, k) => [p[0] + 0.08 * Math.cos((k / 20) * Math.PI * 2), p[1] + 0.08 * Math.sin((k / 20) * Math.PI * 2)] as Pt) }], 'dot', { color: col }));
        out.push(...numberGlyphs(formatNumber(y, 3), [p[0] + side * 0.2, p[1] + 0.25], side < 0 ? 'left' : 'right', 0.32, col, ''));
      }
      return out;
    }, ctx.where);
    arrive(ctx, th, 'fade', ctx.start, 0.4);
    return { end: ctx.start + d, thing: th };
  },
});

registerAction('shift_graph', {
  summary: 'A graph changes to another, shifting, stretching or flipping, with a ghost of the old one.',
  worlds: GRAPH,
  params: ['who', 'to', 'ghost'],
  required: ['who', 'to'],
  build(ctx) {
    const { world } = ctx;
    const g = graphOf(ctx, ctx.spec.who, `${ctx.where}.who`);
    const c = curveOf(String(ctx.spec.to), `${ctx.where}.to`);
    const versions = VERSIONS.get(g.f);
    if (!versions) throw new ScriptError(`"${g.id}" cannot change.`, `${ctx.where}.who`);
    const d = natural(ctx, 1.6);
    if (ctx.spec.ghost === true) {
      // A faint copy of the graph as it was.
      const before = versions.length ? versions[versions.length - 1].f : null;
      const now = g.f;
      const ghostF = before ?? ((x: number, s: Scope) => { const saved = world.now; world.now = ctx.start - 1e-6; const v = now(x, s); world.now = saved; return v; });
      const col = withAlpha(world.theme.ink, 0.3);
      const gh = liveThing(ctx, world.newId('ghost'), () => [strokeGlyph(sampleCurve(g.axes, (x) => ghostF(x, world.scope()), g.axes.x[0], g.axes.x[1]), 3, 'ghost', { color: col, dash: true })], ctx.where);
      gh.layer = -1;
      ctx.act({ start: ctx.start, duration: 0.3, apply(u) { gh.state.visible = true; gh.state.opacity *= u; } });
    }
    versions.push({ start: ctx.start, duration: d, f: c.f });
    return { end: ctx.start + d, thing: g.thing };
  },
}, ['transform_graph']);

registerAction('table_of_values', {
  summary: 'A table of x and f(x) that fills in row by row, a dot appearing on the graph for each.',
  worlds: GRAPH,
  params: ['on', 'x', 'position', 'lag', 'color'],
  required: ['on', 'x'],
  build(ctx) {
    const { world } = ctx;
    const g = graphOf(ctx, ctx.spec.on, `${ctx.where}.on`);
    if (!Array.isArray(ctx.spec.x) || !ctx.spec.x.every((v) => typeof v === 'number')) throw new ScriptError('must be a list of numbers.', `${ctx.where}.x`);
    const xs = ctx.spec.x as number[];
    const s = world.scope();
    const col = color(ctx, 'color', world.symbolColors[g.id] ?? world.theme.accent)!;
    const rowH = 0.55, colW = 1.5;
    const at = world.point(ctx.spec.position ?? 'top_left', `${ctx.where}.position`);
    const lag = num(ctx, 'lag', 0.45);
    const head = [...numberGlyphs('x', [at[0] - colW / 2, at[1]], 'center', 0.38, world.theme.ink, ''), ...numberGlyphs(`${g.id}(x)`, [at[0] + colW / 2, at[1]], 'center', 0.38, col, '')];
    const frame: Glyph = strokeGlyph([
      { closed: false, pts: [[at[0] - colW, at[1] - rowH / 2], [at[0] + colW, at[1] - rowH / 2]] },
      { closed: false, pts: [[at[0], at[1] + rowH / 2], [at[0], at[1] - rowH / 2 - rowH * xs.length]] },
    ], 2.5, 'table', { color: withAlpha(world.theme.ink, 0.6) });
    const table = new Thing(str(ctx, 'id') ?? world.newId('table'), 'shape', [frame, ...head], [0, 0]);
    table.screen = true;
    world.add(table, ctx.where);
    arrive(ctx, table, 'draw', ctx.start, 0.6);
    xs.forEach((x, i) => {
      const y = g.f(x, s);
      const ry = at[1] - rowH * (i + 1);
      const row = new Thing(world.newId('row'), 'shape', [
        ...numberGlyphs(formatNumber(x, Number.isInteger(x) ? 0 : 2), [at[0] - colW / 2, ry], 'center', 0.36, world.theme.ink, ''),
        ...numberGlyphs(formatNumber(y, Number.isInteger(y) ? 0 : 2), [at[0] + colW / 2, ry], 'center', 0.36, col, ''),
      ], [0, 0]);
      row.screen = true;
      world.add(row, ctx.where);
      const start = ctx.start + 0.6 + i * lag;
      arrive(ctx, row, 'fade', start, 0.3);
      if (Number.isFinite(y)) {
        const dotT = liveThing(ctx, world.newId('tdot'), () => {
          const p = g.axes.toSheet([x, g.f(x, world.scope())]);
          return [fillGlyph([{ closed: true, pts: Array.from({ length: 20 }, (_, k) => [p[0] + 0.09 * Math.cos((k / 20) * Math.PI * 2), p[1] + 0.09 * Math.sin((k / 20) * Math.PI * 2)] as Pt) }], 'dot', { color: col })];
        }, ctx.where);
        arrive(ctx, dotT, 'pop', start + 0.15, 0.4);
      }
    });
    return { end: ctx.start + 0.6 + xs.length * lag, thing: table };
  },
}, ['values_table']);

// ---- vectors ----

interface VectorInfo { axes: Axes; to: Pt; from: { x: Param; y: Param } }
const VECTORS = new WeakMap<Thing, VectorInfo>();

function vectorGlyphs(a: Axes, from: Pt, to: Pt, col: string, lw: number): Glyph[] {
  const p = a.toSheet(from), q = a.toSheet([from[0] + to[0], from[1] + to[1]]);
  const L = dist(p, q);
  if (L < 1e-6) return [];
  const head = Math.min(0.28, L * 0.35);
  const back: Pt = [q[0] - ((q[0] - p[0]) / L) * head * 0.9, q[1] - ((q[1] - p[1]) / L) * head * 0.9];
  return [
    strokeGlyph([{ closed: false, pts: [p, back] }], lw, 'vector', { color: col }),
    fillGlyph([arrowHead(p, q, head)], 'tip', { color: col }),
  ];
}

registerAction('vector', {
  summary: 'An arrow on axes, from the origin (or a point) to a point.',
  worlds: GRAPH,
  params: ['on', 'to', 'from', 'label', 'coords', 'color', 'line_width', 'appear'],
  required: ['to'],
  build(ctx) {
    const { world } = ctx;
    const a = axesOf(ctx);
    const pair = (v: unknown, k: string): Pt => {
      if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === 'number')) throw new ScriptError('must be [x, y].', `${ctx.where}.${k}`);
      return [v[0], v[1]];
    };
    const to = pair(ctx.spec.to, 'to');
    const from = ctx.spec.from !== undefined ? pair(ctx.spec.from, 'from') : [0, 0] as Pt;
    const id = str(ctx, 'id') ?? world.newId('vector');
    const col = color(ctx, 'color') ?? world.symbolColors[id] ?? world.theme.shades.yellow;
    const lw = lineWidth(ctx, 5);
    const info: VectorInfo = { axes: a, to, from: { x: new Param(from[0]), y: new Param(from[1]) } };
    const th = liveThing(ctx, id, (t) => {
      const f: Pt = [info.from.x.at(t), info.from.y.at(t)];
      const out = vectorGlyphs(a, f, to, col, lw);
      const tip = a.toSheet([f[0] + to[0], f[1] + to[1]]);
      const dir = Math.sign(to[0] || 1);
      if (typeof ctx.spec.label === 'string') out.push(...numberGlyphs(ctx.spec.label.replace(/^\$|\$$/g, ''), [tip[0] + 0.15 * dir, tip[1] + 0.25], dir > 0 ? 'right' : 'left', 0.42, col, ''));
      if (ctx.spec.coords === true) out.push(...numberGlyphs(`\\begin{bmatrix}${formatNumber(to[0], Number.isInteger(to[0]) ? 0 : 2)}\\\\${formatNumber(to[1], Number.isInteger(to[1]) ? 0 : 2)}\\end{bmatrix}`, [tip[0] + 0.45 * dir, tip[1] - 0.3], dir > 0 ? 'right' : 'left', 0.34, col, ''));
      return out;
    }, ctx.where);
    VECTORS.set(th, info);
    const d = natural(ctx, 0.8);
    arrive(ctx, th, readAppear(ctx, 'draw').how, ctx.start, d);
    return { end: ctx.start + d, thing: th };
  },
}, ['arrow_on']);

registerAction('add_vectors', {
  summary: 'The second vector slides to the tip of the first, and their sum is drawn.',
  worlds: GRAPH,
  params: ['who', 'id', 'color'],
  required: ['who'],
  build(ctx) {
    const { world } = ctx;
    if (!Array.isArray(ctx.spec.who) || ctx.spec.who.length !== 2) throw new ScriptError('must name two vectors.', `${ctx.where}.who`);
    const [v, w] = ctx.spec.who.map((id, i) => {
      const th = world.get(id, `${ctx.where}.who[${i}]`);
      const info = VECTORS.get(th);
      if (!info) throw new ScriptError(`"${th.id}" is not a vector.`, `${ctx.where}.who[${i}]`);
      return info;
    });
    const d = natural(ctx, 1.2);
    w.from.x.to(v.from.x.last + v.to[0], ctx.start, d);
    w.from.y.to(v.from.y.last + v.to[1], ctx.start, d);
    const sum: Pt = [v.to[0] + w.to[0], v.to[1] + w.to[1]];
    const col = color(ctx, 'color', world.theme.shades.pink)!;
    const origin: Pt = [v.from.x.last, v.from.y.last];
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('sum'), () => vectorGlyphs(v.axes, origin, sum, col, 5), ctx.where);
    VECTORS.set(th, { axes: v.axes, to: sum, from: { x: new Param(origin[0]), y: new Param(origin[1]) } });
    arrive(ctx, th, 'draw', ctx.start + d, 0.8);
    return { end: ctx.start + d + 0.8, thing: th };
  },
});

// ---- fields ----

function strengthColor(world: SceneWorld, k: number): string {
  const s = world.theme.shades;
  return k < 0.5 ? mixColor(s.blue, s.green, k * 2) : mixColor(s.green, s.yellow, (k - 0.5) * 2);
}

registerAction('field', {
  summary: 'A vector field: arrows, flowing specks, or stream lines.',
  worlds: GRAPH,
  params: ['on', 'x_part', 'y_part', 'as', 'density', 'color', 'seed'],
  required: ['x_part', 'y_part'],
  build(ctx) {
    const { world } = ctx;
    const a = axesOf(ctx);
    const fx = fn(String(ctx.spec.x_part), `${ctx.where}.x_part`), fy = fn(String(ctx.spec.y_part), `${ctx.where}.y_part`);
    const kind = choice(ctx.spec.as, ['arrows', 'flow', 'lines'] as const, `${ctx.where}.as`, 'arrows');
    const density = num(ctx, 'density', 1);
    const byStrength = ctx.spec.color === undefined || ctx.spec.color === 'by_strength';
    const fixed = byStrength ? undefined : color(ctx, 'color');
    const V = (x: number, y: number, s: Scope): Pt => [fx({ ...s, x, y }), fy({ ...s, x, y })];
    const [x0, x1] = a.x, [y0, y1] = a.y;
    const step = Math.max((x1 - x0) / 24, (y1 - y0) / 14) / density;
    // The strongest arrow, for scaling.
    let maxMag = 1e-9;
    for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) {
      const v = V(x, y, world.scope());
      const m = Math.hypot(v[0], v[1]);
      if (Number.isFinite(m)) maxMag = Math.max(maxMag, m);
    }
    const r = rng(typeof ctx.spec.seed === 'number' ? ctx.spec.seed : 7);
    const seeds = Array.from({ length: Math.round(500 * density) }, () => [x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), r()] as [number, number, number]);
    const life = 3;
    const id = str(ctx, 'id') ?? world.newId('field');
    const th = liveThing(ctx, id, (t) => {
      const s = world.scope();
      if (kind === 'arrows') {
        const byCol = new Map<string, Contour[]>();
        const add = (c: string, k: Contour) => { if (!byCol.has(c)) byCol.set(c, []); byCol.get(c)!.push(k); };
        for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
          const v = V(x, y, s);
          const m = Math.hypot(v[0], v[1]);
          if (!Number.isFinite(m) || m < 1e-9) continue;
          const len = step * 0.85 * Math.min(1, 0.25 + 0.75 * (m / maxMag));
          const tip: Pt = [x + (v[0] / m) * len, y + (v[1] / m) * len];
          const p = a.toSheet([x, y]), q = a.toSheet(tip);
          const c = fixed ?? strengthColor(world, Math.round((m / maxMag) * 8) / 8);
          add(c, { closed: false, pts: [p, q] });
          add(c + '|tip', arrowHead(p, q, 0.12));
        }
        const out: Glyph[] = [];
        for (const [c, cs] of byCol) out.push(c.endsWith('|tip') ? fillGlyph(cs, 'tip', { color: c.slice(0, -4) }) : strokeGlyph(cs, 2.6, 'field', { color: c }));
        return out;
      }
      if (kind === 'lines') {
        const cs: Contour[] = [];
        for (let x = x0 + step / 2; x <= x1; x += step * 1.6) for (let y = y0 + step / 2; y <= y1; y += step * 1.6) {
          let p: Pt = [x, y];
          const pts: Pt[] = [a.toSheet(p)];
          for (let k = 0; k < 40; k++) {
            const v = V(p[0], p[1], s);
            const m = Math.hypot(v[0], v[1]);
            if (!Number.isFinite(m) || m < 1e-9) break;
            p = [p[0] + (v[0] / m) * step * 0.25, p[1] + (v[1] / m) * step * 0.25];
            if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) break;
            pts.push(a.toSheet(p));
          }
          if (pts.length > 2) cs.push({ closed: false, pts });
        }
        return [strokeGlyph(cs, 2.4, 'stream', { color: fixed ?? world.theme.shades.blue })];
      }
      // Flow: specks carried along the field, each living a few seconds.
      if (t === Infinity) return [];
      const now = Math.max(0, t - ctx.start);
      const speed = 1.6 * step / Math.max(1e-6, maxMag);
      const groups = new Map<string, Contour[]>();
      for (const [sx, sy, phase] of seeds) {
        const age = (now + phase * life) % life;
        let p: Pt = [sx, sy];
        const dt = 0.1;
        const trail: Pt[] = [];
        let ok = true;
        for (let k = 0; k * dt < age; k++) {
          const v = V(p[0], p[1], s);
          const v2 = V(p[0] + v[0] * speed * dt / 2, p[1] + v[1] * speed * dt / 2, s);
          if (!Number.isFinite(v2[0] + v2[1])) { ok = false; break; }
          p = [p[0] + v2[0] * speed * dt, p[1] + v2[1] * speed * dt];
          if (age - k * dt < 0.5) trail.push(a.toSheet(p));
        }
        if (!ok || trail.length < 2) continue;
        const fade = Math.min(1, age / 0.5, (life - age) / 0.5);
        const m = Math.hypot(...V(p[0], p[1], s));
        const c = withAlpha(fixed ?? strengthColor(world, Math.round(clamp(m / maxMag) * 6) / 6), Math.round(fade * 5) / 5);
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c)!.push({ closed: false, pts: trail });
      }
      return [...groups].map(([c, cs]) => strokeGlyph(cs, 3, 'flow', { color: c }));
    }, ctx.where);
    th.layer = -1;
    const d = natural(ctx, 1.2);
    arrive(ctx, th, kind === 'flow' ? 'fade' : 'draw', ctx.start, d);
    return { end: ctx.start + d, thing: th };
  },
}, ['vector_field', 'flow']);

// ---- transforming the plane ----

registerAction('transform_plane', {
  summary: 'The whole plane moves: a matrix, a complex function, or any map. Everything on it moves too.',
  worlds: GRAPH,
  params: ['who', 'matrix', 'map', 'x_part', 'y_part', 'basis', 'ghost', 'undo'],
  build(ctx) {
    const { world } = ctx;
    const a = axesOf(ctx, 'who');
    let map: (p: Pt) => Pt;
    const memo = new Map<string, Pt>();
    const remember = (f: (p: Pt) => Pt) => (p: Pt): Pt => {
      const k = `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
      let v = memo.get(k);
      if (!v) { v = f(p); memo.set(k, v); }
      return v;
    };
    if (ctx.spec.undo === true) {
      map = (p) => p;
    } else if (Array.isArray(ctx.spec.matrix)) {
      const m = ctx.spec.matrix;
      if (m.length !== 2 || !m.every((r) => Array.isArray(r) && r.length === 2 && r.every((v) => typeof v === 'number'))) {
        throw new ScriptError('must be [[a, b], [c, d]].', `${ctx.where}.matrix`);
      }
      const [[p, q], [r, s]] = m as number[][];
      map = ([x, y]) => [p * x + q * y, r * x + s * y];
    } else if (typeof ctx.spec.map === 'string') {
      const f = complexMap(ctx.spec.map, `${ctx.where}.map`);
      const scope = world.scope();
      map = remember(([x, y]) => f(x, y, scope));
    } else if (ctx.spec.x_part !== undefined && ctx.spec.y_part !== undefined) {
      const fx = fn(String(ctx.spec.x_part), `${ctx.where}.x_part`), fy = fn(String(ctx.spec.y_part), `${ctx.where}.y_part`);
      const scope = world.scope();
      map = remember(([x, y]) => [fx({ ...scope, x, y }), fy({ ...scope, x, y })]);
    } else {
      throw new ScriptError('needs "matrix", "map" (a function of z), or "x_part" and "y_part"; or "undo": true.', ctx.where);
    }
    const warp: Warp = { map, u: 0, ghost: ctx.spec.ghost === true };
    // Undo takes every point back to where it began (see Axes.warp).
    if (ctx.spec.undo === true) warp.undo = true;
    a.warps.push(warp);
    if (ctx.spec.basis === true && !world.things.has('i_hat')) {
      for (const [id, to, col] of [['i_hat', [1, 0], world.theme.shades.green], ['j_hat', [0, 1], world.theme.shades.red]] as const) {
        const th = liveThing(ctx, id, () => vectorGlyphs(a, [0, 0], [to[0], to[1]], col, 6), ctx.where);
        arrive(ctx, th, 'draw', ctx.start, 0.6);
      }
    }
    const lead = ctx.spec.basis === true ? 0.7 : 0;
    const d = natural(ctx, 2.5);
    const self = warp;
    ctx.act({ start: ctx.start + lead, duration: d, apply(u) { self.u = ease('smooth', u); } });
    return { end: ctx.start + lead + d };
  },
}, ['apply_matrix', 'warp']);
