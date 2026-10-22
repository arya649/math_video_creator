# Roadmap

The full engine is described in `docs/SCRIPT_REFERENCE.md`; parts not built
yet are marked "(coming)" there. This file tracks the stages.

## Stage 1: foundation and equations (built)

- Script compiling, plain-English problems and warnings, did-you-mean.
- Every language from one script: `lines` per language, cue marks, `@strings`,
  text per language anywhere; one video per language.
- Narration timing estimated from the words; your own recording with its
  subtitle file; voice times files.
- Timing by line, word, cue, `then`, `after`, `with`, seconds.
- The `board` world, seven themes, colours tied to symbols, paper and
  background styles.
- Equations: `write`, `steps` (symbol matching and morphing, arcs across `=`,
  reasons), `work`, `rearrange`, `highlight` (8 ways), `box`, `cancel`,
  `brace`, `label_part`, `substitute`, `pull_out`, `color`, `swap`.
- Shapes, moving, morphing, focus, groups.
- `title`, `text`, `clear`; karaoke and plain captions with a switch; muted
  preview.
- Camera: `rest`, `frame`, `zoom`, `pan`, `follow`.
- Transitions: `cut`, `fade`, `black`, `slide`, `wipe`.
- MP4 export with the narration's sound, `.srt` subtitles and the chapter list.
- The catalogue page (113 entries, each rendered by the engine).

## Stage 2: graph world (next)

Axes and number planes, `plot` (functions, parametric, polar, implicit,
inequalities), named values and sliders, points, `mark`, `tangent`,
`secant`, `area` and rectangles, `shift_graph`, vectors, fields,
`transform_plane`.

## Stage 3: voice and sound

Making the voice with ElevenLabs (exact word times), music with ducking,
engine-made sound effects, `sound`, Export all.

## Stage 4: geometry world

Points, constructions with compass arcs, angles, marks, `drag`,
transformations, cut and rearrange.

## Stage 5: teaching tools and graphics

`question`, `answer`, `mistake`, `tick`/`cross`, definition cards,
`step_counter`, `recap`, `compare`; `card`, `image`, `counter`, `chips`,
`table`, `chart`, `label`, `credits`; `wait`; maths checks (SymPy or
Compute Engine) and teaching checks.

## Stage 6: counting world

Number lines, dots, blocks, fractions, coins, dice, spinners, trees,
sample spaces.

## Stage 7: space world

3D axes, surfaces, solids, revolve, slices, nets.

## Stage 8: styles, camera and wonders

Chalk, sketch, whiteboard, neon, blueprint, paper and solid styles; `tilt`,
`fly`; `morph`, `fly`, `zoom`, `rub`, `page` transitions; fractals, domain
colouring, Fourier drawings, simulations, particles; the mascot; thumbnail,
end screen, parallel rendering for long videos.

## Limits worth knowing

- Word times without a made voice are estimated from word lengths: close,
  not exact.
- Browsers without an H.264 encoder (some Linux Chromium builds) make VP9
  video inside the MP4. Chrome and Edge on Windows and Mac make H.264.
- Words (not maths) cannot be morphed; write them as `\text{...}` inside
  maths to morph them.
