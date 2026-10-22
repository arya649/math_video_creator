import { describe, expect, it } from 'vitest';
import { circleThrough, incircle, meet, lineVal, angleAt } from '../src/engine/geometry/geo';
import { compileMovie } from '../src/engine/movie';

describe('geometry', () => {
  it('finds where things meet', () => {
    const p = meet(lineVal([0, 0], [1, 1]), lineVal([0, 2], [2, 0]));
    expect(p[0][0]).toBeCloseTo(1);
    const c = meet({ k: 'circle', c: [0, 0], r: 1 }, lineVal([-2, 0], [2, 0]));
    expect(c.map((q) => q[0]).sort()).toEqual([-1, 1]);
    expect(circleThrough([1, 0], [-1, 0], [0, 1])!.r).toBeCloseTo(1);
    expect(incircle([0, 0], [3, 0], [0, 4]).r).toBeCloseTo(1);
    expect((angleAt([1, 0], [0, 0], [0, 1]) * 180) / Math.PI).toBeCloseTo(90);
  });
  it('keeps a construction true while a corner is dragged', () => {
    const m = compileMovie({ scenes: [{ world: 'geometry', beats: [
      { at: 0, do: 'triangle', id: 'tri', size: 4 },
      { at: 1, do: 'construct', id: 'O', make: 'circumcenter', of: 'tri' },
      { at: 2, do: 'drag', who: 'C', to: [3, 3], duration: 2 },
    ] }] });
    const w = m.scenes[0].world;
    for (const t of [1.5, 3, 5]) {
      m.scenes[0].applyState(t);
      w.now = t;
      const O = (w.geo.get('O')!.at(t) as { p: [number, number] }).p;
      const tri = w.geo.get('tri')!.at(t) as { pts: [number, number][] };
      const d = tri.pts.map((p) => Math.hypot(p[0] - O[0], p[1] - O[1]));
      expect(d[0]).toBeCloseTo(d[1]);
      expect(d[1]).toBeCloseTo(d[2]);
    }
  });
});
