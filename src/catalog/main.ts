// The catalogue page: every entry drawn by the engine itself.

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/600.css';
import { type Movie, compileMovie } from '../engine/movie';
import { Renderer } from '../engine/render';
import { GROUPS, entries, type Entry } from './entries';

const list = document.getElementById('list')!;
const nav = document.getElementById('nav')!;

interface Card { entry: Entry; el: HTMLElement; canvas: HTMLCanvasElement; movie?: Movie; renderer?: Renderer; drawn: boolean; error?: string }
const cards: Card[] = [];

function build() {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const g = e.id.split(':')[0];
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(e);
  }
  for (const [g, items] of groups) {
    const sec = document.createElement('section');
    sec.id = `group-${g}`;
    sec.innerHTML = `<h2>${GROUPS[g] ?? g} <span style="color:#777;font-weight:400">${g}:</span></h2>`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const entry of items) {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.search = `${entry.id} ${entry.title}`.toLowerCase();
      const canvas = document.createElement('canvas');
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<div class="id">${entry.id}</div><div class="title">${entry.title}</div>`;
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(entry.words, null, 1).replace(/\n\s*/g, ' ').replace(/\{ /g, '{ ').slice(0, 900);
      meta.append(pre);
      el.append(canvas, meta);
      grid.append(el);
      const card: Card = { entry, el, canvas, drawn: false };
      cards.push(card);
      canvas.onclick = () => play(card);
    }
    sec.append(grid);
    list.append(sec);
    const a = document.createElement('a');
    a.href = `#group-${g}`;
    a.textContent = GROUPS[g] ?? g;
    nav.append(a);
  }
}

function prepare(card: Card): boolean {
  if (card.movie || card.error) return !card.error;
  try {
    card.movie = compileMovie(card.entry.script, { scale: 0.25 });
    card.renderer = new Renderer(card.canvas, card.movie);
    if (card.movie.warnings.length) console.warn(card.entry.id, card.movie.warnings);
  } catch (err) {
    card.error = (err as Error).message;
    const e = document.createElement('div');
    e.className = 'err';
    e.textContent = card.error;
    card.el.querySelector('.meta')!.append(e);
    console.error(card.entry.id, err);
    return false;
  }
  return true;
}

function still(card: Card) {
  if (card.drawn || !prepare(card)) return;
  card.renderer!.render(Math.min(card.entry.still, card.movie!.duration));
  card.drawn = true;
}

let playing: Card | null = null;
function play(card: Card) {
  if (!prepare(card)) return;
  playing = card;
  const start = performance.now();
  const step = (now: number) => {
    if (playing !== card) return;
    const t = (now - start) / 1000;
    card.renderer!.render(Math.min(t, card.movie!.duration));
    if (t < card.movie!.duration) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function main() {
  await Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 40px Poppins`)));
  await document.fonts.load('400 40px "Noto Sans Devanagari"', 'अ');
  build();
  const seen = new IntersectionObserver((items) => {
    for (const it of items) if (it.isIntersecting) still(cards.find((c) => c.canvas === it.target)!);
  }, { rootMargin: '300px' });
  for (const c of cards) seen.observe(c.canvas);
  (document.getElementById('search') as HTMLInputElement).oninput = (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase().trim();
    for (const c of cards) c.el.style.display = !q || c.el.dataset.search!.includes(q) ? '' : 'none';
  };
}

declare global { interface Window { catalogue: unknown } }
window.catalogue = {
  /** Draw every entry; returns the ones that failed. */
  all() {
    const failed: { id: string; error: string }[] = [];
    for (const c of cards) { still(c); if (c.error) failed.push({ id: c.entry.id, error: c.error }); }
    return failed;
  },
};

void main();
