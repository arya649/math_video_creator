// 3D points, the camera's view, and the shapes of solids. Space is in the
// script's own units: x to the right, y away from the viewer, z up.

export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp3 = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
export const centroid = (pts: V3[]): V3 => mul(pts.reduce(add, [0, 0, 0] as V3), 1 / Math.max(1, pts.length));

/** A face's normal (Newell's method: fine for any flat polygon). */
export function normalOf(pts: V3[]): V3 {
  let n: V3 = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
  }
  return norm(n);
}

/** Turn p about the line through a in direction axis (unit) by angle. */
export function rotateAbout(p: V3, a: V3, axis: V3, angle: number): V3 {
  const v = sub(p, a);
  const c = Math.cos(angle), s = Math.sin(angle);
  const r = add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, dot(axis, v) * (1 - c)));
  return add(a, r);
}

// ---- The camera ----

export interface Cam { elevation: number; angle: number; distance: number; target: V3 }

export const FOV = (35 * Math.PI) / 180;

export interface Eye { eye: V3; right: V3; up: V3; fwd: V3; focal: number }

/** Where the camera is and which way it faces. Angles in degrees. */
export function eyeOf(c: Cam, frameH: number): Eye {
  const th = (c.angle * Math.PI) / 180, ph = (c.elevation * Math.PI) / 180;
  const dir: V3 = [Math.sin(th) * Math.cos(ph), -Math.cos(th) * Math.cos(ph), Math.sin(ph)];
  const eye = add(c.target, mul(dir, c.distance));
  const fwd = mul(dir, -1);
  let right = cross(fwd, [0, 0, 1]);
  if (len(right) < 1e-6) right = [1, 0, 0];
  right = norm(right);
  const up = cross(right, fwd);
  return { eye, right, up, fwd, focal: frameH / 2 / Math.tan(FOV / 2) };
}

/** A point on the sheet (sheet units) and its depth; depth <= 0 is behind the camera. */
export function project(e: Eye, p: V3): [number, number, number] {
  const q = sub(p, e.eye);
  const z = dot(q, e.fwd);
  const k = e.focal / Math.max(1e-6, z);
  return [dot(q, e.right) * k, dot(q, e.up) * k, z];
}

// ---- Solids as lists of flat faces ----

export interface Mesh {
  faces: V3[][];
  /** Closed: back faces can be left out. */
  closed: boolean;
  /** Flat-faced (a polyhedron): edges are drawn and it can be unfolded. */
  flat: boolean;
  /** For smooth solids: which faces carry grid lines when edges are asked for. */
  lines?: V3[][];
}

export function boxMesh(w: number, d: number, h: number): Mesh {
  const x = w / 2, y = d / 2;
  const v: V3[] = [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [-x, -y, h], [x, -y, h], [x, y, h], [-x, y, h]];
  const f = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return { faces: f.map((ix) => ix.map((i) => v[i])), closed: true, flat: true };
}

export function prismMesh(sides: number, r: number, h: number, apex = false, top = 1): Mesh {
  const ring = (z: number, rr: number): V3[] => Array.from({ length: sides }, (_, k) => {
    const a = Math.PI / 2 + Math.PI / sides + (2 * Math.PI * k) / sides;
    return [rr * Math.cos(a), rr * Math.sin(a), z];
  });
  const bottom = ring(0, r);
  const faces: V3[][] = [[...bottom].reverse()];
  if (apex) {
    const tip: V3 = [0, 0, h];
    for (let k = 0; k < sides; k++) faces.push([bottom[k], bottom[(k + 1) % sides], tip]);
  } else {
    const upper = ring(h, r * top);
    faces.push(upper);
    for (let k = 0; k < sides; k++) faces.push([bottom[k], bottom[(k + 1) % sides], upper[(k + 1) % sides], upper[k]]);
  }
  return { faces, closed: true, flat: true };
}

/** A smooth solid traced by u and v, as a grid of small faces. */
export function gridMesh(f: (u: number, v: number) => V3, nu: number, nv: number, closed: boolean, lineEvery = 4): Mesh {
  const faces: V3[][] = [];
  const lines: V3[][] = [];
  const P = Array.from({ length: nu + 1 }, (_, i) => Array.from({ length: nv + 1 }, (_, j) => f(i / nu, j / nv)));
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) faces.push([P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]]);
  for (let i = 0; i <= nu; i += lineEvery) lines.push(P[i]);
  for (let j = 0; j <= nv; j += lineEvery) lines.push(P.map((row) => row[j]));
  return { faces, closed, flat: false, lines };
}

export function sphereMesh(r: number): Mesh {
  return gridMesh((u, v) => {
    const th = u * 2 * Math.PI, ph = -Math.PI / 2 + v * Math.PI;
    return [r * Math.cos(ph) * Math.cos(th), r * Math.cos(ph) * Math.sin(th), r + r * Math.sin(ph)];
  }, 32, 18, true, 4);
}

export function cylinderMesh(r: number, h: number, cone = false): Mesh {
  const n = 40;
  const side = gridMesh((u, v) => {
    const a = u * 2 * Math.PI, rr = cone ? r * (1 - v) : r;
    return [rr * Math.cos(a), rr * Math.sin(a), v * h];
  }, n, 1, true, 5);
  const ring = (z: number): V3[] => Array.from({ length: n }, (_, k) => [r * Math.cos((2 * Math.PI * k) / n), r * Math.sin((2 * Math.PI * k) / n), z]);
  const faces = [...side.faces, ring(0).reverse()];
  if (!cone) faces.push(ring(h));
  return { faces, closed: true, flat: false, lines: [[...ring(0), ring(0)[0]], ...(cone ? [] : [[...ring(h), ring(h)[0]]])] };
}

export function torusMesh(R: number, r: number): Mesh {
  return gridMesh((u, v) => {
    const a = u * 2 * Math.PI, b = v * 2 * Math.PI;
    return [(R + r * Math.cos(b)) * Math.cos(a), (R + r * Math.cos(b)) * Math.sin(a), r + r * Math.sin(b)];
  }, 40, 20, true, 4);
}

/** A convex polyhedron from its corners: every face is found from the corners. */
export function hullMesh(pts: V3[]): Mesh {
  const faces: V3[][] = [];
  const seen = new Set<string>();
  const c = centroid(pts);
  const n = pts.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    let nrm = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i]));
    if (len(nrm) < 1e-9) continue;
    nrm = norm(nrm);
    const d = dot(nrm, pts[i]);
    let above = 0, below = 0;
    for (const p of pts) { const s = dot(nrm, p) - d; if (s > 1e-7) above++; else if (s < -1e-7) below++; }
    if (above && below) continue;
    if (above) { nrm = mul(nrm, -1); }
    const key = nrm.map((x) => String(Math.round(x * 1000) / 1000 + 0)).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const on = pts.filter((p) => Math.abs(dot(nrm, p) - dot(nrm, pts[i])) < 1e-6);
    // The face's corners in order round its middle.
    const m = centroid(on);
    const a = norm(sub(on[0], m)), b = cross(nrm, a);
    on.sort((p, q) => Math.atan2(dot(sub(p, m), b), dot(sub(p, m), a)) - Math.atan2(dot(sub(q, m), b), dot(sub(q, m), a)));
    faces.push(on);
  }
  void c;
  return { faces, closed: true, flat: true };
}

const PHI = (1 + Math.sqrt(5)) / 2;

export function platonic(kind: 'tetrahedron' | 'octahedron' | 'dodecahedron' | 'icosahedron', r: number): Mesh {
  let pts: V3[];
  switch (kind) {
    case 'tetrahedron': pts = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]; break;
    case 'octahedron': pts = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]; break;
    case 'icosahedron': pts = [];
      for (const a of [-1, 1]) for (const b of [-PHI, PHI]) pts.push([0, a, b], [a, b, 0], [b, 0, a]);
      break;
    default: pts = [];
      for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) pts.push([a, b, c]);
      for (const a of [-1, 1]) for (const b of [-1, 1]) pts.push([0, a / PHI, b * PHI], [a / PHI, b * PHI, 0], [b * PHI, 0, a / PHI]);
  }
  const k = r / len(pts[0]);
  pts = pts.map((p) => mul(p, k));
  // Resting on a face: the lowest face turned flat to the floor.
  let m = hullMesh(pts);
  const lowest = m.faces.reduce((best, f) => (normalOf(f)[2] < normalOf(best)[2] ? f : best));
  const n0 = normalOf(lowest);
  const axis = cross(n0, [0, 0, -1]);
  if (len(axis) > 1e-6) {
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(n0, [0, 0, -1]))));
    pts = pts.map((p) => rotateAbout(p, [0, 0, 0], norm(axis), ang));
    m = hullMesh(pts);
  }
  const zmin = Math.min(...pts.map((p) => p[2]));
  return { ...m, faces: m.faces.map((f) => f.map((p) => [p[0], p[1], p[2] - zmin] as V3)) };
}

// ---- Cutting ----

/** The part of a face on one side of the plane n·p = d (side +1 or -1). */
export function clipFace(face: V3[], n: V3, d: number, side: 1 | -1): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < face.length; i++) {
    const a = face[i], b = face[(i + 1) % face.length];
    const sa = side * (dot(n, a) - d), sb = side * (dot(n, b) - d);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) out.push(lerp3(a, b, sa / (sa - sb)));
  }
  return out;
}

/** Where the plane cuts a solid, as one face (the corners in order round the middle). */
export function section(faces: V3[][], n: V3, d: number): V3[] {
  const pts: V3[] = [];
  for (const f of faces) for (let i = 0; i < f.length; i++) {
    const a = f[i], b = f[(i + 1) % f.length];
    const sa = dot(n, a) - d, sb = dot(n, b) - d;
    if ((sa > 0) !== (sb > 0)) pts.push(lerp3(a, b, sa / (sa - sb)));
  }
  if (pts.length < 3) return [];
  const m = centroid(pts);
  let a = sub(pts[0], m);
  if (len(a) < 1e-9) a = sub(pts[1], m);
  a = norm(a);
  const b = cross(n, a);
  const ang = (p: V3) => Math.atan2(dot(sub(p, m), b), dot(sub(p, m), a));
  pts.sort((p, q) => ang(p) - ang(q));
  // Drop corners that repeat (where a cut passes through a corner).
  return pts.filter((p, i) => i === 0 || len(sub(p, pts[i - 1])) > 1e-6);
}

// ---- Unfolding a polyhedron into its net ----

export interface Net {
  /** The faces, folded by u from 0 (closed) to 1 (flat). */
  at(u: number): V3[][];
}

const key3 = (p: V3) => p.map((x) => x.toFixed(5)).join(',');

export function netOf(mesh: Mesh): Net {
  const faces = mesh.faces;
  const n = faces.length;
  // Faces sharing an edge.
  const edgeOwner = new Map<string, { face: number; a: V3; b: V3 }>();
  const nbrs: { to: number; a: V3; b: V3 }[][] = faces.map(() => []);
  faces.forEach((f, i) => f.forEach((p, k) => {
    const q = f[(k + 1) % f.length];
    const kk = [key3(p), key3(q)].sort().join('|');
    const o = edgeOwner.get(kk);
    if (o) { nbrs[i].push({ to: o.face, a: p, b: q }); nbrs[o.face].push({ to: i, a: p, b: q }); } else edgeOwner.set(kk, { face: i, a: p, b: q });
  }));
  // Start from the bottom face; spread out breadth first.
  const root = faces.reduce((best, f, i) => (centroid(f)[2] < centroid(faces[best])[2] ? i : best), 0);
  const parent: { of: number; a: V3; b: V3 }[] = Array(n);
  const order = [root];
  const seen = new Set([root]);
  for (let qi = 0; qi < order.length; qi++) {
    const i = order[qi];
    for (const e of nbrs[i]) if (!seen.has(e.to)) { seen.add(e.to); parent[e.to] = { of: i, a: e.a, b: e.b }; order.push(e.to); }
  }
  // How far each face turns about its hinge to lie flat with its parent.
  const turn: number[] = Array(n).fill(0);
  for (const i of order) {
    if (i === root) continue;
    const p = parent[i];
    const axis = norm(sub(p.b, p.a));
    const np = normalOf(faces[p.of]), nc = normalOf(faces[i]);
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(np, nc))));
    const plus = normalOf(faces[i].map((q) => rotateAbout(q, p.a, axis, ang)));
    turn[i] = dot(plus, np) > 0.999 ? ang : -ang;
  }
  return {
    at(u) {
      const placed: V3[][] = Array(n);
      const moves: ((p: V3) => V3)[] = Array(n);
      for (const i of order) {
        if (i === root) { moves[i] = (q) => q; placed[i] = faces[i]; continue; }
        const p = parent[i];
        const axis = norm(sub(p.b, p.a));
        const up = moves[p.of];
        const ang = turn[i] * u;
        moves[i] = (q) => up(rotateAbout(q, p.a, axis, ang));
        placed[i] = faces[i].map(moves[i]);
      }
      return placed;
    },
  };
}
