// Shapes made from points: lines, arrows, circles, polygons, braces.
// Everything is in sheet units, y up.

import type { Contour, Pt } from './geom';
import type { Glyph } from './thing';

export const line = (a: Pt, b: Pt): Contour => ({ closed: false, pts: [a, b] });

export function circlePts(c: Pt, rx: number, ry = rx, from = 0, to = Math.PI * 2, n = 0): Pt[] {
  const count = n || Math.max(24, Math.ceil(Math.abs(to - from) * Math.max(rx, ry) * 24));
  const out: Pt[] = [];
  for (let k = 0; k <= count; k++) {
    const a = from + ((to - from) * k) / count;
    out.push([c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a)]);
  }
  return out;
}

export function circle(c: Pt, r: number): Contour {
  const pts = circlePts(c, r);
  pts.pop();
  return { closed: true, pts };
}

export function roundedRect(x0: number, y0: number, x1: number, y1: number, r: number): Contour {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
  if (r === 0) return { closed: true, pts: [[x0, y1], [x1, y1], [x1, y0], [x0, y0]] };
  const pts: Pt[] = [];
  // Clockwise from the top left, as a pen would go.
  const arc = (cx: number, cy: number, a0: number) => {
    for (let k = 0; k <= 6; k++) {
      const a = a0 - (Math.PI / 2) * (k / 6);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  arc(x0 + r, y1 - r, Math.PI);
  arc(x1 - r, y1 - r, Math.PI / 2);
  arc(x1 - r, y0 + r, 0);
  arc(x0 + r, y0 + r, -Math.PI / 2);
  return { closed: true, pts };
}

/** An arrow head at `tip`, pointing from `from`. */
export function arrowHead(from: Pt, tip: Pt, size: number): Contour {
  const a = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  const w = size * 0.55;
  const back: Pt = [tip[0] - size * Math.cos(a), tip[1] - size * Math.sin(a)];
  return {
    closed: true,
    pts: [tip, [back[0] + w * Math.sin(a), back[1] - w * Math.cos(a)], [back[0] - w * Math.sin(a), back[1] + w * Math.cos(a)]],
  };
}

/** A curly brace from a to b, its point bulging to the right of a→b by `depth`. */
export function bracePts(a: Pt, b: Pt, depth: number): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const out: Pt[] = [];
  const n = 48;
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    // Rises quickly at each end, flat along most of its length, with a
    // sharp point in the middle.
    const v = u < 0.5 ? u * 2 : (1 - u) * 2;
    const ends = 1 - Math.exp(-v * 9);
    const point = Math.exp(-((u - 0.5) ** 2) / 0.0012) * 0.55;
    const d = depth * (0.55 * ends + point);
    const x = u * len, y = -d;
    out.push([a[0] + x * Math.cos(ang) - y * Math.sin(ang), a[1] + x * Math.sin(ang) + y * Math.cos(ang)]);
  }
  return out;
}

export function regular(c: Pt, r: number, sides: number, turn = Math.PI / 2): Pt[] {
  return Array.from({ length: sides }, (_, k) => {
    const a = turn - (2 * Math.PI * k) / sides;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as Pt;
  });
}

export function star(c: Pt, r: number, points: number): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k < points * 2; k++) {
    const a = Math.PI / 2 - (Math.PI * k) / points;
    const rr = k % 2 ? r * 0.45 : r;
    out.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]);
  }
  return out;
}

/** A loop drawn round a box by hand: an ellipse that overshoots where it starts. */
export function handLoop(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2 * 1.18 + 0.08, ry = (y1 - y0) / 2 * 1.35 + 0.08;
  const out: Pt[] = [];
  const n = 80;
  for (let k = 0; k <= n; k++) {
    const a = Math.PI * 0.75 + (Math.PI * 2.15 * k) / n;
    const wob = 1 + 0.04 * Math.sin(a * 3 + 0.7);
    out.push([cx + rx * wob * Math.cos(a), cy + ry * wob * Math.sin(a) + 0.02 * (k / n)]);
  }
  return out;
}

export function strokeGlyph(contours: Contour[], width: number, key = 'stroke', extra: Partial<Glyph> = {}): Glyph {
  return { contours, fill: false, stroke: true, width, key, parts: [], ...extra };
}

export function fillGlyph(contours: Contour[], key = 'fill', extra: Partial<Glyph> = {}): Glyph {
  return { contours, fill: true, stroke: false, key, parts: [], ...extra };
}
