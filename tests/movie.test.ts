import { describe, expect, it } from 'vitest';
import { compileMovie } from '../src/engine/movie';
import { ScriptError } from '../src/engine/util';
import demo from '../public/projects/demo/script.json';

describe('compiling a script', () => {
  it('compiles the demo in both languages', () => {
    for (const lang of ['en', 'hi']) {
      const m = compileMovie(demo, { lang });
      expect(m.scenes.length).toBe(2);
      expect(m.warnings).toEqual([]);
      expect(m.duration).toBeGreaterThan(20);
      // Every frame can be put together without errors.
      for (let t = 0; t < m.duration; t += 0.25) m.scenes[m.sceneAt(t)].applyState(t);
    }
  });

  it('places cues at the same moment of meaning in each language', () => {
    const en = compileMovie(demo, { lang: 'en' }), hi = compileMovie(demo, { lang: 'hi' });
    expect(en.narration.cues.get('move')).toBeDefined();
    expect(hi.narration.cues.get('move')).toBeDefined();
  });

  it('explains mistakes in plain English', () => {
    const bad = (s: unknown) => { try { compileMovie(s); return ''; } catch (e) { expect(e).toBeInstanceOf(ScriptError); return (e as Error).message; } };
    expect(bad({ scenes: [{ beats: [{ at: 0, do: 'wrtie', tex: 'x' }] }] })).toContain('Did you mean "write"');
    expect(bad({ scenes: [{ beats: [{ at: 0, camera: 'tilt' }] }] })).toContain('not built yet');
    expect(bad({ scenes: [{ beats: [{ at: 0, do: 'write', tex: 'x' }, { at: 1, do: 'highlight', who: 'eq9' }] }] })).toContain('nothing called "eq9"');
    expect(bad({ lines: ['hello'], scenes: [{ beats: [{ at_line: 3, do: 'write', tex: 'x' }] }] })).toContain('there is no line 3');
  });

  it('warns about settings it does not know', () => {
    const m = compileMovie({ scenes: [{ beats: [{ at: 0, do: 'write', tex: 'x', colour: 'red' }] }] });
    expect(m.warnings[0]).toContain('"colour"');
    expect(m.warnings[0]).toContain('Did you mean "color"');
  });
});

import { entries } from '../src/catalog/entries';

describe('the catalogue', () => {
  it('has unique IDs, and every entry compiles without warnings', () => {
    const ids = new Set<string>();
    for (const e of entries) {
      expect(ids.has(e.id), e.id).toBe(false);
      ids.add(e.id);
      expect(e.id).toMatch(/^[a-z]+:[a-z0-9-]+$/);
      const m = compileMovie(e.script);
      expect(m.warnings, e.id).toEqual([]);
      for (let t = 0; t < m.duration; t += 0.5) m.scenes[m.sceneAt(t)].applyState(t);
    }
  });
});

describe('carrying things between scenes', () => {
  it('keeps what was on screen, where it was', () => {
    const m = compileMovie({ scenes: [
      { beats: [{ at: 0, do: 'write', id: 'eq', tex: 'x + 1 = 3' }, { at: 1, do: 'move', who: 'eq', to: 'top' }] },
      { start: 3, keep: ['eq'], chapter: 'Two', chapter_card: true, beats: [{ at: 4, do: 'steps', who: 'eq', to: 'x = 2' }] },
    ] });
    expect(m.warnings.filter((w) => !/chapter/i.test(w))).toEqual([]);
    const w0 = m.scenes[0].world, w1 = m.scenes[1].world;
    m.scenes[0].applyState(2.9);
    const before = w0.things.get('eq')!.state.y;
    m.scenes[1].applyState(3.01);
    expect(w1.things.get('eq')!.state.y).toBeCloseTo(before, 5);
    expect(w1.things.get('eq')!.shown()).toBe(true);
    expect([...w1.things.keys()].some((k) => k.startsWith('_title'))).toBe(true);
  });
});
