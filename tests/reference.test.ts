import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTIONS, ALIASES } from '../src/engine/actions';
import '../src/engine/movie';
import { THEME_NAMES } from '../src/engine/themes';
import { SHAPES } from '../src/engine/actions/shapes';
import { TRANSITIONS, TOP_KEYS, SCENE_KEYS } from '../src/engine/movie';
import { SHOTS } from '../src/engine/camera';
import { entries } from '../src/catalog/entries';

const ref = readFileSync('docs/SCRIPT_REFERENCE.md', 'utf8');

describe('the script reference', () => {
  it('describes every action and its other names', () => {
    for (const name of ACTIONS.keys()) expect(ref, name).toMatch(new RegExp(`### [^\\n]*\\b${name}\\b`));
    for (const alias of ALIASES.keys()) expect(ref, alias).toContain(alias);
  });
  it('lists every word the engine accepts', () => {
    for (const w of [...THEME_NAMES, ...SHAPES, ...TRANSITIONS, ...SHOTS, ...TOP_KEYS, ...SCENE_KEYS]) {
      expect(ref, w).toContain(`\`${w}\``);
    }
  });
  it('explains every catalogue ID group', () => {
    for (const g of new Set(entries.map((e) => e.id.split(':')[0]))) expect(ref, g).toContain(`\`${g}:\``);
  });
});
