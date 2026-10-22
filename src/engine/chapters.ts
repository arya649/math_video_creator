// The YouTube chapter list, from scenes that start a chapter.

import type { Movie } from './movie';

const stamp = (t: number) => {
  const s = Math.floor(t);
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

export interface ChapterList { text: string; warnings: string[] }

export function chapterList(movie: Movie): ChapterList {
  const chapters = movie.scenes.filter((s) => s.chapter).map((s) => ({ start: s.start, name: s.chapter! }));
  const warnings: string[] = [];
  if (!chapters.length) return { text: '', warnings };
  if (chapters[0].start > 0) {
    warnings.push('YouTube needs the first chapter to start at 0:00; give the first scene a "chapter".');
  }
  if (chapters.length < 3) warnings.push(`YouTube needs at least three chapters; this video has ${chapters.length}.`);
  chapters.forEach((c, i) => {
    const end = i + 1 < chapters.length ? chapters[i + 1].start : movie.duration;
    if (end - c.start < 10) warnings.push(`The chapter "${c.name}" is ${(end - c.start).toFixed(1)} s long; YouTube needs at least 10 s.`);
  });
  return { text: chapters.map((c) => `${stamp(c.start)} ${c.name}`).join('\n') + '\n', warnings };
}
