// What the voice says for a line: cue marks taken out, maths read in words,
// and the `say` list applied. Each word of the script keeps the place of
// its spoken words, so times from the voice can be given back to the
// script's words (and its captions and cues).

import { readCues, splitWords } from './narration';

interface MathWords {
  plus: string; minus: string; times: string; over: string; equals: string; squared: string; cubed: string;
  power: (n: string) => string; root: string; pi: string; less: string; greater: string; le: string; ge: string; ne: string;
  open: string; close: string; theta: string; infinity: string;
}

const WORDS: Record<string, MathWords> = {
  en: {
    plus: 'plus', minus: 'minus', times: 'times', over: 'over', equals: 'equals', squared: 'squared', cubed: 'cubed',
    power: (n) => `to the power ${n}`, root: 'the square root of', pi: 'pi', less: 'is less than', greater: 'is greater than',
    le: 'is at most', ge: 'is at least', ne: 'is not equal to', open: '', close: '', theta: 'theta', infinity: 'infinity',
  },
  hi: {
    plus: 'जमा', minus: 'घटा', times: 'गुणा', over: 'बटा', equals: 'बराबर', squared: 'का वर्ग', cubed: 'का घन',
    power: (n) => `की घात ${n}`, root: 'का वर्गमूल', pi: 'पाई', less: 'से कम', greater: 'से अधिक',
    le: 'से कम या बराबर', ge: 'से अधिक या बराबर', ne: 'बराबर नहीं', open: '', close: '', theta: 'थीटा', infinity: 'अनंत',
  },
};

/** Read a piece of LaTeX aloud, roughly as a teacher would. */
export function speakMaths(tex: string, lang: string): string {
  const w = WORDS[lang] ?? WORDS.en;
  let s = ` ${tex} `;
  s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, ` $1 ${w.over} $2 `);
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, lang === 'hi' ? ' $1 ' + w.root + ' ' : ` ${w.root} $1 `);
  s = s.replace(/\^\{?2\}?/g, ` ${w.squared} `).replace(/\^\{?3\}?/g, ` ${w.cubed} `);
  s = s.replace(/\^\{([^{}]*)\}|\^(\w)/g, (_m, a: string, b: string) => ` ${w.power(a ?? b)} `);
  s = s
    .replace(/\\le(q)?\b|≤/g, ` ${w.le} `).replace(/\\ge(q)?\b|≥/g, ` ${w.ge} `).replace(/\\ne(q)?\b|≠/g, ` ${w.ne} `)
    .replace(/</g, ` ${w.less} `).replace(/>/g, ` ${w.greater} `)
    .replace(/=/g, ` ${w.equals} `).replace(/\+/g, ` ${w.plus} `).replace(/-|−/g, ` ${w.minus} `)
    .replace(/\\times|\\cdot|×|\*/g, ` ${w.times} `).replace(/\\div|÷|\//g, ` ${w.over} `)
    .replace(/\\pi\b|π/g, ` ${w.pi} `).replace(/\\theta\b|θ/g, ` ${w.theta} `).replace(/\\infty\b|∞/g, ` ${w.infinity} `)
    .replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}()\\[\]$]/g, ' ');
  // Letters standing next to each other are said one by one: "2ab" is "2 a b".
  s = s.replace(/(\d)([a-zA-Z])/g, '$1 $2').replace(/\b([a-zA-Z])(?=[a-zA-Z]\b)/g, '$1 ');
  return s.replace(/\s+/g, ' ').trim();
}

export interface SpokenLine {
  /** The words to send to the voice. */
  spoken: string;
  /** The script's words (as captions show them). */
  words: string[];
  /** For each word of the script line (as splitWords gives them): where its spoken words start and end in `spoken`. */
  ranges: [number, number][];
}

/** Apply the `say` list to a word: whole words only, any case. */
function sayWord(word: string, say: Record<string, string>): string {
  const bare = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  const hit = say[bare] ?? say[bare.toLowerCase()];
  return hit === undefined ? word : word.replace(bare, hit);
}

export function spokenLine(text: string, lang: string, say: Record<string, string> = {}): SpokenLine {
  const { text: clean } = readCues(text);
  const words = splitWords(clean);
  let spoken = '';
  const ranges: [number, number][] = [];
  for (const w of words) {
    let part: string;
    if (w.startsWith('$') && w.endsWith('$') && w.length > 1) {
      const tex = w.slice(1, -1);
      part = say[`$${tex}$`] ?? speakMaths(tex, lang);
    } else part = sayWord(w, say);
    if (spoken) spoken += ' ';
    const start = spoken.length;
    spoken += part;
    ranges.push([start, spoken.length]);
  }
  return { spoken, ranges, words };
}
