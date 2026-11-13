---
name: math-video-engine
description: What the Math Video Engine can do and how to write its script.json. The engine turns one JSON script (narration lines plus scenes of timed beats) into a maths explainer video in the style of 3Blue1Brown, in any number of languages, with equations that change step by step, graphs, geometry that stays true when dragged, counting and chance, 3D solids and surfaces, fractals and simulations, teaching tools, a mascot, captions, voice and export to MP4 for YouTube. Use this whenever someone asks what the engine can do, wants to write, extend, translate or fix a script.json for it, asks which action, world, style, transition or camera shot to use, turns catalogue IDs (such as eq:steps, graph:tangent, look:style-chalk) into JSON, or gets an error or warning from the engine. Hosted at mathvideocreator.vercel.app.
---

# Math Video Engine

The engine reads **one JSON script** and makes a video from it. People write the script however they like,
by hand, with help, or by converting their own notes. This skill explains what the engine can do and how the
JSON is written, so the script you help with works the first time.

`references/script-reference.md` is the engine's full manual and the only source of truth: every key, value and
action is listed there with its options. Use only names it lists. A misspelt *setting* is ignored with a
warning; a misspelt *name* (action, world, theme, shot) stops the build with a message suggesting the nearest
word. When something is not in the manual, say plainly that the engine can't do it and offer the closest thing.

`examples/` holds complete, working scripts (one per world, plus teaching, wonders, sound) to copy from.

## Using the engine

- Hosted: **https://mathvideocreator.vercel.app**. Open a script (and every file it names) with **Open script
  files**, or drop them on the picture. Samples: `?project=demo`, `graphs`, `geometry`, `counting`, `space`,
  `teaching`, `wonders`, `sound`.
- The **catalogue** (`/catalog.html`) plays every option as a live example with an ID such as `eq:steps`,
  `graph:tangent`, `look:style-chalk`, `transition:morph`. The words under each example are the JSON to write.
  The ID groups and the manual sections they map to are in the table at the top of the manual.
- The page lists problems (which stop the build) and warnings (worth reading: maths checks, teaching checks,
  YouTube chapter rules) under the picture. **Export MP4** writes the video, its `.srt`, the chapter list and
  the thumbnail; **Export all languages** does it once per language.

## The shape of a script

```json
{
  "title": "The square of a sum",
  "languages": ["en", "hi"],
  "theme": "night",
  "symbols": { "a": "blue", "b": "yellow" },
  "lines": [
    { "en": "Take any two numbers, {ab}a and b.", "hi": "कोई भी दो संख्याएँ लीजिए, {ab}a और b." },
    { "en": "What is their sum, {sq}squared?", "hi": "उनके योग का {sq}वर्ग क्या है?" }
  ],
  "scenes": [
    {
      "name": "Opening",
      "chapter": { "en": "The question", "hi": "प्रश्न" },
      "world": "board",
      "beats": [
        { "at_cue": "ab", "do": "write", "id": "ab", "tex": "a,\\; b", "size": "large" },
        { "at_cue": "sq", "do": "steps", "who": "ab", "to": "(a+b)^2" }
      ]
    }
  ]
}
```

- **`lines`** are what is said, numbered from 1. One language: plain strings. Several: an object per line with
  every language. `{name}` marks a **cue**, the exact moment a beat can land on (same cues in every language).
  Maths in lines is written `$x^2$`; the voice reads it aloud and captions show it.
- **`scenes`** run one after another. Each picks a **world**, may set a look, and holds **beats**. Every scene
  after the first needs `start_line`, `start_cue` or `start`.
- **Beats** are the moments: a start time plus `do` (an action) and/or `camera` (a shot). A thing gets an `id`
  when it first appears and is named by it afterwards (`"who": "ab"`, `"position": { "below": "ab" }`, parts
  like `"ab.2ab"`).
- Any text anywhere can be one string, or an object per language, or `"@name"` pointing to `strings`.

## Timing (manual §13)

Beats are timed to the narration, so the picture follows the voice whatever its speed or language:

| Key | Starts the beat |
| --- | --- |
| `at_line: 3` | when line 3 starts (`at_word: 2` with it: at its second word) |
| `at_cue: "sq"` | at the `{sq}` mark |
| `then: true` | when the previous beat ends; `after: "id"` when that beat ends; `with: "id"` together with it |
| `at: 4.5` | seconds from the scene's start (for videos without narration) |

Adjust with `offset` (seconds), `duration`, `until_line`, `until_cue`, `speed` (`slow`, `quick`, a number).
`"do": "wait"` holds the whole video (voice too) still for the viewer; `question` makes its own wait.

## Positions (manual §12)

A screen place (`"center"`, `"top_left"`, …), an id (`"eq1"`), a named spot (`"eq1.right"`, `"tri.A"`), a
relation (`{ "below": "eq1", "align": "=" }`), a point on axes (`{ "x": 2, "y": 3 }`), on a graph
(`{ "on": "f", "x": 2 }`), on a number line (`{ "on": "line", "x": 0.75 }`), or sheet numbers `[3, -1.5]`
(`[x, y, z]` in space). The frame at rest is 16 × 9 sheet units with 0, 0 in the middle. `at` is always a
time; a place is always `position`.

## What it can do

**Five worlds** (`"world"` on a scene). Everything in "every world" below works in all of them.

| World | For | Its own actions (manual section) |
| --- | --- | --- |
| `board` (default) | algebra, working, proofs in symbols | — (equations, shapes and the rest) |
| `graph` | functions, calculus, vectors, matrices, complex numbers | `axes`, `plot`, `value`/`set`, `point`, `slide`, `mark`, `tangent`, `secant`, `area`, `refine`, `asymptote`, `limit`, `shift_graph`, `table_of_values`, `vector`, `add_vectors`, `field`, `transform_plane`, `rescale`, `sonify`, `fractal`, `domain_color` (§18, §22) |
| `geometry` | constructions, theorems, transformations | `point`, `segment`, `line`, `ray`, `circle`, `polygon`, `triangle`, `construct` (15 kinds), `angle`, `equal`, `measure`, `drag`, `translate`, `rotate`, `reflect`, `enlarge`, `cut`, `rearrange_pieces` (§19) |
| `counting` | number sense, fractions, chance | `number_line`, `jump`, `interval`, `point_on_line`, `zoom_line`, `dots`, `group_items`, `count_items`, `tally`, `blocks`, `regroup`, `fraction`, `split`, `combine`, `line_up`, `coin`, `dice`, `spinner`, `cards`, `tree`, `sample_space` (§20) |
| `space` | 3D surfaces, solids, volumes | `axes3d`, `surface`, `solid` (12 shapes or a `.glb` model), `revolve`, `slice`, `stack_slices`, `net`, `vector3d`, `point3d`, `plane3d`, `line3d`, `curve3d` (§21) |

**In every world:**

- **Equations** (§15): `write` (LaTeX in `tex`, or plain maths in `math`), `steps` (the equation changes;
  matching symbols glide), `work` (a column of working with reasons), `solve` (the engine finds the steps and
  reasons itself), `evaluate`, `rearrange`, `highlight`, `box`, `cancel`, `brace`, `label_part`, `substitute`,
  `pull_out`, `color`, `swap`. Every step is checked for being equal to the one before.
- **Shapes and movement** (§16, §17): `draw` (lines, arrows, circles, polygons, braces, SVG drawings …),
  `move`, `turn`, `scale`, `flip`, `wobble`, `morph`, `copy`, `group`, `show`, `hide`, `remove`, `focus`,
  `pointer`, `trace_path`.
- **Teaching** (§23): `question` (choices, hint, pause-and-try countdown) and `answer`, `mistake`, `tick`,
  `cross`, `definition`, `theorem`, `rule`, `formula`, `tip`, `step_counter`, `recap` (gathers everything
  marked `"key": true`), `compare`, `wait`.
- **On-screen graphics** (§25): `title`, `text`, `card`, `counter`, `chips`, `table`, `chart`, `label`,
  `credits`, `image`, `clear`.
- **Wonders** (§22): `fractal` (Mandelbrot, Julia … and Sierpinski, Koch, tree, dragon), `fourier`,
  `simulation` (pendulum, projectile, spring, random walk, π by darts, Galton board, orbits, heat, wave, game of
  life, sorting), `particles`.
- **Mascot** (§24): list `characters` at the top (`blob`, `pebble`, `owl`, `robot`, or your own cut-out
  pictures), then `enter`, `look`, `react`, `say`, `talk`, `gesture`, `leave`.
- **Sound** (§27): `music` with fades and dipping under the voice, `sound` beats, the engine's own small sounds.

**Look** (§5, §6): `theme` (`night`, `board`, `paper`, `white`, `grid`, `deep`, `sunny`, or an object that
changes parts of one); `style` (`vector`, `chalk`, `sketch`, `whiteboard`, `neon`, `blueprint`, `paper`,
`solid`) for the video, a scene or one beat; `symbols` gives each letter a colour everywhere; `grade`, `glow`,
`depth`, `camera_style`; scene `background` (plain, gradient, grid, dots, lined, a picture).

**Camera** (§26): a beat's `camera` is a shot or list of shots: `rest`, `frame`, `zoom`, `pan`, `follow`,
`tilt` (the sheet in perspective; things with `lift` stand off it), `fly`; in space `orbit` and `look`.

**Between scenes** (§9): `transition`: `cut`, `fade`, `black`, `slide` (`_left`, `_up`, `_down`), `wipe`,
`morph` (same ids reshape into the next scene), `fly`, `zoom` (with `into`), `rub`, `page`. `keep` carries
things over; `chapter_card` shows the chapter's name.

**Voice and languages** (§7, §8): one script makes the video in every language listed. The voice is either
made with ElevenLabs (`voice` per language, with the creator's key) or the creator's own recording (`audio`,
optionally with `subtitles`). Without either, timing is estimated from the words. Captions are karaoke or
plain, on by default.

**YouTube** (§28): `chapter` names on scenes give the chapter list; `thumbnail`; `end_screen`; `format`
(`landscape`, `landscape_4k`, `square`, `reel`); `motion_blur`.

**Not built yet** (say so if asked): film clips in `image` and backgrounds, pictures as counted things, voice
services other than ElevenLabs.

## Writing the JSON well

- Valid JSON: double quotes, no trailing commas, no comments. **Backslashes in LaTeX are written twice**
  (`"\\frac{a}{b}"`).
- Write the lines first; they drive all timing. Put a cue wherever a beat must land exactly.
- Keep one idea per scene; start a new scene when the subject or world changes.
- Give ids to everything you will refer to again; ids are unique within a scene and only exist after they
  appear (or are carried in with `keep`).
- Name parts of equations with `\part{name}{...}` to highlight, cancel or brace them by name.
- Mark results to remember with `"key": true`; `recap` collects them.
- Files the script names (pictures, music, recordings, SVGs, models) must be opened with it under exactly
  those names, with no folders in the name.
- Read the warnings: maths checks flag steps that don't follow, teaching checks flag slow starts, still
  stretches and crowded moments.

The full list of rules is the last section of the manual. For anything beyond this page, read the section the
tables above point to.
