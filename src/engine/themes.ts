// Themes: colours and fonts. Each theme gives its own shade of every colour
// name, chosen to look right on its background.

import { ScriptError, didYouMean, isObject } from './util';

export const COLOR_NAMES = [
  'white', 'black', 'grey', 'light_grey', 'dark_grey', 'blue', 'light_blue', 'dark_blue', 'teal', 'green',
  'light_green', 'dark_green', 'yellow', 'gold', 'orange', 'red', 'light_red', 'dark_red', 'pink', 'purple',
  'light_purple', 'brown', 'accent', 'ink', 'good', 'bad',
] as const;

export interface Theme {
  name: string;
  background: string | [string, string];
  ink: string;
  accent: string;
  colors: string[];
  good: string;
  bad: string;
  surface: string;
  onSurface: string;
  grid: string;
  grain: number;
  vignette: number;
  glow: number;
  fonts: { text: string; title: string; math: string };
  /** Shades for colour names. */
  shades: Record<string, string>;
}

// Shades that read well on a dark background (close to the classic maths
// explainer palette) and on a light one.
const DARK: Record<string, string> = {
  white: '#ffffff', black: '#000000', grey: '#888888', light_grey: '#bbbbbb', dark_grey: '#444444',
  blue: '#58c4dd', light_blue: '#9cdceb', dark_blue: '#236b8e', teal: '#5cd0b3', green: '#83c167',
  light_green: '#a6cf8c', dark_green: '#699c52', yellow: '#ffff00', gold: '#f0ac5f', orange: '#ff862f',
  red: '#fc6255', light_red: '#f7a1a3', dark_red: '#cf5044', pink: '#d147bd', purple: '#9a72ac',
  light_purple: '#b189c6', brown: '#8b4513',
};
const LIGHT: Record<string, string> = {
  white: '#ffffff', black: '#111111', grey: '#777777', light_grey: '#aaaaaa', dark_grey: '#333333',
  blue: '#1f6fbf', light_blue: '#4f9ad8', dark_blue: '#164a7e', teal: '#12867a', green: '#2e8b3e',
  light_green: '#58a95c', dark_green: '#1d5e2a', yellow: '#c99a00', gold: '#b7791f', orange: '#d9630f',
  red: '#d23a2f', light_red: '#e2756b', dark_red: '#9b2018', pink: '#c2338f', purple: '#6c4a9e',
  light_purple: '#8f6bbf', brown: '#7a4a1f',
};

const SANS = 'Poppins, "Noto Sans", "Noto Sans Devanagari", system-ui, sans-serif';

const base = (over: Partial<Theme> & Pick<Theme, 'name' | 'background' | 'ink' | 'accent' | 'shades'>): Theme => ({
  colors: [over.shades.blue, over.shades.yellow, over.shades.green, over.shades.red, over.shades.purple, over.shades.teal],
  good: over.shades.green,
  bad: over.shades.red,
  surface: 'rgba(20,22,28,0.92)',
  onSurface: '#f2f2f2',
  grid: 'rgba(88,196,221,0.18)',
  grain: 0,
  vignette: 0,
  glow: 0,
  fonts: { text: SANS, title: SANS, math: 'computer_modern' },
  ...over,
});

export const THEMES: Record<string, Theme> = {
  night: base({ name: 'night', background: '#0f0f12', ink: '#ffffff', accent: DARK.yellow, shades: DARK }),
  board: base({
    name: 'board', background: ['#2d4a3a', '#1f3529'], ink: '#f4f1e8', accent: '#ffe17a',
    shades: { ...DARK, blue: '#9fd3f0', yellow: '#ffe17a', green: '#b9e6a0', red: '#ff9e95', pink: '#f6a8dc' },
    grid: 'rgba(255,255,255,0.08)', grain: 0.05, vignette: 0.25,
  }),
  paper: base({
    name: 'paper', background: ['#f6efdf', '#eadfc6'], ink: '#2b2620', accent: '#c0392b', shades: LIGHT,
    surface: 'rgba(255,250,240,0.95)', onSurface: '#2b2620', grid: 'rgba(43,38,32,0.1)', grain: 0.04, vignette: 0.2,
  }),
  white: base({
    name: 'white', background: '#ffffff', ink: '#111111', accent: LIGHT.blue, shades: LIGHT,
    surface: 'rgba(245,247,250,0.97)', onSurface: '#111111', grid: 'rgba(0,0,0,0.08)',
  }),
  grid: base({
    name: 'grid', background: '#fbfcff', ink: '#2c3e57', accent: LIGHT.red, shades: LIGHT,
    surface: 'rgba(255,255,255,0.97)', onSurface: '#2c3e57', grid: 'rgba(60,110,180,0.16)',
  }),
  deep: base({
    name: 'deep', background: ['#13213a', '#0a1222'], ink: '#eef3ff', accent: '#f2c14e',
    shades: { ...DARK, blue: '#6fb7ff', yellow: '#f2c14e', teal: '#3fd0c9', gold: '#f2c14e' }, vignette: 0.3,
  }),
  sunny: base({
    name: 'sunny', background: ['#fff7e6', '#ffe9c2'], ink: '#3a2a1a', accent: '#ff6b3d', shades: LIGHT,
    surface: 'rgba(255,255,255,0.95)', onSurface: '#3a2a1a', grid: 'rgba(255,107,61,0.12)',
  }),
};

export const THEME_NAMES = Object.keys(THEMES);

export function readTheme(spec: unknown, where: string): Theme {
  if (spec === undefined) return THEMES.night;
  if (typeof spec === 'string') {
    const t = THEMES[spec];
    if (!t) throw new ScriptError(`there is no theme "${spec}".${didYouMean(spec, THEME_NAMES)} Themes: ${THEME_NAMES.join(', ')}.`, where);
    return t;
  }
  if (!isObject(spec)) throw new ScriptError('must be a theme name or an object.', where);
  const from = readTheme(spec.base ?? 'night', `${where}.base`);
  const t: Theme = { ...from, fonts: { ...from.fonts }, shades: { ...from.shades } };
  for (const k of ['background', 'ink', 'accent', 'good', 'bad', 'surface', 'grid'] as const) {
    if (spec[k] !== undefined) (t as unknown as Record<string, unknown>)[k] = spec[k];
  }
  if (spec.on_surface !== undefined) t.onSurface = String(spec.on_surface);
  if (Array.isArray(spec.colors)) t.colors = spec.colors.map(String);
  for (const k of ['grain', 'vignette', 'glow'] as const) if (typeof spec[k] === 'number') t[k] = spec[k] as number;
  if (isObject(spec.fonts)) Object.assign(t.fonts, spec.fonts);
  return t;
}

/** A colour from a script: a name, "accent", or any CSS colour. */
export function colorOf(value: unknown, theme: Theme, where: string): string {
  if (typeof value !== 'string') throw new ScriptError(`must be a colour, not ${JSON.stringify(value)}.`, where);
  if (value === 'accent') return theme.accent;
  if (value === 'ink') return theme.ink;
  if (value === 'good') return theme.good;
  if (value === 'bad') return theme.bad;
  if (theme.shades[value]) return theme.shades[value];
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) || /^(rgb|rgba|hsl|hsla)\(/.test(value)) return value;
  throw new ScriptError(`"${value}" is not a colour.${didYouMean(value, COLOR_NAMES)} Use a colour name or hex such as "#58c4dd".`, where);
}
