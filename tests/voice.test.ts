import { describe, expect, it } from 'vitest';
import { alignRecording, makeVoice, type VoiceServices } from '../src/engine/voice';
import { PlainSound } from '../src/engine/wav';
import { compileMovie } from '../src/engine/movie';

const script = {
  languages: ['en', 'hi'],
  voice: { provider: 'elevenlabs', en: { voice: 'Narrator' }, hi: { voice: 'abcdefghijABCDEFGHIJ' }, say: { sin: 'sine' } },
  lines: [
    { en: 'Write {w}it down.', hi: 'इसे {w}लिखिए।' },
    { en: 'Then $x^2$ {sq}grows.', hi: 'फिर $x^2$ {sq}बढ़ता है।' },
  ],
  scenes: [{ beats: [{ at_cue: 'w', do: 'write', tex: 'x' }, { at_cue: 'sq', do: 'write', tex: 'x^2' }] }],
};

/** A pretend ElevenLabs: every line lasts one second, characters evenly spread. */
function fake(calls: string[]): VoiceServices {
  const cache = new Map<string, { audio: ArrayBuffer; starts: number[]; ends: number[] }>();
  return {
    async fetch(url, init) {
      calls.push(String(url));
      if (String(url).endsWith('/voices')) return new Response(JSON.stringify({ voices: [{ voice_id: 'VOICEID0000000000000', name: 'Narrator' }] }));
      if (String(url).includes('/forced-alignment')) {
        const text = (init!.body as FormData).get('text') as string;
        return new Response(JSON.stringify({ characters: Array.from(text).map((c, i) => ({ text: c, start: i * 0.05, end: i * 0.05 + 0.05 })) }));
      }
      const { text } = JSON.parse(String(init!.body));
      const n = text.length;
      return new Response(JSON.stringify({
        audio_base64: btoa('fake'),
        alignment: { characters: Array.from(text), character_start_times_seconds: Array.from({ length: n }, (_, i) => i / n), character_end_times_seconds: Array.from({ length: n }, (_, i) => (i + 1) / n) },
      }));
    },
    async decode() { return new PlainSound(44100, 1, 44100); },
    async cacheGet(k) { return cache.get(k); },
    async cacheSet(k, v) { cache.set(k, v); },
  };
}

describe('the voice', () => {
  it('makes the narration with exact times, and reuses lines already made', async () => {
    const calls: string[] = [];
    const s = fake(calls);
    const made = await makeVoice(script, 'en', 'key', s);
    expect(made.times.lines.length).toBe(2);
    expect(made.times.lines[0].start).toBeCloseTo(0.6);
    expect(made.times.lines[1].start).toBeCloseTo(0.6 + 1 + 0.35);
    expect(made.times.lines[1].words.map((w) => w.text)).toEqual(['Then', '$x^2$', 'grows.']);
    const m = compileMovie(script, { lang: 'en', voices: { en: made.times } });
    expect(m.narration.source).toBe('voice');
    expect(m.audio).toBe('voice_en.wav');
    expect(m.narration.cues.get('sq')).toBeCloseTo(made.times.lines[1].words[2].start);
    const before = calls.length;
    await makeVoice(script, 'en', 'key', s);
    expect(calls.length - before).toBe(1); // only the voice list; the lines came from the cache
    expect(calls.filter((c) => c.includes('abcdefghijABCDEFGHIJ')).length).toBe(0);
  });

  it('lines up the creator\'s own recording', async () => {
    const own = { ...script, voice: undefined, audio: { en: 'mine.mp3', hi: 'mine_hi.mp3' } };
    const times = await alignRecording(own, 'en', 'key', new ArrayBuffer(8), 'mine.mp3', fake([]));
    expect(times.kind).toBe('aligned');
    const m = compileMovie(own, { lang: 'en', voices: { en: times } });
    expect(m.narration.source).toBe('aligned');
    expect(m.audio).toBe('mine.mp3');
  });

  it('fits the estimate to a recording when there is no key', () => {
    const own = { ...script, voice: undefined, audio: { en: 'mine.mp3', hi: 'mine_hi.mp3' } };
    const m = compileMovie(own, { lang: 'en', audioLengths: { 'mine.mp3': 12 } });
    expect(m.narration.source).toBe('scaled');
    expect(m.narration.lines[1].end).toBeCloseTo(11.7, 1);
  });
});
