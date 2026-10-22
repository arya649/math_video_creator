// The engine page: opening a script and its files, preview, export.

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/600.css';
import { type Movie, compileMovie } from './engine/movie';
import { Renderer } from './engine/render';
import { exportMp4 } from './engine/export';
import { ScriptError, isObject } from './engine/util';
import { type VoiceTimes, toSrt } from './engine/narration';
import { chapterList } from './engine/chapters';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('view');
const scrub = $<HTMLInputElement>('scrub');
const playBtn = $<HTMLButtonElement>('play');
const timeLabel = $('time');
const problems = $('problems');
const langSel = $<HTMLSelectElement>('lang');
const captionsBox = $<HTMLInputElement>('captions');
const mutedBox = $<HTMLInputElement>('muted');
const exportBtn = $<HTMLButtonElement>('export');
const status = $('status');

let script: unknown = null;
let scriptText = '';
let movie: Movie | null = null;
let renderer: Renderer | null = null;
let time = 0;
let playing = false;
let lastTick = 0;
const files = new Map<string, ArrayBuffer>();
const texts: Record<string, string> = {};
const voices: Record<string, VoiceTimes> = {};
let audioEl: HTMLAudioElement | null = null;

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

function showProblems(errors: string[], warnings: string[]) {
  problems.innerHTML = '';
  problems.classList.remove('muted');
  if (!errors.length && !warnings.length) {
    problems.innerHTML = '<span class="ok">No problems found.</span>';
    return;
  }
  for (const e of errors) {
    const d = document.createElement('div');
    d.className = 'problem';
    d.textContent = e;
    problems.append(d);
  }
  for (const w of warnings) {
    const d = document.createElement('div');
    d.className = 'warning';
    d.textContent = w;
    problems.append(d);
  }
}

/** Text is measured when a script is compiled, so the fonts must be ready first. */
async function fontsReady() {
  await Promise.all(['400', '500', '600', '700'].flatMap((w) => [
    document.fonts.load(`${w} 40px Poppins`), document.fonts.load(`${w} 40px "Noto Sans Devanagari"`, 'अ'),
  ]));
  await document.fonts.ready;
}

async function build() {
  if (!script) return;
  await fontsReady();
  const lang = langSel.value || undefined;
  try {
    movie = compileMovie(script, { lang, texts, voices, captions: captionsBox.checked });
  } catch (err) {
    movie = null;
    renderer = null;
    showProblems([err instanceof ScriptError ? err.message : `The engine failed: ${(err as Error).stack ?? err}`], []);
    exportBtn.disabled = true;
    playBtn.disabled = true;
    scrub.disabled = true;
    if (!(err instanceof ScriptError)) console.error(err);
    return;
  }
  showProblems([], [...movie.warnings, ...chapterList(movie).warnings]);
  $('drop').style.display = 'none';
  if (langSel.options.length !== movie.languages.length) {
    langSel.innerHTML = movie.languages.map((l) => `<option value="${l}">${l}</option>`).join('');
    langSel.value = movie.lang;
  }
  renderer = new Renderer(canvas, movie);
  renderer.captions = captionsBox.checked && !mutedBox.checked;
  exportBtn.disabled = false;
  playBtn.disabled = false;
  scrub.disabled = false;
  time = Math.min(time, movie.duration);
  const sceneList = $('scenes');
  sceneList.innerHTML = '';
  movie.scenes.forEach((s) => {
    const d = document.createElement('div');
    d.className = 'scene';
    d.innerHTML = `<span>${s.chapter ? `<b>${escape(s.chapter)}</b> · ` : ''}${escape(s.name)}</span><span class="t">${fmt(s.start)}</span>`;
    d.onclick = () => seek(s.start);
    sceneList.append(d);
  });
  $('narration').textContent = movie.narration.source === 'estimate'
    ? `${movie.narration.lines.length} lines, timed by estimate (no voice made yet).`
    : movie.narration.source === 'none' ? 'No narration lines.' : `${movie.narration.lines.length} lines, timed from the ${movie.narration.source}.`;
  setupAudio();
  draw();
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function setupAudio() {
  if (audioEl) { audioEl.pause(); audioEl = null; }
  if (!movie?.audio) return;
  const data = files.get(movie.audio);
  if (!data) {
    showProblems([], [...movie.warnings, `The sound file "${movie.audio}" was not opened; the preview plays silent.`]);
    return;
  }
  audioEl = new Audio(URL.createObjectURL(new Blob([data])));
}

function draw() {
  if (!renderer || !movie) return;
  try {
    renderer.render(time);
  } catch (err) {
    showProblems([`Drawing failed at ${fmt(time)}: ${(err as Error).message}`], movie.warnings);
    console.error(err);
    playing = false;
  }
  scrub.value = String(Math.round((time / movie.duration) * 1000));
  timeLabel.textContent = `${fmt(time)} / ${fmt(movie.duration)}`;
}

function seek(t: number) {
  time = Math.max(0, Math.min(movie?.duration ?? 0, t));
  if (audioEl) audioEl.currentTime = time;
  draw();
}

function tick(now: number) {
  if (playing && movie) {
    if (audioEl && !audioEl.paused && !mutedBox.checked) time = audioEl.currentTime;
    else time += (now - lastTick) / 1000;
    if (time >= movie.duration) { time = movie.duration; setPlaying(false); }
    draw();
  }
  lastTick = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function setPlaying(on: boolean) {
  playing = on;
  playBtn.textContent = on ? 'Pause' : 'Play';
  if (audioEl) {
    if (on && !mutedBox.checked) { audioEl.currentTime = time; void audioEl.play(); } else audioEl.pause();
  }
}

playBtn.onclick = () => {
  if (movie && time >= movie.duration) time = 0;
  setPlaying(!playing);
};
scrub.oninput = () => movie && seek((Number(scrub.value) / 1000) * movie.duration);
langSel.onchange = () => void build();
captionsBox.onchange = () => { if (renderer) { renderer.captions = captionsBox.checked && !mutedBox.checked; draw(); } };
mutedBox.onchange = () => { if (renderer) { renderer.captions = captionsBox.checked && !mutedBox.checked; draw(); } if (audioEl) audioEl.muted = mutedBox.checked; };
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
  if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
  if (e.code === 'ArrowRight') seek(time + (e.shiftKey ? 5 : 1 / 30));
  if (e.code === 'ArrowLeft') seek(time - (e.shiftKey ? 5 : 1 / 30));
});

// ---- Opening files ----

async function takeFiles(list: FileList | File[]) {
  let found: File | null = null;
  for (const f of Array.from(list)) {
    const buf = await f.arrayBuffer();
    files.set(f.name, buf);
    if (/\.(srt|txt)$/i.test(f.name)) texts[f.name] = new TextDecoder().decode(buf);
    if (/^voice_([\w-]+)\.json$/i.test(f.name)) voices[f.name.match(/^voice_([\w-]+)\.json$/i)![1]] = JSON.parse(new TextDecoder().decode(buf));
    if (/\.json$/i.test(f.name) && !/^voice_/i.test(f.name)) found = f;
  }
  if (found) {
    scriptText = new TextDecoder().decode(files.get(found.name)!);
    try {
      script = JSON.parse(scriptText);
    } catch (err) {
      showProblems([`${found.name} is not valid JSON: ${(err as Error).message}`], []);
      return;
    }
    langSel.innerHTML = '';
  }
  await build();
}

$<HTMLInputElement>('files').onchange = (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files) void takeFiles(input.files);
};
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer?.files) void takeFiles(e.dataTransfer.files);
});

/** Every file name a script mentions. */
function namedFiles(s: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string' && /\.(mp3|wav|m4a|ogg|srt|png|jpe?g|webp|svg|mp4|webm|glb)$/i.test(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (isObject(v)) Object.values(v).forEach(walk);
  };
  walk(s);
  if (isObject(s) && Array.isArray(s.languages)) for (const l of s.languages) out.add(`voice_${l}.json`);
  return [...out];
}

async function loadProject(name: string, quiet = false) {
  const base = `${import.meta.env.BASE_URL}projects/${name}/`;
  const res = await fetch(`${base}script.json`, { cache: 'no-store' });
  if (!res.ok) { showProblems([`There is no project "${name}" (looked for ${base}script.json).`], []); return; }
  const text = await res.text();
  if (quiet && text === scriptText) return;
  scriptText = text;
  try { script = JSON.parse(text); } catch (err) { showProblems([`script.json is not valid JSON: ${(err as Error).message}`], []); return; }
  for (const f of namedFiles(script)) {
    if (files.has(f)) continue;
    const r = await fetch(base + f);
    if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) continue;
    const buf = await r.arrayBuffer();
    files.set(f, buf);
    if (/\.srt$/i.test(f)) texts[f] = new TextDecoder().decode(buf);
    if (/^voice_([\w-]+)\.json$/i.test(f)) voices[f.match(/^voice_([\w-]+)\.json$/i)![1]] = JSON.parse(new TextDecoder().decode(buf));
  }
  await build();
}

const params = new URLSearchParams(location.search);
const project = params.get('project');
if (project) {
  void loadProject(project);
  // Pick up edits to the project's script while the page is open.
  setInterval(() => void loadProject(project, true), 1500);
}

// ---- Export ----

exportBtn.onclick = async () => {
  if (!movie) return;
  if (typeof VideoEncoder === 'undefined') { status.textContent = 'This browser cannot make videos (no WebCodecs). Use Chrome or Edge.'; return; }
  exportBtn.disabled = true;
  setPlaying(false);
  try {
    const blob = await exportMp4(movie, {
      files, captions: captionsBox.checked,
      onProgress: (u) => { status.textContent = `Exporting ${Math.round(u * 100)}%`; },
    });
    const base = `${movie.title.replace(/[^\w\- ]/g, '').trim() || 'video'}_${movie.lang}`;
    // The video, its subtitle file for YouTube, and the chapter list for the description.
    const out: [string, Blob][] = [[`${base}.mp4`, blob]];
    if (movie.narration.lines.length) out.push([`${base}.srt`, new Blob([toSrt(movie.narration)], { type: 'text/plain' })]);
    const chapters = chapterList(movie);
    if (chapters.text) out.push([`chapters_${movie.lang}.txt`, new Blob([chapters.text], { type: 'text/plain' })]);
    for (const [name, b] of out) {
      if (import.meta.env.DEV) await fetch(`/__save?name=${encodeURIComponent(name)}`, { method: 'POST', body: b });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = name;
      a.click();
    }
    status.textContent = `Saved ${out.map(([n]) => n).join(', ')}`;
  } catch (err) {
    status.textContent = `Export failed: ${(err as Error).message}`;
    console.error(err);
  }
  exportBtn.disabled = false;
};

// ---- For checking from the console ----

declare global { interface Window { engine: unknown } }
window.engine = {
  get movie() { return movie; },
  draw(t: number) { seek(t); },
  async still(name: string, t: number) {
    seek(t);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    await fetch(`/__save?name=${encodeURIComponent(name)}.jpg`, { method: 'POST', body: blob });
    return `${name}.jpg`;
  },
  load: loadProject,
};
