// The space world: 3D axes, surfaces, solids, solids of revolution,
// slicing, stacks of slices, nets, vectors, planes, lines, points and curves,
// and the camera shots that circle round them.

import { evaluate } from 'mathjs';
import { type Ctx, arrive, color, natural, num, readAppear, registerAction, sizeOf, str } from '../actions';
import { ticksFor } from '../graph/axes';
import { type Scope, curveOf, fn, namesIn } from '../graph/expr';
import { withAlpha } from '../color';
import { Thing } from '../thing';
import { ScriptError, choice, clamp, ease, isObject } from '../util';
import type { SceneWorld } from '../world';
import { liveThing } from './graph';
import {
  type Cam, type Mesh, type V3, add, boxMesh, centroid, clipFace, cross, cylinderMesh, dot, gridMesh, len, lerp3, mul, netOf, norm,
  platonic, prismMesh, section, sphereMesh, sub, torusMesh,
} from '../space/geo3d';
import { type Light, type Obj3D, type Prim, Space, heightColor } from '../space/space';
import { readModel } from '../space/gltf';

const SPACE: ['space'] = ['space'];

// ---- Helpers ----

function spaceOf(ctx: Ctx): Space {
  const s = ctx.world.space as Space | undefined;
  if (!s) throw new ScriptError('this works only in a space scene.', ctx.where);
  return s;
}

export function v3(v: unknown, where: string): V3 {
  if (Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number')) return v as V3;
  throw new ScriptError('must be a point in space: [x, y, z].', where);
}

function range(v: unknown, where: string, fallback: [number, number]): [number, number] {
  if (v === undefined) return fallback;
  if (Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number' && v[1] > v[0]) return [v[0], v[1]];
  throw new ScriptError('must be [from, to], with to above from.', where);
}

function boundsOf(pts: V3[]): [V3, V3] {
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { if (Number.isFinite(p[k])) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } }
  return [lo, hi];
}

/** Add a 3D object: a thing (so fades, colours and removing work) that the painter draws. */
function addObject(ctx: Ctx, id: string, o: Omit<Obj3D, 'thing'>): Obj3D {
  const th = new Thing(id, 'shape', [], [0, 0]);
  ctx.world.add(th, ctx.where);
  const obj: Obj3D = { ...o, thing: th };
  spaceOf(ctx).objects.push(obj);
  return obj;
}

const objOf = (ctx: Ctx, key = 'who'): Obj3D => {
  const th = ctx.world.get(ctx.spec[key], `${ctx.where}.${key}`);
  const o = spaceOf(ctx).objects.find((x) => x.thing === th);
  if (!o) throw new ScriptError(`"${th.id}" is not a 3D object.`, `${ctx.where}.${key}`);
  return o;
};

/** The box of the scene's axes, or a cube round the middle. */
function box(world: SceneWorld): { x: [number, number]; y: [number, number]; z: [number, number] } {
  return (world.space as Space & { axes?: { x: [number, number]; y: [number, number]; z: [number, number] } }).axes ?? { x: [-3, 3], y: [-3, 3], z: [-3, 3] };
}

function faceLines(faces: V3[][], col: string, width: number): Prim[] {
  const out: Prim[] = [];
  const seen = new Set<string>();
  const k = (p: V3) => p.map((x) => x.toFixed(4)).join(',');
  for (const f of faces) for (let i = 0; i < f.length; i++) {
    const a = f[i], b = f[(i + 1) % f.length];
    const kk = [k(a), k(b)].sort().join('|');
    if (seen.has(kk)) continue;
    seen.add(kk);
    out.push({ kind: 'line', a, b, color: col, width, front: true });
  }
  return out;
}

const SPACE_LIGHTS = ['soft', 'studio', 'dramatic', 'flat'] as const;

// ---- Axes ----

function makeAxes(ctx: Ctx, spec: Record<string, unknown>, where: string, id: string): Obj3D {
  const { world } = ctx;
  const x = range(spec.x, `${where}.x`, [-3, 3]), y = range(spec.y, `${where}.y`, [-3, 3]), z = range(spec.z, `${where}.z`, [-3, 3]);
  (spaceOf(ctx) as Space & { axes?: unknown }).axes = { x, y, z };
  const ink = color({ ...ctx, spec }, 'color', world.theme.ink)!;
  const faint = withAlpha(ink, 0.18);
  const numbers = spec.numbers !== false;
  const names = spec.names !== false;
  const grid = spec.grid === true || spec.grid === 'faint';
  return addObject(ctx, id, {
    center: () => [0, 0, 0],
    bounds: () => [[x[0], y[0], z[0]], [x[1], y[1], z[1]]],
    prims: (_t, drawn) => {
      const out: Prim[] = [];
      const u = ease('smooth', drawn);
      const axis = (from: V3, to: V3) => { const end = lerp3(from, to, u); out.push({ kind: 'arrow', a: from, b: end, color: ink, width: 3 }); };
      axis([x[0], 0, 0], [x[1] + 0.4, 0, 0]);
      axis([0, y[0], 0], [0, y[1] + 0.4, 0]);
      axis([0, 0, z[0]], [0, 0, z[1] + 0.4]);
      if (u < 1) return out;
      if (grid) {
        for (let k = Math.ceil(x[0]); k <= x[1]; k++) out.push({ kind: 'line', a: [k, y[0], 0], b: [k, y[1], 0], color: faint, width: 1.2 });
        for (let k = Math.ceil(y[0]); k <= y[1]; k++) out.push({ kind: 'line', a: [x[0], k, 0], b: [x[1], k, 0], color: faint, width: 1.2 });
      }
      const tick = 0.08;
      const each = (r: [number, number], at: (v: number) => V3, mark: V3, side: 'below' | 'left') => {
        const t = ticksFor(r[0], r[1], undefined, false, 4);
        t.values.forEach((v, i) => {
          if (Math.abs(v) < 1e-9) return;
          const p = at(v);
          out.push({ kind: 'line', a: sub(p, mark), b: add(p, mark), color: ink, width: 2 });
          if (numbers) out.push({ kind: 'label', at: sub(p, mul(mark, 3.2)), tex: t.labels[i], color: withAlpha(ink, 0.8), size: 0.24, side });
        });
      };
      each(x, (v) => [v, 0, 0], [0, 0, tick], 'below');
      each(y, (v) => [0, v, 0], [0, 0, tick], 'below');
      each(z, (v) => [0, 0, v], [tick, 0, 0], 'left');
      if (names) {
        out.push({ kind: 'label', at: [x[1] + 0.75, 0, 0], tex: 'x', color: ink, size: 0.4 });
        out.push({ kind: 'label', at: [0, y[1] + 0.75, 0], tex: 'y', color: ink, size: 0.4 });
        out.push({ kind: 'label', at: [0, 0, z[1] + 0.75], tex: 'z', color: ink, size: 0.4 });
      }
      return out;
    },
  });
}

registerAction('axes3d', {
  summary: 'Axes in space: x to the right, y away, z up.',
  worlds: SPACE,
  params: ['x', 'y', 'z', 'numbers', 'names', 'grid', 'color', 'appear'],
  build(ctx) {
    const o = makeAxes(ctx, ctx.spec, ctx.where, str(ctx, 'id') ?? (ctx.world.things.has('axes') ? ctx.world.newId('axes') : 'axes'));
    const { how } = readAppear(ctx, 'draw');
    const d = natural(ctx, 1.5);
    arrive(ctx, o.thing, how === 'write' ? 'draw' : how, ctx.start, d);
    return { end: ctx.start + d, thing: o.thing };
  },
}, ['axes_3d', 'space_axes']);

// ---- Surfaces ----

registerAction('surface', {
  summary: 'A surface z = f(x, y), or one traced by u and v (a sphere, a torus, anything).',
  worlds: SPACE,
  params: ['math', 'x', 'y', 'x_of_uv', 'y_of_uv', 'z_of_uv', 'u', 'v', 'color', 'mesh', 'opacity', 'grow', 'detail'],
  build(ctx) {
    const { world, spec } = ctx;
    const B = box(world);
    const n = typeof spec.detail === 'number' ? clamp(Math.round(spec.detail), 6, 60) : 30;
    let point: (u: number, v: number, s: Scope) => V3;
    let names: string[];
    let byHeight: boolean;
    if (typeof spec.math === 'string') {
      const body = spec.math.replace(/^\s*z\s*=\s*/, '');
      if (/=|[<>]/.test(body)) throw new ScriptError(`"${spec.math}" is not a surface z = f(x, y). Write it as "x^2 + y^2" or "z = x^2 + y^2".`, `${ctx.where}.math`);
      const f = fn(body, `${ctx.where}.math`);
      names = namesIn(body, `${ctx.where}.math`).filter((k) => k !== 'x' && k !== 'y');
      const xr = range(spec.x, `${ctx.where}.x`, B.x), yr = range(spec.y, `${ctx.where}.y`, B.y);
      point = (u, v, s) => { const x = xr[0] + (xr[1] - xr[0]) * u, y = yr[0] + (yr[1] - yr[0]) * v; return [x, y, f({ ...s, x, y })]; };
      byHeight = spec.color === undefined || spec.color === 'by_height';
    } else if (typeof spec.x_of_uv === 'string' && typeof spec.y_of_uv === 'string' && typeof spec.z_of_uv === 'string') {
      const fx = fn(spec.x_of_uv, `${ctx.where}.x_of_uv`), fy = fn(spec.y_of_uv, `${ctx.where}.y_of_uv`), fz = fn(spec.z_of_uv, `${ctx.where}.z_of_uv`);
      names = [spec.x_of_uv, spec.y_of_uv, spec.z_of_uv].flatMap((e, i) => namesIn(e, `${ctx.where}.${['x', 'y', 'z'][i]}_of_uv`)).filter((k) => k !== 'u' && k !== 'v');
      const ur = range(spec.u, `${ctx.where}.u`, [0, 2 * Math.PI]), vr = range(spec.v, `${ctx.where}.v`, [0, 2 * Math.PI]);
      point = (a, b, s) => { const u = ur[0] + (ur[1] - ur[0]) * a, v = vr[0] + (vr[1] - vr[0]) * b; const sc = { ...s, u, v }; return [fx(sc), fy(sc), fz(sc)]; };
      byHeight = spec.color === 'by_height';
    } else throw new ScriptError('needs "math" (z as a function of x and y), or "x_of_uv", "y_of_uv" and "z_of_uv".', ctx.where);
    for (const k of names) if (!world.values.has(k)) throw new ScriptError(`uses "${k}", which is not a value in this scene. Make it with "value" first.`, ctx.where);
    const zr = B.z;
    const col = byHeight ? undefined : color(ctx, 'color', world.theme.colors[0])!;
    const stops = [world.theme.shades.blue ?? '#58c4dd', world.theme.shades.teal ?? '#5cd0b3', world.theme.shades.yellow ?? '#ffff00', world.theme.shades.orange ?? '#ff862f'];
    const opacity = typeof spec.opacity === 'number' ? clamp(spec.opacity) : 1;
    const grow = choice(spec.grow, ['rise', 'sweep', 'all'] as const, `${ctx.where}.grow`, 'rise');
    const meshLines = spec.mesh !== false;
    const edge = withAlpha(world.theme.ink, 0.35);
    let cache: V3[][] | undefined;
    const grid = (s: Scope): V3[][] => Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => point(i / n, j / n, s)));
    const P0 = grid(world.scope());
    const pts0 = P0.flat().filter((p) => p.every(Number.isFinite) && p[2] >= zr[0] - 1 && p[2] <= zr[1] + 1);
    const [lo, hi] = boundsOf(pts0);
    const live = names.length > 0;
    const o = addObject(ctx, str(ctx, 'id') ?? world.newId('surface'), {
      center: () => centroid([lo, hi]),
      bounds: () => [lo, hi],
      prims: (_t, drawn) => {
        const P = live ? grid(world.scope()) : (cache ??= P0);
        const u = ease('smooth', drawn);
        const out: Prim[] = [];
        const zlo = lo[2], zhi = hi[2];
        const shown = (p: V3): V3 => (grow === 'rise' ? [p[0], p[1], p[2] * u] : p);
        const limit = grow === 'sweep' ? Math.round(n * u) : n;
        for (let i = 0; i < limit; i++) for (let j = 0; j < n; j++) {
          const q = [P[i][j], P[i + 1][j], P[i + 1][j + 1], P[i][j + 1]];
          if (q.some((p) => !p.every(Number.isFinite) || p[2] < zr[0] - 0.5 || p[2] > zr[1] + 0.5) && typeof spec.math === 'string') continue;
          const zm = (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4;
          const c = col ?? heightColor(stops, (zm - zlo) / ((zhi - zlo) || 1));
          out.push({ kind: 'face', pts: q.map(shown), color: c, opacity: grow === 'all' ? opacity * u : opacity, twoSided: true, shade: true });
        }
        if (meshLines && u >= 1) {
          const every = Math.max(1, Math.round(n / 10));
          for (let i = 0; i <= n; i += every) for (let j = 0; j < n; j++) {
            const a = P[i][j], b = P[i][j + 1];
            if (a.every(Number.isFinite) && b.every(Number.isFinite) && Math.max(a[2], b[2]) <= zr[1] + 0.5 && Math.min(a[2], b[2]) >= zr[0] - 0.5) out.push({ kind: 'line', a, b, color: edge, width: 1.2 });
          }
          for (let j = 0; j <= n; j += every) for (let i = 0; i < n; i++) {
            const a = P[i][j], b = P[i + 1][j];
            if (a.every(Number.isFinite) && b.every(Number.isFinite) && Math.max(a[2], b[2]) <= zr[1] + 0.5 && Math.min(a[2], b[2]) >= zr[0] - 0.5) out.push({ kind: 'line', a, b, color: edge, width: 1.2 });
          }
        }
        return out;
      },
    });
    const d = natural(ctx, 2);
    arrive(ctx, o.thing, 'draw', ctx.start, d);
    return { end: ctx.start + d, thing: o.thing };
  },
}, ['surface3d', 'graph3d']);

// ---- Solids ----

const SHAPES = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'prism', 'pyramid', 'tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron', 'torus'] as const;

function meshFor(ctx: Ctx, shape: (typeof SHAPES)[number], s: number): Mesh {
  const { spec } = ctx;
  const h = typeof spec.height === 'number' ? spec.height : s;
  const r = typeof spec.radius === 'number' ? spec.radius : s / 2;
  const sides = typeof spec.sides === 'number' ? Math.round(spec.sides) : shape === 'pyramid' ? 4 : 6;
  if ((shape === 'prism' || shape === 'pyramid') && (sides < 3 || sides > 20)) throw new ScriptError('must be from 3 to 20.', `${ctx.where}.sides`);
  switch (shape) {
    case 'cube': return boxMesh(s, s, s);
    case 'cuboid': return boxMesh(num(ctx, 'width', s * 1.5), num(ctx, 'depth', s), num(ctx, 'height', s * 0.7));
    case 'sphere': return sphereMesh(r);
    case 'cylinder': return cylinderMesh(r, h);
    case 'cone': return cylinderMesh(r, h, true);
    case 'prism': return prismMesh(sides, r, h);
    case 'pyramid': return prismMesh(sides, r, h, true);
    case 'torus': return torusMesh(r * 0.7, r * 0.3);
    default: return platonic(shape, r);
  }
}

/** A solid from flat faces: drawn by its painter, it can be cut, sliced and unfolded. */
function solidObject(ctx: Ctx, id: string, faces: () => V3[][], opts: { flat: boolean; lines?: V3[][]; color: string; opacity: number; edges: boolean; wire: boolean; closed: boolean; faceColors?: (string | undefined)[] }): Obj3D {
  const { world } = ctx;
  const edge = withAlpha(world.theme.ink, 0.75);
  const fs = faces();
  const [lo, hi] = boundsOf(fs.flat());
  const o = addObject(ctx, id, {
    center: () => [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]],
    bounds: () => [lo, hi],
    faces,
    flat: opts.flat,
    prims: (_t, drawn) => {
      const out: Prim[] = [];
      const u = ease('smooth', drawn);
      const list = faces();
      if (!opts.wire) list.forEach((f, i) => out.push({ kind: 'face', pts: f, color: opts.faceColors?.[i] ?? opts.color, opacity: opts.opacity * u, twoSided: !opts.closed || opts.opacity < 1, shade: true }));
      if (opts.edges || opts.wire) {
        if (opts.flat) out.push(...faceLines(list, opts.wire ? opts.color : edge, opts.wire ? 2.5 : 2).map((p) => ({ ...p, color: withAlpha((p as { color: string }).color, u) }) as Prim));
        else for (const l of opts.lines ?? []) for (let k = 0; k + 1 < l.length; k++) out.push({ kind: 'line', a: l[k], b: l[k + 1], color: withAlpha(opts.wire ? opts.color : edge, u), width: opts.wire ? 2 : 1.5, front: true });
      }
      return out;
    },
  });
  return o;
}

registerAction('solid', {
  summary: 'A solid: cube, cuboid, sphere, cylinder, cone, prism, pyramid, the Platonic solids, torus.',
  worlds: SPACE,
  params: ['shape', 'size', 'width', 'depth', 'height', 'radius', 'sides', 'position', 'color', 'opacity', 'edges', 'wire', 'model', 'appear'],
  build(ctx) {
    const { world, spec } = ctx;
    if (spec.model !== undefined) return modelSolid(ctx);
    const shape = choice(spec.shape, SHAPES, `${ctx.where}.shape`);
    const s = typeof spec.size === 'number' ? spec.size : sizeOf(spec.size, { small: 1.2, medium: 2, large: 3, huge: 4.5 }, `${ctx.where}.size`, 'medium');
    const mesh = meshFor(ctx, shape, s);
    const at = spec.position !== undefined ? v3(spec.position, `${ctx.where}.position`) : [0, 0, 0] as V3;
    const faces = mesh.faces.map((f) => f.map((p) => add(p, at)));
    const lines = mesh.lines?.map((l) => l.map((p) => add(p, at)));
    const o = solidObject(ctx, str(ctx, 'id') ?? world.newId(shape), () => faces, {
      flat: mesh.flat, lines, color: color(ctx, 'color', world.theme.colors[0])!, opacity: typeof spec.opacity === 'number' ? clamp(spec.opacity) : 1,
      edges: spec.edges === undefined ? mesh.flat : spec.edges === true, wire: spec.wire === true, closed: mesh.closed,
    });
    const { how } = readAppear(ctx, 'grow');
    const d = natural(ctx, 1.2);
    arrive(ctx, o.thing, how === 'write' ? 'draw' : how, ctx.start, d);
    return { end: ctx.start + d, thing: o.thing };
  },
}, ['shape3d', 'solid3d']);

/** A model from a file, sized and stood at its place. */
function modelSolid(ctx: Ctx) {
  const { world, spec } = ctx;
  const def = world.models.find((m) => m.name === spec.model);
  if (!def) throw new ScriptError(`there is no model called "${String(spec.model)}"; list it at the top of the script under "models".${world.models.length ? ` Models: ${world.models.map((m) => m.name).join(', ')}.` : ''}`, `${ctx.where}.model`);
  const data = world.binaries.get(def.file);
  if (!data) throw new ScriptError(`"${def.file}" has not been opened with the script (put it beside script.json).`, `${ctx.where}.model`);
  const mesh = readModel(data, def.file, `${ctx.where}.model`);
  const [lo, hi] = boundsOf(mesh.faces.flat());
  const ext = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  const k = def.width ? def.width / (ext[0] || 1) : def.height ? def.height / (ext[2] || 1) : def.length ? def.length / (Math.max(...ext) || 1) : 3 / (Math.max(...ext) || 1);
  const at = spec.position !== undefined ? v3(spec.position, `${ctx.where}.position`) : [0, 0, 0] as V3;
  const c: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]];
  const faces = mesh.faces.map((f) => f.map((p) => add(mul(sub(p, c), k), at)));
  const o = solidObject(ctx, str(ctx, 'id') ?? world.newId(def.name), () => faces, {
    flat: false, color: color(ctx, 'color', world.theme.colors[0])!, opacity: typeof spec.opacity === 'number' ? clamp(spec.opacity) : 1,
    edges: false, wire: spec.wire === true, closed: false, faceColors: spec.color !== undefined ? undefined : mesh.colors,
  });
  const { how } = readAppear(ctx, 'grow');
  const d = natural(ctx, 1.2);
  arrive(ctx, o.thing, how === 'write' ? 'draw' : how, ctx.start, d);
  return { end: ctx.start + d, thing: o.thing };
}

// ---- Solids of revolution ----

registerAction('revolve', {
  summary: 'The area under a graph sweeps round an axis and becomes a solid.',
  worlds: SPACE,
  params: ['math', 'around', 'x', 'color', 'opacity', 'region', 'edges'],
  required: ['math'],
  build(ctx) {
    const { world, spec } = ctx;
    const { f, names } = curveOf(String(spec.math), `${ctx.where}.math`);
    if (names.length) throw new ScriptError(`uses "${names[0]}"; revolve needs a function of x alone.`, `${ctx.where}.math`);
    const around = choice(spec.around, ['x', 'z', 'y'] as const, `${ctx.where}.around`, 'x');
    const xr = range(spec.x, `${ctx.where}.x`, [0, 2]);
    const col = color(ctx, 'color', world.theme.colors[0])!;
    const opacity = typeof spec.opacity === 'number' ? clamp(spec.opacity) : 0.92;
    const N = 36, M = 48;
    const xs = Array.from({ length: N + 1 }, (_, i) => xr[0] + ((xr[1] - xr[0]) * i) / N);
    const r = xs.map((x) => f(x, {}));
    if (r.some((v) => !Number.isFinite(v))) throw new ScriptError(`"${spec.math}" is not defined everywhere from ${xr[0]} to ${xr[1]}.`, `${ctx.where}.math`);
    // The graph is drawn upright in the x-z plane; the turn is about the x axis or the upright (z) axis.
    const at = (i: number, a: number): V3 => (around === 'x' ? [xs[i], -r[i] * Math.sin(a), r[i] * Math.cos(a)] : [xs[i] * Math.cos(a), xs[i] * Math.sin(a), r[i]]);
    const faces = (sweep: number): V3[][] => {
      const out: V3[][] = [];
      const m = Math.max(1, Math.ceil((M * sweep) / (2 * Math.PI)));
      for (let i = 0; i < N; i++) for (let k = 0; k < m; k++) {
        const a0 = (sweep * k) / m, a1 = (sweep * (k + 1)) / m;
        out.push([at(i, a0), at(i + 1, a0), at(i + 1, a1), at(i, a1)]);
      }
      return out;
    };
    const full = faces(2 * Math.PI);
    const [lo, hi] = boundsOf(full.flat());
    const edge = withAlpha(world.theme.ink, 0.8);
    const regionCol = world.theme.colors[1 % world.theme.colors.length];
    const d = natural(ctx, 4);
    const o = addObject(ctx, str(ctx, 'id') ?? world.newId('revolve'), {
      center: () => centroid([lo, hi]),
      bounds: () => [lo, hi],
      faces: () => full,
      prims: (_t, drawn) => {
        const out: Prim[] = [];
        // First the region under the graph, then it turns.
        const u = clamp(drawn * 1.25 - 0.25);
        const sweep = 2 * Math.PI * ease('smooth', u);
        const curve: V3[] = xs.map((_, i) => at(i, 0));
        for (let i = 0; i < N; i++) out.push({ kind: 'line', a: curve[i], b: curve[i + 1], color: edge, width: 3, front: true });
        if (spec.region !== false && u < 1) {
          const base = (i: number): V3 => (around === 'x' ? [xs[i], 0, 0] : [xs[i], 0, 0]);
          for (let i = 0; i < N; i++) out.push({ kind: 'face', pts: [base(i), base(i + 1), curve[i + 1], curve[i]], color: regionCol, opacity: 0.55 * clamp(drawn * 4), twoSided: true, shade: false });
        }
        if (sweep > 1e-3) {
          for (const f of faces(sweep)) out.push({ kind: 'face', pts: f, color: col, opacity, twoSided: true, shade: true });
          const end: V3[] = xs.map((_, i) => at(i, sweep));
          if (u < 1) for (let i = 0; i < N; i++) out.push({ kind: 'line', a: end[i], b: end[i + 1], color: edge, width: 2.5, front: true });
        }
        return out;
      },
    });
    arrive(ctx, o.thing, 'draw', ctx.start, d);
    ctx.sound('swell', ctx.start + d * 0.3);
    return { end: ctx.start + d, thing: o.thing };
  },
}, ['solid_of_revolution', 'spin_around']);

// ---- Slicing ----

function readPlane(v: unknown, where: string): { axis: 0 | 1 | 2; at: number } {
  const m = typeof v === 'string' ? v.match(/^\s*([xyz])\s*=\s*(-?[\d.]+)\s*$/) : null;
  if (!m) throw new ScriptError('must be a plane like "z = 1", "x = 0" or "y = -0.5".', where);
  return { axis: ('xyz'.indexOf(m[1]) as 0 | 1 | 2), at: Number(m[2]) };
}

registerAction('slice', {
  summary: 'A plane cuts a solid: the cut face lit, or the two halves moved apart.',
  worlds: SPACE,
  params: ['who', 'plane', 'show', 'sweep', 'gap', 'color'],
  required: ['who', 'plane'],
  build(ctx) {
    const { world, spec } = ctx;
    const src = objOf(ctx);
    if (!src.faces) throw new ScriptError(`"${src.thing.id}" cannot be cut; slice works on solids.`, `${ctx.where}.who`);
    const plane = readPlane(spec.plane, `${ctx.where}.plane`);
    const show = choice(spec.show, ['section', 'apart'] as const, `${ctx.where}.show`, 'section');
    const sweep = spec.sweep === undefined ? undefined : range(spec.sweep, `${ctx.where}.sweep`, [0, 1]);
    const n: V3 = [0, 0, 0];
    n[plane.axis] = 1;
    const faces = src.faces();
    const base = (src as Obj3D & { color?: string });
    void base;
    const solidCol = world.theme.colors[0];
    const cutCol = color(ctx, 'color', world.theme.accent)!;
    const gap = num(ctx, 'gap', 1.2);
    const d = natural(ctx, sweep ? 3 : 1.5);
    const start = ctx.start;
    const [lo, hi] = src.bounds();
    const o = addObject(ctx, str(ctx, 'id') ?? world.newId('slice'), {
      center: src.center,
      bounds: () => [lo, hi],
      prims: (t) => {
        const u = t === Infinity ? 1 : ease('smooth', clamp((t - start) / d));
        const level = sweep ? sweep[0] + (sweep[1] - sweep[0]) * u : plane.at;
        const out: Prim[] = [];
        const cut = section(faces, n, level);
        const shift = show === 'apart' ? gap * u / 2 : 0;
        for (const f of faces) {
          const below = clipFace(f, n, level, -1), above = clipFace(f, n, level, 1);
          if (below.length >= 3) out.push({ kind: 'face', pts: below.map((p) => sub(p, mul(n, shift))), color: solidCol, opacity: 1, twoSided: false, shade: true });
          if (above.length >= 3) out.push({ kind: 'face', pts: above.map((p) => add(p, mul(n, shift))), color: solidCol, opacity: show === 'section' ? 0.18 : 1, twoSided: show === 'section', shade: true });
        }
        if (cut.length >= 3) {
          out.push({ kind: 'face', pts: cut.map((p) => sub(p, mul(n, shift))), color: cutCol, opacity: 1, twoSided: true, shade: false });
          if (show === 'apart') out.push({ kind: 'face', pts: cut.map((p) => add(p, mul(n, shift))), color: cutCol, opacity: 1, twoSided: true, shade: false });
          for (let i = 0; i < cut.length; i++) out.push({ kind: 'line', a: sub(cut[i], mul(n, shift)), b: sub(cut[(i + 1) % cut.length], mul(n, shift)), color: world.theme.ink, width: 2.5, front: true });
        }
        return out;
      },
    });
    // The cut solid takes the place of the whole one.
    ctx.act({ start, duration: 0, apply() { src.thing.state.visible = false; } });
    arrive(ctx, o.thing, 'none', start, 0);
    ctx.sound('whoosh', start);
    return { end: start + d, thing: o.thing };
  },
}, ['cross_section', 'cut3d']);

registerAction('stack_slices', {
  summary: 'A solid shown as a stack of thin slabs, which can get thinner and thinner.',
  worlds: SPACE,
  params: ['who', 'axis', 'count', 'refine', 'color', 'ghost'],
  required: ['who'],
  build(ctx) {
    const { world, spec } = ctx;
    const src = objOf(ctx);
    if (!src.faces) throw new ScriptError(`"${src.thing.id}" cannot be sliced; stack_slices works on solids.`, `${ctx.where}.who`);
    const axis = 'xyz'.indexOf(choice(spec.axis, ['z', 'x', 'y'] as const, `${ctx.where}.axis`, 'z')) as 0 | 1 | 2;
    const counts = [typeof spec.count === 'number' ? Math.round(spec.count) : 6, ...(Array.isArray(spec.refine) ? spec.refine.map((c, i) => { if (typeof c !== 'number' || c < 1 || c > 200) throw new ScriptError('must be numbers of slabs from 1 to 200.', `${ctx.where}.refine[${i}]`); return Math.round(c); }) : [])];
    if (counts[0] < 1 || counts[0] > 200) throw new ScriptError('must be from 1 to 200.', `${ctx.where}.count`);
    const faces = src.faces();
    const [lo, hi] = src.bounds();
    const n: V3 = [0, 0, 0];
    n[axis] = 1;
    const col = color(ctx, 'color', world.theme.colors[2 % world.theme.colors.length])!;
    const per = natural(ctx, 2 * counts.length) / counts.length;
    const start = ctx.start;
    const slabs = (k: number): V3[][][] => Array.from({ length: k }, (_, i) => {
      const a = lo[axis] + ((hi[axis] - lo[axis]) * i) / k, b = lo[axis] + ((hi[axis] - lo[axis]) * (i + 1)) / k;
      const cut = section(faces, n, (a + b) / 2);
      if (cut.length < 3) return [];
      const down = cut.map((p) => { const q: V3 = [...p]; q[axis] = a; return q; }), up = cut.map((p) => { const q: V3 = [...p]; q[axis] = b; return q; });
      const sides = cut.map((_, j) => [down[j], down[(j + 1) % cut.length], up[(j + 1) % cut.length], up[j]]);
      return [down, up, ...sides];
    });
    const built = counts.map(slabs);
    const o = addObject(ctx, str(ctx, 'id') ?? world.newId('slabs'), {
      center: src.center,
      bounds: () => [lo, hi],
      prims: (t) => {
        const tt = t === Infinity ? Infinity : t - start;
        const stage = Math.min(counts.length - 1, Math.floor((tt === Infinity ? Infinity : tt) / per));
        const within = tt === Infinity ? 1 : clamp((tt - stage * per) / per);
        const list = built[stage];
        // The first stack builds up slab by slab; later ones swap in at once.
        const shown = stage === 0 ? Math.ceil(list.length * clamp(within * 1.4)) : list.length;
        const out: Prim[] = [];
        for (let i = 0; i < shown; i++) for (const f of list[i]) out.push({ kind: 'face', pts: f, color: col, opacity: 1, twoSided: false, shade: true });
        if (list.length <= 40) for (let i = 0; i < shown; i++) for (const f of list[i].slice(0, 2)) for (let j = 0; j < f.length; j++) {
          if (j % Math.max(1, Math.floor(f.length / 24)) !== 0 && f.length > 24) continue;
          out.push({ kind: 'line', a: f[j], b: f[(j + 1) % f.length], color: withAlpha(world.theme.background as string ?? '#000', 0.7), width: 1.5, front: true });
        }
        return out;
      },
    });
    arrive(ctx, o.thing, 'none', start, 0);
    if (spec.ghost !== false) ctx.act({ start, duration: 0.6, apply(u) { src.thing.state.opacity *= 1 - 0.8 * u; } });
    counts.forEach((_, i) => ctx.sound(i ? 'click' : 'pop', start + i * per));
    return { end: start + per * counts.length, thing: o.thing };
  },
}, ['volume_by_slices', 'slabs']);

registerAction('net', {
  summary: 'A flat-faced solid unfolds into its net (or a net folds up).',
  worlds: SPACE,
  params: ['who', 'fold', 'color'],
  required: ['who'],
  build(ctx) {
    const { world, spec } = ctx;
    const src = objOf(ctx);
    if (!src.faces || !src.flat) throw new ScriptError(`"${src.thing.id}" has curved faces; nets work for flat-faced solids (cube, cuboid, prism, pyramid, the Platonic solids).`, `${ctx.where}.who`);
    const net = netOf({ faces: src.faces(), closed: true, flat: true });
    const fold = spec.fold === true;
    const col = color(ctx, 'color', world.theme.colors[0])!;
    const d = natural(ctx, 3);
    const start = ctx.start;
    const flat = net.at(1);
    const [lo, hi] = boundsOf([...flat.flat(), ...src.faces().flat()]);
    const o = addObject(ctx, str(ctx, 'id') ?? world.newId('net'), {
      center: src.center,
      bounds: () => [lo, hi],
      prims: (t) => {
        const u0 = t === Infinity ? 1 : ease('smooth', clamp((t - start) / d));
        const faces = net.at(fold ? 1 - u0 : u0);
        return [
          ...faces.map((f) => ({ kind: 'face', pts: f, color: col, opacity: 1, twoSided: true, shade: true }) as Prim),
          ...faceLines(faces, withAlpha(world.theme.ink, 0.8), 2),
        ];
      },
    });
    ctx.act({ start, duration: 0, apply() { src.thing.state.visible = false; } });
    arrive(ctx, o.thing, 'none', start, 0);
    return { end: start + d, thing: o.thing };
  },
}, ['unfold', 'fold']);

// ---- Points, vectors, lines, planes, curves ----

registerAction('vector3d', {
  summary: 'An arrow in space.',
  worlds: SPACE,
  params: ['to', 'from', 'color', 'label', 'width'],
  required: ['to'],
  build(ctx) {
    const { world, spec } = ctx;
    const to = v3(spec.to, `${ctx.where}.to`), from = spec.from !== undefined ? v3(spec.from, `${ctx.where}.from`) : [0, 0, 0] as V3;
    const col = color(ctx, 'color', world.theme.colors[1 % world.theme.colors.length])!;
    const label = typeof spec.label === 'string' ? spec.label : undefined;
    const o = addObject(ctx, str(ctx, 'id') ?? world.newId('vector'), {
      center: () => from,
      bounds: () => boundsOf([from, to]),
      prims: (_t, drawn) => {
        const u = ease('smooth', drawn);
        const end = lerp3(from, to, u);
        const out: Prim[] = [{ kind: 'arrow', a: from, b: end, color: col, width: num(ctx, 'width', 4) }];
        if (label && u >= 1) out.push({ kind: 'label', at: add(to, mul(norm(sub(to, from)), 0.45)), tex: label, color: col, size: 0.4 });
        return out;
      },
    });
    const d = natural(ctx, 0.9);
    arrive(ctx, o.thing, 'draw', ctx.start, d);
    return { end: ctx.start + d, thing: o.thing };
  },
}, ['arrow3d']);

registerAction('point3d', {
  summary: 'A point in space, with a label and dashed lines down to the floor.',
  worlds: SPACE,
  params: ['position', 'label', 'color', 'drop', 'size'],
  required: ['position'],
  build(ctx) {
    const { world, spec } = ctx;
    const p = v3(spec.position, `${ctx.where}.position`);
    const col = color(ctx, 'color', world.theme.accent)!;
    const label = spec.label === true ? `(${p.join(', ')})` : typeof spec.label === 'string' ? spec.label : undefined;
    const faint = withAlpha(world.theme.ink, 0.5);
    const o = addObject(ctx, str(ctx, 'id') ?? world.newId('point'), {
      center: () => p,
      bounds: () => [p, p],
      prims: (_t, drawn) => {
        const out: Prim[] = [{ kind: 'dot', at: p, r: num(ctx, 'size', 0.1), color: col }];
        if (spec.drop === true) {
          const u = ease('smooth', drawn);
          out.push({ kind: 'line', a: p, b: lerp3(p, [p[0], p[1], 0], u), color: faint, width: 1.8, dash: true });
          if (u >= 1) out.push({ kind: 'line', a: [p[0], p[1], 0], b: [p[0], 0, 0], color: faint, width: 1.8, dash: true }, { kind: 'line', a: [p[0], p[1], 0], b: [0, p[1], 0], color: faint, width: 1.8, dash: true });
        }
        if (label) out.push({ kind: 'label', at: p, tex: label, color: col, size: 0.34, side: 'right' });
        return out;
      },
    });
    arrive(ctx, o.thing, 'pop', ctx.start, 0.6);
    return { end: ctx.start + 0.6, thing: o.thing };
  },
}, ['dot3d']);

/** The polygon where a plane n·p = d meets a box. */
function planeInBox(n: V3, d: number, B: ReturnType<typeof box>): V3[] {
  const c: V3[] = [];
  for (const x of B.x) for (const y of B.y) for (const z of B.z) c.push([x, y, z]);
  const edges: [number, number][] = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const faces = edges.map(([a, b]) => [c[a], c[b], c[b], c[a]]);
  return section(faces, n, d).filter((p, i, all) => all.findIndex((q) => len(sub(p, q)) < 1e-6) === i);
}

registerAction('plane3d', {
  summary: 'A flat plane, from an equation like x + y + z = 3, cut to the axes\' box.',
  worlds: SPACE,
  params: ['math', 'color', 'opacity'],
  required: ['math'],
  build(ctx) {
    const { world, spec } = ctx;
    const text = String(spec.math);
    const parts = text.split('=');
    if (parts.length !== 2) throw new ScriptError('must be an equation in x, y and z, such as "x + y + z = 3".', `${ctx.where}.math`);
    const g = (x: number, y: number, z: number) => { try { return Number(evaluate(`(${parts[0]}) - (${parts[1]})`, { x, y, z })); } catch (e) { throw new ScriptError(`could not be read: ${(e as Error).message}.`, `${ctx.where}.math`); } };
    const c0 = g(0, 0, 0);
    const n: V3 = [g(1, 0, 0) - c0, g(0, 1, 0) - c0, g(0, 0, 1) - c0];
    if (Math.abs(g(1.3, -0.7, 2.1) - (c0 + n[0] * 1.3 - n[1] * 0.7 + n[2] * 2.1)) > 1e-6 || len(n) < 1e-9) throw new ScriptError('is not a flat plane: write it as a x + b y + c z = d.', `${ctx.where}.math`);
    const L = len(n);
    const nn = mul(n, 1 / L), d = -c0 / L;
    const poly = planeInBox(nn, d, box(world));
    if (poly.length < 3) throw new ScriptError('does not pass through the axes\' box.', `${ctx.where}.math`);
    const col = color(ctx, 'color', world.theme.colors[2 % world.theme.colors.length])!;
    const opacity = typeof spec.opacity === 'number' ? clamp(spec.opacity) : 0.5;
    const m = centroid(poly);
    const o = addObject(ctx, str(ctx, 'id') ?? world.newId('plane'), {
      center: () => m,
      bounds: () => boundsOf(poly),
      prims: (_t, drawn) => {
        const u = ease('smooth', drawn);
        const pts = poly.map((p) => lerp3(m, p, u));
        return [{ kind: 'face', pts, color: col, opacity, twoSided: true, shade: false }, ...faceLines([pts], col, 2.5)];
      },
    });
    const dd = natural(ctx, 1.2);
    arrive(ctx, o.thing, 'draw', ctx.start, dd);
    return { end: ctx.start + dd, thing: o.thing };
  },
}, ['plane']);

registerAction('line3d', {
  summary: 'A line through two points, across the axes\' box (or only between them).',
  worlds: SPACE,
  params: ['through', 'segment', 'color', 'width', 'dash'],
  required: ['through'],
  build(ctx) {
    const { world, spec } = ctx;
    if (!Array.isArray(spec.through) || spec.through.length !== 2) throw new ScriptError('must be two points: [[x, y, z], [x, y, z]].', `${ctx.where}.through`);
    const a = v3(spec.through[0], `${ctx.where}.through[0]`), b = v3(spec.through[1], `${ctx.where}.through[1]`);
    let p = a, q = b;
    if (spec.segment !== true) {
      // Out to where it leaves the box.
      const B = box(world);
      const dir = sub(b, a);
      let t0 = -Infinity, t1 = Infinity;
      (['x', 'y', 'z'] as const).forEach((k, i) => {
        if (Math.abs(dir[i]) < 1e-12) return;
        const ta = (B[k][0] - a[i]) / dir[i], tb = (B[k][1] - a[i]) / dir[i];
        t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
      });
      if (t1 > t0) { p = add(a, mul(dir, t0)); q = add(a, mul(dir, t1)); }
    }
    const col = color(ctx, 'color', world.theme.colors[3 % world.theme.colors.length])!;
    const o = addObject(ctx, str(ctx, 'id') ?? world.newId('line'), {
      center: () => centroid([p, q]),
      bounds: () => boundsOf([p, q]),
      prims: (_t, drawn) => [{ kind: 'line', a: p, b: lerp3(p, q, ease('smooth', drawn)), color: col, width: num(ctx, 'width', 3.5), dash: spec.dash === true }],
    });
    const d = natural(ctx, 1);
    arrive(ctx, o.thing, 'draw', ctx.start, d);
    return { end: ctx.start + d, thing: o.thing };
  },
}, ['line_3d']);

registerAction('curve3d', {
  summary: 'A curve in space traced by t: a helix, a knot, a path.',
  worlds: SPACE,
  params: ['x_of_t', 'y_of_t', 'z_of_t', 't', 'color', 'width'],
  required: ['x_of_t', 'y_of_t', 'z_of_t'],
  build(ctx) {
    const { world, spec } = ctx;
    const fx = fn(String(spec.x_of_t), `${ctx.where}.x_of_t`), fy = fn(String(spec.y_of_t), `${ctx.where}.y_of_t`), fz = fn(String(spec.z_of_t), `${ctx.where}.z_of_t`);
    const tr = range(spec.t, `${ctx.where}.t`, [0, 2 * Math.PI]);
    const N = 240;
    const pts: V3[] = Array.from({ length: N + 1 }, (_, i) => { const t = tr[0] + ((tr[1] - tr[0]) * i) / N; return [fx({ t }), fy({ t }), fz({ t })]; });
    if (pts.some((p) => !p.every(Number.isFinite))) throw new ScriptError('is not defined all along t.', ctx.where);
    const col = color(ctx, 'color', world.theme.colors[1 % world.theme.colors.length])!;
    const o = addObject(ctx, str(ctx, 'id') ?? world.newId('curve'), {
      center: () => centroid(pts),
      bounds: () => boundsOf(pts),
      prims: (_t, drawn) => {
        const k = Math.round(N * ease('smooth', drawn));
        const out: Prim[] = [];
        for (let i = 0; i < k; i++) out.push({ kind: 'line', a: pts[i], b: pts[i + 1], color: col, width: num(ctx, 'width', 4) });
        return out;
      },
    });
    const d = natural(ctx, 2);
    arrive(ctx, o.thing, 'draw', ctx.start, d);
    return { end: ctx.start + d, thing: o.thing };
  },
}, ['space_curve', 'helix']);

// ---- Camera shots in space ----

const SPACE_SHOTS = ['rest', 'look', 'orbit', 'frame', 'zoom'] as const;

export function readCamera3d(spec: unknown, world: SceneWorld, start: number, duration: number, where: string) {
  const S = world.space as Space;
  const list = Array.isArray(spec) ? spec : [spec];
  list.forEach((raw, i) => {
    const w = Array.isArray(spec) ? `${where}[${i}]` : where;
    const s = typeof raw === 'string' ? { shot: raw } : raw;
    if (!isObject(s)) throw new ScriptError('must be a shot name or a shot.', w);
    const kind = choice(s.shot ?? (s.target !== undefined ? 'frame' : 'rest'), SPACE_SHOTS, `${w}.shot`);
    let at = start;
    if (typeof s.at === 'number') at = start + s.at;
    else if (typeof s.at === 'string' && /%$/.test(s.at)) at = start + (duration * parseFloat(s.at)) / 100;
    const blend = s.blend === 'cut' ? 0 : typeof s.blend === 'number' ? s.blend : 1.6;
    const targetOf = (): { c: V3; box?: [V3, V3] } | undefined => {
      if (s.target === undefined) return undefined;
      if (Array.isArray(s.target) && s.target.length === 3 && s.target.every((x) => typeof x === 'number')) return { c: s.target as V3 };
      const th = world.get(s.target, `${w}.target`);
      const o = S.objects.find((x) => x.thing === th);
      if (!o) throw new ScriptError(`"${th.id}" is not a 3D object.`, `${w}.target`);
      return { c: centroid(o.bounds()), box: o.bounds() };
    };
    const num3 = (k: string): number | undefined => {
      const v = s[k];
      if (v === undefined) return undefined;
      if (typeof v !== 'number') throw new ScriptError('must be a number.', `${w}.${k}`);
      return v;
    };
    const tgt = targetOf();
    const now = () => S.startView(S.shots.findIndex((x) => x === shot));
    let view: (t: number) => Cam;
    switch (kind) {
      case 'rest': view = () => S.restCam(); break;
      case 'look': case 'frame': case 'zoom': {
        view = () => {
          const b = now();
          const z = kind === 'zoom' ? (num3('to') ?? 2) : 1;
          return {
            elevation: num3('elevation') ?? b.elevation,
            angle: num3('angle') ?? b.angle,
            distance: (num3('distance') ?? (kind === 'frame' && tgt?.box ? S.fitDistance(tgt.box, 1.1, num3('elevation') ?? b.elevation, num3('angle') ?? b.angle, tgt.c) : b.distance)) / z,
            target: tgt?.c ?? b.target,
          };
        };
        break;
      }
      case 'orbit': {
        const turns = num3('turns') ?? 1;
        const len = typeof s.duration === 'number' ? s.duration : Math.max(1, duration);
        view = (t) => {
          const b = now();
          const u = ease(s.ease === 'smooth' ? 'smooth' : 'linear', clamp((t - at) / len));
          return { elevation: num3('elevation') ?? b.elevation, angle: b.angle + 360 * turns * u, distance: num3('distance') ?? b.distance, target: tgt?.c ?? b.target };
        };
        break;
      }
    }
    const shot = { start: at, blend: kind === 'orbit' ? Math.min(blend, 0.01) : blend, view };
    S.addShot(shot);
  });
}

// ---- The world itself ----

export function setupSpaceWorld(ctx: Ctx, s: Record<string, unknown>, where: string) {
  const { world } = ctx;
  const S = new Space(world.frameW, world.frameH);
  world.space = S;
  S.light = choice(s.light, SPACE_LIGHTS, `${where}.light`, 'soft') as Light;
  S.floor = s.floor === true;
  S.depth = world.finish.depth;
  const bg = world.theme.background;
  S.background = typeof bg === 'string' ? bg : bg[1] ?? bg[0];
  if (s.camera !== undefined) {
    if (!isObject(s.camera)) throw new ScriptError('must be { "elevation", "angle", "distance", "target" }.', `${where}.camera`);
    const c = s.camera;
    for (const k of ['elevation', 'angle', 'distance']) if (c[k] !== undefined && typeof c[k] !== 'number') throw new ScriptError('must be a number.', `${where}.camera.${k}`);
    S.startCam = {
      elevation: c.elevation as number | undefined, angle: c.angle as number | undefined, distance: c.distance as number | undefined,
      target: c.target !== undefined ? v3(c.target, `${where}.camera.target`) : undefined,
    };
  }
  const ink = world.theme.ink, grid = world.theme.grid;
  const painter = liveThing(ctx, '_space', (t) => (t === Infinity ? [] : S.paint(t, ink, grid)), where);
  painter.base.visible = true;
  painter.layer = 0;
  if (s.axes !== undefined && s.axes !== false) {
    const spec = isObject(s.axes) ? s.axes : {};
    const o = makeAxes(ctx, spec, `${where}.axes`, 'axes');
    if (spec.appear === 'draw') arrive(ctx, o.thing, 'draw', ctx.start, 1.5);
    else o.thing.base.visible = true;
  }
  void dot; void cross; void gridMesh;
}
