// Writing and changing equations.

import { checkStep } from '../check';
import {
  ACTIONS, type Ctx, type Done, type Spec, SIZES, TEXT_SIZES, arrive, color, glyphStates, makeMath, mathGlyphs, natural, num,
  positionSpec, readAppear, registerAction, sheetText, sizeOf, str, texOf, things, writeTime,
} from '../actions';
import { type Box, type Pt, boundsOf, centerOf } from '../geom';
import { type MorphPlan, type Pair, findRun, matchGlyphs, morphAt, planMorph } from '../match';
import { keysOf } from '../tex';
import { type Glyph, Thing, localBox, shiftGlyphs } from '../thing';
import { bracePts, handLoop, line, roundedRect, strokeGlyph, fillGlyph } from '../shapes';
import { ScriptError, choice, clamp, ease, isObject } from '../util';
import { selectPart } from '../world';
import { withAlpha } from '../color';
import { formatNumber } from '../graph/expr';

// ---- write ----

registerAction('write', {
  summary: 'Write an equation or any expression on the sheet.',
  params: ['tex', 'math', 'size', 'color', 'appear', 'align', 'lag', 'position'],
  build(ctx) {
    const { spec, world } = ctx;
    const src = spec.tex ?? spec.math;
    if (src === undefined) throw new ScriptError('needs "tex" (LaTeX) or "math" (plain maths) to write.', ctx.where);
    const list = Array.isArray(src) ? src : [src];
    const size = sizeOf(spec.size, SIZES, `${ctx.where}.size`, 'medium');
    const { how, from } = readAppear(ctx, world.theme.name === 'board' ? 'write' : 'write');
    const lag = num(ctx, 'lag', 0.35);
    const baseId = str(ctx, 'id') ?? world.newId('math');
    let start = ctx.start;
    let end = start;
    let first: Thing | undefined;
    list.forEach((item, i) => {
      const where = Array.isArray(src) ? `${ctx.where}.${spec.tex !== undefined ? 'tex' : 'math'}[${i}]` : ctx.where;
      const raw = texOf(item, spec.tex === undefined, where);
      const tex = fillValues(raw, world, where);
      const id = list.length > 1 ? `${baseId}.${i + 1}` : baseId;
      const at = i === 0 ? positionSpec(spec) : { below: first ? world.last!.id : undefined, align: spec.align ?? '=' };
      const t = makeMath(ctx, id, tex, size, at, where);
      if (spec.key === true) t.key = true;
      world.add(t, where);
      world.last = t;
      if (!first) first = t;
      if (raw !== tex) {
        // Live numbers: the maths is set again whenever a value changes.
        world.livers.push(() => {
          if (!t.shown() || t.state.glyphStates) return;
          t.state.glyphs = mathGlyphs(world, fillValues(raw, world, where), size, where).glyphs;
        });
      }
      const d = ctx.duration !== undefined ? ctx.duration / list.length : writeTime(t.base.glyphs.length) / ctx.speed;
      if (spec.hidden !== true) arrive(ctx, t, how, start, d, from);
      end = start + d;
      start = end + lag;
    });
    return { end, thing: first };
  },
}, ['show_math', 'tex']);

/** Put each value's number in place of \value{name}. */
function fillValues(tex: string, world: import('../world').SceneWorld, where: string): string {
  return tex.replace(/\\value\{([a-zA-Z][\w]*)\}/g, (_m, name: string) => {
    const v = world.values.get(name);
    if (!v) throw new ScriptError(`\\value{${name}} names a value this scene does not have. Make it first with { "do": "value", "name": "${name}" }.`, where);
    return formatNumber(v.now, v.decimals);
  });
}

// ---- steps: one form of an equation into the next ----

interface StepPlan {
  pairs: Pair[];
  plans: (MorphPlan | undefined)[];
  lifts: number[];
  old: Glyph[];
  next: Glyph[];
  outShift: Pt;
  inShift: Pt;
}

/** Plan the change from `old` to `next` (both in the same coordinates). */
function planStep(old: Glyph[], next: Glyph[], oldEq: number | undefined, newEq: number | undefined, size: number, opts: {
  mode?: 'auto' | 'parts' | 'none'; explicit?: [number[], number[]][]; outShift?: Pt; inShift?: Pt; neighbours?: boolean;
}): StepPlan {
  const pairs = matchGlyphs(old, next, { mode: opts.mode, explicit: opts.explicit, neighbours: opts.neighbours });
  const plans: (MorphPlan | undefined)[] = [];
  const lifts: number[] = [];
  for (const p of pairs) {
    if (p.from !== undefined && p.to !== undefined) {
      plans.push(planMorph(old[p.from], next[p.to]));
      // A piece crossing the "=" swings over (moving right) or under it.
      let lift = 0;
      if (oldEq !== undefined && newEq !== undefined) {
        const a = centerOf(boundsOf(old[p.from].contours))[0], b = centerOf(boundsOf(next[p.to].contours))[0];
        if ((a - oldEq) * (b - newEq) < 0) lift = (b > a ? 1 : -1) * size * 1.4;
      }
      // Pieces travelling far along the line arc over (moving right) or
      // under (moving left), so pieces changing places never collide.
      if (!lift) {
        const a = centerOf(boundsOf(old[p.from].contours))[0], b = centerOf(boundsOf(next[p.to].contours))[0];
        if (Math.abs(b - a) > size * 2.2) lift = Math.sign(b - a) * Math.min(size * 1.1, Math.abs(b - a) * 0.18);
      }
      lifts.push(lift);
    } else {
      plans.push(undefined);
      lifts.push(0);
    }
  }
  return { pairs, plans, lifts, old, next, outShift: opts.outShift ?? [0, 0], inShift: opts.inShift ?? [0, 0] };
}

/** The glyphs part way through a step. */
function stepFrame(t: Thing, plan: StepPlan, u: number) {
  const e = ease('smooth', u);
  const glyphs: Glyph[] = [];
  const states = [];
  for (let k = 0; k < plan.pairs.length; k++) {
    const p = plan.pairs[k];
    if (p.from !== undefined && p.to !== undefined) {
      glyphs.push(morphAt(plan.old[p.from], plan.next[p.to], plan.plans[k]!, e, plan.lifts[k]));
      states.push({ dx: 0, dy: 0, opacity: 1, scale: 1 });
    } else if (p.from !== undefined) {
      const o = clamp(1 - u * 2.2);
      glyphs.push(plan.old[p.from]);
      states.push({ dx: plan.outShift[0] * e, dy: plan.outShift[1] * e, opacity: o, scale: 1 - 0.2 * e });
    } else {
      const i = clamp(u * 2 - 0.9);
      glyphs.push(plan.next[p.to!]);
      states.push({ dx: plan.inShift[0] * (1 - e), dy: plan.inShift[1] * (1 - e), opacity: i, scale: 0.8 + 0.2 * e });
    }
  }
  t.state.glyphs = glyphs;
  t.state.glyphStates = states;
}

/** New glyphs placed so their "=" sits where the old one was, or centred on the old. */
function alignNew(old: Glyph[], oldEq: number | undefined, next: Glyph[], newEq: number | undefined): { glyphs: Glyph[]; eq?: number } {
  let dx: number;
  if (oldEq !== undefined && newEq !== undefined) dx = oldEq - newEq;
  else {
    const a = localBox(old), b = localBox(next);
    dx = (a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2;
  }
  return { glyphs: shiftGlyphs(next, dx, 0), eq: newEq === undefined ? undefined : newEq + dx };
}

/** Pairs the script names itself: { "+5": "-5" } or by part names. */
function explicitPairs(ctx: Ctx, old: Glyph[], next: Glyph[]): [number[], number[]][] {
  const v = ctx.spec.pairs;
  if (v === undefined) return [];
  if (!isObject(v)) throw new ScriptError('must be { "old piece": "new piece" }.', `${ctx.where}.pairs`);
  const find = (gs: Glyph[], piece: string, side: string): number[] => {
    const named = gs.map((g, i) => (g.parts.includes(piece) ? i : -1)).filter((i) => i >= 0);
    if (named.length) return named;
    const ks = keysOf(piece);
    const hit = findRun(gs.map((g) => g.key), ks);
    if (!hit.length) throw new ScriptError(`"${piece}" is not in the ${side} expression.`, `${ctx.where}.pairs`);
    return ks.map((_, k) => hit[0] + k);
  };
  return Object.entries(v).map(([a, b]) => [find(old, a, 'old'), find(next, String(b), 'new')]);
}

const MATCH = ['auto', 'parts', 'none'] as const;

/**
 * One step on a math thing: plan it, add the action, update what the
 * compiler knows about the thing. Returns the thing the step ends on.
 */
export function addStep(ctx: Ctx, t: Thing, tex: string, start: number, duration: number, opts: {
  newLine?: { id: string; gap?: unknown }; where: string; outShift?: Pt; inShift?: Pt; explicit?: boolean; neighbours?: boolean;
}): Thing {
  const { world } = ctx;
  const m = mathGlyphs(world, tex, t.size, opts.where);
  const mode = choice(ctx.spec.match, MATCH, `${ctx.where}.match`, 'auto');
  if (opts.newLine) {
    // A new line below, lined up on "=", grown out of a copy of the old.
    const nt = makeMath(ctx, opts.newLine.id, tex, t.size, { below: t.id, align: '=', gap: opts.newLine.gap ?? 'medium' }, opts.where);
    if (!ctx.spec.color && t.base.color) nt.base.color = t.base.color;
    world.add(nt, opts.where);
    world.last = nt;
    const dx = t.build.x - nt.build.x, dy = t.build.y - nt.build.y;
    const from = shiftGlyphs(t.build.glyphs, dx, dy);
    const plan = planStep(from, nt.build.glyphs, t.equalsX !== undefined ? t.equalsX + dx : undefined, nt.equalsX, t.size, {
      mode, explicit: opts.explicit === false ? [] : explicitPairs(ctx, from, nt.build.glyphs), outShift: opts.outShift, inShift: opts.inShift, neighbours: opts.neighbours,
    });
    ctx.act({
      start, duration,
      apply(u) {
        nt.state.visible = true;
        if (u < 1) stepFrame(nt, plan, u);
      },
    });
    return nt;
  }
  if (t.note) {
    const note = t.note;
    ctx.act({ start, duration: 0.4, apply(u) { if (u >= 1) note.state.visible = false; else note.state.opacity *= 1 - u; } });
    t.note = undefined;
  }
  const aligned = alignNew(t.build.glyphs, t.equalsX, m.glyphs, m.equalsX);
  const plan = planStep(t.build.glyphs, aligned.glyphs, t.equalsX, aligned.eq, t.size, {
    mode, explicit: opts.explicit === false ? [] : explicitPairs(ctx, t.build.glyphs, aligned.glyphs), outShift: opts.outShift, inShift: opts.inShift, neighbours: opts.neighbours,
  });
  const next = aligned.glyphs;
  ctx.act({
    start, duration,
    apply(u) {
      if (u >= 1) { t.state.glyphs = next; t.state.glyphStates = undefined; return; }
      stepFrame(t, plan, u);
    },
  });
  t.build.glyphs = next;
  t.equalsX = aligned.eq;
  t.tex = tex;
  return t;
}

/** A small reason written beside a step. */
function addNote(ctx: Ctx, t: Thing, text: string, start: number, side: 'right' | 'left', where: string) {
  const { world } = ctx;
  const size = TEXT_SIZES.small * 0.9;
  const box = t.buildBox();
  const probe = sheetText(ctx, world.newId('note'), text, size, [0, 0], { align: side === 'right' ? 'left' : 'right', italic: true });
  const own = probe.text!.box;
  const gap = 0.6;
  const x = side === 'right' ? box.x1 + gap - own.x0 : box.x0 - gap - own.x1;
  const y = (box.y0 + box.y1) / 2 - (own.y0 + own.y1) / 2;
  probe.base.x = probe.build.x = x;
  probe.base.y = probe.build.y = y;
  probe.base.color = world.theme.shades.grey === '#888888' ? '#b8b8b8' : world.theme.shades.grey;
  world.add(probe, where);
  arrive(ctx, probe, 'rise', start, 0.5);
  t.note = probe;
}

registerAction('steps', {
  summary: 'Change an equation into its next form; matching pieces glide to their new places.',
  params: ['who', 'to', 'as', 'match', 'pairs', 'new_line', 'note', 'note_at', 'check', 'lag', 'id', 'gap'],
  required: ['who', 'to'],
  build(ctx) {
    const { spec, world } = ctx;
    let t = world.get(spec.who, `${ctx.where}.who`);
    if (t.kind !== 'math') throw new ScriptError(`"${t.id}" is not an equation; steps works on things made with write.`, `${ctx.where}.who`);
    const list = Array.isArray(spec.to) ? spec.to : [spec.to];
    const asMath = spec.as === 'math';
    const per = ctx.duration !== undefined ? ctx.duration / list.length : 1.3 / ctx.speed;
    const lag = num(ctx, 'lag', 0.5);
    const notes = Array.isArray(spec.note) ? spec.note : spec.note !== undefined ? [spec.note] : [];
    const side = choice(spec.note_at, ['right', 'left'] as const, `${ctx.where}.note_at`, 'right');
    let start = ctx.start;
    let end = start;
    list.forEach((item, i) => {
      const where = Array.isArray(spec.to) ? `${ctx.where}.to[${i}]` : `${ctx.where}.to`;
      const tex = texOf(item, asMath, where);
      if (world.checkMaths && spec.check !== false && t.tex) { const p = checkStep(t.tex, tex); if (p) ctx.warn(`${where}: ${p} (Add "check": false if that is meant.)`); }
      const newLine = spec.new_line === true ? { id: list.length === 1 && typeof spec.id === 'string' ? spec.id : world.newIdFor(t.id), gap: spec.gap } : undefined;
      t = addStep(ctx, t, tex, start, per, { newLine, where });
      ctx.sound('click', start + per * 0.85);
      end = start + per;
      const note = notes[i];
      if (typeof note === 'string') addNote(ctx, t, note, end - per * 0.3, side, `${ctx.where}.note`);
      if (spec.key === true && i === list.length - 1) t.key = true;
      start = end + lag;
    });
    return { end, thing: t };
  },
}, ['transform']);

registerAction('rearrange', {
  summary: 'The same as steps, when only the order changes.',
  params: ['who', 'to', 'as', 'match', 'pairs'],
  required: ['who', 'to'],
  build(ctx) {
    const t = ctx.world.get(ctx.spec.who, `${ctx.where}.who`);
    const tex = texOf(ctx.spec.to, ctx.spec.as === 'math', `${ctx.where}.to`);
    const d = natural(ctx, 1.4);
    addStep(ctx, t, tex, ctx.start, d, { where: `${ctx.where}.to` });
    return { end: ctx.start + d, thing: t };
  },
});

// ---- work: a column of working ----

registerAction('work', {
  summary: 'A column of working: lines arrive in turn, lined up on "=", each with its reason.',
  params: ['lines', 'check', 'carry', 'numbered', 'fade_old', 'scroll', 'size', 'color', 'as', 'position'],
  required: ['lines'],
  build(ctx) {
    const { spec, world } = ctx;
    if (!Array.isArray(spec.lines) || !spec.lines.length) throw new ScriptError('needs "lines": a list of lines of working.', `${ctx.where}.lines`);
    const id = str(ctx, 'id') ?? world.newId('work');
    const carry = spec.carry !== false;
    const fadeOld = typeof spec.fade_old === 'number' ? clamp(spec.fade_old) : 0.5;
    const size = sizeOf(spec.size, SIZES, `${ctx.where}.size`, 'medium');
    const lines: Thing[] = [];
    let prevEnd = ctx.start;
    spec.lines.forEach((raw, i) => {
      const where = `${ctx.where}.lines[${i}]`;
      const line: Spec = typeof raw === 'string' ? { tex: raw } : (raw as Spec);
      if (!isObject(line)) throw new ScriptError('must be a line of working: { "tex": ... }.', where);
      const src = line.tex ?? line.math;
      if (src === undefined) throw new ScriptError('needs "tex" or "math".', where);
      const tex = texOf(src, line.tex === undefined, where);
      const timed = ['at_line', 'at_cue', 'then', 'after', 'with', 'at'].some((k) => line[k] !== undefined);
      const time = i === 0 ? { start: ctx.start, duration: undefined } : timed ? ctx.timeOf(line, where, prevEnd + 0.25) : { start: prevEnd + 0.25, duration: undefined };
      let t: Thing;
      let d: number;
      if (i > 0 && world.checkMaths && line.check !== false && spec.check !== false && lines[i - 1].tex) { const p = checkStep(lines[i - 1].tex!, tex); if (p) ctx.warn(`${where}: ${p} (Add "check": false if that is meant.)`); }
      if (i === 0 || !carry) {
        const at = i === 0 ? positionSpec(spec) : { below: lines[i - 1].id, align: '=' };
        t = makeMath(ctx, `${id}.${i + 1}`, tex, size, at, where);
        world.add(t, where);
        world.last = t;
        d = time.duration ?? writeTime(t.base.glyphs.length) / ctx.speed;
        arrive(ctx, t, 'write', time.start, d);
      } else {
        d = time.duration ?? 1.3 / ctx.speed;
        t = addStep(ctx, lines[i - 1], tex, time.start, d, { newLine: { id: `${id}.${i + 1}` }, where, explicit: false });
      }
      if (line.key === true) t.key = true;
      if (typeof line.note === 'string') addNote(ctx, t, line.note, time.start + d * 0.7, 'right', `${where}.note`);
      if (spec.numbered === true) {
        const n = sheetText(ctx, world.newId('num'), `${i + 1}.`, TEXT_SIZES.small, [0, 0], { align: 'right' });
        const box = t.buildBox();
        n.base.x = n.build.x = box.x0 - 0.5;
        n.base.y = n.build.y = (box.y0 + box.y1) / 2;
        n.base.color = '#9a9a9a';
        world.add(n, where);
        arrive(ctx, n, 'fade', time.start, 0.4);
      }
      // Lines above the newest fade back.
      if (i > 0 && fadeOld < 1) {
        for (const above of lines) {
          ctx.act({ start: time.start, duration: 0.5, apply(u) { above.state.opacity *= 1 - (1 - fadeOld) * ease('smooth', u); } });
        }
      }
      lines.push(t);
      prevEnd = time.start + d;
    });
    const group = new Thing(id, 'group', [], [0, 0]);
    group.members = lines;
    world.add(group, ctx.where);
    return { end: prevEnd, thing: lines[lines.length - 1] };
  },
}, ['derivation', 'column']);

// ---- drawing attention to parts ----

/** Glyph indices of `who` (with an optional `part` or "id.part"). */
function partOf(ctx: Ctx, key = 'who'): { t: Thing; idx: number[] } {
  const ref = ctx.spec[key];
  if (typeof ref !== 'string') throw new ScriptError('must name an equation, or a part of one ("eq1.mid").', `${ctx.where}.${key}`);
  const t = ctx.world.get(ref, `${ctx.where}.${key}`);
  const dot = ref.indexOf('.');
  const which = typeof ctx.spec.which === 'number' ? ctx.spec.which : undefined;
  if (typeof ctx.spec.part === 'string') return { t, idx: selectPart(t, ctx.spec.part, which, `${ctx.where}.part`) };
  if (dot > 0 && !ctx.world.things.has(ref)) return { t, idx: selectPart(t, ref.slice(dot + 1), which, `${ctx.where}.${key}`) };
  return { t, idx: t.build.glyphs.map((_, i) => i) };
}

/** Box of some glyphs in the thing's own coordinates. */
function ownBox(t: Thing, idx: number[]): Box {
  return boundsOf(idx.flatMap((i) => t.build.glyphs[i].contours));
}

function decoration(ctx: Ctx, parent: Thing, glyphs: Glyph[], layer: number, where: string): Thing {
  const d = new Thing(ctx.world.newId('deco'), 'decoration', glyphs, [0, 0]);
  d.parent = parent;
  d.layer = layer;
  ctx.world.add(d, where);
  return d;
}

const HIGHLIGHTS = ['back', 'color', 'glow', 'pulse', 'wiggle', 'underline', 'circle', 'flash'] as const;

registerAction('highlight', {
  summary: 'Draw the eye to an equation or part of one.',
  params: ['who', 'part', 'which', 'how', 'color', 'stay'],
  required: ['who'],
  build(ctx) {
    // A group (dots, a path through a tree): every member is lit.
    if (typeof ctx.spec.who === 'string' && ctx.spec.part === undefined && ctx.world.things.get(ctx.spec.who)?.kind === 'group') {
      let done: Done = { end: ctx.start };
      for (const m of ctx.world.things.get(ctx.spec.who)!.members) done = ACTIONS.get('highlight')!.build({ ...ctx, spec: { ...ctx.spec, who: m.id } });
      return done;
    }
    // A 3D object glows in the colour, then goes back (unless it stays).
    const solid = typeof ctx.spec.who === 'string' && ctx.world.space?.objects.find((o) => o.thing.id === ctx.spec.who);
    if (solid) {
      const col = color(ctx, 'color', ctx.world.theme.accent)!;
      const d = natural(ctx, 0.9);
      const stay = ctx.spec.stay === true;
      const th = solid.thing;
      ctx.act({ start: ctx.start, duration: stay ? d : d * 2.5, apply(u) { const k = stay ? ease('smooth', u) : Math.sin(Math.PI * u); th.state.color = k >= 1 ? col : `mix:${k.toFixed(3)}:${col}`; } });
      return { end: ctx.start + d };
    }
    const { t, idx } = partOf(ctx);
    const how = choice(ctx.spec.how, HIGHLIGHTS, `${ctx.where}.how`, 'back');
    const col = color(ctx, 'color', ctx.world.theme.accent)!;
    const passing = how === 'pulse' || how === 'wiggle' || how === 'flash';
    const stay = ctx.spec.stay === undefined ? !passing : ctx.spec.stay === true;
    const d = natural(ctx, passing ? 0.9 : 0.6);
    const box = ownBox(t, idx);
    const pad = 0.1;
    const end = ctx.start + d;
    const holdUntil = stay ? Infinity : end + (passing ? 0 : 0.8);
    const fadeOut = (u: number, time: number) => (time > holdUntil ? clamp(1 - (time - holdUntil) / 0.4) : 1) * u;
    const all = idx.length === t.build.glyphs.length;
    switch (how) {
      case 'back': {
        const g = fillGlyph([roundedRect(box.x0 - pad, box.y0 - pad, box.x1 + pad, box.y1 + pad, 0.08)], 'back', { color: withAlpha(col, 0.32) });
        const deco = decoration(ctx, t, [g], -1, ctx.where);
        ctx.act({ start: ctx.start, duration: d, apply(u, time) { deco.state.visible = true; deco.state.opacity *= fadeOut(ease('smooth', u), time); deco.state.sx = ease('out', u); } });
        break;
      }
      case 'color':
        ctx.act({
          start: ctx.start, duration: d,
          apply(u, time) {
            const gs = glyphStates(t);
            const k = fadeOut(ease('smooth', u), time);
            for (const i of idx) if (gs[i]) gs[i].color = k >= 1 ? col : k > 0 ? `mix:${k}:${col}` : undefined;
          },
        });
        break;
      case 'glow':
        if (all) ctx.act({ start: ctx.start, duration: d, apply(u, time) { t.state.glow = fadeOut(ease('smooth', u), time); t.state.glowColor = col; } });
        else {
          const g = fillGlyph([roundedRect(box.x0 - pad, box.y0 - pad, box.x1 + pad, box.y1 + pad, 0.12)], 'glow', { color: withAlpha(col, 0.22) });
          const deco = decoration(ctx, t, [g], -1, ctx.where);
          ctx.act({ start: ctx.start, duration: d, apply(u, time) { deco.state.visible = true; deco.state.glow = 1; deco.state.glowColor = col; deco.state.opacity *= fadeOut(ease('smooth', u), time); } });
        }
        break;
      case 'pulse':
      case 'wiggle':
        ctx.act({
          start: ctx.start, duration: d,
          apply(u) {
            if (u >= 1) return;
            const gs = glyphStates(t);
            const bump = Math.sin(Math.PI * u);
            for (const i of idx) {
              if (!gs[i]) continue;
              if (how === 'pulse') { gs[i].scale *= 1 + 0.22 * bump; gs[i].color = `mix:${bump}:${col}`; }
              else { gs[i].dy += 0.05 * Math.sin(u * Math.PI * 8) * bump; gs[i].dx += 0.03 * Math.sin(u * Math.PI * 6) * bump; }
            }
          },
        });
        break;
      case 'underline': {
        const y = box.y0 - 0.08;
        const deco = decoration(ctx, t, [strokeGlyph([line([box.x0, y], [box.x1, y])], 5, 'underline', { color: col })], 1, ctx.where);
        ctx.act({ start: ctx.start, duration: d, apply(u, time) { deco.state.visible = true; deco.state.drawn = u; deco.state.opacity *= fadeOut(1, time); } });
        break;
      }
      case 'circle': {
        const deco = decoration(ctx, t, [strokeGlyph([{ closed: false, pts: handLoop(box.x0, box.y0, box.x1, box.y1) }], 5, 'loop', { color: col })], 1, ctx.where);
        ctx.act({ start: ctx.start, duration: d, apply(u, time) { deco.state.visible = true; deco.state.drawn = u; deco.state.opacity *= fadeOut(1, time); } });
        break;
      }
      case 'flash': {
        const c = centerOf(box);
        const r = Math.max(box.x1 - box.x0, box.y1 - box.y0) / 2 + 0.2;
        const rays = Array.from({ length: 12 }, (_, k) => {
          const a = (k / 12) * Math.PI * 2;
          return line([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)], [c[0] + (r + 0.35) * Math.cos(a), c[1] + (r + 0.35) * Math.sin(a)]);
        });
        const deco = decoration(ctx, t, rays.map((ray) => strokeGlyph([ray], 4, 'ray', { color: col })), 1, ctx.where);
        ctx.act({
          start: ctx.start, duration: d,
          apply(u) {
            if (u >= 1) return;
            deco.state.visible = true;
            deco.state.drawn = 1;
            deco.state.scale = 0.8 + 0.5 * ease('out', u);
            deco.state.opacity *= Math.sin(Math.PI * u);
          },
        });
        break;
      }
    }
    return { end, thing: t };
  },
}, ['indicate', 'emphasise', 'emphasize']);

registerAction('box', {
  summary: 'A box drawn round an equation or part.',
  params: ['who', 'part', 'which', 'color', 'padding'],
  required: ['who'],
  build(ctx) {
    const { t, idx } = partOf(ctx);
    const b = ownBox(t, idx);
    const pad = num(ctx, 'padding', 0.16);
    const col = color(ctx, 'color', ctx.world.theme.accent)!;
    const deco = decoration(ctx, t, [strokeGlyph([roundedRect(b.x0 - pad, b.y0 - pad, b.x1 + pad, b.y1 + pad, 0.06)], 4, 'box', { color: col })], 1, ctx.where);
    if (ctx.spec.key === true) t.key = true;
    const d = natural(ctx, 0.9);
    ctx.act({ start: ctx.start, duration: d, apply(u) { deco.state.visible = true; deco.state.drawn = u; } });
    return { end: ctx.start + d, thing: deco };
  },
}, ['frame', 'result']);

registerAction('cancel', {
  summary: 'Strike out a part, as when things cancel.',
  params: ['who', 'part', 'which', 'how', 'to', 'vanish', 'color'],
  required: ['who'],
  build(ctx) {
    const refs = Array.isArray(ctx.spec.who) ? ctx.spec.who : [ctx.spec.who];
    const how = choice(ctx.spec.how, ['slash', 'cross', 'line'] as const, `${ctx.where}.how`, 'slash');
    const col = color(ctx, 'color', ctx.world.theme.bad)!;
    const d = natural(ctx, 0.6);
    let end = ctx.start + d;
    refs.forEach((ref, i) => {
      const sub: Ctx = { ...ctx, spec: { ...ctx.spec, who: ref }, where: Array.isArray(ctx.spec.who) ? `${ctx.where}.who[${i}]` : ctx.where };
      const { t, idx } = partOf(sub);
      const b = ownBox(t, idx);
      const e = 0.06;
      const strokes = how === 'slash'
        ? [line([b.x0 - e, b.y0 - e], [b.x1 + e, b.y1 + e])]
        : how === 'cross'
          ? [line([b.x0 - e, b.y0 - e], [b.x1 + e, b.y1 + e]), line([b.x0 - e, b.y1 + e], [b.x1 + e, b.y0 - e])]
          : [line([b.x0 - e, (b.y0 + b.y1) / 2], [b.x1 + e, (b.y0 + b.y1) / 2])];
      const deco = decoration(ctx, t, strokes.map((s) => strokeGlyph([s], 4, 'strike', { color: col })), 1, sub.where);
      const start = ctx.start + i * 0.15;
      ctx.act({ start, duration: d, apply(u) { deco.state.visible = true; deco.state.drawn = u; } });
      if (typeof ctx.spec.to === 'string') {
        const m = mathGlyphs(ctx.world, ctx.spec.to, t.size * 0.6, `${ctx.where}.to`);
        const small = new Thing(ctx.world.newId('to'), 'math', m.glyphs, [0, 0]);
        small.parent = t;
        small.base.x = small.build.x = b.x1 + 0.08;
        small.base.y = small.build.y = b.y1 + 0.12;
        small.base.color = col;
        ctx.world.add(small, `${ctx.where}.to`);
        arrive(ctx, small, 'write', start + d, 0.5);
      }
      if (ctx.spec.vanish === true) {
        // The struck pieces fade and the rest closes up.
        const gone = new Set(idx);
        // Close the gap so the pieces either side sit as far apart as the left
        // piece sat from what was struck.
        const boxes = t.build.glyphs.map((g) => boundsOf(g.contours));
        const leftEdge = Math.max(-Infinity, ...boxes.filter((g, gi) => !gone.has(gi) && g.x1 <= b.x0 + 1e-6).map((g) => g.x1));
        const rightEdge = Math.min(Infinity, ...boxes.filter((g, gi) => !gone.has(gi) && g.x0 >= b.x1 - 1e-6).map((g) => g.x0));
        const width = Number.isFinite(leftEdge) && Number.isFinite(rightEdge) ? rightEdge - leftEdge - (b.x0 - leftEdge) : b.x1 - b.x0;
        const vs = start + d + 0.3;
        ctx.act({
          start: vs, duration: 0.8,
          apply(u) {
            const k = ease('smooth', u);
            deco.state.opacity *= 1 - k;
            const gs = glyphStates(t);
            t.state.glyphs.forEach((g, gi) => {
              if (gone.has(gi)) gs[gi].opacity *= 1 - k;
              else if (boundsOf(g.contours).x0 > b.x0) gs[gi].dx -= width * k;
            });
          },
        });
        end = Math.max(end, vs + 0.8);
        // Afterwards it is the closed-up expression.
        const kept = t.build.glyphs.filter((_, gi) => !gone.has(gi)).map((g) => (boundsOf(g.contours).x0 > b.x0 ? shiftGlyphs([g], -width, 0)[0] : g));
        ctx.act({ start: vs + 0.8, duration: 0, apply() { t.state.glyphs = kept; t.state.glyphStates = undefined; deco.state.visible = false; } });
        t.build.glyphs = kept;
      }
    });
    return { end };
  },
}, ['strike', 'cross_out']);

registerAction('brace', {
  summary: 'A curly bracket under or over a part, with a note.',
  params: ['who', 'part', 'which', 'text', 'side', 'color'],
  required: ['who'],
  build(ctx) {
    const { t, idx } = partOf(ctx);
    const b = ownBox(t, idx);
    const side = choice(ctx.spec.side, ['below', 'above', 'left', 'right'] as const, `${ctx.where}.side`, 'below');
    const col = color(ctx, 'color', ctx.world.theme.ink)!;
    const g = 0.12, depth = 0.22;
    const ends: [Pt, Pt] =
      side === 'below' ? [[b.x0, b.y0 - g], [b.x1, b.y0 - g]]
        : side === 'above' ? [[b.x1, b.y1 + g], [b.x0, b.y1 + g]]
          : side === 'left' ? [[b.x0 - g, b.y0], [b.x0 - g, b.y1]]
            : [[b.x1 + g, b.y1], [b.x1 + g, b.y0]];
    const pts = bracePts(ends[0], ends[1], depth);
    const deco = decoration(ctx, t, [strokeGlyph([{ closed: false, pts }], 4, 'brace', { color: col })], 1, ctx.where);
    const d = natural(ctx, 0.8);
    ctx.act({ start: ctx.start, duration: d, apply(u) { deco.state.visible = true; deco.state.drawn = u; } });
    const text = str(ctx, 'text');
    if (text) {
      const label = sheetText(ctx, ctx.world.newId('brace'), text, TEXT_SIZES.small, [0, 0], { color: col });
      label.parent = t;
      const lb = label.text!.box;
      const mid = pts[Math.floor(pts.length / 2)];
      const off = depth + 0.12;
      const p: Pt = side === 'below' ? [mid[0], mid[1] - off * 0.4 - lb.y1]
        : side === 'above' ? [mid[0], mid[1] + off * 0.4 - lb.y0]
          : side === 'left' ? [mid[0] - off * 0.4 - lb.x1, mid[1]] : [mid[0] + off * 0.4 - lb.x0, mid[1]];
      label.base.x = label.build.x = p[0];
      label.base.y = label.build.y = p[1];
      ctx.world.add(label, `${ctx.where}.text`);
      arrive(ctx, label, 'rise', ctx.start + d * 0.6, 0.5);
    }
    return { end: ctx.start + d + (text ? 0.3 : 0), thing: deco };
  },
}, ['underbrace', 'overbrace']);

registerAction('label_part', {
  summary: 'A short note pointing at a part with a thin arrow.',
  params: ['who', 'part', 'which', 'text', 'side', 'color'],
  required: ['who', 'text'],
  build(ctx) {
    const { t, idx } = partOf(ctx);
    const b = ownBox(t, idx);
    const side = choice(ctx.spec.side, ['above', 'below', 'left', 'right'] as const, `${ctx.where}.side`, 'above');
    const col = color(ctx, 'color', ctx.world.theme.accent)!;
    const label = sheetText(ctx, ctx.world.newId('note'), str(ctx, 'text', true)!, TEXT_SIZES.small, [0, 0], { color: col });
    label.parent = t;
    const lb = label.text!.box;
    const c = centerOf(b);
    const reach = 0.75;
    const at: Pt = side === 'above' ? [c[0], b.y1 + reach - lb.y0] : side === 'below' ? [c[0], b.y0 - reach - lb.y1]
      : side === 'left' ? [b.x0 - reach - lb.x1, c[1]] : [b.x1 + reach - lb.x0, c[1]];
    label.base.x = label.build.x = at[0];
    label.base.y = label.build.y = at[1];
    ctx.world.add(label, ctx.where);
    const from: Pt = side === 'above' ? [c[0], at[1] + lb.y0 - 0.05] : side === 'below' ? [c[0], at[1] + lb.y1 + 0.05]
      : side === 'left' ? [at[0] + lb.x1 + 0.05, c[1]] : [at[0] + lb.x0 - 0.05, c[1]];
    const to: Pt = side === 'above' ? [c[0], b.y1 + 0.06] : side === 'below' ? [c[0], b.y0 - 0.06]
      : side === 'left' ? [b.x0 - 0.06, c[1]] : [b.x1 + 0.06, c[1]];
    const head = arrowTip(from, to, 0.14);
    const deco = decoration(ctx, t, [strokeGlyph([line(from, to)], 3, 'pointer', { color: col }), fillGlyph([head], 'tip', { color: col })], 1, ctx.where);
    const d = natural(ctx, 0.7);
    arrive(ctx, label, 'rise', ctx.start, 0.5);
    ctx.act({ start: ctx.start + 0.2, duration: d, apply(u) { deco.state.visible = true; deco.state.drawn = u; } });
    return { end: ctx.start + 0.2 + d, thing: label };
  },
}, ['annotate']);

function arrowTip(from: Pt, to: Pt, size: number) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const w = size * 0.5;
  const back: Pt = [to[0] - size * Math.cos(a), to[1] - size * Math.sin(a)];
  return { closed: true, pts: [to, [back[0] + w * Math.sin(a), back[1] - w * Math.cos(a)], [back[0] - w * Math.sin(a), back[1] + w * Math.cos(a)]] as Pt[] };
}

// ---- substitute ----

registerAction('substitute', {
  summary: 'Values lift in and take the place of letters, everywhere they appear.',
  params: ['who', 'put', 'keep', 'id'],
  required: ['who', 'put'],
  build(ctx) {
    const { spec, world } = ctx;
    const t = world.get(spec.who, `${ctx.where}.who`);
    if (t.kind !== 'math' || !t.tex) throw new ScriptError(`"${t.id}" is not an equation.`, `${ctx.where}.who`);
    if (!isObject(spec.put)) throw new ScriptError('must be { "letter": "value" }, such as { "a": "3" }.', `${ctx.where}.put`);
    let tex = t.tex;
    for (const [letter, value] of Object.entries(spec.put)) {
      if (!/^\\?[a-zA-Z]+$/.test(letter)) throw new ScriptError(`"${letter}" must be a letter or a symbol such as "\\\\pi".`, `${ctx.where}.put`);
      // Split the LaTeX into commands (\\frac, \\pi) and single characters, and
      // swap whole tokens only, so "a" never matches inside "\\frac".
      const tokens: string[] = tex.match(/\\[a-zA-Z]+|\\.|[\s\S]/g) ?? [];
      if (!tokens.includes(letter)) throw new ScriptError(`"${letter}" does not appear in "${t.id}".`, `${ctx.where}.put`);
      const v = String(value);
      const wrapped = /^-/.test(v) ? `(${v})` : v;
      const out: string[] = [];
      tokens.forEach((tok, k) => {
        if (tok !== letter) { out.push(tok); return; }
        const before = out.join('').trimEnd();
        const after = tokens.slice(k + 1).join('').trimStart();
        // A number written next to another number or letter needs a sign: 2ab becomes 2·3·4.
        const needBefore = /[0-9a-zA-Z})]$/.test(before) && !/\\[a-zA-Z]+$/.test(before);
        const needAfter = /^[0-9a-zA-Z(]/.test(after) || /^\\(?!cdot|times|right|end|le|ge|ne)[a-zA-Z]/.test(after);
        out.push(`${needBefore ? ' \\cdot ' : ''}${wrapped}${needAfter ? ' \\cdot ' : ''}`);
      });
      tex = out.join('');
    }
    const d = natural(ctx, 1.4);
    const out = addStep(ctx, t, tex, ctx.start, d, {
      where: ctx.where, outShift: [0, 0.5], inShift: [0, 0.5], explicit: false, neighbours: false,
      newLine: spec.keep === true ? { id: typeof spec.id === 'string' ? spec.id : world.newIdFor(t.id) } : undefined,
    });
    return { end: ctx.start + d, thing: out };
  },
}, ['plug_in']);

// ---- pull_out ----

registerAction('pull_out', {
  summary: 'A copy of a part lifts out of the equation and goes somewhere else.',
  params: ['who', 'part', 'which', 'to', 'id'],
  required: ['who', 'id'],
  build(ctx) {
    const { t, idx } = partOf(ctx);
    const pieces = idx.map((i) => t.build.glyphs[i]);
    const b = boundsOf(pieces.flatMap((g) => g.contours));
    const c = centerOf(b);
    const glyphs = shiftGlyphs(pieces, -c[0], -c[1]);
    const from: Pt = [t.build.x + c[0] * t.build.scale, t.build.y + c[1] * t.build.scale];
    const own = localBox(glyphs);
    const to = ctx.world.placeAt(ctx.spec.to ?? { below: t.id, gap: 'large' }, own, `${ctx.where}.to`);
    const n = new Thing(str(ctx, 'id', true)!, 'math', glyphs, to);
    n.size = t.size;
    n.tex = undefined;
    n.base.color = t.base.color;
    ctx.world.add(n, ctx.where);
    ctx.world.last = n;
    const d = natural(ctx, 1.1);
    ctx.act({
      start: ctx.start, duration: d,
      apply(u) {
        const e = ease('smooth', u);
        n.state.visible = true;
        n.state.x = from[0] + (to[0] - from[0]) * e;
        n.state.y = from[1] + (to[1] - from[1]) * e + 0.5 * Math.sin(Math.PI * u);
      },
    });
    return { end: ctx.start + d, thing: n };
  },
}, ['copy_part', 'lift']);

// ---- colour ----

registerAction('color', {
  summary: 'Change colour over the beat.',
  params: ['who', 'part', 'which', 'to'],
  required: ['who', 'to'],
  build(ctx) {
    const col = color(ctx, 'to')!;
    const d = natural(ctx, 0.6);
    const ref = ctx.spec.who;
    if (typeof ref === 'string' && (ctx.spec.part !== undefined || (ref.includes('.') && !ctx.world.things.has(ref)))) {
      const { t, idx } = partOf(ctx);
      ctx.act({
        start: ctx.start, duration: d,
        apply(u) {
          const gs = glyphStates(t);
          const k = ease('smooth', u);
          for (const i of idx) if (gs[i]) gs[i].color = k >= 1 ? col : `mix:${k}:${col}`;
        },
      });
      for (const i of idx) t.build.glyphs[i] = { ...t.build.glyphs[i], color: col };
      return { end: ctx.start + d };
    }
    for (const t of things(ctx)) {
      ctx.act({
        start: ctx.start, duration: d,
        apply(u) {
          const k = ease('smooth', u);
          t.state.color = k >= 1 ? col : `mix:${k}:${col}`;
          if (k >= 1) t.state.glyphs = t.state.glyphs.map((g) => ({ ...g, color: undefined }));
        },
      });
    }
    return { end: ctx.start + d };
  },
}, ['recolor', 'paint']);

registerAction('swap', {
  summary: 'Two parts change places, each travelling round the other.',
  params: ['who', 'parts'],
  required: ['who', 'parts'],
  build(ctx) {
    const t = ctx.world.get(ctx.spec.who, `${ctx.where}.who`);
    const ps = ctx.spec.parts;
    if (!Array.isArray(ps) || ps.length !== 2) throw new ScriptError('must be a list of two parts.', `${ctx.where}.parts`);
    const sel = (p: unknown, i: number) => {
      const name = String(p).startsWith(`${t.id}.`) ? String(p).slice(t.id.length + 1) : String(p);
      return selectPart(t, name, undefined, `${ctx.where}.parts[${i}]`);
    };
    const a = sel(ps[0], 0), b = sel(ps[1], 1);
    const ba = ownBox(t, a), bb = ownBox(t, b);
    // Each part moves by the difference of their left edges, adjusted for widths.
    const wa = ba.x1 - ba.x0, wb = bb.x1 - bb.x0;
    const [left, right] = ba.x0 < bb.x0 ? [a, b] : [b, a];
    const [lb, rb] = ba.x0 < bb.x0 ? [ba, bb] : [bb, ba];
    const shiftLeft = rb.x1 - lb.x1, shiftRight = lb.x0 - rb.x0;
    const between = t.build.glyphs.map((g, i) => i).filter((i) => !left.includes(i) && !right.includes(i) && boundsOf(t.build.glyphs[i].contours).x0 >= lb.x1 && boundsOf(t.build.glyphs[i].contours).x1 <= rb.x0);
    const midShift = (ba.x0 < bb.x0 ? wb - wa : wa - wb);
    const d = natural(ctx, 1.2);
    const lift = t.size * 0.8;
    ctx.act({
      start: ctx.start, duration: d,
      apply(u) {
        const gs = glyphStates(t);
        const e = ease('smooth', u);
        if (u >= 1) return;
        for (const i of left) { gs[i].dx += shiftLeft * e; gs[i].dy += lift * Math.sin(Math.PI * u); }
        for (const i of right) { gs[i].dx += shiftRight * e; gs[i].dy -= lift * Math.sin(Math.PI * u); }
        for (const i of between) gs[i].dx += midShift * e;
      },
    });
    const moved = t.build.glyphs.map((g, i) =>
      left.includes(i) ? shiftGlyphs([g], shiftLeft, 0)[0] : right.includes(i) ? shiftGlyphs([g], shiftRight, 0)[0] : between.includes(i) ? shiftGlyphs([g], midShift, 0)[0] : g);
    ctx.act({ start: ctx.start + d, duration: 0, apply() { t.state.glyphs = moved; t.state.glyphStates = undefined; } });
    t.build.glyphs = moved;
    return { end: ctx.start + d };
  },
});
