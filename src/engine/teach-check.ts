// Teaching checks: advice about pace and clarity, given as warnings. They
// never stop a video; "checks": { "teaching": false } turns them off.

import type { Narration } from './narration';
import type { SceneWorld } from './world';

const QUIET = 12;
const BUSY = 5;

export function teachingChecks(worlds: SceneWorld[], narration: Narration, duration: number): string[] {
  const out: string[] = [];
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const beats = worlds.flatMap((w) => w.beats).sort((a, b) => a.at - b.at);
  const visible = beats.filter((b) => !['sound', 'wait', 'step_counter'].includes(b.name));

  // A slow start.
  if (visible.length && visible[0].at > 8) out.push(`teaching: nothing appears for the first ${Math.round(visible[0].at)} seconds; viewers decide quickly whether to stay. Show something early.`);

  // Long stretches with nothing new on screen.
  for (const w of worlds) {
    const times = [w.start, ...w.actions.flatMap((a) => [a.start, Number.isFinite(a.duration) ? a.start + a.duration : a.start]), ...w.waits.map((x) => x.at)].filter(Number.isFinite).sort((a, b) => a - b);
    const end = Math.min(w.end, duration);
    let last = w.start;
    for (const t of [...times, end]) {
      if (t > end) break;
      if (t - last > QUIET) { out.push(`teaching: nothing moves from ${fmt(last)} to ${fmt(t)}; a still screen for ${Math.round(t - last)} seconds loses viewers. Add a highlight, a step or a camera move.`); break; }
      last = Math.max(last, t);
    }
  }

  // Too much arriving at once (what a scene opens with is its setup, not counted).
  const starts = new Set(worlds.map((w) => w.start));
  const arriving = visible.filter((b) => !starts.has(b.at));
  for (let i = 0; i < arriving.length; i++) {
    let j = i;
    while (j + 1 < arriving.length && arriving[j + 1].at - arriving[i].at < 1.5) j++;
    if (j - i + 1 >= BUSY) {
      out.push(`teaching: ${j - i + 1} things start within 1.5 seconds at ${fmt(arriving[i].at)} (${arriving[i].where} on); the eye can follow one or two at a time. Spread them out with "then".`);
      i = j;
    }
  }

  // Speech too fast to follow (only known for real recordings and made voices).
  if (narration.source !== 'estimate' && narration.source !== 'none') {
    for (const l of narration.lines) {
      const words = l.text.split(/\s+/).filter(Boolean).length;
      const rate = words / Math.max(0.1, l.end - l.start);
      if (words >= 6 && rate > 3.6) out.push(`teaching: line ${l.n} is spoken at ${rate.toFixed(1)} words a second; above about 3 it is hard to follow maths. Slow the voice or split the line.`);
    }
  }

  // Working without reasons.
  for (const b of beats) {
    if (b.name !== 'work' || !Array.isArray(b.spec.lines) || b.spec.lines.length < 3) continue;
    const reasons = b.spec.lines.filter((l) => typeof l === 'object' && l !== null && 'note' in l).length;
    if (!reasons) out.push(`teaching: ${b.where}: ${b.spec.lines.length} lines of working with no reasons; a short "note" on the harder lines says why each step is allowed.`);
  }

  // Long videos: something to do, something to keep.
  if (duration > 300) {
    const names = new Set(beats.map((b) => b.name));
    if (!names.has('question') && !names.has('wait')) out.push('teaching: over five minutes with no question; asking the viewer to try something keeps them thinking.');
    if (!names.has('recap')) out.push('teaching: over five minutes with no recap; end with a "recap" of what was found.');
  }

  // Words off the frame.
  for (const w of worlds) {
    const W = w.frameW / 2, H = w.frameH / 2;
    for (const th of w.order) {
      if (!th.screen || !th.text || th.parent) continue;
      const b = th.buildBox();
      if (b.x0 < -W - 0.05 || b.x1 > W + 0.05 || b.y0 < -H - 0.05 || b.y1 > H + 0.05) out.push(`teaching: the words "${th.text.lines.map((l) => l.runs.map((r) => r.text ?? '').join('')).join(' ').slice(0, 40)}" go off the edge of the frame; make them smaller or shorter.`);
    }
  }
  return out;
}
