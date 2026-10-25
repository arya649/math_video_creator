// SceneWorld: what exists in one scene, and placing things by words.

import { type Box, type Pt, centerOf } from './geom';
import { RELATIONS, centerX, keysOf } from './tex';
import { type Glyph, Thing, glyphBox } from './thing';
import type { Theme } from './themes';
import { colorOf } from './themes';
import { findRun } from './match';
import { ScriptError, didYouMean, isObject } from './util';
import type { Axes, Graph } from './graph/axes';
import type { Scope } from './graph/expr';
import type { Space } from './space/space';

export interface Value { start: number; now: number; decimals: number }

/** One sound at a moment: the engine's own (kind) or a file. */
export interface SoundEvent {
  at: number;
  kind?: string;
  file?: string;
  duration?: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  /** For a tone that follows a graph: its pitch (Hz) evenly over the duration. */
  tone?: number[];
}

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
  /** Colours given to names in `symbols`, for graphs and values. */
  symbolColors: Record<string, string> = {};
  /** Named numbers that can change over time. */
  values = new Map<string, Value>();
  /** Things worked out afresh every frame, after the actions (graphs, points). */
  livers: ((t: number) => void)[] = [];
  axes = new Map<string, Axes>();
  /** Sounds asked for in this scene: the engine's own, and sound files. */
  sounds: SoundEvent[] = [];
  /** Geometry objects by id (geometry world). */
  geo = new Map<string, import('./geometry/geo').GObj>();
  /** Finds a geometry point by a name such as "A" or "tri.B" (set by the geometry world). */
  geoPoint?: (ref: string) => Pt | undefined;
  /** How the geometry world shows angles and lengths. */
  geoSettings = { units: 'degrees' as 'degrees' | 'radians', decimals: 1, angleDecimals: 0 };
  /** Every scene of the video so far (the recap looks back through them). */
  allWorlds: SceneWorld[] = [];
  /** Whether steps are checked as maths. */
  checkMaths = true;
  /** The finished picture's look: colour grade, glow, fading with distance, and the camera's manner. */
  finish: { grade: 'none' | 'warm' | 'cold' | 'faded' | 'mono' | 'vivid'; glow: number; depth: number; cameraStyle: 'steady' | 'drift' | 'breathe' } = { grade: 'none', glow: 0, depth: 0, cameraStyle: 'steady' };
  /** The drawing style of the scene. */
  look: import('./styles').Look = 'vector';
  /** The video's characters (the mascot), from the top of the script. */
  characters: import('./actions/mascot').CharacterDef[] = [];
  /** Every spoken word with its time, for mouths that move with the voice. */
  words: { text: string; start: number; end: number }[] = [];
  /** Text files opened with the script (subtitles, SVG outlines), by name. */
  texts: Record<string, string> = {};
  /** The language being made. */
  lang = 'en';
  /** The chapter this scene is in (the last one named). */
  chapter?: string;
  /** Sizes of the pictures opened with the script. */
  imageSizes: Record<string, [number, number]> = {};
  /** Cards on screen, for stacking: where, from when to when, how tall. */
  cardSlots: { key: string; start: number; end: number; top: number; bottom: number }[] = [];
  /** The wait the video is holding in, if any, and how far through it (countdowns read this). */
  hold?: { at: number; u: number };
  /** Waits asked for in this scene. */
  waits: { at: number; length: number }[] = [];
  /** The question asked and not yet answered. */
  openQuestion?: { panel: Thing; choices: Thing[]; start: number; extra: Thing[] };
  /** A space scene's 3D objects and camera. */
  space?: Space;
  /** Number lines in a counting scene, by id. */
  numberLines = new Map<string, { toSheet(v: number, t?: number): Pt }>();
  /** Steps that solve found by itself, to show the creator. */
  found: string[] = [];
  /** Put the whole scene at another moment (for trails), and whether that is happening now. */
  applyAt?: (t: number, hold?: { at: number; u: number }) => void;
  sampling = false;
  /** Every beat built, for the teaching checks. */
  beats: { name: string; at: number; where: string; spec: Record<string, unknown> }[] = [];
  /** The step counter showing now, so the next one takes its place. */
  stepCounter?: Thing;
  /** The time of the frame being drawn; Infinity while compiling (everything as last built). */
  now = Infinity;
  graphs = new Map<string, Graph>();

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
    this.symbolColors = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, colorOf(v, this.theme, `${where}.${k}`)]));
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

  /** The named values as they are now (at the frame, or at build time). */
  scope(): Scope {
    const out: Scope = {};
    for (const [k, v] of this.values) out[k] = v.now;
    return out;
  }

  /** Before each frame: values and axes back to how they start. */
  resetFrame() {
    for (const v of this.values.values()) v.now = v.start;
    for (const a of this.axes.values()) a.reset();
  }

  /** The world's own axes (graph and space worlds). */
  mainAxes(where: string): Axes {
    const a = this.axes.get('axes') ?? [...this.axes.values()][0];
    if (!a) throw new ScriptError('there are no axes in this scene. A graph scene has them unless "axes" is false; or make some with the axes action.', where);
    return a;
  }

  /**
   * A position given by maths: { "x": 2, "y": 3 } on axes, or
   * { "on": "f", "x": 2 } on a graph. Returns a function, so things placed
   * there follow when the axes, the graph or its values change.
   */
  mathPoint(spec: Record<string, unknown>, where: string): (() => Pt) | null {
    const num = (v: unknown, key: string): (() => number) => {
      if (typeof v === 'number') return () => v;
      if (typeof v === 'string' && this.values.has(v)) return () => this.values.get(v)!.now;
      throw new ScriptError(`must be a number${this.values.size ? ' or the name of a value' : ''}, not ${JSON.stringify(v)}.`, `${where}.${key}`);
    };
    const line = typeof spec.on === 'string' ? this.numberLines.get(spec.on) : this.kind === 'counting' && spec.y === undefined ? this.numberLines.get('line') : undefined;
    if (line && spec.x !== undefined) {
      const x = num(spec.x, 'x');
      return () => line.toSheet(x());
    }
    if (typeof spec.on === 'string' && this.graphs.has(spec.on)) {
      const g = this.graphs.get(spec.on)!;
      if (spec.x === undefined) throw new ScriptError(`needs "x": where on "${spec.on}".`, where);
      const x = num(spec.x, 'x');
      return () => {
        const xv = x();
        return g.axes.toSheet([xv, g.f(xv, this.scope())]);
      };
    }
    if ('x' in spec || 'y' in spec) {
      const a = typeof spec.on === 'string' ? this.axes.get(spec.on) : this.mainAxes(where);
      if (!a) throw new ScriptError(`there are no axes called "${String(spec.on)}".${didYouMean(String(spec.on), [...this.axes.keys(), ...this.graphs.keys()])}`, `${where}.on`);
      const x = num(spec.x ?? 0, 'x'), y = num(spec.y ?? 0, 'y');
      return () => a.toSheet([x(), y()]);
    }
    return null;
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
      const g = this.geoPoint?.(spec);
      if (g) return g;
      return centerOf(this.boxOf(spec, where));
    }
    if (isObject(spec)) {
      if (['above', 'below', 'left_of', 'right_of', 'over', 'under'].some((k) => k in spec)) {
        return centerOf(this.relationBox(spec, where));
      }
      const m = this.mathPoint(spec, where);
      if (m) return m();
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
