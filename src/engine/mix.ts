// Mixing the video's sound: the narration, music that drops while the
// narrator speaks, sound files, and the engine's own small sounds. The same
// script always gives the same sound: the engine's sounds are made from
// seeded noise and plain tones, not files.

import type { Movie } from './movie';
import { rng } from './util';

const RATE = 48000;

/** Files already decoded, so mixing again for the preview is quick. */
const decoded = new Map<ArrayBuffer, AudioBuffer>();

async function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  const hit = decoded.get(data);
  if (hit) return hit;
  const buf = await ctx.decodeAudioData(data.slice(0));
  decoded.set(data, buf);
  return buf;
}

/** One of the engine's own sounds, as samples. */
function synth(kind: string, duration: number | undefined, seed: number): Float32Array {
  const r = rng(seed);
  const len = (s: number) => Math.max(1, Math.round(s * RATE));
  switch (kind) {
    case 'pop': {
      const n = len(0.12), out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / RATE, f = 520 - 1800 * t;
        out[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 38) * 0.8;
      }
      return out;
    }
    case 'click': case 'tick': {
      const n = len(kind === 'click' ? 0.035 : 0.025), out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        out[i] = ((r() * 2 - 1) * 0.5 + Math.sin(2 * Math.PI * (kind === 'click' ? 2400 : 3200) * t) * 0.5) * Math.exp(-t * 160);
      }
      return out;
    }
    case 'chime': {
      const n = len(1.1), out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        out[i] = (Math.sin(2 * Math.PI * 880 * t) * 0.5 + Math.sin(2 * Math.PI * 1318.5 * t) * 0.35 + Math.sin(2 * Math.PI * 1760 * t) * 0.15) * Math.exp(-t * 4.5) * Math.min(1, t * 400);
      }
      return out;
    }
    case 'low': {
      const n = len(0.45), out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        out[i] = Math.sin(2 * Math.PI * (170 - 40 * t) * t) * Math.exp(-t * 7) * Math.min(1, t * 300);
      }
      return out;
    }
    case 'whoosh': case 'swell': {
      const d = kind === 'whoosh' ? 0.55 : 1.2;
      const n = len(d), out = new Float32Array(n);
      let a = 0, b = 0;
      for (let i = 0; i < n; i++) {
        const u = i / n;
        // Noise through a filter that sweeps up, rising then falling.
        const cut = kind === 'whoosh' ? 0.02 + 0.25 * Math.sin(Math.PI * u) : 0.01 + 0.15 * u;
        a += cut * ((r() * 2 - 1) - a);
        b += cut * (a - b);
        out[i] = b * Math.sin(Math.PI * (kind === 'whoosh' ? u : Math.min(1, u * 1.2))) * 2.2;
      }
      return out;
    }
    default: {
      // Pen and chalk: soft scratching for as long as the writing lasts.
      const d = Math.max(0.2, Math.min(duration ?? 1, 6));
      const n = len(d), out = new Float32Array(n);
      const chalk = kind === 'chalk';
      let hp = 0, lp = 0, env = 0;
      for (let i = 0; i < n; i++) {
        const t = i / RATE;
        const x = r() * 2 - 1;
        hp = 0.92 * (hp + x - (i ? out[i - 1] : 0));
        lp += (chalk ? 0.35 : 0.55) * (x - lp);
        const stroke = 0.55 + 0.45 * Math.sin(2 * Math.PI * (chalk ? 6 : 9) * t + Math.sin(t * 3.1) * 2);
        env += 0.01 * (stroke - env);
        const edge = Math.min(1, t / 0.05, (d - t) / 0.08);
        out[i] = (chalk ? lp * 0.6 + x * 0.25 : lp * 0.35) * env * edge * (chalk ? 0.9 : 0.6);
      }
      return out;
    }
  }
}

/** The whole video's sound, or null when there is none. */
export async function mixAudio(movie: Movie, files: Map<string, ArrayBuffer>, missing: (name: string) => void = () => {}): Promise<AudioBuffer | null> {
  const any = movie.audio || movie.music.length || movie.sounds.length;
  if (!any) return null;
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(movie.duration * RATE)), RATE);
  const get = async (name: string): Promise<AudioBuffer | null> => {
    const data = files.get(name);
    if (!data) { missing(name); return null; }
    return decode(ctx, data);
  };

  // The narration.
  if (movie.audio) {
    const buf = await get(movie.audio);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
  }

  // Music, dropping while the narrator speaks.
  const speech: [number, number][] = [];
  for (const l of movie.narration.lines) {
    const last = speech[speech.length - 1];
    if (last && l.start - last[1] < 0.8) last[1] = l.end; else speech.push([l.start, l.end]);
  }
  for (const m of movie.music) {
    const buf = await get(m.file);
    if (!buf) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = m.loop;
    const gain = ctx.createGain();
    src.connect(gain).connect(ctx.destination);
    const end = Math.min(movie.duration, m.end ?? (m.loop ? movie.duration : m.start + buf.duration));
    const g = gain.gain;
    const level = (t: number) => {
      let v = m.volume;
      if (m.fadeIn > 0) v *= Math.min(1, (t - m.start) / m.fadeIn);
      if (m.fadeOut > 0) v *= Math.min(1, (end - t) / m.fadeOut);
      return Math.max(0, v);
    };
    g.setValueAtTime(m.fadeIn > 0 ? 0 : m.volume, m.start);
    if (m.fadeIn > 0) g.linearRampToValueAtTime(m.volume, m.start + m.fadeIn);
    for (const [a, b] of speech) {
      if (b < m.start || a > end || m.duck >= 1) continue;
      const down = Math.max(m.start, a - 0.25);
      g.setValueAtTime(level(down), down);
      g.linearRampToValueAtTime(level(a) * m.duck, Math.max(down + 0.01, a));
      g.setValueAtTime(level(b) * m.duck, b);
      g.linearRampToValueAtTime(level(b + 0.5), Math.min(end, b + 0.5));
    }
    if (m.fadeOut > 0) {
      g.setValueAtTime(level(end - m.fadeOut), end - m.fadeOut);
      g.linearRampToValueAtTime(0, end);
    }
    src.start(m.start);
    src.stop(end);
  }

  // One-off sounds.
  let seed = 1;
  for (const s of movie.sounds) {
    if (s.at >= movie.duration) continue;
    let buf: AudioBuffer | null;
    if (s.file) buf = await get(s.file);
    else {
      const data = synth(s.kind ?? 'pop', s.duration, seed++);
      buf = ctx.createBuffer(1, data.length, RATE);
      buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    }
    if (!buf) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    src.connect(gain).connect(ctx.destination);
    const at = Math.max(0, s.at);
    const stop = s.duration && s.file ? at + s.duration : at + buf.duration;
    gain.gain.setValueAtTime(s.fadeIn ? 0 : s.volume, at);
    if (s.fadeIn) gain.gain.linearRampToValueAtTime(s.volume, at + s.fadeIn);
    if (s.fadeOut) { gain.gain.setValueAtTime(s.volume, Math.max(at, stop - s.fadeOut)); gain.gain.linearRampToValueAtTime(0, stop); }
    src.start(at);
    src.stop(stop);
  }
  return ctx.startRendering();
}
