// A number that changes on a schedule: where a point is along its graph,
// how many rectangles fill an area. Worked out from the time alone.

import { type Ease, clamp, ease } from '../util';

interface Change { start: number; duration: number; to: number; ease: Ease; geometric?: boolean }

export class Param {
  private changes: Change[] = [];
  /** The value as of the point the compiler has reached. */
  last: number;

  constructor(public start: number) {
    this.last = start;
  }

  to(value: number, start: number, duration: number, e: Ease = 'smooth', geometric = false) {
    this.changes.push({ start, duration, to: value, ease: e, geometric });
    this.changes.sort((a, b) => a.start - b.start);
    this.last = value;
  }

  at(t: number): number {
    let v = this.start;
    for (const c of this.changes) {
      if (t < c.start) break;
      const u = c.duration <= 0 ? 1 : ease(c.ease, clamp((t - c.start) / c.duration));
      v = c.geometric && v > 0 && c.to > 0 ? v * (c.to / v) ** u : v + (c.to - v) * u;
    }
    return v;
  }

  /** When it first starts to change, if it does. */
  firstChange(): number | undefined {
    return this.changes[0]?.start;
  }
}
