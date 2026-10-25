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

/** A tiny .glb: a pyramid of four triangles, one red material. */
function pyramidGlb(): ArrayBuffer {
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0]);
  const idx = new Uint16Array([0, 1, 2, 0, 3, 1, 0, 2, 3, 1, 3, 2]);
  const bin = new Uint8Array(pos.byteLength + idx.byteLength);
  bin.set(new Uint8Array(pos.buffer), 0);
  bin.set(new Uint8Array(idx.buffer), pos.byteLength);
  const json = JSON.stringify({
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, scale: [2, 2, 2] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 1] } }],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength }, { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: 'VEC3' }, { bufferView: 1, componentType: 5123, count: 12, type: 'SCALAR' }],
  });
  const pad = (n: number) => (4 - (n % 4)) % 4;
  const jb = new TextEncoder().encode(json + ' '.repeat(pad(json.length)));
  const binPadded = new Uint8Array(bin.byteLength + pad(bin.byteLength));
  binPadded.set(bin);
  const total = 12 + 8 + jb.byteLength + 8 + binPadded.byteLength;
  const out = new DataView(new ArrayBuffer(total));
  out.setUint32(0, 0x46546c67, true); out.setUint32(4, 2, true); out.setUint32(8, total, true);
  out.setUint32(12, jb.byteLength, true); out.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out.buffer, 20, jb.byteLength).set(jb);
  const o2 = 20 + jb.byteLength;
  out.setUint32(o2, binPadded.byteLength, true); out.setUint32(o2 + 4, 0x004e4942, true);
  new Uint8Array(out.buffer, o2 + 8, binPadded.byteLength).set(binPadded);
  return out.buffer;
}

describe('3D models', () => {
  it('reads a .glb, sizes it and keeps its colours', () => {
    const m = compileMovie({ models: [{ name: 'p', file: 'p.glb', height: 3 }], scenes: [{ world: 'space', beats: [{ at: 0, do: 'solid', id: 'm', model: 'p' }] }] }, { binaries: new Map([['p.glb', pyramidGlb()]]) });
    expect(m.warnings).toEqual([]);
    const o = m.scenes[0].world.space!.objects[0];
    const [lo, hi] = o.bounds();
    expect(hi[2] - lo[2]).toBeCloseTo(3, 5);
    expect(lo[2]).toBeCloseTo(0, 5);
    const faces = o.prims(1, 1).filter((p) => p.kind === 'face');
    expect(faces.length).toBe(4);
    expect((faces[0] as { color: string }).color).toBe('rgb(255,0,0)');
  });
});
