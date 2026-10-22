// Equation steps: which symbol of the old line becomes which of the new.
//
// In order:
//   1. pairs the script names itself;
//   2. named parts (\part{name}{...}) with the same name;
//   3. the longest run of symbols the two lines share, in order;
//   4. symbols left over that are the same in both (they have moved);
//   5. left-over symbols whose neighbours were paired (a + becoming a -).
// Whatever is still left fades out (old) or in (new).

import { type Pt, alignStart, boundsOf, centerOf, resample } from './geom';
import type { Glyph } from './thing';

export interface Pair { from?: number; to?: number }

export function matchGlyphs(
  a: Glyph[],
  b: Glyph[],
  opts: { mode?: 'auto' | 'parts' | 'none'; explicit?: [number[], number[]][]; neighbours?: boolean } = {},
): Pair[] {
  const mode = opts.mode ?? 'auto';
  const usedA = new Set<number>(), usedB = new Set<number>();
  const pairs: Pair[] = [];
  const pair = (i: number, j: number) => { usedA.add(i); usedB.add(j); pairs.push({ from: i, to: j }); };

  for (const [ia, ib] of opts.explicit ?? []) {
    const n = Math.max(ia.length, ib.length);
    for (let k = 0; k < n; k++) {
      const i = ia[Math.min(k, ia.length - 1)], j = ib[Math.min(k, ib.length - 1)];
      if (k < ia.length && k < ib.length) pair(i, j);
      else if (k < ia.length) { usedA.add(i); pairs.push({ from: i, to: j }); }
      else { usedB.add(j); pairs.push({ from: i, to: j }); }
    }
  }

  if (mode !== 'none') {
    const names = new Set<string>();
    for (const g of a) for (const p of g.parts) names.add(p);
    for (const name of names) {
      const ia = a.map((g, i) => (g.parts.includes(name) && !usedA.has(i) ? i : -1)).filter((i) => i >= 0);
      const ib = b.map((g, j) => (g.parts.includes(name) && !usedB.has(j) ? j : -1)).filter((j) => j >= 0);
      if (!ia.length || !ib.length) continue;
      // Within a part, match by the same rules, then morph what is left.
      const sub = lcs(ia.map((i) => a[i].key), ib.map((j) => b[j].key));
      for (const [x, y] of sub) pair(ia[x], ib[y]);
      const ra = ia.filter((i) => !usedA.has(i)), rb = ib.filter((j) => !usedB.has(j));
      for (let k = 0; k < Math.min(ra.length, rb.length); k++) pair(ra[k], rb[k]);
    }
  }

  if (mode === 'auto') {
    const ia = a.map((_, i) => i).filter((i) => !usedA.has(i));
    const ib = b.map((_, j) => j).filter((j) => !usedB.has(j));
    for (const [x, y] of lcs(ia.map((i) => a[i].key), ib.map((j) => b[j].key))) pair(ia[x], ib[y]);

    // Same symbol, moved somewhere else: pair nearest first.
    const restA = a.map((_, i) => i).filter((i) => !usedA.has(i));
    for (const i of restA) {
      let best = -1, bestD = Infinity;
      const ca = centerOf(boundsOf(a[i].contours));
      for (let j = 0; j < b.length; j++) {
        if (usedB.has(j) || b[j].key !== a[i].key) continue;
        const cb = centerOf(boundsOf(b[j].contours));
        const d = Math.hypot(ca[0] - cb[0], ca[1] - cb[1]);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best >= 0) pair(i, best);
    }

    // A symbol whose neighbour moved with a partner becomes the symbol next
    // to that partner: "+5" moving across "=" becomes "-5".
    if (opts.neighbours === false) return finish(a, b, usedA, usedB, pairs);
    const partner = new Map<number, number>();
    for (const p of pairs) if (p.from !== undefined && p.to !== undefined) partner.set(p.from, p.to);
    for (let i = 0; i < a.length; i++) {
      if (usedA.has(i)) continue;
      for (const side of [1, -1]) {
        const n = partner.get(i + side);
        if (n === undefined) continue;
        const j = n - side;
        if (j >= 0 && j < b.length && !usedB.has(j) && isSign(a[i].key) === isSign(b[j].key)) { pair(i, j); break; }
      }
    }
  }

  return finish(a, b, usedA, usedB, pairs);
}

function finish(a: Glyph[], b: Glyph[], usedA: Set<number>, usedB: Set<number>, pairs: Pair[]): Pair[] {
  for (let i = 0; i < a.length; i++) if (!usedA.has(i)) pairs.push({ from: i });
  for (let j = 0; j < b.length; j++) if (!usedB.has(j)) pairs.push({ to: j });
  return pairs;
}

const SIGNS = new Set(['c2B', 'c2212', 'cD7', 'cF7', 'c22C5', 'cB1']);
const isSign = (k: string) => SIGNS.has(k);

/** Longest common run of keys, in order: index pairs. */
export function lcs(a: string[], b: string[]): [number, number][] {
  const n = a.length, m = b.length;
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  }
  const out: [number, number][] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([i, j]); i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) i++;
    else j++;
  }
  return out;
}

/** Find a run of keys inside a longer list: the start of each place it is. */
export function findRun(hay: string[], needle: string[]): number[] {
  const out: number[] = [];
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    out.push(i);
  }
  return out;
}

// ---- Morphing one glyph into another ----

export interface MorphPlan {
  /** Same shape, only moved and scaled. */
  same: boolean;
  shift: Pt;
  scale: number;
  /** For a change of shape: matching point lists. */
  from?: Pt[][];
  to?: Pt[][];
}

const POINTS = 72;

export function planMorph(a: Glyph, b: Glyph): MorphPlan {
  const ba = boundsOf(a.contours), bb = boundsOf(b.contours);
  const ca = centerOf(ba), cb = centerOf(bb);
  const ha = Math.max(1e-6, ba.y1 - ba.y0), hb = Math.max(1e-6, bb.y1 - bb.y0);
  if (a.key === b.key && a.contours.length === b.contours.length && Math.abs(ha / hb - 1) < 0.02) {
    return { same: true, shift: [cb[0] - ca[0], cb[1] - ca[1]], scale: hb / ha };
  }
  const n = Math.max(a.contours.length, b.contours.length);
  const from: Pt[][] = [], to: Pt[][] = [];
  for (let k = 0; k < n; k++) {
    const pa = a.contours[k] ? resample(a.contours[k], POINTS) : Array.from({ length: POINTS }, () => [ca[0], ca[1]] as Pt);
    const pb = b.contours[k] ? resample(b.contours[k], POINTS) : Array.from({ length: POINTS }, () => [cb[0], cb[1]] as Pt);
    from.push(pa);
    to.push(alignStart(pa, pb));
  }
  return { same: false, shift: [cb[0] - ca[0], cb[1] - ca[1]], scale: hb / ha, from, to };
}

/** The glyph part way through its morph. `lift` raises it on an arc. */
export function morphAt(a: Glyph, b: Glyph, plan: MorphPlan, u: number, lift = 0): Glyph {
  const up = lift * Math.sin(Math.PI * u);
  if (plan.same) {
    const ba = boundsOf(a.contours), ca = centerOf(ba);
    const s = 1 + (plan.scale - 1) * u;
    const dx = plan.shift[0] * u, dy = plan.shift[1] * u + up;
    return {
      ...a,
      color: u < 0.5 ? a.color : b.color,
      contours: a.contours.map((c) => ({
        closed: c.closed,
        pts: c.pts.map(([x, y]) => [ca[0] + (x - ca[0]) * s + dx, ca[1] + (y - ca[1]) * s + dy] as Pt),
      })),
    };
  }
  const contours = plan.from!.map((pa, k) => ({
    closed: true,
    pts: pa.map(([x, y], i) => {
      const q = plan.to![k][i];
      return [x + (q[0] - x) * u, y + (q[1] - y) * u + up] as Pt;
    }),
  }));
  return { ...b, contours, color: u < 0.5 ? a.color : b.color, fill: a.fill || b.fill };
}
