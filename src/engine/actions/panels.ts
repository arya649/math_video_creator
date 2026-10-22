// On-screen panels and graphics: cards, counters, chips, tables, charts,
// labels, credits and pictures. A panel is a rounded block with rows of
// words and maths, unmoved by the camera.

import { type Ctx, type Done, TEXT_SIZES, arrive, color, mathGlyphs, num, readAppear, registerAction, sheetText, sizeOf, str, natural } from '../actions';
import type { Box, Contour, Pt } from '../geom';
import { numberGlyphs } from '../graph/axes';
import { formatNumber } from '../graph/expr';
import { arrowHead, fillGlyph, roundedRect, strokeGlyph } from '../shapes';
import { type Glyph, Thing } from '../thing';
import { withAlpha } from '../color';
import { ScriptError, choice, clamp, ease, isObject } from '../util';
import { SCREEN_PLACES, type SceneWorld } from '../world';
import { liveThing } from './graph';

export interface Row {
  text?: string;
  tex?: string;
  /** A number written afresh every frame (a count). */
  live?: (t: number) => string;
  size: number;
  color?: string;
  weight?: number;
  italic?: boolean;
  gap?: number;
}

/** How long an on-screen piece stays: its beat, or to the scene's end with "stay". */
export function stayEnd(ctx: Ctx, fallback = 3): { end: number; leaves: boolean } {
  if (ctx.spec.stay === true) return { end: ctx.world.end, leaves: false };
  const d = ctx.duration ?? (ctx.lineEnd !== undefined ? Math.max(2.5, ctx.lineEnd - ctx.start) : fallback);
  return { end: ctx.start + d, leaves: true };
}

export function leaveAt(ctx: Ctx, t: Thing, at: number) {
  ctx.act({ start: at - 0.4, duration: 0.4, apply(u) { if (u >= 1) t.state.visible = false; else t.state.opacity *= 1 - ease('smooth', u); } });
}

/** The box of rows laid one under another, and each row's thing (not yet placed). */
function buildRows(ctx: Ctx, id: string, rows: Row[], align: 'left' | 'center'): { things: Thing[]; boxes: Box[]; width: number; height: number; gaps: number[] } {
  const { world } = ctx;
  const things: Thing[] = [];
  const boxes: Box[] = [];
  rows.forEach((r, i) => {
    let th: Thing;
    if (r.live) {
      const live = r.live;
      th = liveThing(ctx, `${id}.row${i}`, (t) => numberGlyphs(live(t), [0, 0], 'center', r.size, r.color ?? world.theme.onSurface, ''), ctx.where, 'math');
    } else if (r.tex !== undefined) {
      const m = mathGlyphs(world, r.tex, r.size, ctx.where);
      th = new Thing(`${id}.row${i}`, 'math', m.glyphs, [0, 0]);
      th.base.color = r.color;
      world.add(th, ctx.where);
    } else {
      th = sheetText(ctx, `${id}.row${i}`, r.text ?? '', r.size, [0, 0], { color: r.color, align, italic: r.italic });
      th.text!.weight = r.weight ?? 500;
      world.add(th, ctx.where);
    }
    th.screen = true;
    things.push(th);
    boxes.push(th.buildBox());
  });
  const gaps = rows.map((r, i) => (i === 0 ? 0 : r.gap ?? Math.max(0.14, r.size * 0.4)));
  const width = Math.max(0.5, ...boxes.map((b) => b.x1 - b.x0));
  const height = boxes.reduce((a, b, i) => a + (b.y1 - b.y0) + gaps[i], 0);
  return { things, boxes, width, height, gaps };
}

/** Where a panel of this size goes for a screen place, kept inside the frame. */
export function placePanel(world: SceneWorld, place: string, w: number, h: number): Pt {
  const p = world.screenPlace(place);
  const mx = world.frameW / 2 - 0.35 - w / 2, my = world.frameH / 2 - 0.35 - h / 2;
  return [clamp(p[0], -mx, mx), clamp(p[1], -my, my)];
}

/**
 * A panel of rows. Returns the panel (the parent of every row), placed so
 * its middle is at `at`.
 */
export function makePanel(ctx: Ctx, id: string, rows: Row[], opts: {
  at?: Pt; place?: string; width?: number; align?: 'left' | 'center'; surface?: string | false; bar?: string; pad?: number; outline?: string;
}): Thing {
  const { world } = ctx;
  const pad = opts.pad ?? 0.35;
  const align = opts.align ?? 'left';
  const built = buildRows(ctx, id, rows, align);
  const w = Math.max(opts.width ?? 0, built.width + pad * 2);
  const h = built.height + pad * 2;
  const at = opts.at ?? placePanel(world, opts.place ?? 'center', w, h);
  const glyphs: Glyph[] = [];
  if (opts.surface !== false) glyphs.push(fillGlyph([roundedRect(-w / 2, -h / 2, w / 2, h / 2, 0.14)], 'panel', { color: opts.surface ?? world.theme.surface }));
  if (opts.outline) glyphs.push(strokeGlyph([roundedRect(-w / 2, -h / 2, w / 2, h / 2, 0.14)], 2.5, 'outline', { color: opts.outline }));
  if (opts.bar) glyphs.push(fillGlyph([roundedRect(-w / 2, -h / 2, -w / 2 + 0.09, h / 2, 0.04)], 'bar', { color: opts.bar }));
  const panel = new Thing(id, 'shape', glyphs, at);
  panel.screen = true;
  panel.layer = 3;
  world.add(panel, ctx.where);
  // Rows run down from the top, each placed by its own box.
  let y = h / 2 - pad;
  built.things.forEach((th, i) => {
    const b = built.boxes[i];
    y -= built.gaps[i];
    const x = align === 'center' ? -(b.x0 + b.x1) / 2 : -w / 2 + pad - b.x0 + (opts.bar ? 0.08 : 0);
    th.parent = panel;
    th.base.x = th.build.x = x;
    th.base.y = th.build.y = y - b.y1;
    th.layer = 4;
    y -= b.y1 - b.y0;
  });
  panel.members = built.things;
  // Rows show whenever the panel does.
  for (const th of built.things) th.base.visible = true;
  return panel;
}

/** Widen a left-aligned panel to a new width, keeping its left edge's padding. */
export function widenPanel(panel: Thing, width: number) {
  const b = panel.buildBox();
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  if (width <= w + 1e-6) return;
  const dx = (width - w) / 2;
  const box = roundedRect(-width / 2, -h / 2, width / 2, h / 2, 0.14);
  const glyphs = panel.build.glyphs.map((g) => {
    if (g.key === 'panel') return { ...g, contours: [box] };
    if (g.key === 'outline') return { ...g, contours: [box] };
    if (g.key === 'bar') return { ...g, contours: [roundedRect(-width / 2, -h / 2, -width / 2 + 0.09, h / 2, 0.04)] };
    return g;
  });
  panel.base.glyphs = panel.build.glyphs = glyphs;
  for (const m of panel.members) { m.base.x -= dx; m.build.x -= dx; }
}

/** Make a panel arrive, and leave at the end of its beat unless it stays. */
function showPanel(ctx: Ctx, panel: Thing, fallback = 3): Done {
  const { how } = readAppear(ctx, 'rise');
  const { end, leaves } = stayEnd(ctx, fallback);
  arrive(ctx, panel, how === 'draw' || how === 'write' ? 'rise' : how, ctx.start, 0.5);
  if (leaves) leaveAt(ctx, panel, end);
  return { end, thing: panel };
}

const placeOf = (ctx: Ctx, fallback: string): string => {
  const p = ctx.spec.position ?? fallback;
  if (typeof p !== 'string' || !(SCREEN_PLACES as readonly string[]).includes(p)) throw new ScriptError(`must be one of ${SCREEN_PLACES.join(', ')}.`, `${ctx.where}.position`);
  return p;
};

// ---- card ----

registerAction('card', {
  summary: 'A panel: heading, a sentence, a number, a formula; can point at a place.',
  params: ['title', 'text', 'kicker', 'number', 'unit', 'caption', 'tex', 'side', 'position', 'on', 'appear', 'stay', 'width'],
  build(ctx) {
    const { world, spec } = ctx;
    if (spec.title === undefined && spec.text === undefined && spec.number === undefined && spec.tex === undefined) {
      throw new ScriptError('needs at least one of "title", "text", "number" or "tex".', ctx.where);
    }
    if (spec.number !== undefined && typeof spec.number !== 'number') throw new ScriptError('must be a number.', `${ctx.where}.number`);
    const side = choice(spec.side, ['right', 'left'] as const, `${ctx.where}.side`, 'right');
    const vpos = choice(spec.position, ['top', 'middle', 'bottom'] as const, `${ctx.where}.position`, 'top');
    const ink = world.theme.onSurface;
    const rows: Row[] = [];
    if (typeof spec.kicker === 'string') rows.push({ text: spec.kicker.toUpperCase(), size: 0.24, color: world.theme.accent, weight: 600 });
    if (typeof spec.title === 'string') rows.push({ text: spec.title, size: 0.42, color: ink, weight: 700 });
    if (typeof spec.number === 'number') {
      const n = spec.number, start = ctx.start, unit = typeof spec.unit === 'string' ? `\\ \\text{${spec.unit}}` : '';
      const dec = Number.isInteger(n) ? 0 : Math.min(4, (String(n).split('.')[1] ?? '').length);
      rows.push({ live: (t) => `${formatNumber(n * ease('out', clamp((t - start - 0.3) / 1.2)), dec)}${unit}`, size: 0.75, color: world.theme.accent });
    }
    if (typeof spec.tex === 'string') rows.push({ tex: spec.tex, size: 0.45, color: ink });
    if (typeof spec.text === 'string') rows.push({ text: spec.text, size: 0.3, color: withAlpha(ink, 0.85) });
    if (typeof spec.caption === 'string') rows.push({ text: spec.caption, size: 0.24, color: withAlpha(ink, 0.65) });
    const id = str(ctx, 'id') ?? world.newId('card');
    const panel = makePanel(ctx, id, rows, { bar: world.theme.accent, width: num(ctx, 'width', 0) });
    // Its place, below any card already showing in the same spot.
    const b = panel.buildBox();
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    const W = world.frameW / 2, H = world.frameH / 2;
    const x = side === 'right' ? W - 0.4 - w / 2 : -W + 0.4 + w / 2;
    let top = vpos === 'top' ? H - 0.45 : vpos === 'middle' ? h / 2 : -H + 1.4 + h;
    const { end } = stayEnd(ctx);
    const key = `${side}|${vpos}`;
    for (const s of world.cardSlots) if (s.key === key && s.start < end && s.end > ctx.start) top = Math.min(top, s.bottom - 0.2);
    world.cardSlots.push({ key, start: ctx.start, end, top, bottom: top - h });
    panel.base.x = panel.build.x = x;
    panel.base.y = panel.build.y = top - h / 2;
    if (spec.on !== undefined) {
      // A dotted line from the card to the place it is about (with the camera at rest).
      const target = world.point(spec.on, `${ctx.where}.on`);
      const from: Pt = [side === 'right' ? x - w / 2 : x + w / 2, top - h / 2];
      const line = new Thing(world.newId('pointer'), 'shape', [
        strokeGlyph([{ closed: false, pts: [from, target] }], 2.5, 'pointer', { color: world.theme.accent, dash: true }),
        fillGlyph([{ closed: true, pts: Array.from({ length: 16 }, (_, k) => [target[0] + 0.07 * Math.cos((k / 16) * Math.PI * 2), target[1] + 0.07 * Math.sin((k / 16) * Math.PI * 2)] as Pt) }], 'dot', { color: world.theme.accent }),
      ], [0, 0]);
      line.screen = true;
      line.layer = 2;
      world.add(line, ctx.where);
      arrive(ctx, line, 'draw', ctx.start + 0.3, 0.6);
      if (stayEnd(ctx).leaves) leaveAt(ctx, line, end);
    }
    if (spec.key === true) { panel.key = true; panel.keyText = { title: typeof spec.title === 'string' ? spec.title : undefined, tex: typeof spec.tex === 'string' ? spec.tex : undefined, text: typeof spec.text === 'string' ? spec.text : undefined }; }
    return showPanel(ctx, panel);
  },
}, ['info', 'popup', 'fact']);

// ---- counter ----

/** Number grouping by language: 1,00,000 where that is the custom. */
const INDIAN = new Set(['hi', 'mr', 'bn', 'te', 'ta', 'gu', 'kn', 'ml', 'or', 'pa', 'as', 'ne', 'sa', 'ur']);

export function groupNumber(v: number, decimals: number, style: 'indian' | 'international' | 'none'): string {
  if (style === 'none') return v.toFixed(decimals);
  return new Intl.NumberFormat(style === 'indian' ? 'en-IN' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

registerAction('counter', {
  summary: 'Numbers that count from one value to another.',
  params: ['to', 'from', 'label', 'kicker', 'items', 'decimals', 'prefix', 'suffix', 'plain', 'grouping', 'value', 'position', 'size', 'color', 'stay', 'hold', 'ease', 'appear'],
  build(ctx) {
    const { world, spec } = ctx;
    const items: Record<string, unknown>[] = Array.isArray(spec.items) ? spec.items.filter(isObject) : [spec];
    if (!items.length) throw new ScriptError('needs "to", "value", or "items".', ctx.where);
    const size = sizeOf(spec.size, { small: 0.55, medium: 0.8, large: 1.1, huge: 1.6 }, `${ctx.where}.size`, 'large');
    const col = color(ctx, 'color', world.theme.ink)!;
    const lang = world.lang;
    const grouping = spec.plain === true ? 'none' : choice(spec.grouping, ['indian', 'international'] as const, `${ctx.where}.grouping`, INDIAN.has(lang) ? 'indian' : 'international');
    const count = ctx.duration !== undefined ? Math.max(0.3, ctx.duration - (typeof spec.hold === 'number' ? 0 : 0)) : 1.6;
    const e = spec.ease === 'linear' ? 'linear' : 'smooth';
    const start = ctx.start;
    const id = str(ctx, 'id') ?? world.newId('counter');
    const columns = items.map((it, i) => {
      const where = Array.isArray(spec.items) ? `${ctx.where}.items[${i}]` : ctx.where;
      const valueName = typeof it.value === 'string' ? it.value : undefined;
      if (valueName && !world.values.has(valueName)) throw new ScriptError(`there is no value called "${valueName}".`, `${where}.value`);
      if (!valueName && typeof it.to !== 'number') throw new ScriptError('needs "to": a number (or "value": the name of a value).', `${where}.to`);
      if (it.from !== undefined && typeof it.from !== 'number') throw new ScriptError('must be a number.', `${where}.from`);
      const from = typeof it.from === 'number' ? it.from : 0, to = it.to as number;
      const dec = typeof it.decimals === 'number' ? it.decimals : typeof spec.decimals === 'number' ? spec.decimals : valueName ? world.values.get(valueName)!.decimals : Number.isInteger(to) && Number.isInteger(from) ? 0 : 1;
      const pre = typeof (it.prefix ?? spec.prefix) === 'string' ? String(it.prefix ?? spec.prefix) : '';
      const suf = typeof (it.suffix ?? spec.suffix) === 'string' ? String(it.suffix ?? spec.suffix) : '';
      const now = (t: number) => (valueName ? world.values.get(valueName)!.now : from + (to - from) * ease(e, clamp((t - start) / count)));
      const rows: Row[] = [];
      if (typeof it.kicker === 'string') rows.push({ text: it.kicker.toUpperCase(), size: size * 0.24, color: world.theme.accent, weight: 600 });
      rows.push({ live: (t) => `\\text{${pre}${groupNumber(now(t), dec, grouping)}${suf}}`, size, color: col });
      if (typeof it.label === 'string') rows.push({ text: it.label, size: size * 0.32, color: world.theme.accent, weight: 600 });
      return makePanel(ctx, `${id}.${i + 1}`, rows, { surface: false, align: 'center', pad: 0.1 });
    });
    // Side by side, the whole set at its screen place.
    const widths = columns.map((c) => { const b = c.buildBox(); return b.x1 - b.x0; });
    const heights = columns.map((c) => { const b = c.buildBox(); return b.y1 - b.y0; });
    const gap = 0.8;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (columns.length - 1);
    const at = placePanel(world, placeOf(ctx, 'center'), total, Math.max(...heights));
    let x = at[0] - total / 2;
    const { end, leaves } = stayEnd(ctx, count + 2);
    const hold = typeof spec.hold === 'number' ? spec.hold : 2;
    const realEnd = spec.stay === true ? end : Math.max(end, start + count + hold);
    columns.forEach((c, i) => {
      c.base.x = c.build.x = x + widths[i] / 2;
      c.base.y = c.build.y = at[1];
      x += widths[i] + gap;
      arrive(ctx, c, 'rise', start, 0.4);
      if (leaves) leaveAt(ctx, c, realEnd);
    });
    const group = new Thing(id, 'group', [], [0, 0]);
    group.members = columns;
    world.add(group, ctx.where);
    return { end: realEnd, thing: group };
  },
}, ['count', 'ticker']);

// ---- chips ----

registerAction('chips', {
  summary: 'A set of short words appearing in turn, as rounded outlines.',
  params: ['items', 'kicker', 'position', 'size', 'lag', 'stay'],
  required: ['items'],
  build(ctx) {
    const { world, spec } = ctx;
    if (!Array.isArray(spec.items) || !spec.items.length) throw new ScriptError('needs "items": a list of words.', `${ctx.where}.items`);
    const size = sizeOf(spec.size, TEXT_SIZES, `${ctx.where}.size`, 'medium') * 0.85;
    const lag = num(ctx, 'lag', 0.35);
    const id = str(ctx, 'id') ?? world.newId('chips');
    const pills = spec.items.map((item, i) => {
      const col = world.theme.colors[i % world.theme.colors.length];
      const p = makePanel(ctx, `${id}.${i + 1}`, [{ text: String(item), size, color: col, weight: 600 }], { surface: withAlpha(col, 0.12), outline: col, pad: size * 0.55, align: 'center' });
      return p;
    });
    const widths = pills.map((p) => { const b = p.buildBox(); return b.x1 - b.x0; });
    const gap = 0.3;
    // Wrap onto more rows if they do not fit across.
    const maxW = world.frameW * 0.85;
    const lines: number[][] = [[]];
    let w = 0;
    widths.forEach((pw, i) => {
      if (w + pw > maxW && lines[lines.length - 1].length) { lines.push([]); w = 0; }
      lines[lines.length - 1].push(i);
      w += pw + gap;
    });
    const h = pills[0].buildBox().y1 - pills[0].buildBox().y0;
    const kickerH = typeof spec.kicker === 'string' ? 0.5 : 0;
    const totalH = lines.length * (h + gap) - gap + kickerH;
    const at = placePanel(world, placeOf(ctx, 'center'), maxW, totalH);
    const { end, leaves } = stayEnd(ctx);
    if (typeof spec.kicker === 'string') {
      const k = sheetText(ctx, `${id}.kicker`, spec.kicker.toUpperCase(), 0.26, [at[0], at[1] + totalH / 2 - 0.15], { color: world.theme.accent });
      k.screen = true;
      world.add(k, ctx.where);
      arrive(ctx, k, 'fade', ctx.start, 0.4);
      if (leaves) leaveAt(ctx, k, end);
    }
    let n = 0;
    lines.forEach((line, r) => {
      const lw = line.reduce((a, i) => a + widths[i], 0) + gap * (line.length - 1);
      let x = at[0] - lw / 2;
      const y = at[1] + totalH / 2 - kickerH - h / 2 - r * (h + gap);
      for (const i of line) {
        const p = pills[i];
        p.base.x = p.build.x = x + widths[i] / 2;
        p.base.y = p.build.y = y;
        x += widths[i] + gap;
        arrive(ctx, p, 'pop', ctx.start + n * lag, 0.45);
        ctx.sound('pop', ctx.start + n * lag);
        if (leaves) leaveAt(ctx, p, end);
        n++;
      }
    });
    const group = new Thing(id, 'group', [], [0, 0]);
    group.members = pills;
    world.add(group, ctx.where);
    return { end: Math.max(end, ctx.start + n * lag), thing: group };
  },
}, ['pills']);

// ---- table ----

registerAction('table', {
  summary: 'A grid of values, filling in row by row.',
  params: ['head', 'rows', 'position', 'lag', 'light', 'size', 'stay', 'color'],
  required: ['rows'],
  build(ctx) {
    const { world, spec } = ctx;
    if (!Array.isArray(spec.rows) || !spec.rows.every(Array.isArray)) throw new ScriptError('needs "rows": a list of rows, each a list of cells.', `${ctx.where}.rows`);
    const head = Array.isArray(spec.head) ? spec.head.map(String) : undefined;
    const rows = (spec.rows as unknown[][]).map((r) => r.map(String));
    const all = head ? [head, ...rows] : rows;
    const cols = Math.max(...all.map((r) => r.length));
    const size = sizeOf(spec.size, TEXT_SIZES, `${ctx.where}.size`, 'medium');
    const id = str(ctx, 'id') ?? world.newId('table');
    const lag = num(ctx, 'lag', 0.45);
    // Each cell as words (maths between $).
    const cells = all.map((r, ri) => r.map((c, ci) => {
      const th = sheetText(ctx, `${id}.r${ri}c${ci}`, c, size, [0, 0], { color: ri === 0 && head ? world.theme.accent : world.theme.ink });
      th.screen = true;
      if (ri === 0 && head) th.text!.weight = 700;
      return th;
    }));
    const colW = Array.from({ length: cols }, (_, ci) => Math.max(0.6, ...cells.map((r) => (r[ci] ? r[ci].text!.box.x1 - r[ci].text!.box.x0 : 0))) + 0.6);
    const rowH = size * 1.6;
    const W = colW.reduce((a, b) => a + b, 0), H = rowH * all.length;
    const at = placePanel(world, placeOf(ctx, 'center'), W, H);
    const x0 = at[0] - W / 2, y0 = at[1] + H / 2;
    const grid: Contour[] = [];
    if (head) grid.push({ closed: false, pts: [[x0, y0 - rowH], [x0 + W, y0 - rowH]] });
    let cx = x0;
    for (let ci = 0; ci < cols - 1; ci++) { cx += colW[ci]; grid.push({ closed: false, pts: [[cx, y0], [cx, y0 - H]] }); }
    const lines = new Thing(`${id}`, 'shape', [strokeGlyph(grid, 2.5, 'grid', { color: withAlpha(world.theme.ink, 0.5) })], [0, 0]);
    lines.screen = true;
    world.add(lines, ctx.where);
    const { end, leaves } = stayEnd(ctx, 3 + all.length * lag);
    arrive(ctx, lines, 'draw', ctx.start, 0.6);
    if (leaves) leaveAt(ctx, lines, end);
    const light = typeof spec.light === 'number' ? spec.light : undefined;
    cells.forEach((r, ri) => {
      const when = ctx.start + 0.4 + ri * lag;
      const y = y0 - rowH * (ri + 0.5);
      if (light !== undefined && ri === light - 1 + (head ? 1 : 0)) {
        const back = new Thing(world.newId('light'), 'decoration', [fillGlyph([roundedRect(x0, y - rowH / 2, x0 + W, y + rowH / 2, 0.06)], 'back', { color: withAlpha(world.theme.accent, 0.22) })], [0, 0]);
        back.screen = true;
        back.layer = -1;
        world.add(back, ctx.where);
        arrive(ctx, back, 'fade', when, 0.4);
        if (leaves) leaveAt(ctx, back, end);
      }
      let x = x0;
      r.forEach((th, ci) => {
        const b = th.text!.box;
        th.base.x = th.build.x = x + colW[ci] / 2 - (b.x0 + b.x1) / 2;
        th.base.y = th.build.y = y - (b.y0 + b.y1) / 2;
        x += colW[ci];
        world.add(th, ctx.where);
        arrive(ctx, th, 'fade', when, 0.35);
        if (leaves) leaveAt(ctx, th, end);
      });
    });
    return { end, thing: lines };
  },
});

// ---- chart ----

registerAction('chart', {
  summary: 'Bars, a line, a pie or dots, built from numbers.',
  params: ['kind', 'items', 'title', 'unit', 'position', 'size', 'stay'],
  required: ['items'],
  build(ctx) {
    const { world, spec } = ctx;
    const kind = choice(spec.kind, ['bar', 'line', 'pie', 'dot'] as const, `${ctx.where}.kind`, 'bar');
    if (!Array.isArray(spec.items) || !spec.items.length) throw new ScriptError('needs "items": a list of { "label", "value" }.', `${ctx.where}.items`);
    const items = spec.items.map((it, i) => {
      if (!isObject(it) || typeof it.value !== 'number') throw new ScriptError('must be { "label": ..., "value": a number }.', `${ctx.where}.items[${i}]`);
      return { label: String(it.label ?? ''), value: it.value, color: it.color !== undefined ? color({ ...ctx, spec: { c: it.color } }, 'c')! : world.theme.colors[i % world.theme.colors.length] };
    });
    const scale = sizeOf(spec.size, { small: 0.7, medium: 1, large: 1.3, huge: 1.6 }, `${ctx.where}.size`, 'medium');
    const W = 7 * scale, H = 3.6 * scale;
    const at = placePanel(world, placeOf(ctx, 'center'), W, H + 1);
    const id = str(ctx, 'id') ?? world.newId('chart');
    const unit = typeof spec.unit === 'string' ? spec.unit : '';
    const max = Math.max(...items.map((i) => Math.abs(i.value)), 1e-9);
    const start = ctx.start;
    const grow = Math.max(0.8, (ctx.duration ?? 3) * 0.5);
    const ink = world.theme.ink;
    const fmt = (v: number) => `\\text{${formatNumber(v, Number.isInteger(max) ? 0 : 1)}${unit ? ` ${unit}` : ''}}`;
    const th = liveThing(ctx, id, (t) => {
      const u = t === Infinity ? 1 : ease('out', clamp((t - start) / grow));
      const out: Glyph[] = [];
      const x0 = at[0] - W / 2, base = at[1] - H / 2;
      if (typeof spec.title === 'string') out.push(...numberGlyphs(`\\text{${spec.title}}`, [at[0], base + H + 0.85], 'center', 0.4, ink, ''));
      if (kind === 'pie') {
        const total = items.reduce((a, i) => a + Math.max(0, i.value), 0) || 1;
        const r = H / 2;
        const c: Pt = [at[0], at[1]];
        let a0 = Math.PI / 2;
        items.forEach((it, i) => {
          const share = Math.max(0, it.value) / total;
          const k = clamp(u * items.length - i);
          const a1 = a0 - share * 2 * Math.PI * k;
          if (k > 0) {
            const pts: Pt[] = [c];
            for (let s = 0; s <= 30; s++) { const a = a0 + ((a1 - a0) * s) / 30; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
            out.push(fillGlyph([{ closed: true, pts }], 'slice', { color: withAlpha(it.color, 0.85) }));
            const am = (a0 + a1) / 2;
            if (k >= 1) out.push(...numberGlyphs(`\\text{${it.label}}`, [c[0] + (r + 0.45) * Math.cos(am), c[1] + (r + 0.35) * Math.sin(am)], Math.cos(am) > 0.2 ? 'right' : Math.cos(am) < -0.2 ? 'left' : 'center', 0.3, it.color, ''));
          }
          a0 -= share * 2 * Math.PI;
        });
        return out;
      }
      out.push(strokeGlyph([{ closed: false, pts: [[x0, base], [x0 + W, base]] }], 2.5, 'axis', { color: withAlpha(ink, 0.6) }));
      const slot = W / items.length;
      const pts: Pt[] = [];
      items.forEach((it, i) => {
        const cx = x0 + slot * (i + 0.5);
        const h = (H * it.value) / max * u;
        const top: Pt = [cx, base + h];
        pts.push(top);
        if (kind === 'bar') out.push(fillGlyph([roundedRect(cx - slot * 0.3, Math.min(base, base + h), cx + slot * 0.3, Math.max(base, base + h), 0.04)], 'bar', { color: it.color }));
        if (kind === 'dot' || kind === 'line') out.push(fillGlyph([{ closed: true, pts: Array.from({ length: 18 }, (_, k) => [cx + 0.09 * Math.cos((k / 18) * Math.PI * 2), base + h + 0.09 * Math.sin((k / 18) * Math.PI * 2)] as Pt) }], 'dot', { color: it.color }));
        out.push(...numberGlyphs(fmt(it.value * u), [cx, base + h + 0.18], 'above', 0.3, ink, ''));
        out.push(...numberGlyphs(`\\text{${it.label}}`, [cx, base - 0.15], 'below', 0.3, withAlpha(ink, 0.85), ''));
      });
      if (kind === 'line') out.push(strokeGlyph([{ closed: false, pts }], 4, 'line', { color: world.theme.accent }));
      return out;
    }, ctx.where);
    th.screen = true;
    const { end, leaves } = stayEnd(ctx, 4);
    arrive(ctx, th, 'fade', start, 0.4);
    if (leaves) leaveAt(ctx, th, end);
    return { end, thing: th };
  },
}, ['bars', 'graph_chart']);

// ---- label ----

registerAction('label', {
  summary: 'A name attached to a place or a thing on the sheet; it moves with the thing.',
  params: ['on', 'text', 'side', 'arrow', 'color', 'size', 'stay'],
  required: ['on', 'text'],
  build(ctx) {
    const { world, spec } = ctx;
    const side = choice(spec.side, ['above', 'below', 'left', 'right'] as const, `${ctx.where}.side`, 'above');
    const col = color(ctx, 'color', world.theme.ink)!;
    const size = sizeOf(spec.size, TEXT_SIZES, `${ctx.where}.size`, 'small');
    const text = str(ctx, 'text', true)!;
    const id = str(ctx, 'id') ?? world.newId('label');
    const lab = sheetText(ctx, id, text, size, [0, 0], { color: col });
    world.add(lab, ctx.where);
    const b = lab.text!.box;
    const reach = spec.arrow === true ? 0.75 : 0.25;
    const placeFor = (p: Pt): Pt => side === 'above' ? [p[0], p[1] + reach - b.y0] : side === 'below' ? [p[0], p[1] - reach - b.y1] : side === 'left' ? [p[0] - reach - b.x1, p[1]] : [p[0] + reach - b.x0, p[1]];
    // A point follows its place; a thing is labelled at the edge of its box.
    const onThing = typeof spec.on === 'string' && world.things.has(spec.on) && !world.geoPoint?.(spec.on);
    const where = (): Pt => {
      if (!onThing) return world.point(spec.on, `${ctx.where}.on`);
      const bx = world.boxOf(String(spec.on), `${ctx.where}.on`);
      const cx = (bx.x0 + bx.x1) / 2, cy = (bx.y0 + bx.y1) / 2;
      return side === 'above' ? [cx, bx.y1] : side === 'below' ? [cx, bx.y0] : side === 'left' ? [bx.x0, cy] : [bx.x1, cy];
    };
    const p0 = placeFor(where());
    lab.base.x = lab.build.x = p0[0];
    lab.base.y = lab.build.y = p0[1];
    // It follows geometry and graph points as they move.
    world.livers.push(() => { if (lab.shown()) { const p = placeFor(where()); lab.state.x += p[0] - p0[0]; lab.state.y += p[1] - p0[1]; } });
    const { end, leaves } = stayEnd(ctx, Infinity);
    arrive(ctx, lab, 'rise', ctx.start, 0.4);
    if (spec.arrow === true) {
      const arrow = liveThing(ctx, world.newId('arrow'), () => {
        const p = where(), q = placeFor(p);
        const from: Pt = side === 'above' ? [q[0], q[1] + b.y0 - 0.05] : side === 'below' ? [q[0], q[1] + b.y1 + 0.05] : side === 'left' ? [q[0] + b.x1 + 0.05, q[1]] : [q[0] + b.x0 - 0.05, q[1]];
        const d = Math.hypot(p[0] - from[0], p[1] - from[1]) || 1;
        const to: Pt = [p[0] - ((p[0] - from[0]) / d) * 0.1, p[1] - ((p[1] - from[1]) / d) * 0.1];
        return [strokeGlyph([{ closed: false, pts: [from, to] }], 2.5, 'arrow', { color: col }), fillGlyph([arrowHead(from, to, 0.14)], 'tip', { color: col })];
      }, ctx.where);
      arrive(ctx, arrow, 'draw', ctx.start + 0.2, 0.5);
      if (leaves && Number.isFinite(end)) leaveAt(ctx, arrow, end);
    }
    if (leaves && Number.isFinite(end) && ctx.duration !== undefined) leaveAt(ctx, lab, end);
    return { end: ctx.start + 0.5, thing: lab };
  },
}, ['tag', 'pin']);

// ---- credits ----

registerAction('credits', {
  summary: 'Lines rolling up the screen; a line starting with # is a heading.',
  params: ['lines'],
  required: ['lines'],
  build(ctx) {
    const { world, spec } = ctx;
    if (!Array.isArray(spec.lines)) throw new ScriptError('needs "lines": a list.', `${ctx.where}.lines`);
    const rows: Row[] = spec.lines.map((l) => {
      const s = String(l);
      return s.startsWith('#') ? { text: s.replace(/^#\s*/, '').toUpperCase(), size: 0.28, color: world.theme.accent, weight: 600, gap: 0.6 } : { text: s, size: 0.4, color: world.theme.ink, gap: 0.18 };
    });
    const panel = makePanel(ctx, str(ctx, 'id') ?? world.newId('credits'), rows, { surface: false, align: 'center', at: [0, 0] });
    const h = panel.buildBox().y1 - panel.buildBox().y0;
    const d = ctx.duration ?? 8;
    const from = -world.frameH / 2 - h / 2, to = world.frameH / 2 + h / 2;
    ctx.act({ start: ctx.start, duration: d, apply(u) { panel.state.visible = u < 1; panel.state.y = from + (to - from) * u; } });
    return { end: ctx.start + d, thing: panel };
  },
}, ['roll']);

// ---- image ----

const IMAGE_SIZES: Record<string, number> = { small: 0.2, medium: 0.32, large: 0.46, huge: 0.7 };

registerAction('image', {
  summary: 'A picture on screen (or on the sheet).',
  params: ['file', 'position', 'size', 'frame', 'tone', 'motion', 'on_sheet', 'caption', 'stay', 'appear', 'tilt'],
  build(ctx) {
    const { world, spec } = ctx;
    const id = str(ctx, 'id') ?? world.newId('image');
    const existing = world.things.get(id);
    const short = Math.min(world.frameW, world.frameH);
    const sizeFrac = spec.size === 'full' ? -1 : sizeOf(spec.size, IMAGE_SIZES, `${ctx.where}.size`, 'medium');
    if (existing?.image && spec.file === undefined) {
      // The same picture, gliding to a new place and size.
      const th = existing;
      const img = th.image!;
      const w = sizeFrac < 0 ? world.frameW : short * sizeFrac;
      const k = w / img.w;
      const at = placePanel(world, placeOf(ctx, 'center'), w, img.h * k);
      const from: Pt = [th.build.x, th.build.y];
      const s0 = th.build.scale;
      const d = natural(ctx, 1);
      ctx.act({ start: ctx.start, duration: d, apply(u) { const e = ease('smooth', u); th.state.x += (at[0] - from[0]) * e; th.state.y += (at[1] - from[1]) * e; th.state.scale *= 1 + (k / s0 - 1) * e; } });
      th.build.x = at[0]; th.build.y = at[1]; th.build.scale = k;
      return { end: ctx.start + d, thing: th };
    }
    const file = str(ctx, 'file', true)!;
    if (/\.(mp4|webm)$/i.test(file)) throw new ScriptError('film clips are not built yet; use a picture (png, jpg, webp or svg).', `${ctx.where}.file`);
    const known = world.imageSizes[file];
    const aspect = known ? known[1] / known[0] : 0.75;
    let w = sizeFrac < 0 ? world.frameW : short * sizeFrac;
    let h = w * aspect;
    if (sizeFrac < 0 && h < world.frameH) { h = world.frameH; w = h / aspect; }
    const frame = choice(spec.frame, ['none', 'rounded', 'circle', 'polaroid'] as const, `${ctx.where}.frame`, 'rounded');
    const { end, leaves } = stayEnd(ctx);
    const th = new Thing(id, 'image', [], [0, 0]);
    th.image = {
      file, w, h, frame,
      tone: choice(spec.tone, ['none', 'mono', 'faded', 'warm', 'cold'] as const, `${ctx.where}.tone`, 'none'),
      motion: choice(spec.motion, ['none', 'in', 'out', 'left', 'right'] as const, `${ctx.where}.motion`, 'none'),
      start: ctx.start, length: Math.max(0.5, Number.isFinite(end) ? end - ctx.start : 8),
      caption: typeof spec.caption === 'string' ? spec.caption : undefined,
    };
    // An empty outline gives the picture its box for placing and framing.
    th.base.glyphs = th.build.glyphs = [{ contours: [{ closed: true, pts: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] }], fill: false, stroke: false, key: 'image', parts: [] }];
    const at = sizeFrac < 0 ? [0, 0] as Pt : spec.on_sheet === true && spec.position !== undefined && typeof spec.position !== 'string' ? world.point(spec.position, `${ctx.where}.position`) : placePanel(world, placeOf(ctx, 'center'), w, h);
    th.base.x = th.build.x = at[0];
    th.base.y = th.build.y = at[1];
    th.screen = spec.on_sheet !== true;
    th.layer = sizeFrac < 0 ? -5 : 2;
    if (typeof spec.tilt === 'number') th.base.rotation = (spec.tilt * Math.PI) / 180;
    else if (frame === 'polaroid') th.base.rotation = (-3 * Math.PI) / 180;
    world.add(th, ctx.where);
    const { how } = readAppear(ctx, 'pop');
    arrive(ctx, th, how === 'draw' || how === 'write' ? 'fade' : how, ctx.start, 0.5);
    if (leaves) leaveAt(ctx, th, end);
    return { end, thing: th };
  },
}, ['picture', 'photo', 'logo']);
