// Teaching tools: holding the video still for the viewer, questions and
// answers, mistakes put right, ticks and crosses, definition cards, a step
// counter, the recap and side-by-side comparisons.

import { type Ctx, type Done, arrive, color, num, registerAction, sheetText, str, things } from '../actions';
import { type Box, type Pt } from '../geom';
import { numberGlyphs } from '../graph/axes';
import { strokeGlyph } from '../shapes';
import { Thing } from '../thing';
import { withAlpha } from '../color';
import { ScriptError, choice, clamp, isObject } from '../util';
import { SCREEN_PLACES, type SceneWorld } from '../world';
import { liveThing } from './graph';
import { type Row, leaveAt, makePanel, placePanel, stayEnd, widenPanel } from './panels';

const LETTERS = 'ABCDEFGH';

// ---- wait ----

/** Hold the whole video still at `at` for `length` seconds, with a countdown ring. */
function holdHere(ctx: Ctx, at: number, length: number, countdown: boolean, words?: string) {
  const { world } = ctx;
  if (!(length > 0)) throw new ScriptError('the wait must be a number of seconds above 0.', `${ctx.where}.wait`);
  if (length > 120) ctx.warn(`a wait of ${length} seconds is very long; viewers can pause the video themselves.`);
  world.waits.push({ at, length });
  if (!countdown) return;
  const W = world.frameW / 2, H = world.frameH / 2;
  const c: Pt = [W - 1.3, -H + 1.6];
  const r = 0.42;
  const ink = world.theme.ink, accent = world.theme.accent;
  const holding = () => world.hold !== undefined && Math.abs(world.hold.at - at) < 1e-6;
  const ring = liveThing(ctx, world.newId('countdown'), (t) => {
    if (t !== Infinity && !holding()) return [];
    const u = t === Infinity ? 0 : world.hold!.u;
    const left = Math.max(1, Math.ceil(length * (1 - u) - 1e-6));
    const arc: Pt[] = [];
    for (let i = 0; i <= 64; i++) { const a = Math.PI / 2 - (1 - u) * 2 * Math.PI * (i / 64); arc.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    return [
      strokeGlyph([{ closed: true, pts: Array.from({ length: 64 }, (_, i) => [c[0] + r * Math.cos((i / 64) * Math.PI * 2), c[1] + r * Math.sin((i / 64) * Math.PI * 2)] as Pt) }], 5, 'track', { color: withAlpha(ink, 0.18) }),
      strokeGlyph([{ closed: false, pts: arc }], 5, 'ring', { color: accent }),
      ...numberGlyphs(String(left), c, 'center', 0.4, ink, ''),
    ];
  }, ctx.where);
  ring.screen = true;
  ring.layer = 6;
  ctx.act({ start: at, duration: 0, apply() { ring.state.visible = holding(); } });
  if (words) {
    const label = sheetText(ctx, world.newId('pause'), words, 0.26, [c[0], c[1] - r - 0.3], { color: withAlpha(ink, 0.75) });
    label.screen = true;
    label.layer = 6;
    world.add(label, ctx.where);
    ctx.act({ start: at, duration: 0, apply() { label.state.visible = holding(); } });
  }
  ctx.sound('tick', at);
}

registerAction('wait', {
  summary: 'Hold the whole video still (picture and voice) while the viewer thinks.',
  params: ['for', 'countdown', 'text'],
  build(ctx) {
    const length = num(ctx, 'for', 5);
    holdHere(ctx, ctx.start, length, ctx.spec.countdown !== false, typeof ctx.spec.text === 'string' ? ctx.spec.text : undefined);
    return { end: ctx.start };
  },
}, ['pause', 'think']);

// ---- question and answer ----

/** A mark drawn at a point: a tick or a cross. */
function markGlyphs(kind: 'tick' | 'cross', c: Pt, s: number, col: string) {
  const pts: Pt[][] = kind === 'tick'
    ? [[[c[0] - s, c[1]], [c[0] - s * 0.3, c[1] - s * 0.7], [c[0] + s, c[1] + s * 0.8]]]
    : [[[c[0] - s, c[1] - s], [c[0] + s, c[1] + s]], [[c[0] - s, c[1] + s], [c[0] + s, c[1] - s]]];
  return [strokeGlyph(pts.map((p) => ({ closed: false, pts: p })), 7, kind, { color: col })];
}

function placeName(ctx: Ctx, fallback: string): string {
  const p = ctx.spec.position ?? fallback;
  if (typeof p !== 'string' || !(SCREEN_PLACES as readonly string[]).includes(p)) throw new ScriptError(`must be one of ${SCREEN_PLACES.join(', ')}.`, `${ctx.where}.position`);
  return p;
}

registerAction('question', {
  summary: 'Ask the viewer; holds the video with a countdown so they can try.',
  params: ['text', 'tex', 'choices', 'hint', 'wait', 'countdown', 'position', 'stay'],
  build(ctx) {
    const { world, spec } = ctx;
    if (spec.text === undefined && spec.tex === undefined) throw new ScriptError('needs "text" (the question), or "tex".', ctx.where);
    if (spec.choices !== undefined && (!Array.isArray(spec.choices) || spec.choices.length < 2 || spec.choices.length > 8)) throw new ScriptError('must be a list of 2 to 8 choices.', `${ctx.where}.choices`);
    const ink = world.theme.onSurface;
    const rows: Row[] = [{ text: 'QUESTION', size: 0.24, color: world.theme.accent, weight: 600 }];
    if (typeof spec.text === 'string') rows.push({ text: spec.text, size: 0.4, color: ink, weight: 600 });
    if (typeof spec.tex === 'string') rows.push({ tex: spec.tex, size: 0.5, color: ink });
    const first = rows.length;
    const choices = (spec.choices as unknown[] | undefined) ?? [];
    choices.forEach((c, i) => {
      const s = String(c);
      rows.push(/^\$.*\$$/.test(s) || /\\/.test(s) ? { tex: `\\text{${LETTERS[i]}.}\\;\\; ${s.replace(/^\$|\$$/g, '')}`, size: 0.4, color: ink, gap: 0.2 } : { text: `${LETTERS[i]}.  ${s}`, size: 0.34, color: ink, gap: 0.2 });
    });
    const id = str(ctx, 'id') ?? world.newId('question');
    const panel = makePanel(ctx, id, rows, { bar: world.theme.accent, place: placeName(ctx, 'top') });
    const choiceThings = panel.members.slice(first);
    arrive(ctx, panel, 'rise', ctx.start, 0.5);
    ctx.sound('chime', ctx.start);
    choiceThings.forEach((th, i) => { th.base.visible = false; arrive(ctx, th, 'fade', ctx.start + 0.5 + i * 0.25, 0.35); });
    const shown = ctx.start + 0.6 + choiceThings.length * 0.25;
    // The hold: after the narration line it is asked in, or as soon as it is shown.
    const waitAt = Math.max(shown, ctx.lineEnd ?? 0);
    const wait = spec.wait === false ? 0 : typeof spec.wait === 'number' ? spec.wait : 5;
    const extra: Thing[] = [];
    if (wait > 0) holdHere(ctx, waitAt, wait, spec.countdown !== false, 'Pause and try');
    if (typeof spec.hint === 'string') {
      const b = panel.buildBox();
      const hint = sheetText(ctx, `${id}.hint`, `Hint: ${spec.hint}`, 0.3, [(b.x0 + b.x1) / 2, b.y0 - 0.35], { color: world.theme.accent, italic: true });
      hint.screen = true;
      world.add(hint, ctx.where);
      // From halfway through the hold (or straight after the question when there is none).
      ctx.act({ start: waitAt, duration: 0, apply(_u, t) {
        const h = world.hold;
        const on = wait <= 0 || t > waitAt || (h !== undefined && Math.abs(h.at - waitAt) < 1e-6 && h.u >= 0.5);
        if (!on) return;
        hint.state.visible = true;
        if (h && Math.abs(h.at - waitAt) < 1e-6) hint.state.opacity *= clamp((h.u - 0.5) * 8);
      } });
      extra.push(hint);
    }
    world.openQuestion = { panel, choices: choiceThings, start: ctx.start, extra };
    if (spec.stay !== true && ctx.duration !== undefined) { leaveAt(ctx, panel, ctx.start + ctx.duration); extra.forEach((e) => leaveAt(ctx, e, ctx.start + ctx.duration!)); world.openQuestion = undefined; }
    return { end: waitAt, thing: panel };
  },
}, ['ask', 'quiz', 'try_this']);

registerAction('answer', {
  summary: 'Show the answer to the last question: the right choice lit, or the answer written.',
  params: ['choice', 'text', 'tex', 'stay', 'why'],
  build(ctx) {
    const { world, spec } = ctx;
    const q = world.openQuestion;
    const { end, leaves } = stayEnd(ctx, 4);
    const good = world.theme.good;
    if (spec.choice !== undefined) {
      if (!q || !q.choices.length) throw new ScriptError('there is no question with choices before this in the scene.', `${ctx.where}.choice`);
      const n = typeof spec.choice === 'number' ? spec.choice - 1 : typeof spec.choice === 'string' ? LETTERS.indexOf(spec.choice.toUpperCase()) : -1;
      if (!(n >= 0 && n < q.choices.length)) throw new ScriptError(`must be a choice number from 1 to ${q.choices.length}, or its letter.`, `${ctx.where}.choice`);
      const right = q.choices[n];
      ctx.act({ start: ctx.start, duration: 0.5, apply(u) {
        q.choices.forEach((c, i) => { if (i !== n) c.state.dim = Math.max(c.state.dim, 0.6 * u); });
        right.state.color = good;
        right.state.scale *= 1 + 0.08 * Math.sin(Math.PI * u);
      } });
      const b = right.buildBox();
      const mark = new Thing(world.newId('tick'), 'shape', markGlyphs('tick', [b.x1 + 0.45, (b.y0 + b.y1) / 2], 0.18, good), [0, 0]);
      mark.screen = true;
      mark.layer = 5;
      world.add(mark, ctx.where);
      arrive(ctx, mark, 'draw', ctx.start + 0.2, 0.4);
      ctx.sound('chime', ctx.start + 0.3);
      q.extra.push(mark);
    } else {
      if (spec.text === undefined && spec.tex === undefined) throw new ScriptError('needs "choice" (for a question with choices), "text" or "tex".', ctx.where);
      const rows: Row[] = [{ text: 'ANSWER', size: 0.24, color: good, weight: 600 }];
      if (typeof spec.tex === 'string') rows.push({ tex: spec.tex, size: 0.55, color: world.theme.onSurface });
      if (typeof spec.text === 'string') rows.push({ text: spec.text, size: 0.38, color: world.theme.onSurface, weight: 600 });
      const panel = makePanel(ctx, str(ctx, 'id') ?? world.newId('answer'), rows, { bar: good, at: [0, 0] });
      const b = panel.buildBox();
      const h = b.y1 - b.y0;
      const below = q ? q.panel.buildBox().y0 - 0.3 - h / 2 : 0;
      panel.base.y = panel.build.y = q ? below : 0;
      panel.base.x = panel.build.x = q ? (q.panel.buildBox().x0 + q.panel.buildBox().x1) / 2 : 0;
      arrive(ctx, panel, 'rise', ctx.start, 0.5);
      ctx.sound('chime', ctx.start + 0.2);
      if (q) q.extra.push(panel); else if (leaves) leaveAt(ctx, panel, end);
    }
    if (typeof spec.why === 'string' && q) {
      const b = q.panel.buildBox();
      const below = Math.min(b.y0, ...q.extra.map((e) => e.buildBox().y0));
      const why = sheetText(ctx, world.newId('why'), spec.why, 0.3, [(b.x0 + b.x1) / 2, below - 0.45], { color: withAlpha(world.theme.ink, 0.85) });
      why.screen = true;
      world.add(why, ctx.where);
      arrive(ctx, why, 'fade', ctx.start + 0.6, 0.4);
      q.extra.push(why);
    }
    if (q && leaves) {
      leaveAt(ctx, q.panel, end);
      q.extra.forEach((e) => leaveAt(ctx, e, end));
      world.openQuestion = undefined;
    }
    return { end: ctx.start + 1, thing: q?.panel };
  },
}, ['reveal_answer', 'solution']);

// ---- marks on things ----

function boxOfWho(ctx: Ctx): { box: Box; who: Thing[] } {
  const who = things(ctx, 'who');
  let box = ctx.world.boxOf(who[0].id, ctx.where);
  for (const w of who.slice(1)) { const b = ctx.world.boxOf(w.id, ctx.where); box = { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) }; }
  return { box, who };
}

function markThing(ctx: Ctx, kind: 'tick' | 'cross'): Done {
  const { world, spec } = ctx;
  const col = color(ctx, 'color', kind === 'tick' ? world.theme.good : world.theme.bad)!;
  let c: Pt, screen = false;
  if (spec.who !== undefined) {
    const { box, who } = boxOfWho(ctx);
    const side = choice(spec.side, ['right', 'left', 'over'] as const, `${ctx.where}.side`, 'right');
    c = side === 'over' ? [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2] : [side === 'right' ? box.x1 + 0.45 : box.x0 - 0.45, (box.y0 + box.y1) / 2];
    screen = who[0].screen;
  } else if (spec.position !== undefined) c = world.point(spec.position, `${ctx.where}.position`);
  else throw new ScriptError('needs "who" (the thing it marks) or "position".', ctx.where);
  const size = num(ctx, 'size', 0.22);
  const mark = new Thing(str(ctx, 'id') ?? world.newId(kind), 'shape', markGlyphs(kind, c, size, col), [0, 0]);
  mark.screen = screen;
  mark.layer = 5;
  world.add(mark, ctx.where);
  arrive(ctx, mark, 'draw', ctx.start, 0.4);
  ctx.sound(kind === 'tick' ? 'chime' : 'low', ctx.start + 0.2);
  const { end, leaves } = stayEnd(ctx, Infinity);
  if (leaves && Number.isFinite(end) && ctx.duration !== undefined) leaveAt(ctx, mark, end);
  return { end: ctx.start + 0.6, thing: mark };
}

registerAction('tick', {
  summary: 'A tick beside (or over) a thing: this is right.',
  params: ['who', 'position', 'side', 'color', 'size', 'stay'],
  build: (ctx) => markThing(ctx, 'tick'),
}, ['correct']);

registerAction('cross', {
  summary: 'A cross beside (or over) a thing: this is wrong.',
  params: ['who', 'position', 'side', 'color', 'size', 'stay'],
  build: (ctx) => markThing(ctx, 'cross'),
}, ['incorrect']);

registerAction('mistake', {
  summary: 'A common mistake: crossed out, then put right underneath.',
  params: ['who', 'text', 'tex', 'fix', 'fix_text', 'reason', 'position'],
  build(ctx) {
    const { world, spec } = ctx;
    const bad = world.theme.bad, good = world.theme.good;
    let box: Box, screen = false;
    let wrong: Thing[];
    if (spec.who !== undefined) {
      const r = boxOfWho(ctx);
      box = r.box; wrong = r.who; screen = wrong[0].screen;
    } else {
      if (spec.tex === undefined && spec.text === undefined) throw new ScriptError('needs "who" (something already shown), or "tex"/"text" for the wrong working.', ctx.where);
      const at = spec.position !== undefined ? world.point(spec.position, `${ctx.where}.position`) : [0, 0.6] as Pt;
      const rows: Row[] = [typeof spec.tex === 'string' ? { tex: spec.tex, size: 0.6, color: world.theme.ink } : { text: String(spec.text), size: 0.45, color: world.theme.ink }];
      const p = makePanel(ctx, str(ctx, 'id') ?? world.newId('mistake'), rows, { surface: false, align: 'center', at, pad: 0.1 });
      p.screen = false;
      for (const m of p.members) m.screen = false;
      arrive(ctx, p, 'fade', ctx.start, 0.4);
      box = p.buildBox(); wrong = [p];
    }
    const t0 = ctx.start + (spec.who !== undefined ? 0 : 0.6);
    // The stamp: a red cross over it and a word.
    const pad = 0.12;
    const stamp = new Thing(world.newId('stamp'), 'shape', [
      strokeGlyph([{ closed: false, pts: [[box.x0 - pad, box.y0 - pad], [box.x1 + pad, box.y1 + pad]] }, { closed: false, pts: [[box.x0 - pad, box.y1 + pad], [box.x1 + pad, box.y0 - pad]] }], 6, 'stamp', { color: bad }),
    ], [0, 0]);
    stamp.screen = screen;
    stamp.layer = 5;
    world.add(stamp, ctx.where);
    arrive(ctx, stamp, 'draw', t0, 0.45);
    ctx.sound('low', t0 + 0.3);
    const word = sheetText(ctx, world.newId('mistake_word'), 'MISTAKE', 0.24, [box.x1 + 0.1, box.y1 + 0.4], { color: bad, align: 'left' });
    word.text!.weight = 700;
    word.screen = screen;
    world.add(word, ctx.where);
    arrive(ctx, word, 'pop', t0 + 0.3, 0.4);
    ctx.act({ start: t0 + 0.4, duration: 0.4, apply(u) { for (const w of wrong) w.state.dim = Math.max(w.state.dim, 0.45 * u); } });
    let last = t0 + 0.9;
    if (typeof spec.reason === 'string') {
      const reason = sheetText(ctx, world.newId('reason'), spec.reason, 0.3, [(box.x0 + box.x1) / 2, box.y0 - 0.4], { color: bad, italic: true });
      reason.screen = screen;
      world.add(reason, ctx.where);
      arrive(ctx, reason, 'fade', last, 0.4);
      box = { ...box, y0: box.y0 - 0.6 };
      last += 0.8;
    }
    if (spec.fix !== undefined || spec.fix_text !== undefined) {
      const at: Pt = [(box.x0 + box.x1) / 2, box.y0 - 0.75];
      const rows: Row[] = [typeof spec.fix === 'string' ? { tex: spec.fix, size: 0.6, color: good } : { text: String(spec.fix_text), size: 0.45, color: good }];
      const fix = makePanel(ctx, world.newId('fix'), rows, { surface: false, align: 'center', at, pad: 0.1 });
      fix.screen = screen;
      for (const m of fix.members) m.screen = screen;
      if (spec.key === true) { fix.key = true; fix.keyText = typeof spec.fix === 'string' ? { tex: spec.fix } : { text: String(spec.fix_text) }; }
      arrive(ctx, fix, 'rise', last, 0.5);
      const fb = fix.buildBox();
      const tick = new Thing(world.newId('tick'), 'shape', markGlyphs('tick', [fb.x1 + 0.4, (fb.y0 + fb.y1) / 2], 0.18, good), [0, 0]);
      tick.screen = screen;
      world.add(tick, ctx.where);
      arrive(ctx, tick, 'draw', last + 0.5, 0.4);
      ctx.sound('chime', last + 0.6);
      last += 1.1;
    }
    return { end: Math.max(last, ctx.duration !== undefined ? ctx.start + ctx.duration : 0), thing: stamp };
  },
}, ['common_mistake', 'wrong_way']);

// ---- definition cards ----

const CARD_KINDS: Record<string, { word: string; tone: (w: SceneWorld) => string }> = {
  definition: { word: 'DEFINITION', tone: (w) => w.theme.accent },
  theorem: { word: 'THEOREM', tone: (w) => w.theme.colors[3 % w.theme.colors.length] },
  rule: { word: 'RULE', tone: (w) => w.theme.colors[1 % w.theme.colors.length] },
  formula: { word: 'FORMULA', tone: (w) => w.theme.colors[2 % w.theme.colors.length] },
  tip: { word: 'TIP', tone: (w) => w.theme.good },
};

for (const [kind, info] of Object.entries(CARD_KINDS)) {
  registerAction(kind, {
    summary: `A ${kind} card; it goes into the recap.`,
    params: ['title', 'text', 'tex', 'position', 'stay', 'width', 'label'],
    build(ctx) {
      const { world, spec } = ctx;
      if (spec.title === undefined && spec.text === undefined && spec.tex === undefined) throw new ScriptError('needs "title", "text" or "tex".', ctx.where);
      const tone = info.tone(world);
      const ink = world.theme.onSurface;
      const rows: Row[] = [{ text: typeof spec.label === 'string' ? spec.label.toUpperCase() : info.word, size: 0.24, color: tone, weight: 600 }];
      if (typeof spec.title === 'string') rows.push({ text: spec.title, size: 0.44, color: ink, weight: 700 });
      if (typeof spec.tex === 'string') rows.push({ tex: spec.tex, size: 0.55, color: ink });
      if (typeof spec.text === 'string') rows.push({ text: spec.text, size: 0.32, color: withAlpha(ink, 0.88) });
      const panel = makePanel(ctx, str(ctx, 'id') ?? world.newId(kind), rows, { bar: tone, place: placeName(ctx, 'top'), width: num(ctx, 'width', 0) });
      // Into the recap unless "key": false.
      if (spec.key !== false) {
        panel.key = true;
        panel.keyText = { title: typeof spec.title === 'string' ? spec.title : undefined, tex: typeof spec.tex === 'string' ? spec.tex : undefined, text: typeof spec.text === 'string' && spec.tex === undefined ? spec.text : undefined };
      }
      arrive(ctx, panel, 'rise', ctx.start, 0.5);
      ctx.sound('swell', ctx.start);
      const { end, leaves } = stayEnd(ctx, 5);
      if (leaves) leaveAt(ctx, panel, end);
      return { end, thing: panel };
    },
  }, kind === 'definition' ? ['define'] : kind === 'formula' ? ['key_formula'] : []);
}

// ---- step counter ----

registerAction('step_counter', {
  summary: 'A small "Step 2 of 4" in a corner; each one takes the place of the last.',
  params: ['step', 'of', 'text', 'position'],
  required: ['step'],
  build(ctx) {
    const { world, spec } = ctx;
    if (typeof spec.step !== 'number') throw new ScriptError('must be a number.', `${ctx.where}.step`);
    if (spec.of !== undefined && typeof spec.of !== 'number') throw new ScriptError('must be a number.', `${ctx.where}.of`);
    const label = typeof spec.text === 'string' ? spec.text : 'Step';
    const words = `${label} ${spec.step}${spec.of !== undefined ? ` / ${spec.of}` : ''}`;
    const accent = world.theme.accent;
    const pill = makePanel(ctx, str(ctx, 'id') ?? world.newId('step'), [{ text: words, size: 0.3, color: accent, weight: 700 }], { surface: withAlpha(accent, 0.14), outline: accent, align: 'center', pad: 0.18 });
    const b = pill.buildBox();
    const at = placePanel(world, placeName(ctx, 'top_left'), b.x1 - b.x0, b.y1 - b.y0);
    const corner = world.screenPlace(placeName(ctx, 'top_left'));
    const W = world.frameW / 2, H = world.frameH / 2;
    // Tucked into the corner itself.
    const x = corner[0] < 0 ? -W + 0.4 + (b.x1 - b.x0) / 2 : corner[0] > 0 ? W - 0.4 - (b.x1 - b.x0) / 2 : at[0];
    const y = corner[1] > 0 ? H - 0.4 - (b.y1 - b.y0) / 2 : corner[1] < 0 ? -H + 0.4 + (b.y1 - b.y0) / 2 : at[1];
    pill.base.x = pill.build.x = x;
    pill.base.y = pill.build.y = y;
    const before = world.stepCounter;
    if (before) leaveAt(ctx, before, ctx.start + 0.3);
    world.stepCounter = pill;
    arrive(ctx, pill, before ? 'fade' : 'rise', ctx.start + (before ? 0.15 : 0), 0.4);
    ctx.sound('tick', ctx.start);
    if (spec.stay === false) leaveAt(ctx, pill, ctx.start + (ctx.duration ?? 3));
    return { end: ctx.start + 0.5, thing: pill };
  },
}, ['step_number', 'progress']);

// ---- recap ----

/** What a key thing says, for the recap. */
function keyRow(th: Thing, world: SceneWorld): Row | undefined {
  const ink = world.theme.onSurface;
  if (th.keyText?.tex) return { tex: th.keyText.title ? `\\text{${th.keyText.title}:}\\;\\; ${th.keyText.tex}` : th.keyText.tex, size: 0.42, color: ink, gap: 0.28 };
  if (th.keyText?.title || th.keyText?.text) return { text: `•  ${[th.keyText.title, th.keyText.text].filter(Boolean).join(': ')}`, size: 0.34, color: ink, gap: 0.28 };
  if (th.tex) return { tex: th.tex, size: 0.45, color: ink, gap: 0.28 };
  if (th.text) return { text: `•  ${th.text.lines.map((l) => l.runs.map((r) => r.text ?? '').join('')).join(' ')}`, size: 0.34, color: ink, gap: 0.28 };
  return undefined;
}

registerAction('recap', {
  summary: 'Gathers everything marked "key" so far (or the items given) onto one card.',
  params: ['title', 'items', 'from_chapter', 'lag', 'position', 'stay'],
  build(ctx) {
    const { world, spec } = ctx;
    const ink = world.theme.onSurface;
    const rows: Row[] = [
      { text: 'RECAP', size: 0.24, color: world.theme.accent, weight: 600 },
      { text: typeof spec.title === 'string' ? spec.title : 'What we found', size: 0.44, color: ink, weight: 700 },
    ];
    let items: Row[] = [];
    if (Array.isArray(spec.items)) {
      items = spec.items.map((it) => {
        const s = String(it);
        return /^\$.*\$$/.test(s) ? { tex: s.slice(1, -1), size: 0.42, color: ink, gap: 0.28 } : { text: `•  ${s}`, size: 0.34, color: ink, gap: 0.28 };
      });
    } else {
      const chapter = world.chapter;
      const seen = new Set<string>();
      for (const w of world.allWorlds) {
        if (spec.from_chapter === true && w.chapter !== chapter) continue;
        if (w.start > world.start) break;
        for (const th of w.order) {
          if (!th.key || th.parent?.key) continue;
          const r = keyRow(th, world);
          const sig = JSON.stringify(r);
          if (r && !seen.has(sig)) { seen.add(sig); items.push(r); }
        }
        if (w === world) break;
      }
      if (!items.length) throw new ScriptError('there is nothing marked "key" before this. Add "key": true to the beats to remember, or give "items".', ctx.where);
    }
    if (items.length > 7) { ctx.warn(`the recap has ${items.length} items; only the last 7 fit on one card.`); items = items.slice(-7); }
    const panel = makePanel(ctx, str(ctx, 'id') ?? world.newId('recap'), [...rows, ...items], { bar: world.theme.accent, place: placeName(ctx, 'center') });
    arrive(ctx, panel, 'rise', ctx.start, 0.5);
    ctx.sound('swell', ctx.start);
    const lag = num(ctx, 'lag', 0.6);
    const lines = panel.members.slice(rows.length);
    lines.forEach((th, i) => { th.base.visible = false; arrive(ctx, th, 'rise', ctx.start + 0.6 + i * lag, 0.45); ctx.sound('pop', ctx.start + 0.6 + i * lag); });
    const { end, leaves } = stayEnd(ctx, 2 + lines.length * lag + 2);
    const realEnd = Math.max(end, ctx.start + 0.6 + lines.length * lag + 1);
    if (leaves) leaveAt(ctx, panel, realEnd);
    return { end: realEnd, thing: panel };
  },
}, ['summary', 'sum_up']);

// ---- compare ----

registerAction('compare', {
  summary: 'Two ideas side by side; one can be marked the better way.',
  params: ['left', 'right', 'better', 'stay'],
  required: ['left', 'right'],
  build(ctx) {
    const { world, spec } = ctx;
    const ink = world.theme.onSurface;
    const sideRows = (v: unknown, where: string): Row[] => {
      if (!isObject(v)) throw new ScriptError('must be { "title", "text", "tex", "items" }.', where);
      const r: Row[] = [];
      if (typeof v.title === 'string') r.push({ text: v.title, size: 0.42, color: ink, weight: 700 });
      if (typeof v.tex === 'string') r.push({ tex: v.tex, size: 0.5, color: ink });
      if (typeof v.text === 'string') r.push({ text: v.text, size: 0.32, color: withAlpha(ink, 0.88) });
      if (Array.isArray(v.items)) for (const it of v.items) r.push({ text: `•  ${String(it)}`, size: 0.3, color: ink, gap: 0.16 });
      if (!r.length) throw new ScriptError('needs "title", "text", "tex" or "items".', where);
      return r;
    };
    const better = spec.better === undefined ? undefined : choice(spec.better, ['left', 'right'] as const, `${ctx.where}.better`, 'left');
    const id = str(ctx, 'id') ?? world.newId('compare');
    const tone = (side: 'left' | 'right') => better === undefined ? world.theme.colors[side === 'left' ? 0 : 1] : better === side ? world.theme.good : world.theme.bad;
    const L = makePanel(ctx, `${id}.left`, sideRows(spec.left, `${ctx.where}.left`), { bar: tone('left'), at: [0, 0] });
    const R = makePanel(ctx, `${id}.right`, sideRows(spec.right, `${ctx.where}.right`), { bar: tone('right'), at: [0, 0] });
    const lb = L.buildBox(), rb = R.buildBox();
    const w = Math.max(lb.x1 - lb.x0, rb.x1 - rb.x0) + (better ? 0.5 : 0);
    widenPanel(L, w);
    widenPanel(R, w);
    const gap = 0.9;
    L.base.x = L.build.x = -gap / 2 - w / 2;
    R.base.x = R.build.x = gap / 2 + w / 2;
    const vs = sheetText(ctx, `${id}.vs`, 'vs', 0.36, [0, 0], { color: withAlpha(world.theme.ink, 0.7), italic: true });
    vs.screen = true;
    world.add(vs, ctx.where);
    arrive(ctx, L, 'rise', ctx.start, 0.5);
    arrive(ctx, vs, 'fade', ctx.start + 0.4, 0.3);
    arrive(ctx, R, 'rise', ctx.start + 0.6, 0.5);
    const parts: Thing[] = [L, R, vs];
    if (better) {
      for (const [p, side] of [[L, 'left'], [R, 'right']] as const) {
        const b = p.buildBox();
        const kind = side === better ? 'tick' : 'cross';
        const m = new Thing(world.newId(kind), 'shape', markGlyphs(kind, [b.x1 - 0.35, b.y1 - 0.38], 0.16, side === better ? world.theme.good : world.theme.bad), [0, 0]);
        m.screen = true;
        m.layer = 5;
        world.add(m, ctx.where);
        arrive(ctx, m, 'draw', ctx.start + 1.4, 0.4);
        parts.push(m);
      }
      ctx.sound('chime', ctx.start + 1.6);
    }
    const { end, leaves } = stayEnd(ctx, 5);
    if (leaves) parts.forEach((p) => leaveAt(ctx, p, end));
    const group = new Thing(id, 'group', [], [0, 0]);
    group.members = [L, R];
    world.add(group, ctx.where);
    return { end, thing: group };
  },
}, ['versus', 'side_by_side']);

