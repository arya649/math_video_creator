// Every entry of the catalogue: a small script that shows one option.
// IDs are the group, a colon, and the option's name in lower case with dashes.

type Beat = Record<string, unknown>;

export interface Entry {
  id: string;
  title: string;
  /** What to write, shown under the picture. */
  words: unknown;
  /** The whole script, built from the parts below if not given. */
  script: Record<string, unknown>;
  /** When to show the still picture (seconds). */
  still: number;
}

interface Simple {
  id: string;
  title: string;
  beats: Beat[];
  scene?: Record<string, unknown>;
  top?: Record<string, unknown>;
  lines?: string[];
  still?: number;
  /** Show the scene keys instead of the beats as the words to write. */
  showScene?: boolean;
  showTop?: boolean;
}

function simple(e: Simple): Entry {
  const script: Record<string, unknown> = {
    title: e.title,
    captions: !!e.lines,
    ...(e.lines ? { lines: e.lines } : {}),
    ...e.top,
    scenes: [{ world: 'board', ...e.scene, beats: e.beats }],
  };
  const words = e.showTop ? e.top : e.showScene ? { ...e.scene } : e.beats.length === 1 ? e.beats[0] : e.beats;
  return { id: e.id, title: e.title, words, script, still: e.still ?? 3.2 };
}

const ENTRIES: Entry[] = [];
const add = (e: Simple) => ENTRIES.push(simple(e));
const eq = (tex: string, extra: Beat = {}): Beat => ({ at: 0, do: 'write', id: 'eq', tex, size: 'large', ...extra });

// ---- Worlds ----
add({ id: 'scene:board', title: 'Board world', scene: { world: 'board' }, showScene: true, beats: [eq('e^{i\\pi} + 1 = 0')] });
for (const paper of ['grid', 'dots', 'lined'] as const) {
  add({ id: `scene:board-${paper}`, title: `Board on ${paper} paper`, scene: { world: 'board', paper }, showScene: true, beats: [eq('a^2 + b^2 = c^2')] });
}
add({ id: 'scene:background-gradient', title: 'Gradient background', scene: { background: { style: 'gradient', colors: ['#1f2a44', '#06070b'] } }, showScene: true, beats: [eq('\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}')] });

// ---- Themes ----
for (const theme of ['night', 'board', 'paper', 'white', 'grid', 'deep', 'sunny']) {
  add({
    id: `look:theme-${theme}`, title: `Theme: ${theme}`, top: { theme, symbols: { x: 'blue', y: 'yellow' } }, showTop: true,
    beats: [eq('y = x^2 - 2x + 1'), { at: 1.2, do: 'box', who: 'eq' }, { at: 1.6, do: 'text', text: 'A short note', position: 'bottom', duration: 3 }],
  });
}

// ---- Meaning colours ----
add({ id: 'look:symbols', title: 'Colours that mean something', top: { symbols: { a: 'blue', b: 'yellow', '\\theta': 'green' } }, showTop: true, beats: [eq('(a+b)^2 = a^2 + 2ab + b^2'), { at: 1, do: 'write', tex: '\\sin\\theta = \\frac{b}{a}' }] });

// ---- Narration and captions ----
add({
  id: 'voice:captions-karaoke', title: 'Captions: karaoke', top: { captions: { style: 'karaoke' } }, showTop: true,
  lines: ['Square the sum, and a middle piece {mid}appears.'], beats: [{ at_line: 1, do: 'write', id: 'eq', tex: '(a+b)^2 = a^2 + 2ab + b^2' }, { at_cue: 'mid', do: 'highlight', who: 'eq', part: '2ab' }], still: 2.2,
});
add({ id: 'voice:captions-plain', title: 'Captions: plain', top: { captions: { style: 'plain' } }, showTop: true, lines: ['A whole line of narration, shown in a dark box.'], beats: [eq('x^2')], still: 1.5 });
add({
  id: 'voice:cues', title: 'Cue marks', lines: ['Write it, then {box}box the answer.'],
  beats: [{ at_line: 1, do: 'write', id: 'eq', tex: 'x = 5', size: 'large' }, { at_cue: 'box', do: 'box', who: 'eq' }], still: 2,
});
add({
  id: 'voice:languages', title: 'Every language from one script', showTop: true,
  top: { languages: ['hi', 'en'], lines: [{ hi: 'उनके योग का {sq}वर्ग देखिए।', en: 'Look at the {sq}square of their sum.' }] },
  beats: [{ at_cue: 'sq', do: 'write', tex: '(a+b)^2', size: 'large' }, { at: 0, do: 'text', text: { hi: 'योग का वर्ग', en: 'The square of a sum' }, position: 'top', stay: true }], still: 2,
});

add({
  id: 'voice:made-voice', title: 'A voice made with ElevenLabs', showTop: true,
  top: { voice: { provider: 'elevenlabs', en: { voice: 'a voice name', speed: 1 }, say: { sin: 'sine' } } },
  lines: ['The voice says this line; the engine knows when every word is said.'], beats: [eq('\\sin^2 x + \\cos^2 x = 1')], still: 2.5,
});
add({
  id: 'voice:own-recording', title: 'Your own recording', showTop: true,
  top: { audio: 'my_recording.mp3' },
  lines: ['Pictures are timed to your recording.'], beats: [eq('a^2 + b^2 = c^2')], still: 2,
});
add({ id: 'sound:engine-sounds', title: 'The engine\'s own sounds', showTop: true, top: { sounds: 'lively' }, beats: [eq('x + 2 = 5'), { at: 1.2, do: 'steps', who: 'eq', to: 'x = 3' }, { at: 2.6, do: 'draw', shape: 'tick', position: 'right' }], still: 3 });
add({ id: 'sound:beat-sound', title: 'A beat\'s own sound', beats: [{ at: 0, do: 'title', text: 'Chapter one', sound: 'swell', duration: 3 }], still: 1.5 });
add({ id: 'sound:music', title: 'Music under the voice', showTop: true, top: { music: { file: 'music.mp3', volume: 0.3, loop: true, fade_in: 2, duck: 0.4 } }, lines: ['The music drops while I speak.'], beats: [eq('\\pi \\approx 3.14159')], still: 2 });

// ---- Equations ----
add({ id: 'eq:write', title: 'write', beats: [eq('\\int_0^1 x^2\\,dx = \\frac{1}{3}')], still: 1.2 });
add({ id: 'eq:write-plain', title: 'write in plain maths', beats: [{ at: 0, do: 'write', math: '2*x^2 + 3*x - 5 = 0', size: 'large' }] });
add({ id: 'eq:write-list', title: 'write several lines', beats: [{ at: 0, do: 'write', tex: ['x + y = 10', 'x - y = 2', '2x = 12'], lag: 0.4 }] });
for (const how of ['write', 'fade', 'grow', 'pop', 'rise', 'type'] as const) {
  add({ id: `eq:appear-${how}`, title: `Arriving: ${how}`, beats: [eq('a^2 + b^2 = c^2', { appear: how, duration: 1.4 })], still: 0.8 });
}
add({ id: 'eq:steps', title: 'steps', beats: [eq('3x + 5 = 20'), { at: 1.2, do: 'steps', who: 'eq', to: '3x = 20 - 5' }], still: 1.75 });
add({ id: 'eq:steps-list', title: 'steps through a list', beats: [eq('3x + 5 = 20'), { at: 1.2, do: 'steps', who: 'eq', to: ['3x = 20 - 5', '3x = 15', 'x = 5'] }], still: 5.4 });
add({ id: 'eq:steps-note', title: 'steps with a reason', beats: [eq('2x = 14'), { at: 1.2, do: 'steps', who: 'eq', to: 'x = 7', note: 'divide by 2' }], still: 3 });
add({ id: 'eq:steps-new-line', title: 'steps on a new line', beats: [eq('(x+3)^2 = 16'), { at: 1.2, do: 'steps', who: 'eq', to: 'x + 3 = \\pm 4', new_line: true, id: 'eq2' }], still: 2.2 });
add({ id: 'eq:steps-parts', title: 'steps matched by named parts', beats: [eq('\\part{s}{a^2} + \\part{t}{b^2}'), { at: 1.2, do: 'steps', who: 'eq', to: '\\part{t}{b^2} + \\part{s}{a^2}', match: 'parts' }], still: 1.8 });
add({ id: 'eq:steps-pairs', title: 'steps with named pairs', beats: [eq('x + 2 = 9'), { at: 1.2, do: 'steps', who: 'eq', to: 'x = 9 - 2', pairs: { '+2': '-2' } }], still: 1.8 });
add({ id: 'eq:rearrange', title: 'rearrange', beats: [eq('c^2 + b^2 + a^2'), { at: 1.2, do: 'rearrange', who: 'eq', to: 'a^2 + b^2 + c^2' }], still: 1.8 });
add({
  id: 'eq:work', title: 'work: a column of working',
  beats: [{ at: 0, do: 'work', id: 'w', lines: [{ tex: '3x + 5 = 20' }, { tex: '3x = 15', note: 'subtract 5', then: true }, { tex: 'x = 5', note: 'divide by 3', then: true }] }], still: 5.5,
});
add({ id: 'eq:work-numbered', title: 'work, numbered, not carried', beats: [{ at: 0, do: 'work', numbered: true, carry: false, lines: ['x^2 - 5x + 6 = 0', { tex: '(x-2)(x-3) = 0', note: 'factorise' }, 'x = 2 \\text{ or } x = 3'] }], still: 4.5 });
for (const how of ['back', 'color', 'glow', 'pulse', 'wiggle', 'underline', 'circle', 'flash'] as const) {
  add({ id: `eq:highlight-${how}`, title: `highlight: ${how}`, beats: [eq('(a+b)^2 = a^2 + 2ab + b^2'), { at: 1.2, do: 'highlight', who: 'eq', part: '2ab', how }], still: how === 'pulse' || how === 'wiggle' || how === 'flash' ? 1.65 : 2.2 });
}
add({ id: 'eq:box', title: 'box', beats: [eq('E = mc^2'), { at: 1, do: 'box', who: 'eq' }], still: 2.2 });
for (const how of ['slash', 'cross', 'line'] as const) {
  add({ id: `eq:cancel-${how}`, title: `cancel: ${how}`, beats: [eq('\\frac{\\part{top}{3}x}{\\part{bot}{3}} = x'), { at: 1, do: 'cancel', who: ['eq.top', 'eq.bot'], how }], still: 2.2 });
}
add({ id: 'eq:cancel-vanish', title: 'cancel, then vanish', beats: [eq('x + 3 - 3 = 7'), { at: 1, do: 'cancel', who: 'eq', part: '+ 3 - 3', vanish: true }], still: 3.4 });
add({ id: 'eq:cancel-to', title: 'cancel with a new value', beats: [eq('\\frac{\\part{a}{6}}{\\part{b}{3}}'), { at: 1, do: 'cancel', who: 'eq.a', to: '2' }, { at: 1.2, do: 'cancel', who: 'eq.b', to: '1' }], still: 2.6 });
add({ id: 'eq:brace', title: 'brace', beats: [eq('(a+b)^2 = a^2 + 2ab + b^2'), { at: 1, do: 'brace', who: 'eq', part: '2ab', text: 'the middle piece' }], still: 2.4 });
add({ id: 'eq:brace-above', title: 'brace above', beats: [eq('x^2 + 6x + 9 = (x+3)^2'), { at: 1, do: 'brace', who: 'eq', part: 'x^2 + 6x + 9', side: 'above', text: 'a perfect square' }], still: 2.4 });
add({ id: 'eq:label-part', title: 'label_part', beats: [eq('A = \\pi r^2'), { at: 1, do: 'label_part', who: 'eq', part: 'r', text: 'radius', side: 'below' }], still: 2.4 });
add({ id: 'eq:substitute', title: 'substitute', top: { symbols: { a: 'blue', b: 'yellow' } }, beats: [eq('a^2 + b^2'), { at: 1, do: 'substitute', who: 'eq', put: { a: '3', b: '4' } }], still: 1.75 });
add({ id: 'eq:substitute-keep', title: 'substitute on a new line', beats: [eq('2ab'), { at: 1, do: 'substitute', who: 'eq', put: { a: '3', b: '4' }, keep: true }], still: 2.8 });
add({ id: 'eq:pull-out', title: 'pull_out', beats: [eq('(a+b)^2 = a^2 + 2ab + b^2'), { at: 1, do: 'pull_out', who: 'eq', part: '2ab', id: 'piece' }], still: 2.5 });
add({ id: 'eq:color', title: 'color a part', beats: [eq('y = mx + c'), { at: 1, do: 'color', who: 'eq', part: 'm', to: 'red' }], still: 2 });
add({ id: 'eq:swap', title: 'swap', beats: [eq('\\part{a}{x^2} + \\part{b}{5x} = 0'), { at: 1, do: 'swap', who: 'eq', parts: ['a', 'b'] }], still: 1.6 });

// ---- Shapes ----
const shape = (s: Beat): Beat => ({ at: 0, do: 'draw', duration: 1.2, ...s });
add({ id: 'shape:line', title: 'line', beats: [shape({ shape: 'line', from: [-3, -1], to: [3, 1] })] });
add({ id: 'shape:arrow', title: 'arrow', beats: [shape({ shape: 'arrow', from: [-3, 0], to: [3, 0], color: 'yellow' })] });
add({ id: 'shape:arrow-curved', title: 'arrow, curved', beats: [shape({ shape: 'arrow', from: [-3, 0], to: [3, 0], curve: 0.3, tip: 'both' })] });
add({ id: 'shape:dashed', title: 'dashed line', beats: [shape({ shape: 'dashed', from: [-3, -1], to: [3, 1] })] });
add({ id: 'shape:dot', title: 'dot', beats: [shape({ shape: 'dot', radius: 0.15, fill: 'yellow' })] });
add({ id: 'shape:circle', title: 'circle', beats: [shape({ shape: 'circle', radius: 2, color: 'blue', fill: 'blue', fill_opacity: 0.3 })] });
add({ id: 'shape:ellipse', title: 'ellipse', beats: [shape({ shape: 'ellipse', width: 5, height: 2.5, color: 'green' })] });
add({ id: 'shape:arc', title: 'arc', beats: [shape({ shape: 'arc', radius: 2, from_angle: 20, to_angle: 250, color: 'gold' })] });
add({ id: 'shape:square', title: 'square', beats: [shape({ shape: 'square', size: 3, fill: 'red', fill_opacity: 0.4, color: 'red' })] });
add({ id: 'shape:rectangle', title: 'rectangle', beats: [shape({ shape: 'rectangle', width: 5, height: 2.4, corner: 0.3 })] });
add({ id: 'shape:polygon', title: 'polygon', beats: [shape({ shape: 'polygon', id: 'tri', points: [[-3, -1.5], [3, -1.5], [1, 2]], names: ['A', 'B', 'C'], color: 'teal' }), { at: 1.4, do: 'draw', shape: 'dot', position: 'tri.C', fill: 'yellow' }] });
add({ id: 'shape:regular', title: 'regular polygon', beats: [shape({ shape: 'regular', sides: 6, radius: 2, color: 'purple', fill: 'purple', fill_opacity: 0.25 })] });
add({ id: 'shape:star', title: 'star', beats: [shape({ shape: 'star', points: 5, radius: 2, color: 'gold', fill: 'gold', fill_opacity: 0.5 })] });
add({ id: 'shape:brace', title: 'brace', beats: [shape({ shape: 'line', from: [-3, 0], to: [3, 0] }), { at: 0.6, do: 'draw', shape: 'brace', from: [-3, -0.2], to: [3, -0.2] }] });
add({ id: 'shape:grid', title: 'grid', beats: [shape({ shape: 'grid', rows: 3, columns: 5, size: 0.8 })] });
add({ id: 'shape:cross', title: 'cross', beats: [shape({ shape: 'cross', size: 1.5 })] });
add({ id: 'shape:tick', title: 'tick', beats: [shape({ shape: 'tick', size: 1.5 })] });
add({ id: 'shape:path', title: 'path through points', beats: [shape({ shape: 'path', points: [[-4, -1], [-2, 1.5], [0, -0.5], [2, 1], [4, -1.5]], color: 'blue' })] });
add({ id: 'shape:list', title: 'several shapes in turn', beats: [{ at: 0, do: 'draw', lag: 0.3, shapes: [{ shape: 'circle', radius: 1, position: 'left' }, { shape: 'square', size: 2 }, { shape: 'regular', sides: 3, radius: 1.2, position: 'right' }] }] });

// ---- Moving ----
const box = shape({ shape: 'square', id: 'sq', size: 1.6, fill: 'blue', fill_opacity: 0.5, color: 'blue', duration: 0.6 });
add({ id: 'move:move', title: 'move', beats: [box, { at: 0.8, do: 'move', who: 'sq', to: 'right' }], still: 1.4 });
add({ id: 'move:move-arc', title: 'move along an arc', beats: [box, { at: 0.8, do: 'move', who: 'sq', to: 'top_right', path: 'arc' }], still: 1.4 });
add({ id: 'move:turn', title: 'turn', beats: [box, { at: 0.8, do: 'turn', who: 'sq', by: 45 }], still: 2 });
add({ id: 'move:scale', title: 'scale', beats: [box, { at: 0.8, do: 'scale', who: 'sq', to: 2 }], still: 2 });
add({ id: 'move:flip', title: 'flip', beats: [shape({ shape: 'polygon', id: 'p', points: [[-1, -1], [1.5, -1], [-1, 1.5]], fill: 'green', color: 'green', duration: 0.6 }), { at: 0.8, do: 'flip', who: 'p' }], still: 1.8 });
add({ id: 'move:wobble', title: 'wobble', beats: [eq('\\infty'), { at: 1, do: 'wobble', who: 'eq' }], still: 1.2 });
add({ id: 'move:morph', title: 'morph a shape', beats: [box, { at: 0.8, do: 'morph', who: 'sq', into: { do: 'draw', shape: 'circle', radius: 1.2, color: 'yellow', fill: 'yellow', fill_opacity: 0.4 } }], still: 1.5 });
add({ id: 'move:morph-maths', title: 'morph one equation into another', beats: [eq('a^2 + b^2'), { at: 0, do: 'write', id: 'c2', tex: 'c^2', size: 'large', position: 'bottom', hidden: true }, { at: 1.2, do: 'morph', who: 'eq', into: 'c2' }], still: 1.9 });
add({ id: 'move:copy', title: 'copy', beats: [eq('x^2'), { at: 1, do: 'copy', who: 'eq', id: 'eq2', to: 'right' }], still: 1.5 });
add({ id: 'move:focus', title: 'focus', beats: [eq('(a+b)^2 = a^2 + 2ab + b^2'), { at: 0.3, do: 'write', tex: '\\text{other working}', position: 'top' }, { at: 1.2, do: 'focus', on: ['eq.2ab'], duration: 3 }], still: 2.2 });
for (const how of ['fade', 'shrink', 'undraw', 'rub', 'fall'] as const) {
  add({ id: `move:remove-${how}`, title: `remove: ${how}`, beats: [eq('x^2 + y^2 = r^2'), { at: 1, do: 'remove', who: 'eq', how, duration: 1.2 }], still: 1.6 });
}
add({ id: 'move:group', title: 'group, then move', beats: [{ at: 0, do: 'write', id: 'a', tex: 'x = 2' }, { at: 0.2, do: 'write', id: 'b', tex: 'y = 3' }, { at: 1.2, do: 'group', id: 'g', who: ['a', 'b'] }, { at: 1.2, do: 'move', who: 'g', to: 'top_left' }], still: 1.8 });

// ---- On-screen graphics ----
add({ id: 'text:title', title: 'title', beats: [{ at: 0, duration: 4, do: 'title', kicker: 'Chapter one', text: 'The square of a sum', sub: 'A picture says it all' }], still: 2 });
for (const style of ['plain', 'box', 'banner', 'quote', 'note'] as const) {
  add({ id: `text:${style}`, title: `text: ${style}`, beats: [eq('a^2 + b^2 = c^2'), { at: 0.4, duration: 4, do: 'text', style, position: style === 'banner' ? 'bottom_left' : 'top', text: style === 'quote' ? 'Mathematics is the language of nature' : 'Words over the picture', by: style === 'quote' ? 'Galileo' : undefined }], still: 2.4 });
}
add({ id: 'text:inline-maths', title: 'maths inside words', beats: [{ at: 0, duration: 4, do: 'text', position: 'center', size: 'large', text: 'so $x^2 \\geq 0$ for every $x$' }], still: 1.5 });
add({ id: 'text:clear', title: 'clear', beats: [{ at: 0, do: 'text', id: 'n', text: 'Going in a moment', position: 'center', stay: true }, { at: 1.5, do: 'clear', who: 'n', duration: 1 }], still: 1.9 });

// ---- Camera ----
const row: Beat[] = [{ at: 0, do: 'write', id: 'eq', tex: '(a+b)^2 = a^2 + 2ab + b^2' }];
add({ id: 'shot:frame', title: 'frame', beats: [...row, { at: 0.8, camera: { shot: 'frame', target: 'eq.2ab' } }], still: 2.4 });
add({ id: 'shot:zoom', title: 'zoom', beats: [...row, { at: 0.8, camera: { shot: 'zoom', to: 2, target: 'eq.lhs' } }], still: 2.4 });
add({ id: 'shot:pan', title: 'pan', beats: [...row, { at: 0.2, do: 'write', id: 'far', tex: '\\text{over here}', position: [12, 0] }, { at: 0.8, camera: { shot: 'pan', target: 'far' } }], still: 2.4 });
add({ id: 'shot:follow', title: 'follow', beats: [box, { at: 0.8, do: 'move', who: 'sq', by: [10, 0], duration: 3 }, { at: 0.8, camera: { shot: 'follow', target: 'sq', blend: 0.6 } }], still: 2.5 });
add({ id: 'shot:rest', title: 'rest', beats: [...row, { at: 0.5, camera: { shot: 'zoom', to: 3, target: 'eq.2ab', blend: 0.6 } }, { at: 1.6, camera: 'rest' }], still: 3 });

// ---- Transitions ----
for (const tr of ['cut', 'fade', 'black', 'slide', 'slide_left', 'slide_up', 'slide_down', 'wipe'] as const) {
  ENTRIES.push({
    id: `transition:${tr.replace(/_/g, '-')}`, title: `transition: ${tr}`, words: { start: 1.5, transition: tr },
    script: {
      captions: false,
      scenes: [
        { world: 'board', beats: [{ at: 0, do: 'write', tex: 'a^2 + b^2', size: 'large', appear: 'none' }] },
        { world: 'board', paper: 'grid', start: 1.5, transition: tr, transition_duration: 1, beats: [{ at: 0, do: 'write', tex: 'c^2', size: 'large', appear: 'none' }] },
      ],
    },
    still: 1,
  });
}

// ---- Graphs ----
const G = (id: string, title: string, beats: Beat[], axes: unknown = { x: [-4, 4], y: [-3, 5] }, still = 3, top?: Record<string, unknown>) =>
  add({ id, title, beats, scene: { world: 'graph', axes }, still, top });
const sq: Beat = { at: 0, do: 'plot', id: 'f', math: 'x^2 - 1', appear: 'none' };
G('graph:axes', 'Graph world, axes as they come', [], undefined);
G('graph:axes-ranges', 'Axes with ranges', [], { x: [-2, 10, 2], y: [-1, 6] });
G('graph:axes-grid', 'Axes with a faint grid', [], { x: [-4, 4], y: [-3, 5], grid: 'faint' });
G('graph:axes-equal', 'Axes with square units', [{ at: 0, do: 'plot', implicit: 'x^2 + y^2 = 4', appear: 'none' }], { x: [-4, 4], y: [-3, 3], equal: true });
G('graph:axes-pi', 'Axes marked in pi', [{ at: 0, do: 'plot', math: 'sin(x)', appear: 'none' }], { x: [-6.3, 6.3], y: [-1.5, 1.5], ticks: 'pi' });
G('graph:axes-polar', 'Polar grid', [{ at: 0, do: 'plot', r_of_theta: '2 + cos(5*theta)', appear: 'none' }], { x: [-4, 4], y: [-3.4, 3.4], equal: true, grid: true, polar: true, numbers: false });
G('graph:axes-log', 'Log scale', [{ at: 0, do: 'plot', math: '2^x', x: [0.01, 10], appear: 'none' }], { x: [0, 10], y: [0.5, 1000], log: 'y' });
G('plane:number-plane', 'Number plane', [], { plane: true });
G('plane:complex-plane', 'Complex plane', [], { plane: true, complex: true, x: [-4, 4], y: [-2.25, 2.25] });
G('graph:axes-action', 'axes: another set of axes', [{ at: 0, do: 'axes', id: 'small', x: [0, 5], y: [0, 5], width: 4, height: 3, position: 'right' }], false, 2);
G('graph:plot', 'plot', [{ at: 0, do: 'plot', id: 'f', math: 'x^3 / 4 - x', duration: 2 }], undefined, 1.2, { symbols: { f: 'blue' } });
G('graph:plot-label', 'plot with a label', [{ at: 0, do: 'plot', id: 'f', math: 'x^2 - 1', label: '$f(x) = x^2 - 1$' }]);
G('graph:plot-breaks', 'plot that jumps', [{ at: 0, do: 'plot', math: 'tan(x)', color: 'green' }], { x: [-4.5, 4.5], y: [-4, 4], ticks: 'pi' });
G('graph:plot-parametric', 'plot: parametric', [{ at: 0, do: 'plot', x_of_t: '3*cos(t)', y_of_t: '2*sin(3*t)', t: [0, 6.2832], color: 'pink' }], { x: [-4, 4], y: [-3, 3] }, 2.5);
G('graph:plot-polar', 'plot: polar', [{ at: 0, do: 'plot', r_of_theta: '2*sin(4*theta)', color: 'gold' }], { x: [-3, 3], y: [-2.5, 2.5], equal: true }, 2.5);
G('graph:plot-implicit', 'plot: implicit', [{ at: 0, do: 'plot', implicit: 'x^2/9 + y^2/4 = 1', color: 'teal' }], { x: [-4, 4], y: [-3, 3], equal: true }, 2.5);
G('graph:plot-inequality', 'plot: an inequality', [{ at: 0, do: 'plot', math: 'y > x^2 - 2', color: 'blue' }]);
G('graph:plot-dash', 'plot, dashed', [{ at: 0, do: 'plot', math: '2 - x/2', dash: true, color: 'red' }]);
G('graph:value-slider', 'value with a slider', [{ at: 0, do: 'value', name: 'a', start: 1, slider: { position: 'top_left', range: [0, 3] } }, { at: 0, do: 'plot', math: 'a * x^2 - 1', appear: 'none' }, { at: 0.5, do: 'set', name: 'a', to: 2.5, duration: 2 }], undefined, 1.6);
G('graph:value-show', 'value shown as a number', [{ at: 0, do: 'value', name: 'k', start: 1, show: 'top_right' }, { at: 0, do: 'plot', math: 'sin(k*x)', appear: 'none' }, { at: 0.3, do: 'set', name: 'k', to: [3, 0.5], duration: 3 }], { x: [-4, 4], y: [-2, 2] }, 1.5);
G('graph:value-in-maths', 'a value inside maths', [{ at: 0, do: 'value', name: 'm', start: 0.5 }, { at: 0, do: 'plot', math: 'm * x', appear: 'none' }, { at: 0, do: 'write', tex: 'y = \\value{m}\\, x', position: 'top_left', appear: 'none' }, { at: 0.3, do: 'set', name: 'm', to: 2, duration: 2.5 }], undefined, 1.5);
G('graph:point', 'point on a graph', [sq, { at: 0, do: 'point', id: 'P', position: { on: 'f', x: 1.5 }, label: 'P' }]);
G('graph:point-drops', 'point with drop lines and coordinates', [sq, { at: 0, do: 'point', id: 'P', position: { on: 'f', x: 1.5 }, drops: true, coords: true }]);
G('graph:point-slide', 'point sliding, leaving a trace', [sq, { at: 0, do: 'point', id: 'P', position: { on: 'f', x: -2 }, trace: true }, { at: 0.5, do: 'slide', who: 'P', to: 2, duration: 3 }], undefined, 2.5);
G('graph:mark-roots', 'mark roots', [sq, { at: 0.2, do: 'mark', on: 'f', find: 'roots', label: 'coords' }]);
G('graph:mark-min', 'mark the lowest point', [{ at: 0, do: 'plot', id: 'f', math: 'x^3/3 - x', appear: 'none' }, { at: 0.2, do: 'mark', on: 'f', find: 'turning', label: 'coords' }], { x: [-3, 3], y: [-2, 2] });
G('graph:mark-intersections', 'mark where graphs meet', [sq, { at: 0, do: 'plot', id: 'g', math: 'x + 1', appear: 'none' }, { at: 0.2, do: 'mark', on: ['f', 'g'], find: 'intersections', label: 'coords' }]);
G('graph:tangent', 'tangent', [sq, { at: 0, do: 'tangent', on: 'f', x: 1, length: 4, slope: true }], undefined, 2);
G('graph:tangent-triangle', 'tangent with its rise and run', [sq, { at: 0, do: 'tangent', on: 'f', x: 0.8, length: 4, triangle: true }], undefined, 2);
G('graph:tangent-slide', 'tangent sliding', [sq, { at: 0, do: 'tangent', id: 't', on: 'f', x: -2, length: 3, slope: true }, { at: 0.8, do: 'slide', who: 't', to: 2, duration: 3 }], undefined, 2.6);
G('graph:secant', 'secant closing in', [sq, { at: 0, do: 'secant', on: 'f', x: 0.5, dx: 2, close_in: true }], undefined, 2.5);
G('graph:area', 'area under a graph', [sq, { at: 0, do: 'area', on: 'f', x: [1, 2.5] }], undefined, 2);
G('graph:area-between', 'area between two graphs', [sq, { at: 0, do: 'plot', id: 'g', math: 'x + 1', appear: 'none' }, { at: 0, do: 'area', between: ['g', 'f'], x: [-1, 2], color: 'green' }], undefined, 2);
G('graph:area-rectangles', 'rectangles under a graph', [{ at: 0, do: 'plot', id: 'f', math: '0.5*x^2 + 0.5', appear: 'none' }, { at: 0, do: 'area', on: 'f', x: [0, 3], rectangles: 6, rule: 'middle', value: true }], { x: [-0.5, 3.5], y: [-0.5, 5] }, 2);
G('graph:area-refine', 'refine: thinner rectangles', [{ at: 0, do: 'plot', id: 'f', math: '0.5*x^2 + 0.5', appear: 'none' }, { at: 0, do: 'area', id: 'A', on: 'f', x: [0, 3], rectangles: 4, value: true, duration: 0.5 }, { at: 0.8, do: 'refine', who: 'A', to: 64, duration: 2.5 }], { x: [-0.5, 3.5], y: [-0.5, 5] }, 3.5);
G('graph:area-value', 'area growing with a value', [{ at: 0, do: 'value', name: 'b', start: 0.2 }, sq, { at: 0, do: 'area', on: 'f', x: [0, 'b'], value: true, duration: 0.3 }, { at: 0.5, do: 'set', name: 'b', to: 2.5, duration: 2.5 }], undefined, 3.2);
G('graph:asymptote', 'asymptote', [{ at: 0, do: 'plot', math: '1/(x-1) + 1', appear: 'none' }, { at: 0, do: 'asymptote', x: 1 }, { at: 0.3, do: 'asymptote', y: 1 }]);
G('graph:limit', 'limit', [{ at: 0, do: 'plot', id: 'f', math: '(x^2 - 1)/(x - 1)', appear: 'none' }, { at: 0.2, do: 'limit', on: 'f', x: 1, duration: 3 }], undefined, 2.6);
G('graph:shift-graph', 'shift_graph', [sq, { at: 0.5, do: 'shift_graph', who: 'f', to: '(x-2)^2 + 1', ghost: true }], undefined, 1.4);
G('graph:table-of-values', 'table_of_values', [sq, { at: 0, do: 'table_of_values', on: 'f', x: [-2, -1, 0, 1, 2], position: 'top_left' }], undefined, 3.5);
G('graph:rescale', 'rescale', [sq, { at: 0.5, do: 'rescale', x: [-10, 10], y: [-5, 20], duration: 2 }], undefined, 1.6);
G('graph:vector', 'vector', [{ at: 0, do: 'vector', to: [3, 2], label: '\\vec{v}', coords: true }], { plane: true });
G('graph:add-vectors', 'add_vectors', [{ at: 0, do: 'vector', id: 'v', to: [3, 1], label: '\\vec{v}' }, { at: 0, do: 'vector', id: 'w', to: [1, 2], label: '\\vec{w}', color: 'green' }, { at: 0.8, do: 'add_vectors', who: ['v', 'w'] }], { plane: true }, 2.8);
G('graph:field-arrows', 'field: arrows', [{ at: 0, do: 'field', x_part: '-y', y_part: 'x' }], { plane: true });
G('graph:field-flow', 'field: flowing specks', [{ at: 0, do: 'field', x_part: 'y', y_part: '-sin(x)', as: 'flow' }], { plane: true }, 3);
G('graph:field-lines', 'field: stream lines', [{ at: 0, do: 'field', x_part: 'x - y', y_part: 'x + y', as: 'lines' }], { plane: true });
G('plane:transform-matrix', 'transform_plane: a matrix', [{ at: 0, do: 'vector', to: [2, 1], appear: 'none' }, { at: 0.3, do: 'transform_plane', matrix: [[1, 1], [0, 1]], basis: true }], { plane: true }, 2.2);
G('plane:transform-ghost', 'transform_plane with a ghost grid', [{ at: 0.2, do: 'transform_plane', matrix: [[0, -1], [1, 0]], ghost: true }], { plane: true }, 1.6);
G('plane:transform-complex', 'transform_plane: a complex function', [{ at: 0.2, do: 'transform_plane', map: 'z^2 / 2' }], { plane: true, complex: true, x: [-4, 4], y: [-2.25, 2.25] }, 2.8);
G('plane:transform-xy', 'transform_plane: any map', [{ at: 0.2, do: 'transform_plane', x_part: 'x + 0.5*sin(y)', y_part: 'y + 0.5*sin(x)' }], { plane: true }, 2.8);
G('plane:undo', 'transform_plane: undo', [{ at: 0, do: 'transform_plane', matrix: [[2, 0], [0, 0.5]], duration: 1 }, { at: 1.5, do: 'transform_plane', undo: true, duration: 1 }], { plane: true }, 2);

// ---- Geometry ----
const Geo = (id: string, title: string, beats: Beat[], still = 3, scene: Record<string, unknown> = {}) =>
  add({ id, title, beats, scene: { world: 'geometry', ...scene }, still });
const tri: Beat = { at: 0, do: 'triangle', id: 'tri', size: 5, appear: 'none' };
Geo('scene:geometry', 'Geometry world', [tri], 1, {});
Geo('scene:geometry-grid', 'Geometry on squared paper with numbers', [{ at: 0, do: 'point', id: 'P', position: [2, 1], label: true }], 1, { grid: true, numbers: true });
Geo('geo:point', 'point', [{ at: 0, do: 'point', id: 'A', position: [-2, 0], label: true }, { at: 0.3, do: 'point', id: 'B', position: [2, 1], label: true, color: 'blue' }], 1.5);
Geo('geo:segment', 'segment', [{ at: 0, do: 'point', id: 'A', position: [-3, -1], label: true }, { at: 0, do: 'point', id: 'B', position: [3, 1], label: true }, { at: 0.4, do: 'segment', from: 'A', to: 'B' }], 1.8);
Geo('geo:line', 'line', [{ at: 0, do: 'point', id: 'A', position: [-1, -1], label: true }, { at: 0, do: 'point', id: 'B', position: [1, 0.5], label: true }, { at: 0.4, do: 'line', through: ['A', 'B'] }], 1.8);
Geo('geo:ray', 'ray', [{ at: 0, do: 'point', id: 'A', position: [-3, -1], label: true }, { at: 0, do: 'point', id: 'B', position: [-1, 0], label: true }, { at: 0.4, do: 'ray', from: 'A', through: 'B' }], 1.8);
Geo('geo:circle', 'circle by centre and point', [{ at: 0, do: 'point', id: 'O', position: [0, 0], label: true }, { at: 0, do: 'point', id: 'P', position: [2, 1], label: true }, { at: 0.3, do: 'circle', center: 'O', through: 'P' }], 2);
Geo('geo:circle-three', 'circle through three points', [{ at: 0, do: 'point', id: 'A', position: [-2, -1], label: true }, { at: 0, do: 'point', id: 'B', position: [2, -1.5], label: true }, { at: 0, do: 'point', id: 'C', position: [0.5, 2], label: true }, { at: 0.3, do: 'circle', through: ['A', 'B', 'C'] }], 2);
Geo('geo:polygon', 'polygon', [{ at: 0, do: 'polygon', id: 'q', points: [[-3, -1.5], [2, -2], [3, 1], [-1, 2]], names: ['P', 'Q', 'R', 'S'], fill: 'teal' }], 2);
for (const kind of ['any', 'right', 'equilateral', 'isosceles']) Geo(`geo:triangle-${kind}`, `triangle: ${kind}`, [{ at: 0, do: 'triangle', kind, size: 5 }], 1.8);
Geo('geo:midpoint', 'construct: midpoint', [tri, { at: 0, do: 'construct', id: 'M', make: 'midpoint', of: 'tri.AB', label: true }], 1);
Geo('geo:midpoint-steps', 'construct with compass steps', [tri, { at: 0, do: 'construct', id: 'M', make: 'midpoint', of: ['A', 'B'], label: true, show_steps: true }], 3.4);
Geo('geo:perpendicular', 'construct: perpendicular', [tri, { at: 0, do: 'construct', make: 'perpendicular', from: 'C', to: 'tri.AB', show_steps: true }], 3);
Geo('geo:parallel', 'construct: parallel', [tri, { at: 0, do: 'construct', make: 'parallel', through: 'C', to: 'tri.AB' }], 1.2);
Geo('geo:bisector', 'construct: perpendicular bisector', [tri, { at: 0, do: 'construct', make: 'bisector', of: 'tri.BC' }], 1.2);
Geo('geo:angle-bisector', 'construct: angle bisector', [tri, { at: 0, do: 'construct', make: 'bisector', angle: ['B', 'A', 'C'], show_steps: true }], 2.6);
Geo('geo:intersection', 'construct: intersection', [tri, { at: 0, do: 'construct', id: 'h1', make: 'perpendicular', from: 'C', to: 'tri.AB', extend: true, dash: true, color: 'grey' }, { at: 0, do: 'construct', id: 'h2', make: 'perpendicular', from: 'A', to: 'tri.BC', extend: true, dash: true, color: 'grey' }, { at: 0.5, do: 'construct', id: 'H', make: 'intersection', of: ['h1', 'h2'], label: true }], 1.6);
Geo('geo:foot', 'construct: foot', [tri, { at: 0, do: 'construct', id: 'F', make: 'foot', from: 'C', to: 'tri.AB', label: true }], 1);
Geo('geo:reflect-point', 'construct: reflect a point', [tri, { at: 0, do: 'construct', id: "C'", make: 'reflect_point', of: 'A', in: 'tri.BC', label: true }], 1);
Geo('geo:tangent', 'construct: tangents from a point', [{ at: 0, do: 'point', id: 'O', position: [-1, 0], appear: 'none', radius: 0.05 }, { at: 0, do: 'circle', id: 'c', center: 'O', radius: 1.6, appear: 'none' }, { at: 0, do: 'point', id: 'P', position: [3.5, 1], label: true, appear: 'none' }, { at: 0.2, do: 'construct', make: 'tangent', to: 'c', from: 'P' }, { at: 0.4, do: 'construct', make: 'tangent', to: 'c', from: 'P', which: 2 }], 1.6);
Geo('geo:circumcircle', 'construct: circumcircle', [tri, { at: 0, do: 'construct', id: 'cc', make: 'circumcircle', of: 'tri' }, { at: 0.3, do: 'construct', id: 'O', make: 'circumcenter', of: 'tri', label: true }], 1.6);
Geo('geo:incircle', 'construct: incircle', [tri, { at: 0, do: 'construct', make: 'incircle', of: 'tri' }, { at: 0.3, do: 'construct', id: 'I', make: 'incenter', of: 'tri', label: true }], 1.6);
Geo('geo:centroid', 'construct: centroid', [tri, { at: 0, do: 'construct', id: 'G', make: 'centroid', of: 'tri', label: true }], 1);
Geo('geo:on', 'construct: a point on a circle, dragged round', [{ at: 0, do: 'point', id: 'O', position: [0, 0], radius: 0.05 }, { at: 0, do: 'circle', id: 'c', center: 'O', radius: 2, appear: 'none' }, { at: 0, do: 'construct', id: 'P', make: 'on', on: 'c', t: 0.1, label: true }, { at: 0.5, do: 'segment', from: 'O', to: 'P' }, { at: 1, do: 'drag', who: 'P', to: 0.6, duration: 2.5 }], 2.5);
Geo('geo:angle', 'angle with its size', [tri, { at: 0, do: 'angle', points: ['B', 'A', 'C'], show: 'value' }], 1.2);
Geo('geo:angle-name', 'angle with a name, two arcs', [tri, { at: 0, do: 'angle', points: ['C', 'B', 'A'], show: '\\beta', arcs: 2, fill: 'green', color: 'green' }], 1.2);
Geo('geo:angle-right', 'right angle', [{ at: 0, do: 'triangle', kind: 'right', size: 5, appear: 'none' }, { at: 0, do: 'angle', points: ['B', 'A', 'C'] }], 1);
Geo('geo:equal', 'equal sides', [{ at: 0, do: 'triangle', id: 'tri', kind: 'isosceles', size: 5, appear: 'none' }, { at: 0, do: 'equal', who: ['tri.AC', 'tri.BC'], ticks: 2 }], 1);
Geo('geo:parallel-marks', 'parallel marks', [{ at: 0, do: 'polygon', id: 'p', points: [[-3, -1], [2, -1], [3, 1], [-2, 1]], names: ['A', 'B', 'C', 'D'], appear: 'none' }, { at: 0, do: 'equal', who: ['p.AB', 'p.DC'], as: 'arrows' }], 1);
Geo('geo:measure', 'measure', [tri, { at: 0, do: 'measure', who: 'tri.AB' }, { at: 0.2, do: 'measure', who: 'tri.BC', text: 'a' }], 1.2);
Geo('geo:drag', 'drag: the figure follows', [tri, { at: 0, do: 'angle', points: ['B', 'A', 'C'], show: 'value' }, { at: 0, do: 'construct', make: 'circumcircle', of: 'tri', dash: true }, { at: 0.5, do: 'drag', who: 'C', path: [[2, 2], [-1.5, 2.5]], duration: 3 }], 2.2);
Geo('geo:translate', 'translate', [{ ...tri, size: 3, position: [-3, -0.5] }, { at: 0.2, do: 'translate', who: 'tri', by: [5, 1], arrow: true }], 1.8);
Geo('geo:rotate', 'rotate about a point', [{ ...tri, size: 3, position: [-2, 0.5] }, { at: 0, do: 'point', id: 'O', position: [0, -1], label: true }, { at: 0.3, do: 'rotate', who: 'tri', by: 120, around: 'O', ghost: true }], 2);
Geo('geo:reflect', 'reflect in a line', [{ ...tri, size: 3, position: [-3, 0] }, { at: 0, do: 'line', id: 'm', through: [[0, -3], [0.5, 3]], dash: true }, { at: 0.3, do: 'reflect', who: 'tri', in: 'm', lines: true }], 2);
Geo('geo:enlarge', 'enlarge from a centre', [{ ...tri, size: 1.6, position: [-2, -0.8] }, { at: 0, do: 'point', id: 'O', position: [-4.5, -2.5], label: true }, { at: 0.3, do: 'enlarge', who: 'tri', by: 2.2, center: 'O', rays: true }], 2);
Geo('geo:cut-sectors', 'cut a circle into slices', [{ at: 0, do: 'point', id: 'O', position: [0, 0.3], radius: 0.001 }, { at: 0, do: 'circle', id: 'c', center: 'O', radius: 2.2, appear: 'none' }, { at: 0.3, do: 'cut', who: 'c', into: 'sectors', count: 12, id: 's' }], 1.2);
Geo('geo:rearrange-strip', 'rearrange slices into a strip', [{ at: 0, do: 'point', id: 'O', position: [0, 0.3], radius: 0.001 }, { at: 0, do: 'circle', id: 'c', center: 'O', radius: 2, appear: 'none' }, { at: 0, do: 'cut', who: 'c', into: 'sectors', count: 16, id: 's' }, { at: 0.6, do: 'rearrange_pieces', who: 's', into: 'strip', duration: 2.5 }], 3.4);
Geo('geo:cut-strips', 'cut into strips, laid in a row', [{ at: 0, do: 'polygon', id: 'p', points: [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]], appear: 'none', labels: false }, { at: 0.2, do: 'cut', who: 'p', into: 'strips', count: 4, id: 'st' }, { at: 0.9, do: 'rearrange_pieces', who: 'st', into: 'row', gap: 0.3, duration: 1.5 }], 2.6);
Geo('geo:cut-lines', 'cut along lines', [{ at: 0, do: 'polygon', id: 'p', points: [[-3, -2], [3, -2], [3, 2], [-3, 2]], appear: 'none', labels: false }, { at: 0, do: 'line', id: 'd', through: [[-3, -2], [3, 2]], hidden: true }, { at: 0.2, do: 'cut', who: 'p', into: 'lines', lines: ['d'], id: 'h' }, { at: 0.8, do: 'rearrange_pieces', who: 'h', places: [{ position: [-1.5, 0], turn: 0 }, { position: [2.5, 0], turn: 180 }], duration: 1.5 }], 2.6);

// ---- On-screen graphics (stage 5) ----
add({ id: 'text:card', title: 'card', beats: [{ at: 0, duration: 4, do: 'card', kicker: 'Fact', title: 'Pi', number: 3.14159, text: 'The same for every circle.' }], still: 2.2 });
add({ id: 'text:card-on', title: 'card pointing at a thing', beats: [eq('E = mc^2'), { at: 0.5, duration: 4, do: 'card', title: 'Speed of light', tex: 'c \\approx 3 \\times 10^8', side: 'right', position: 'bottom', on: 'eq' }], still: 2.4 });
add({ id: 'text:counter', title: 'counter', beats: [{ at: 0, do: 'counter', items: [{ to: 1200000, label: 'people' }, { to: 98.6, suffix: '%', label: 'right' }], duration: 2 }], still: 3 });
add({ id: 'text:counter-indian', title: 'counter, Indian grouping', beats: [{ at: 0, do: 'counter', to: 1200000, prefix: '₹', grouping: 'indian', label: 'saved', duration: 1.5 }], still: 2.5 });
add({ id: 'text:chips', title: 'chips', beats: [{ at: 0, duration: 3, do: 'chips', kicker: 'Today', items: ['primes', 'squares', 'roots', 'powers'] }], still: 2 });
add({ id: 'text:table', title: 'table', beats: [{ at: 0, duration: 4, do: 'table', head: ['$x$', '$x^2$'], rows: [['1', '1'], ['2', '4'], ['3', '9']], light: 2 }], still: 2.6 });
for (const kind of ['bar', 'line', 'pie', 'dot'] as const) {
  add({ id: `text:chart-${kind}`, title: `chart: ${kind}`, beats: [{ at: 0, duration: 4, do: 'chart', kind, title: 'Visitors', items: [{ label: 'Mon', value: 3 }, { label: 'Tue', value: 5 }, { label: 'Wed', value: 2 }, { label: 'Thu', value: 4 }] }], still: 3 });
}
add({ id: 'text:label', title: 'label with an arrow', beats: [{ at: 0, do: 'draw', shape: 'circle', id: 'c', size: 'medium' }, { at: 0.4, do: 'label', on: 'c', text: 'a circle', side: 'above', arrow: true }], still: 1.5 });
add({ id: 'text:credits', title: 'credits', beats: [{ at: 0, do: 'credits', lines: ['# Made by', 'A maths teacher', '# Music', 'Your music here'], duration: 6 }], still: 3 });
for (const frame of ['rounded', 'circle', 'polaroid'] as const) {
  add({ id: `text:image-${frame}`, title: `image: ${frame} frame`, beats: [{ at: 0, duration: 4, do: 'image', file: 'picture.png', frame, caption: 'A caption' }], still: 1.5 });
}

// ---- Teaching ----
add({ id: 'teach:question', title: 'question with choices', beats: [{ at: 0, do: 'question', text: 'What is $\\sqrt{16}$?', choices: ['2', '4', '8', '16'], hint: 'What times itself gives 16?', wait: 4 }], still: 4.2 });
add({ id: 'teach:answer', title: 'answer: the right choice', beats: [{ at: 0, do: 'question', text: 'What is $\\sqrt{16}$?', choices: ['2', '4', '8', '16'], wait: false }, { at: 2, do: 'answer', choice: 'B', why: 'Because 4 × 4 = 16.', duration: 3 }], still: 3.2 });
add({ id: 'teach:answer-text', title: 'answer written out', beats: [{ at: 0, do: 'question', text: 'What is $(3+4)^2$?', wait: false }, { at: 1.5, do: 'answer', tex: '49', why: 'Not 9 + 16 = 25.', duration: 3 }], still: 2.8 });
add({ id: 'teach:wait', title: 'wait with a countdown', beats: [eq('x^2 = 49'), { at: 1, do: 'wait', for: 4, text: 'Pause and try' }], still: 2.8 });
add({ id: 'teach:mistake', title: 'mistake, put right', beats: [{ at: 0, do: 'mistake', tex: '(a+b)^2 = a^2 + b^2', fix: '(a+b)^2 = a^2 + 2ab + b^2', reason: 'the middle term is missing' }], still: 3.2 });
add({ id: 'teach:tick-cross', title: 'tick and cross', beats: [{ at: 0, do: 'write', id: 'a', tex: '2 + 2 = 4', position: [0, 1] }, { at: 0, do: 'write', id: 'b', tex: '2 + 2 = 5', position: [0, -1] }, { at: 0.8, do: 'tick', who: 'a' }, { at: 1.2, do: 'cross', who: 'b' }], still: 2 });
for (const kind of ['definition', 'theorem', 'rule', 'formula', 'tip'] as const) {
  const body = kind === 'theorem' ? { title: 'Pythagoras', tex: 'a^2 + b^2 = c^2' } : kind === 'formula' ? { title: 'Area of a circle', tex: 'A = \\pi r^2' } : kind === 'rule' ? { title: 'Index law', tex: 'a^m \\cdot a^n = a^{m+n}' } : kind === 'tip' ? { text: 'Check your answer by putting it back in.' } : { title: 'Prime number', text: 'A whole number above 1 with exactly two factors.' };
  add({ id: `teach:${kind}`, title: kind, beats: [{ at: 0, duration: 4, do: kind, position: 'center', ...body }], still: 1.5 });
}
add({ id: 'teach:step-counter', title: 'step counter', beats: [{ at: 0, do: 'step_counter', step: 1, of: 3 }, eq('2x + 5 = 11'), { at: 1.5, do: 'step_counter', step: 2, of: 3 }, { at: 1.5, do: 'steps', who: 'eq', to: '2x = 6' }], still: 3 });
add({ id: 'teach:recap', title: 'recap of key things', beats: [{ at: 0, do: 'write', id: 'k', tex: '(a+b)^2 = a^2 + 2ab + b^2', key: true, position: [0, 2.5] }, { at: 0.5, do: 'definition', title: 'Square', text: 'A number times itself.', duration: 1 }, { at: 2, do: 'recap' }], still: 4.5 });
add({ id: 'teach:compare', title: 'compare, one better', beats: [{ at: 0, duration: 4, do: 'compare', left: { title: 'Term by term', tex: 'a^2 + b^2' }, right: { title: 'Expanded', tex: 'a^2 + 2ab + b^2' }, better: 'right' }], still: 2.5 });

// ---- Counting world ----
const Count = (id: string, title: string, beats: Beat[], still: number, scene: Record<string, unknown> = {}) => add({ id, title, beats, still, scene: { world: 'counting', ...scene } });
Count('count:number-line', 'number line', [{ at: 0, do: 'number_line', x: [-5, 5] }], 1.5);
Count('count:jump', 'jumps on a number line', [{ at: 0, do: 'jump', from: -2, by: 5 }, { at: 1, do: 'jump', from: 3, by: -4, side: 'below', color: 'red' }], 2.5, { number_line: { x: [-5, 5] } });
Count('count:jump-count', 'equal jumps: 4 × 3', [{ at: 0, do: 'jump', from: 0, by: 3, count: 4, label: '+3' }], 3.6, { number_line: { x: [0, 13] } });
Count('count:interval', 'intervals, open and closed', [{ at: 0, do: 'interval', from: -3, to: 1, open_end: true }, { at: 0.8, do: 'interval', from: 3, to: 'inf', color: 'green' }], 2.2, { number_line: { x: [-5, 5] } });
Count('count:line-quarters', 'a line in quarters', [{ at: 0, do: 'number_line', x: [0, 2, '1/4'], fractions: true }], 1.5);
Count('count:zoom-line', 'zooming into a number line', [{ at: 0.3, do: 'zoom_line', x: [0, 1], duration: 2.5 }], 2.2, { number_line: { x: [-5, 5] } });
Count('count:dots', 'dots in an array', [{ at: 0, do: 'dots', id: 'd', rows: 3, columns: 4 }], 2);
for (const shape of ['apple', 'coin', 'person', 'star', 'heart', 'ball'] as const) Count(`count:dots-${shape}`, `things: ${shape}`, [{ at: 0, do: 'dots', count: 7, shape, size: 'large' }], 1.6);
Count('count:group-items', 'grouped by row', [{ at: 0, do: 'dots', id: 'd', rows: 3, columns: 4 }, { at: 1.6, do: 'group_items', who: 'd', by: 'row' }], 3.3);
Count('count:count-items', 'counting things', [{ at: 0, do: 'dots', id: 'd', count: 8, shape: 'apple', size: 'large' }, { at: 1, do: 'count_items', who: 'd' }], 4.5);
Count('count:tally', 'tally marks', [{ at: 0, do: 'tally', count: 13 }], 3);
Count('count:blocks', 'base-ten blocks', [{ at: 0, do: 'blocks', id: 'b', number: 243 }], 2.5);
Count('count:regroup-carry', 'regroup: ten ones make a ten', [{ at: 0, do: 'blocks', id: 'b', tens: 1, ones: 12, lag: 0.05 }, { at: 1.2, do: 'regroup', who: 'b', carry: true }], 3.2);
Count('count:regroup-borrow', 'regroup: a ten breaks into ones', [{ at: 0, do: 'blocks', id: 'b', number: 32, lag: 0.05 }, { at: 1, do: 'regroup', who: 'b', borrow: true }], 3.4);
for (const as of ['bar', 'pie', 'grid', 'line'] as const) Count(`count:fraction-${as}`, `fraction: ${as}`, [{ at: 0, do: 'fraction', as, parts: 4, shade: 3, label: true }], 1.6);
Count('count:split', 'split: 3/4 = 6/8', [{ at: 0, do: 'fraction', id: 'f', parts: 4, shade: 3, label: true }, { at: 1.3, do: 'split', who: 'f', into: 8 }], 3.3);
Count('count:line-up', 'line up two fractions', [{ at: 0, do: 'fraction', id: 'a', parts: 3, shade: 2, position: [-3, 2] }, { at: 0, do: 'fraction', id: 'b', parts: 4, shade: 3, size: 'small', position: [3, -2] }, { at: 1.3, do: 'line_up', who: ['a', 'b'] }], 3);
Count('count:coin', 'coin flips', [{ at: 0, do: 'coin', results: ['H', 'T', 'H'] }], 4.3);
Count('count:coin-random', 'fifty flips, kept count', [{ at: 0, do: 'coin', random: 50 }], 6.5);
Count('count:dice', 'two dice', [{ at: 0, do: 'dice', count: 2, results: [[3, 4]] }], 1.8);
Count('count:dice-rolling', 'a die mid-roll', [{ at: 0, do: 'dice', results: [6] }], 0.5);
Count('count:spinner', 'a spinner', [{ at: 0, do: 'spinner', parts: ['red', 'blue', 'blue', 'green'], result: 2 }], 3);
Count('count:cards', 'cards turned over', [{ at: 0, do: 'cards', results: ['A♠', '10♥', 'KD', '7C'] }], 3.2);
Count('count:tree', 'probability tree', [{ at: 0, do: 'tree', id: 't', outcomes: true, levels: [[{ label: 'H', p: '1/2' }, { label: 'T', p: '1/2' }], [{ label: 'H', p: '1/2' }, { label: 'T', p: '1/2' }]] }], 2.6);
Count('count:tree-highlight', 'one path lit', [{ at: 0, do: 'tree', id: 't', grow: 'all', levels: [[{ label: 'H', p: '1/2' }, { label: 'T', p: '1/2' }], [{ label: 'H', p: '1/2' }, { label: 'T', p: '1/2' }]] }, { at: 0.8, do: 'highlight', who: 't.HT', how: 'color', color: 'yellow' }], 2.2);
Count('count:sample-space', 'two dice: sums of 7', [{ at: 0, do: 'sample_space', rows: 6, columns: 6, cell: 'r + c', light: 'r + c == 7', size: 'small' }], 3.6);
Count('count:table', 'a table-top', [{ at: 0, do: 'dice', count: 2, results: [[5, 2]] }], 1.8, { table: true });

export const entries = ENTRIES;

export const GROUPS: Record<string, string> = {
  scene: 'Worlds and backgrounds', look: 'Look: themes and colours', voice: 'Narration and captions', eq: 'Equations',
  shape: 'Shapes', move: 'Moving and attention', text: 'On-screen graphics', shot: 'Camera', transition: 'Transitions', graph: 'Graphs', plane: 'Planes', sound: 'Sound', geo: 'Geometry', teach: 'Teaching', count: 'Counting, fractions and chance',
};
