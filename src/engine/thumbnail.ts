// The thumbnail: a moment of the video (or a picture of your own) with big
// words over it, saved as a 1280×720 picture (720×1280 for upright videos).

import type { Movie } from './movie';
import { Renderer, pictures } from './render';
import { fontString } from './text';

export async function makeThumbnail(movie: Movie): Promise<Blob> {
  const spec = movie.thumbnail ?? { t: Math.min(2, movie.duration), position: 'left' as const, size: 0.14 };
  const upright = movie.height > movie.width;
  const W = upright ? 720 : 1280, H = upright ? 1280 : 720;
  const out = new OffscreenCanvas(W, H);
  const g = out.getContext('2d')!;
  const pic = spec.file ? pictures.get(spec.file) : undefined;
  if (pic) {
    const k = Math.max(W / pic.width, H / pic.height);
    g.drawImage(pic, (W - pic.width * k) / 2, (H - pic.height * k) / 2, pic.width * k, pic.height * k);
  } else {
    const frame = new OffscreenCanvas(movie.width, movie.height);
    const r = new Renderer(frame, movie);
    r.captions = false;
    r.render(spec.t);
    g.imageSmoothingQuality = 'high';
    g.drawImage(frame, 0, 0, W, H);
  }
  if (spec.text) {
    // A soft shade behind the words, so they read over anything.
    const side = spec.position;
    const grad = side === 'center' ? g.createLinearGradient(0, H, 0, H * 0.3) : g.createLinearGradient(side === 'left' ? 0 : W, 0, side === 'left' ? W * 0.75 : W * 0.25, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.75)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    const px = Math.round(H * spec.size);
    g.font = fontString(800, false, movie.theme.fonts.title, px);
    const maxW = side === 'center' ? W * 0.86 : W * 0.5;
    const words = spec.text.split(/\s+/);
    const rows: string[] = [];
    let row = '';
    for (const w of words) {
      const next = row ? `${row} ${w}` : w;
      if (g.measureText(next).width > maxW && row) { rows.push(row); row = w; } else row = next;
    }
    if (row) rows.push(row);
    const lh = px * 1.08;
    const x = side === 'left' ? W * 0.06 : side === 'right' ? W * 0.94 : W / 2;
    g.textAlign = side === 'left' ? 'left' : side === 'right' ? 'right' : 'center';
    g.textBaseline = 'middle';
    let y = side === 'center' ? H * 0.78 - ((rows.length - 1) * lh) / 2 : H / 2 - ((rows.length - 1) * lh) / 2;
    if (spec.kicker) {
      g.font = fontString(700, false, movie.theme.fonts.title, Math.round(px * 0.38));
      g.fillStyle = movie.theme.accent;
      g.fillText(spec.kicker.toUpperCase(), x, y - lh * 0.85);
      g.font = fontString(800, false, movie.theme.fonts.title, px);
    }
    for (const r of rows) {
      g.lineJoin = 'round';
      g.lineWidth = px * 0.12;
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.strokeText(r, x, y);
      g.fillStyle = '#ffffff';
      g.fillText(r, x, y);
      y += lh;
    }
  }
  return out.convertToBlob({ type: 'image/png' });
}
