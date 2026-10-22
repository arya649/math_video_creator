// Moving things and drawing attention to them.

import { type Ctx, type Spec, glyphStates, natural, num, registerAction, str, things } from '../actions';
import { ACTIONS } from '../actions';
import { type Pt, centerOf } from '../geom';
import { matchGlyphs, morphAt, planMorph, type MorphPlan, type Pair } from '../match';
import { type Glyph, Thing, localBox, shiftGlyphs } from '../thing';
import { EASES, ScriptError, choice, clamp, ease, isObject } from '../util';

const readEase = (ctx: Ctx) => choice(ctx.spec.ease, EASES, `${ctx.where}.ease`, 'smooth');

registerAction('move', {
  summary: 'Move something to a new place.',
  params: ['who', 'to', 'by', 'path', 'ease'],
  required: ['who'],
  build(ctx) {
    const list = things(ctx);
    const kind = ctx.spec.path;
    const d = natural(ctx, 1);
    const e = readEase(ctx);
    for (const t of list) {
      const from: Pt = [t.build.x, t.build.y];
      let to: Pt;
      if (ctx.spec.by !== undefined) {
        const by = ctx.spec.by;
        if (!Array.isArray(by) || by.length !== 2) throw new ScriptError('must be [right, up], such as [2, 0].', `${ctx.where}.by`);
        to = [from[0] + Number(by[0]), from[1] + Number(by[1])];
      } else if (ctx.spec.to !== undefined) {
        if (list.length > 1) {
          // A group moves as one: its box goes to the place.
          const box = list.map((m) => m.buildBox()).reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
          const c = centerOf(box);
          const own = { x0: box.x0 - c[0], x1: box.x1 - c[0], y0: box.y0 - c[1], y1: box.y1 - c[1] };
          const p = ctx.world.placeAt(ctx.spec.to, own, `${ctx.where}.to`);
          to = [from[0] + p[0] - c[0], from[1] + p[1] - c[1]];
        } else {
          const b = t.buildBox();
          const own = { x0: b.x0 - t.build.x, x1: b.x1 - t.build.x, y0: b.y0 - t.build.y, y1: b.y1 - t.build.y };
          to = ctx.world.placeAt(ctx.spec.to, own, `${ctx.where}.to`, t.equalsX);
        }
      } else throw new ScriptError('needs "to" (a position) or "by" ([right, up]).', ctx.where);
      let via: Pt[] = [];
      let arc = 0;
      if (Array.isArray(kind)) via = kind.map((p, i) => ctx.world.point(p, `${ctx.where}.path[${i}]`));
      else {
        const k = choice(kind, ['straight', 'arc', 'arc_left', 'arc_right'] as const, `${ctx.where}.path`, 'straight');
        arc = k === 'straight' ? 0 : k === 'arc_right' ? -0.35 : 0.35;
      }
      const pts = [from, ...via, to];
      ctx.act({
        start: ctx.start, duration: d,
        apply(u) {
          const k = ease(e, u);
          const p = along(pts, k);
          const nx = -(to[1] - from[1]), ny = to[0] - from[0];
          const bump = arc * Math.sin(Math.PI * clamp(k));
          t.state.x += p[0] - from[0] + nx * bump;
          t.state.y += p[1] - from[1] + ny * bump;
        },
      });
      t.build.x = to[0];
      t.build.y = to[1];
      t.base = { ...t.base };
    }
    if (list.length === 1 && !list[0].screen) ctx.world.last = list[0];
    return { end: ctx.start + d };
  },
}, ['shift', 'go']);

function along(pts: Pt[], u: number): Pt {
  if (pts.length === 2) return [pts[0][0] + (pts[1][0] - pts[0][0]) * u, pts[0][1] + (pts[1][1] - pts[0][1]) * u];
  const n = pts.length - 1;
  const f = clamp(u) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const k = f - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
}

registerAction('turn', {
  summary: 'Turn something round by degrees (anticlockwise).',
  params: ['who', 'by', 'around', 'ease'],
  required: ['who', 'by'],
  build(ctx) {
    const by = (num(ctx, 'by', 90) * Math.PI) / 180;
    const d = natural(ctx, 1);
    const e = readEase(ctx);
    for (const t of things(ctx)) {
      const pivot = ctx.spec.around !== undefined ? ctx.world.point(ctx.spec.around, `${ctx.where}.around`) : [t.build.x, t.build.y] as Pt;
      const ox = t.build.x - pivot[0], oy = t.build.y - pivot[1];
      ctx.act({
        start: ctx.start, duration: d,
        apply(u) {
          const a = by * ease(e, u);
          t.state.rotation += a;
          t.state.x += ox * Math.cos(a) - oy * Math.sin(a) - ox;
          t.state.y += ox * Math.sin(a) + oy * Math.cos(a) - oy;
        },
      });
      t.build.x = pivot[0] + ox * Math.cos(by) - oy * Math.sin(by);
      t.build.y = pivot[1] + ox * Math.sin(by) + oy * Math.cos(by);
    }
    return { end: ctx.start + d };
  },
}, ['rotate_by']);

registerAction('scale', {
  summary: 'Grow or shrink something to that many times its size.',
  params: ['who', 'to', 'around', 'ease'],
  required: ['who', 'to'],
  build(ctx) {
    const to = num(ctx, 'to', 1);
    if (to <= 0) throw new ScriptError('must be more than 0.', `${ctx.where}.to`);
    const d = natural(ctx, 0.8);
    const e = readEase(ctx);
    for (const t of things(ctx)) {
      const s0 = t.build.scale;
      const pivot = ctx.spec.around !== undefined ? ctx.world.point(ctx.spec.around, `${ctx.where}.around`) : [t.build.x, t.build.y] as Pt;
      const ox = t.build.x - pivot[0], oy = t.build.y - pivot[1];
      ctx.act({
        start: ctx.start, duration: d,
        apply(u) {
          const k = 1 + (to / s0 - 1) * ease(e, u);
          t.state.scale *= k;
          t.state.x += ox * (k - 1);
          t.state.y += oy * (k - 1);
        },
      });
      t.build.scale = to;
      t.build.x = pivot[0] + ox * (to / s0);
      t.build.y = pivot[1] + oy * (to / s0);
    }
    return { end: ctx.start + d };
  },
}, ['resize']);

registerAction('flip', {
  summary: 'A mirror flip.',
  params: ['who', 'axis'],
  required: ['who'],
  build(ctx) {
    const axis = choice(ctx.spec.axis, ['vertical', 'horizontal'] as const, `${ctx.where}.axis`, 'vertical');
    const d = natural(ctx, 0.8);
    for (const t of things(ctx)) {
      ctx.act({
        start: ctx.start, duration: d,
        apply(u) {
          const k = Math.cos(Math.PI * ease('smooth', u));
          if (axis === 'vertical') t.state.sx *= k; else t.state.sy *= k;
        },
      });
    }
    return { end: ctx.start + d };
  },
});

registerAction('wobble', {
  summary: 'A quick jelly-like shake.',
  params: ['who'],
  required: ['who'],
  build(ctx) {
    const d = natural(ctx, 0.7);
    for (const t of things(ctx)) {
      ctx.act({
        start: ctx.start, duration: d,
        apply(u) {
          if (u >= 1) return;
          const w = Math.sin(u * Math.PI * 5) * (1 - u) * 0.14;
          t.state.sx *= 1 + w;
          t.state.sy *= 1 - w;
        },
      });
    }
    return { end: ctx.start + d };
  },
}, ['spring']);

// ---- show, hide, remove ----

const GOES = ['fade', 'shrink', 'undraw', 'rub', 'fall'] as const;

function vanish(ctx: Ctx, keep: boolean) {
  const how = choice(ctx.spec.how, GOES, `${ctx.where}.how`, 'fade');
  const d = natural(ctx, 0.6);
  for (const t of things(ctx)) {
    ctx.act({
      start: ctx.start, duration: d,
      apply(u) {
        const e = ease('smooth', u);
        if (u >= 1) { t.state.visible = false; return; }
        switch (how) {
          case 'shrink': t.state.scale *= 1 - e; break;
          case 'undraw': t.state.drawn = Math.min(t.state.drawn, 1 - u); t.state.drawStyle = t.kind === 'math' ? 'write' : 'draw'; break;
          case 'rub': t.state.drawn = Math.min(t.state.drawn, 1 - u); t.state.drawStyle = 'reveal'; break;
          case 'fall': t.state.y -= 6 * e * e; t.state.rotation -= 0.4 * e; break;
          default: t.state.opacity *= 1 - e;
        }
      },
    });
    if (!keep) t.build.visible = false;
    if (ctx.world.last === t) ctx.world.last = undefined;
  }
  return { end: ctx.start + d };
}

registerAction('remove', { summary: 'Take something away.', params: ['who', 'how'], required: ['who'], build: (ctx) => vanish(ctx, false) }, ['disappear', 'erase']);
registerAction('hide', { summary: 'Fade something out but keep it, to show again.', params: ['who', 'how'], required: ['who'], build: (ctx) => vanish(ctx, true) });

registerAction('show', {
  summary: 'Reveal something made hidden, or hidden with hide.',
  params: ['who'],
  required: ['who'],
  build(ctx) {
    const d = natural(ctx, 0.6);
    for (const t of things(ctx)) {
      ctx.act({ start: ctx.start, duration: d, apply(u) { t.state.visible = true; t.state.opacity *= ease('smooth', u); t.state.drawn = 1; } });
    }
    return { end: ctx.start + d };
  },
}, ['reveal']);

// ---- focus ----

registerAction('focus', {
  summary: 'Everything except the things named fades back.',
  params: ['on', 'dim'],
  required: ['on'],
  build(ctx) {
    const dim = num(ctx, 'dim', 0.75);
    const refs = Array.isArray(ctx.spec.on) ? ctx.spec.on : [ctx.spec.on];
    const keep = new Set<Thing>();
    const parts = new Map<Thing, Set<number>>();
    refs.forEach((ref, i) => {
      const where = Array.isArray(ctx.spec.on) ? `${ctx.where}.on[${i}]` : `${ctx.where}.on`;
      const t = ctx.world.get(ref, where);
      keep.add(t);
      for (const m of t.members) keep.add(m);
      const r = String(ref);
      const dot = r.indexOf('.');
      if (dot > 0 && !ctx.world.things.has(r) && t.kind === 'math') {
        const idx = selectFrom(t, r.slice(dot + 1), where);
        parts.set(t, new Set([...(parts.get(t) ?? []), ...idx]));
      }
    });
    const d = ctx.duration ?? (ctx.lineEnd !== undefined ? Math.max(1, ctx.lineEnd - ctx.start) : 3);
    const others = () => ctx.world.order.filter((t) => !keep.has(t) && !(t.parent && keep.has(t.parent)) && !t.screen);
    ctx.act({
      start: ctx.start, duration: d,
      apply(u, time) {
        const rise = clamp((time - ctx.start) / 0.4), fall = clamp((ctx.start + d - time) / 0.4);
        const k = dim * ease('smooth', Math.min(rise, fall));
        if (u >= 1) return;
        for (const t of others()) t.state.dim = Math.max(t.state.dim, k);
        for (const [t, idx] of parts) {
          const gs = glyphStates(t);
          gs.forEach((g, i) => { if (!idx.has(i)) g.opacity *= 1 - k; });
        }
      },
    });
    return { end: ctx.start + d };
  },
}, ['dim_others', 'spotlight']);

import { selectPart } from '../world';
const selectFrom = (t: Thing, part: string, where: string) => selectPart(t, part, undefined, where);

// ---- copy, group, morph ----

registerAction('copy', {
  summary: 'A copy slides out of the original to a new place.',
  params: ['who', 'to', 'id'],
  required: ['who', 'id'],
  build(ctx) {
    const src = ctx.world.get(ctx.spec.who, `${ctx.where}.who`);
    const id = str(ctx, 'id', true)!;
    const b = src.buildBox();
    const own = { x0: b.x0 - src.build.x, x1: b.x1 - src.build.x, y0: b.y0 - src.build.y, y1: b.y1 - src.build.y };
    const to = ctx.spec.to !== undefined ? ctx.world.placeAt(ctx.spec.to, own, `${ctx.where}.to`, src.equalsX) : [src.build.x + 1, src.build.y - 1] as Pt;
    const t = new Thing(id, src.kind === 'group' ? 'shape' : src.kind, src.build.glyphs, to);
    t.text = src.text; t.tex = src.tex; t.size = src.size; t.equalsX = src.equalsX; t.spots = { ...src.spots };
    t.base.color = src.base.color;
    t.build.scale = src.build.scale;
    t.base.scale = src.build.scale;
    ctx.world.add(t, ctx.where);
    const from: Pt = [src.build.x, src.build.y];
    const d = natural(ctx, 1);
    ctx.act({
      start: ctx.start, duration: d,
      apply(u) {
        const e = ease('smooth', u);
        t.state.visible = true;
        t.state.x = from[0] + (to[0] - from[0]) * e;
        t.state.y = from[1] + (to[1] - from[1]) * e;
      },
    });
    ctx.world.last = t;
    return { end: ctx.start + d, thing: t };
  },
});

registerAction('group', {
  summary: 'Several things named as one, to move, colour or remove together.',
  params: ['who', 'id'],
  required: ['who', 'id'],
  build(ctx) {
    const members = things(ctx);
    const g = new Thing(str(ctx, 'id', true)!, 'group', [], [0, 0]);
    g.members = members;
    ctx.world.add(g, ctx.where);
    return { end: ctx.start };
  },
});

registerAction('morph', {
  summary: 'Any shape melts into any other.',
  params: ['who', 'into', 'keep'],
  required: ['who', 'into'],
  build(ctx) {
    const a = ctx.world.get(ctx.spec.who, `${ctx.where}.who`);
    const d = natural(ctx, 1.4);
    let b: Thing;
    const into = ctx.spec.into;
    if (typeof into === 'string') b = ctx.world.get(into, `${ctx.where}.into`);
    else if (isObject(into)) {
      const spec: Spec = { ...(into as Spec), appear: 'none' };
      if (typeof spec.do !== 'string' || !ACTIONS.has(spec.do)) throw new ScriptError('must describe what to become, such as { "do": "draw", "shape": "circle" }, or name a thing.', `${ctx.where}.into`);
      const made = ctx.buildNested(spec, `${ctx.where}.into`, ctx.start + d);
      if (!made.thing) throw new ScriptError('must make one thing to become.', `${ctx.where}.into`);
      b = made.thing;
    } else throw new ScriptError('must be an id, or a description of a new thing.', `${ctx.where}.into`);
    if (a.text || b.text) throw new ScriptError('words cannot be morphed yet; write them as maths with \\text{...}.', ctx.where);
    // Bring b's outlines into a's own coordinates (as built).
    const s = a.build.scale || 1;
    const dx = (b.build.x - a.build.x) / s, dy = (b.build.y - a.build.y) / s;
    const target = shiftGlyphs(b.build.glyphs.map((g) => ({ ...g, contours: g.contours.map((c) => ({ closed: c.closed, pts: c.pts.map(([x, y]) => [x * b.build.scale / s, y * b.build.scale / s] as [number, number]) })) })), dx, dy);
    const source = a.build.glyphs;
    const pairs: Pair[] = a.kind === 'math' && b.kind === 'math'
      ? matchGlyphs(source, target)
      : pairByIndex(source.length, target.length);
    const plans: (MorphPlan | undefined)[] = pairs.map((p) => (p.from !== undefined && p.to !== undefined ? planMorph(source[p.from], target[p.to]) : undefined));
    // Things with no partner morph into (or out of) the other's middle.
    const ca = centerOf(localBox(source)), cb = centerOf(localBox(target));
    const dot = (c: Pt): Glyph => ({ contours: [{ closed: true, pts: [[c[0], c[1]], [c[0] + 0.001, c[1]], [c[0], c[1] + 0.001]] }], fill: true, stroke: false, key: 'dot', parts: [] });
    const keep = ctx.spec.keep === true;
    const end = ctx.start + d;
    ctx.act({
      start: ctx.start, duration: d,
      apply(u) {
        if (u >= 1) { if (!keep) a.state.visible = false; return; }
        const e = ease('smooth', u);
        const gs: Glyph[] = [];
        pairs.forEach((p, k) => {
          if (plans[k]) gs.push(morphAt(source[p.from!], target[p.to!], plans[k]!, e));
          else if (p.from !== undefined) gs.push(morphAt(source[p.from], dot(cb), planMorph(source[p.from], dot(cb)), e));
          else gs.push(morphAt(dot(ca), target[p.to!], planMorph(dot(ca), target[p.to!]), e));
        });
        a.state.glyphs = gs;
        a.state.glyphStates = undefined;
        if (b.base.color && a.base.color !== b.base.color) a.state.color = `mix:${e}:${b.base.color}`;
      },
    });
    if (!keep) a.build.visible = false;
    // b appears exactly as the morph ends.
    ctx.act({ start: end, duration: 0, apply() { b.state.visible = true; } });
    ctx.world.last = b;
    return { end, thing: b };
  },
}, ['become', 'transform_shape']);

function pairByIndex(n: number, m: number): Pair[] {
  const out: Pair[] = [];
  for (let k = 0; k < Math.max(n, m); k++) out.push({ from: k < n ? k : undefined, to: k < m ? k : undefined });
  return out;
}
