// Outlines as lists of points: parsing SVG paths, measuring, cutting, morphing.

export type Pt = [number, number];
export interface Contour { pts: Pt[]; closed: boolean }
/** A 2D transform [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f. */
export type Mat = [number, number, number, number, number, number];

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export const apply = (m: Mat, p: Pt): Pt => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

export function transformContours(cs: Contour[], m: Mat): Contour[] {
  return cs.map((c) => ({ closed: c.closed, pts: c.pts.map((p) => apply(m, p)) }));
}

/** Parse an SVG transform attribute. */
export function parseTransform(text: string | null | undefined): Mat {
  let m: Mat = IDENTITY;
  if (!text) return m;
  const re = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/g;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(text))) {
    const v = hit[2].split(/[\s,]+/).filter(Boolean).map(Number);
    let n: Mat = IDENTITY;
    if (hit[1] === 'matrix') n = v.slice(0, 6) as Mat;
    else if (hit[1] === 'translate') n = [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    else if (hit[1] === 'scale') n = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    else {
      const a = ((v[0] ?? 0) * Math.PI) / 180;
      n = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
      if (v.length === 3) n = mul(mul([1, 0, 0, 1, v[1], v[2]], n), [1, 0, 0, 1, -v[1], -v[2]]);
    }
    m = mul(m, n);
  }
  return m;
}

/** Turn SVG path data into contours of points, curves cut into short straight pieces. */
export function parsePath(d: string, tolerance = 2): Contour[] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const out: Contour[] = [];
  let cur: Pt[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;
  let lastCtrl: Pt | null = null;
  let lastCmd = '';
  let i = 0;
  const num = () => Number(tokens[i++]);
  const finish = (closed: boolean) => {
    if (cur.length > 1) out.push({ pts: cur, closed });
    cur = [];
  };
  const steps = (len: number) => Math.max(2, Math.min(64, Math.ceil(len / tolerance)));
  const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt) => {
    const n = steps(dist(p0, p1) + dist(p1, p2) + dist(p2, p3));
    for (let k = 1; k <= n; k++) {
      const t = k / n, s = 1 - t;
      cur.push([
        s * s * s * p0[0] + 3 * s * s * t * p1[0] + 3 * s * t * t * p2[0] + t * t * t * p3[0],
        s * s * s * p0[1] + 3 * s * s * t * p1[1] + 3 * s * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
  };
  const quad = (p0: Pt, p1: Pt, p2: Pt) => {
    const n = steps(dist(p0, p1) + dist(p1, p2));
    for (let k = 1; k <= n; k++) {
      const t = k / n, s = 1 - t;
      cur.push([s * s * p0[0] + 2 * s * t * p1[0] + t * t * p2[0], s * s * p0[1] + 2 * s * t * p1[1] + t * t * p2[1]]);
    }
  };
  let cmd = '';
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (C) {
      case 'M': {
        finish(false);
        x = ox + num(); y = oy + num();
        sx = x; sy = y;
        cur.push([x, y]);
        lastCtrl = null;
        break;
      }
      case 'L': x = ox + num(); y = oy + num(); cur.push([x, y]); lastCtrl = null; break;
      case 'H': x = (rel ? x : 0) + num(); cur.push([x, y]); lastCtrl = null; break;
      case 'V': y = (rel ? y : 0) + num(); cur.push([x, y]); lastCtrl = null; break;
      case 'C': {
        const p1: Pt = [ox + num(), oy + num()];
        const p2: Pt = [ox + num(), oy + num()];
        const p3: Pt = [ox + num(), oy + num()];
        cubic([x, y], p1, p2, p3);
        lastCtrl = p2; x = p3[0]; y = p3[1];
        break;
      }
      case 'S': {
        const p1: Pt = lastCtrl && /[CS]/i.test(lastCmd) ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y];
        const p2: Pt = [ox + num(), oy + num()];
        const p3: Pt = [ox + num(), oy + num()];
        cubic([x, y], p1, p2, p3);
        lastCtrl = p2; x = p3[0]; y = p3[1];
        break;
      }
      case 'Q': {
        const p1: Pt = [ox + num(), oy + num()];
        const p2: Pt = [ox + num(), oy + num()];
        quad([x, y], p1, p2);
        lastCtrl = p1; x = p2[0]; y = p2[1];
        break;
      }
      case 'T': {
        const p1: Pt = lastCtrl && /[QT]/i.test(lastCmd) ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y];
        const p2: Pt = [ox + num(), oy + num()];
        quad([x, y], p1, p2);
        lastCtrl = p1; x = p2[0]; y = p2[1];
        break;
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num(), large = num(), sweep = num();
        const ex = ox + num(), ey = oy + num();
        arcTo(cur, [x, y], rx, ry, rot, !!large, !!sweep, [ex, ey], tolerance);
        x = ex; y = ey; lastCtrl = null;
        break;
      }
      case 'Z': {
        x = sx; y = sy;
        finish(true);
        cur = [[x, y]];
        lastCtrl = null;
        break;
      }
      default:
        i++;
    }
    lastCmd = cmd;
  }
  finish(false);
  return out.filter((c) => c.pts.length > 1);
}

function arcTo(cur: Pt[], p0: Pt, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean, p1: Pt, tol: number) {
  if (rx === 0 || ry === 0) { cur.push(p1); return; }
  const phi = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2;
  const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const co = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
  const cx1 = (co * rx * y1) / ry, cy1 = (-co * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (p0[0] + p1[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(4, Math.min(96, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / tol)));
  for (let k = 1; k <= n; k++) {
    const t = t1 + (dt * k) / n;
    cur.push([cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos]);
  }
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function contourLength(c: Contour): number {
  let len = 0;
  for (let k = 1; k < c.pts.length; k++) len += dist(c.pts[k - 1], c.pts[k]);
  if (c.closed && c.pts.length > 1) len += dist(c.pts[c.pts.length - 1], c.pts[0]);
  return len;
}

/** The points of a contour, closing it if it is closed. */
export function openPoints(c: Contour): Pt[] {
  return c.closed && c.pts.length > 1 ? [...c.pts, c.pts[0]] : c.pts;
}

/** The first `frac` of a contour's length, as an open line. */
export function partial(c: Contour, frac: number): Pt[] {
  const pts = openPoints(c);
  if (frac >= 1) return pts;
  if (frac <= 0) return [];
  const total = contourLength(c) * frac;
  const out: Pt[] = [pts[0]];
  let run = 0;
  for (let k = 1; k < pts.length; k++) {
    const seg = dist(pts[k - 1], pts[k]);
    if (run + seg >= total) {
      const u = seg === 0 ? 0 : (total - run) / seg;
      out.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u]);
      return out;
    }
    run += seg;
    out.push(pts[k]);
  }
  return out;
}

/** The same contour with exactly n points spread evenly along it. */
export function resample(c: Contour, n: number): Pt[] {
  const pts = openPoints(c);
  const total = contourLength(c);
  if (pts.length === 0) return Array.from({ length: n }, () => [0, 0] as Pt);
  if (total === 0) return Array.from({ length: n }, () => [pts[0][0], pts[0][1]] as Pt);
  const count = c.closed ? n : n - 1;
  const out: Pt[] = [];
  let k = 1, run = 0;
  for (let j = 0; j < n; j++) {
    const target = (total * j) / count;
    while (k < pts.length - 1 && run + dist(pts[k - 1], pts[k]) < target) { run += dist(pts[k - 1], pts[k]); k++; }
    const seg = dist(pts[k - 1], pts[k]);
    const u = seg === 0 ? 0 : Math.min(1, (target - run) / seg);
    out.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u]);
  }
  return out;
}

export interface Box { x0: number; y0: number; x1: number; y1: number }

export function boundsOf(cs: Contour[]): Box {
  const b: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const c of cs) for (const p of c.pts) {
    if (p[0] < b.x0) b.x0 = p[0];
    if (p[0] > b.x1) b.x1 = p[0];
    if (p[1] < b.y0) b.y0 = p[1];
    if (p[1] > b.y1) b.y1 = p[1];
  }
  if (b.x0 === Infinity) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return b;
}

export const unionBox = (a: Box, b: Box): Box => ({
  x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
});

export const centerOf = (b: Box): Pt => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];

/** Signed area: tells which way round a contour runs. */
export function area(pts: Pt[]): number {
  let a = 0;
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k], q = pts[(k + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Two point lists of the same length, turned so their starts line up best. */
export function alignStart(a: Pt[], b: Pt[]): Pt[] {
  const n = b.length;
  let best = 0, bestD = Infinity;
  const stride = Math.max(1, Math.floor(n / 32));
  for (let s = 0; s < n; s += stride) {
    let d = 0;
    for (let k = 0; k < n; k += stride) {
      const p = a[k], q = b[(k + s) % n];
      d += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    }
    if (d < bestD) { bestD = d; best = s; }
  }
  return b.map((_, k) => b[(k + best) % n]);
}
