// The engine page: opening a script and its files, voice, preview, export.

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/600.css';
import { type Movie, compileMovie } from './engine/movie';
import { Renderer } from './engine/render';
import { exportMp4 } from './engine/export';
import { mixAudio } from './engine/mix';
import { encodeWav } from './engine/wav';
import { ScriptError, isObject } from './engine/util';
import { type VoiceTimes, toSrt } from './engine/narration';
import { alignRecording, browserServices, makeVoice, readVoice } from './engine/voice';
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
const exportAllBtn = $<HTMLButtonElement>('export-all');
const status = $('status');
const keyBox = $<HTMLInputElement>('key');
const rememberBox = $<HTMLInputElement>('remember');
const makeVoiceBtn = $<HTMLButtonElement>('make-voice');
const alignBtn = $<HTMLButtonElement>('align');
const voiceInfo = $('voice-info');

let script: Record<string, unknown> | null = null;
let scriptText = '';
let movie: Movie | null = null;
let renderer: Renderer | null = null;
let time = 0;
let playing = false;
let lastTick = 0;
const files = new Map<string, ArrayBuffer>();
const texts: Record<string, string> = {};
const voices: Record<string, VoiceTimes> = {};
const audioLengths: Record<string, number> = {};
let audioEl: HTMLAudioElement | null = null;
let soundWarnings: string[] = [];
let mixRun = 0;

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const project = new URLSearchParams(location.search).get('project');

function showProblems(errors: string[], warnings: string[]) {
  problems.innerHTML = '';
  problems.classList.remove('muted');
  if (!errors.length && !warnings.length) {
    problems.innerHTML = '<span class="ok">No problems found.</span>';
    return;
  }
  for (const [list, cls] of [[errors, 'problem'], [warnings, 'warning']] as const) {
    for (const e of list) {
      const d = document.createElement('div');
      d.className = cls;
      d.textContent = e;
      problems.append(d);
    }
  }
}

/** Text is measured when a script is compiled, so the fonts must be ready first. */
async function fontsReady() {
  await Promise.all(['400', '500', '600', '700'].flatMap((w) => [
    document.fonts.load(`${w} 40px Poppins`), document.fonts.load(`${w} 40px "Noto Sans Devanagari"`, 'अ'),
  ]));
  await document.fonts.ready;
}

/** How long each recording opened with the script is, so the estimate can be fitted to it. */
async function measureRecordings() {
  if (!script) return;
  const audio = script.audio;
  const names = typeof audio === 'string' ? [audio] : isObject(audio) ? Object.values(audio).filter((v): v is string => typeof v === 'string') : [];
  const ctx = new OfflineAudioContext(1, 1, 44100);
  for (const n of names) {
    if (audioLengths[n] !== undefined || !files.has(n)) continue;
    try { audioLengths[n] = (await ctx.decodeAudioData(files.get(n)!.slice(0))).duration; } catch { /* reported when mixing */ }
  }
}

function compile(lang?: string): Movie {
  return compileMovie(script, { lang, texts, voices, audioLengths, captions: captionsBox.checked });
}

async function build() {
  if (!script) return;
  await fontsReady();
  await measureRecordings();
  const lang = langSel.value || undefined;
  try {
    movie = compile(lang);
  } catch (err) {
    movie = null;
    renderer = null;
    showProblems([err instanceof ScriptError ? err.message : `The engine failed: ${(err as Error).stack ?? err}`], []);
    for (const b of [exportBtn, exportAllBtn, playBtn]) b.disabled = true;
    scrub.disabled = true;
    if (!(err instanceof ScriptError)) console.error(err);
    return;
  }
  $('drop').style.display = 'none';
  if (langSel.options.length !== movie.languages.length) {
    langSel.innerHTML = movie.languages.map((l) => `<option value="${l}">${l}</option>`).join('');
    langSel.value = movie.lang;
  }
  renderer = new Renderer(canvas, movie);
  renderer.captions = captionsBox.checked && !mutedBox.checked;
  for (const b of [exportBtn, playBtn]) b.disabled = false;
  exportAllBtn.disabled = movie.languages.length < 2;
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
  describeVoice();
  soundWarnings = [];
  refreshProblems();
  void setupAudio();
  draw();
}

function refreshProblems() {
  if (!movie || !script) return;
  const extra: string[] = [];
  if (isObject(script.voice) && typeof script.voice.api_key === 'string' && script.voice.api_key) {
    extra.push('voice.api_key: the ElevenLabs key is inside the script. Anyone you share the script with can use it; a key file or the key box keeps it out.');
  }
  showProblems([], [...movie.warnings, ...chapterList(movie).warnings, ...soundWarnings, ...extra]);
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** The sound of the preview: the same mix the export makes. */
async function setupAudio() {
  const run = ++mixRun;
  if (audioEl) { audioEl.pause(); audioEl = null; }
  if (!movie) return;
  const missing = new Set<string>();
  let mixed: AudioBuffer | null;
  try {
    mixed = await mixAudio(movie, files, (n) => missing.add(n));
  } catch (err) {
    soundWarnings = [`The sound could not be mixed: ${(err as Error).message}`];
    refreshProblems();
    return;
  }
  if (run !== mixRun) return;
  soundWarnings = [...missing].map((n) => `The sound file "${n}" was not opened with the script; it is left out.`);
  refreshProblems();
  if (!mixed) return;
  audioEl = new Audio(URL.createObjectURL(encodeWav(mixed)));
  audioEl.muted = mutedBox.checked;
  if (playing) { audioEl.currentTime = time; void audioEl.play(); }
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
    if (audioEl && !audioEl.paused) time = audioEl.currentTime;
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
    if (on) { audioEl.currentTime = time; void audioEl.play(); } else audioEl.pause();
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
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
  if (e.code === 'ArrowRight') seek(time + (e.shiftKey ? 5 : 1 / 30));
  if (e.code === 'ArrowLeft') seek(time - (e.shiftKey ? 5 : 1 / 30));
});

// ---- The voice ----

const KEY_STORE = 'math-video-engine.elevenlabs-key';
try {
  const saved = localStorage.getItem(KEY_STORE);
  if (saved) { keyBox.value = saved; rememberBox.checked = true; }
} catch { /* storage may be blocked */ }
const saveKey = () => {
  try {
    if (rememberBox.checked && keyBox.value.trim()) localStorage.setItem(KEY_STORE, keyBox.value.trim());
    else localStorage.removeItem(KEY_STORE);
  } catch { /* storage may be blocked */ }
};
keyBox.onchange = () => { saveKey(); describeVoice(); };
rememberBox.onchange = saveKey;

/** The ElevenLabs key: in the script, in a key file opened with it, or typed in the box. */
function apiKey(): { key?: string; from?: string } {
  if (script && isObject(script.voice) && typeof script.voice.api_key === 'string' && script.voice.api_key.trim()) {
    return { key: script.voice.api_key.trim(), from: 'the script' };
  }
  for (const [name, data] of files) {
    if (/key.*\.txt$|\.key$/i.test(name)) {
      const k = new TextDecoder().decode(data).trim();
      if (k) return { key: k, from: name };
    }
  }
  if (keyBox.value.trim()) return { key: keyBox.value.trim(), from: 'the key box' };
  return {};
}

function recordingFor(lang: string): string | undefined {
  if (!script) return undefined;
  const a = script.audio;
  if (typeof a === 'string') return a;
  if (isObject(a) && typeof a[lang] === 'string') return a[lang] as string;
  return undefined;
}

function describeVoice() {
  if (!movie || !script) return;
  const lang = movie.lang;
  const n = movie.narration;
  const lines = `${n.lines.length} line${n.lines.length === 1 ? '' : 's'}`;
  const how: Record<string, string> = {
    voice: 'timed exactly by the voice the engine made',
    aligned: 'timed exactly by lining up your recording with the words',
    subtitles: 'timed by your subtitle file',
    scaled: 'timed by an estimate fitted to your recording (a key gives exact times)',
    estimate: 'timed by an estimate from the words (no voice yet)',
    none: '',
  };
  $('narration').textContent = n.source === 'none' ? 'No narration lines.' : `${lines} in "${lang}", ${how[n.source]}.`;
  const { key, from } = apiKey();
  let settings = null;
  try { settings = readVoice(script, lang); } catch { /* shown when compiling */ }
  const rec = recordingFor(lang);
  makeVoiceBtn.disabled = !settings || !key || !!rec;
  alignBtn.disabled = !rec || !key || !files.has(rec);
  const parts: string[] = [];
  if (rec) parts.push(files.has(rec) ? `Your recording: ${rec}.` : `Your recording "${rec}" has not been opened yet.`);
  else if (settings) parts.push(`Voice: ${settings.voice} (ElevenLabs).`);
  else parts.push(`No recording or voice for "${lang}" yet: add "audio" or "voice" to the script.`);
  parts.push(key ? `Key from ${from}.` : 'No ElevenLabs key: the preview uses estimated times.');
  voiceInfo.textContent = parts.join(' ');
}

/** Keep a made file: in the project folder while developing, else as a download to open with the script next time. */
async function keepFile(name: string, blob: Blob) {
  files.set(name, await blob.arrayBuffer());
  if (import.meta.env.DEV && project) {
    await fetch(`/__save?project=${encodeURIComponent(project)}&name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

makeVoiceBtn.onclick = async () => {
  if (!script || !movie) return;
  const { key } = apiKey();
  if (!key) return;
  const lang = movie.lang;
  makeVoiceBtn.disabled = true;
  try {
    const made = await makeVoice(script, lang, key, browserServices(), (d, n) => { status.textContent = `Making the voice: line ${Math.min(d + 1, n)} of ${n}`; });
    voices[lang] = made.times;
    await keepFile(`voice_${lang}.wav`, made.wav);
    await keepFile(`voice_${lang}.json`, new Blob([JSON.stringify(made.times)], { type: 'application/json' }));
    status.textContent = project ? `Voice made and kept in the project (voice_${lang}.wav).` : `Voice made. Keep voice_${lang}.wav and voice_${lang}.json with the script.`;
    await build();
  } catch (err) {
    status.textContent = err instanceof ScriptError ? err.message : `Making the voice failed: ${(err as Error).message}`;
    console.error(err);
  }
  describeVoice();
};

alignBtn.onclick = async () => {
  if (!script || !movie) return;
  const { key } = apiKey();
  const lang = movie.lang;
  const rec = recordingFor(lang);
  if (!key || !rec || !files.has(rec)) return;
  alignBtn.disabled = true;
  status.textContent = 'Lining up your recording with the words…';
  try {
    const times = await alignRecording(script, lang, key, files.get(rec)!, rec, browserServices());
    voices[lang] = times;
    await keepFile(`voice_${lang}.json`, new Blob([JSON.stringify(times)], { type: 'application/json' }));
    status.textContent = `Recording timed. Keep voice_${lang}.json with the script.`;
    await build();
  } catch (err) {
    status.textContent = err instanceof ScriptError ? err.message : `Timing the recording failed: ${(err as Error).message}`;
    console.error(err);
  }
  describeVoice();
};

// ---- Opening files ----

function takeText(name: string, buf: ArrayBuffer) {
  if (/\.(srt|txt)$/i.test(name)) texts[name] = new TextDecoder().decode(buf);
  const v = name.match(/^voice_([\w-]+)\.json$/i);
  if (v) voices[v[1]] = JSON.parse(new TextDecoder().decode(buf));
}

async function takeFiles(list: FileList | File[]) {
  let found: File | null = null;
  for (const f of Array.from(list)) {
    const buf = await f.arrayBuffer();
    files.set(f.name, buf);
    delete audioLengths[f.name];
    takeText(f.name, buf);
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

/** Every file name a script mentions, and the voice files that may sit beside it. */
function namedFiles(s: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string' && /\.(mp3|wav|m4a|ogg|srt|png|jpe?g|webp|svg|mp4|webm|glb)$/i.test(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (isObject(v)) Object.values(v).forEach(walk);
  };
  walk(s);
  if (isObject(s) && Array.isArray(s.languages)) for (const l of s.languages) { out.add(`voice_${l}.json`); out.add(`voice_${l}.wav`); }
  else { out.add('voice_en.json'); out.add('voice_en.wav'); }
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
    const r = await fetch(base + f, { cache: 'no-store' });
    if (!r.ok || (r.headers.get('content-type') ?? '').includes('text/html')) continue;
    const buf = await r.arrayBuffer();
    files.set(f, buf);
    takeText(f, buf);
  }
  await build();
}

if (project) {
  void loadProject(project);
  // Pick up edits to the project's script while the page is open.
  setInterval(() => void loadProject(project, true), 1500);
}

// ---- Export ----

async function exportOne(m: Movie) {
  const blob = await exportMp4(m, {
    files, captions: captionsBox.checked,
    onProgress: (u) => { status.textContent = `Exporting "${m.lang}": ${Math.round(u * 100)}%`; },
  });
  const base = `${m.title.replace(/[^\w\- ]/g, '').trim() || 'video'}_${m.lang}`;
  // The video, its subtitle file for YouTube, and the chapter list for the description.
  const out: [string, Blob][] = [[`${base}.mp4`, blob]];
  if (m.narration.lines.length) out.push([`${base}.srt`, new Blob([toSrt(m.narration)], { type: 'text/plain' })]);
  const chapters = chapterList(m);
  if (chapters.text) out.push([`chapters_${m.lang}.txt`, new Blob([chapters.text], { type: 'text/plain' })]);
  for (const [name, b] of out) {
    if (import.meta.env.DEV) await fetch(`/__save?name=${encodeURIComponent(name)}`, { method: 'POST', body: b });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
  }
  return out.map(([n]) => n);
}

async function runExport(all: boolean) {
  if (!movie || !script) return;
  if (typeof VideoEncoder === 'undefined') { status.textContent = 'This browser cannot make videos (no WebCodecs). Use Chrome or Edge.'; return; }
  exportBtn.disabled = exportAllBtn.disabled = true;
  setPlaying(false);
  const saved: string[] = [];
  try {
    const list = all ? movie.languages.map((l) => compile(l)) : [movie];
    for (const m of list) saved.push(...(await exportOne(m)));
    status.textContent = `Saved ${saved.join(', ')}`;
  } catch (err) {
    status.textContent = `Export failed: ${(err as Error).message}`;
    console.error(err);
  }
  exportBtn.disabled = false;
  exportAllBtn.disabled = (movie?.languages.length ?? 0) < 2;
}

exportBtn.onclick = () => void runExport(false);
exportAllBtn.onclick = () => void runExport(true);

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
