# Developer guide

For anyone working on the engine's code. If you only want to write video
scripts, read `docs/SCRIPT_REFERENCE.md` instead, and use the catalogue page
(`catalog.html`) to see every option.

| Document | For |
| --- | --- |
| `docs/SCRIPT_REFERENCE.md` | Script writers (people and AIs): every option the engine accepts, built and coming. |
| `docs/DEVELOPER_GUIDE.md` | This file: how the code works and how to extend it. |
| `ROADMAP.md` | What is built, stage by stage, and what comes next. |

---

## 1. What the engine is

A browser application (TypeScript, Canvas 2D, MathJax, Vite) that turns a
JSON script into a finished maths explainer video: equations that are
written on and change step by step, shapes, camera moves, captions, and the
narration's sound, in any language. Every frame is a pure function of time,
so the same script always gives the same video.

---

## 2. Getting started

Needs Node.js 22 or later.

```bash
npm install
npm run dev          # http://localhost:5190/?project=demo
```

| Command | Does |
| --- | --- |
| `npm test` | The tests (vitest, in Node, no browser). |
| `npm run typecheck` | TypeScript check only. |
| `npm run build` | Type-checks and builds the static site into `dist/` (`index.html`, `catalog.html`). |
| `node scripts/stills.mjs <project> <dir> <t> ...` | Renders frames of a project in headless Chromium (dev server running). |
| `node scripts/catalog-sheet.mjs <dir> [filter]` | Renders every catalogue entry into contact sheets. |
| `node scripts/export-test.mjs <project> <seconds> <out.mp4>` | Exports the first seconds of a project, to check the MP4 path. |

Pages:

- `/?project=<name>`: the engine with a project from `public/projects/<name>/`.
  The page reloads the script by itself when `script.json` changes.
- `/catalog.html`: the catalogue of every built option.

While the dev server runs, `POST /__save?name=<file>` saves into `renders/`
(a plugin in `vite.config.ts`). Exports and `engine.still()` use it.

---

## 3. Where things are

```
index.html, src/main.ts        The engine page: opening files, preview, export
catalog.html, src/catalog/     The catalogue page (entries.ts lists every example)
src/engine/
  movie.ts       Compiles a script: languages, narration, scenes, beat timing, transitions
  actions.ts     The action registry and helpers every action uses
  actions/       The actions, by kind: equations, shapes, motion, graphics
  world.ts       SceneWorld: what exists in a scene; placing things by words
  thing.ts       Thing: anything on screen; Glyph: one outline
  tex.ts         Maths to outlines (MathJax SVG), plain maths to LaTeX (math.js)
  match.ts       Equation steps: which symbol becomes which; morphing outlines
  geom.ts        Points, SVG paths, lengths, resampling, transforms
  shapes.ts      Lines, arrows, circles, braces, hand-drawn loops
  text.ts        Words with $maths$ laid out in lines
  narration.ts   Lines, cues and word times: estimated, from subtitles, or a made voice
  camera.ts      The 2D camera: shots, blending
  render.ts      Renderer: draws one frame on a canvas (Canvas 2D)
  export.ts      MP4 export (WebCodecs + mediabunny), sound mixing
  chapters.ts    The YouTube chapter list
  themes.ts      Themes and colour names
  color.ts       Mixing colours
  util.ts        ScriptError, did-you-mean, easing, seeded random numbers
public/projects/ Sample projects
tests/           Unit tests (Node)
scripts/         Headless-browser tools for checking renders
```

---

## 4. How a frame is made

1. **Compile.** `compileMovie(script, options)` picks the language: every
   text given per language (`{ "en": ..., "hi": ... }`) and every `@string`
   is replaced by that language's words. It times the narration
   (`narration.ts`), then for each scene builds a `SceneWorld` and its
   beats, in the order written. Each beat's start comes from `at_line`,
   `at_cue`, `then` and the rest; its action's `build(ctx)` makes Things and
   adds `Action`s with `ctx.act`. Errors are `ScriptError`s that say where
   in the script they are.

2. **Put the scene at time t.** `CompiledScene.applyState(t)` resets every
   Thing to its `base`, then runs every Action that has started, in time
   order, with `u` (0 to 1 through the action). Nothing carries over from
   the frame before, so any moment can be drawn directly.

3. **Draw.** `Renderer.render(t)` asks the movie for its layers (one scene,
   or two during a transition), draws each scene's Things through the
   camera, the on-screen Things without it, then the captions.

4. **Export.** `exportMp4` draws every frame onto an `OffscreenCanvas` and
   encodes it with the narration's sound.

---

## 5. Key ideas

**Everything is outlines.** A Thing is a list of Glyphs: outlines in sheet
units, y up, relative to the Thing's origin. Letters from MathJax, lines,
circles and braces are all Glyphs, so writing on, morphing, colouring and
highlighting work the same for all of them. (Words, `kind: 'text'`, are the
exception: they are drawn with `fillText` so every script is shaped by the
browser.)

**Two copies of a Thing.** `build` is what the compiler knows so far, used
to place later things ("below eq1") and plan changes. `state` is the frame
being drawn, reset from `base` every frame. An action that changes a Thing
for good (a step, a move) updates `build` at compile time and sets `state`
in `apply`.

**Equation steps.** `match.ts` pairs the symbols of the old and new lines:
named parts first, then the longest shared run, then the same symbol moved,
then neighbours (`+5` becoming `-5`). Paired symbols morph (the same shape
just moves; different shapes are resampled to the same number of points);
the rest fade. Pieces crossing the `=` arc over or under it.

**Sheet units.** The frame at rest is 9 units on its short side (16 x 9 in
landscape). Line widths are in design pixels for a 1080-pixel short side.

---

## 6. Recipes

Whatever you add, also do the last step (reference and catalogue), or a test
will fail.

### A new action

1. In the right file under `src/engine/actions/`, call
   `registerAction('name', { summary, params, required, worlds?, build(ctx) { ... } }, ['alias'])`.
2. Read settings from `ctx.spec`; throw `ScriptError` with
   `${ctx.where}.key` for anything wrong. Use the helpers in `actions.ts`
   (`num`, `str`, `color`, `sizeOf`, `choice`, `things`, `makeMath`,
   `arrive`) and `world.point` / `world.placeAt` for positions.
3. Do all the work in `build`; add Actions with `ctx.act({ start, duration, apply(u, t) })`.
   `apply` only sets values from `u` and `t`: no state kept between frames.
4. Return `{ end, thing }` so `then`, `after` and `morph` work.

### A new shape, theme or transition

- Shapes: add to `SHAPES` and `make()` in `actions/shapes.ts`.
- Themes: add to `THEMES` in `themes.ts`.
- Transitions: add to `TRANSITIONS` in `movie.ts` and to `transitionLayers`.

### A new world

Add it to `WORLDS_BUILT` in `movie.ts` once it works, give its actions
`worlds: ['name']`, and remove "(coming)" from the reference.

### Always: reference and catalogue

- **Reference** (`docs/SCRIPT_REFERENCE.md`): describe the option with a
  neutral example, and take "(coming)" off it. `tests/reference.test.ts`
  checks that every action, alias and word the engine accepts is in it.
- **Catalogue** (`src/catalog/entries.ts`): add an example. A test compiles
  every entry, checks IDs are unique and that every ID group is explained
  in the reference.

---

## 7. Rules for the code

- **Same input, same video.** No `Math.random()` or clock time in anything
  that draws; use `rng(seed)` from `util.ts`.
- **`apply` is cheap and pure.** Build everything once in `build`.
- **Explain mistakes in plain English.** Say what was wrong and what would
  be right; use `didYouMean` for names.
- **General options only.** Add capabilities, not looks copied from one
  video. The reference lists what exists, with neutral examples.
- **Tests run in Node.** Anything that needs a canvas or `document` must be
  guarded or made lazily (see `text.ts`).
- **Fonts before measuring.** Text is measured when a script compiles, so
  the page waits for its fonts first (`fontsReady` in `main.ts`).

---

## 8. Checking your work

- `npm test` and `npm run typecheck`.
- `node scripts/catalog-sheet.mjs <dir>` and look at the sheets.
- In the engine page's console: `engine.draw(t)` and `engine.still(name, t)`.
- Watch real renders: tests prove the rules, not the look.

---

## 9. Licences

| Item | Licence |
| --- | --- |
| MathJax | Apache-2.0 |
| math.js | Apache-2.0 |
| mediabunny | MPL-2.0 (the library's own files only) |
| Poppins, Noto Sans Devanagari (`@fontsource`) | SIL Open Font Licence |
| Vite, Vitest, TypeScript, playwright-core (dev only) | MIT / Apache-2.0 |
