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
add({ id: 'eq:work-numbered', title: 'work, numbered, not carried', beats: [{ at: 0, do: 'work', numbered: true, carry: false, lines: ['x^2 - 5x + 6 = 0', '(x-2)(x-3) = 0', 'x = 2 \\text{ or } x = 3'] }], still: 4.5 });
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

export const entries = ENTRIES;

export const GROUPS: Record<string, string> = {
  scene: 'Worlds and backgrounds', look: 'Look: themes and colours', voice: 'Narration and captions', eq: 'Equations',
  shape: 'Shapes', move: 'Moving and attention', text: 'On-screen graphics', shot: 'Camera', transition: 'Transitions', graph: 'Graphs', plane: 'Planes',
};
