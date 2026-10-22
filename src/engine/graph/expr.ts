// Expressions written in plain maths, compiled once and evaluated fast.

import { type EvalFunction, compile, complex, parse } from 'mathjs';
import { ScriptError } from '../util';

export type Scope = Record<string, number>;

const cache = new Map<string, EvalFunction>();

function compiled(text: string, where: string): EvalFunction {
  let f = cache.get(text);
  if (!f) {
    try {
      f = compile(normalise(text));
    } catch (err) {
      throw new ScriptError(`"${text}" could not be read as maths: ${(err as Error).message}`, where);
    }
    cache.set(text, f);
  }
  return f;
}

/** Plain maths as people type it: ln, ×, ÷, √ and a leading "y =". */
function normalise(text: string): string {
  return text
    .replace(/×/g, '*').replace(/÷/g, '/').replace(/√/g, 'sqrt').replace(/π/g, 'pi').replace(/θ/g, 'theta')
    .replace(/\bln\(/g, 'log(');
}

/** The names an expression uses (other than functions and constants). */
export function namesIn(text: string, where: string): string[] {
  let node;
  try { node = parse(normalise(text)); } catch (err) { throw new ScriptError(`"${text}" could not be read as maths: ${(err as Error).message}`, where); }
  const out = new Set<string>();
  node.traverse((n, _path, parent) => {
    if (n.type === 'SymbolNode' && !(parent && parent.type === 'FunctionNode' && (parent as unknown as { fn: unknown }).fn === n)) {
      const name = (n as unknown as { name: string }).name;
      if (!['pi', 'e', 'i', 'E', 'PI', 'Infinity'].includes(name)) out.add(name);
    }
  });
  return [...out];
}

/** A function of named numbers. Undefined points give NaN. */
export function fn(text: string, where: string): (scope: Scope) => number {
  const f = compiled(text, where);
  return (scope) => {
    try {
      const v = f.evaluate(scope);
      return typeof v === 'number' ? v : typeof v?.re === 'number' && Math.abs(v.im) < 1e-12 ? v.re : NaN;
    } catch {
      return NaN;
    }
  };
}

/** y as a function of x: "x^2", "y = x^2", "f(x) = x^2". */
export function curveOf(text: string, where: string): { f: (x: number, scope: Scope) => number; names: string[] } {
  let body = text.trim();
  const m = body.match(/^\s*(?:y|[a-zA-Z]\s*\(\s*x\s*\))\s*=\s*(.+)$/);
  if (m) body = m[1];
  if (/[<>]|=/.test(body)) throw new ScriptError(`"${text}" is not a function of x. Write it as "x^2 - 2" or "y = x^2 - 2".`, where);
  const g = fn(body, where);
  const names = namesIn(body, where).filter((n) => n !== 'x');
  return { f: (x, scope) => g({ ...scope, x }), names };
}

/** A complex map: z in, z out. */
export function complexMap(text: string, where: string): (x: number, y: number, scope: Scope) => [number, number] {
  const f = compiled(text, where);
  return (x, y, scope) => {
    try {
      const v = f.evaluate({ ...scope, z: complex(x, y), i: complex(0, 1) });
      if (typeof v === 'number') return [v, 0];
      return [v.re, v.im];
    } catch {
      return [NaN, NaN];
    }
  };
}

export type Relation = '<' | '<=' | '>' | '>=' | '=';

/** "y > x^2 - 2" or "x^2 + y^2 <= 9": both sides, and the sign. */
export function relationOf(text: string, where: string): { lhs: (x: number, y: number, s: Scope) => number; rel: Relation } | null {
  const m = text.match(/^(.*?)(<=|>=|<|>|≤|≥|=)(.*)$/);
  if (!m) return null;
  const rel = ({ '≤': '<=', '≥': '>=' } as Record<string, string>)[m[2]] ?? m[2];
  const a = fn(m[1], where), b = fn(m[3], where);
  return { lhs: (x, y, s) => a({ ...s, x, y }) - b({ ...s, x, y }), rel: rel as Relation };
}

/** Slope by a small step either side. */
export function slope(f: (x: number) => number, x: number, h = 1e-4): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

/** Roots of f between a and b: sign changes found on a fine grid, then halved down. */
export function roots(f: (x: number) => number, a: number, b: number, n = 800): number[] {
  const out: number[] = [];
  let x0 = a, y0 = f(a);
  for (let k = 1; k <= n; k++) {
    const x1 = a + ((b - a) * k) / n;
    const y1 = f(x1);
    if (Number.isFinite(y0) && Number.isFinite(y1)) {
      if (y0 === 0) out.push(x0);
      else if (y0 * y1 < 0 && Math.abs(y1 - y0) < (b - a)) {
        let lo = x0, hi = x1, flo = y0;
        for (let i = 0; i < 50; i++) {
          const mid = (lo + hi) / 2, fm = f(mid);
          if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
        }
        out.push((lo + hi) / 2);
      }
    }
    x0 = x1; y0 = y1;
  }
  if (Number.isFinite(y0) && y0 === 0) out.push(x0);
  return out.filter((x, i) => i === 0 || Math.abs(x - out[i - 1]) > (b - a) / n);
}

/** Show a number the way people write it. */
export function formatNumber(v: number, decimals = 2): string {
  if (!Number.isFinite(v)) return v > 0 ? '\\infty' : v < 0 ? '-\\infty' : '?';
  const s = v.toFixed(decimals);
  return s === `-${(0).toFixed(decimals)}` ? (0).toFixed(decimals) : s;
}
