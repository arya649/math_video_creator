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

## Stage 4: geometry world (built)

- The `geometry` world: a figure that depends on itself, worked out afresh
  at every moment, so dragging a point keeps every construction true.
- Points, segments, lines, rays, circles (three ways), polygons, triangles
  (any, right, equilateral, isosceles); corners and sides by name.
- `construct`: midpoint, perpendicular, parallel, bisector (segment or
  angle), intersection, foot, reflect_point, tangent, circumcircle,
  incircle, centroid, orthocenter, circumcenter, incenter, a point on a
  shape; compass steps for midpoint, bisector and perpendicular.
- `angle` (live sizes, names, arcs, right angles), `equal`, `measure`.
- `drag` (to a place, along a path, along a shape).
- `translate`, `rotate`, `reflect`, `enlarge`, with ghosts and guide lines.
- `cut` (sectors, strips, grid, along lines) and `rearrange_pieces` (strip,
  row, stack, places).
- Scene settings: squared paper, numbers, degrees or radians, decimals.
- A `geometry` sample project.

## Stage 5: teaching tools and graphics (built)

- `wait`: the whole video, voice included, holds still with a countdown;
  subtitles, chapters, music and sounds all move on by the wait.
- `question` (choices, hint half way through the hold, pause-and-try
  countdown) and `answer` (the right choice lit, or written out, with a
  reason).
- `mistake` (stamped, reason, put right), `tick`, `cross`.
- `definition`, `theorem`, `rule`, `formula`, `tip` cards; `step_counter`;
  `recap` built from everything marked `key` (or one chapter's); `compare`.
- `card` (counting number, stacking, a dotted line to the sheet), `image`
  (frames, tones, slow moves, captions, on the sheet, gliding), `counter`
  (Indian or international grouping by language), `chips`, `table`, `chart`
  (bar, line, pie, dot), `label` (follows moving points), `credits`.
- Maths checks: every step of `steps` and `work` compared with the one
  before at random values (equal expressions, or equations with the same
  solutions).
- Teaching checks: slow start, nothing moving, too much at once, fast speech,
  working without reasons, long videos without a question or recap, words
  off the frame.
- 33 more catalogue entries; a `teaching` sample project.

## Stage 6: counting world (built)

- The `counting` world, with a number line from the start if wanted, and a
  table-top with shadows.
- Number lines whose marks and numbers fit as they zoom (fractions too);
  `jump` (single or repeated hops), `interval` (open and closed ends, to
  infinity), `point_on_line`, `zoom_line`.
- `dots` (dots, squares, stars, apples, coins, people, balls, hearts; rows
  or arrays), `group_items`, `count_items`, `tally`.
- Base-ten `blocks` and `regroup` (carry and borrow).
- `fraction` as a bar, pie, grid or line; `split`, `combine`, `line_up`.
- Chance that lands where the script says: `coin`, `dice`, `spinner`,
  `cards`; seeded `random` throws with running tallies.
- Probability `tree` (by level or by path, outcomes with their chances,
  every path named for highlighting) and `sample_space` grids with lit
  events.
- `highlight` on a group lights every member.
- 37 more catalogue entries; a `counting` sample project in English and
  Hindi.

## Stage 7: space world (next)

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
- Film clips in `image` are not built yet; pictures are.
- Words (not maths) cannot be morphed; write them as `\text{...}` inside
  maths to morph them.
