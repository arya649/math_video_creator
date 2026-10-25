// Making the MP4: every frame drawn in turn, with the mixed sound.
//
// Scenes are encoded separately, each starting on a key frame, and kept: a
// scene that has not changed since the last export (same script, timing,
// language and files) is joined in as it was, so a long video is only made
// again where it changed.

import { AudioBufferSource, BufferTarget, EncodedPacket, EncodedVideoPacketSource, Mp4OutputFormat, Output, canEncodeAudio } from 'mediabunny';
import type { Movie } from './movie';
import { Renderer } from './render';
import { mixAudio } from './mix';

export interface ExportOptions {
  /** Sound files opened with the script, by name. */
  files: Map<string, ArrayBuffer>;
  captions: boolean;
  onProgress?: (done: number) => void;
  /** Stop early (for a quick test). */
  until?: number;
  /** One fingerprint per scene: everything its frames depend on. A scene with the same fingerprint as before is reused. */
  fingerprints?: string[];
  /** How many scenes were made and how many reused. */
  onScenes?: (made: number, reused: number) => void;
}

interface Segment { packets: EncodedPacket[]; config: VideoDecoderConfig; key: string; length: number }

/** Scenes made before, by fingerprint (for this page's session). */
const made = new Map<string, Segment>();

const configKey = (c: VideoDecoderConfig) => {
  const d = c.description;
  const bytes = d ? new Uint8Array(d instanceof ArrayBuffer ? d : (d as ArrayBufferView).buffer.slice((d as ArrayBufferView).byteOffset, (d as ArrayBufferView).byteOffset + (d as ArrayBufferView).byteLength)) : new Uint8Array();
  return `${c.codec}|${c.codedWidth}x${c.codedHeight}|${Array.from(bytes).join(',')}`;
};

async function chooseCodec(w: number, h: number, fps: number, bitrate: number): Promise<{ config: VideoEncoderConfig; name: 'avc' | 'vp9' }> {
  // H.264 plays everywhere; browsers without it make VP9 inside the MP4 instead.
  const tries: [string, 'avc' | 'vp9'][] = [['avc1.640034', 'avc'], ['avc1.4d0034', 'avc'], ['vp09.00.41.08', 'vp9']];
  for (const [codec, name] of tries) {
    const config: VideoEncoderConfig = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'quality', ...(name === 'avc' ? { avc: { format: 'avc' } } : {}) };
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) return { config, name }; } catch { /* next */ }
  }
  throw new Error('this browser cannot encode H.264 or VP9 video.');
}

export async function exportMp4(movie: Movie, opts: ExportOptions): Promise<Blob> {
  try {
    return await exportOnce(movie, opts, true);
  } catch (err) {
    // Scenes kept from before did not fit with the new ones: make everything afresh.
    if ((err as Error).message !== 'mismatch') throw err;
    made.clear();
    return exportOnce(movie, opts, false);
  }
}

async function exportOnce(movie: Movie, opts: ExportOptions, reuse: boolean): Promise<Blob> {
  const W = movie.width, H = movie.height, fps = movie.fps;
  const work = new OffscreenCanvas(W, H);
  const renderer = new Renderer(work, movie);
  renderer.captions = opts.captions;
  // Motion blur: several moments within each frame's shutter, averaged.
  const blur = movie.motionBlur;
  const subframes = blur > 0 ? 2 + Math.round(blur * 6) : 1;
  const frameCanvas = subframes > 1 ? new OffscreenCanvas(W, H) : work;
  const fctx = subframes > 1 ? frameCanvas.getContext('2d')! : null;
  const draw = (t: number) => {
    if (!fctx) { renderer.render(t); return; }
    for (let i = 0; i < subframes; i++) {
      renderer.render(Math.max(0, t + ((i / (subframes - 1)) - 0.5) * (blur / fps)));
      fctx.globalAlpha = 1 / (i + 1);
      fctx.drawImage(work, 0, 0);
    }
    fctx.globalAlpha = 1;
  };

  const end = Math.min(movie.duration, opts.until ?? Infinity);
  const total = Math.ceil(end * fps);
  // Each scene's stretch of the video: from where its transition begins.
  const starts = movie.scenes.map((sc, k) => (k === 0 ? 0 : Math.max(0, movie.toVideo(sc.start) - (sc.transition !== 'cut' ? sc.transitionDuration : 0))));
  const frameOf = (t: number) => Math.round(t * fps);
  const windows = starts.map((s, k) => [frameOf(s), k + 1 < starts.length ? frameOf(starts[k + 1]) : total] as [number, number]).map(([a, b]) => [Math.min(a, total), Math.min(b, total)] as [number, number]);

  const bitrate = Math.round(W * H * fps * 0.12);
  const { config, name } = await chooseCodec(W, H, fps, bitrate);
  let current: EncodedPacket[] = [];
  let lastConfig: VideoDecoderConfig | undefined;
  let failure: Error | undefined;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => { if (meta?.decoderConfig) lastConfig = meta.decoderConfig; current.push(EncodedPacket.fromEncodedChunk(chunk)); },
    error: (e) => { failure = e; },
  });
  encoder.configure(config);

  const segments: Segment[] = [];
  let done = 0, makeCount = 0, reuseCount = 0;
  for (let k = 0; k < windows.length; k++) {
    const [a, b] = windows[k];
    if (b <= a) continue;
    const fp = opts.fingerprints?.[k] ? `${opts.fingerprints[k]}|${b - a}|${W}x${H}@${fps}|${opts.captions}|${blur}|${config.codec}` : undefined;
    const kept = fp && reuse ? made.get(fp) : undefined;
    if (kept) {
      segments.push(kept);
      reuseCount++;
      done += b - a;
      opts.onProgress?.(done / total);
      continue;
    }
    current = [];
    for (let f = a; f < b; f++) {
      draw(f / fps);
      const frame = new VideoFrame(frameCanvas, { timestamp: Math.round(((f - a) / fps) * 1e6), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: f === a || (f - a) % (fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 1));
      if (failure) throw failure;
      done++;
      if (done % 15 === 0) opts.onProgress?.(done / total);
    }
    await encoder.flush();
    if (failure) throw failure;
    if (!lastConfig) throw new Error('the video encoder gave no settings.');
    const seg: Segment = { packets: current, config: lastConfig, key: configKey(lastConfig), length: b - a };
    segments.push(seg);
    makeCount++;
    if (fp) made.set(fp, seg);
  }
  encoder.close();
  // Joined scenes must share their encoder settings; otherwise make all afresh.
  if (segments.some((s) => s.key !== segments[0].key)) throw new Error('mismatch');

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const video = new EncodedVideoPacketSource(name);
  output.addVideoTrack(video, { frameRate: fps });
  const sound = await mixAudio(movie, opts.files);
  let audio: AudioBufferSource | null = null;
  if (sound) {
    const acodec = (await canEncodeAudio('aac')) ? 'aac' : 'opus';
    audio = new AudioBufferSource({ codec: acodec, bitrate: 192000 });
    output.addAudioTrack(audio);
  }
  await output.start();
  if (audio && sound) await audio.add(sound);
  let offset = 0, first = true;
  for (const seg of segments) {
    for (const p of seg.packets) {
      await video.add(p.clone({ timestamp: p.timestamp + offset }), first ? { decoderConfig: seg.config } : undefined);
      first = false;
    }
    offset += seg.length / fps;
  }
  await output.finalize();
  opts.onProgress?.(1);
  opts.onScenes?.(makeCount, reuseCount);
  return new Blob([(output.target as BufferTarget).buffer!], { type: 'video/mp4' });
}

/** Clear the scenes kept from earlier exports. */
export const forgetScenes = () => made.clear();
