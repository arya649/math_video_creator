// Small helpers shared by the whole engine.

/** A problem in a script, explained in plain English, with where it is. */
export class ScriptError extends Error {
  constructor(message: string, public where = '') {
    super(where ? `${where}: ${message}` : message);
    this.name = 'ScriptError';
  }
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Seeded random numbers: the same seed always gives the same run. */
export function rng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return d[b.length];
}

/** " Did you mean "x"?" for the nearest word, or "" when nothing is close. */
export function didYouMean(word: string, options: Iterable<string>): string {
  let best = '';
  let bestScore = Infinity;
  const w = word.toLowerCase();
  for (const o of options) {
    const score = editDistance(w, o.toLowerCase());
    if (score < bestScore) { bestScore = score; best = o; }
  }
  return best && bestScore <= Math.max(2, Math.floor(word.length / 3)) ? ` Did you mean "${best}"?` : '';
}

/** Pick a word from a list, or explain what the choices are. */
export function choice<T extends string>(value: unknown, options: readonly T[], where: string, fallback?: T): T {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    throw new ScriptError(`is required; use one of ${options.map((o) => `"${o}"`).join(', ')}.`, where);
  }
  if (typeof value === 'string' && (options as readonly string[]).includes(value)) return value as T;
  throw new ScriptError(
    `"${String(value)}" is not one of ${options.map((o) => `"${o}"`).join(', ')}.${didYouMean(String(value), options)}`,
    where,
  );
}

/** A number within a range, or a clear message. */
export function within(value: unknown, lo: number, hi: number, where: string, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ScriptError(`must be a number from ${lo} to ${hi}, not ${JSON.stringify(value)}.`, where);
  }
  if (value < lo || value > hi) throw new ScriptError(`must be from ${lo} to ${hi}; ${value} is outside that.`, where);
  return value;
}

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Easing: how something moves through its time.
export const EASES = ['smooth', 'linear', 'in', 'out', 'spring', 'there_and_back'] as const;
export type Ease = (typeof EASES)[number];

export function ease(kind: Ease, u: number): number {
  u = clamp(u);
  switch (kind) {
    case 'linear': return u;
    case 'in': return u * u * u;
    case 'out': return 1 - (1 - u) ** 3;
    case 'spring': {
      if (u >= 1) return 1;
      return 1 - Math.exp(-6 * u) * Math.cos(9 * u);
    }
    case 'there_and_back': {
      const v = u < 0.5 ? u * 2 : (1 - u) * 2;
      return v * v * (3 - 2 * v);
    }
    default: {
      // A gentle S, like Manim's "smooth".
      return u * u * u * (u * (u * 6 - 15) + 10);
    }
  }
}
