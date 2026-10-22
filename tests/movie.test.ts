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
    expect(bad({ scenes: [{ world: 'graph', beats: [] }] })).toContain('not built yet');
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
