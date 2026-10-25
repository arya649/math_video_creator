import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileMovie } from '../src/engine/movie';
import { ScriptError } from '../src/engine/util';
import { boxMesh, netOf, platonic, prismMesh, section } from '../src/engine/space/geo3d';

const project = JSON.parse(readFileSync(new URL('../public/projects/space/script.json', import.meta.url), 'utf8'));
const problem = (s: unknown) => { try { compileMovie(s); return ''; } catch (e) { expect(e).toBeInstanceOf(ScriptError); return (e as Error).message; } };
const space = (beats: unknown[]) => ({ scenes: [{ world: 'space', beats }] });

describe('the space world', () => {
  it('makes the sample in both languages without warnings', () => {
    for (const lang of ['en', 'hi']) expect(compileMovie(project, { lang }).warnings).toEqual([]);
  });
  it('builds the Platonic solids with the right faces', () => {
    expect(platonic('tetrahedron', 1).faces.length).toBe(4);
    expect(platonic('octahedron', 1).faces.length).toBe(8);
    expect(platonic('dodecahedron', 1).faces.length).toBe(12);
    expect(platonic('icosahedron', 1).faces.length).toBe(20);
    expect(Math.min(...platonic('icosahedron', 1).faces.flat().map((p) => p[2]))).toBeCloseTo(0, 6);
  });
  it('unfolds nets flat onto the floor', () => {
    for (const m of [boxMesh(2, 2, 2), prismMesh(5, 1, 2), prismMesh(4, 1, 2, true), platonic('octahedron', 1)]) {
      const flat = netOf(m).at(1);
      for (const p of flat.flat()) expect(Math.abs(p[2])).toBeLessThan(1e-6);
    }
  });
  it('cuts a cube in a square', () => {
    expect(section(boxMesh(2, 2, 2).faces, [0, 0, 1], 1).length).toBe(4);
  });
  it('explains mistakes plainly', () => {
    expect(problem(space([{ at: 0, do: 'solid', id: 's', shape: 'sphere' }, { at: 1, do: 'net', who: 's' }]))).toMatch(/curved faces/);
    expect(problem({ scenes: [{ beats: [{ at: 0, do: 'solid', shape: 'cube' }] }] })).toMatch(/space world/);
    expect(problem({ scenes: [{ beats: [{ at: 0, camera: 'orbit' }] }] })).toMatch(/space scenes/);
    expect(problem(space([{ at: 0, do: 'surface', math: 'a * x' }]))).toMatch(/not a value/);
    expect(problem(space([{ at: 0, do: 'plane3d', math: 'x^2 + y = 1' }]))).toMatch(/not a flat plane/);
  });
});
