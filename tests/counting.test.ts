import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileMovie } from '../src/engine/movie';
import { ScriptError } from '../src/engine/util';

const project = JSON.parse(readFileSync(new URL('../public/projects/counting/script.json', import.meta.url), 'utf8'));
const scene = (beats: unknown[], extra: Record<string, unknown> = {}) => ({ scenes: [{ world: 'counting', ...extra, beats }] });
const problem = (s: unknown) => { try { compileMovie(s); return ''; } catch (e) { expect(e).toBeInstanceOf(ScriptError); return (e as Error).message; } };

describe('the counting world', () => {
  it('makes the sample in both languages without warnings', () => {
    for (const lang of ['en', 'hi']) expect(compileMovie(project, { lang }).warnings).toEqual([]);
  });
  it('explains mistakes plainly', () => {
    expect(problem(scene([{ at: 0, do: 'jump', from: 0, by: 2 }]))).toMatch(/no number line yet/);
    expect(problem(scene([{ at: 0, do: 'fraction', id: 'f', parts: 4, shade: 3 }, { at: 1, do: 'split', who: 'f', into: 6 }]))).toMatch(/multiple of the 4 parts/);
    expect(problem(scene([{ at: 0, do: 'blocks', id: 'b', number: 15 }, { at: 1, do: 'regroup', who: 'b', carry: true }]))).toMatch(/needs ten ones/);
    expect(problem(scene([{ at: 0, do: 'cards', results: ['Z9'] }]))).toMatch(/rank/);
    expect(problem({ scenes: [{ beats: [{ at: 0, do: 'dots', count: 3 }] }] })).toMatch(/counting world/);
  });
  it('throws the same random results every time', () => {
    const a = compileMovie(scene([{ at: 0, do: 'coin', random: 20 }]));
    const b = compileMovie(scene([{ at: 0, do: 'coin', random: 20 }]));
    expect(a.duration).toBe(b.duration);
  });
  it('names every path of a tree', () => {
    const m = compileMovie(scene([{ at: 0, do: 'tree', id: 't', levels: [[{ label: 'H' }, { label: 'T' }], [{ label: 'H' }, { label: 'T' }]] }]));
    const w = m.scenes[0].world;
    for (const id of ['t.H', 't.T', 't.HT', 't.TH']) expect(w.things.has(id)).toBe(true);
    expect(w.things.get('t.HT')!.members.length).toBe(2);
  });
});
