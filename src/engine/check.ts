// Checking the maths: does each step follow from the one before? Both are
// worked out at a handful of random values. Anything that cannot be read
// (words, \value, i, unusual notation) is simply not checked.

import { parse, type MathNode } from 'mathjs';
import { rng } from './util';

const FUNCTIONS = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'exp', 'sqrt', 'abs'];
const MATHJS_NAMES: Record<string, string> = { arcsin: 'asin', arccos: 'acos', arctan: 'atan', ln: 'log', csc: 'csc', sec: 'sec', cot: 'cot' };
const CONSTANTS = new Set(['pi', 'e']);

/** The innards of a {...} group starting at i (just after the "{"), and where it ends. */
function group(s: string, i: number): [string, number] {
  let depth = 1, j = i;
  for (; j < s.length && depth > 0; j++) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; }
  return [s.slice(i, j - 1), j];
}

/** LaTeX to something math.js reads, or null when it cannot be read. */
export function texToPlain(tex: string): string | null {
  if (/\\(text|value|mathrm\{[a-z]{2,}|operatorname|pm|mp|infty|sum|int|lim|prod|vec|overline|binom|ldots|cdots|dots)|\bi\b|[<>≤≥≠]|\\(le|ge|lt|gt|ne|neq|approx|equiv|to|implies|Rightarrow)/.test(tex)) return null;
  let s = tex;
  // \part{name}{...} and \color{c}{...} keep only the maths.
  s = s.replace(/\\(part|class)\{[^{}]*\}/g, '').replace(/\\color\{[^{}]*\}/g, '').replace(/\\(textcolor|colorbox)\{[^{}]*\}/g, '');
  s = s.replace(/\\left|\\right|\\displaystyle|\\[,;:! ]|\\quad|\\qquad/g, ' ');
  s = s.replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/');
  s = s.replace(/\\pi\b/g, ' pi ').replace(/\\mathrm\{(\w)\}/g, '$1');
  // \frac{a}{b}, \sqrt[n]{x}, \sqrt{x}, from the inside out.
  for (let guard = 0; guard < 50; guard++) {
    const f = s.search(/\\[dt]?frac\{|\\sqrt(\[[^\]]*\])?\{/);
    if (f < 0) break;
    const head = s.slice(f).match(/^\\[dt]?frac\{|^\\sqrt(\[[^\]]*\])?\{/)![0];
    if (head.includes('frac')) {
      const [a, i1] = group(s, f + head.length);
      if (s[i1] !== '{') return null;
      const [b, i2] = group(s, i1 + 1);
      s = `${s.slice(0, f)}((${a})/(${b}))${s.slice(i2)}`;
    } else {
      const n = head.match(/\[([^\]]*)\]/)?.[1];
      const [a, i1] = group(s, f + head.length);
      s = `${s.slice(0, f)}${n ? `nthRoot((${a}),(${n}))` : `sqrt(${a})`}${s.slice(i1)}`;
    }
  }
  for (const fn of FUNCTIONS) s = s.replace(new RegExp(`\\\\${fn}\\b`, 'g'), ` ${MATHJS_NAMES[fn] ?? fn} `);
  if (/\\[a-zA-Z]/.test(s)) return null;
  s = s.replace(/\{/g, '(').replace(/\}/g, ')');
  // sin x, sin^2 x, ln 2x: the function of the next piece.
  s = s.replace(/\b(sin|cos|tan|sec|csc|cot|asin|acos|atan|sinh|cosh|tanh|log|exp|abs)\s*(?:\^\s*(\([^()]*\)|\d))?\s*([A-Za-z0-9.]+|\([^()]*\))/g,
    (_m, fn: string, pow: string | undefined, arg: string) => (pow ? `(${fn}(${arg}))^${pow}` : `${fn}(${arg})`));
  // Single letters are separate variables: "ab" is a times b.
  s = s.replace(/[A-Za-z]+/g, (w) => (FUNCTIONS.includes(w) || ['asin', 'acos', 'atan', 'log', 'nthRoot', 'sqrt', 'pi'].includes(w) ? w : w.split('').join(' ')));
  return s;
}

interface Read { kind: 'expr' | 'eq'; f: (v: Record<string, number>) => number; vars: string[] }

function compileSide(text: string): { f: (v: Record<string, number>) => number; vars: string[] } | null {
  let node: MathNode;
  try { node = parse(text); } catch { return null; }
  const vars = new Set<string>();
  node.traverse((n, path) => {
    if ((n as { type: string }).type === 'SymbolNode' && path !== 'fn') {
      const name = (n as unknown as { name: string }).name;
      if (!CONSTANTS.has(name)) vars.add(name);
    }
  });
  const code = node.compile();
  return {
    vars: [...vars],
    f: (v) => {
      try {
        const r = code.evaluate({ ...v });
        return typeof r === 'number' ? r : NaN;
      } catch { return NaN; }
    },
  };
}

/** One line of maths, read as an expression or an equation. */
function read(tex: string): Read | null {
  const plain = texToPlain(tex);
  if (!plain) return null;
  const parts = plain.split('=');
  if (parts.length > 2) return null;
  const sides = parts.map(compileSide);
  if (sides.some((x) => !x)) return null;
  const vars = [...new Set(sides.flatMap((x) => x!.vars))];
  if (parts.length === 1) return { kind: 'expr', f: sides[0]!.f, vars };
  return { kind: 'eq', f: (v) => sides[0]!.f(v) - sides[1]!.f(v), vars };
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Where a one-variable function crosses zero on [-60, 60]. */
function roots(f: (x: number) => number): number[] {
  const out: number[] = [];
  const N = 4800;
  let px = -60, pv = f(px);
  for (let i = 1; i <= N; i++) {
    const x = -60 + (120 * i) / N, v = f(x);
    if (Number.isFinite(v) && Math.abs(v) < 1e-9) { if (!out.length || Math.abs(out[out.length - 1] - x) > 1e-3) out.push(x); }
    else if (Number.isFinite(pv) && Number.isFinite(v) && pv * v < 0 && Math.abs(pv - v) < 1e6) {
      let a = px, b = x, fa = pv;
      for (let k = 0; k < 60; k++) { const m = (a + b) / 2, fm = f(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
      const r = (a + b) / 2;
      if (!out.length || Math.abs(out[out.length - 1] - r) > 1e-3) out.push(r);
    }
    px = x; pv = v;
  }
  return out;
}

/**
 * Does `next` follow from `prev`? Returns a sentence about the problem, or
 * null when it follows (or cannot be checked).
 */
export function checkStep(prev: string, next: string): string | null {
  const a = read(prev), b = read(next);
  if (!a || !b || a.kind !== b.kind) return null;
  const vars = [...new Set([...a.vars, ...b.vars])];
  const r = rng(7);
  const samples: Record<string, number>[] = [];
  for (let i = 0; i < 12; i++) samples.push(Object.fromEntries(vars.map((v) => [v, 0.3 + r() * 3.4])));
  if (a.kind === 'expr') {
    let tried = 0;
    for (const s of samples) {
      const x = a.f(s), y = b.f(s);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      tried++;
      if (!close(x, y)) return `"${next}" is not equal to "${prev}" (at ${fmtVals(s)} one gives ${round(x)}, the other ${round(y)}).`;
    }
    return tried ? null : null;
  }
  // Equations: the same up to a constant factor, or (with one unknown) the same solutions.
  let ratio: number | undefined, proportional = true, tried = 0;
  for (const s of samples) {
    const x = a.f(s), y = b.f(s);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    tried++;
    if (Math.abs(y) < 1e-12) { if (Math.abs(x) > 1e-9) { proportional = false; break; } continue; }
    const q = x / y;
    if (ratio === undefined) ratio = q;
    else if (!close(q, ratio)) { proportional = false; break; }
  }
  if (!tried || (proportional && ratio !== 0)) return null;
  if (vars.length === 1) {
    const v = vars[0];
    const ra = roots((x) => a.f({ [v]: x })), rb = roots((x) => b.f({ [v]: x }));
    if (ra.length === rb.length && ra.every((x, i) => Math.abs(x - rb[i]) < 1e-4)) return null;
    return `"${next}" does not have the same solutions as "${prev}" (${solutions(v, ra)} before, ${solutions(v, rb)} after).`;
  }
  if (vars.length === 0) return null;
  return `"${next}" does not follow from "${prev}".`;
}

const round = (x: number) => String(Math.round(x * 1000) / 1000);
const fmtVals = (s: Record<string, number>) => Object.entries(s).map(([k, v]) => `${k} = ${round(v)}`).join(', ');
const solutions = (v: string, r: number[]) => (r.length ? r.map((x) => `${v} = ${round(x)}`).join(' or ') : 'no solution');
