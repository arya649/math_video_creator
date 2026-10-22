// Maths to outlines. LaTeX goes through MathJax, which gives every symbol as
// its own outline; plain maths ("2*x^2 + 1") is turned into LaTeX first.

import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/base/BaseConfiguration.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/html/HtmlConfiguration.js';
import 'mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js';
import 'mathjax-full/js/input/tex/configmacros/ConfigMacrosConfiguration.js';
import 'mathjax-full/js/input/tex/cancel/CancelConfiguration.js';
import 'mathjax-full/js/input/tex/color/ColorConfiguration.js';
import 'mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import { parse as parseMath } from 'mathjs';

import { type Contour, type Mat, IDENTITY, mul, parsePath, parseTransform, transformContours } from './geom';
import type { Glyph } from './thing';
import { ScriptError } from './util';

type LiteNode = unknown;

let doc: ReturnType<typeof mathjax.document> | null = null;
let adaptor: ReturnType<typeof liteAdaptor> | null = null;

function setup() {
  if (doc) return;
  adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  doc = mathjax.document('', {
    InputJax: new TeX({
      packages: ['base', 'ams', 'html', 'newcommand', 'configmacros', 'cancel', 'color', 'boldsymbol'],
      macros: {
        part: ['\\class{part-#1}{#2}', 2],
      },
      formatError: (_jax: unknown, err: { message: string }) => {
        throw new ScriptError(`the maths could not be read: ${err.message}`);
      },
    }),
    OutputJax: new SVG({ fontCache: 'none' }),
  });
}

/** One em of maths, in sheet units, for maths of a given size. */
export const emFor = (size: number) => size * 1.45;

export interface MathResult {
  glyphs: Glyph[];
  /** x of the first "=" (or other relation sign), in the glyphs' coordinates. */
  equalsX?: number;
}

const cache = new Map<string, MathResult>();

/**
 * LaTeX to glyphs, with the baseline at y = 0 and the left edge at x = 0,
 * in sheet units for maths of `size`.
 */
export function texToGlyphs(tex: string, size = 0.5): MathResult {
  const key = `${size}|${tex}`;
  const hit = cache.get(key);
  if (hit) return hit;
  setup();
  const node = doc!.convert(tex, { display: true });
  const a = adaptor!;
  const glyphs: Glyph[] = [];
  const scale = emFor(size) / 1000;
  const root: Mat = [scale, 0, 0, scale, 0, 0];

  const walk = (n: LiteNode, m: Mat, parts: string[], color: string | undefined) => {
    const kind = a.kind(n as never);
    if (kind === '#text' || kind === '#comment') return;
    const el = n as never;
    const tr = a.getAttribute(el, 'transform');
    // MathJax flips its whole drawing with scale(1,-1); its outlines are
    // already y-up, which is what the sheet uses, so that flip is skipped.
    let here = m;
    if (tr && tr !== 'scale(1,-1)') here = mul(m, parseTransform(tr));
    const cls = a.getAttribute(el, 'class') ?? '';
    let ps = parts;
    for (const c of cls.split(/\s+/)) if (c.startsWith('part-')) ps = [...ps, c.slice(5)];
    const fill = a.getAttribute(el, 'fill');
    const col = fill && fill !== 'currentColor' && fill !== 'none' ? fill : color;
    if (kind === 'path') {
      const d = a.getAttribute(el, 'd') ?? '';
      const contours = transformContours(parsePath(d, 6), here);
      if (contours.length) glyphs.push({ contours, fill: true, stroke: false, key: 'c' + (a.getAttribute(el, 'data-c') ?? '?'), parts: ps, color: col });
      return;
    }
    if (kind === 'rect') {
      const x = Number(a.getAttribute(el, 'x') ?? 0), y = Number(a.getAttribute(el, 'y') ?? 0);
      const w = Number(a.getAttribute(el, 'width') ?? 0), h = Number(a.getAttribute(el, 'height') ?? 0);
      const box: Contour = { closed: true, pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] };
      glyphs.push({ contours: transformContours([box], here), fill: true, stroke: false, key: 'rule', parts: ps, color: col });
      return;
    }
    if (kind === 'line') {
      const p = (k: string) => Number(a.getAttribute(el, k) ?? 0);
      const c: Contour = { closed: false, pts: [[p('x1'), p('y1')], [p('x2'), p('y2')]] };
      const sw = Number(a.getAttribute(el, 'stroke-width') ?? 60) * scale;
      glyphs.push({ contours: transformContours([c], here), fill: false, stroke: true, width: sw, key: 'line', parts: ps, color: col });
      return;
    }
    if (kind === 'text') {
      const value = a.textContent(el);
      const fs = Number((a.getAttribute(el, 'font-size') ?? '1000').replace('px', ''));
      // The text sits in the flipped space; place it by its start point.
      const at = mulPt(here, [0, 0]);
      const w = value.length * fs * 0.55 * scale;
      const h = fs * scale;
      glyphs.push({
        contours: [{ closed: true, pts: [[at[0], at[1] - 0.2 * h], [at[0] + w, at[1] - 0.2 * h], [at[0] + w, at[1] + 0.75 * h], [at[0], at[1] + 0.75 * h]] }],
        fill: false, stroke: false, key: 't' + value, parts: ps, color: col,
        text: { value, size: h, at },
      });
      return;
    }
    for (const child of a.childNodes(el)) walk(child, here, ps, col);
  };

  const svg = a.firstChild(node as never);
  walk(svg, mul(root, IDENTITY), [], undefined);
  if (!glyphs.length) throw new ScriptError(`"${tex}" has nothing to draw.`);
  const eq = glyphs.find((g) => RELATIONS.has(g.key));
  const result: MathResult = { glyphs, equalsX: eq ? centerX(eq) : undefined };
  cache.set(key, result);
  return result;
}

const mulPt = (m: Mat, p: [number, number]): [number, number] => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

/** Character codes of "=", "<", ">", "≤", "≥", "≠", "≈". */
export const RELATIONS = new Set(['c3D', 'c3C', 'c3E', 'c2264', 'c2265', 'c2260', 'c2248']);

export function centerX(g: Glyph): number {
  let lo = Infinity, hi = -Infinity;
  for (const c of g.contours) for (const p of c.pts) { lo = Math.min(lo, p[0]); hi = Math.max(hi, p[0]); }
  return (lo + hi) / 2;
}

/** Plain maths, as typed in a calculator, to LaTeX. Equations and inequalities are split at their signs. */
export function mathToTex(text: string): string {
  const parts = text.split(/(<=|>=|!=|≤|≥|≠|=|<|>)/);
  const SIGNS: Record<string, string> = { '=': '=', '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge', '!=': '\\ne', '≤': '\\le', '≥': '\\ge', '≠': '\\ne' };
  return parts.map((p, i) => (i % 2 ? ` ${SIGNS[p]} ` : sideToTex(p, text))).join('').trim();
}

function sideToTex(side: string, whole: string): string {
  if (!side.trim()) return '';
  try {
    const node = parseMath(side);
    return node
      .toTex({ parenthesis: 'auto', implicit: 'hide' })
      .replace(/\\cdot/g, (m, offset: number, all: string) => {
        // 2*a*b is written by hand as 2ab: drop the dot between a number or
        // letter and a following letter.
        const after = all.slice(offset + m.length).trimStart();
        return /^\{?\s*[a-zA-Z\\(]/.test(after) && !/^\{?\s*\\(left|frac|sqrt)/.test(after) ? ' ' : m;
      })
      .replace(/\\mathrm\{([a-zA-Z])\}/g, '$1')
      .replace(/~/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (err) {
    throw new ScriptError(`"${whole}" could not be read as maths: ${(err as Error).message}`);
  }
}

/** The glyph keys a piece of maths is made of, to find it inside a bigger one. */
export function keysOf(tex: string, size = 0.5): string[] {
  return texToGlyphs(tex, size).glyphs.map((g) => g.key);
}
