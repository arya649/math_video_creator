import { describe, expect, it } from 'vitest';
import { checkStep, texToPlain } from '../src/engine/check';

describe('maths checks', () => {
  it('reads common LaTeX', () => {
    expect(texToPlain('\\frac{a}{b} + \\sqrt{x}')).toContain('((a)/(b))');
    expect(texToPlain('\\text{area}')).toBeNull();
  });
  it('passes steps that follow', () => {
    expect(checkStep('2x + 5 = 11', '2x = 6')).toBeNull();
    expect(checkStep('2x = 6', 'x = 3')).toBeNull();
    expect(checkStep('(a+b)^2', 'a^2 + 2ab + b^2')).toBeNull();
    expect(checkStep('\\frac{x}{2} = 4', 'x = 8')).toBeNull();
    expect(checkStep('x^2 = 9', 'x = 3 \\text{ or } x = -3')).toBeNull();
    expect(checkStep('\\sin^2 x + \\cos^2 x', '1')).toBeNull();
  });
  it('finds steps that do not', () => {
    expect(checkStep('(a+b)^2', 'a^2 + b^2')).toMatch(/not equal/);
    expect(checkStep('2x + 5 = 11', '2x = 16')).toMatch(/same solutions/);
    expect(checkStep('x^2 = 9', 'x = 3')).toMatch(/same solutions/);
  });
});
