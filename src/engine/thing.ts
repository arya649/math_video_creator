// A Thing is anything a script can put on screen and name: an equation, a
// shape, a line of text. It is drawn from glyphs: outlines in sheet units.
//
// A Thing keeps two copies of itself:
//   - `build`: how it is at the point the compiler has reached, used to lay
//     out later things ("below eq1") and to plan changes ("steps");
//   - `state`: how it is at the frame being drawn. It is reset from `base`
//     every frame, then every action that has started changes it.

import { type Box, type Contour, type Mat, type Pt, boundsOf, mul, unionBox } from './geom';
import type { TextLayout } from './text';

export interface Glyph {
  /** Outlines, relative to the thing's origin, in sheet units, y up. */
  contours: Contour[];
  /** Filled (letters, solid shapes) or only stroked (lines). */
  fill: boolean;
  stroke: boolean;
  /** Its own colour; otherwise the thing's colour. */
  color?: string;
  /** Line width in design pixels (sizes are for a 1080-pixel-high frame). */
  width?: number;
  /** What it is, for matching between steps: a character code, "rule", ... */
  key: string;
  /** Named parts of an expression it belongs to. */
  parts: string[];
  /** Words drawn as text, for letters the maths font lacks. */
  text?: { value: string; size: number; at: Pt };
  dash?: boolean;
  fillOpacity?: number;
}

export interface GlyphState {
  dx: number;
  dy: number;
  opacity: number;
  color?: string;
  scale: number;
}

export interface ThingState {
  visible: boolean;
  x: number;
  y: number;
  scale: number;
  /** Stretch across and up, for flips and wobbles. */
  sx: number;
  sy: number;
  rotation: number;
  opacity: number;
  /** How much of it has been drawn on, 0 to 1. */
  drawn: number;
  /** How drawing on looks: pen strokes then fill, a fade, a reveal. */
  drawStyle: 'write' | 'draw' | 'reveal';
  color?: string;
  glyphs: Glyph[];
  glyphStates?: GlyphState[];
  /** Fade everything but this, for `focus`. */
  dim: number;
  /** A soft glow behind it. */
  glow: number;
  glowColor?: string;
}

export type ThingKind = 'math' | 'shape' | 'text' | 'group' | 'decoration' | 'image';

/** A picture drawn by a thing of kind "image". */
export interface ImageSpec {
  file: string;
  /** Size in sheet units. */
  w: number;
  h: number;
  frame: 'none' | 'rounded' | 'circle' | 'polaroid';
  tone: 'none' | 'mono' | 'faded' | 'warm' | 'cold';
  motion: 'none' | 'in' | 'out' | 'left' | 'right';
  /** When it first appears and how long it is seen, for its slow move. */
  start: number;
  length: number;
  caption?: string;
}

/** A picture worked out pixel by pixel (fractals, domain colouring), over a box on the sheet. */
export interface Raster {
  x0: number; y0: number; x1: number; y1: number;
  /** Pixels across. */
  res: number;
  /** Fill the pixels (rows from the top, RGBA) for time t. */
  paint(t: number, w: number, h: number, data: Uint8ClampedArray): void;
}

export class Thing {
  base: ThingState;
  state: ThingState;
  build: { x: number; y: number; scale: number; glyphs: Glyph[]; visible: boolean };
  /** Drawn over the picture, unmoved by the camera. */
  screen = false;
  /** Moves with another thing. */
  parent?: Thing;
  /** For text things: the laid-out lines. */
  text?: TextLayout;
  /** Group members. */
  members: Thing[] = [];
  /** Remembered for the recap. */
  key = false;
  /** Where its "=" sign is, in its own coordinates, if it has one. */
  equalsX?: number;
  /** Things drawn first are underneath. */
  layer = 0;
  /** Emphasis that does not follow the thing's own colour (highlight backs). */
  ink?: string;
  /** Named spots in its own coordinates: corners of a polygon, ends of a line. */
  spots: Record<string, Pt> = {};
  /** The LaTeX it was written from, for maths. */
  tex?: string;
  /** Size of its maths, for maths. */
  size = 0.5;
  /** A picture, for kind "image". */
  image?: ImageSpec;
  /** What the recap shows for it, when it is marked "key". */
  keyText?: { tex?: string; text?: string; title?: string };
  raster?: Raster;
  /** How far it rises off the sheet (seen when the camera tilts). */
  lift?: number;
  /** Its own drawing style, if the beat chose one. */
  look?: import('./styles').Look;
  /** The reason written beside its latest step; it fades at the next step. */
  note?: Thing;

  constructor(public id: string, public kind: ThingKind, glyphs: Glyph[], at: Pt) {
    this.base = {
      visible: false, x: at[0], y: at[1], scale: 1, sx: 1, sy: 1, rotation: 0, opacity: 1,
      drawn: 1, drawStyle: 'draw', glyphs, dim: 0, glow: 0,
    };
    this.state = { ...this.base };
    this.build = { x: at[0], y: at[1], scale: 1, glyphs, visible: true };
  }

  reset() {
    this.state = { ...this.base, glyphStates: undefined };
  }

  /** Where it is, as of the point the compiler has reached. */
  buildBox(): Box {
    const own = localBox(this.build.glyphs, this.text);
    const s = this.build.scale;
    let b: Box = { x0: this.build.x + own.x0 * s, y0: this.build.y + own.y0 * s, x1: this.build.x + own.x1 * s, y1: this.build.y + own.y1 * s };
    for (const m of this.members) b = unionBox(b, m.buildBox());
    if (this.parent) {
      const p = this.parent.build;
      b = { x0: p.x + b.x0, y0: p.y + b.y0, x1: p.x + b.x1, y1: p.y + b.y1 };
    }
    return b;
  }

  /** Its transform at the frame being drawn, from its own units to sheet units. */
  matrix(): Mat {
    const s = this.state;
    const c = Math.cos(s.rotation) * s.scale, n = Math.sin(s.rotation) * s.scale;
    const own: Mat = [c * s.sx, n * s.sx, -n * s.sy, c * s.sy, s.x, s.y];
    return this.parent ? mul(this.parent.matrix(), own) : own;
  }

  /** Seen at all, taking its parent into account. */
  shown(): boolean {
    return this.state.visible && (!this.parent || this.parent.shown());
  }

  opacity(): number {
    return this.state.opacity * (this.parent ? this.parent.opacity() : 1);
  }
}

export function localBox(glyphs: Glyph[], text?: TextLayout): Box {
  if (text) return text.box;
  const cs: Contour[] = [];
  for (const g of glyphs) cs.push(...g.contours);
  return boundsOf(cs);
}

export function glyphBox(g: Glyph): Box {
  return boundsOf(g.contours);
}

/** Move glyphs so their bounding box is centred on 0, 0. */
export function centerGlyphs(glyphs: Glyph[]): { glyphs: Glyph[]; shift: Pt } {
  const b = localBox(glyphs);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  return { glyphs: shiftGlyphs(glyphs, -cx, -cy), shift: [-cx, -cy] };
}

export function shiftGlyphs(glyphs: Glyph[], dx: number, dy: number): Glyph[] {
  return glyphs.map((g) => ({
    ...g,
    contours: g.contours.map((c) => ({ closed: c.closed, pts: c.pts.map(([x, y]) => [x + dx, y + dy] as Pt) })),
    text: g.text ? { ...g.text, at: [g.text.at[0] + dx, g.text.at[1] + dy] } : undefined,
  }));
}
