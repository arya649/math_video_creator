// Wonders: Fourier circles that draw a picture, simulations (worked out
// once, so they can be jumped through and always play the same), and
// particles for moments of celebration and change.

import { type Ctx, arrive, color, natural, num, registerAction, str } from '../actions';
import { type Contour, type Pt, openPoints, parsePath, resample } from '../geom';
import { numberGlyphs } from '../graph/axes';
import { withAlpha, mixColor } from '../color';
import { circle, fillGlyph, roundedRect, star, strokeGlyph } from '../shapes';
import type { Glyph } from '../thing';
import { ScriptError, choice, clamp, ease, hashString, isObject, rng } from '../util';
import { liveThing } from './graph';
import { fn } from '../graph/expr';

const dot = (c: Pt, r: number, col: string): Glyph => fillGlyph([circle(c, r)], 'dot', { color: col });
const line = (pts: Pt[], w: number, col: string, key = 'line'): Glyph => strokeGlyph([{ closed: false, pts }], w, key, { color: col });

function placeOf(ctx: Ctx, fallback: Pt = [0, 0]): Pt {
  return ctx.spec.position !== undefined ? ctx.world.point(ctx.spec.position, `${ctx.where}.position`) : fallback;
}

// ---- fourier ----

/** Outlines from an SVG file: every path, joined into one closed loop, centred and sized. */
function svgOutline(text: string, size: number, where: string): Pt[] {
  const ds = [...text.matchAll(/<path[^>]*\sd\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  const polys = [...text.matchAll(/<poly(?:gon|line)[^>]*\spoints\s*=\s*"([^"]+)"/g)].map((m) => `M ${m[1]} Z`);
  const contours: Contour[] = [...ds, ...polys].flatMap((d) => parsePath(d, 0.5));
  if (!contours.length) throw new ScriptError('has no <path> or <polygon> to trace.', where);
  // One long loop through every outline, longest first.
  contours.sort((a, b) => openPoints(b).length - openPoints(a).length);
  let pts: Pt[] = contours.flatMap((c) => openPoints(c));
  pts = pts.map(([x, y]) => [x, -y]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const k = size / Math.max(1e-9, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return resample({ closed: true, pts: pts.map(([x, y]) => [(x - cx) * k, (y - cy) * k]) }, 512);
}

function waveOutline(kind: string, size: number): Pt[] {
  // One period of the wave, out along the bottom and back along the top, so it closes.
  const n = 512, out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const s = (u * 2) % 1;
    const y = kind === 'square' ? (s < 0.5 ? 1 : -1) : kind === 'saw' ? 2 * s - 1 : 1 - 4 * Math.abs(s - 0.5);
    out.push(u < 0.5 ? [(-0.5 + 2 * u) * size, y * size * 0.25] : [(1.5 - 2 * u) * size, y * size * 0.25 - size * 0.02]);
  }
  return out;
}

registerAction('fourier', {
  summary: 'Circles turning on circles draw a picture (an SVG outline, or a wave).',
  worlds: ['board', 'graph'],
  params: ['file', 'wave', 'circles', 'add_circles', 'size', 'position', 'color', 'cycles'],
  build(ctx) {
    const { world, spec } = ctx;
    const size = num(ctx, 'size', 5);
    let pts: Pt[];
    if (typeof spec.file === 'string') {
      const text = world.texts[spec.file];
      if (!text) throw new ScriptError(`"${spec.file}" has not been opened with the script (put it beside script.json).`, `${ctx.where}.file`);
      pts = svgOutline(text, size, `${ctx.where}.file`);
    } else if (spec.wave !== undefined) pts = waveOutline(choice(spec.wave, ['square', 'saw', 'triangle'] as const, `${ctx.where}.wave`), size);
    else throw new ScriptError('needs "file" (an SVG outline) or "wave": "square", "saw" or "triangle".', ctx.where);
    // The picture as a sum of turning circles: its Fourier series, biggest circles first.
    const N = pts.length;
    const terms: { f: number; re: number; im: number; r: number }[] = [];
    for (let k = -N / 2; k < N / 2; k++) {
      let re = 0, im = 0;
      for (let j = 0; j < N; j++) { const a = (-2 * Math.PI * k * j) / N; re += pts[j][0] * Math.cos(a) - pts[j][1] * Math.sin(a); im += pts[j][0] * Math.sin(a) + pts[j][1] * Math.cos(a); }
      re /= N; im /= N;
      terms.push({ f: k, re, im, r: Math.hypot(re, im) });
    }
    terms.sort((a, b) => b.r - a.r);
    const most = Math.min(terms.length, typeof spec.circles === 'number' ? Math.round(spec.circles) : 60);
    const grow = Array.isArray(spec.add_circles) && spec.add_circles.length === 2 ? spec.add_circles.map(Number) as [number, number] : undefined;
    const at = placeOf(ctx);
    const col = color(ctx, 'color', world.theme.accent)!;
    const faint = withAlpha(world.theme.ink, 0.35);
    const d = natural(ctx, 8);
    const cycles = num(ctx, 'cycles', grow ? 3 : 1);
    const start = ctx.start;
    const sum = (n: number, tau: number): Pt[] => {
      // Where each circle's centre is, in turn, and the pen at the end.
      const out: Pt[] = [[at[0], at[1]]];
      let x = at[0], y = at[1];
      for (let i = 0; i < n; i++) {
        const tm = terms[i], a = 2 * Math.PI * tm.f * tau;
        x += tm.re * Math.cos(a) - tm.im * Math.sin(a);
        y += tm.re * Math.sin(a) + tm.im * Math.cos(a);
        out.push([x, y]);
      }
      return out;
    };
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('fourier'), (t) => {
      const u = t === Infinity ? 1 : clamp((t - start) / d);
      const n = grow ? Math.max(1, Math.round(grow[0] + (Math.min(most, grow[1]) - grow[0]) * u)) : most;
      const tau = (u * cycles) % 1 || (u >= 1 ? 1 : 0);
      const out: Glyph[] = [];
      // The drawing so far (with more circles, the whole outline as it now is).
      const traceTo = grow ? 1 : u * cycles >= 1 ? 1 : tau;
      const path: Pt[] = [];
      for (let k = 0; k <= 300 * traceTo; k++) { const s = sum(n, k / 300); path.push(s[s.length - 1]); }
      if (path.length > 1) out.push(line(path, 3.5, col, 'trace'));
      if (u < 1) {
        const chain = sum(n, tau);
        for (let i = 0; i < Math.min(n, 80); i++) {
          const r = terms[i].r;
          if (r > 0.02) out.push(strokeGlyph([circle(chain[i], r)], 1.2, 'ring', { color: faint }));
        }
        out.push(line(chain, 1.5, withAlpha(world.theme.ink, 0.7), 'arms'));
        out.push(dot(chain[chain.length - 1], 0.06, col));
      }
      return out;
    }, ctx.where);
    arrive(ctx, th, 'fade', start, 0.4);
    return { end: start + d, thing: th };
  },
}, ['epicycles']);

// ---- simulations ----

const SIMS = ['pendulum', 'projectile', 'spring', 'random_walk', 'monte_carlo_pi', 'galton', 'orbits', 'heat', 'wave', 'game_of_life', 'sort'] as const;

/** Numbers through time, worked out once at a fixed step. */
function frames<T>(d: number, step: number, init: T, next: (s: T, dt: number, i: number) => T): T[] {
  const out = [init];
  let s = init;
  for (let i = 1; i <= Math.ceil(d / step); i++) { s = next(s, step, i); out.push(s); }
  return out;
}

registerAction('simulation', {
  summary: 'Pendulums, throws, springs, random walks, π by darts, Galton boards, orbits, heat, waves, life, sorting.',
  worlds: ['board', 'graph'],
  params: ['kind', 'length', 'angle', 'double', 'speed', 'on', 'stiffness', 'damping', 'walkers', 'steps', 'dimensions', 'points', 'count', 'balls', 'rows', 'bodies', 'start', 'pattern', 'size', 'method', 'seed', 'position', 'color'],
  required: ['kind'],
  build(ctx) {
    const { world, spec } = ctx;
    const kind = choice(spec.kind, SIMS, `${ctx.where}.kind`);
    const d = natural(ctx, 6);
    const start = ctx.start;
    const at = placeOf(ctx);
    const ink = world.theme.ink;
    const accent = color(ctx, 'color', world.theme.accent)!;
    const cols = world.theme.colors;
    const r = rng(hashString(`${ctx.where}|${spec.seed ?? ''}`));
    const id = str(ctx, 'id') ?? world.newId(kind);
    const local = (t: number) => (t === Infinity ? d : clamp(t - start, 0, d));
    let draw: (t: number) => Glyph[];
    switch (kind) {
      case 'pendulum': {
        const L = num(ctx, 'length', 3), a0 = (num(ctx, 'angle', 40) * Math.PI) / 180;
        const g = 9.8 * (L / 3) * 1.5;
        const pivot: Pt = [at[0], at[1] + L * 0.6];
        const step = 1 / 240;
        if (spec.double === true) {
          // Two arms, worked out with small steps (Runge-Kutta), chaotic.
          type S = [number, number, number, number];
          const f = ([t1, t2, w1, w2]: S): S => {
            const dlt = t1 - t2, den = 3 - Math.cos(2 * dlt);
            const a1 = (-3 * g * Math.sin(t1) - g * Math.sin(t1 - 2 * t2) - 2 * Math.sin(dlt) * (w2 * w2 * L + w1 * w1 * L * Math.cos(dlt))) / (L * den);
            const a2 = (2 * Math.sin(dlt) * (2 * w1 * w1 * L + 2 * g * Math.cos(t1) + w2 * w2 * L * Math.cos(dlt))) / (L * den);
            return [w1, w2, a1, a2];
          };
          const st = frames<S>(d, step, [a0 * 2.2, a0 * 2.5, 0, 0], (s, h) => {
            const k1 = f(s), k2 = f(s.map((v, i) => v + (h / 2) * k1[i]) as S), k3 = f(s.map((v, i) => v + (h / 2) * k2[i]) as S), k4 = f(s.map((v, i) => v + h * k3[i]) as S);
            return s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) as S;
          });
          const L2 = L / 2;
          const pos = (s: S): [Pt, Pt] => { const p1: Pt = [pivot[0] + L2 * Math.sin(s[0]), pivot[1] - L2 * Math.cos(s[0])]; return [p1, [p1[0] + L2 * Math.sin(s[1]), p1[1] - L2 * Math.cos(s[1])]]; };
          draw = (t) => {
            const i = Math.round(local(t) / step);
            const trail: Pt[] = [];
            for (let k = Math.max(0, i - 600); k <= i; k += 3) trail.push(pos(st[k])[1]);
            const [p1, p2] = pos(st[i]);
            return [line(trail, 2, withAlpha(accent, 0.6), 'path'), line([pivot, p1, p2], 3, ink), dot(pivot, 0.06, ink), dot(p1, 0.14, cols[1]), dot(p2, 0.16, accent)];
          };
        } else {
          const st = frames<[number, number]>(d, step, [a0, 0], ([th, w], h) => { const w2 = w - (g / L) * Math.sin(th) * h; return [th + w2 * h, w2]; });
          const bob = (th: number): Pt => [pivot[0] + L * Math.sin(th), pivot[1] - L * Math.cos(th)];
          draw = (t) => {
            const i = Math.round(local(t) / step);
            const arc: Pt[] = [];
            for (let a = -a0; a <= a0 + 1e-9; a += a0 / 20) arc.push(bob(a));
            const p = bob(st[i][0]);
            return [line(arc, 1.5, withAlpha(ink, 0.25), 'path'), line([[pivot[0] - 0.6, pivot[1]], [pivot[0] + 0.6, pivot[1]]], 3, ink), line([pivot, p], 3, ink), dot(p, 0.25, accent)];
          };
        }
        break;
      }
      case 'projectile': {
        const v = num(ctx, 'speed', 8), ang = (num(ctx, 'angle', 50) * Math.PI) / 180;
        const g = 9.8;
        const T = (2 * v * Math.sin(ang)) / g;
        const axes = typeof spec.on === 'string' ? world.axes.get(spec.on) : spec.on === undefined && world.axes.size ? world.mainAxes(ctx.where) : undefined;
        const flight = Math.min(d, Math.max(1, T * 0.6 + 1));
        const R = (v * v * Math.sin(2 * ang)) / g;
        const scale = axes ? 1 : Math.min(10 / R, 4 / ((v * v * Math.sin(ang) ** 2) / (2 * g)));
        const origin: Pt = axes ? [0, 0] : [at[0] - (R * scale) / 2, at[1] - 1.8];
        const toSheet = (x: number, y: number): Pt => (axes ? axes.toSheet([x, y]) : [origin[0] + x * scale, origin[1] + y * scale]);
        const posAt = (s: number): Pt => toSheet(v * Math.cos(ang) * s, v * Math.sin(ang) * s - (g * s * s) / 2);
        draw = (t) => {
          const s = (local(t) / flight) * T;
          const k = Math.min(s, T);
          const path: Pt[] = [];
          for (let q = 0; q <= 60; q++) path.push(posAt((k * q) / 60));
          const out = [line(path, 3, withAlpha(accent, 0.8), 'path'), dot(posAt(k), 0.16, accent)];
          if (!axes) out.unshift(line([toSheet(-R * 0.1, 0), toSheet(R * 1.1, 0)], 2, withAlpha(ink, 0.5), 'ground'));
          return out;
        };
        break;
      }
      case 'spring': {
        const k = num(ctx, 'stiffness', 4), c = num(ctx, 'damping', 0.3);
        const w = Math.sqrt(Math.max(1e-6, k - (c * c) / 4));
        const top: Pt = [at[0], at[1] + 3], rest = at[1] - 0.5;
        draw = (t) => {
          const s = local(t);
          const y = rest + 1.5 * Math.exp((-c * s) / 2) * Math.cos(w * s);
          const coil: Pt[] = [top];
          const n = 16;
          for (let i = 1; i < n; i++) coil.push([top[0] + (i % 2 ? 0.3 : -0.3), top[1] + ((y + 0.4 - top[1]) * i) / n]);
          coil.push([top[0], y + 0.4]);
          return [line([[top[0] - 0.8, top[1]], [top[0] + 0.8, top[1]]], 4, ink), line(coil, 2.5, ink), fillGlyph([roundedRect(at[0] - 0.45, y - 0.4, at[0] + 0.45, y + 0.4, 0.08)], 'weight', { color: accent })];
        };
        break;
      }
      case 'random_walk': {
        const walkers = Math.round(num(ctx, 'walkers', 5)), steps = Math.round(num(ctx, 'steps', 200));
        if (spec.dimensions !== undefined && spec.dimensions !== 1 && spec.dimensions !== 2) throw new ScriptError('must be 1 or 2.', `${ctx.where}.dimensions`);
        const dims: number = spec.dimensions === 1 ? 1 : 2;
        const size = num(ctx, 'size', 6);
        const paths: Pt[][] = Array.from({ length: walkers }, () => {
          const p: Pt[] = [[0, 0]];
          for (let i = 0; i < steps; i++) {
            const [x, y] = p[p.length - 1];
            if (dims === 1) p.push([i + 1, y + (r() < 0.5 ? 1 : -1)]);
            else { const a = Math.floor(r() * 4); p.push([x + [1, -1, 0, 0][a], y + [0, 0, 1, -1][a]]); }
          }
          return p;
        });
        const k = dims === 1 ? size / steps : size / (2.5 * Math.sqrt(steps));
        const ky = dims === 1 ? size / (3 * Math.sqrt(steps)) : k;
        const map = (p: Pt): Pt => (dims === 1 ? [at[0] - size / 2 + p[0] * k, at[1] + p[1] * ky] : [at[0] + p[0] * k, at[1] + p[1] * k]);
        draw = (t) => {
          const n = Math.round((local(t) / d) * steps);
          const out: Glyph[] = [];
          if (dims === 1) out.push(line([map([0, 0]), map([steps, 0])], 1.5, withAlpha(ink, 0.4), 'axis'));
          paths.forEach((p, i) => { out.push(line(p.slice(0, n + 1).map(map), 2, withAlpha(cols[i % cols.length], 0.85))); out.push(dot(map(p[n]), 0.08, cols[i % cols.length])); });
          return out;
        };
        break;
      }
      case 'monte_carlo_pi': {
        const n = Math.round(num(ctx, 'points', 2000));
        const S = num(ctx, 'size', 5);
        const pts: [Pt, boolean][] = Array.from({ length: n }, () => { const x = r() * 2 - 1, y = r() * 2 - 1; return [[at[0] - 1.5 + (x * S) / 2, at[1] + (y * S) / 2], x * x + y * y <= 1]; });
        const inC = cols[2 % cols.length], outC = cols[3 % cols.length];
        draw = (t) => {
          const m = Math.round((local(t) / d) * n);
          const c = [at[0] - 1.5, at[1]] as Pt;
          const inside = pts.slice(0, m).filter((p) => p[1]);
          const outside = pts.slice(0, m).filter((p) => !p[1]);
          const out: Glyph[] = [
            strokeGlyph([roundedRect(c[0] - S / 2, c[1] - S / 2, c[0] + S / 2, c[1] + S / 2, 0)], 2.5, 'square', { color: ink }),
            strokeGlyph([circle(c, S / 2)], 2.5, 'circle', { color: ink }),
          ];
          if (inside.length) out.push(fillGlyph(inside.map((p) => circle(p[0], 0.025)), 'in', { color: inC }));
          if (outside.length) out.push(fillGlyph(outside.map((p) => circle(p[0], 0.025)), 'out', { color: outC }));
          if (spec.count !== false && m > 0) {
            out.push(...numberGlyphs(`\\pi \\approx 4 \\times \\frac{${inside.length}}{${m}} = ${(4 * inside.length / m).toFixed(3)}`, [c[0] + S / 2 + 0.5, c[1]], 'right', 0.42, ink, ''));
          }
          return out;
        };
        break;
      }
      case 'galton': {
        const rows = Math.round(num(ctx, 'rows', 10)), balls = Math.round(num(ctx, 'balls', 200));
        const gap = Math.min(0.55, 6 / rows), top = at[1] + (rows * gap) / 2 + 0.3;
        const fall = 1.6;
        const lag = Math.max(0.01, (d - fall) / balls);
        const routes = Array.from({ length: balls }, () => Array.from({ length: rows }, () => (r() < 0.5 ? 0 : 1)));
        const binOf = routes.map((rt) => rt.reduce((a: number, b: number) => a + b, 0));
        const pegX = (row: number, k: number) => at[0] + (k - row / 2) * gap;
        const binY = top - rows * gap - 0.2;
        const pegs: Contour[] = [];
        for (let row = 0; row < rows; row++) for (let k = 0; k <= row; k++) pegs.push(circle([pegX(row, k), top - row * gap], 0.04));
        draw = (t) => {
          const s = local(t);
          const out: Glyph[] = [fillGlyph(pegs, 'pegs', { color: withAlpha(ink, 0.6) })];
          const counts = Array(rows + 1).fill(0);
          const falling: Contour[] = [];
          routes.forEach((rt, b) => {
            const u = (s - b * lag) / fall;
            if (u < 0) return;
            if (u >= 1) { counts[binOf[b]]++; return; }
            // Down the rows, bouncing left or right at each peg.
            const x = u * rows, row = Math.floor(x), f = x - row;
            let k = 0;
            for (let q = 0; q < row; q++) k += rt[q];
            const x0 = pegX(row, k), x1 = pegX(row + 1, k + (rt[row] ?? 0));
            falling.push(circle([x0 + (x1 - x0) * f, top - (row + f) * gap + 0.12 * Math.sin(Math.PI * f)], 0.07));
          });
          const most = Math.max(4, ...counts);
          const bars = counts.map((c, k) => roundedRect(pegX(rows, k) - gap * 0.4, binY - (3 * c) / most, pegX(rows, k) + gap * 0.4, binY, 0.03)).filter((_, k) => counts[k] > 0);
          if (bars.length) out.push(fillGlyph(bars, 'bins', { color: accent }));
          if (falling.length) out.push(fillGlyph(falling, 'balls', { color: cols[0] }));
          return out;
        };
        break;
      }
      case 'orbits': {
        const n = Math.round(num(ctx, 'bodies', 3));
        const radii = Array.from({ length: n }, (_, i) => 1 + i * 1.1);
        const phase = radii.map(() => r() * 2 * Math.PI);
        draw = (t) => {
          const s = local(t);
          const out: Glyph[] = [dot(at, 0.35, world.theme.shades.yellow ?? '#ffdd44')];
          radii.forEach((R, i) => {
            const w = 2.2 / Math.pow(R, 1.5);
            out.push(strokeGlyph([circle(at, R)], 1, 'orbit', { color: withAlpha(ink, 0.2) }));
            const tail: Pt[] = [];
            for (let q = 0; q <= 20; q++) { const a = phase[i] + w * (s - q * 0.05); tail.push([at[0] + R * Math.cos(a), at[1] + R * Math.sin(a)]); }
            out.push(line(tail, 3, withAlpha(cols[i % cols.length], 0.4), 'tail'));
            out.push(dot(tail[0], 0.12 + 0.03 * i, cols[i % cols.length]));
          });
          return out;
        };
        break;
      }
      case 'heat': case 'wave': {
        const N = 80, size = num(ctx, 'size', 10);
        const startShape = spec.start ?? 'spike';
        const f0 = (x: number) => startShape === 'spike' ? Math.exp(-((x - 0.5) ** 2) / 0.002) : startShape === 'step' ? (x < 0.5 ? 1 : 0) : (() => { const g = fn(String(startShape), `${ctx.where}.start`); return g({ x }); })();
        const init = Array.from({ length: N }, (_, i) => f0(i / (N - 1)));
        const step = 1 / 60;
        let st: number[][];
        if (kind === 'heat') {
          st = frames(d, step, init, (u) => { let v = u; for (let s = 0; s < 1; s++) { const nv = v.slice(); for (let i = 1; i < N - 1; i++) nv[i] = v[i] + 0.24 * (v[i - 1] - 2 * v[i] + v[i + 1]); v = nv; } return v; });
        } else {
          let prev = init.slice();
          st = frames(d, step, init, (u) => { let cur = u, p = prev; for (let s = 0; s < 4; s++) { const nv = cur.map((v, i) => (i === 0 || i === N - 1 ? 0 : 2 * v - p[i] + 0.25 * (cur[i - 1] - 2 * v + cur[i + 1]))); p = cur; cur = nv; } prev = p; return cur; });
        }
        const x = (i: number) => at[0] - size / 2 + (size * i) / (N - 1);
        const hot = world.theme.shades.red ?? '#fc6255', cold = world.theme.shades.blue ?? '#58c4dd';
        draw = (t) => {
          const u = st[Math.round(local(t) / step)];
          if (kind === 'heat') {
            const max = Math.max(1e-9, ...init);
            const out: Glyph[] = u.map((v, i) => fillGlyph([roundedRect(x(i) - size / N / 2, at[1] - 1.6, x(i) + size / N / 2 + 0.01, at[1] - 1, 0)], 'cell', { color: mixColor(cold, hot, clamp(v / max)) }));
            out.push(line(u.map((v, i) => [x(i), at[1] - 0.6 + (2.6 * v) / max] as Pt), 3, accent));
            return out;
          }
          return [line(u.map((v, i) => [x(i), at[1] + v * 1.5] as Pt), 3.5, accent), dot([x(0), at[1]], 0.08, ink), dot([x(N - 1), at[1]], 0.08, ink)];
        };
        break;
      }
      case 'game_of_life': {
        const n = Math.round(num(ctx, 'size', 30));
        const pattern = String(spec.pattern ?? 'random');
        let g = Array.from({ length: n }, () => Array(n).fill(false) as boolean[]);
        const put = (cells: [number, number][], ox: number, oy: number) => cells.forEach(([x, y]) => { if (g[oy + y]?.[ox + x] !== undefined) g[oy + y][ox + x] = true; });
        if (pattern === 'random') g = g.map((row) => row.map(() => r() < 0.3));
        else if (pattern === 'glider') put([[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]], 2, 2);
        else if (pattern === 'blinker') put([[0, 0], [1, 0], [2, 0]], Math.floor(n / 2) - 1, Math.floor(n / 2));
        else if (pattern === 'gun') put([[0, 4], [0, 5], [1, 4], [1, 5], [10, 4], [10, 5], [10, 6], [11, 3], [11, 7], [12, 2], [12, 8], [13, 2], [13, 8], [14, 5], [15, 3], [15, 7], [16, 4], [16, 5], [16, 6], [17, 5], [20, 2], [20, 3], [20, 4], [21, 2], [21, 3], [21, 4], [22, 1], [22, 5], [24, 0], [24, 1], [24, 5], [24, 6], [34, 2], [34, 3], [35, 2], [35, 3]], 1, 1);
        else throw new ScriptError('must be "random", "glider", "blinker" or "gun".', `${ctx.where}.pattern`);
        const per = 1 / 6;
        const gens = frames(d, per, g, (cur) => cur.map((row, y) => row.map((alive, x) => {
          let c = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && cur[(y + dy + n) % n][(x + dx + n) % n]) c++;
          return alive ? c === 2 || c === 3 : c === 3;
        })));
        const cell = Math.min(8, world.frameH * 0.85) / n;
        draw = (t) => {
          const G = gens[Math.min(gens.length - 1, Math.floor(local(t) / per))];
          const live: Contour[] = [];
          G.forEach((row, y) => row.forEach((a, x) => { if (a) live.push(roundedRect(at[0] - (n * cell) / 2 + x * cell + cell * 0.08, at[1] + (n * cell) / 2 - (y + 1) * cell + cell * 0.08, at[0] - (n * cell) / 2 + (x + 1) * cell - cell * 0.08, at[1] + (n * cell) / 2 - y * cell - cell * 0.08, cell * 0.15)); }));
          return [strokeGlyph([roundedRect(at[0] - (n * cell) / 2, at[1] - (n * cell) / 2, at[0] + (n * cell) / 2, at[1] + (n * cell) / 2, 0)], 1.5, 'board', { color: withAlpha(ink, 0.3) }), ...(live.length ? [fillGlyph(live, 'cells', { color: accent })] : [])];
        };
        break;
      }
      default: {
        // sort
        const n = Math.round(num(ctx, 'count', 16));
        const method = choice(spec.method, ['bubble', 'insertion', 'merge', 'quick'] as const, `${ctx.where}.method`, 'bubble');
        const a = Array.from({ length: n }, (_, i) => i + 1);
        for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        const states: { arr: number[]; look: number[] }[] = [{ arr: a.slice(), look: [] }];
        const snap = (arr: number[], look: number[]) => states.push({ arr: arr.slice(), look });
        const w = a.slice();
        if (method === 'bubble') { for (let i = 0; i < n; i++) for (let j = 0; j < n - 1 - i; j++) { if (w[j] > w[j + 1]) [w[j], w[j + 1]] = [w[j + 1], w[j]]; snap(w, [j, j + 1]); } }
        else if (method === 'insertion') { for (let i = 1; i < n; i++) for (let j = i; j > 0 && w[j - 1] > w[j]; j--) { [w[j - 1], w[j]] = [w[j], w[j - 1]]; snap(w, [j - 1, j]); } }
        else if (method === 'merge') {
          const ms = (lo: number, hi: number) => { if (hi - lo < 2) return; const mid = (lo + hi) >> 1; ms(lo, mid); ms(mid, hi); const m = w.slice(lo, hi).sort((p, q) => p - q); for (let k = 0; k < m.length; k++) { w[lo + k] = m[k]; snap(w, [lo + k]); } };
          ms(0, n);
        } else {
          const qs = (lo: number, hi: number) => { if (lo >= hi) return; const p = w[hi]; let i = lo; for (let j = lo; j < hi; j++) { if (w[j] < p) { [w[i], w[j]] = [w[j], w[i]]; i++; } snap(w, [j, hi]); } [w[i], w[hi]] = [w[hi], w[i]]; snap(w, [i]); qs(lo, i - 1); qs(i + 1, hi); };
          qs(0, n - 1);
        }
        snap(w, []);
        const size = num(ctx, 'size', 10), bw = size / n;
        draw = (t) => {
          const s = states[Math.min(states.length - 1, Math.floor((local(t) / d) * (states.length - 1)))];
          const done = s === states[states.length - 1];
          return s.arr.map((v, i) => fillGlyph([roundedRect(at[0] - size / 2 + i * bw + bw * 0.1, at[1] - 2.5, at[0] - size / 2 + (i + 1) * bw - bw * 0.1, at[1] - 2.5 + (5 * v) / n, bw * 0.12)], 'bar', { color: done ? world.theme.good : s.look.includes(i) ? accent : cols[0] }));
        };
      }
    }
    const th = liveThing(ctx, id, draw, ctx.where);
    arrive(ctx, th, 'fade', start, 0.4);
    return { end: start + d, thing: th };
  },
}, ['simulate']);

// ---- particles ----

/** Points along a thing's outlines, on the sheet. */
function outlinePoints(ctx: Ctx, n: number): Pt[] {
  const th = ctx.world.get(ctx.spec.on, `${ctx.where}.on`);
  const m = [th.build.scale, 0, 0, th.build.scale, th.build.x, th.build.y];
  const all: Pt[] = th.build.glyphs.flatMap((g) => g.contours.flatMap((c) => openPoints(c)));
  if (!all.length) {
    const b = ctx.world.boxOf(th.id, ctx.where);
    return Array.from({ length: n }, (_, i) => [b.x0 + ((b.x1 - b.x0) * (i % 10)) / 9, b.y0 + ((b.y1 - b.y0) * Math.floor(i / 10)) / Math.max(1, Math.ceil(n / 10) - 1)] as Pt);
  }
  return Array.from({ length: n }, (_, i) => { const p = all[Math.floor((i * all.length) / n)]; return [m[0] * p[0] + m[4], m[3] * p[1] + m[5]] as Pt; });
}

registerAction('particles', {
  summary: 'Sparkle, confetti, dust, stars; or particles that gather into a thing, or a thing that scatters.',
  params: ['kind', 'on', 'count', 'color', 'stay'],
  build(ctx) {
    const { world, spec } = ctx;
    const kind = choice(spec.kind, ['sparkle', 'confetti', 'dust', 'stars', 'gather', 'scatter'] as const, `${ctx.where}.kind`, 'sparkle');
    if ((kind === 'gather' || kind === 'scatter' || kind === 'sparkle') && spec.on === undefined) throw new ScriptError(`"${kind}" needs "on": the thing it happens to.`, `${ctx.where}.on`);
    const r = rng(hashString(ctx.where));
    const start = ctx.start;
    const d = natural(ctx, kind === 'confetti' ? 3.5 : kind === 'stars' || kind === 'dust' ? 6 : 1.8);
    const W = world.frameW / 2, H = world.frameH / 2;
    const cols = isObject(spec) && spec.color !== undefined ? [color(ctx, 'color')!] : world.theme.colors;
    const count = Math.round(num(ctx, 'count', { sparkle: 24, confetti: 140, dust: 70, stars: 160, gather: 160, scatter: 160 }[kind]));
    const id = str(ctx, 'id') ?? world.newId(kind);
    const lasting = kind === 'stars' || kind === 'dust' ? spec.stay !== false : spec.stay === true;
    const local = (t: number) => (t === Infinity ? d : t - start);
    let draw: (t: number) => Glyph[];
    let screen = false;
    switch (kind) {
      case 'sparkle': {
        const b = world.boxOf(String(spec.on), `${ctx.where}.on`);
        const p = Array.from({ length: count }, () => ({ at: [b.x0 - 0.3 + r() * (b.x1 - b.x0 + 0.6), b.y0 - 0.3 + r() * (b.y1 - b.y0 + 0.6)] as Pt, t0: r() * d * 0.7, s: 0.1 + r() * 0.16, c: r() < 0.5 ? '#ffffff' : world.theme.accent }));
        draw = (t) => p.flatMap((q) => { const u = (local(t) - q.t0) / 0.6; if (u <= 0 || u >= 1) return []; const k = Math.sin(Math.PI * u); return [fillGlyph([{ closed: true, pts: star(q.at, q.s * k * 1.8, 4) }], 'glint', { color: withAlpha(q.c, k) })]; });
        break;
      }
      case 'confetti': {
        screen = true;
        const p = Array.from({ length: count }, () => ({ x: -W + r() * 2 * W, t0: r() * d * 0.4, v: 2.5 + r() * 3, a: r() * 6, w: 2 + r() * 4, sway: r() * 2, c: cols[Math.floor(r() * cols.length)] }));
        draw = (t) => p.flatMap((q) => {
          const s = local(t) - q.t0;
          if (s < 0) return [];
          const y = H + 0.3 - q.v * s, x = q.x + 0.4 * Math.sin(q.sway + s * 2);
          if (y < -H - 0.5) return [];
          const ang = q.a + s * q.w, c = Math.cos(ang) * 0.12, sn = Math.sin(ang) * 0.07 * Math.abs(Math.cos(s * 5));
          return [fillGlyph([{ closed: true, pts: [[x - c, y - sn], [x + sn, y - c], [x + c, y + sn], [x - sn, y + c]] }], 'bit', { color: q.c })];
        });
        break;
      }
      case 'dust': case 'stars': {
        screen = true;
        const p = Array.from({ length: count }, () => ({ at: [-W + r() * 2 * W, -H + r() * 2 * H] as Pt, ph: r() * 6.3, s: kind === 'stars' ? 0.015 + r() * 0.035 : 0.02 + r() * 0.03, v: [(r() - 0.5) * 0.15, (r() - 0.3) * 0.1] as Pt }));
        draw = (t) => {
          const s = local(t);
          return [fillGlyph(p.map((q) => circle(kind === 'dust' ? [((q.at[0] + q.v[0] * s + W) % (2 * W)) - W, ((q.at[1] + q.v[1] * s + H) % (2 * H)) - H] : q.at, q.s * (kind === 'stars' ? 0.7 + 0.3 * Math.sin(q.ph + s * 2) : 1))), 'specks', { color: withAlpha(world.theme.ink, kind === 'stars' ? 0.8 : 0.3) })];
        };
        break;
      }
      default: {
        // gather and scatter: the thing's own outline, in specks.
        const target = world.get(spec.on, `${ctx.where}.on`);
        const home = outlinePoints(ctx, count);
        const away = home.map((p) => { const a = r() * 2 * Math.PI, dist = 2 + r() * 6; return [p[0] + Math.cos(a) * dist, p[1] + Math.sin(a) * dist] as Pt; });
        const lag = home.map(() => r() * 0.3);
        const col = world.theme.accent;
        draw = (t) => {
          const u = clamp(local(t) / d);
          const pts = home.map((h, i) => {
            const k = ease('smooth', clamp((u - lag[i]) / 0.7));
            return kind === 'gather' ? [away[i][0] + (h[0] - away[i][0]) * k, away[i][1] + (h[1] - away[i][1]) * k] as Pt : [h[0] + (away[i][0] - h[0]) * k, h[1] + (away[i][1] - h[1]) * k] as Pt;
          });
          const fade = kind === 'gather' ? clamp((1 - u) * 5) : 1 - u;
          return fade > 0.01 ? [fillGlyph(pts.map((p) => circle(p, 0.04)), 'specks', { color: withAlpha(col, fade) })] : [];
        };
        if (kind === 'gather') {
          ctx.act({ start, duration: d, apply(u) { target.state.opacity *= clamp((u - 0.75) * 4); } });
        } else {
          ctx.act({ start, duration: 0.15, apply(u) { if (u >= 1) target.state.visible = false; else target.state.opacity *= 1 - u; } });
        }
      }
    }
    const th = liveThing(ctx, id, draw, ctx.where);
    th.screen = screen;
    th.layer = kind === 'stars' || kind === 'dust' ? -4 : 7;
    th.base.visible = true;
    if (kind === 'confetti') ctx.sound('pop', start);
    if (kind === 'sparkle') ctx.sound('chime', start);
    if (!lasting) ctx.act({ start: start + d, duration: 0, apply() { th.state.visible = false; } });
    return { end: start + d, thing: th };
  },
}, ['sparkles', 'confetti']);
