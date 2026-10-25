// Drawing styles: the same outlines drawn as chalk, pencil, marker, neon,
// blueprint, cut paper or raised solids. Every frame is drawn afresh, so the
// roughness comes from seeded noise and stays the same from frame to frame.

import { mixColor, parseColor, withAlpha } from './color';
import type { Pt } from './geom';
import { rng } from './util';

export const LOOKS = ['vector', 'chalk', 'sketch', 'whiteboard', 'neon', 'blueprint', 'paper', 'solid'] as const;
export type Look = (typeof LOOKS)[number];

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Themes a style brings with it when the script does not choose one. */
export const LOOK_THEMES: Partial<Record<Look, unknown>> = {
  chalk: 'board',
  whiteboard: 'white',
  sketch: 'paper',
  paper: { base: 'paper', background: '#efe6d2' },
  neon: { base: 'night', background: '#05060b', glow: 0.6 },
  blueprint: { base: 'night', background: ['#22579c', '#173e73'], ink: '#f1f6ff', grid: 'rgba(235,244,255,0.16)', surface: '#1b4a85', accent: '#ffe27a', colors: ['#bfe3ff', '#ffe27a', '#9ff0d0', '#ffb3a8', '#e2c6ff'] },
};

// ---- Textures, made once ----

const patterns = new Map<string, CanvasPattern>();

function texture(kind: 'chalk' | 'grain', color: string, ctx: Ctx2D): CanvasPattern | string {
  const key = `${kind}|${color}`;
  const hit = patterns.get(key);
  if (hit) return hit;
  if (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined') return color;
  const size = 96;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size });
  const g = c.getContext('2d') as Ctx2D;
  const img = g.createImageData(size, size);
  const p = parseColor(color) ?? [255, 255, 255, 1];
  const r = rng(kind === 'chalk' ? 11 : 23);
  for (let i = 0; i < size * size; i++) {
    const n = r();
    const o = i * 4;
    if (kind === 'chalk') {
      // Chalk: mostly solid, with small bare specks where the board shows.
      img.data[o] = p[0]; img.data[o + 1] = p[1]; img.data[o + 2] = p[2];
      img.data[o + 3] = Math.round(255 * p[3] * (n < 0.16 ? 0.15 : n < 0.3 ? 0.6 : 0.95));
    } else {
      const v = n < 0.5 ? 0 : 255;
      img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; img.data[o + 3] = Math.round(18 * r());
    }
  }
  g.putImageData(img, 0, 0);
  const pat = ctx.createPattern(c as CanvasImageSource, 'repeat');
  if (!pat) return color;
  patterns.set(key, pat);
  return pat;
}

/** A smooth wobble: the same at the same place, different in different places. */
function wobble(p: Pt, seed: number, amp: number): Pt {
  const a = Math.sin(p[0] * 0.031 + seed * 1.7) + Math.sin(p[1] * 0.043 + seed * 2.3 + p[0] * 0.011);
  const b = Math.cos(p[1] * 0.029 + seed * 3.1) + Math.sin(p[0] * 0.037 - seed * 0.7 + p[1] * 0.013);
  return [p[0] + a * amp * 0.5, p[1] + b * amp * 0.5];
}

function trace(ctx: Ctx2D, pts: Pt[], close: boolean) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

const darker = (c: string, k: number) => mixColor(c.startsWith('rgba') ? c : c, '#000000', k);

/** Fill outlines (in pixels) in a style. */
export function fillShape(ctx: Ctx2D, contours: Pt[][], color: string, look: Look, unit: number, seed: number) {
  const path = (pts: Pt[][], d: Pt = [0, 0]) => { ctx.beginPath(); for (const c of pts) trace(ctx, d[0] || d[1] ? c.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt) : c, true); };
  switch (look) {
    case 'chalk':
      path(contours);
      ctx.fillStyle = texture('chalk', color, ctx);
      ctx.fill('nonzero');
      return;
    case 'sketch': {
      const w = contours.map((c) => c.map((p) => wobble(p, seed, 2.2 * unit)));
      path(w);
      ctx.fillStyle = color;
      ctx.fill('nonzero');
      return;
    }
    case 'neon':
      ctx.save();
      ctx.shadowBlur = 16 * unit;
      ctx.shadowColor = color;
      path(contours);
      ctx.fillStyle = mixColor(color, '#ffffff', 0.35);
      ctx.fill('nonzero');
      ctx.restore();
      return;
    case 'paper':
      ctx.save();
      ctx.shadowOffsetX = 3 * unit; ctx.shadowOffsetY = 4 * unit; ctx.shadowBlur = 6 * unit;
      ctx.shadowColor = 'rgba(0,0,0,0.32)';
      path(contours);
      ctx.fillStyle = color;
      ctx.fill('nonzero');
      ctx.restore();
      path(contours);
      ctx.fillStyle = texture('grain', '#000000', ctx);
      ctx.fill('nonzero');
      return;
    case 'solid': {
      const depth = Math.max(2, Math.round(6 * unit));
      ctx.save();
      ctx.shadowOffsetX = 5 * unit; ctx.shadowOffsetY = 7 * unit; ctx.shadowBlur = 10 * unit;
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.fillStyle = darker(color, 0.45);
      path(contours, [depth, depth]);
      ctx.fill('nonzero');
      ctx.restore();
      ctx.fillStyle = darker(color, 0.45);
      for (let k = depth - 1; k > 0; k--) { path(contours, [k, k]); ctx.fill('nonzero'); }
      path(contours);
      ctx.fillStyle = color;
      ctx.fill('nonzero');
      return;
    }
    default:
      path(contours);
      ctx.fillStyle = color;
      ctx.fill('nonzero');
  }
}

/** Stroke lines (in pixels) in a style. */
export function strokeLines(ctx: Ctx2D, lines: Pt[][], closed: boolean[], color: string, width: number, look: Look, unit: number, seed: number) {
  const path = (ls: Pt[][], d: Pt = [0, 0]) => { ctx.beginPath(); ls.forEach((l, i) => trace(ctx, d[0] || d[1] ? l.map((p) => [p[0] + d[0], p[1] + d[1]] as Pt) : l, closed[i])); };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (look) {
    case 'chalk':
      ctx.strokeStyle = texture('chalk', color, ctx);
      ctx.lineWidth = width * 1.15;
      path(lines);
      ctx.stroke();
      ctx.globalAlpha *= 0.35;
      ctx.lineWidth = width * 1.9;
      path(lines.map((l) => l.map((p) => wobble(p, seed + 5, 1.2 * unit))));
      ctx.stroke();
      return;
    case 'sketch':
      ctx.strokeStyle = color;
      ctx.lineWidth = width * 0.75;
      path(lines.map((l) => l.map((p) => wobble(p, seed, 3.6 * unit))));
      ctx.stroke();
      ctx.globalAlpha *= 0.6;
      ctx.lineWidth = width * 0.5;
      path(lines.map((l) => l.map((p) => wobble(p, seed + 9, 4.2 * unit))));
      ctx.stroke();
      return;
    case 'whiteboard':
      ctx.strokeStyle = withAlpha(color, 0.92);
      ctx.lineWidth = width * 1.35;
      path(lines);
      ctx.stroke();
      return;
    case 'neon':
      ctx.save();
      ctx.shadowBlur = 18 * unit;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = width * 1.2;
      path(lines);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = mixColor(color, '#ffffff', 0.7);
      ctx.lineWidth = Math.max(1, width * 0.4);
      path(lines);
      ctx.stroke();
      return;
    case 'blueprint':
      ctx.strokeStyle = color;
      ctx.lineWidth = width * 0.8;
      path(lines);
      ctx.stroke();
      // Construction marks: short ticks past each end, as drafters leave them.
      ctx.globalAlpha *= 0.45;
      ctx.lineWidth = Math.max(1, width * 0.4);
      ctx.beginPath();
      lines.forEach((l, i) => {
        if (closed[i] || l.length < 2) return;
        for (const [a, b] of [[l[1], l[0]], [l[l.length - 2], l[l.length - 1]]] as [Pt, Pt][]) {
          const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
          ctx.moveTo(b[0], b[1]);
          ctx.lineTo(b[0] + (dx / d) * 10 * unit, b[1] + (dy / d) * 10 * unit);
        }
      });
      ctx.stroke();
      return;
    case 'paper':
      ctx.save();
      ctx.shadowOffsetX = 2 * unit; ctx.shadowOffsetY = 3 * unit; ctx.shadowBlur = 4 * unit;
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.strokeStyle = color;
      ctx.lineWidth = width * 1.4;
      path(lines);
      ctx.stroke();
      ctx.restore();
      return;
    case 'solid': {
      const depth = Math.max(2, Math.round(5 * unit));
      ctx.strokeStyle = darker(color, 0.45);
      ctx.lineWidth = width * 1.3;
      for (let k = depth; k > 0; k--) { path(lines, [k, k]); ctx.stroke(); }
      ctx.strokeStyle = color;
      path(lines);
      ctx.stroke();
      return;
    }
    default:
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      path(lines);
      ctx.stroke();
  }
}

/** Words: the style's fill for fillText. */
export function textPaint(ctx: Ctx2D, color: string, look: Look, unit: number): void {
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  if (look === 'chalk') { ctx.fillStyle = texture('chalk', color, ctx); return; }
  if (look === 'neon') { ctx.shadowBlur = 14 * unit; ctx.shadowColor = color; ctx.fillStyle = mixColor(color, '#ffffff', 0.35); return; }
  if (look === 'paper' || look === 'solid') { ctx.shadowOffsetX = 3 * unit; ctx.shadowOffsetY = 4 * unit; ctx.shadowBlur = 5 * unit; ctx.shadowColor = 'rgba(0,0,0,0.35)'; }
  ctx.fillStyle = color;
}

/** The marker pen that draws on a whiteboard, its tip at p. */
export function drawMarker(ctx: Ctx2D, p: Pt, color: string, unit: number) {
  ctx.save();
  ctx.translate(p[0], p[1]);
  ctx.rotate(-0.6);
  const s = unit * 1.1;
  ctx.shadowBlur = 8 * s; ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowOffsetX = 4 * s; ctx.shadowOffsetY = 6 * s;
  ctx.fillStyle = '#e9ecef';
  ctx.beginPath(); ctx.roundRect?.(-9 * s, -150 * s, 18 * s, 120 * s, 6 * s); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect?.(-10 * s, -60 * s, 20 * s, 34 * s, 4 * s); ctx.fill();
  ctx.fillStyle = '#9aa1a8';
  ctx.beginPath(); ctx.moveTo(-8 * s, -30 * s); ctx.lineTo(8 * s, -30 * s); ctx.lineTo(3 * s, -6 * s); ctx.lineTo(-3 * s, -6 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-3 * s, -6 * s); ctx.lineTo(3 * s, -6 * s); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
}
