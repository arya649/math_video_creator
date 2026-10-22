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

## Stage 2: graph world (built)

- The `graph` world with its own axes; extra axes; number planes; complex
  planes; grids, pi ticks, polar grids, log scales, square units; `rescale`.
- `plot`: functions of x, parametric and polar curves, implicit curves,
  shaded inequalities, labels, breaks at jumps.
- Named values with sliders or readouts, `set`, and `\value{a}` inside maths.
- `point` (drops, coordinates, trace), `slide`, `mark` (roots, max, min,
  turning, intersections, y-intercept, inflection), `tangent` (slope,
  rise-and-run triangle), `secant` closing in, `area` (between graphs,
  rectangles, live value), `refine`, `asymptote`, `limit`, `shift_graph`,
  `table_of_values`.
- `vector`, `add_vectors`, `field` (arrows, flow, stream lines),
  `transform_plane` (matrix, complex function, any map, basis arrows, ghost,
  undo).
- 51 more catalogue entries; a `graphs` sample project (`?project=graphs`).

## Stage 3: voice and sound (built)

- The voice two ways, per language: the creator's own recording, or a voice
  made with ElevenLabs.
- The ElevenLabs key from the script, a key file, or the page's key box.
- Made voices: line by line with exact character times, put together with
  the script's pauses, kept as `voice_<lang>.wav` and `.json`, every line
  cached in the browser so nothing is paid for twice.
- Own recordings timed by a subtitle file, exactly by ElevenLabs forced
  alignment (**Time my recording**), or by the estimate fitted to the
  recording's length.
- Maths in lines read aloud (English and Hindi), `say` for pronunciations.
- Music with fades, loops and ducking under the voice; `sound` files; the
  engine's own sounds (pen, chalk, pop, click, chime, low, whoosh, swell).
- The preview plays the full mix; Export all languages.

## Stage 4: geometry world (next)

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
