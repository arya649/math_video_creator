// Mixing colours, for colour changes over time.

type RGBA = [number, number, number, number];

export function parseColor(c: string): RGBA | null {
  const h = c.trim();
  if (h.startsWith('#')) {
    let s = h.slice(1);
    if (s.length === 3 || s.length === 4) s = Array.from(s).map((x) => x + x).join('');
    if (s.length !== 6 && s.length !== 8) return null;
    const n = parseInt(s, 16);
    if (s.length === 6) return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    return [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, (n & 255) / 255];
  }
  const m = h.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const v = m[1].split(',').map((x) => parseFloat(x));
    return [v[0], v[1], v[2], v[3] ?? 1];
  }
  return null;
}

export function mixColor(a: string, b: string, u: number): string {
  if (u <= 0) return a;
  if (u >= 1) return b;
  const pa = parseColor(a), pb = parseColor(b);
  if (!pa || !pb) return u < 0.5 ? a : b;
  const v = pa.map((x, i) => x + (pb[i] - x) * u);
  return `rgba(${Math.round(v[0])},${Math.round(v[1])},${Math.round(v[2])},${v[3].toFixed(3)})`;
}

export function withAlpha(c: string, alpha: number): string {
  const p = parseColor(c);
  if (!p) return c;
  return `rgba(${p[0]},${p[1]},${p[2]},${(p[3] * alpha).toFixed(3)})`;
}
