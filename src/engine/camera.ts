// The camera on a flat world: where it looks and how close.

import { type Box, centerOf, unionBox } from './geom';
import { ScriptError, choice, clamp, ease, isObject } from './util';
import type { SceneWorld } from './world';
import type { Thing } from './thing';

export interface View { cx: number; cy: number; zoom: number }
export const REST: View = { cx: 0, cy: 0, zoom: 1 };

export const SHOTS = ['rest', 'frame', 'zoom', 'pan', 'follow'] as const;
export const SHOTS_LATER = ['tilt', 'fly', 'orbit', 'look'] as const;
export const SHOT_KEYS = ['shot', 'target', 'padding', 'blend', 'at', 'ease', 'to', 'style', 'elevation', 'angle', 'distance', 'turns', 'duration'] as const;

const PADDING: Record<string, number> = { none: 0, small: 0.3, medium: 0.8, large: 1.6 };

export interface CameraShot {
  start: number;
  blend: number;
  ease: 'smooth' | 'linear';
  view(t: number): View;
}

export class CameraPlan {
  shots: CameraShot[] = [];
  private cache = new Map<number, View>();

  constructor(private frameW: number, private frameH: number) {}

  add(shot: CameraShot) {
    this.shots.push(shot);
    this.shots.sort((a, b) => a.start - b.start);
    this.cache.clear();
  }

  /** A view that shows a box with some room round it. */
  frameBox(b: Box, pad: number): View {
    const c = centerOf(b);
    const w = Math.max(0.5, b.x1 - b.x0 + pad * 2), h = Math.max(0.5, b.y1 - b.y0 + pad * 2);
    return { cx: c[0], cy: c[1], zoom: Math.min(this.frameW / w, this.frameH / h) };
  }

  viewAt(t: number, upto = this.shots.length): View {
    let v = REST;
    for (let i = 0; i < upto; i++) {
      const s = this.shots[i];
      if (s.start > t) break;
      const before = i === 0 ? REST : this.startView(i);
      const target = s.view(t);
      const u = s.blend <= 0 ? 1 : ease(s.ease, clamp((t - s.start) / s.blend));
      // Zoom blends in log space so zooming in and out feel even.
      const z = Math.exp(Math.log(before.zoom) + (Math.log(target.zoom) - Math.log(before.zoom)) * u);
      v = { cx: before.cx + (target.cx - before.cx) * u, cy: before.cy + (target.cy - before.cy) * u, zoom: z };
    }
    return v;
  }

  private startView(i: number): View {
    const key = i;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const v = this.viewAt(this.shots[i].start - 1e-6, i);
    this.cache.set(key, v);
    return v;
  }
}

/** Read a beat's `camera` into shots. */
export function readCamera(spec: unknown, world: SceneWorld, plan: CameraPlan, start: number, duration: number, where: string) {
  const list = Array.isArray(spec) ? spec : [spec];
  list.forEach((raw, i) => {
    const w = Array.isArray(spec) ? `${where}[${i}]` : where;
    const s = typeof raw === 'string' ? { shot: raw } : raw;
    if (!isObject(s)) throw new ScriptError('must be a shot name or a shot.', w);
    const name = s.shot ?? (s.target !== undefined ? 'frame' : 'rest');
    if (name === 'orbit' || name === 'look') throw new ScriptError(`the "${name}" shot works in space scenes; flat scenes use ${SHOTS.join(', ')}.`, `${w}.shot`);
    if ((SHOTS_LATER as readonly string[]).includes(String(name))) {
      throw new ScriptError(`the "${String(name)}" shot is not built yet. Shots that work now: ${SHOTS.join(', ')}.`, `${w}.shot`);
    }
    const kind = choice(name, SHOTS, `${w}.shot`);
    let at = start;
    if (typeof s.at === 'number') at = start + s.at;
    else if (typeof s.at === 'string' && /%$/.test(s.at)) at = start + (duration * parseFloat(s.at)) / 100;
    const blend = s.blend === 'cut' ? 0 : typeof s.blend === 'number' ? s.blend : 1.2;
    const e = s.ease === 'linear' ? 'linear' : 'smooth';
    const pad = s.padding === undefined ? PADDING.medium : typeof s.padding === 'number' ? s.padding : PADDING[String(s.padding)] ?? PADDING.medium;
    const targetBox = (): Box => {
      const ts = Array.isArray(s.target) && !s.target.every((v) => typeof v === 'number') ? s.target : [s.target];
      return ts.map((r, k) => boxOfRef(world, r, `${w}.target${ts.length > 1 ? `[${k}]` : ''}`)).reduce(unionBox);
    };
    let view: (t: number) => View;
    switch (kind) {
      case 'rest': view = () => REST; break;
      case 'frame': {
        if (s.target === undefined) throw new ScriptError('needs a "target" to frame.', w);
        const v = plan.frameBox(targetBox(), pad);
        view = () => v;
        break;
      }
      case 'zoom': {
        const z = typeof s.to === 'number' ? s.to : 2;
        const c = s.target !== undefined ? centerOf(targetBox()) : [0, 0];
        view = () => ({ cx: c[0], cy: c[1], zoom: z });
        break;
      }
      case 'pan': {
        if (s.target === undefined) throw new ScriptError('needs a "target" to pan to.', w);
        const c = centerOf(targetBox());
        const now = plan.viewAt(at);
        view = () => ({ cx: c[0], cy: c[1], zoom: now.zoom });
        break;
      }
      case 'follow': {
        const t: Thing = world.get(s.target, `${w}.target`);
        const z = typeof s.to === 'number' ? s.to : 1;
        view = () => ({ cx: t.state.x, cy: t.state.y, zoom: z });
        break;
      }
    }
    plan.add({ start: at, blend, ease: e, view });
  });
}

function boxOfRef(world: SceneWorld, ref: unknown, where: string): Box {
  if (Array.isArray(ref) || (typeof ref === 'string' && !world.things.has(ref.split('.')[0]))) {
    const p = world.point(ref, where);
    return { x0: p[0], x1: p[0], y0: p[1], y1: p[1] };
  }
  return world.boxOf(String(ref), where);
}
