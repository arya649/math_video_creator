// Working things out, pointing, trails and listening to graphs: `solve`
// finds the steps itself (with reasons in the video's language), `evaluate`
// works a sum out, `pointer` taps things, `trace_path` leaves a fading trail,
// and `sonify` plays a graph as a rising and falling tone.

import { type MathNode, derivative, fraction, parse, rationalize, simplify } from 'mathjs';
import { arrive, color, natural, num, registerAction, str } from '../actions';
import type { Pt } from '../geom';
import { arrowHead, circle, fillGlyph, roundedRect, strokeGlyph } from '../shapes';
import { type Glyph, localBox } from '../thing';
import { withAlpha } from '../color';
import { ScriptError, choice, clamp, ease } from '../util';
import { liveThing } from './graph';

// ---- Reasons, in the video's language ----

const REASONS: Record<string, Record<string, string>> = {
  en: {
    subtract: 'subtract {v} from both sides', add: 'add {v} to both sides', divide: 'divide both sides by {v}', multiply: 'multiply both sides by {v}',
    flip: ' (the sign turns round)', side: 'bring everything to one side', factor: 'factorise', zero: 'one of the factors is zero',
    formula: 'the formula', fill: 'put in $a = {a}$, $b = {b}$, $c = {c}$', work: 'work it out', half: 'add {v} to both sides to complete the square',
    root: 'take the square root', expand: 'expand', simplify: 'simplify', differentiate: 'differentiate', integrate: 'integrate, adding a constant',
    none: 'no real solution: the square cannot be negative', lead: 'divide both sides by {v}',
  },
  hi: {
    subtract: 'दोनों ओर से {v} घटाएँ', add: 'दोनों ओर {v} जोड़ें', divide: 'दोनों ओर {v} से भाग दें', multiply: 'दोनों ओर {v} से गुणा करें',
    flip: ' (चिह्न पलट जाता है)', side: 'सब कुछ एक ओर लाएँ', factor: 'गुणनखंड करें', zero: 'कोई एक गुणनखंड शून्य है',
    formula: 'सूत्र', fill: '$a = {a}$, $b = {b}$, $c = {c}$ रखें', work: 'हल करें', half: 'वर्ग पूरा करने के लिए दोनों ओर {v} जोड़ें',
    root: 'वर्गमूल लें', expand: 'विस्तार करें', simplify: 'सरल करें', differentiate: 'अवकलन करें', integrate: 'समाकलन करें, एक अचर जोड़कर',
    none: 'कोई वास्तविक हल नहीं: वर्ग ऋणात्मक नहीं हो सकता', lead: 'दोनों ओर {v} से भाग दें',
  },
};

function reason(lang: string, key: string, vars: Record<string, string> = {}): string {
  const t = (REASONS[lang] ?? REASONS.en)[key] ?? REASONS.en[key];
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// ---- Numbers and terms as maths ----

/** A number as maths: whole, a fraction, or a short decimal. */
export function numTex(x: number): string {
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
  try {
    const f = fraction(x) as unknown as { s: number; n: number; d: number };
    if (Number(f.d) <= 1000) return `${Number(f.s) < 0 ? '-' : ''}\\frac{${Number(f.n)}}{${Number(f.d)}}`;
  } catch { /* a decimal then */ }
  return String(Math.round(x * 1000) / 1000);
}

/** a·v^p + ... as maths, highest power first, skipping zeros. */
function polyTex(coefs: number[], v: string): string {
  const out: string[] = [];
  for (let p = coefs.length - 1; p >= 0; p--) {
    const c = coefs[p];
    if (Math.abs(c) < 1e-12) continue;
    const mag = Math.abs(c);
    const body = p === 0 ? numTex(mag) : `${Math.abs(mag - 1) < 1e-12 ? '' : numTex(mag)}${v}${p > 1 ? `^${p}` : ''}`;
    out.push(out.length ? `${c < 0 ? ' - ' : ' + '}${body}` : `${c < 0 ? '-' : ''}${body}`);
  }
  return out.join('') || '0';
}

const REL_TEX: Record<string, string> = { '=': '=', '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge' };
const FLIP: Record<string, string> = { '=': '=', '<': '>', '>': '<', '<=': '>=', '>=': '<=' };

/** Coefficients (lowest power first) of a polynomial in v, or null. */
function coefsOf(text: string, v: string): number[] | null {
  try {
    const r = rationalize(text, {}, true) as unknown as { coefficients: number[]; variables: string[] };
    if (r.variables.length > 1 || (r.variables.length === 1 && r.variables[0] !== v)) return null;
    return r.coefficients.length ? r.coefficients.map(Number) : [Number(parse(text).evaluate())];
  } catch { return null; }
}

interface Line { tex: string; note?: string }

/** The steps that solve an equation or inequality, or work on an expression. */
export function solveSteps(text: string, v: string | undefined, method: string, lang: string, where: string): Line[] {
  const rel = ['<=', '>=', '<', '>', '='].find((r) => text.includes(r));
  if (!rel) return expressionSteps(text, v, method, lang, where);
  const [lhs, rhs] = text.split(rel).map((x) => x.trim());
  if (!lhs || !rhs || text.split(rel).length !== 2) throw new ScriptError('must have one "=" (or one inequality sign).', where);
  const names = new Set<string>();
  for (const side of [lhs, rhs]) parse(side).traverse((n) => { if ((n as { type: string }).type === 'SymbolNode' && !['pi', 'e'].includes((n as unknown as { name: string }).name)) names.add((n as unknown as { name: string }).name); });
  const x = v ?? (names.size === 1 ? [...names][0] : undefined);
  if (!x) throw new ScriptError(`needs "for": which letter to solve for (it has ${[...names].join(', ')}).`, `${where}.for`);
  const L = coefsOf(lhs, x), R = coefsOf(rhs, x);
  if (!L || !R) throw new ScriptError(`solve works on polynomial equations in ${x}; this one is not.`, where);
  const deg = Math.max(L.length, R.length) - 1;
  const lines: Line[] = [{ tex: `${polyTex(L, x)} ${REL_TEX[rel]} ${polyTex(R, x)}` }];
  const at = (c: number[], i: number) => c[i] ?? 0;
  if (deg <= 1) {
    let a1 = at(L, 1), b1 = at(L, 0), a2 = at(R, 1), b2 = at(R, 0);
    let r = rel;
    if (Math.abs(a1 - a2) < 1e-12) throw new ScriptError(`${x} cancels out: ${Math.abs(b1 - b2) < 1e-12 ? 'it is true for every value' : 'there is no solution'}.`, where);
    if (Math.abs(a2) > 1e-12) {
      // Unknowns to the left.
      const term = polyTex([0, Math.abs(a2)], x);
      a1 -= a2; a2 = 0;
      lines.push({ tex: `${polyTex([b1, a1], x)} ${REL_TEX[r]} ${numTex(b2)}`, note: reason(lang, at(R, 1) > 0 ? 'subtract' : 'add', { v: `$${term}$` }) });
    }
    if (Math.abs(b1) > 1e-12) {
      lines.push({ tex: `${polyTex([0, a1], x)} ${REL_TEX[r]} ${numTex(b2 - b1)}`, note: reason(lang, b1 > 0 ? 'subtract' : 'add', { v: `$${numTex(Math.abs(b1))}$` }) });
      b2 -= b1; b1 = 0;
    }
    if (Math.abs(a1 - 1) > 1e-12) {
      const flips = a1 < 0 && r !== '=';
      if (flips) r = FLIP[r];
      lines.push({ tex: `${x} ${REL_TEX[r]} ${numTex(b2 / a1)}`, note: reason(lang, 'divide', { v: `$${numTex(a1)}$` }) + (flips ? reason(lang, 'flip') : '') });
    }
    return lines;
  }
  if (deg === 2) {
    if (rel !== '=') throw new ScriptError('solve works on quadratic equations, not quadratic inequalities.', where);
    const a = at(L, 2) - at(R, 2), b = at(L, 1) - at(R, 1), c = at(L, 0) - at(R, 0);
    if (R.some((k, i) => Math.abs(k) > 1e-12 && (i > 0 || R.length > 1 || Math.abs(k) > 1e-12))) {
      lines.push({ tex: `${polyTex([c, b, a], x)} = 0`, note: reason(lang, 'side') });
    }
    const disc = b * b - 4 * a * c;
    const roots = disc >= 0 ? [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)] : [];
    const nice = roots.length && roots.every((q) => /^-?\d+$|frac/.test(numTex(q)) && numTex(q).length < 14);
    const m = method === 'auto' ? (nice ? 'factor' : 'formula') : method;
    const exact = () => {
      const [o, r] = rootParts(disc);
      return r === 1 || !Number.isInteger(disc) ? null : plusMinusRoot(-b, o, r, 2 * a);
    };
    const answer = (): Line => (disc < 0 ? { tex: '\\text{no real } ' + x, note: reason(lang, 'none') }
      : Math.abs(disc) < 1e-12 ? { tex: `${x} = ${numTex(roots[0])}` }
      : exact() ? { tex: `${x} = ${exact()}`, note: reason(lang, 'zero') }
      : { tex: `${x} = ${numTex(roots[0])} \\text{ or } ${x} = ${numTex(roots[1])}`, note: reason(lang, 'zero') });
    if (m === 'factor') {
      if (!nice) throw new ScriptError('this quadratic does not factorise neatly; use "method": "formula".', `${where}.method`);
      const f = (q: number) => (Math.abs(q) < 1e-12 ? x : `(${x} ${q < 0 ? '+' : '-'} ${numTex(Math.abs(q))})`);
      lines.push({ tex: `${Math.abs(a - 1) < 1e-12 ? '' : numTex(a)}${f(roots[0])}${f(roots[1])} = 0`, note: reason(lang, 'factor') });
      lines.push(answer());
    } else if (m === 'formula') {
      lines.push({ tex: `${x} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}`, note: reason(lang, 'formula') });
      lines.push({ tex: `${x} = \\frac{${numTex(-b)} \\pm \\sqrt{${numTex(disc)}}}{${numTex(2 * a)}}`, note: reason(lang, 'fill', { a: numTex(a), b: numTex(b), c: numTex(c) }) });
      lines.push({ ...answer(), note: disc < 0 ? reason(lang, 'none') : reason(lang, 'work') });
    } else if (m === 'complete_square') {
      let p = b / a, q = c / a;
      if (Math.abs(a - 1) > 1e-12) lines.push({ tex: `${polyTex([q, p, 1], x)} = 0`, note: reason(lang, 'lead', { v: `$${numTex(a)}$` }) });
      lines.push({ tex: `${polyTex([0, p, 1], x)} = ${numTex(-q)}`, note: reason(lang, q > 0 ? 'subtract' : 'add', { v: `$${numTex(Math.abs(q))}$` }) });
      const h = p / 2;
      lines.push({ tex: `(${x} ${h < 0 ? '-' : '+'} ${numTex(Math.abs(h))})^2 = ${numTex(h * h - q)}`, note: reason(lang, 'half', { v: `$${numTex(h * h)}$` }) });
      if (h * h - q < 0) lines.push({ tex: '\\text{no real } ' + x, note: reason(lang, 'none') });
      else {
        const k2 = h * h - q;
        const [o, r] = Number.isInteger(k2) ? rootParts(k2) : [0, 0];
        const rt = r === 1 ? numTex(o) : r > 1 ? `${o === 1 ? '' : o}\\sqrt{${r}}` : numTex(Math.sqrt(k2));
        lines.push({ tex: `${x} ${h < 0 ? '-' : '+'} ${numTex(Math.abs(h))} = \\pm ${rt}`, note: reason(lang, 'root') });
        lines.push({ ...answer(), note: reason(lang, 'work') });
      }
      void p; void q; p = 0; q = 0;
    } else throw new ScriptError(`"${m}" does not solve equations; use auto, factor, formula or complete_square.`, `${where}.method`);
    return lines;
  }
  throw new ScriptError(`solve handles equations up to x squared; this one has ${x}^${deg}.`, where);
}

/** √n as maths, square factors taken out: √8 is 2√2. Returns [outside, inside]. */
function rootParts(n: number): [number, number] {
  let out = 1, inside = Math.round(n);
  for (let k = Math.floor(Math.sqrt(inside)); k > 1; k--) if (inside % (k * k) === 0) { out *= k; inside /= k * k; break; }
  return [out, inside];
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** (p ± q√r) / d, made as simple as it goes. */
function plusMinusRoot(p: number, q: number, r: number, d: number): string {
  if ([p, q, r, d].every(Number.isInteger) && r > 0) {
    const g = gcd(gcd(Math.abs(p), Math.abs(q)), Math.abs(d)) || 1;
    p /= g; q /= g; d /= g;
    if (d < 0) { p = -p; d = -d; }
    const root = `${q === 1 ? '' : q}\\sqrt{${r}}`;
    const top = p === 0 ? `\\pm ${root}` : `${p} \\pm ${root}`;
    return d === 1 ? top : `\\frac{${top}}{${d}}`;
  }
  return `${numTex(p / d)} \\pm ${numTex((q * Math.sqrt(r)) / d)}`;
}

function expressionSteps(text: string, v: string | undefined, method: string, lang: string, where: string): Line[] {
  let node: MathNode;
  try { node = parse(text); } catch (e) { throw new ScriptError(`could not be read: ${(e as Error).message}.`, where); }
  const tex = (n: MathNode) => n.toTex({ implicit: 'hide', parenthesis: 'auto' }).replace(/\\cdot|~|\\,/g, '').replace(/\{\s*([a-z])\}/g, '$1');
  const x = v ?? 'x';
  const m = method === 'auto' ? 'simplify' : method;
  const lines: Line[] = [{ tex: tex(node) }];
  switch (m) {
    case 'expand': {
      const r = rationalize(node) as MathNode;
      lines.push({ tex: `= ${tex(r)}`, note: reason(lang, 'expand') });
      break;
    }
    case 'simplify': lines.push({ tex: `= ${tex(simplify(node))}`, note: reason(lang, 'simplify') }); break;
    case 'differentiate': {
      lines[0] = { tex: `\\frac{d}{d${x}}\\left(${tex(node)}\\right)` };
      lines.push({ tex: `= ${tex(simplify(derivative(node, x)))}`, note: reason(lang, 'differentiate') });
      break;
    }
    case 'integrate': {
      const c = coefsOf(text, x);
      if (!c) throw new ScriptError('integrate works on polynomials.', where);
      lines[0] = { tex: `\\int ${tex(node)} \\, d${x}` };
      const out = [0, ...c.map((k, i) => k / (i + 1))];
      lines.push({ tex: `= ${polyTex(out, x)} + C`, note: reason(lang, 'integrate') });
      break;
    }
    default: throw new ScriptError(`"${m}" does not work on an expression; use expand, simplify, differentiate or integrate.`, `${where}.method`);
  }
  return lines;
}

const METHODS = ['auto', 'factor', 'formula', 'complete_square', 'expand', 'simplify', 'differentiate', 'integrate'] as const;

registerAction('solve', {
  summary: 'Like work, but the engine finds the steps itself and writes each reason.',
  params: ['math', 'tex', 'for', 'method', 'max_steps', 'position', 'size', 'color', 'numbered', 'fade_old'],
  build(ctx) {
    const { spec, world } = ctx;
    const text = typeof spec.math === 'string' ? spec.math : typeof spec.tex === 'string' ? spec.tex.replace(/\\cdot|\\times/g, '*').replace(/\\left|\\right/g, '').replace(/\\le\b/g, '<=').replace(/\\ge\b/g, '>=').replace(/[{}]/g, (b) => (b === '{' ? '(' : ')')) : undefined;
    if (!text) throw new ScriptError('needs "math" (or "tex"): what to solve.', ctx.where);
    const method = choice(spec.method, METHODS, `${ctx.where}.method`, 'auto');
    let lines = solveSteps(text, typeof spec.for === 'string' ? spec.for : undefined, method, world.lang, ctx.where);
    if (typeof spec.max_steps === 'number') lines = lines.slice(0, spec.max_steps + 1);
    world.found.push(`${ctx.where}: ${lines.map((l) => l.tex).join('  →  ')}`);
    const nested: Record<string, unknown> = { do: 'work', lines: lines.map((l, i) => (i === 0 ? { tex: l.tex } : { tex: l.tex, note: l.note })) };
    for (const k of ['id', 'position', 'size', 'color', 'numbered', 'fade_old']) if (spec[k] !== undefined) nested[k] = spec[k];
    return ctx.buildNested(nested, ctx.where, ctx.start);
  },
}, ['auto_steps']);

// ---- evaluate ----

/** One step of working out: the innermost operation of plain numbers, done. */
function evalStep(node: MathNode, did: string[] = []): MathNode | null {
  let done = false;
  const out = node.transform((n) => {
    if (done) return n;
    let t = (n as { type: string }).type;
    // Brackets round a sum of numbers go when the sum is done.
    const inner = t === 'ParenthesisNode' ? (n as unknown as { content: MathNode }).content : undefined;
    const bracketed = !!inner && ['OperatorNode', 'FunctionNode'].includes((inner as { type: string }).type) && (inner as unknown as { args: MathNode[] }).args.every((a) => (a as { type: string }).type === 'ConstantNode');
    if (bracketed) { n = inner!; t = (n as { type: string }).type; }
    if ((t === 'OperatorNode' || t === 'FunctionNode') && (n as unknown as { args: MathNode[] }).args.every((a) => (a as { type: string }).type === 'ConstantNode' || ((a as { type: string }).type === 'ParenthesisNode' && ((a as unknown as { content: MathNode }).content as { type: string }).type === 'ConstantNode'))) {
      done = true;
      const v = n.evaluate();
      const out = parse(String(Math.round(Number(v) * 1e9) / 1e9));
      did.push(`$${n.toTex({ parenthesis: 'keep' }).replace(/\\cdot/g, '\\times')} = ${out.toTex()}$`);
      return out;
    }
    if (t === 'ParenthesisNode' && ((n as unknown as { content: MathNode }).content as { type: string }).type === 'ConstantNode') { done = true; return (n as unknown as { content: MathNode }).content; }
    return n;
  });
  return done ? out : null;
}

registerAction('evaluate', {
  summary: 'Works a sum out to its value: step by step, or straight into the answer.',
  params: ['math', 'steps', 'position', 'size', 'color'],
  required: ['math'],
  build(ctx) {
    const { spec } = ctx;
    let node: MathNode;
    try { node = parse(String(spec.math)); } catch (e) { throw new ScriptError(`could not be read: ${(e as Error).message}.`, `${ctx.where}.math`); }
    const tex = (n: MathNode) => n.toTex({ parenthesis: 'keep' }).replace(/\\cdot/g, '\\times');
    let value: number;
    try { value = Number(node.evaluate()); } catch { throw new ScriptError('must be a sum of numbers (no letters).', `${ctx.where}.math`); }
    const nested: Record<string, unknown> = { id: spec.id, position: spec.position, size: spec.size, color: spec.color };
    if (spec.steps === true) {
      const lines: (string | { tex: string; note: string })[] = [tex(node)];
      let cur: MathNode | null = node;
      for (let k = 0; k < 20 && cur; k++) { const did: string[] = []; cur = evalStep(cur, did); if (cur) lines.push({ tex: `= ${tex(cur)}`, note: did[0] ?? '' }); }
      return ctx.buildNested({ ...nested, do: 'work', lines }, ctx.where, ctx.start);
    }
    const first = ctx.buildNested({ ...nested, do: 'write', tex: tex(node) }, ctx.where, ctx.start);
    const id = first.thing!.id;
    return ctx.buildNested({ do: 'steps', who: id, to: `${tex(node)} = ${numTex(value)}` }, ctx.where, first.end + 0.3);
  },
}, ['calculate']);

// ---- pointer ----

function pointerGlyphs(as: string, col: string): Glyph[] {
  // The tip is at (0, 0); the pointer comes from below right.
  switch (as) {
    case 'dot': return [fillGlyph([circle([0, 0], 0.12)], 'dot', { color: col }), strokeGlyph([circle([0, 0], 0.22)], 3, 'ring', { color: withAlpha(col, 0.5) })];
    case 'chalk': return [fillGlyph([{ closed: true, pts: [[0, 0], [0.12, -0.06], [0.75, -0.7], [0.63, -0.82], [0.06, -0.12]] }], 'chalk', { color: '#f4f1e8' })];
    case 'hand': return [
      fillGlyph([roundedRect(-0.06, -0.55, 0.1, 0, 0.06)], 'finger', { color: '#f2c9a0' }),
      fillGlyph([roundedRect(-0.12, -1.0, 0.36, -0.45, 0.12)], 'palm', { color: '#f2c9a0' }),
      strokeGlyph([roundedRect(-0.06, -0.55, 0.1, 0, 0.06), roundedRect(-0.12, -1.0, 0.36, -0.45, 0.12)], 2, 'edge', { color: '#8a5a3c' }),
    ];
    default: return [
      strokeGlyph([{ closed: false, pts: [[0.85, -0.85], [0.12, -0.12]] }], 6, 'shaft', { color: col }),
      fillGlyph([arrowHead([0.85, -0.85], [0, 0], 0.3)], 'tip', { color: col }),
    ];
  }
}

registerAction('pointer', {
  summary: 'A pointer moves to a thing and taps it; a list taps each in turn.',
  params: ['on', 'as', 'color', 'stay'],
  required: ['on'],
  build(ctx) {
    const { world, spec } = ctx;
    const as = choice(spec.as, ['arrow', 'hand', 'chalk', 'dot'] as const, `${ctx.where}.as`, 'arrow');
    const list = Array.isArray(spec.on) && !spec.on.every((x) => typeof x === 'number') ? spec.on : [spec.on];
    // The tip sits just below and right of each thing's middle.
    const targets: Pt[] = list.map((r, i) => {
      const w = Array.isArray(spec.on) && list.length > 1 ? `${ctx.where}.on[${i}]` : `${ctx.where}.on`;
      if (typeof r === 'string' && world.things.has(r.split('.')[0]) && !world.geoPoint?.(r)) { const b = world.boxOf(r, w); return [(b.x0 + b.x1) / 2 + (b.x1 - b.x0) * 0.2, b.y0 + 0.02]; }
      return world.point(r, w);
    });
    const col = color(ctx, 'color', world.theme.accent)!;
    const per = ctx.duration !== undefined ? ctx.duration / list.length : 1.1 / ctx.speed;
    const start = ctx.start;
    const from: Pt = [world.frameW / 2 + 1, -world.frameH / 2 - 1];
    const g = pointerGlyphs(as, col);
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('pointer'), (t) => {
      const tt = t === Infinity ? per * list.length : t - start;
      const k = Math.min(list.length - 1, Math.max(0, Math.floor(tt / per)));
      const u = clamp((tt - k * per) / per);
      const a = k === 0 ? from : targets[k - 1], b = targets[k];
      const m = ease('smooth', clamp(u / 0.6));
      const tap = u > 0.6 ? Math.sin(((u - 0.6) / 0.4) * Math.PI) : 0;
      const p: Pt = [a[0] + (b[0] - a[0]) * m + 0.08 * tap, a[1] + (b[1] - a[1]) * m - 0.08 * tap];
      return g.map((gl) => ({ ...gl, contours: gl.contours.map((c) => ({ closed: c.closed, pts: c.pts.map(([x, y]) => [p[0] + x, p[1] + y] as Pt) })) }));
    }, ctx.where);
    th.layer = 8;
    th.base.visible = true;
    list.forEach((_, k) => ctx.sound('tick', start + k * per + per * 0.75));
    const end = start + per * list.length;
    if (spec.stay !== true) ctx.act({ start: end, duration: 0.4, apply(u) { if (u >= 1) th.state.visible = false; else th.state.opacity *= 1 - u; } });
    return { end, thing: th };
  },
}, ['tap']);

// ---- trace_path ----

registerAction('trace_path', {
  summary: 'Something moving leaves a fading trail behind it.',
  params: ['who', 'length', 'color', 'width'],
  required: ['who'],
  build(ctx) {
    const { world, spec } = ctx;
    const target = world.get(spec.who, `${ctx.where}.who`);
    const L = num(ctx, 'length', 1.5);
    if (!(L > 0) || L > 20) throw new ScriptError('must be from 0 to 20 seconds.', `${ctx.where}.length`);
    const col = color(ctx, 'color', world.theme.accent)!;
    const width = num(ctx, 'width', 5);
    const start = ctx.start;
    const step = 1 / 30;
    const cache = new Map<number, Pt | null>();
    const where = (): Pt | null => {
      if (!target.shown()) return null;
      const b = localBox(target.state.glyphs, target.text);
      const c: Pt = Number.isFinite(b.x0) ? [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] : [0, 0];
      const m = target.matrix();
      return [m[0] * c[0] + m[2] * c[1] + m[4], m[1] * c[0] + m[3] * c[1] + m[5]];
    };
    const th = liveThing(ctx, str(ctx, 'id') ?? world.newId('trail'), () => [], ctx.where);
    th.base.visible = true;
    th.layer = -1;
    // Where it was a moment ago: the scene is put at those moments in turn (once each), then back.
    world.livers.push((t) => {
      if (world.sampling || t < start) { th.state.glyphs = []; return; }
      const now = Math.round(t / step);
      const from = Math.max(Math.round(start / step), now - Math.round(L / step));
      cache.set(now, where());
      const missing: number[] = [];
      for (let k = from; k < now; k++) if (!cache.has(k)) missing.push(k);
      if (missing.length) {
        const hold = world.hold;
        world.sampling = true;
        for (const k of missing) { world.applyAt!(k * step); cache.set(k, where()); }
        world.applyAt!(t, hold);
        world.sampling = false;
      }
      const glyphs: Glyph[] = [];
      for (let k = from; k < now; k++) {
        const a = cache.get(k), b = cache.get(k + 1) ?? (k + 1 === now ? where() : null);
        if (!a || !b) continue;
        const age = (now - k) / Math.max(1, now - from);
        glyphs.push(strokeGlyph([{ closed: false, pts: [a, b] }], width * (1 - age * 0.7), 'trail', { color: withAlpha(col, 1 - age) }));
      }
      th.state.glyphs = glyphs;
    });
    return { end: start };
  },
}, ['trail']);

// ---- sonify ----

registerAction('sonify', {
  summary: 'A dot runs along a graph while a tone rises and falls with its height.',
  worlds: ['graph'],
  params: ['who', 'x', 'color', 'low', 'high'],
  required: ['who'],
  build(ctx) {
    const { world, spec } = ctx;
    const g = world.graphs.get(String(spec.who));
    if (!g) throw new ScriptError(`there is no graph called "${String(spec.who)}".`, `${ctx.where}.who`);
    const ax = g.axes;
    const xr = Array.isArray(spec.x) && spec.x.length === 2 && spec.x.every((v) => typeof v === 'number') ? spec.x as [number, number] : [ax.x[0], ax.x[1]] as [number, number];
    const d = natural(ctx, 4);
    const start = ctx.start;
    const scope = world.scope();
    const N = 200;
    const ys = Array.from({ length: N + 1 }, (_, i) => g.f(xr[0] + ((xr[1] - xr[0]) * i) / N, scope));
    const fin = ys.filter(Number.isFinite);
    const lo = Math.min(...fin), hi = Math.max(...fin);
    // Low to high notes, evenly in pitch.
    const f0 = num(ctx, 'low', 220), f1 = num(ctx, 'high', 880);
    const freqs = ys.map((y) => (Number.isFinite(y) ? f0 * Math.pow(f1 / f0, (y - lo) / ((hi - lo) || 1)) : 0));
    world.sounds.push({ at: start, kind: 'tone', duration: d, volume: 0.35, tone: freqs });
    const col = color(ctx, 'color', world.theme.accent)!;
    const dot = liveThing(ctx, str(ctx, 'id') ?? world.newId('sonify'), (t) => {
      const u = t === Infinity ? 1 : clamp((t - start) / d);
      const x = xr[0] + (xr[1] - xr[0]) * u;
      const y = g.f(x, world.scope());
      if (!Number.isFinite(y)) return [];
      const p = ax.toSheet([x, y]);
      return [fillGlyph([circle(p, 0.12)], 'dot', { color: col }), strokeGlyph([circle(p, 0.22 + 0.06 * Math.sin(t * 20))], 2.5, 'ring', { color: withAlpha(col, 0.5) })];
    }, ctx.where);
    arrive(ctx, dot, 'pop', start, 0.3);
    ctx.act({ start: start + d, duration: 0.4, apply(u) { if (u >= 1) dot.state.visible = false; else dot.state.opacity *= 1 - u; } });
    return { end: start + d, thing: dot };
  },
}, ['hear_graph']);
