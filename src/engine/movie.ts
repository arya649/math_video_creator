// Compiling a script into a Movie: scenes, timing, transitions, languages.

import { teachingChecks } from './teach-check';
import './actions/index';
import { makeWorldAxes } from './actions/graph';
import { setupGeometryWorld } from './actions/geometry';
import { setupCountingWorld } from './actions/counting';
import { readCamera3d, setupSpaceWorld } from './actions/space';
import { ACTIONS, BEAT_KEYS, type Ctx, type Done, SOUND_KINDS, type SoundKind, type Spec, findAction } from './actions';
import { CameraPlan, SHOT_KEYS, type View, readCamera } from './camera';
import {
  type Narration, type VoiceTimes, estimateNarration, narrationFromSrt, narrationFromVoice, parseSrt, readLines, scaledNarration,
} from './narration';
import { type Theme, readTheme, colorOf } from './themes';
import { Thing } from './thing';
import type { Box } from './geom';
import { LOOKS, LOOK_THEMES, type Look } from './styles';
import { ScriptError, choice, clamp, didYouMean, isObject } from './util';
import { type Action, SceneWorld, type SoundEvent, WORLDS, type WorldKind } from './world';

export const TOP_KEYS = [
  'title', 'languages', 'voice', 'audio', 'subtitles', 'theme', 'style', 'symbols', 'format', 'fps', 'captions', 'music',
  'sounds', 'strings', 'fonts', 'models', 'characters', 'chapters', 'thumbnail', 'end_screen', 'checks', 'motion_blur',
  'duration', 'lines', 'scenes', 'grade', 'glow', 'depth', 'camera_style',
] as const;

export const SCENE_KEYS = [
  'name', 'chapter', 'chapter_card', 'world', 'start_line', 'start_cue', 'start', 'transition', 'transition_duration', 'keep', 'into',
  'style', 'theme', 'symbols', 'captions', 'grade', 'glow', 'depth', 'camera_style', 'background', 'place', 'beats',
  'paper', 'axes', 'grid', 'numbers', 'units', 'decimals', 'number_line', 'table', 'light', 'floor', 'camera',
] as const;

export const TRANSITIONS = ['cut', 'fade', 'black', 'slide', 'slide_left', 'slide_up', 'slide_down', 'wipe', 'morph', 'fly', 'zoom', 'rub', 'page'] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const FORMATS: Record<string, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 },
  landscape_4k: { width: 3840, height: 2160 },
  square: { width: 1080, height: 1080 },
  reel: { width: 1080, height: 1920 },
};

/** Worlds that can be used in a script now. */
export const WORLDS_BUILT: readonly WorldKind[] = ['board', 'graph', 'geometry', 'counting', 'space'];

export interface Background {
  style: 'plain' | 'gradient' | 'grid' | 'dots' | 'lined' | 'image';
  colors?: string[];
  spacing: number;
  /** A picture behind everything, darkened and blurred so the maths reads over it. */
  image?: { file: string; dim: number; blur: number };
}

/** A moment the whole video holds still (voice included) for the viewer. */
export interface Wait { at: number; length: number }

/** A music track, with its times worked out. */
export interface MusicTrack {
  file: string;
  start: number;
  end?: number;
  volume: number;
  loop: boolean;
  fadeIn: number;
  fadeOut: number;
  /** Share of its volume while the narrator speaks. */
  duck: number;
}

export interface CaptionSettings {
  on: boolean;
  style: 'karaoke' | 'plain';
  position: 'bottom' | 'top';
  size: number;
  maths: boolean;
}

export class CompiledScene {
  constructor(
    public name: string,
    public world: SceneWorld,
    public camera: CameraPlan,
    public start: number,
    public end: number,
    public transition: Transition,
    public transitionDuration: number,
    public background: Background,
    public chapter?: string,
  ) {
    world.applyAt = (t, hold) => this.applyState(t, hold);
  }

  /** For the "zoom" transition: the box (on the scene before's sheet) it dives into. */
  zoomInto?: Box;
  /** For the "morph" transition: things that morph from the scene before, and how they look when it ends. */
  morph?: { ids: Set<string>; settle: number; snap: Map<string, { state: Thing['state']; view: View }> };

  /** Put the scene in its state at time t. Nothing is kept from the frame before. */
  applyState(t: number, hold?: { at: number; u: number }) {
    for (const thing of this.world.order) thing.reset();
    this.world.resetFrame();
    this.world.now = t;
    this.world.hold = hold;
    for (const a of this.world.actions) {
      if (t < a.start) break;
      const u = a.duration <= 0 ? 1 : clamp((t - a.start) / a.duration);
      a.apply(u, t);
    }
    // Graphs, points and anything else that follows values and axes.
    for (const live of this.world.livers) live(t);
  }
}

export interface Layer {
  scene: CompiledScene;
  alpha: number;
  /** Moving the whole picture: scale by z about (0, 0), then shift (pixels). */
  xf?: { z: number; tx: number; ty: number };
  /** Turning away like a page, 0 to 1. */
  page?: number;
  /** Rubbed off like a board, 0 to 1. */
  rub?: number;
  /** Things left out (they are morphing, drawn by themselves). */
  skip?: Set<string>;
  /** Draw the morphing things over everything, from scene `from` to this one. */
  morph?: { from: CompiledScene; u: number };
  /** Through the background colour, for "black". */
  black?: number;
  /** Sliding: how far across, in frame widths, and which way. */
  slide?: [number, number];
  /** Wipe: how far the new scene has been uncovered, 0 to 1. */
  wipe?: number;
}

export class Movie {
  constructor(
    public title: string,
    public lang: string,
    public languages: string[],
    public theme: Theme,
    public width: number,
    public height: number,
    /** Frame size in sheet units at rest. */
    public frameW: number,
    public frameH: number,
    public fps: number,
    public duration: number,
    public narration: Narration,
    public captions: CaptionSettings,
    public scenes: CompiledScene[],
    public warnings: string[],
    public audio: string | undefined,
    /** Music under the narration. */
    public music: MusicTrack[] = [],
    /** One-off sounds: the engine's own and sound files. */
    public sounds: SoundEvent[] = [],
    /** Moments the whole video holds still for the viewer, in script time. */
    public waits: Wait[] = [],
  ) {
    this.scriptDuration = duration;
    this.duration = duration + waits.reduce((a, w) => a + w.length, 0);
  }

  /** How long the script runs, without the waits. */
  scriptDuration: number;

  /**
   * Video time to script time. During a wait the script's clock stands still;
   * `hold` says which wait, and how far through it the video is.
   */
  toScript(T: number): { t: number; hold?: { at: number; u: number } } {
    let shift = 0;
    for (const w of this.waits) {
      if (T < w.at + shift) break;
      if (T < w.at + shift + w.length) return { t: w.at, hold: { at: w.at, u: (T - (w.at + shift)) / w.length } };
      shift += w.length;
    }
    return { t: T - shift };
  }

  /** Script time to video time: later by every wait before it. */
  toVideo(t: number): number {
    let shift = 0;
    for (const w of this.waits) if (w.at < t) shift += w.length;
    return t + shift;
  }

  sceneAt(t: number): number {
    let i = 0;
    for (let k = 0; k < this.scenes.length; k++) if (t >= this.scenes[k].start) i = k;
    return i;
  }

  /** What is on screen at time t: one scene, or two during a transition. */
  frame(t: number): Layer[] {
    const i = this.sceneAt(t);
    const s = this.scenes[i];
    const next = this.scenes[i + 1];
    // A transition happens just before the scene it brings in.
    if (next && next.transition !== 'cut' && t >= next.start - next.transitionDuration) {
      const u = clamp((t - (next.start - next.transitionDuration)) / next.transitionDuration);
      return transitionLayers(s, next, u, this.width, this.height, this.frameH);
    }
    return [{ scene: s, alpha: 1 }];
  }
}

function transitionLayers(a: CompiledScene, b: CompiledScene, u: number, W: number, H: number, frameH: number): Layer[] {
  const e = u * u * (3 - 2 * u);
  switch (b.transition) {
    case 'fly': {
      // Pulling back over one huge sheet, across to the next part of it, and down again.
      const z = 1 - 0.42 * Math.sin(Math.PI * u);
      const D = W * 1.25, c = D * e;
      return [
        { scene: a, alpha: 1, xf: { z, tx: (W / 2) * (1 - z) - c * z, ty: (H / 2) * (1 - z) } },
        { scene: b, alpha: 1, xf: { z, tx: (W / 2) * (1 - z) + (D - c) * z, ty: (H / 2) * (1 - z) } },
      ];
    }
    case 'zoom': {
      const box = b.zoomInto!;
      const v = a.camera.viewAt(b.start - b.transitionDuration);
      const k = (H / frameH) * v.zoom;
      const c: [number, number] = [W / 2 + ((box.x0 + box.x1) / 2 - v.cx) * k, H / 2 - ((box.y0 + box.y1) / 2 - v.cy) * k];
      const K = Math.max(2, Math.min(14, H / Math.max(1, (box.y1 - box.y0) * k, ((box.x1 - box.x0) * k * H) / W)));
      const m: [number, number] = [c[0] + (W / 2 - c[0]) * e, c[1] + (H / 2 - c[1]) * e];
      const za = Math.exp(Math.log(K) * e), zb = Math.exp(Math.log(1 / K) * (1 - e));
      return [
        { scene: a, alpha: 1, xf: { z: za, tx: m[0] - c[0] * za, ty: m[1] - c[1] * za } },
        { scene: b, alpha: Math.min(1, u * 2.2), xf: { z: zb, tx: m[0] - (W / 2) * zb, ty: m[1] - (H / 2) * zb } },
      ];
    }
    case 'page': return [{ scene: b, alpha: 1 }, { scene: a, alpha: 1, page: e }];
    case 'rub': return [{ scene: b, alpha: 1 }, { scene: a, alpha: 1, rub: u }];
    case 'morph': {
      const ids = b.morph?.ids ?? new Set<string>();
      return [{ scene: a, alpha: 1, skip: ids }, { scene: b, alpha: e, skip: ids, morph: { from: a, u: e } }];
    }
    case 'fade': return [{ scene: a, alpha: 1 }, { scene: b, alpha: e }];
    case 'black':
      return u < 0.5 ? [{ scene: a, alpha: 1, black: u * 2 }] : [{ scene: b, alpha: 1, black: (1 - u) * 2 }];
    case 'wipe': return [{ scene: a, alpha: 1 }, { scene: b, alpha: 1, wipe: e }];
    default: {
      const dir: [number, number] = b.transition === 'slide_left' ? [-1, 0] : b.transition === 'slide_up' ? [0, 1] : b.transition === 'slide_down' ? [0, -1] : [1, 0];
      // The new scene comes in from `dir`, pushing the old one out.
      return [
        { scene: a, alpha: 1, slide: [-dir[0] * e, -dir[1] * e] },
        { scene: b, alpha: 1, slide: [dir[0] * (1 - e), dir[1] * (1 - e)] },
      ];
    }
  }
}

export interface CompileOptions {
  /** The language to make. Default: the first of the script's languages. */
  lang?: string;
  /** Exact times per language: a made voice, or the creator's recording lined up with the words. */
  voices?: Record<string, VoiceTimes>;
  /** Lengths in seconds of sound files opened with the script, by name. */
  audioLengths?: Record<string, number>;
  /** Text of subtitle files, by file name. */
  texts?: Record<string, string>;
  /** Override the script's captions (the page's switch). */
  captions?: boolean;
  /** Draw smaller than the format's size (previews, the catalogue). Keeps the shape. */
  scale?: number;
  /** Widths and heights of pictures opened with the script, by name. */
  imageSizes?: Record<string, [number, number]>;
}

/** Pick one language out of every text in the script, and look up @strings. */
export function localize(v: unknown, lang: string, languages: string[], strings: Record<string, unknown>, where: string): unknown {
  if (typeof v === 'string') {
    if (v.startsWith('@') && /^@[\w-]+$/.test(v)) {
      const s = strings[v.slice(1)];
      if (s === undefined) throw new ScriptError(`there is no "${v.slice(1)}" under strings.${didYouMean(v.slice(1), Object.keys(strings))}`, where);
      return localize(s, lang, languages, strings, where);
    }
    return v.replace(/\\text\{@([\w-]+)\}/g, (_m, name: string) => {
      const s = localize(`@${name}`, lang, languages, strings, where);
      return `\\text{${String(s)}}`;
    });
  }
  if (Array.isArray(v)) return v.map((x, i) => localize(x, lang, languages, strings, `${where}[${i}]`));
  if (isObject(v)) {
    const keys = Object.keys(v);
    if (keys.length && keys.every((k) => languages.includes(k))) {
      if (!(lang in v)) throw new ScriptError(`has no words in "${lang}". Give it in every language of the video: ${languages.join(', ')}.`, where);
      return v[lang];
    }
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = localize(x, lang, languages, strings, `${where}.${k}`);
    return out;
  }
  return v;
}

export function compileMovie(script: unknown, opts: CompileOptions = {}): Movie {
  if (!isObject(script)) throw new ScriptError('A script must be a JSON object with "scenes".');
  const warnings: string[] = [];
  const warnKeys = (o: Record<string, unknown>, allowed: readonly string[], where: string) => {
    for (const k of Object.keys(o)) {
      if (!allowed.includes(k)) warnings.push(`${where}: "${k}" is not a setting here and was ignored.${didYouMean(k, allowed)}`);
    }
  };
  warnKeys(script, TOP_KEYS, 'script');

  const languages = script.languages === undefined ? ['en'] : script.languages;
  if (!Array.isArray(languages) || !languages.length || !languages.every((l) => typeof l === 'string')) {
    throw new ScriptError('must be a list of language codes, such as ["en", "hi"].', 'languages');
  }
  const lang = opts.lang ?? languages[0];
  if (!languages.includes(lang)) throw new ScriptError(`"${lang}" is not one of the script's languages (${languages.join(', ')}).`, 'languages');
  const strings = isObject(script.strings) ? script.strings : {};

  const topLook = choice(script.style, LOOKS, 'style', 'vector') as Look;
  const theme = readTheme(script.theme ?? LOOK_THEMES[topLook], 'theme');
  const format = choice(script.format, Object.keys(FORMATS) as ('landscape' | 'landscape_4k' | 'square' | 'reel')[], 'format', 'landscape');
  const full = FORMATS[format];
  const width = Math.round(full.width * (opts.scale ?? 1)), height = Math.round(full.height * (opts.scale ?? 1));
  // The frame at rest is 9 sheet units on its short side (16 x 9 for landscape).
  const sheet = width >= height ? { w: (9 * width) / height, h: 9 } : { w: 9, h: (9 * height) / width };
  const fps = choice(String(script.fps ?? 60), ['24', '30', '60'] as const, 'fps') as string;

  // ---- Narration ----
  const lines = readLines(script.lines, lang, languages, 'lines');
  // The narration's sound and times. Either the creator's own recording
  // (timed by its subtitle file, by lining it up with the words, or by
  // stretching the estimate to its length), or a voice the engine made, or
  // no sound yet (times estimated from the words).
  let narration: Narration;
  let audio: string | undefined;
  const subs = isObject(script.subtitles) ? script.subtitles[lang] : undefined;
  const audioSpec = script.audio === undefined ? undefined : isObject(script.audio) ? script.audio[lang] : languages.length === 1 ? script.audio : undefined;
  if (script.audio !== undefined && !isObject(script.audio) && typeof script.audio !== 'string') {
    throw new ScriptError('must be a sound file, or a sound file per language: { "en": "narration_en.mp3" }.', 'audio');
  }
  const voice = opts.voices?.[lang];
  if (typeof audioSpec === 'string') {
    audio = audioSpec;
    if (typeof subs === 'string') {
      const text = opts.texts?.[subs];
      if (text === undefined) throw new ScriptError(`names the subtitle file "${subs}", which was not opened with the script.`, `subtitles.${lang}`);
      narration = narrationFromSrt(parseSrt(text));
    } else if (voice && voice.kind === 'aligned' && (!voice.audio || voice.audio === audioSpec)) {
      narration = narrationFromVoice(lines, voice, `audio.${lang}`);
    } else if (opts.audioLengths?.[audioSpec] !== undefined) {
      narration = scaledNarration(lines, opts.audioLengths[audioSpec]);
    } else narration = estimateNarration(lines);
  } else if (voice) {
    narration = narrationFromVoice(lines, voice, 'voice');
    audio = voice.audio ?? `voice_${lang}.wav`;
  } else if (typeof subs === 'string') {
    throw new ScriptError(`gives a subtitle file for "${lang}" but no recording under "audio".`, `subtitles.${lang}`);
  } else narration = estimateNarration(lines);

  const lineByRef = (ref: unknown, where: string) => {
    const l = typeof ref === 'number'
      ? narration.lines[ref - 1]
      : narration.lines.find((x) => x.id === ref);
    if (!l) {
      throw new ScriptError(
        typeof ref === 'number'
          ? `there is no line ${ref}; the script has ${narration.lines.length} line${narration.lines.length === 1 ? '' : 's'}.`
          : `there is no line with the id "${String(ref)}".`,
        where,
      );
    }
    return l;
  };
  const cueTime = (name: unknown, where: string) => {
    const t = narration.cues.get(String(name));
    if (t === undefined) throw new ScriptError(`there is no cue {${String(name)}} in the lines.${didYouMean(String(name), [...narration.cues.keys()])}`, where);
    return t;
  };
  const lineAt = (t: number) => narration.lines.find((l) => t >= l.start - 1e-6 && t < l.end + 0.2);

  // ---- Captions ----
  const capSpec = script.captions;
  const cap: CaptionSettings = { on: true, style: 'karaoke', position: 'bottom', size: 0.36, maths: true };
  if (capSpec === false) cap.on = false;
  else if (isObject(capSpec)) {
    warnKeys(capSpec, ['style', 'position', 'size', 'maths'], 'captions');
    cap.style = choice(capSpec.style, ['karaoke', 'plain'] as const, 'captions.style', 'karaoke');
    cap.position = choice(capSpec.position, ['bottom', 'top'] as const, 'captions.position', 'bottom');
    const sizes = { small: 0.3, medium: 0.36, large: 0.46 } as Record<string, number>;
    if (capSpec.size !== undefined) cap.size = typeof capSpec.size === 'number' ? capSpec.size : sizes[choice(capSpec.size, ['small', 'medium', 'large'] as const, 'captions.size')];
    cap.maths = capSpec.maths !== false;
  }
  if (opts.captions !== undefined) cap.on = opts.captions;

  // ---- The engine's own sounds ----
  const soundLevel = choice(script.sounds, ['none', 'soft', 'lively'] as const, 'sounds', 'soft');
  const soundVolume = soundLevel === 'lively' ? 0.5 : 0.25;

  // ---- Scenes ----
  if (!Array.isArray(script.scenes) || !script.scenes.length) throw new ScriptError('needs at least one scene.', 'scenes');
  const rawScenes = script.scenes.map((s, i) => {
    const where = `scenes[${i}]`;
    if (!isObject(s)) throw new ScriptError('must be an object.', where);
    return localize(s, lang, languages, strings, where) as Spec;
  });
  const starts = rawScenes.map((s, i) => {
    const where = `scenes[${i}]`;
    if (i === 0) return 0;
    if (s.start_line !== undefined) return lineByRef(s.start_line, `${where}.start_line`).start;
    if (s.start_cue !== undefined) return cueTime(s.start_cue, `${where}.start_cue`);
    if (typeof s.start === 'number') return s.start;
    throw new ScriptError('every scene after the first needs "start_line", "start_cue" or "start".', where);
  });
  starts.forEach((t, i) => {
    if (i > 0 && t < starts[i - 1]) throw new ScriptError(`starts at ${t.toFixed(1)} s, before the scene before it. Scenes must be in time order.`, `scenes[${i}]`);
  });

  const scenes: CompiledScene[] = [];
  const allWorlds: SceneWorld[] = [];
  let chapterNow: string | undefined;
  let chapterCount = 0;
  let lastEnd = 0;
  const checks = isObject(script.checks) ? script.checks : {};
  if (script.checks !== undefined && !isObject(script.checks)) throw new ScriptError('must be { "maths": false } or { "teaching": false }, or name teaching checks to turn off.', 'checks');
  const checkMaths = checks.maths !== false;
  rawScenes.forEach((s, i) => {
    const where = `scenes[${i}]${typeof s.name === 'string' ? ` ("${s.name}")` : ''}`;
    warnKeys(s, SCENE_KEYS, where);
    const kind = choice(s.world, WORLDS, `${where}.world`, 'board');
    if (!WORLDS_BUILT.includes(kind)) {
      throw new ScriptError(`the ${kind} world is not built yet. Worlds that work now: ${WORLDS_BUILT.join(', ')}.`, `${where}.world`);
    }
    const look = (s.style !== undefined ? choice(s.style, LOOKS, `${where}.style`) : topLook) as Look;
    const sceneTheme = s.theme !== undefined ? readTheme(s.theme, `${where}.theme`) : script.theme === undefined && s.style !== undefined && LOOK_THEMES[look] ? readTheme(LOOK_THEMES[look], `${where}.style`) : theme;
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : Infinity;
    const world = new SceneWorld(kind, sceneTheme, start, end, sheet.w, sheet.h);
    allWorlds.push(world);
    world.allWorlds = allWorlds;
    world.checkMaths = checkMaths;
    world.lang = lang;
    world.texts = opts.texts ?? {};
    world.look = look;
    const fin = (k: string) => (s[k] !== undefined ? { v: s[k], w: `${where}.${k}` } : { v: script[k], w: k });
    const unitNum = (k: string) => { const { v, w } = fin(k); if (v === undefined) return 0; if (typeof v !== 'number' || v < 0 || v > 1) throw new ScriptError('must be a number from 0 to 1.', w); return v; };
    world.finish = {
      grade: choice(fin('grade').v, ['none', 'warm', 'cold', 'faded', 'mono', 'vivid'] as const, fin('grade').w, 'none'),
      glow: Math.max(unitNum('glow'), sceneTheme.glow ?? 0),
      depth: unitNum('depth'),
      cameraStyle: choice(fin('camera_style').v, ['steady', 'drift', 'breathe'] as const, fin('camera_style').w, 'steady'),
    };
    if (typeof s.chapter === 'string') chapterNow = s.chapter;
    world.chapter = chapterNow;
    world.imageSizes = opts.imageSizes ?? {};
    world.setSymbols(s.symbols ?? script.symbols, s.symbols !== undefined ? `${where}.symbols` : 'symbols');
    if (s.captions !== undefined) world.captions = s.captions !== false;
    const camera = new CameraPlan(sheet.w, sheet.h);
    let transition: Transition = 'cut';
    if (i > 0 && s.transition !== undefined) {
      transition = choice(s.transition, TRANSITIONS, `${where}.transition`);
    }
    const tdur = typeof s.transition_duration === 'number' ? s.transition_duration : ({ fly: 1.8, zoom: 1.4, page: 1.2, rub: 1.4, morph: 1.5 } as Record<string, number>)[transition] ?? 1;
    let zoomInto: Box | undefined;
    if (transition === 'zoom') {
      const prev = scenes[scenes.length - 1];
      if (typeof s.into !== 'string') throw new ScriptError('the "zoom" transition needs "into": the id of a thing in the scene before to dive into.', `${where}.into`);
      if (!prev.world.things.has(s.into.split('.')[0])) throw new ScriptError(`there is nothing called "${s.into}" in the scene before.${didYouMean(s.into, [...prev.world.things.keys()].filter((k) => !k.startsWith('_')))}`, `${where}.into`);
      zoomInto = prev.world.boxOf(s.into, `${where}.into`);
    } else if (s.into !== undefined) warnings.push(`${where}.into: only the "zoom" transition uses "into".`);
    const background = readBackground(s, sceneTheme, where);
    if (look === 'blueprint' && s.background === undefined && s.paper === undefined) background.style = 'grid';

    // Beats are built in the order written.
    const ends = new Map<string, number>();
    const begins = new Map<string, number>();
    let order = 0;
    let prevEnd = start;
    const pushAction = (a: Omit<Action, 'order' | 'where'>, w: string) => world.actions.push({ ...a, order: order++, where: w });

    const timeOf = (b: Spec, w: string, after: number): { start: number; duration?: number; lineEnd?: number } => {
      let t: number;
      let lineEnd: number | undefined;
      if (b.at_line !== undefined) {
        const l = lineByRef(b.at_line, `${w}.at_line`);
        t = l.start;
        lineEnd = l.end;
        if (b.at_word !== undefined) {
          const want = String(b.at_word).toLowerCase().replace(/[^\p{L}\p{N}$^]/gu, '');
          const hit = l.words.find((x) => x.text.toLowerCase().replace(/[^\p{L}\p{N}$^]/gu, '') === want);
          if (!hit) throw new ScriptError(`"${String(b.at_word)}" is not a word of line ${l.n}: "${l.text}".`, `${w}.at_word`);
          t = hit.start;
        }
      } else if (b.at_cue !== undefined) {
        t = cueTime(b.at_cue, `${w}.at_cue`);
        lineEnd = lineAt(t)?.end;
      } else if (b.at_word !== undefined) {
        throw new ScriptError('"at_word" only works together with "at_line".', w);
      } else if (b.then === true) {
        t = after;
      } else if (b.after !== undefined) {
        const e = ends.get(String(b.after));
        if (e === undefined) throw new ScriptError(`there is no earlier beat with the id "${String(b.after)}".`, `${w}.after`);
        t = e;
      } else if (b.with !== undefined) {
        const e = begins.get(String(b.with));
        if (e === undefined) throw new ScriptError(`there is no earlier beat with the id "${String(b.with)}".`, `${w}.with`);
        t = e;
      } else if (typeof b.at === 'number') {
        t = start + b.at;
      } else {
        throw new ScriptError('needs a start: "at_line", "at_cue", "then", "after", "with", or "at" (seconds).', w);
      }
      if (typeof b.offset === 'number') t += b.offset;
      let duration: number | undefined;
      if (typeof b.duration === 'number') duration = b.duration;
      else if (b.until_line !== undefined) duration = Math.max(0.1, lineByRef(b.until_line, `${w}.until_line`).end - t);
      else if (b.until_cue !== undefined) duration = Math.max(0.1, cueTime(b.until_cue, `${w}.until_cue`) - t);
      if (lineEnd === undefined) lineEnd = lineAt(t)?.end;
      return { start: t, duration, lineEnd };
    };

    const makeCtx = (b: Spec, w: string, startAt: number, duration: number | undefined, lineEnd: number | undefined, speed = 1): Ctx => ({
      spec: b, where: w, world, start: startAt, duration, speed, lineEnd,
      timeOf: (spec, ww, after) => timeOf(spec, ww, after),
      act: (a) => pushAction(a, w),
      sound: (kind: SoundKind, at: number, dur?: number) => {
        if (soundLevel === 'none' || b.sound === false) return;
        // Soft keeps the quieter writing sounds quieter still.
        const v = soundVolume * (kind === 'pen' || kind === 'chalk' ? 0.5 : 1);
        world.sounds.push({ at, kind, duration: dur, volume: v });
      },
      buildNested: (spec, ww, st) => buildBeat(spec, ww, st, undefined, undefined),
      warn: (m: string) => { warnings.push(`${w}: ${m}`); },
    });

    const buildBeat = (b: Spec, w: string, startAt: number, duration: number | undefined, lineEnd: number | undefined): Done => {
      if (b.do === undefined) return { end: startAt };
      const [name, def] = findAction(b.do, `${w}.do`);
      if (def.worlds && !def.worlds.includes(kind)) {
        throw new ScriptError(`"${name}" works in the ${def.worlds.join(' and ')} world${def.worlds.length > 1 ? 's' : ''}, not in a ${kind} scene.`, `${w}.do`);
      }
      warnKeys(b, [...BEAT_KEYS, ...def.params], w);
      for (const r of def.required ?? []) {
        if (b[r] === undefined) throw new ScriptError(`"${name}" needs "${r}".`, w);
      }
      const speedWord = b.speed;
      const speed = speedWord === undefined ? 1 : typeof speedWord === 'number' ? speedWord : ({ slow: 0.6, normal: 1, quick: 1.6 } as Record<string, number>)[String(speedWord)];
      if (!speed || speed <= 0) throw new ScriptError('must be "slow", "normal", "quick" or a number above 0.', `${w}.speed`);
      const ctx = makeCtx(b, w, startAt, duration, lineEnd, speed);
      world.beats.push({ name, at: startAt, where: w, spec: b });
      if (typeof b.sound === 'string') {
        // A sound chosen by the beat itself, as well as (or instead of) its own.
        const kind = choice(b.sound, SOUND_KINDS, `${w}.sound`);
        world.sounds.push({ at: startAt, kind, volume: Math.max(soundVolume, 0.25) });
      } else if (b.sound !== undefined && b.sound !== false) {
        throw new ScriptError(`must be false (silent) or one of ${SOUND_KINDS.join(', ')}.`, `${w}.sound`);
      }
      // A beat's own drawing style goes onto everything it makes.
      const beatLook = b.style !== undefined && !def.params.includes('style') ? (choice(b.style, LOOKS, `${w}.style`) as Look) : undefined;
      const before = world.order.length;
      try {
        const done = def.build(ctx);
        if (beatLook) for (const th of world.order.slice(before)) th.look = beatLook;
        if (b.lift !== undefined) {
          if (typeof b.lift !== 'number' || b.lift < 0 || b.lift > 5) throw new ScriptError('must be a number from 0 to 5.', `${w}.lift`);
          for (const th of world.order.slice(before)) th.lift = b.lift;
        }
        return done;
      } catch (err) {
        if (err instanceof ScriptError && !err.where) throw new ScriptError(err.message, w);
        throw err;
      }
    };

    // A graph scene has its axes from the start.
    if (kind === 'graph') makeWorldAxes(makeCtx({}, `${where}.axes`, start, undefined, undefined), s.axes, `${where}.axes`);
    if (kind === 'geometry') setupGeometryWorld(makeCtx({}, where, start, undefined, undefined), s, where);
    if (kind === 'space') setupSpaceWorld(makeCtx({}, where, start, undefined, undefined), s, where);
    if (kind === 'counting') setupCountingWorld(makeCtx({}, where, start, undefined, undefined), s, where);

    // Things carried over from the scene before, exactly as they were left.
    if (s.keep !== undefined && s.keep !== false) {
      const prev = scenes[scenes.length - 1];
      if (!prev) throw new ScriptError('the first scene has nothing before it to keep.', `${where}.keep`);
      if (s.keep !== 'all' && !(Array.isArray(s.keep) && s.keep.every((x) => typeof x === 'string'))) throw new ScriptError('must be "all" or a list of ids.', `${where}.keep`);
      prev.applyState(start - 1e-3);
      const wanted = s.keep === 'all' ? null : new Set(s.keep as string[]);
      if (wanted) for (const id of wanted) if (!prev.world.things.has(id)) throw new ScriptError(`there is nothing called "${id}" in the scene before.${didYouMean(id, [...prev.world.things.keys()].filter((k) => !k.startsWith('_')))}`, `${where}.keep`);
      const carried = new Map<Thing, Thing>();
      for (const old of prev.world.order) {
        if (old.kind === 'group' || old.id.startsWith('_')) continue;
        const named = wanted ? wanted.has(old.id) || (old.parent && wanted.has(old.parent.id)) || [...wanted].some((w) => prev.world.things.get(w)?.kind === 'group' && prev.world.things.get(w)!.members.includes(old)) : true;
        if (!named || !old.shown() || old.opacity() < 0.02) continue;
        if (prev.world.space?.objects.some((o) => o.thing === old)) { warnings.push(`${where}.keep: "${old.id}" is a 3D object; 3D objects are not carried into the next scene.`); continue; }
        const st = old.state;
        const th = new Thing(old.id, old.kind, st.glyphs, [st.x, st.y]);
        th.base.scale = st.scale; th.base.rotation = st.rotation; th.base.sx = st.sx; th.base.sy = st.sy;
        th.base.opacity = st.opacity; th.base.color = st.color ?? old.base.color; th.base.visible = true;
        th.build = { x: st.x, y: st.y, scale: st.scale, glyphs: st.glyphs, visible: true };
        Object.assign(th, { text: old.text, tex: old.tex, size: old.size, equalsX: old.equalsX, screen: old.screen, layer: old.layer, image: old.image, look: old.look, key: old.key, keyText: old.keyText, spots: old.spots });
        if (world.things.has(th.id)) continue;
        world.add(th, `${where}.keep`);
        carried.set(old, th);
      }
      for (const [old, th] of carried) if (old.parent && carried.has(old.parent)) th.parent = carried.get(old.parent);
      // Groups whose members all came too.
      for (const g of prev.world.order) if (g.kind === 'group' && g.members.length && g.members.every((m) => carried.has(m)) && !world.things.has(g.id)) {
        const ng = new Thing(g.id, 'group', [], [0, 0]);
        ng.members = g.members.map((m) => carried.get(m)!);
        world.add(ng, `${where}.keep`);
      }
      world.last = [...carried.values()].filter((t) => !t.screen).pop();
    }
    // The chapter's name on screen as the scene opens.
    if (s.chapter_card === true) {
      if (typeof s.chapter !== 'string') throw new ScriptError('needs the scene to start a "chapter".', `${where}.chapter_card`);
      chapterCount++;
      buildBeat({ do: 'title', kicker: `${chapterWord(lang)} ${chapterCount}`, text: s.chapter, duration: 2.6, sound: 'swell' }, `${where}.chapter_card`, start, 2.6, undefined);
    } else if (typeof s.chapter === 'string') chapterCount++;

    // Things there from the start.
    if (s.place !== undefined) {
      if (!Array.isArray(s.place)) throw new ScriptError('must be a list.', `${where}.place`);
      s.place.forEach((p, k) => {
        const w = `${where}.place[${k}]`;
        if (!isObject(p)) throw new ScriptError('must be an object, written like a beat without a time.', w);
        buildBeat({ ...p, appear: 'none' }, w, start, 0, undefined);
      });
    }

    if (s.beats !== undefined && !Array.isArray(s.beats)) throw new ScriptError('must be a list of beats.', `${where}.beats`);
    ((s.beats as unknown[]) ?? []).forEach((raw, k) => {
      const w = `${where}.beats[${k}]`;
      if (!isObject(raw)) throw new ScriptError('must be an object.', w);
      const b = raw as Spec;
      if (b.do === undefined && b.camera === undefined) throw new ScriptError('needs "do" (an action) or "camera" (a shot), or both.', w);
      const time = timeOf(b, w, prevEnd);
      if (time.start < start - 1e-6) {
        warnings.push(`${w}: starts at ${time.start.toFixed(2)} s, before its scene begins (${start.toFixed(2)} s).`);
      }
      const done = buildBeat(b, w, time.start, time.duration, time.lineEnd);
      // Something that stays to the end of the scene ends, for timing, where it arrived.
      const endT = Math.max(Number.isFinite(done.end) ? done.end : time.start + 1, time.start + (time.duration ?? 0));
      if (b.camera !== undefined) {
        if (isObject(b.camera)) warnKeys(b.camera, SHOT_KEYS, `${w}.camera`);
        if (kind === 'space') readCamera3d(b.camera, world, time.start, endT - time.start || 1.2, `${w}.camera`);
        else readCamera(b.camera, world, camera, time.start, endT - time.start || 1.2, `${w}.camera`);
      }
      if (typeof b.id === 'string') { ends.set(b.id, endT); begins.set(b.id, time.start); }
      prevEnd = endT;
      lastEnd = Math.max(lastEnd, endT);
    });

    world.actions.sort((a, b) => a.start - b.start || a.order - b.order);
    scenes.push(new CompiledScene(
      typeof s.name === 'string' ? s.name : `Scene ${i + 1}`, world, camera, start, end, transition, tdur, background,
      typeof s.chapter === 'string' ? s.chapter : undefined,
    ));
    scenes[scenes.length - 1].zoomInto = zoomInto;
  });

  const duration = typeof script.duration === 'number'
    ? script.duration
    : Math.max(narration.end + 1, lastEnd + 1, scenes[scenes.length - 1].start + 2, opts.audioLengths?.[audio ?? ''] ?? 0);
  const last = scenes[scenes.length - 1];
  last.end = duration;
  last.world.end = duration;
  const title = typeof script.title === 'string' ? script.title : isObject(script.title) ? String(script.title[lang] ?? 'Untitled') : 'Untitled';

  // ---- Music ----
  const music: MusicTrack[] = [];
  if (script.music !== undefined) {
    const list = Array.isArray(script.music) ? script.music : [script.music];
    list.forEach((raw, i) => {
      const w = Array.isArray(script.music) ? `music[${i}]` : 'music';
      const m = typeof raw === 'string' ? { file: raw } : raw;
      if (!isObject(m) || typeof m.file !== 'string') throw new ScriptError('must be a sound file, or { "file": "music.mp3", ... }.', w);
      warnKeys(m, ['file', 'volume', 'start', 'start_line', 'start_cue', 'end', 'end_line', 'end_cue', 'loop', 'fade_in', 'fade_out', 'duck'], w);
      const when = (key: 'start' | 'end'): number | undefined => {
        if (typeof m[key] === 'number') return m[key] as number;
        if (m[`${key}_line`] !== undefined) { const l = lineByRef(m[`${key}_line`], `${w}.${key}_line`); return key === 'start' ? l.start : l.end; }
        if (m[`${key}_cue`] !== undefined) return cueTime(m[`${key}_cue`], `${w}.${key}_cue`);
        return undefined;
      };
      const num = (k: string, lo: number, hi: number, d: number) => {
        const v = m[k];
        if (v === undefined) return d;
        if (typeof v !== 'number' || v < lo || v > hi) throw new ScriptError(`must be a number from ${lo} to ${hi}.`, `${w}.${k}`);
        return v;
      };
      music.push({
        file: m.file, start: when('start') ?? 0, end: when('end'), volume: num('volume', 0, 2, 0.3), loop: m.loop === true,
        fadeIn: num('fade_in', 0, 60, 0), fadeOut: num('fade_out', 0, 60, 0), duck: num('duck', 0, 1, 0.5),
      });
    });
  }

  // ---- One-off sounds ----
  const sounds: SoundEvent[] = scenes.flatMap((sc) => sc.world.sounds);
  if (soundLevel !== 'none') {
    for (const sc of scenes) {
      if (sc.transition.startsWith('slide') || ['wipe', 'fly', 'zoom', 'page', 'morph'].includes(sc.transition)) sounds.push({ at: sc.start - sc.transitionDuration, kind: sc.transition === 'morph' ? 'swell' : 'whoosh', volume: soundVolume });
      if (sc.transition === 'rub') sounds.push({ at: sc.start - sc.transitionDuration, kind: 'chalk', duration: sc.transitionDuration, volume: soundVolume });
    }
  }

  // Morphing scenes: what morphs, and how it looks once the new scene has settled.
  scenes.forEach((b, i) => {
    if (b.transition !== 'morph' || i === 0) return;
    const a = scenes[i - 1];
    const settle = 1.5;
    const ok = (th: Thing | undefined) => !!th && th.kind !== 'group' && !th.id.startsWith('_') && !th.text && !th.image && !th.parent;
    b.applyState(b.start + settle);
    const snap = new Map<string, { state: Thing['state']; view: View }>();
    const view = b.camera.viewAt(b.start + settle);
    for (const th of b.world.order) {
      if (!ok(th) || !ok(a.world.things.get(th.id)) || !th.shown()) continue;
      if (b.world.space?.objects.some((o) => o.thing === th) || a.world.space?.objects.some((o) => o.thing.id === th.id)) continue;
      snap.set(th.id, { state: { ...th.state, glyphs: th.state.glyphs, glyphStates: undefined }, view });
    }
    b.morph = { ids: new Set(snap.keys()), settle, snap };
    // Until it settles, the new scene shows them as the morph left them.
    b.world.livers.push((t) => {
      if (t < b.start || t >= b.start + settle) return;
      for (const [id, sn] of snap) Object.assign(b.world.things.get(id)!.state, { ...sn.state, glyphs: sn.state.glyphs });
    });
    if (!snap.size) warnings.push(`${b.name}: the morph has nothing to morph; give things in both scenes the same id.`);
  });

  const waits = scenes.flatMap((sc) => sc.world.waits).sort((a, b) => a.at - b.at);
  if (checks.teaching !== false) warnings.push(...teachingChecks(scenes.map((sc) => sc.world), narration, duration));
  return new Movie(title, lang, languages, theme, width, height, sheet.w, sheet.h, Number(fps), duration, narration, cap, scenes, warnings, audio, music, sounds.sort((a, b) => a.at - b.at), waits);
}

function readBackground(s: Spec, theme: Theme, where: string): Background {
  const bg = s.background;
  const out: Background = { style: 'plain', spacing: 1 };
  if (s.paper !== undefined) {
    const p = choice(s.paper, ['plain', 'grid', 'dots', 'lined'] as const, `${where}.paper`);
    out.style = p;
  }
  if (bg === undefined) return out;
  if (typeof bg === 'string') {
    out.style = choice(bg, ['plain', 'gradient', 'grid', 'dots'] as const, `${where}.background`);
    return out;
  }
  if (!isObject(bg)) throw new ScriptError('must be a style name or an object.', `${where}.background`);
  if (bg.image !== undefined) {
    if (typeof bg.image !== 'string') throw new ScriptError('must be a picture file name.', `${where}.background.image`);
    if (/\.(mp4|webm)$/i.test(bg.image)) throw new ScriptError('film clips as backgrounds are not built yet; use a picture.', `${where}.background.image`);
    const k = (key: string, d: number) => { const v = bg[key]; if (v === undefined) return d; if (typeof v !== 'number' || v < 0 || v > 1) throw new ScriptError('must be a number from 0 to 1.', `${where}.background.${key}`); return v; };
    out.image = { file: bg.image, dim: k('dim', 0.5), blur: k('blur', 0) };
  }
  out.style = choice(bg.style ?? (bg.image !== undefined ? 'image' : undefined), ['plain', 'gradient', 'grid', 'dots', 'image'] as const, `${where}.background.style`, 'plain') as Background['style'];
  if (Array.isArray(bg.colors)) out.colors = bg.colors.map((c, i) => colorOf(c, theme, `${where}.background.colors[${i}]`));
  if (typeof bg.spacing === 'number') out.spacing = bg.spacing;
  return out;
}

/** "Chapter" in the language being made (the word above the chapter's name). */
function chapterWord(lang: string): string {
  const words: Record<string, string> = { en: 'Chapter', hi: 'अध्याय', mr: 'प्रकरण', bn: 'অধ্যায়', te: 'అధ్యాయం', ta: 'அத்தியாயம்', gu: 'પ્રકરણ', kn: 'ಅಧ್ಯಾಯ', ml: 'അധ്യായം', pa: 'ਅਧਿਆਇ', ur: 'باب', es: 'Capítulo', fr: 'Chapitre', de: 'Kapitel', pt: 'Capítulo', ru: 'Глава', id: 'Bab', ar: 'الفصل', zh: '章节', ja: '章', ko: '장' };
  return words[lang] ?? 'Chapter';
}

/** For the checker and tests: every action name. */
export const actionNames = () => [...ACTIONS.keys()];
