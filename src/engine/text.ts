// Words, with maths between dollar signs, laid out in lines.
//
// Measuring text needs a canvas. In the browser one is made when first
// needed; in tests a simple estimate is used instead.

import type { Box } from './geom';
import { texToGlyphs } from './tex';
import type { Glyph } from './thing';

export interface Run {
  kind: 'text' | 'math';
  /** Words, for text runs. */
  text?: string;
  /** Outlines, for maths runs, relative to the run's start on the baseline. */
  glyphs?: Glyph[];
  x: number;
  width: number;
}

export interface TextLine { runs: Run[]; width: number; y: number }

export interface TextLayout {
  lines: TextLine[];
  /** Font size in sheet units. */
  size: number;
  font: string;
  weight: number;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  box: Box;
}

type Measure = (text: string, font: string) => number;
let measurer: Measure | null = null;

function measure(text: string, font: string, size: number): number {
  if (!measurer) {
    if (typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined') {
      const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8) : document.createElement('canvas');
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
      if (ctx) measurer = (t, f) => { ctx.font = f; return ctx.measureText(t).width; };
    }
    if (!measurer) measurer = (t) => t.length * 55;
  }
  // Measure at 100 px and scale, so small sheet sizes stay exact.
  return (measurer(text, `${font.replace('{px}', '100px')}`) / 100) * size;
}

export const fontString = (weight: number, italic: boolean, family: string, px: number | '{px}') =>
  `${italic ? 'italic ' : ''}${weight} ${typeof px === 'number' ? `${px}px` : px} ${family}`;

/** Split "so $x^2$ grows" into text and maths pieces. */
export function splitMath(text: string): { kind: 'text' | 'math'; value: string }[] {
  const out: { kind: 'text' | 'math'; value: string }[] = [];
  const re = /\$([^$]+)\$/g;
  let last = 0, hit: RegExpExecArray | null;
  while ((hit = re.exec(text))) {
    if (hit.index > last) out.push({ kind: 'text', value: text.slice(last, hit.index) });
    out.push({ kind: 'math', value: hit[1] });
    last = hit.index + hit[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

/**
 * Lay out text in lines no wider than `maxWidth` (sheet units), breaking at
 * spaces. Explicit line breaks ("\n") are kept.
 */
export function layoutText(
  text: string,
  opts: { size: number; font: string; weight?: number; italic?: boolean; maxWidth?: number; align?: 'left' | 'center' | 'right'; lineHeight?: number },
): TextLayout {
  const size = opts.size;
  const weight = opts.weight ?? 500;
  const italic = opts.italic ?? false;
  const font = fontString(weight, italic, opts.font, '{px}');
  const maxWidth = opts.maxWidth ?? Infinity;
  const lineHeight = (opts.lineHeight ?? 1.3) * size;
  const lines: TextLine[] = [];

  for (const para of text.split('\n')) {
    // Words and maths as units that cannot be broken.
    const units: Run[] = [];
    for (const piece of splitMath(para)) {
      if (piece.kind === 'math') {
        const m = texToGlyphs(piece.value, size * 0.72);
        const b = boxOf(m.glyphs);
        units.push({ kind: 'math', glyphs: m.glyphs, x: 0, width: b.x1 - Math.min(0, b.x0) });
      } else {
        for (const word of piece.value.split(/(\s+)/)) {
          if (!word) continue;
          units.push({ kind: 'text', text: word, x: 0, width: measure(word, font, size) });
        }
      }
    }
    let line: Run[] = [];
    let width = 0;
    const flush = () => {
      while (line.length && line[line.length - 1].kind === 'text' && !line[line.length - 1].text!.trim()) {
        width -= line.pop()!.width;
      }
      lines.push({ runs: line, width, y: 0 });
      line = [];
      width = 0;
    };
    for (const u of units) {
      const isSpace = u.kind === 'text' && !u.text!.trim();
      if (isSpace && !line.length) continue;
      if (!isSpace && width + u.width > maxWidth && line.length) flush();
      if (isSpace && !line.length) continue;
      line.push({ ...u, x: width });
      width += u.width;
    }
    flush();
  }

  const align = opts.align ?? 'center';
  const widest = Math.max(0, ...lines.map((l) => l.width));
  const total = lineHeight * (lines.length - 1) + size;
  lines.forEach((l, i) => {
    l.y = total / 2 - size * 0.8 - i * lineHeight;
    const shift = align === 'left' ? -widest / 2 : align === 'right' ? widest / 2 - l.width : -l.width / 2;
    for (const r of l.runs) r.x += shift;
  });
  return {
    lines, size, font: opts.font, weight, italic, align,
    box: { x0: -widest / 2, x1: widest / 2, y0: -total / 2, y1: total / 2 },
  };
}

function boxOf(glyphs: Glyph[]): Box {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const g of glyphs) for (const c of g.contours) for (const [x, y] of c.pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return x0 === Infinity ? { x0: 0, x1: 0, y0: 0, y1: 0 } : { x0, x1, y0, y1 };
}
