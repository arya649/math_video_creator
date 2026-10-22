// Geometry that depends on other geometry. Every object is worked out
// afresh for the frame being drawn, from the objects it was built from, so
// when a free point moves, everything built from it follows.

import type { Pt } from '../geom';

export type GVal =
  | { k: 'point'; p: Pt }
  | { k: 'line'; p: Pt; d: Pt; kind: 'line' | 'segment' | 'ray'; a: Pt; b: Pt }
  | { k: 'circle'; c: Pt; r: number }
  | { k: 'polygon'; pts: Pt[]; names: string[] };

export interface GObj {
  id: string;
  /** The object at time t (Infinity: as last built). Null when it does not exist (parallel lines never meet). */
  at(t: number): GVal | null;
}

/** Wrap a rule so it is worked out once per frame. */
export function memo(id: string, rule: (t: number) => GVal | null): GObj {
  let lastT = NaN;
  let last: GVal | null = null;
  return {
    id,
    at(t) {
      if (t !== lastT) { last = rule(t); lastT = t; }
      return last;
    },
  };
}

// ---- Plain geometry on points ----

export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
export const len = (a: Pt) => Math.hypot(a[0], a[1]);
export const norm = (a: Pt): Pt => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
export const perp = (a: Pt): Pt => [-a[1], a[0]];
export const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const lerpPt = (a: Pt, b: Pt, u: number): Pt => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
export const rotateAbout = (p: Pt, c: Pt, ang: number): Pt => {
  const s = Math.sin(ang), co = Math.cos(ang);
  const v = sub(p, c);
  return [c[0] + v[0] * co - v[1] * s, c[1] + v[0] * s + v[1] * co];
};

export function lineVal(a: Pt, b: Pt, kind: 'line' | 'segment' | 'ray' = 'line'): GVal {
  return { k: 'line', p: a, d: norm(sub(b, a)), kind, a, b };
}

export function foot(p: Pt, line: { p: Pt; d: Pt }): Pt {
  return add(line.p, mul(line.d, dot(sub(p, line.p), line.d)));
}

export function reflectIn(p: Pt, line: { p: Pt; d: Pt }): Pt {
  const f = foot(p, line);
  return sub(mul(f, 2), p);
}

/** Where two lines, a line and a circle, or two circles meet. */
export function meet(x: GVal, y: GVal): Pt[] {
  if (x.k === 'line' && y.k === 'line') {
    const c = cross(x.d, y.d);
    if (Math.abs(c) < 1e-9) return [];
    const t = cross(sub(y.p, x.p), y.d) / c;
    return [add(x.p, mul(x.d, t))];
  }
  if (x.k === 'circle' && y.k === 'line') return meet(y, x);
  if (x.k === 'line' && y.k === 'circle') {
    const f = foot(y.c, x);
    const h2 = y.r * y.r - len(sub(f, y.c)) ** 2;
    if (h2 < -1e-9) return [];
    const h = Math.sqrt(Math.max(0, h2));
    return [sub(f, mul(x.d, h)), add(f, mul(x.d, h))];
  }
  if (x.k === 'circle' && y.k === 'circle') {
    const d = len(sub(y.c, x.c));
    if (d < 1e-9 || d > x.r + y.r + 1e-9 || d < Math.abs(x.r - y.r) - 1e-9) return [];
    const a = (x.r * x.r - y.r * y.r + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, x.r * x.r - a * a));
    const u = norm(sub(y.c, x.c));
    const m = add(x.c, mul(u, a));
    return [add(m, mul(perp(u), h)), sub(m, mul(perp(u), h))];
  }
  return [];
}

/** The circle through three points. */
export function circleThrough(a: Pt, b: Pt, c: Pt): { c: Pt; r: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-12) return null;
  const s = (p: Pt) => p[0] * p[0] + p[1] * p[1];
  const cx = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d;
  const cy = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
  return { c: [cx, cy], r: len(sub(a, [cx, cy])) };
}

export function incircle(a: Pt, b: Pt, c: Pt): { c: Pt; r: number } {
  const la = len(sub(b, c)), lb = len(sub(a, c)), lc = len(sub(a, b));
  const p = la + lb + lc;
  const center: Pt = [(la * a[0] + lb * b[0] + lc * c[0]) / p, (la * a[1] + lb * b[1] + lc * c[1]) / p];
  const area = Math.abs(cross(sub(b, a), sub(c, a))) / 2;
  return { c: center, r: (2 * area) / p };
}

export function orthocenter(a: Pt, b: Pt, c: Pt): Pt | null {
  const h1 = { p: a, d: norm(perp(sub(c, b))) }, h2 = { p: b, d: norm(perp(sub(c, a))) };
  const m = meet({ k: 'line', kind: 'line', ...h1, a: h1.p, b: add(h1.p, h1.d) }, { k: 'line', kind: 'line', ...h2, a: h2.p, b: add(h2.p, h2.d) });
  return m[0] ?? null;
}

/** The angle at b from arm a to arm c, 0 to 2π, anticlockwise. */
export function angleAt(a: Pt, b: Pt, c: Pt): number {
  const u = Math.atan2(a[1] - b[1], a[0] - b[0]);
  const v = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let d = v - u;
  while (d < 0) d += 2 * Math.PI;
  while (d >= 2 * Math.PI) d -= 2 * Math.PI;
  return d;
}

/** Where along a line, circle or polygon is the point a share t of the way round. */
export function pointAlong(v: GVal, t: number): Pt | null {
  if (v.k === 'line') return lerpPt(v.a, v.b, t);
  if (v.k === 'circle') return [v.c[0] + v.r * Math.cos(2 * Math.PI * t), v.c[1] + v.r * Math.sin(2 * Math.PI * t)];
  if (v.k === 'polygon') {
    const n = v.pts.length;
    const lens = v.pts.map((p, i) => len(sub(v.pts[(i + 1) % n], p)));
    const total = lens.reduce((a, b) => a + b, 0);
    let d = ((t % 1) + 1) % 1 * total;
    for (let i = 0; i < n; i++) {
      if (d <= lens[i]) return lerpPt(v.pts[i], v.pts[(i + 1) % n], d / (lens[i] || 1));
      d -= lens[i];
    }
    return v.pts[0];
  }
  return null;
}

/** Cut a polygon by a line, keeping the part on the left of its direction. */
export function clipHalf(poly: Pt[], p: Pt, d: Pt): Pt[] {
  const out: Pt[] = [];
  const side = (q: Pt) => cross(d, sub(q, p));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const u = sa / (sa - sb);
      out.push(lerpPt(a, b, u));
    }
  }
  return out;
}

export function centroid(pts: Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}
