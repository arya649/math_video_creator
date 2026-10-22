// SceneWorld: what exists in one scene, and placing things by words.

import { type Box, type Pt, centerOf } from './geom';
import { RELATIONS, centerX, keysOf } from './tex';
import { type Glyph, Thing, glyphBox } from './thing';
import type { Theme } from './themes';
import { colorOf } from './themes';
import { findRun } from './match';
import { ScriptError, didYouMean, isObject } from './util';

export const WORLDS = ['board', 'graph', 'geometry', 'counting', 'space'] as const;
export type WorldKind = (typeof WORLDS)[number];

export const SCREEN_PLACES = [
  'center', 'top', 'bottom', 'left', 'right', 'top_left', 'top_right', 'bottom_left', 'bottom_right',
] as const;

export const GAPS: Record<string, number> = { none: 0, small: 0.15, medium: 0.35, large: 0.8 };

/** One thing an action does to the frame being drawn. */
export interface Action {
  start: number;
  duration: number;
  /** u: 0 to 1 through the action; t: the time. */
  apply(u: number, t: number): void;
  /** Sort order among actions starting at the same time. */
  order: number;
  where: string;
}

export interface Shot {
  start: number;
  blend: number;
  cx: number;
  cy: number;
  zoom: number;
  ease: 'smooth' | 'linear';
}

export class SceneWorld {
  things = new Map<string, Thing>();
  order: Thing[] = [];
  actions: Action[] = [];
  shots: Shot[] = [];
  /** The thing most recently written or drawn on the sheet: the next one goes under it. */
  last?: Thing;
  private anon = 0;
  /** Colours tied to symbols: runs of glyph keys, longest first. */
  symbolRuns: { keys: string[]; color: string }[] = [];
  captions = true;

  constructor(
    public kind: WorldKind,
    public theme: Theme,
    public start: number,
    public end: number,
    /** Frame size in sheet units at rest. */
    public frameW: number,
    public frameH: number,
  ) {}

  newId(prefix: string) {
    return `_${prefix}${++this.anon}`;
  }

  /** The next free name after an id: eq1_2, eq1_3 ... */
  newIdFor(id: string) {
    const base = id.replace(/_\d+$/, '');
    for (let n = 2; ; n++) if (!this.things.has(`${base}_${n}`)) return `${base}_${n}`;
  }

  add(thing: Thing, where: string): Thing {
    if (this.things.has(thing.id)) {
      throw new ScriptError(`there is already something called "${thing.id}" in this scene. Give it another id.`, where);
    }
    this.things.set(thing.id, thing);
    this.order.push(thing);
    return thing;
  }

  get(id: unknown, where: string): Thing {
    if (typeof id !== 'string') throw new ScriptError(`must name something in the scene by its id, not ${JSON.stringify(id)}.`, where);
    const [head] = id.split('.');
    const t = this.things.get(id) ?? this.things.get(head);
    if (!t) {
      const names = [...this.things.keys()].filter((k) => !k.startsWith('_'));
      throw new ScriptError(
        `there is nothing called "${head}" in this scene yet.${didYouMean(head, names)}${names.length ? ` Things so far: ${names.join(', ')}.` : ''}`,
        where,
      );
    }
    return t;
  }

  setSymbols(spec: unknown, where: string) {
    if (spec === undefined) return;
    if (!isObject(spec)) throw new ScriptError('must be { symbol: colour }.', where);
    this.symbolRuns = Object.entries(spec)
      .map(([sym, col]) => ({ keys: keysOf(sym), color: colorOf(col, this.theme, `${where}.${sym}`) }))
      .sort((a, b) => b.keys.length - a.keys.length);
  }

  /** Colour the symbols of an expression that have a meaning colour. */
  colorSymbols(glyphs: Glyph[]): Glyph[] {
    if (!this.symbolRuns.length) return glyphs;
    const keys = glyphs.map((g) => g.key);
    const out = glyphs.map((g) => ({ ...g }));
    const done = new Set<number>();
    for (const run of this.symbolRuns) {
      for (const at of findRun(keys, run.keys)) {
        for (let k = 0; k < run.keys.length; k++) {
          if (done.has(at + k) || out[at + k].color) continue;
          out[at + k].color = run.color;
          done.add(at + k);
        }
      }
    }
    return out;
  }

  /** A screen place, in sheet units, with the camera at rest. */
  screenPlace(name: string): Pt {
    const w = this.frameW / 2, h = this.frameH / 2;
    const x = name.includes('left') ? -w * 0.62 : name.includes('right') ? w * 0.62 : 0;
    const y = name.startsWith('top') ? h * 0.66 : name.startsWith('bottom') ? -h * 0.6 : 0;
    return [x, y];
  }

  /**
   * Where a thing's origin goes so that it sits at `spec`. `own` is its box
   * around its origin; `equalsX` where its "=" is, for lining up.
   */
  placeAt(spec: unknown, own: Box, where: string, equalsX?: number): Pt {
    const mid = centerOf(own);
    if (spec === undefined) {
      if (this.last && !this.last.screen) {
        return this.relation({ below: this.last.id, align: this.last.equalsX !== undefined && equalsX !== undefined ? '=' : 'center' }, own, where, equalsX);
      }
      return [-mid[0], -mid[1]];
    }
    if (isObject(spec) && ['above', 'below', 'left_of', 'right_of', 'over', 'under'].some((k) => k in spec)) {
      return this.relation(spec, own, where, equalsX);
    }
    const p = this.point(spec, where);
    return [p[0] - mid[0], p[1] - mid[1]];
  }

  private relation(spec: Record<string, unknown>, own: Box, where: string, equalsX?: number): Pt {
    const kind = ['above', 'below', 'left_of', 'right_of', 'over', 'under'].find((k) => k in spec)!;
    const target = this.get(spec[kind], `${where}.${kind}`);
    const box = this.boxOf(String(spec[kind]), where);
    const gap = this.gap(spec.gap, `${where}.gap`);
    const mid = centerOf(own);
    const c = centerOf(box);
    const align = spec.align ?? 'center';
    const alignX = (): number => {
      if (align === 'left') return box.x0 - own.x0;
      if (align === 'right') return box.x1 - own.x1;
      if (align === '=') {
        if (target.equalsX !== undefined && equalsX !== undefined) return target.build.x + target.equalsX * target.build.scale - equalsX;
        return c[0] - mid[0];
      }
      if (align !== 'center') throw new ScriptError(`align must be "left", "center", "right" or "=", not "${String(align)}".`, `${where}.align`);
      return c[0] - mid[0];
    };
    switch (kind) {
      case 'below': return [alignX(), box.y0 - gap - own.y1];
      case 'above': return [alignX(), box.y1 + gap - own.y0];
      case 'left_of': return [box.x0 - gap - own.x1, c[1] - mid[1]];
      case 'right_of': return [box.x1 + gap - own.x0, c[1] - mid[1]];
      case 'under': return [c[0] - mid[0], box.y0 - gap * 0.4 - own.y1];
      default: return [c[0] - mid[0], c[1] - mid[1]];
    }
  }

  gap(spec: unknown, where: string): number {
    if (spec === undefined) return GAPS.medium;
    if (typeof spec === 'number') return spec;
    if (typeof spec === 'string' && spec in GAPS) return GAPS[spec];
    throw new ScriptError(`must be "none", "small", "medium", "large" or a number, not ${JSON.stringify(spec)}.`, where);
  }

  /** Any position in a script, as a point on the sheet. */
  point(spec: unknown, where: string): Pt {
    if (Array.isArray(spec)) {
      if (spec.length >= 2 && spec.every((v) => typeof v === 'number')) return [spec[0] as number, spec[1] as number];
      throw new ScriptError('a position given as numbers must be [x, y].', where);
    }
    if (typeof spec === 'string') {
      if ((SCREEN_PLACES as readonly string[]).includes(spec)) return this.screenPlace(spec);
      return centerOf(this.boxOf(spec, where));
    }
    if (isObject(spec)) {
      if (['above', 'below', 'left_of', 'right_of', 'over', 'under'].some((k) => k in spec)) {
        return centerOf(this.relationBox(spec, where));
      }
      throw new ScriptError('is not a position this world understands yet. Use a screen place, an id, a named spot or [x, y].', where);
    }
    throw new ScriptError(`must be a position, not ${JSON.stringify(spec)}.`, where);
  }

  private relationBox(spec: Record<string, unknown>, where: string): Box {
    const p = this.relation(spec, { x0: 0, y0: 0, x1: 0, y1: 0 }, where);
    return { x0: p[0], x1: p[0], y0: p[1], y1: p[1] };
  }

  /** The box of a thing or a named spot ("eq1.mid", "eq1.left"), in sheet units, as built so far. */
  boxOf(ref: string, where: string): Box {
    const t = this.get(ref, where);
    const dot = ref.indexOf('.');
    const full = t.buildBox();
    if (dot < 0 || this.things.has(ref)) return full;
    const spot = ref.slice(dot + 1);
    const c = centerOf(full);
    const pt = (x: number, y: number): Box => ({ x0: x, x1: x, y0: y, y1: y });
    switch (spot) {
      case 'left': return pt(full.x0, c[1]);
      case 'right': return pt(full.x1, c[1]);
      case 'top': return pt(c[0], full.y1);
      case 'bottom': return pt(c[0], full.y0);
      case 'center': case 'middle': return pt(c[0], c[1]);
      case 'top_left': return pt(full.x0, full.y1);
      case 'top_right': return pt(full.x1, full.y1);
      case 'bottom_left': return pt(full.x0, full.y0);
      case 'bottom_right': return pt(full.x1, full.y0);
    }
    if (t.spots[spot]) {
      const [x, y] = t.spots[spot];
      const s = t.build.scale;
      return pt(t.build.x + x * s, t.build.y + y * s);
    }
    const member = t.members.find((m, i) => m.id === spot || m.id.endsWith(`.${spot}`) || String(i + 1) === spot);
    if (member) return member.buildBox();
    const idx = selectPart(t, spot, undefined, where, false);
    if (idx.length) return this.glyphsBox(t, idx);
    throw new ScriptError(`"${t.id}" has no spot or part called "${spot}".`, where);
  }

  /** Sheet box of some of a thing's glyphs, as built so far. */
  glyphsBox(t: Thing, idx: number[]): Box {
    const s = t.build.scale;
    let b: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const i of idx) {
      const g = glyphBox(t.build.glyphs[i]);
      b = { x0: Math.min(b.x0, g.x0), y0: Math.min(b.y0, g.y0), x1: Math.max(b.x1, g.x1), y1: Math.max(b.y1, g.y1) };
    }
    return { x0: t.build.x + b.x0 * s, x1: t.build.x + b.x1 * s, y0: t.build.y + b.y0 * s, y1: t.build.y + b.y1 * s };
  }
}

/**
 * Which glyphs of an equation a script means: a named part ("mid"), the
 * sides ("lhs", "rhs", "eq"), or a piece of maths ("2ab").
 */
export function selectPart(t: Thing, part: string, which: number | undefined, where: string, required = true): number[] {
  const gs = t.build.glyphs;
  const named = gs.map((g, i) => (g.parts.includes(part) ? i : -1)).filter((i) => i >= 0);
  if (named.length) return named;
  if (t.equalsX !== undefined && (part === 'lhs' || part === 'rhs' || part === 'eq')) {
    const eq = gs.findIndex((g) => RELATIONS.has(g.key));
    if (part === 'eq') return [eq];
    return gs.map((g, i) => ((part === 'lhs' ? centerX(g) < t.equalsX! : centerX(g) > t.equalsX!) && i !== eq ? i : -1)).filter((i) => i >= 0);
  }
  if (t.kind === 'math') {
    let keys: string[];
    try { keys = keysOf(part); } catch { keys = []; }
    const hits = keys.length ? findRun(gs.map((g) => g.key), keys) : [];
    if (hits.length) {
      const n = which ?? 1;
      if (n < 1 || n > hits.length) {
        throw new ScriptError(`"${part}" appears ${hits.length} time${hits.length > 1 ? 's' : ''} in "${t.id}"; "which" must be from 1 to ${hits.length}.`, where);
      }
      return keys.map((_, k) => hits[n - 1] + k);
    }
  }
  if (!required) return [];
  const names = [...new Set(gs.flatMap((g) => g.parts))];
  throw new ScriptError(
    `"${part}" is not a named part of "${t.id}", and that piece of maths is not in it.${names.length ? ` Its named parts: ${names.join(', ')}.` : ''}`,
    where,
  );
}
