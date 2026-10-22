import { describe, expect, it } from 'vitest';
import { speakMaths, spokenLine } from '../src/engine/speech';
import { scaledNarration } from '../src/engine/narration';

describe('the voice', () => {
  it('reads maths aloud', () => {
    expect(speakMaths('x^2 + 2ab = c^2', 'en')).toBe('x squared plus 2 a b equals c squared');
    expect(speakMaths('\\frac{1}{2}', 'en')).toBe('1 over 2');
    expect(speakMaths('x^2', 'hi')).toBe('x का वर्ग');
  });
  it('keeps each script word\'s place in what is said', () => {
    const s = spokenLine('Square {sq}it: $x^2$ grows.', 'en', { grows: 'gets bigger' });
    expect(s.spoken).toBe('Square it: x squared gets bigger.');
    expect(s.ranges.length).toBe(4);
    expect(s.spoken.slice(...s.ranges[2])).toBe('x squared');
    expect(s.spoken.slice(...s.ranges[3])).toBe('gets bigger.');
  });
  it('stretches the estimate to a recording', () => {
    const n = scaledNarration([{ text: 'one two three', pause: 0.35, before: 0, speed: 1 }, { text: 'four {c}five', pause: 0.35, before: 0, speed: 1 }], 20);
    expect(n.lines[1].end).toBeCloseTo(19.7, 1);
    expect(n.cues.get('c')).toBeGreaterThan(n.lines[1].start);
  });
});
