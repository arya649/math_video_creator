// Making the MP4: every frame drawn in turn, with the mixed sound.

import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, canEncodeAudio, canEncodeVideo } from 'mediabunny';
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
}

export async function exportMp4(movie: Movie, opts: ExportOptions): Promise<Blob> {
  const canvas = new OffscreenCanvas(movie.width, movie.height);
  const renderer = new Renderer(canvas, movie);
  renderer.captions = opts.captions;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  // H.264 plays everywhere; browsers without it make VP9 inside the MP4 instead.
  const vcodec = (await canEncodeVideo('avc', { width: movie.width, height: movie.height })) ? 'avc' : 'vp9';
  // Maths is sharp lines on flat colour: it needs a generous bitrate to stay crisp.
  const bitrate = Math.round(movie.width * movie.height * movie.fps * 0.12);
  const video = new CanvasSource(canvas, { codec: vcodec, quality: new Quality({ bitrate }), latencyMode: 'quality' });
  output.addVideoTrack(video, { frameRate: movie.fps });
  const sound = await mixAudio(movie, opts.files);
  let audio: AudioBufferSource | null = null;
  if (sound) {
    const acodec = (await canEncodeAudio('aac')) ? 'aac' : 'opus';
    audio = new AudioBufferSource({ codec: acodec, bitrate: 192000 });
    output.addAudioTrack(audio);
  }
  await output.start();
  if (audio && sound) await audio.add(sound);
  const end = Math.min(movie.duration, opts.until ?? Infinity);
  const frames = Math.ceil(end * movie.fps);
  for (let f = 0; f < frames; f++) {
    const t = f / movie.fps;
    renderer.render(t);
    await video.add(t, 1 / movie.fps);
    if (f % 15 === 0) opts.onProgress?.(f / frames);
  }
  await output.finalize();
  opts.onProgress?.(1);
  return new Blob([(output.target as BufferTarget).buffer!], { type: 'video/mp4' });
}
