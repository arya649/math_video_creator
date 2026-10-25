// A space scene: its 3D objects, its camera, its light, and the painter
// that turns everything into flat outlines each frame, nearest last.

import { mixColor, parseColor, withAlpha } from '../color';
import type { Pt } from '../geom';
import { arrowHead } from '../shapes';
import type { Glyph, Thing } from '../thing';
import { numberGlyphs } from '../graph/axes';
import { clamp, ease } from '../util';
import { type Cam, type Eye, type V3, add, centroid, dot, eyeOf, len, mul, normalOf, norm, project, sub } from './geo3d';

/** One thing to draw, in space. */
export type Prim =
  | { kind: 'face'; pts: V3[]; color: string; opacity: number; twoSided: boolean; shade: boolean; glow?: boolean }
  | { kind: 'line'; a: V3; b: V3; color: string; width: number; dash?: boolean; front?: boolean }
  | { kind: 'arrow'; a: V3; b: V3; color: string; width: number }
  | { kind: 'dot'; at: V3; r: number; color: string }
  | { kind: 'label'; at: V3; tex: string; color: string; size: number; side?: 'above' | 'below' | 'left' | 'right' | 'center' };

export interface Obj3D {
  thing: Thing;
  /** What it is at time t; `drawn` is how far it has arrived (0 to 1). */
  prims(t: number, drawn: number): Prim[];
  bounds(): [V3, V3];
  /** Flat faces, for cutting, slicing and unfolding. */
  faces?: () => V3[][];
  flat?: boolean;
  /** Where it stands, for turning and growing about. */
  center(): V3;
}

export type Light = 'soft' | 'studio' | 'dramatic' | 'flat';

const LIGHTS: Record<Light, { ambient: number; lamps: [V3, number][] }> = {
  soft: { ambient: 0.3, lamps: [[norm([0.35, -0.5, 0.85]), 0.72], [norm([-1, -0.3, 0.2]), 0.25]] },
  studio: { ambient: 0.35, lamps: [[norm([-0.5, -0.7, 0.9]), 0.6], [norm([0.8, -0.3, 0.3]), 0.25]] },
  dramatic: { ambient: 0.15, lamps: [[norm([-0.8, -0.3, 0.5]), 1.0]] },
  flat: { ambient: 1, lamps: [] },
};

interface Shot { start: number; blend: number; view(t: number): Cam }

export class Space {
  objects: Obj3D[] = [];
  shots: Shot[] = [];
  light: Light = 'soft';
  /** How much far things fade (the "depth" look), and the colour they fade to. */
  depth = 0;
  background = '#000000';
  floor = false;
  /** The scene's own starting camera; anything left out is fitted to what is in the scene. */
  startCam: Partial<Cam> = {};
  private fitted?: Cam;
  private startViews = new Map<number, Cam>();
  private rgb = new Map<string, [number, number, number]>();

  constructor(public frameW: number, public frameH: number) {}

  /** Everything in the scene, as a box. */
  bounds(objs = this.objects): [V3, V3] {
    let lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
    for (const o of objs) {
      const [a, b] = o.bounds();
      lo = [Math.min(lo[0], a[0]), Math.min(lo[1], a[1]), Math.min(lo[2], a[2])];
      hi = [Math.max(hi[0], b[0]), Math.max(hi[1], b[1]), Math.max(hi[2], b[2])];
    }
    if (!Number.isFinite(lo[0])) return [[-2, -2, 0], [2, 2, 2]];
    return [lo, hi];
  }

  /** The nearest camera distance that keeps a box in view from these angles. */
  fitDistance(b: [V3, V3], pad = 1.15, elevation = 24, angle = -32, target?: V3): number {
    const corners: V3[] = [];
    for (const x of [b[0][0], b[1][0]]) for (const y of [b[0][1], b[1][1]]) for (const z of [b[0][2], b[1][2]]) corners.push([x, y, z]);
    const c = target ?? centroid(b);
    const W = this.frameW / 2 / pad, H = this.frameH / 2 / pad;
    const fits = (d: number) => {
      const e = eyeOf({ elevation, angle, distance: d, target: c }, this.frameH);
      return corners.every((p) => { const q = project(e, p); return q[2] > 0.2 && Math.abs(q[0]) <= W && Math.abs(q[1]) <= H; });
    };
    let lo = 0.3, hi = 1000;
    if (!fits(hi)) return hi;
    for (let k = 0; k < 40; k++) { const m = Math.sqrt(lo * hi); if (fits(m)) hi = m; else lo = m; }
    return hi;
  }

  restCam(): Cam {
    if (!this.fitted) {
      const b = this.bounds();
      const elevation = this.startCam.elevation ?? 24, angle = this.startCam.angle ?? -32;
      const target = this.startCam.target ?? centroid(b);
      this.fitted = { elevation, angle, target, distance: this.startCam.distance ?? this.fitDistance(b, 1.15, elevation, angle, target) };
    }
    return this.fitted;
  }

  addShot(s: Shot) {
    this.shots.push(s);
    this.shots.sort((a, b) => a.start - b.start);
    this.startViews.clear();
  }

  camAt(t: number, upto = this.shots.length): Cam {
    let c = this.restCam();
    for (let i = 0; i < upto; i++) {
      const s = this.shots[i];
      if (s.start > t) break;
      const before = i === 0 ? this.restCam() : this.startView(i);
      const to = s.view(t);
      const u = s.blend <= 0 ? 1 : ease('smooth', clamp((t - s.start) / s.blend));
      c = {
        elevation: before.elevation + (to.elevation - before.elevation) * u,
        angle: before.angle + (to.angle - before.angle) * u,
        distance: Math.exp(Math.log(before.distance) + (Math.log(to.distance) - Math.log(before.distance)) * u),
        target: add(before.target, mul(sub(to.target, before.target), u)),
      };
    }
    return c;
  }

  startView(i: number): Cam {
    let v = this.startViews.get(i);
    if (!v) { v = this.camAt(this.shots[i].start - 1e-6, i); this.startViews.set(i, v); }
    return v;
  }

  /** A colour lit by the scene's light, for a face with this normal. */
  private lit(color: string, n: V3): string {
    const L = LIGHTS[this.light];
    if (!L.lamps.length) return color;
    let k = L.ambient;
    for (const [d, s] of L.lamps) k += s * Math.max(0, dot(n, d));
    let c = this.rgb.get(color);
    if (!c) { const p = parseColor(color); c = p ? [p[0], p[1], p[2]] : [200, 200, 200]; this.rgb.set(color, c); }
    const f = (x: number) => Math.round(Math.min(255, x * Math.min(1.25, k)));
    return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
  }

  /** The whole space at time t, as outlines on the sheet. */
  paint(t: number, ink: string, gridColor: string): Glyph[] {
    const cam = this.camAt(t);
    const e = eyeOf(cam, this.frameH);
    // Depth: things beyond what the camera looks at fade towards the background.
    const fog = (z: number) => (this.depth > 0 ? this.depth * clamp((z - cam.distance) / (cam.distance * 0.9)) * 0.85 : 0);
    type Item = { depth: number; glyphs: () => Glyph[] };
    const items: Item[] = [];
    const P = (p: V3) => project(e, p);
    const pushLine = (a: V3, b: V3, color: string, width: number, dash = false, bias = 0) => {
      // Long lines are drawn in pieces, so each piece sorts by its own depth.
      const pieces = Math.max(1, Math.min(24, Math.ceil(len(sub(b, a)) / 0.6)));
      for (let k = 0; k < pieces; k++) {
        const p = add(a, mul(sub(b, a), k / pieces)), q = add(a, mul(sub(b, a), (k + 1) / pieces));
        const pp = P(p), qq = P(q);
        if (pp[2] < 0.1 || qq[2] < 0.1) continue;
        items.push({ depth: (pp[2] + qq[2]) / 2 - bias, glyphs: () => [{ contours: [{ closed: false, pts: [[pp[0], pp[1]], [qq[0], qq[1]]] }], fill: false, stroke: true, width, key: 'line3d', parts: [], color, dash }] });
      }
    };
    if (this.floor) {
      const [lo, hi] = this.bounds();
      const z = Math.min(0, lo[2]);
      const r = Math.ceil(Math.max(4, Math.abs(lo[0]), Math.abs(hi[0]), Math.abs(lo[1]), Math.abs(hi[1])) * 1.4);
      for (let k = -r; k <= r; k++) {
        pushLine([k, -r, z], [k, r, z], gridColor, 1.2, false, -0.05);
        pushLine([-r, k, z], [r, k, z], gridColor, 1.2, false, -0.05);
      }
    }
    for (const o of this.objects) {
      const th = o.thing;
      if (!th.shown()) continue;
      const s = th.state;
      const alpha = th.opacity() * (1 - s.dim);
      if (alpha <= 0.002) continue;
      const tint = s.color;
      const c = o.center();
      const scale = s.scale;
      const place = (p: V3): V3 => (scale === 1 ? p : add(c, mul(sub(p, c), scale)));
      for (const pr of o.prims(t, s.drawn)) {
        switch (pr.kind) {
          case 'face': {
            const pts = pr.pts.map(place);
            const pp = pts.map(P);
            if (pp.some((q) => q[2] < 0.1)) break;
            let n = normalOf(pts);
            const toEye = sub(e.eye, centroid(pts));
            const facing = dot(n, toEye) > 0;
            const opacity = pr.opacity * alpha;
            if (!facing && !pr.twoSided && opacity >= 0.999) break;
            if (!facing) n = mul(n, -1);
            const base = tinted(pr.color, tint);
            const lit = pr.shade ? this.lit(base, n) : base;
            const col = this.depth > 0 ? mixColor(lit, this.background, fog(pp.reduce((a, q) => a + q[2], 0) / pp.length)) : lit;
            const depth = pp.reduce((a, q) => a + q[2], 0) / pp.length;
            const solid = opacity >= 0.999;
            items.push({ depth, glyphs: () => [{ contours: [{ closed: true, pts: pp.map((q) => [q[0], q[1]] as Pt) }], fill: true, stroke: solid, width: 0.8, key: 'face', parts: [], color: col, fillOpacity: solid ? undefined : opacity }] });
            break;
          }
          case 'line': pushLine(place(pr.a), place(pr.b), withAlpha(tinted(pr.color, tint), alpha), pr.width, pr.dash, pr.front ? 0.25 : 0.02); break;
          case 'arrow': {
            const a = place(pr.a), b = place(pr.b);
            const col = withAlpha(tinted(pr.color, tint), alpha);
            const pa = P(a), pb = P(b);
            if (pa[2] < 0.1 || pb[2] < 0.1) break;
            const shaftEnd: Pt = (() => { const dx = pb[0] - pa[0], dy = pb[1] - pa[1], l = Math.hypot(dx, dy) || 1; const cut = Math.min(0.18, l * 0.4); return [pb[0] - (dx / l) * cut, pb[1] - (dy / l) * cut]; })();
            items.push({ depth: (pa[2] + pb[2]) / 2 - 0.1, glyphs: () => [
              { contours: [{ closed: false, pts: [[pa[0], pa[1]], shaftEnd] }], fill: false, stroke: true, width: pr.width, key: 'arrow', parts: [], color: col },
              { contours: [arrowHead([pa[0], pa[1]], [pb[0], pb[1]], 0.22)], fill: true, stroke: false, key: 'tip', parts: [], color: col },
            ] });
            break;
          }
          case 'dot': {
            const q = P(place(pr.at));
            if (q[2] < 0.1) break;
            const col = withAlpha(tinted(pr.color, tint), alpha);
            items.push({ depth: q[2] - 0.2, glyphs: () => [{ contours: [{ closed: true, pts: Array.from({ length: 20 }, (_, k) => [q[0] + pr.r * Math.cos((k / 20) * 2 * Math.PI), q[1] + pr.r * Math.sin((k / 20) * 2 * Math.PI)] as Pt) }], fill: true, stroke: false, key: 'dot', parts: [], color: col }] });
            break;
          }
          case 'label': {
            const q = P(place(pr.at));
            if (q[2] < 0.1) break;
            const col = withAlpha(pr.color, alpha);
            items.push({ depth: q[2] - 0.5, glyphs: () => numberGlyphs(pr.tex, [q[0], q[1]], pr.side ?? 'center', pr.size, col, '') });
            break;
          }
        }
      }
    }
    items.sort((a, b) => b.depth - a.depth);
    const out: Glyph[] = [];
    for (const it of items) out.push(...it.glyphs());
    void ink;
    return out;
  }
}

/** A colour with a colour change on top ("mix:0.4:#ff0000" is partway there). */
function tinted(color: string, tint?: string): string {
  if (!tint) return color;
  const m = tint.match(/^mix:([\d.]+):(.+)$/);
  return m ? mixColor(color, m[2], Number(m[1])) : tint;
}

/** Colours from low to high, for surfaces coloured by height. */
export function heightColor(stops: string[], u: number): string {
  const x = clamp(u) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mixColor(stops[i], stops[i + 1], x - i);
}

export type { Eye };
