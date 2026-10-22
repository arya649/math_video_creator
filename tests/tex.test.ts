import { describe, expect, it } from 'vitest';
import { texToGlyphs, mathToTex } from '../src/engine/tex';

describe('maths to outlines', () => {
  it('gives one glyph per symbol, with parts and the equals sign', () => {
    const r = texToGlyphs('\\part{left}{(a+b)^2} = \\frac{1}{2}');
    const keys = r.glyphs.map((g) => g.key);
    expect(keys).toContain('c3D');
    expect(keys).toContain('rule');
    expect(r.glyphs.filter((g) => g.parts.includes('left')).length).toBe(6);
    expect(r.equalsX).toBeGreaterThan(0);
  });
  it('turns plain maths into LaTeX', () => {
    expect(mathToTex('2*a*b')).toBe('2 a b');
    expect(mathToTex('x^2 + 1')).toContain('^{2}+1');
  });
});
