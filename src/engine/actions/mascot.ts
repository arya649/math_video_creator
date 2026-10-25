// The mascot: an optional small character who watches the maths and
// reacts. It breathes, blinks, looks at what is happening (or at what it is
// told to), shows how a viewer might feel, talks in time with the narration,
// speaks in bubbles and makes gestures. Built-in characters are drawn from
// shapes; "parts" characters are the creator's own cut-out pictures.

import { type Ctx, registerAction, sheetText } from '../actions';
import type { Contour, Pt } from '../geom';
import { mixColor, withAlpha } from '../color';
import { circle, fillGlyph, roundedRect, strokeGlyph } from '../shapes';
import { type Glyph, Thing } from '../thing';
import { ScriptError, choice, clamp, ease, hashString, isObject, rng } from '../util';
import { SCREEN_PLACES, type SceneWorld } from '../world';
import { colorOf } from '../themes';

export const KINDS = ['blob', 'pebble', 'owl', 'robot', 'parts'] as const;
export const FEELS = ['happy', 'surprised', 'confused', 'thinking', 'excited', 'worried', 'proud', 'bored'] as const;
type Feel = (typeof FEELS)[number] | 'calm';
const GESTURES = ['point', 'wave', 'shrug', 'jump', 'clap'] as const;

export interface CharacterDef { name: string; kind: (typeof KINDS)[number]; parts?: string; color?: string; size: number }

/** The characters a script lists, checked. */
export function readCharacters(v: unknown, where: string): CharacterDef[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new ScriptError('must be a list of characters.', where);
  return v.map((c, i) => {
    const w = `${where}[${i}]`;
    if (!isObject(c) || typeof c.name !== 'string') throw new ScriptError('must be { "name": ..., "kind": ... }.', w);
    const kind = choice(c.kind, KINDS, `${w}.kind`, 'blob');
    if (kind === 'parts' && typeof c.parts !== 'string') throw new ScriptError('needs "parts": the start of its picture names (pip for pip_body.png, pip_eyes_open.png and so on).', `${w}.parts`);
    const size = choice(c.size, ['small', 'medium', 'large'] as const, `${w}.size`, 'medium');
    return { name: c.name, kind, parts: typeof c.parts === 'string' ? c.parts : undefined, color: typeof c.color === 'string' ? c.color : undefined, size: { small: 1.3, medium: 1.9, large: 2.7 }[size] };
  });
}

interface Mascot {
  def: CharacterDef;
  th: Thing;
  body: string;
  place: Pt;
  enter: { at: number; from: 'left' | 'right' | 'below' };
  leave?: number;
  feels: { at: number; feel: Feel; until: number }[];
  looks: { at: number; target: () => Pt | undefined }[];
  gestures: { at: number; kind: (typeof GESTURES)[number]; d: number; to?: () => Pt | undefined }[];
  talks: [number, number][];
  parts?: { eyesOpen: Thing; eyesClosed?: Thing; mouthOpen?: Thing; mouthClosed?: Thing };
}

const MASCOTS = new WeakMap<SceneWorld, Map<string, Mascot>>();

function mascotOf(ctx: Ctx): Mascot {
  const all = MASCOTS.get(ctx.world) ?? new Map<string, Mascot>();
  const who = ctx.spec.who ?? (all.size === 1 ? [...all.keys()][0] : undefined);
  if (typeof who !== 'string') throw new ScriptError(all.size ? `needs "who": which character (${[...all.keys()].join(', ')}).` : 'there is no character in this scene yet; bring one in with "enter".', ctx.where);
  const m = all.get(who);
  if (!m) throw new ScriptError(`"${who}" has not entered this scene; bring it in with "enter" first.`, `${ctx.where}.who`);
  return m;
}

/** What the mascot is looking at: what it was told to, or whatever was last drawn on the sheet. */
function lastDrawn(world: SceneWorld, self: Thing): Pt | undefined {
  for (let i = world.order.length - 1; i >= 0; i--) {
    const t = world.order[i];
    if (t === self || t.parent === self || t.screen || t.id.startsWith('_') || t.kind === 'group' || !t.shown() || t.opacity() < 0.3) continue;
    const m = t.matrix();
    const g = t.state.glyphs;
    if (!g.length && !t.text) continue;
    // With the camera at rest, near enough for the eyes.
    return [m[4], m[5]];
  }
  return undefined;
}

// ---- Drawing the built-in characters (height 1, feet at 0) ----

interface Pose { feel: Feel; blink: number; look: Pt; mouth: number; arm: [number, number]; breathe: number; t: number }

function smileOf(feel: Feel): number {
  return { happy: 0.9, excited: 1, proud: 0.7, calm: 0.35, thinking: 0, bored: -0.1, confused: -0.2, worried: -0.7, surprised: 0 }[feel];
}

function mouthShape(c: Pt, w: number, smile: number, open: number, round: boolean): Contour {
  if (round) return circle(c, w * 0.35 * (0.6 + open * 0.6));
  const pts: Pt[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) { const u = i / n, x = c[0] - w / 2 + w * u; pts.push([x, c[1] - smile * 0.08 * Math.sin(Math.PI * u) + 0.01]); }
  for (let i = n; i >= 0; i--) { const u = i / n, x = c[0] - w / 2 + w * u; pts.push([x, c[1] - smile * 0.08 * Math.sin(Math.PI * u) - (0.012 + open * 0.13) * Math.sin(Math.PI * u)]); }
  return { closed: true, pts };
}

function eyes(p: Pose, at: [Pt, Pt], rx: number, ry: number, white = '#ffffff', pupil = '#1d1d1d'): Glyph[] {
  const f = p.feel;
  const big = f === 'surprised' ? 1.25 : 1;
  const lid = f === 'bored' ? 0.45 : f === 'happy' || f === 'excited' ? 0.7 : 1;
  const out: Glyph[] = [];
  for (const e of at) {
    const h = ry * big * lid * (1 - p.blink * 0.92);
    out.push(fillGlyph([{ closed: true, pts: Array.from({ length: 24 }, (_, k) => [e[0] + rx * big * Math.cos((k / 24) * Math.PI * 2), e[1] + h * Math.sin((k / 24) * Math.PI * 2)] as Pt) }], 'eye', { color: white }));
    if (h > ry * 0.25) out.push(fillGlyph([circle([e[0] + p.look[0] * rx * 0.45, e[1] + p.look[1] * h * 0.45], Math.min(rx, h) * 0.5)], 'pupil', { color: pupil }));
  }
  // Brows for worry, puzzlement and surprise.
  if (f === 'worried' || f === 'confused' || f === 'surprised') {
    at.forEach((e, i) => {
      const tilt = f === 'worried' ? (i ? -0.05 : 0.05) : f === 'confused' ? (i ? 0.06 : -0.02) : 0;
      const y = e[1] + ry * big + 0.07;
      out.push(strokeGlyph([{ closed: false, pts: [[e[0] - rx, y - tilt], [e[0] + rx, y + tilt]] }], 3, 'brow', { color: pupil }));
    });
  }
  return out;
}

function arms(p: Pose, body: string, sides: [Pt, Pt], len: number): Glyph[] {
  return sides.map((s, i) => {
    const a = i === 0 ? Math.PI + 0.6 - p.arm[0] : -0.6 + p.arm[1];
    const end: Pt = [s[0] + len * Math.cos(a), s[1] + len * Math.sin(a)];
    return strokeGlyph([{ closed: false, pts: [s, end] }], 7, 'arm', { color: body });
  });
}

function drawBuiltIn(kind: string, body: string, p: Pose): Glyph[] {
  const dark = '#1d1d1d';
  const sm = smileOf(p.feel);
  const b = 1 + 0.02 * Math.sin(p.t * 2.1) * p.breathe;
  const out: Glyph[] = [];
  switch (kind) {
    case 'owl': {
      const belly = mixColor(body, '#ffffff', 0.45);
      out.push(fillGlyph([{ closed: true, pts: [[-0.36, 0.86 * b], [-0.26, 1.02 * b], [-0.14, 0.88 * b]] }, { closed: true, pts: [[0.36, 0.86 * b], [0.26, 1.02 * b], [0.14, 0.88 * b]] }], 'tufts', { color: body }));
      out.push(fillGlyph([{ closed: true, pts: Array.from({ length: 40 }, (_, k) => [0.4 * Math.cos((k / 40) * 2 * Math.PI), 0.46 * b + 0.45 * b * Math.sin((k / 40) * 2 * Math.PI)] as Pt) }], 'body', { color: body }));
      out.push(fillGlyph([{ closed: true, pts: Array.from({ length: 30 }, (_, k) => [0.24 * Math.cos((k / 30) * 2 * Math.PI), 0.3 * b + 0.24 * b * Math.sin((k / 30) * 2 * Math.PI)] as Pt) }], 'belly', { color: belly }));
      out.push(...arms(p, body, [[-0.36, 0.45], [0.36, 0.45]], 0.22));
      out.push(fillGlyph([circle([-0.15, 0.66 * b], 0.15), circle([0.15, 0.66 * b], 0.15)], 'rings', { color: '#f2a93b' }));
      out.push(...eyes(p, [[-0.15, 0.66 * b], [0.15, 0.66 * b]], 0.1, 0.1));
      const open = p.mouth * 0.06;
      out.push(fillGlyph([{ closed: true, pts: [[-0.05, 0.53 * b], [0.05, 0.53 * b], [0, 0.47 * b - open * 0.3]] }, { closed: true, pts: [[-0.04, 0.47 * b - open], [0.04, 0.47 * b - open], [0, 0.43 * b - open]] }], 'beak', { color: '#f2a93b' }));
      break;
    }
    case 'robot': {
      const metal = mixColor(body, '#ffffff', 0.25);
      out.push(strokeGlyph([{ closed: false, pts: [[0, 0.92 * b], [0, 1.02 * b]] }], 3, 'antenna', { color: dark }));
      out.push(fillGlyph([circle([0, 1.04 * b], 0.04)], 'light', { color: Math.sin(p.t * 3) > 0 ? '#ff5555' : '#aa3333' }));
      out.push(fillGlyph([roundedRect(-0.3, 0.55 * b, 0.3, 0.92 * b, 0.08)], 'head', { color: metal }));
      out.push(fillGlyph([roundedRect(-0.26, 0.04, 0.26, 0.52 * b, 0.06)], 'body', { color: body }));
      out.push(fillGlyph([roundedRect(-0.2, 0, -0.08, 0.06, 0.02), roundedRect(0.08, 0, 0.2, 0.06, 0.02)], 'feet', { color: dark }));
      out.push(...arms(p, body, [[-0.26, 0.4], [0.26, 0.4]], 0.24));
      const eh = 0.07 * (1 - p.blink * 0.9) * (p.feel === 'surprised' ? 1.4 : 1);
      out.push(fillGlyph([roundedRect(-0.18 + p.look[0] * 0.02, 0.76 * b - eh / 2, -0.06 + p.look[0] * 0.02, 0.76 * b + eh / 2, 0.02), roundedRect(0.06 + p.look[0] * 0.02, 0.76 * b - eh / 2, 0.18 + p.look[0] * 0.02, 0.76 * b + eh / 2, 0.02)], 'eyes', { color: '#6ff0ff' }));
      const bars: Contour[] = [];
      for (let k = 0; k < 5; k++) { const h = 0.015 + (p.mouth > 0 ? p.mouth * 0.05 * (0.5 + 0.5 * Math.sin(p.t * 25 + k)) : 0) + Math.max(0, sm) * 0.01; bars.push(roundedRect(-0.12 + k * 0.05, 0.63 * b - h, -0.09 + k * 0.05, 0.63 * b + h, 0.008)); }
      out.push(fillGlyph(bars, 'grill', { color: dark }));
      break;
    }
    case 'pebble': {
      out.push(fillGlyph([{ closed: true, pts: Array.from({ length: 40 }, (_, k) => [0.48 * Math.cos((k / 40) * 2 * Math.PI), 0.32 * b + 0.32 * b * Math.sin((k / 40) * 2 * Math.PI)] as Pt) }], 'body', { color: body }));
      out.push(...arms(p, body, [[-0.44, 0.3], [0.44, 0.3]], 0.16));
      out.push(...eyes(p, [[-0.14, 0.42 * b], [0.14, 0.42 * b]], 0.06, 0.07));
      out.push(fillGlyph([mouthShape([0, 0.25 * b], 0.18, sm, p.mouth, p.feel === 'surprised')], 'mouth', { color: dark }));
      break;
    }
    default: {
      // blob
      const pts: Pt[] = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * 2 * Math.PI;
        const r = 1 + 0.035 * Math.sin(3 * a + p.t * 1.3);
        pts.push([0.42 * r * Math.cos(a), 0.47 * b + 0.47 * b * r * Math.sin(a) * (Math.sin(a) < 0 ? 0.92 : 1)]);
      }
      out.push(...arms(p, body, [[-0.38, 0.45], [0.38, 0.45]], 0.24));
      out.push(fillGlyph([{ closed: true, pts }], 'body', { color: body }));
      out.push(fillGlyph([circle([-0.24, 0.42 * b], 0.06), circle([0.24, 0.42 * b], 0.06)], 'cheeks', { color: withAlpha('#ff7aa2', p.feel === 'happy' || p.feel === 'excited' || p.feel === 'proud' ? 0.45 : 0.18) }));
      out.push(...eyes(p, [[-0.15, 0.6 * b], [0.15, 0.6 * b]], 0.1, 0.12));
      out.push(fillGlyph([mouthShape([0, 0.38 * b], 0.26, sm, p.mouth, p.feel === 'surprised')], 'mouth', { color: dark }));
    }
  }
  return out;
}

// ---- The actions ----

function placeOf(ctx: Ctx, fallback: string): Pt {
  const p = ctx.spec.position ?? fallback;
  if (typeof p === 'string' && (SCREEN_PLACES as readonly string[]).includes(p)) {
    const q = ctx.world.screenPlace(p);
    const W = ctx.world.frameW / 2 - 1.3, H = ctx.world.frameH / 2;
    return [clamp(q[0] * 1.35, -W, W), p.startsWith('bottom') ? -H + 0.35 : p.startsWith('top') ? H - 2.3 : q[1] - 1];
  }
  return ctx.world.point(p, `${ctx.where}.position`);
}

registerAction('enter', {
  summary: 'A character arrives: it breathes, blinks and watches what happens.',
  params: ['who', 'position', 'from'],
  build(ctx) {
    const { world, spec } = ctx;
    const defs = world.characters;
    const name = typeof spec.who === 'string' ? spec.who : defs.length === 1 ? defs[0].name : undefined;
    if (!defs.length) throw new ScriptError('there are no characters; list them at the top of the script under "characters".', ctx.where);
    const def = defs.find((d) => d.name === name);
    if (!def) throw new ScriptError(`needs "who": one of ${defs.map((d) => d.name).join(', ')}.`, `${ctx.where}.who`);
    const all = MASCOTS.get(world) ?? new Map<string, Mascot>();
    MASCOTS.set(world, all);
    if (all.has(def.name)) throw new ScriptError(`"${def.name}" is already here.`, ctx.where);
    const body = def.color ? colorOf(def.color, world.theme, `characters.${def.name}.color`) : world.theme.colors[0];
    const th = new Thing(def.name, 'shape', [], [0, 0]);
    th.screen = true;
    th.layer = 9;
    world.add(th, ctx.where);
    const m: Mascot = { def, th, body, place: placeOf(ctx, 'bottom_right'), enter: { at: ctx.start, from: choice(spec.from, ['right', 'left', 'below'] as const, `${ctx.where}.from`, 'right') }, feels: [], looks: [], gestures: [], talks: [] };
    all.set(def.name, m);
    // Fully inside the frame, arms included.
    const edge = world.frameW / 2 - def.size * 0.62 - 0.2;
    m.place = [clamp(m.place[0], -edge, edge), m.place[1]];
    // Captions run along the bottom middle; stand above them there.
    if (world.captions && world.words.length && Math.abs(m.place[0]) < world.frameW * 0.3 && m.place[1] < -world.frameH / 2 + 1) m.place = [m.place[0], m.place[1] + 1.1];
    if (def.kind === 'parts') {
      // Cut-out pictures, stacked: body, then eyes and mouth (each open and closed).
      const pic = (part: string, required: boolean): Thing | undefined => {
        const file = `${def.parts}_${part}.png`;
        const size = world.imageSizes[file];
        if (!size && !required) return undefined;
        const h = def.size, w = size ? (h * size[0]) / size[1] : h * 0.8;
        const p = new Thing(`${def.name}.${part}`, 'image', [{ contours: [{ closed: true, pts: [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]] }], fill: false, stroke: false, key: 'image', parts: [] }], [0, h / 2]);
        p.image = { file, w, h, frame: 'none', tone: 'none', motion: 'none', start: ctx.start, length: 1 };
        p.parent = th; p.screen = true; p.layer = 9; p.base.visible = true;
        world.add(p, ctx.where);
        return p;
      };
      pic('body', true);
      m.parts = { eyesOpen: pic('eyes_open', true)!, eyesClosed: pic('eyes_closed', false), mouthOpen: pic('mouth_open', false), mouthClosed: pic('mouth_closed', false) };
    }
    const seed = hashString(def.name);
    const blinkR = rng(seed);
    const blinks = Array.from({ length: 200 }, (_, i) => i * 3.4 + blinkR() * 2.5);
    const scale = def.size;
    world.livers.push((t) => {
      const s = th.state;
      if (t < m.enter.at || (m.leave !== undefined && t > m.leave + 0.8)) { s.visible = false; return; }
      s.visible = true;
      // Arriving and leaving.
      const inU = ease('out', clamp((t - m.enter.at) / 0.8));
      const outU = m.leave !== undefined ? ease('smooth', clamp((t - m.leave) / 0.8)) : 0;
      const off = m.enter.from === 'below' ? [0, -3] : [m.enter.from === 'left' ? -12 : 12, 0];
      let x = m.place[0] + off[0] * (1 - inU) + off[0] * outU, y = m.place[1] + off[1] * (1 - inU) + off[1] * outU;
      // The feeling now, and any gesture.
      const feelNow = [...m.feels].reverse().find((f) => t >= f.at && t < f.until);
      const feel: Feel = feelNow?.feel ?? 'calm';
      let arm: [number, number] = [0, 0];
      let rot = 0, sc = 1;
      for (const g of m.gestures) {
        const u = (t - g.at) / g.d;
        if (u < 0 || u > 1) continue;
        const k = Math.sin(Math.PI * u);
        if (g.kind === 'jump') y += 0.6 * Math.abs(Math.sin(Math.PI * u * 2)) * scale * 0.4;
        if (g.kind === 'wave') arm = [0, 1.6 * k + 0.5 * Math.sin(u * 20) * k];
        if (g.kind === 'shrug') { arm = [1.2 * k, 1.2 * k]; }
        if (g.kind === 'clap') { const c = Math.abs(Math.sin(u * Math.PI * 4)) * k; arm = [1.4 * c, 1.4 * c]; }
        if (g.kind === 'point') { const tp = g.to?.() ; arm = tp && tp[0] < x ? [1.1 * k, 0] : [0, 1.1 * k]; }
      }
      if (feel === 'excited') y += 0.15 * Math.abs(Math.sin(t * 7)) * scale * 0.3;
      if (feel === 'confused') rot = 0.12;
      if (feel === 'proud') sc = 1.06;
      if (feel === 'surprised' && feelNow && t - feelNow.at < 0.4) y += 0.25 * Math.sin(((t - feelNow.at) / 0.4) * Math.PI);
      s.x = x; s.y = y; s.rotation = rot; s.scale = sc * scale * (0.2 + 0.8 * inU);
      // Eyes: where to look (in the head's own units), and blinking.
      const lookAt = [...m.looks].reverse().find((l) => t >= l.at)?.target() ?? lastDrawn(world, th);
      let look: Pt = [0, 0];
      if (feel === 'thinking') look = [0.6, 0.8];
      else if (lookAt) { const dx = lookAt[0] - x, dy = lookAt[1] - (y + scale * 0.6); const dd = Math.hypot(dx, dy) || 1; look = [dx / dd, dy / dd]; }
      const bt = blinks.find((b) => t >= b && t < b + 0.14);
      const blink = bt !== undefined ? Math.sin(((t - bt) / 0.14) * Math.PI) : 0;
      // Mouth: moving with the words while it talks.
      let mouth = 0;
      if (m.talks.some(([a, b]) => t >= a && t < b)) {
        const w = world.words.find((wd) => t >= wd.start && t < wd.end);
        if (w) mouth = 0.35 + 0.65 * Math.abs(Math.sin((t - w.start) * Math.PI * 6));
      }
      if (feel === 'surprised') mouth = Math.max(mouth, 0.6);
      if (m.parts) {
        const closed = blink > 0.5 && !!m.parts.eyesClosed;
        m.parts.eyesOpen.state.visible = !closed;
        if (m.parts.eyesClosed) m.parts.eyesClosed.state.visible = closed;
        if (m.parts.mouthOpen) m.parts.mouthOpen.state.visible = mouth > 0.5;
        if (m.parts.mouthClosed) m.parts.mouthClosed.state.visible = mouth <= 0.5;
        s.glyphs = [];
        return;
      }
      s.glyphs = drawBuiltIn(def.kind, body, { feel, blink, look, mouth, arm, breathe: 1, t: t + (seed % 7) });
    });
    ctx.sound('pop', ctx.start + 0.3);
    return { end: ctx.start + 0.8, thing: th };
  },
}, ['arrive', 'come_in']);

registerAction('leave', {
  summary: 'A character goes.',
  params: ['who'],
  build(ctx) {
    const m = mascotOf(ctx);
    m.leave = ctx.start;
    return { end: ctx.start + 0.8, thing: m.th };
  },
}, ['go', 'exit']);

registerAction('react', {
  summary: 'The character shows a feeling: happy, surprised, confused, thinking, excited, worried, proud, bored.',
  params: ['who', 'feel'],
  required: ['feel'],
  build(ctx) {
    const m = mascotOf(ctx);
    const feel = choice(ctx.spec.feel, FEELS, `${ctx.where}.feel`);
    const until = ctx.duration !== undefined ? ctx.start + ctx.duration : ctx.lineEnd !== undefined ? Math.max(ctx.start + 1.5, ctx.lineEnd) : ctx.start + 2.5;
    m.feels.push({ at: ctx.start, feel, until });
    if (feel === 'surprised') ctx.sound('pop', ctx.start);
    return { end: ctx.start + 0.5, thing: m.th };
  },
}, ['feel', 'emote']);

registerAction('look', {
  summary: 'The character looks at a thing (and keeps looking as it moves).',
  params: ['who', 'on'],
  required: ['on'],
  build(ctx) {
    const m = mascotOf(ctx);
    const { world, spec } = ctx;
    const ref = spec.on;
    world.point(ref, `${ctx.where}.on`);
    const target = (): Pt | undefined => {
      if (typeof ref === 'string' && world.things.has(ref.split('.')[0]) && !world.geoPoint?.(ref)) { const t = world.things.get(ref.split('.')[0])!; const k = t.matrix(); return [k[4], k[5]]; }
      try { return world.point(ref, ctx.where); } catch { return undefined; }
    };
    m.looks.push({ at: ctx.start, target });
    return { end: ctx.start + 0.3, thing: m.th };
  },
}, ['watch']);

registerAction('say', {
  summary: 'A speech bubble from the character.',
  params: ['who', 'text'],
  required: ['text'],
  build(ctx) {
    const m = mascotOf(ctx);
    const { world, spec } = ctx;
    const text = String(spec.text);
    const end = ctx.duration !== undefined ? ctx.start + ctx.duration : ctx.lineEnd !== undefined ? Math.max(ctx.start + 2, ctx.lineEnd) : ctx.start + 3;
    const words = sheetText(ctx, world.newId('said'), text, 0.32, [0, 0], { color: '#1d1d1d', align: 'center' });
    const b = words.text!.box;
    const pad = 0.22, w = b.x1 - b.x0 + pad * 2, h = b.y1 - b.y0 + pad * 2;
    const head: Pt = [m.place[0], m.place[1] + m.def.size * 0.85];
    const toLeft = m.place[0] > 0;
    const cx = clamp(head[0] + (toLeft ? -1 : 1) * (w / 2 + 0.3), -world.frameW / 2 + w / 2 + 0.2, world.frameW / 2 - w / 2 - 0.2), cy = head[1] + h / 2 + 0.35;
    const bubble = new Thing(world.newId('bubble'), 'shape', [
      fillGlyph([roundedRect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2, 0.2), { closed: true, pts: [[cx + (toLeft ? w / 2 - 0.5 : -w / 2 + 0.5), cy - h / 2 + 0.01], [cx + (toLeft ? w / 2 - 0.2 : -w / 2 + 0.2), cy - h / 2 + 0.01], [head[0] + (toLeft ? -0.25 : 0.25), head[1] + 0.05]] }], 'bubble', { color: '#fbfaf6' }),
    ], [0, 0]);
    bubble.screen = true; bubble.layer = 9;
    words.base.x = words.build.x = cx - (b.x0 + b.x1) / 2;
    words.base.y = words.build.y = cy - (b.y0 + b.y1) / 2;
    words.screen = true; words.layer = 10;
    world.add(bubble, ctx.where);
    world.add(words, ctx.where);
    for (const th of [bubble, words]) {
      ctx.act({ start: ctx.start, duration: end - ctx.start + 0.3, apply(u, t) {
        const k = clamp((t - ctx.start) / 0.25) * clamp((end + 0.3 - t) / 0.3);
        th.state.visible = k > 0;
        th.state.opacity *= k;
        void u;
      } });
    }
    m.talks.push([ctx.start, end]);
    ctx.sound('pop', ctx.start);
    return { end, thing: bubble };
  },
}, ['speak', 'bubble']);

registerAction('talk', {
  summary: 'The character\'s mouth moves with the narration.',
  params: ['who'],
  build(ctx) {
    const m = mascotOf(ctx);
    const end = ctx.duration !== undefined ? ctx.start + ctx.duration : ctx.lineEnd ?? ctx.start + 3;
    m.talks.push([ctx.start, end]);
    return { end: ctx.start, thing: m.th };
  },
}, ['speak_along', 'mouth']);

registerAction('gesture', {
  summary: 'The character points, waves, shrugs, jumps or claps.',
  params: ['who', 'gesture', 'on'],
  required: ['gesture'],
  build(ctx) {
    const m = mascotOf(ctx);
    const { world, spec } = ctx;
    const kind = choice(spec.gesture, GESTURES, `${ctx.where}.gesture`);
    const d = ctx.duration ?? (kind === 'wave' || kind === 'clap' ? 1.4 : 1);
    const to = spec.on !== undefined ? () => { try { return world.point(spec.on, ctx.where); } catch { return undefined; } } : () => lastDrawn(world, m.th);
    if (spec.on !== undefined) m.looks.push({ at: ctx.start, target: to });
    m.gestures.push({ at: ctx.start, kind, d, to });
    if (kind === 'clap') { ctx.sound('click', ctx.start + d * 0.25); ctx.sound('click', ctx.start + d * 0.5); ctx.sound('click', ctx.start + d * 0.75); }
    if (kind === 'jump') ctx.sound('pop', ctx.start + d * 0.5);
    return { end: ctx.start + d, thing: m.th };
  },
}, ['move_arms']);

