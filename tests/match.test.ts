import { describe, expect, it } from 'vitest';
import { texToGlyphs } from '../src/engine/tex';
import { matchGlyphs } from '../src/engine/match';

const keysOf = (t: string) => texToGlyphs(t).glyphs;

describe('equation steps', () => {
  it('moves the 5 across and turns + into -', () => {
    const a = keysOf('3x + 5 = 20'), b = keysOf('3x = 20 - 5');
    const pairs = matchGlyphs(a, b);
    const full = pairs.filter((p) => p.from !== undefined && p.to !== undefined);
    // Every symbol finds a partner: 3, x, +→-, 5, =, 2, 0.
    expect(full.length).toBe(7);
    const five = a.findIndex((g) => g.key === 'c35');
    const p5 = pairs.find((p) => p.from === five)!;
    expect(b[p5.to!].key).toBe('c35');
    const plus = a.findIndex((g) => g.key === 'c2B');
    expect(b[pairs.find((p) => p.from === plus)!.to!].key).toBe('c2212');
  });
  it('matches named parts by name', () => {
    const a = keysOf('\\part{s}{a^2} + b'), b = keysOf('b + \\part{s}{a^2}');
    const pairs = matchGlyphs(a, b, { mode: 'parts' });
    expect(pairs.filter((p) => p.from !== undefined && p.to !== undefined).length).toBe(2);
  });
});
