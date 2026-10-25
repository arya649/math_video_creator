// Reading 3D models: .glb files, and .gltf files whose data is inside them.
// Only the shape and base colours are read: triangles of every mesh, placed
// by the model's own node transforms, turned so its "up" is our z.

import { ScriptError } from '../util';
import type { V3 } from './geo3d';

export interface ModelMesh { faces: V3[][]; colors: (string | undefined)[] }

interface GltfJson {
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  meshes?: { primitives: { attributes: { POSITION?: number }; indices?: number; mode?: number; material?: number }[] }[];
  accessors?: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string }[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[];
  buffers?: { uri?: string; byteLength: number }[];
  materials?: { pbrMetallicRoughness?: { baseColorFactor?: number[] } }[];
}

type M4 = number[];
const I4: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function mul4(a: M4, b: M4): M4 {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]): M4 {
  const [x, y, z, w] = q;
  return [
    (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
    (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
    (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** Read a model file. At most `maxFaces` triangles are kept (evenly), so painting stays quick. */
export function readModel(data: ArrayBuffer, name: string, where: string, maxFaces = 6000): ModelMesh {
  let json: GltfJson;
  let bin: ArrayBuffer | undefined;
  const view = new DataView(data);
  if (data.byteLength >= 12 && view.getUint32(0, true) === 0x46546c67) {
    // .glb: a header, then a JSON chunk and a binary chunk.
    let off = 12;
    json = {} as GltfJson;
    while (off + 8 <= data.byteLength) {
      const len = view.getUint32(off, true), type = view.getUint32(off + 4, true);
      const chunk = data.slice(off + 8, off + 8 + len);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
      else if (type === 0x004e4942) bin = chunk;
      off += 8 + len;
    }
  } else {
    try { json = JSON.parse(new TextDecoder().decode(data)); } catch { throw new ScriptError(`"${name}" is not a .glb or .gltf model.`, where); }
  }
  const buffers = (json.buffers ?? []).map((b, i) => {
    if (b.uri === undefined) { if (!bin) throw new ScriptError(`"${name}" is missing its data.`, where); return bin; }
    const m = b.uri.match(/^data:[^;]*;base64,(.*)$/);
    if (!m) throw new ScriptError(`"${name}" keeps its data in another file (${b.uri}); save the model as one .glb file instead.`, where);
    const raw = atob(m[1]);
    const out = new Uint8Array(raw.length);
    for (let k = 0; k < raw.length; k++) out[k] = raw.charCodeAt(k);
    void i;
    return out.buffer;
  });
  const read = (ai: number): number[][] => {
    const a = json.accessors![ai];
    const bv = json.bufferViews![a.bufferView ?? 0];
    const buf = buffers[bv.buffer];
    const n = COMPONENTS[a.type] ?? 1;
    const size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType] ?? 4;
    const stride = bv.byteStride ?? n * size;
    const dv = new DataView(buf, (bv.byteOffset ?? 0) + (a.byteOffset ?? 0));
    const get = (o: number) => a.componentType === 5126 ? dv.getFloat32(o, true) : a.componentType === 5125 ? dv.getUint32(o, true) : a.componentType === 5123 ? dv.getUint16(o, true) : a.componentType === 5122 ? dv.getInt16(o, true) : a.componentType === 5121 ? dv.getUint8(o) : dv.getInt8(o);
    return Array.from({ length: a.count }, (_, i) => Array.from({ length: n }, (_, c) => get(i * stride + c * size)));
  };
  const faces: V3[][] = [];
  const colors: (string | undefined)[] = [];
  const visit = (ni: number, parent: M4) => {
    const node = json.nodes![ni];
    const m = mul4(parent, node.matrix ?? trs(node.translation, node.rotation, node.scale));
    if (node.mesh !== undefined) {
      for (const prim of json.meshes![node.mesh].primitives) {
        if ((prim.mode ?? 4) !== 4 || prim.attributes.POSITION === undefined) continue;
        const pos = read(prim.attributes.POSITION).map(([x, y, z]) => {
          const p = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
          // glTF's up is y; ours is z (and its forward becomes our "away").
          return [p[0], -p[2], p[1]] as V3;
        });
        const idx = prim.indices !== undefined ? read(prim.indices).map((v) => v[0]) : pos.map((_, i) => i);
        const f = json.materials?.[prim.material ?? -1]?.pbrMetallicRoughness?.baseColorFactor;
        const col = f ? `rgb(${Math.round(f[0] * 255)},${Math.round(f[1] * 255)},${Math.round(f[2] * 255)})` : undefined;
        for (let i = 0; i + 2 < idx.length; i += 3) { faces.push([pos[idx[i]], pos[idx[i + 1]], pos[idx[i + 2]]]); colors.push(col); }
      }
    }
    for (const c of node.children ?? []) visit(c, m);
  };
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? (json.nodes ?? []).map((_, i) => i);
  for (const r of roots) visit(r, I4);
  if (!faces.length) throw new ScriptError(`"${name}" has no triangles to draw.`, where);
  if (faces.length <= maxFaces) return { faces, colors };
  const step = faces.length / maxFaces;
  const keep = Array.from({ length: maxFaces }, (_, i) => Math.floor(i * step));
  return { faces: keep.map((i) => faces[i]), colors: keep.map((i) => colors[i]) };
}
