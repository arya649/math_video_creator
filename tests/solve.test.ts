import { describe, expect, it } from 'vitest';
import { solveSteps } from '../src/engine/actions/extras';
import { checkStep } from '../src/engine/check';
import { compileMovie } from '../src/engine/movie';

const cases: [string, string][] = [
  ['3x + 5 = 20', 'auto'], ['2x - 7 = 5x + 2', 'auto'], ['x / 2 + 1 = 4', 'auto'],
  ['x^2 - 5x + 6 = 0', 'auto'], ['2x^2 = 8', 'factor'], ['x^2 + 2x - 1 = 0', 'formula'], ['x^2 + 6x + 4 = 0', 'complete_square'],
];

describe('solve', () => {
  it('writes steps that each follow from the one before', () => {
    for (const [text, method] of cases) {
      const lines = solveSteps(text, undefined, method, 'en', 'w');
      expect(lines.length).toBeGreaterThan(1);
      for (let i = 1; i < lines.length; i++) expect(checkStep(lines[i - 1].tex, lines[i].tex), `${text}: ${lines[i - 1].tex} → ${lines[i].tex}`).toBeNull();
    }
  });
  it('turns the sign round when dividing by a negative', () => {
    const lines = solveSteps('-2x + 1 < 7', undefined, 'auto', 'en', 'w');
    expect(lines[lines.length - 1].tex).toBe('x > -3');
    expect(lines[lines.length - 1].note).toMatch(/turns round/);
  });
  it('gives exact answers with roots', () => {
    expect(solveSteps('x^2 + 2x - 1 = 0', undefined, 'formula', 'en', 'w').pop()!.tex).toBe('x = -1 \\pm \\sqrt{2}');
  });
  it('writes reasons in the video\'s language', () => {
    expect(solveSteps('3x + 5 = 20', undefined, 'auto', 'hi', 'w')[1].note).toMatch(/घटाएँ/);
  });
  it('compiles solve and evaluate without warnings', () => {
    const m = compileMovie({ scenes: [{ beats: [{ at: 0, do: 'solve', math: '3x + 5 = 20' }, { at: 6, do: 'evaluate', math: '2 + 3 * (4 + 1)', steps: true, position: 'bottom' }] }] });
    expect(m.warnings).toEqual([]);
    expect(m.scenes[0].world.found.length).toBe(1);
  });
});
