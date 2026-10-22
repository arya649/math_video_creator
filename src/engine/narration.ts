// Narration: when each line, word and cue mark is spoken, in one language.
//
// The times come, best first, from:
//   - a made voice, which records the exact time of every word;
//   - your own recording's subtitle file (word times estimated in each line);
//   - an estimate from the words alone, so a script can be previewed before
//     any voice exists.

import { ScriptError, isObject } from './util';

export interface WordTime { text: string; start: number; end: number }
export interface LineTime {
  /** 1-based line number. */
  n: number;
  id?: string;
  /** The words as shown in captions: cue marks taken out. */
  text: string;
  start: number;
  end: number;
  words: WordTime[];
}
export interface Narration {
  lines: LineTime[];
  cues: Map<string, number>;
  end: number;
  /** Where the times came from. */
  source: 'voice' | 'subtitles' | 'estimate' | 'none';
}

/** Times recorded with a made voice (voice_<language>.json). */
export interface VoiceTimes {
  lines: { start: number; end: number; words: WordTime[] }[];
}

export interface ScriptLine {
  text: string;
  id?: string;
  pause: number;
  before: number;
  speed: number;
}

const CUE = /\{([a-zA-Z_][\w-]*)\}/g;

/** Words of a line, and after how many words each cue falls. */
export function readCues(text: string): { text: string; cues: { name: string; word: number }[] } {
  const cues: { name: string; word: number }[] = [];
  let clean = '';
  let last = 0;
  let hit: RegExpExecArray | null;
  CUE.lastIndex = 0;
  while ((hit = CUE.exec(text))) {
    clean += text.slice(last, hit.index);
    cues.push({ name: hit[1], word: splitWords(clean).length });
    last = hit.index + hit[0].length;
  }
  clean += text.slice(last);
  return { text: clean.replace(/\s+/g, ' ').trim(), cues };
}

const NO_SPACES = /[぀-ヿ㐀-鿿가-힯฀-๿]/;

/** Words, for timing. Maths between dollar signs counts as one word. */
export function splitWords(text: string): string[] {
  const out: string[] = [];
  for (const piece of text.split(/(\$[^$]*\$)/)) {
    if (piece.startsWith('$') && piece.endsWith('$') && piece.length > 1) { out.push(piece); continue; }
    for (const w of piece.split(/\s+/)) {
      if (!w) continue;
      if (NO_SPACES.test(w)) out.push(...Array.from(w));
      else out.push(w);
    }
  }
  return out;
}

/** How long a word takes to say, roughly, at normal speed. */
function wordLength(w: string): number {
  if (w.startsWith('$')) return 0.25 + 0.09 * w.replace(/[\\{}$ ]/g, '').length;
  if (NO_SPACES.test(w)) return 0.22;
  const letters = w.replace(/[^\p{L}\p{N}]/gu, '').length;
  return 0.1 + 0.058 * Math.max(2, letters) + (/[,;:]$/.test(w) ? 0.18 : /[.!?।]$/.test(w) ? 0.3 : 0);
}

/** Spread words over a line's time in proportion to their length. */
export function spreadWords(words: string[], start: number, end: number): WordTime[] {
  const lens = words.map(wordLength);
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let t = start;
  return words.map((text, i) => {
    const d = ((end - start) * lens[i]) / total;
    const w = { text, start: t, end: t + d };
    t += d;
    return w;
  });
}

export function estimateNarration(lines: ScriptLine[], lead = 0.6): Narration {
  const out: LineTime[] = [];
  const cues = new Map<string, number>();
  let t = lead;
  lines.forEach((line, i) => {
    t += line.before;
    const { text, cues: marks } = readCues(line.text);
    const words = splitWords(text);
    const dur = words.reduce((a, w) => a + wordLength(w), 0) / line.speed;
    const wt = spreadWords(words, t, t + dur);
    for (const c of marks) cues.set(c.name, c.word < wt.length ? wt[c.word].start : t + dur);
    out.push({ n: i + 1, id: line.id, text, start: t, end: t + dur, words: wt });
    t += dur + line.pause;
  });
  return { lines: out, cues, end: t, source: lines.length ? 'estimate' : 'none' };
}

export function narrationFromVoice(lines: ScriptLine[], times: VoiceTimes, where: string): Narration {
  if (times.lines.length !== lines.length) {
    throw new ScriptError(`the voice has ${times.lines.length} lines but the script has ${lines.length}. Make the voice again.`, where);
  }
  const cues = new Map<string, number>();
  const out = lines.map((line, i) => {
    const { text, cues: marks } = readCues(line.text);
    const v = times.lines[i];
    for (const c of marks) cues.set(c.name, c.word < v.words.length ? v.words[c.word].start : v.end);
    return { n: i + 1, id: line.id, text, start: v.start, end: v.end, words: v.words };
  });
  return { lines: out, cues, end: out.length ? out[out.length - 1].end : 0, source: 'voice' };
}

// ---- Subtitle files ----

export interface SrtEntry { start: number; end: number; text: string }

export function parseSrt(text: string): SrtEntry[] {
  const out: SrtEntry[] = [];
  const time = (s: string) => {
    const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!m) return NaN;
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0').slice(0, 3)) / 1000;
  };
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const rows = block.trim().split('\n');
    const at = rows.findIndex((r) => r.includes('-->'));
    if (at < 0) continue;
    const [a, b] = rows[at].split('-->');
    const entry = { start: time(a), end: time(b), text: rows.slice(at + 1).join(' ').trim() };
    if (Number.isFinite(entry.start) && Number.isFinite(entry.end)) out.push(entry);
  }
  return out;
}

export function narrationFromSrt(entries: SrtEntry[]): Narration {
  const cues = new Map<string, number>();
  const lines = entries.map((e, i) => {
    const { text, cues: marks } = readCues(e.text);
    const words = spreadWords(splitWords(text), e.start, e.end);
    for (const c of marks) cues.set(c.name, c.word < words.length ? words[c.word].start : e.end);
    return { n: i + 1, text, start: e.start, end: e.end, words };
  });
  return { lines, cues, end: lines.length ? lines[lines.length - 1].end : 0, source: 'subtitles' };
}

/** Write the narration as a subtitle file (for YouTube). */
export function toSrt(n: Narration): string {
  const stamp = (t: number) => {
    const ms = Math.round(t * 1000);
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  return n.lines.map((l, i) => `${i + 1}\n${stamp(l.start)} --> ${stamp(l.end)}\n${captionText(l.text)}\n`).join('\n');
}

const SUPERS: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', n: 'ⁿ', '-': '⁻', '+': '⁺' };
const SYMBOLS: Record<string, string> = {
  pi: 'π', theta: 'θ', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', lambda: 'λ', mu: 'μ', sigma: 'σ', phi: 'φ', omega: 'ω',
  times: '×', cdot: '·', div: '÷', pm: '±', leq: '≤', geq: '≥', neq: '≠', approx: '≈', infty: '∞', sqrt: '√', to: '→', Delta: 'Δ', Sigma: 'Σ',
};

/** Maths in a caption written so it reads as maths: $x^2$ becomes x². */
export function captionText(text: string): string {
  return text.replace(/\$([^$]*)\$/g, (_, m: string) =>
    m
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
      .replace(/\^\{([^}]*)\}|\^(.)/g, (_s, a: string, b: string) => Array.from(a ?? b).map((c) => SUPERS[c] ?? c).join(''))
      .replace(/\\([a-zA-Z]+)/g, (s, w: string) => SYMBOLS[w] ?? w)
      .replace(/[{}]/g, '')
      .replace(/\s*\*\s*/g, '×'),
  );
}

/** Read the script's `lines` for one language. */
export function readLines(spec: unknown, lang: string, languages: string[], where: string): ScriptLine[] {
  if (spec === undefined) return [];
  if (!Array.isArray(spec)) throw new ScriptError('must be a list of lines.', where);
  return spec.map((l, i) => {
    const w = `${where}[${i}] (line ${i + 1})`;
    if (typeof l === 'string') {
      if (languages.length > 1) throw new ScriptError(`gives words for one language, but the video is in ${languages.join(', ')}. Write it as { "${languages[0]}": "...", ... }.`, w);
      return { text: l, pause: 0.35, before: 0, speed: 1 };
    }
    if (!isObject(l)) throw new ScriptError('must be an object with the words in each language.', w);
    const text = l[lang];
    if (typeof text !== 'string') throw new ScriptError(`has no words in "${lang}". Every line needs every language of the video.`, w);
    const num = (k: string, d: number) => (typeof l[k] === 'number' ? (l[k] as number) : d);
    return {
      text, id: typeof l.id === 'string' ? l.id : undefined,
      pause: num('pause', 0.35), before: num('before', 0), speed: num('speed', 1),
    };
  });
}
