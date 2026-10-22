// Compiling a script into a Movie: scenes, timing, transitions, languages.

import './actions/index';
import { makeWorldAxes } from './actions/graph';
import { ACTIONS, BEAT_KEYS, type Ctx, type Done, type Spec, findAction } from './actions';
import { CameraPlan, SHOT_KEYS, readCamera } from './camera';
import {
  type Narration, type VoiceTimes, estimateNarration, narrationFromSrt, narrationFromVoice, parseSrt, readLines,
} from './narration';
import { type Theme, readTheme, colorOf } from './themes';
import { ScriptError, choice, clamp, didYouMean, isObject } from './util';
import { type Action, SceneWorld, WORLDS, type WorldKind } from './world';

export const TOP_KEYS = [
  'title', 'languages', 'voice', 'audio', 'subtitles', 'theme', 'style', 'symbols', 'format', 'fps', 'captions', 'music',
  'sounds', 'strings', 'fonts', 'models', 'characters', 'chapters', 'thumbnail', 'end_screen', 'checks', 'motion_blur',
  'duration', 'lines', 'scenes', 'grade', 'glow', 'depth', 'camera_style',
] as const;

export const SCENE_KEYS = [
  'name', 'chapter', 'chapter_card', 'world', 'start_line', 'start_cue', 'start', 'transition', 'transition_duration', 'keep',
  'style', 'theme', 'symbols', 'captions', 'grade', 'glow', 'depth', 'camera_style', 'background', 'place', 'beats',
  'paper', 'axes', 'grid', 'numbers', 'units', 'decimals', 'number_line', 'table', 'light', 'floor', 'camera',
] as const;

export const TRANSITIONS = ['cut', 'fade', 'black', 'slide', 'slide_left', 'slide_up', 'slide_down', 'wipe'] as const;
export const TRANSITIONS_LATER = ['morph', 'fly', 'zoom', 'rub', 'page'] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const FORMATS: Record<string, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 },
  landscape_4k: { width: 3840, height: 2160 },
  square: { width: 1080, height: 1080 },
  reel: { width: 1080, height: 1920 },
};

/** Worlds that can be used in a script now. */
export const WORLDS_BUILT: readonly WorldKind[] = ['board', 'graph'];

export interface Background {
  style: 'plain' | 'gradient' | 'grid' | 'dots' | 'lined';
  colors?: string[];
  spacing: number;
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
  ) {}

  /** Put the scene in its state at time t. Nothing is kept from the frame before. */
  applyState(t: number) {
    for (const thing of this.world.order) thing.reset();
    this.world.resetFrame();
    this.world.now = t;
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
  ) {}

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
      return transitionLayers(s, next, u);
    }
    return [{ scene: s, alpha: 1 }];
  }
}

function transitionLayers(a: CompiledScene, b: CompiledScene, u: number): Layer[] {
  const e = u * u * (3 - 2 * u);
  switch (b.transition) {
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
  /** Times of made voices, per language. */
  voices?: Record<string, VoiceTimes>;
  /** Text of subtitle files, by file name. */
  texts?: Record<string, string>;
  /** Override the script's captions (the page's switch). */
  captions?: boolean;
  /** Draw smaller than the format's size (previews, the catalogue). Keeps the shape. */
  scale?: number;
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

  const theme = readTheme(script.theme, 'theme');
  const format = choice(script.format, Object.keys(FORMATS) as ('landscape' | 'landscape_4k' | 'square' | 'reel')[], 'format', 'landscape');
  const full = FORMATS[format];
  const width = Math.round(full.width * (opts.scale ?? 1)), height = Math.round(full.height * (opts.scale ?? 1));
  // The frame at rest is 9 sheet units on its short side (16 x 9 for landscape).
  const sheet = width >= height ? { w: (9 * width) / height, h: 9 } : { w: 9, h: (9 * height) / width };
  const fps = choice(String(script.fps ?? 60), ['24', '30', '60'] as const, 'fps') as string;

  // ---- Narration ----
  const lines = readLines(script.lines, lang, languages, 'lines');
  let narration: Narration;
  const subs = isObject(script.subtitles) ? script.subtitles[lang] : undefined;
  if (opts.voices?.[lang]) narration = narrationFromVoice(lines, opts.voices[lang], 'voice');
  else if (typeof subs === 'string') {
    const text = opts.texts?.[subs];
    if (text === undefined) throw new ScriptError(`names the subtitle file "${subs}", which was not opened with the script.`, `subtitles.${lang}`);
    narration = narrationFromSrt(parseSrt(text));
  } else narration = estimateNarration(lines);
  const audioSpec = isObject(script.audio) ? script.audio[lang] : undefined;
  const audio = typeof audioSpec === 'string' ? audioSpec : opts.voices?.[lang] ? `voice_${lang}.mp3` : undefined;

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
  let lastEnd = 0;
  rawScenes.forEach((s, i) => {
    const where = `scenes[${i}]${typeof s.name === 'string' ? ` ("${s.name}")` : ''}`;
    warnKeys(s, SCENE_KEYS, where);
    const kind = choice(s.world, WORLDS, `${where}.world`, 'board');
    if (!WORLDS_BUILT.includes(kind)) {
      throw new ScriptError(`the ${kind} world is not built yet. Worlds that work now: ${WORLDS_BUILT.join(', ')}.`, `${where}.world`);
    }
    const sceneTheme = s.theme !== undefined ? readTheme(s.theme, `${where}.theme`) : theme;
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : Infinity;
    const world = new SceneWorld(kind, sceneTheme, start, end, sheet.w, sheet.h);
    world.setSymbols(s.symbols ?? script.symbols, s.symbols !== undefined ? `${where}.symbols` : 'symbols');
    if (s.captions !== undefined) world.captions = s.captions !== false;
    const camera = new CameraPlan(sheet.w, sheet.h);
    let transition: Transition = 'cut';
    if (i > 0 && s.transition !== undefined) {
      if ((TRANSITIONS_LATER as readonly string[]).includes(String(s.transition))) {
        throw new ScriptError(`the "${String(s.transition)}" transition is not built yet. Use one of ${TRANSITIONS.join(', ')}.`, `${where}.transition`);
      }
      transition = choice(s.transition, TRANSITIONS, `${where}.transition`);
    }
    const tdur = typeof s.transition_duration === 'number' ? s.transition_duration : 1;
    const background = readBackground(s, sceneTheme, where);

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
      buildNested: (spec, ww, st) => buildBeat(spec, ww, st, undefined, undefined),
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
      try {
        return def.build(ctx);
      } catch (err) {
        if (err instanceof ScriptError && !err.where) throw new ScriptError(err.message, w);
        throw err;
      }
    };

    // A graph scene has its axes from the start.
    if (kind === 'graph') makeWorldAxes(makeCtx({}, `${where}.axes`, start, undefined, undefined), s.axes, `${where}.axes`);

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
        readCamera(b.camera, world, camera, time.start, endT - time.start || 1.2, `${w}.camera`);
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
  });

  const duration = typeof script.duration === 'number'
    ? script.duration
    : Math.max(narration.end + 1, lastEnd + 1, scenes[scenes.length - 1].start + 2);
  const last = scenes[scenes.length - 1];
  last.end = duration;
  last.world.end = duration;
  const title = typeof script.title === 'string' ? script.title : isObject(script.title) ? String(script.title[lang] ?? 'Untitled') : 'Untitled';

  return new Movie(title, lang, languages, theme, width, height, sheet.w, sheet.h, Number(fps), duration, narration, cap, scenes, warnings, audio);
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
  if (bg.image !== undefined) throw new ScriptError('pictures as backgrounds are not built yet.', `${where}.background.image`);
  out.style = choice(bg.style, ['plain', 'gradient', 'grid', 'dots'] as const, `${where}.background.style`, 'plain');
  if (Array.isArray(bg.colors)) out.colors = bg.colors.map((c, i) => colorOf(c, theme, `${where}.background.colors[${i}]`));
  if (typeof bg.spacing === 'number') out.spacing = bg.spacing;
  return out;
}

/** For the checker and tests: every action name. */
export const actionNames = () => [...ACTIONS.keys()];
