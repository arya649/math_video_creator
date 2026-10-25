// Drawing shapes on the sheet.

import { parsePath } from '../geom';
import { type Ctx, type Spec, arrive, color, num, positionSpec, readAppear, registerAction, sheetText, str, TEXT_SIZES, natural } from '../actions';
import { type Contour, type Pt, boundsOf, centerOf } from '../geom';
import { arrowHead, bracePts, circle, circlePts, fillGlyph, line, regular, roundedRect, star, strokeGlyph } from '../shapes';
import { type Glyph, Thing, shiftGlyphs } from '../thing';
import { ScriptError, choice, didYouMean } from '../util';
import { withAlpha } from '../color';

export const SHAPES = [
  'line', 'arrow', 'dashed', 'dot', 'circle', 'ellipse', 'arc', 'square', 'rectangle', 'polygon', 'regular',
  'star', 'brace', 'path', 'grid', 'cross', 'tick',
] as const;
type ShapeName = (typeof SHAPES)[number];

const SHAPE_KEYS = [
  'shape', 'from', 'to', 'extend', 'tip', 'curve', 'radius', 'width', 'height', 'from_angle', 'to_angle', 'bend', 'size',
  'corner', 'points', 'names', 'sides', 'text', 'rows', 'columns', 'color', 'fill', 'fill_opacity', 'dash', 'glow',
  'label', 'label_at', 'appear', 'lift', 'shapes', 'lag', 'line_width', 'file', 'position',
];

interface Made {
  glyphs: Glyph[];
  /** Spots in sheet units. */
  spots: Record<string, Pt>;
  /** Fixed in place by from/to or points (not moved by `at`). */
  fixed: boolean;
}

function readPts(ctx: Ctx, key: string): Pt[] {
  const v = ctx.spec[key];
  if (!Array.isArray(v) || v.length < 2) throw new ScriptError('must be a list of positions.', `${ctx.where}.${key}`);
  return v.map((p, i) => ctx.world.point(p, `${ctx.where}.${key}[${i}]`));
}

function make(ctx: Ctx, shape: ShapeName): Made {
  const { spec, world } = ctx;
  const ink = color(ctx, 'color', world.theme.ink)!;
  const fill = spec.fill === undefined || spec.fill === false ? undefined : color(ctx, 'fill')!;
  const fillOpacity = num(ctx, 'fill_opacity', 0.6);
  const lw = num(ctx, 'line_width', 4);
  const dash = spec.dash === true || shape === 'dashed';
  const outline = (cs: Contour[], key: string): Glyph[] => {
    const out: Glyph[] = [];
    if (fill) out.push(fillGlyph(cs, key + '-fill', { color: withAlpha(fill, fillOpacity) }));
    out.push(strokeGlyph(cs, lw, key, { color: ink, dash }));
    return out;
  };
  const r = (key: string, d: number) => num(ctx, key, d);
  switch (shape) {
    case 'line': case 'dashed': case 'arrow': {
      let a = world.point(spec.from, `${ctx.where}.from`), b = world.point(spec.to, `${ctx.where}.to`);
      if (spec.extend === true) {
        const dx = b[0] - a[0], dy = b[1] - a[1], k = 40 / Math.max(1e-6, Math.hypot(dx, dy));
        a = [a[0] - dx * k, a[1] - dy * k];
        b = [b[0] + dx * k, b[1] + dy * k];
      }
      const bend = num(ctx, 'curve', 0);
      let pts: Pt[] = [a, b];
      if (bend) {
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const c: Pt = [mx + nx * bend, my + ny * bend];
        pts = Array.from({ length: 33 }, (_, k) => {
          const t = k / 32, s = 1 - t;
          return [s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]] as Pt;
        });
      }
      const glyphs: Glyph[] = [strokeGlyph([{ closed: false, pts }], lw, 'line', { color: ink, dash })];
      if (shape === 'arrow') {
        const tip = choice(spec.tip, ['end', 'start', 'both'] as const, `${ctx.where}.tip`, 'end');
        const size = 0.22 * (lw / 4) ** 0.5;
        if (tip !== 'start') glyphs.push(fillGlyph([arrowHead(pts[pts.length - 2], pts[pts.length - 1], size)], 'tip', { color: ink }));
        if (tip !== 'end') glyphs.push(fillGlyph([arrowHead(pts[1], pts[0], size)], 'tip', { color: ink }));
      }
      return { glyphs, spots: { start: a, end: b, middle: pts[Math.floor(pts.length / 2)] }, fixed: true };
    }
    case 'dot':
      return { glyphs: [fillGlyph([circle([0, 0], r('radius', 0.08))], 'dot', { color: fill ?? ink })], spots: {}, fixed: false };
    case 'circle':
      return { glyphs: outline([circle([0, 0], r('radius', 1))], 'circle'), spots: { center: [0, 0] }, fixed: false };
    case 'ellipse': {
      const pts = circlePts([0, 0], r('width', 2) / 2, r('height', 1) / 2);
      pts.pop();
      return { glyphs: outline([{ closed: true, pts }], 'ellipse'), spots: { center: [0, 0] }, fixed: false };
    }
    case 'arc': {
      const deg = Math.PI / 180;
      const pts = circlePts([0, 0], r('radius', 1), r('radius', 1), r('from_angle', 0) * deg, r('to_angle', 90) * deg);
      return { glyphs: [strokeGlyph([{ closed: false, pts }], lw, 'arc', { color: ink, dash })], spots: { center: [0, 0] }, fixed: false };
    }
    case 'square': case 'rectangle': {
      const w = shape === 'square' ? r('size', 2) : r('width', 3);
      const h = shape === 'square' ? w : r('height', 2);
      return { glyphs: outline([roundedRect(-w / 2, -h / 2, w / 2, h / 2, r('corner', 0))], shape), spots: {}, fixed: false };
    }
    case 'polygon': {
      const pts = readPts(ctx, 'points');
      const names = Array.isArray(spec.names) ? spec.names.map(String) : [];
      const spots: Record<string, Pt> = {};
      pts.forEach((p, i) => { if (names[i]) spots[names[i]] = p; });
      for (let i = 0; i < names.length; i++) {
        const j = (i + 1) % names.length;
        if (names[i] && names[j]) spots[names[i] + names[j]] = [(pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2];
      }
      return { glyphs: outline([{ closed: true, pts }], 'polygon'), spots, fixed: true };
    }
    case 'regular':
      return { glyphs: outline([{ closed: true, pts: regular([0, 0], r('radius', 1), Math.round(r('sides', 6))) }], 'regular'), spots: {}, fixed: false };
    case 'star':
      return { glyphs: outline([{ closed: true, pts: star([0, 0], r('radius', 1), Math.round(r('points', 5))) }], 'star'), spots: {}, fixed: false };
    case 'brace': {
      const a = world.point(spec.from, `${ctx.where}.from`), b = world.point(spec.to, `${ctx.where}.to`);
      return { glyphs: [strokeGlyph([{ closed: false, pts: bracePts(a, b, 0.22) }], lw, 'brace', { color: ink })], spots: { start: a, end: b }, fixed: true };
    }
    case 'grid': {
      const rows = Math.round(r('rows', 3)), cols = Math.round(r('columns', 3)), s = r('size', 0.6);
      const w = cols * s, h = rows * s;
      const cs: Contour[] = [];
      for (let i = 0; i <= rows; i++) cs.push(line([-w / 2, -h / 2 + i * s], [w / 2, -h / 2 + i * s]));
      for (let j = 0; j <= cols; j++) cs.push(line([-w / 2 + j * s, -h / 2], [-w / 2 + j * s, h / 2]));
      return { glyphs: cs.map((c) => strokeGlyph([c], lw * 0.6, 'grid', { color: ink })), spots: {}, fixed: false };
    }
    case 'cross': {
      const s = r('size', 0.6) / 2;
      return { glyphs: [strokeGlyph([line([-s, -s], [s, s]), line([-s, s], [s, -s])], lw * 1.5, 'cross', { color: spec.color ? ink : world.theme.bad })], spots: {}, fixed: false };
    }
    case 'tick': {
      const s = r('size', 0.6) / 2;
      return { glyphs: [strokeGlyph([{ closed: false, pts: [[-s, 0], [-s * 0.25, -s * 0.7], [s, s * 0.8]] }], lw * 1.5, 'tick', { color: spec.color ? ink : world.theme.good })], spots: {}, fixed: false };
    }
    case 'path': {
      if (typeof spec.file === 'string') {
        // A drawing from an SVG file: its paths and polygons, sized to "size" (its height).
        const text = world.texts[spec.file];
        if (!text) throw new ScriptError(`"${spec.file}" has not been opened with the script (put it beside script.json).`, `${ctx.where}.file`);
        const ds = [...text.matchAll(/<path[^>]*\sd\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
        const polys = [...text.matchAll(/<poly(gon|line)[^>]*\spoints\s*=\s*"([^"]+)"/g)].map((m) => `M ${m[2]}${m[1] === 'gon' ? ' Z' : ''}`);
        const contours = [...ds, ...polys].flatMap((d) => parsePath(d, 0.5));
        if (!contours.length) throw new ScriptError('has no <path> or <polygon> to draw.', `${ctx.where}.file`);
        const all = contours.flatMap((c) => c.pts);
        const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
        const h = typeof spec.size === 'number' ? spec.size : 3;
        const k = h / Math.max(1e-9, Math.max(...ys) - Math.min(...ys));
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        // SVG's y runs down; ours runs up.
        const scaled = contours.map((c) => ({ closed: c.closed, pts: c.pts.map(([x, y]) => [(x - cx) * k, -(y - cy) * k] as Pt) }));
        return { glyphs: outline(scaled, 'path'), spots: {}, fixed: false };
      }
      if (!Array.isArray(spec.points)) throw new ScriptError('needs "points" (positions to draw a smooth curve through) or "file" (an SVG drawing).', `${ctx.where}.points`);
      const pts = readPts(ctx, 'points');
      return { glyphs: [strokeGlyph([{ closed: false, pts: smoothThrough(pts) }], lw, 'path', { color: ink, dash })], spots: { start: pts[0], end: pts[pts.length - 1] }, fixed: true };
    }
  }
}

/** A smooth curve through points (Catmull-Rom). */
function smoothThrough(p: Pt[]): Pt[] {
  if (p.length < 3) return p;
  const out: Pt[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    for (let k = 0; k < 16; k++) {
      const t = k / 16, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(p[p.length - 1]);
  return out;
}

export function drawShape(ctx: Ctx, start: number): { end: number; thing: Thing } {
  const { spec, world } = ctx;
  if (typeof spec.shape !== 'string' || !(SHAPES as readonly string[]).includes(spec.shape)) {
    throw new ScriptError(`needs "shape": one of ${SHAPES.join(', ')}.${typeof spec.shape === 'string' ? didYouMean(spec.shape, SHAPES) : ''}`, `${ctx.where}.shape`);
  }
  const made = make(ctx, spec.shape as ShapeName);
  const all = made.glyphs.flatMap((g) => g.contours);
  const box = boundsOf(all);
  const c = centerOf(box);
  let origin: Pt;
  let glyphs: Glyph[];
  if (made.fixed) {
    origin = c;
    glyphs = shiftGlyphs(made.glyphs, -c[0], -c[1]);
  } else {
    glyphs = shiftGlyphs(made.glyphs, -c[0], -c[1]);
    const own = { x0: box.x0 - c[0], x1: box.x1 - c[0], y0: box.y0 - c[1], y1: box.y1 - c[1] };
    origin = world.placeAt(positionSpec(spec), own, `${ctx.where}.position`);
  }
  const t = new Thing(str(ctx, 'id') ?? world.newId('shape'), 'shape', glyphs, origin);
  const spotShift: Pt = made.fixed ? [-c[0], -c[1]] : [-c[0], -c[1]];
  for (const [k, p] of Object.entries(made.spots)) t.spots[k] = made.fixed ? [p[0] + spotShift[0], p[1] + spotShift[1]] : [p[0] - c[0], p[1] - c[1]];
  if (spec.glow === true) t.base.glow = 1;
  if (spec.key === true) t.key = true;
  world.add(t, ctx.where);
  const { how, from } = readAppear(ctx, 'draw');
  const d = natural(ctx, 1);
  if (spec.hidden !== true) arrive(ctx, t, how, start, d, from);
  if (spec.shape === 'tick') ctx.sound('chime', start + d * 0.8);
  if (spec.shape === 'cross') ctx.sound('low', start + d * 0.5);
  if (typeof spec.label === 'string') {
    const at = spec.label_at !== undefined ? world.point(spec.label_at, `${ctx.where}.label_at`) : null;
    const lab = sheetText(ctx, world.newId('label'), spec.label, TEXT_SIZES.small, [0, 0], { color: color(ctx, 'color', world.theme.ink) });
    const b = t.buildBox();
    const lb = lab.text!.box;
    const p: Pt = at ?? [(b.x0 + b.x1) / 2, b.y1 + 0.15 - lb.y0];
    lab.base.x = lab.build.x = p[0];
    lab.base.y = lab.build.y = p[1];
    world.add(lab, `${ctx.where}.label`);
    arrive(ctx, lab, 'fade', start + d * 0.7, 0.4);
  }
  return { end: start + d, thing: t };
}

registerAction('draw', {
  summary: 'Draw a shape on the sheet.',
  params: SHAPE_KEYS,
  build(ctx) {
    if (Array.isArray(ctx.spec.shapes)) {
      const lag = num(ctx, 'lag', 0.25);
      let start = ctx.start;
      let end = start;
      let last: Thing | undefined;
      ctx.spec.shapes.forEach((s, i) => {
        const sub: Ctx = { ...ctx, spec: s as Spec, where: `${ctx.where}.shapes[${i}]` };
        const r = drawShape(sub, start);
        last = r.thing;
        end = r.end;
        start += lag;
      });
      return { end, thing: last };
    }
    return drawShape(ctx, ctx.start);
  },
}, ['shape']);
