// The action registry, and the helpers every action uses.
//
// Each `do` word is registered with `registerAction`. Its `build` runs once
// when the script is compiled: it makes things, works out everything that
// can be worked out in advance, and adds Actions whose `apply(u, t)` only
// sets values for the frame being drawn.

import { mixColor } from './color';
import type { Pt } from './geom';
import { emFor, texToGlyphs, mathToTex } from './tex';
import { type Glyph, type GlyphState, Thing, localBox, shiftGlyphs } from './thing';
import { colorOf } from './themes';
import { ScriptError, clamp, didYouMean, ease, isObject } from './util';
import type { Action, SceneWorld, WorldKind } from './world';
import { layoutText } from './text';

export type Spec = Record<string, unknown>;

export interface Ctx {
  spec: Spec;
  where: string;
  world: SceneWorld;
  start: number;
  /** The length the beat asked for, if it did. */
  duration?: number;
  /** Natural lengths are divided by this. */
  speed: number;
  /** End of the narration line the beat starts in, if it starts on one. */
  lineEnd?: number;
  /** Timing of a nested item (a line of `work`), from its own keys. */
  timeOf(spec: Spec, where: string, after: number): { start: number; duration?: number };
  act(a: Omit<Action, 'order' | 'where'>): void;
  /** Ask for one of the engine's own sounds (it is left out if the script turns sounds off). */
  sound(kind: SoundKind, at: number, duration?: number): void;
  /** Build another beat description (the target of a morph). */
  buildNested(spec: Spec, where: string, start: number): Done;
  /** Note a problem that does not stop the video (a step that does not follow). */
  warn(message: string): void;
}

export interface Done { end: number; thing?: Thing }

/** The engine's own small sounds. */
export const SOUND_KINDS = ['pop', 'click', 'chime', 'whoosh', 'low', 'tick', 'chalk', 'pen', 'swell'] as const;
export type SoundKind = (typeof SOUND_KINDS)[number];

export interface ActionDef {
  summary: string;
  /** Worlds it works in. Left out: every world. */
  worlds?: readonly WorldKind[];
  params: readonly string[];
  required?: readonly string[];
  build(ctx: Ctx): Done;
}

export const ACTIONS = new Map<string, ActionDef>();
export const ALIASES = new Map<string, string>();

export function registerAction(name: string, def: ActionDef, aliases: string[] = []) {
  ACTIONS.set(name, def);
  for (const a of aliases) ALIASES.set(a, name);
}

export function findAction(name: unknown, where: string): [string, ActionDef] {
  if (typeof name !== 'string') throw new ScriptError('must be the name of an action.', where);
  const real = ACTIONS.has(name) ? name : ALIASES.get(name);
  if (!real) {
    throw new ScriptError(`there is no action "${name}".${didYouMean(name, [...ACTIONS.keys(), ...ALIASES.keys()])}`, where);
  }
  return [real, ACTIONS.get(real)!];
}

/** Keys every beat may have, whatever it does. */
export const BEAT_KEYS = [
  'do', 'camera', 'id', 'at', 'at_line', 'at_cue', 'at_word', 'then', 'after', 'with', 'offset', 'duration',
  'until_line', 'until_cue', 'speed', 'sound', 'key', 'stay', 'note', 'hidden', 'style',
] as const;

// ---- Small readers ----

export const SIZES: Record<string, number> = { small: 0.35, medium: 0.5, large: 0.75, huge: 1.2 };
export const TEXT_SIZES: Record<string, number> = { small: 0.3, medium: 0.4, large: 0.58, huge: 0.9 };

export function sizeOf(v: unknown, table: Record<string, number>, where: string, fallback: string): number {
  if (v === undefined) return table[fallback];
  if (typeof v === 'number' && v > 0) return v;
  if (typeof v === 'string' && v in table) return table[v];
  throw new ScriptError(`must be ${Object.keys(table).map((k) => `"${k}"`).join(', ')} or a number, not ${JSON.stringify(v)}.${typeof v === 'string' ? didYouMean(v, Object.keys(table)) : ''}`, where);
}

export const natural = (ctx: Ctx, seconds: number) => ctx.duration ?? seconds / ctx.speed;

export function color(ctx: Ctx, key: string, fallback?: string): string | undefined {
  const v = ctx.spec[key];
  if (v === undefined) return fallback;
  return colorOf(v, ctx.world.theme, `${ctx.where}.${key}`);
}

export function str(ctx: Ctx, key: string, required = false): string | undefined {
  const v = ctx.spec[key];
  if (v === undefined) {
    if (required) throw new ScriptError(`needs "${key}".`, ctx.where);
    return undefined;
  }
  if (typeof v !== 'string') throw new ScriptError(`must be text, not ${JSON.stringify(v)}.`, `${ctx.where}.${key}`);
  return v;
}

export function num(ctx: Ctx, key: string, fallback: number): number {
  const v = ctx.spec[key];
  if (v === undefined) return fallback;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ScriptError(`must be a number, not ${JSON.stringify(v)}.`, `${ctx.where}.${key}`);
  return v;
}

/** Where a beat puts what it makes. (`at` is always a time.) */
export function positionSpec(spec: Spec): unknown {
  return spec.position;
}

/** Things named by `who`: one id, a list, or a group (its members). */
export function things(ctx: Ctx, key = 'who'): Thing[] {
  const v = ctx.spec[key];
  if (v === undefined) throw new ScriptError(`needs "${key}": what to act on.`, ctx.where);
  const list = Array.isArray(v) ? v : [v];
  const out: Thing[] = [];
  for (const [i, id] of list.entries()) {
    const t = ctx.world.get(id, Array.isArray(v) ? `${ctx.where}.${key}[${i}]` : `${ctx.where}.${key}`);
    if (t.kind === 'group') out.push(...t.members);
    else out.push(t);
  }
  return out;
}

// ---- Making maths ----

/** Read `tex` or `math` from a spec. */
export function texOf(v: unknown, asMath: boolean, where: string): string {
  if (typeof v !== 'string') throw new ScriptError(`must be maths written as text, not ${JSON.stringify(v)}.`, where);
  return asMath ? mathToTex(v) : v;
}

/** Glyphs of an expression in a math thing's own coordinates: centred across, baseline just under the middle. */
export function mathGlyphs(world: SceneWorld, tex: string, size: number, where: string): { glyphs: Glyph[]; equalsX?: number; width: number } {
  let r;
  try {
    r = texToGlyphs(tex, size);
  } catch (err) {
    if (err instanceof ScriptError) throw new ScriptError(err.message, where);
    throw err;
  }
  const b = localBox(r.glyphs);
  const cx = (b.x0 + b.x1) / 2;
  const dy = -emFor(size) * 0.25;
  const glyphs = world.colorSymbols(shiftGlyphs(r.glyphs, -cx, dy));
  return { glyphs, equalsX: r.equalsX === undefined ? undefined : r.equalsX - cx, width: b.x1 - b.x0 };
}

export function makeMath(ctx: Ctx, id: string, tex: string, size: number, at: unknown, where: string): Thing {
  const m = mathGlyphs(ctx.world, tex, size, where);
  const own = localBox(m.glyphs);
  const pos = ctx.world.placeAt(at, own, `${where}.position`, m.equalsX);
  const t = new Thing(id, 'math', m.glyphs, pos);
  t.equalsX = m.equalsX;
  t.tex = tex;
  t.size = size;
  const c = color(ctx, 'color');
  if (c) t.base.color = c;
  return t;
}

// ---- Arriving ----

export const APPEARS = ['draw', 'write', 'fade', 'grow', 'pop', 'rise', 'type', 'none'] as const;
export type Appear = (typeof APPEARS)[number];

export function readAppear(ctx: Ctx, fallback: Appear): { how: Appear; from?: Pt } {
  const v = ctx.spec.appear;
  if (v === undefined) return { how: fallback };
  if (isObject(v) && 'grow_from' in v) return { how: 'grow', from: ctx.world.point(v.grow_from, `${ctx.where}.appear.grow_from`) };
  if (typeof v === 'string' && (APPEARS as readonly string[]).includes(v)) return { how: v as Appear };
  throw new ScriptError(`must be one of ${APPEARS.join(', ')}, or { "grow_from": a position }.${typeof v === 'string' ? didYouMean(v, APPEARS) : ''}`, `${ctx.where}.appear`);
}

/** Make a thing arrive. It is hidden until `start`. */
export function arrive(ctx: Ctx, t: Thing, how: Appear, start: number, duration: number, from?: Pt) {
  const home: Pt = [t.base.x, t.base.y];
  if (how === 'write' || how === 'draw') ctx.sound(ctx.world.theme.name === 'board' ? 'chalk' : 'pen', start, duration);
  else if (how === 'pop' || how === 'grow') ctx.sound('pop', start);
  ctx.act({
    start, duration,
    apply(u) {
      const s = t.state;
      s.visible = true;
      const e = ease('smooth', u);
      switch (how) {
        case 'write': s.drawn = u; s.drawStyle = 'write'; break;
        case 'draw': s.drawn = u; s.drawStyle = 'draw'; break;
        case 'type': s.drawn = u; s.drawStyle = 'reveal'; break;
        case 'fade': s.opacity *= e; break;
        case 'grow':
          s.scale *= e;
          if (from) { s.x = from[0] + (home[0] - from[0]) * e; s.y = from[1] + (home[1] - from[1]) * e; }
          break;
        case 'pop': s.scale *= u >= 1 ? 1 : ease('spring', u); s.opacity *= clamp(u * 4); break;
        case 'rise': s.y -= 0.35 * (1 - e); s.opacity *= e; break;
        default: break;
      }
    },
  });
}

/** Natural time to write some glyphs. */
export const writeTime = (n: number) => clamp(0.6 + 0.07 * n, 0.8, 2.6);

export function glyphStates(t: Thing): GlyphState[] {
  if (!t.state.glyphStates || t.state.glyphStates.length !== t.state.glyphs.length) {
    t.state.glyphStates = t.state.glyphs.map(() => ({ dx: 0, dy: 0, opacity: 1, scale: 1 }));
  }
  return t.state.glyphStates;
}

/** Make a short text thing on the sheet (notes beside working, labels). */
export function sheetText(ctx: Ctx, id: string, text: string, size: number, at: Pt, opts: { color?: string; align?: 'left' | 'center' | 'right'; italic?: boolean } = {}): Thing {
  const layout = layoutText(text, { size, font: ctx.world.theme.fonts.text, align: opts.align ?? 'center', italic: opts.italic, weight: 500 });
  const t = new Thing(id, 'text', [], at);
  t.text = layout;
  t.base.color = opts.color;
  t.build.glyphs = [];
  return t;
}

export function colorAt(a: string, b: string, u: number) {
  return mixColor(a, b, u);
}

