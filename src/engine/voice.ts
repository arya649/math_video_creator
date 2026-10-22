// The narration's voice, two ways:
//   - made by the engine with ElevenLabs, line by line, with the exact time
//     of every character (so of every word and cue);
//   - the creator's own recording, lined up with the script's words by
//     ElevenLabs (forced alignment), for exact times without a subtitle file.
//
// Every line made is kept in the browser (IndexedDB), so making the voice
// again only pays for lines whose words or voice changed.

import { type VoiceTimes, type WordTime, readLines } from './narration';
import { type SpokenLine, spokenLine } from './speech';
import { ScriptError, hashString, isObject } from './util';
import { PlainSound, type Sound, encodeWav } from './wav';

const API = 'https://api.elevenlabs.io/v1';
export const DEFAULT_MODEL = 'eleven_multilingual_v2';

export interface VoiceSettings {
  provider: 'elevenlabs';
  key?: string;
  model: string;
  voice: string;
  speed: number;
  style?: number;
  stability?: number;
  say: Record<string, string>;
}

/** Read the script's `voice` for one language. */
export function readVoice(script: Record<string, unknown>, lang: string): VoiceSettings | null {
  const v = script.voice;
  if (v === undefined) return null;
  if (!isObject(v)) throw new ScriptError('must be an object: { "provider": "elevenlabs", "en": { "voice": "..." } }.', 'voice');
  const provider = v.provider ?? 'elevenlabs';
  if (provider !== 'elevenlabs') throw new ScriptError(`the "${String(provider)}" voice service is not built yet; use "elevenlabs", or your own recording under "audio".`, 'voice.provider');
  const per = v[lang];
  if (per === undefined) return null;
  if (!isObject(per) || typeof per.voice !== 'string') throw new ScriptError(`must say which voice: { "voice": "a voice name or id" }.`, `voice.${lang}`);
  const sayAll = isObject(v.say) ? v.say : {};
  const sayHere = isObject(per.say) ? per.say : {};
  const num = (x: unknown, lo: number, hi: number, where: string): number | undefined => {
    if (x === undefined) return undefined;
    if (typeof x !== 'number' || x < lo || x > hi) throw new ScriptError(`must be a number from ${lo} to ${hi}.`, where);
    return x;
  };
  return {
    provider: 'elevenlabs',
    key: typeof v.api_key === 'string' && v.api_key.trim() ? v.api_key.trim() : undefined,
    model: typeof v.model === 'string' ? v.model : DEFAULT_MODEL,
    voice: per.voice,
    speed: num(per.speed, 0.7, 1.2, `voice.${lang}.speed`) ?? 1,
    style: num(per.style, 0, 1, `voice.${lang}.style`),
    stability: num(per.stability, 0, 1, `voice.${lang}.stability`),
    say: Object.fromEntries(Object.entries({ ...sayAll, ...sayHere }).filter(([, x]) => typeof x === 'string')) as Record<string, string>,
  };
}

/** What the engine needs from the outside world (the browser gives these; tests give their own). */
export interface VoiceServices {
  fetch: typeof fetch;
  decode(data: ArrayBuffer): Promise<Sound>;
  cacheGet?(key: string): Promise<{ audio: ArrayBuffer; starts: number[]; ends: number[] } | undefined>;
  cacheSet?(key: string, value: { audio: ArrayBuffer; starts: number[]; ends: number[] }): Promise<void>;
}

async function check(res: Response, what: string): Promise<void> {
  if (res.ok) return;
  let detail = '';
  try { const j = await res.json(); detail = j?.detail?.message ?? j?.detail?.status ?? JSON.stringify(j?.detail ?? j); } catch { /* not JSON */ }
  if (res.status === 401) throw new ScriptError(`ElevenLabs did not accept the key while ${what}. Check the key (voice.api_key, a key file, or the key box on the page).${detail ? ` (${detail})` : ''}`);
  if (res.status === 429 || /quota|credits/i.test(detail)) throw new ScriptError(`ElevenLabs says the account has no characters left, or too many requests, while ${what}.${detail ? ` (${detail})` : ''}`);
  throw new ScriptError(`ElevenLabs answered ${res.status} while ${what}.${detail ? ` (${detail})` : ''}`);
}

/** A voice name to its id. Ids are used as they are. */
export async function voiceId(name: string, key: string, s: VoiceServices): Promise<string> {
  if (/^[A-Za-z0-9]{20}$/.test(name)) return name;
  const res = await s.fetch(`${API}/voices`, { headers: { 'xi-api-key': key } });
  await check(res, 'looking up voices');
  const list = ((await res.json()).voices ?? []) as { voice_id: string; name: string }[];
  const hit = list.find((v) => v.name.toLowerCase() === name.toLowerCase()) ?? list.find((v) => v.name.toLowerCase().startsWith(name.toLowerCase()));
  if (!hit) throw new ScriptError(`there is no voice called "${name}" in this ElevenLabs account. Voices: ${list.map((v) => v.name).join(', ')}.`, 'voice');
  return hit.voice_id;
}

/** Times of a line's script words from the times of its spoken characters. */
export function wordTimes(line: SpokenLine, starts: number[], ends: number[], offset: number, clip: number): WordTime[] {
  const exact = starts.length === line.spoken.length && ends.length === line.spoken.length;
  return line.ranges.map(([a, b], k) => {
    let s: number, e: number;
    if (exact) {
      let i = a; while (i < b - 1 && /\s/.test(line.spoken[i])) i++;
      let j = b - 1; while (j > a && /\s/.test(line.spoken[j])) j--;
      s = starts[i]; e = ends[j];
    } else {
      // The service changed the text a little: share the time out by length.
      const len = Math.max(1, line.spoken.length);
      s = (clip * a) / len;
      e = (clip * b) / len;
    }
    return { text: line.words[k], start: offset + s, end: offset + Math.max(e, s + 0.05) };
  });
}

function linesOf(script: Record<string, unknown>, lang: string, settings: VoiceSettings) {
  const languages = Array.isArray(script.languages) ? script.languages.map(String) : ['en'];
  return readLines(script.lines, lang, languages, 'lines').map((l) => ({ line: l, spoken: spokenLine(l.text, lang, settings.say) }));
}

export interface MadeVoice { times: VoiceTimes; wav: Blob; sound: Sound }

/** Make the narration for one language with ElevenLabs. */
export async function makeVoice(script: Record<string, unknown>, lang: string, key: string, s: VoiceServices, progress?: (done: number, total: number) => void): Promise<MadeVoice> {
  const settings = readVoice(script, lang);
  if (!settings) throw new ScriptError(`there is no voice for "${lang}" under "voice". Add { "${lang}": { "voice": "a voice name" } }, or give your own recording under "audio".`, 'voice');
  const lines = linesOf(script, lang, settings);
  if (!lines.length) throw new ScriptError('has no lines to say.', 'lines');
  const id = await voiceId(settings.voice, key, s);
  const clips: { sound: Sound; starts: number[]; ends: number[] }[] = [];
  for (const [k, { spoken, line }] of lines.entries()) {
    progress?.(k, lines.length);
    const voiceSettings: Record<string, number> = { speed: settings.speed * line.speed };
    if (settings.style !== undefined) voiceSettings.style = settings.style;
    if (settings.stability !== undefined) voiceSettings.stability = settings.stability;
    const cacheKey = `v1|${id}|${settings.model}|${JSON.stringify(voiceSettings)}|${lang}|${spoken.spoken}`;
    const hashed = `${hashString(cacheKey)}-${cacheKey.length}`;
    let hit = await s.cacheGet?.(hashed);
    if (!hit) {
      const res = await s.fetch(`${API}/text-to-speech/${id}/with-timestamps?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spoken.spoken, model_id: settings.model, voice_settings: voiceSettings }),
      });
      await check(res, `making line ${k + 1}`);
      const j = await res.json();
      const bin = atob(j.audio_base64);
      const audio = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) audio[i] = bin.charCodeAt(i);
      const al = j.alignment ?? j.normalized_alignment ?? {};
      hit = { audio: audio.buffer, starts: al.character_start_times_seconds ?? [], ends: al.character_end_times_seconds ?? [] };
      await s.cacheSet?.(hashed, hit);
    }
    const sound = await s.decode(hit.audio.slice(0));
    clips.push({ sound, starts: hit.starts, ends: hit.ends });
  }
  progress?.(lines.length, lines.length);

  // Put the lines together, with the pauses the script asks for.
  const rate = clips[0].sound.sampleRate;
  const lead = 0.6;
  let t = lead;
  const placed = lines.map(({ line }, k) => {
    t += line.before;
    const start = t;
    const dur = clips[k].sound.length / rate;
    t += dur + line.pause;
    return { start, dur };
  });
  const total = Math.ceil((t + 0.5) * rate);
  const out = new PlainSound(rate, 2, total);
  clips.forEach((c, k) => {
    const at = Math.round(placed[k].start * rate);
    for (let ch = 0; ch < 2; ch++) {
      const src = c.sound.getChannelData(Math.min(ch, c.sound.numberOfChannels - 1));
      out.channels[ch].set(src.subarray(0, Math.min(src.length, total - at)), at);
    }
  });
  const times: VoiceTimes = {
    kind: 'made',
    audio: `voice_${lang}.wav`,
    lines: lines.map(({ spoken }, k) => ({
      start: placed[k].start,
      end: placed[k].start + placed[k].dur,
      words: wordTimes(spoken, clips[k].starts, clips[k].ends, placed[k].start, placed[k].dur),
    })),
  };
  return { times, wav: encodeWav(out), sound: out };
}

/** Line up the creator's own recording with the script's words. */
export async function alignRecording(script: Record<string, unknown>, lang: string, key: string, recording: ArrayBuffer, fileName: string, s: VoiceServices): Promise<VoiceTimes> {
  const settings = readVoice(script, lang) ?? { provider: 'elevenlabs', model: DEFAULT_MODEL, voice: '', speed: 1, say: isObject(script.voice) && isObject(script.voice.say) ? script.voice.say as Record<string, string> : {} } as VoiceSettings;
  const lines = linesOf(script, lang, settings);
  // One text for the whole recording; remember where each line starts in it.
  let text = '';
  const at: number[] = [];
  for (const { spoken } of lines) {
    if (text) text += '\n';
    at.push(text.length);
    text += spoken.spoken;
  }
  const form = new FormData();
  form.append('file', new Blob([recording]), fileName);
  form.append('text', text);
  const res = await s.fetch(`${API}/forced-alignment`, { method: 'POST', headers: { 'xi-api-key': key }, body: form });
  await check(res, 'lining up the recording with the words');
  const j = await res.json();
  const chars = (j.characters ?? []) as { text: string; start: number; end: number }[];
  const starts = chars.map((c) => c.start), ends = chars.map((c) => c.end);
  const exact = chars.length === text.length;
  if (!exact && !chars.length) throw new ScriptError('ElevenLabs could not line up the recording with the words. Check the lines match what is said.', `audio.${lang}`);
  const duration = chars.length ? chars[chars.length - 1].end : 0;
  return {
    kind: 'aligned',
    audio: fileName,
    lines: lines.map(({ spoken }, k) => {
      const a = at[k], b = a + spoken.spoken.length;
      const sub = (arr: number[]) => (exact ? arr.slice(a, b) : []);
      // Without an exact match, share the recording out by the text's length.
      const words = exact
        ? wordTimes(spoken, sub(starts), sub(ends), 0, 0)
        : wordTimes(spoken, [], [], (duration * a) / text.length, (duration * spoken.spoken.length) / text.length);
      return { start: words[0]?.start ?? 0, end: words[words.length - 1]?.end ?? 0, words };
    }),
  };
}

// ---- Keeping made lines in the browser ----

const DB = 'math-video-engine-voice';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('lines');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** The browser's services: fetch, decoding, and a cache of made lines. */
export function browserServices(): VoiceServices {
  const ctx = new OfflineAudioContext(2, 1, 44100);
  return {
    fetch: (...a) => fetch(...a),
    decode: (data) => ctx.decodeAudioData(data),
    async cacheGet(key) {
      try {
        const d = await db();
        return await new Promise((resolve) => {
          const r = d.transaction('lines').objectStore('lines').get(key);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => resolve(undefined);
        });
      } catch { return undefined; }
    },
    async cacheSet(key, value) {
      try {
        const d = await db();
        await new Promise<void>((resolve) => {
          const tx = d.transaction('lines', 'readwrite');
          tx.objectStore('lines').put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch { /* the cache is only a saving */ }
    },
  };
}
