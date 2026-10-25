# Script reference

This is the complete reference for writing a video script for the Math Video
Engine. A script is one JSON file. It says what is said, what appears and
when; the engine works out sizes, layout, movement, camera, sound and
drawing.

It describes what the engine can do and how to ask for it. Every option the
engine accepts is listed here; anything not listed does not exist. Which
options to use (colours, styles, timing, layout) is up to whoever writes the
script.

To see what each option looks like, open the catalogue page of the engine
(`catalog.html`, linked from the engine's main page as "Catalogue"). It shows
every option rendered by the engine itself, with the words to write for it.

### Catalogue IDs

Every entry in the catalogue has a short ID, such as `eq:steps`,
`graph:tangent` or `look:chalk`. A person planning a video looks through the
catalogue and writes notes using these IDs ("line 4: eq:cancel on the two
x's; scene 2 in look:chalk; end on teach:recap").

When notes name IDs, use the option each stands for, with the timing,
positions and names the notes ask for. An ID is its group, a colon, and the
option's name in lower case with dashes; the option itself is described in
the section named below.

| ID starts with | What it is | Section |
| --- | --- | --- |
| `scene:` | One of the five worlds, a background | 9, 10 |
| `look:` | A drawing style, theme, grade, glow, camera manner | 5, 6 |
| `voice:` | Narration, voices, languages, cues | 4, 7 |
| `eq:` | Writing and changing equations | 11, 15 |
| `shape:` | Lines, arrows, circles, polygons, braces | 16 |
| `move:` | Moving, morphing, copying, drawing attention | 17 |
| `graph:` | Axes, plots, points, tangents, areas, values that change | 18 |
| `plane:` | Grids being bent: matrices, complex functions | 18 |
| `geo:` | Geometry: constructions, angles, marks, transformations | 19 |
| `count:` | Number lines, dots, blocks, fractions, coins, dice, trees | 20 |
| `space:` | 3D: surfaces, solids, slices, nets | 21 |
| `wonder:` | Fractals, flows, simulations, Fourier drawings | 22 |
| `teach:` | Questions, mistakes, ticks, recaps, steps, definitions | 23 |
| `char:` | The mascot and what it can do | 24 |
| `text:` | Titles, text, cards, counters, tables, charts | 25 |
| `picture:` | Pictures and film clips | 25 |
| `shot:` | A camera move | 26 |
| `transition:` | A change from one scene to the next | 9 |
| `sound:` | Music, sound effects, sonification | 4, 27 |
| `format:` | The shape and size of the video, chapters, thumbnail | 4, 28 |


## What works today

The engine is being built in stages. This reference describes all of it;
the parts not built yet are marked **(coming)** in the contents and in
their headings, and the engine says so plainly if a script uses them.

| Built | Coming |
| --- | --- |
| All five worlds: `board`, `graph`, `geometry`, `counting`, `space`; themes; colours tied to symbols; backgrounds (plain, gradient, grid, dots, lined) | Drawing styles other than `vector`; pictures as backgrounds |
| Narration `lines` in every language, cue marks, `@strings`; a voice made with ElevenLabs, or the creator's own recording (timed by a subtitle file, exactly with ElevenLabs, or by an estimate fitted to it) | Voice services other than ElevenLabs |
| Captions (karaoke and plain, with the on/off switch), muted preview | |
| Timing: `at_line`, `at_word`, `at_cue`, `then`, `after`, `with`, `at`, `offset`, `duration`, `until_line`, `until_cue`, `speed`; `wait` (the whole video holds still) | |
| Equations: `write`, `steps`, `rearrange`, `work`, `highlight`, `box`, `cancel`, `brace`, `label_part`, `substitute`, `pull_out`, `color`, `swap`; every step checked | `solve`, `evaluate` |
| Graphs: axes, number planes, `plot` (functions, parametric, polar, implicit, inequalities), values and sliders, points, `mark`, `tangent`, `secant`, `area`, `refine`, `asymptote`, `limit`, `shift_graph`, `table_of_values`, vectors, fields, `transform_plane`, `rescale` | |
| Geometry: points, segments, lines, rays, circles, polygons, triangles; 15 constructions (with compass steps); angles, equal marks, measurements; `drag`; `translate`, `rotate`, `reflect`, `enlarge`; `cut` and `rearrange_pieces` | |
| Shapes: every shape of `draw` except drawing an svg file | `path` from an svg file |
| Moving: `move`, `turn`, `scale`, `flip`, `wobble`, `morph`, `copy`, `group`, `show`, `hide`, `remove`, `focus` | `pointer`, `trace_path` |
| Counting: number lines (`jump`, `interval`, `point_on_line`, `zoom_line`), `dots`, `group_items`, `count_items`, `tally`, `blocks`, `regroup`, `fraction`, `split`, `combine`, `line_up`, `coin`, `dice`, `spinner`, `cards`, `tree`, `sample_space` | Pictures from files as counted things |
| Space: `axes3d`, `surface`, `solid` (12 shapes), `revolve`, `slice`, `stack_slices`, `net`, `vector3d`, `point3d`, `plane3d`, `line3d`, `curve3d`; four lights; the `orbit` and `look` shots | 3D models from files; `tilt` of flat scenes |
| Teaching: `question` and `answer` (with the pause-and-try countdown), `mistake`, `tick`, `cross`, `definition`, `theorem`, `rule`, `formula`, `tip`, `step_counter`, `recap`, `compare` | |
| On-screen graphics: `title`, `text`, `clear`, `card`, `image` (pictures), `counter`, `chips`, `table`, `chart`, `label`, `credits` | Film clips in `image` |
| Camera: `rest`, `frame`, `zoom`, `pan`, `follow` | `tilt`, `fly`, `orbit`, `look`; `lift` |
| Transitions: `cut`, `fade`, `black`, `slide` (all four ways), `wipe` | `morph`, `fly`, `zoom`, `rub`, `page`; `keep` |
| Export to MP4 (one language, or all) with narration, music, sound files and the engine's own sounds, with its `.srt` subtitle file and YouTube chapter list; script problems and warnings; maths and teaching checks | `sonify`; thumbnail and end screen |

Contents:

1. How a script is built
2. Files: what to supply and how they are found
3. Steps to write a script
4. Top-level settings
5. Drawing styles and themes
6. Colours that mean something
7. Narration, voices and languages
8. Captions
9. Scenes and transitions
10. The five worlds
11. Writing maths
12. Where things go
13. Timing: when things happen
14. Objects, ids and named spots
15. Actions: equations
16. Actions: shapes
17. Actions: moving and drawing attention
18. Actions: graphs and planes
19. Actions: geometry
20. Actions: number lines, counting, fractions and chance
21. Actions: 3D
22. Actions: wonders (fractals, flows, simulations)
23. Actions: teaching
24. The mascot (coming)
25. On-screen graphics
26. Camera
27. Sound
28. Long videos: chapters, thumbnail, end screen (thumbnail and end screen coming)
29. Checks: maths, teaching, muted viewing
30. Names you can use
31. Rules

---

## 1. How a script is built

```
script
├── title, theme, style, format, languages, voice, symbols   (the whole video)
├── lines                                                    (what is said, numbered)
└── scenes  (one after another)
    ├── world: board / graph / geometry / counting / space   (which kind of world)
    ├── style / background / camera_style                    (how that world looks)
    ├── place                                                (things there from the start)
    └── beats                                                (what happens, and when)
        ├── a time:   at_line / at_cue / at_word / at / then / after
        ├── do:       one action (write, steps, plot, construct ...)
        └── camera:   one shot, or a list of shots
```

Five kinds of world:

| World | What it is | Use it for |
| --- | --- | --- |
| `board` | A clean board for writing: equations, working, words and simple shapes. | Algebra, worked solutions, proofs in symbols, explaining ideas. |
| `graph` | A board with a set of axes, or a full number plane, ready to draw on. | Functions, equations as curves, calculus, vectors, matrices, complex numbers. |
| `geometry` | A board for figures that are built step by step and stay true when moved. | Constructions, angles, theorems, transformations, proofs with pictures. |
| `counting` | A board for things that are counted, split and shared, with an optional number line. | Number sense, place value, fractions, chance and probability. |
| `space` | A 3D world with axes, light and a camera that can circle round. | Surfaces, solids, 3D vectors, volumes. |

There are these five and no others. Equations, words, shapes, teaching
tools and on-screen graphics can be used in every world; each world adds the
actions of its own subject (section 10).

On top of every world sit the **on-screen graphics**: titles, text, cards,
counters, tables and captions (section 25). They stay still while the camera
moves.

Things are named by an `id` the first time they appear, and referred to by
that name afterwards. Positions are words wherever possible: `"center"`,
`"below eq1"`, `"tri.A"`, a point on a graph.

---

## 2. Files: what to supply and how they are found

A video is a script plus the files it names:

| File | Named in the script by | Notes |
| --- | --- | --- |
| Script | (the `.json` file itself) | Required. |
| Narration audio | `audio` (your recording), or `voice` (made by the engine) | mp3, wav, m4a, ogg. See section 7. |
| Subtitles | `subtitles` per language | Only when you supply your own recording instead of a made voice. |
| Music, sound effects | `music` at the top, or `"file"` in a `sound` action | mp3, wav, m4a, ogg. |
| Pictures | `"file"` in an `image` action, or `"image"` in a background | png, jpg, webp or svg. |
| Film clips | the same places as pictures | mp4 or webm. Played silently. |
| Drawings to trace | `"file"` in `fourier` or `draw` | svg. |
| 3D models | `"models"` at the top (section 21) | `.glb` files. |
| Fonts | `"fonts"` at the top | ttf, otf, woff2. Only for a font not included. |

Two ways to give the engine the files:

- **Open script files** button: select the script and every file it names
  **in one go** (or drag them all onto the picture). Files are matched by
  name, so the names in the script must be exactly the file names.
- A project folder: put them all in `public/projects/<name>/` with the
  script called `script.json`, and open `?project=<name>`.

Use plain file names, with no folders: `"photo.jpg"`, not `"images/photo.jpg"`.

Voices made by the engine are kept as `voice_<language>.wav` with their
timings in `voice_<language>.json` (section 7). Open them with the script
next time. An ElevenLabs key can be opened as a file whose name ends in
`key.txt`.

---

## 3. Steps to write a script

1. Write what is said, as numbered `lines` (section 7). Put a cue mark such
   as `{solve}` at any moment something must happen exactly.
2. Pick the languages, a voice for each, a theme and a style.
3. Split the lesson into scenes. Start a new scene when the subject changes.
   Give each a `chapter` name where a long video needs one.
4. Decide which colour means what (`symbols`, section 6).
5. For each line, add beats that start `at_line` that line or `at_cue` a cue:
   what is written, drawn, moved, and what the camera does.
6. Mark the results worth remembering with `"key": true`; they build the
   recap.
7. Press **Make voice**, then preview: once normally, once muted.
8. Read the checks (section 29) and fix what they point out.

---

## 4. Top-level settings

```json
{
  "title": "Why the square of a sum is not the sum of squares",
  "theme": "night",
  "style": "vector",
  "format": "landscape",
  "languages": ["en", "hi"],
  "voice": { "en": { "voice": "Narrator A" }, "hi": { "voice": "Narrator B" } },
  "symbols": { "a": "blue", "b": "yellow" },
  "lines": [],
  "scenes": []
}
```

| Key | Required | Values | Meaning |
| --- | --- | --- | --- |
| `scenes` | yes | list | The scenes, in time order. |
| `lines` | no | list (section 7) | What the narrator says, numbered from 1, in every language. |
| `title` | no | text, or text per language | Name of the video; also the exported file name. |
| `languages` | no | list of language codes (section 30) | The languages to make the video in. The first is the main one. Default `["en"]`. |
| `voice` | no | object (section 7) | How the narration is spoken in each language. |
| `audio`, `subtitles` | no | a file, or a file per language | Your own recording, and its subtitle file if you have one (section 7). |
| `theme` | no | a theme name, or an object (section 5) | Colours and fonts of the whole video. Default `"night"`. |
| `style` | no | a style name (section 5) | How lines and letters are drawn. Default `"vector"`. |
| `symbols` | no | `{ symbol: colour }` (section 6) | Colours that mean something, used everywhere. |
| `format` | no | `"landscape"`, `"landscape_4k"`, `"square"`, `"reel"` | Frame shape. `landscape` = 1920×1080, `landscape_4k` = 3840×2160, `square` = 1080×1080, `reel` = 1080×1920. Default `landscape`. |
| `fps` | no | 24, 30, 60 | Frames a second. Default 60. |
| `captions` | no | `true`, `false`, or an object (section 8) | Captions of the narration on the picture. Default `true`. |
| `music` | no | a file, or a list of tracks (section 27) | Music under the voice. |
| `sounds` | no | `"none"`, `"soft"`, `"lively"` | Small sounds the engine adds by itself: chalk while writing, a soft pop as things appear, a whoosh on fast camera moves (section 27). Default `"soft"`. |
| `strings` | no | `{ name: text per language }` (section 7) | Words used on screen, kept in one place for translating. |
| `fonts` | no | list of `{ "name", "file" }` | Extra fonts. |
| `models` | no | list (section 21) | 3D model files. |
| `characters` | no | list (section 24) | Mascots used in this video. |
| `chapters` | no | `true`, `false` | Write the YouTube chapter list (section 28). Default `true`. |
| `thumbnail` | no | object (section 28) | The picture YouTube shows before the video plays. |
| `end_screen` | no | seconds | Keep the last seconds clear for YouTube's end-screen buttons (section 28). |
| `checks` | no | object (section 29) | Which checks to run. Default all. |
| `motion_blur` | no | 0 to 1 | Blur on fast movement in the exported video. Slows the export. |
| `duration` | no | seconds | Force the video length. Normally it is worked out from the voice and the beats. |

---

## 5. Drawing styles and themes

### Style: how things are drawn

The style decides how every line, letter and shape is drawn. The same script
can be made in any style; nothing else needs to change.

| Style | Look |
| --- | --- |
| `vector` | Clean, smooth lines and solid letters, drawn on as if by an invisible pen. The classic look of a maths explainer. Default. |
| `chalk` | Chalk on a blackboard: grainy strokes, a little dust as they are drawn, smudged when rubbed out. |
| `sketch` | Pencil and pen on paper: lines a little rough, as if drawn by hand, each slightly different. |
| `whiteboard` | Marker on a whiteboard, with a marker pen that draws each line as it appears. |
| `neon` | Glowing tubes of light on black. |
| `blueprint` | White lines on blue paper, with faint grid and construction marks. |
| `paper` | Shapes cut from coloured paper, with soft shadows and paper grain. |
| `solid` | Letters and shapes as solid raised objects, lit, casting shadows, seen with depth. |

A style brings a theme that suits it when the script does not choose one:
`chalk` the blackboard, `whiteboard` white, `sketch` and `paper` paper,
`neon` a deeper black, `blueprint` its own blue with a grid. A theme given in
the script always wins.

A scene can have its own `style`, and one object can too:

```json
{ "world": "board", "style": "chalk", "beats": [] }
{ "at_line": 3, "do": "write", "id": "big", "tex": "e^{i\\pi} + 1 = 0", "style": "neon" }
```

### Theme: colours and fonts

| Theme | Look |
| --- | --- |
| `night` | Near-black background, white lines, soft blue, yellow, green and red. The look most viewers know from maths explainers. Default. |
| `board` | Dark green blackboard, chalk-white lines, pastel colours. |
| `paper` | Cream paper, dark ink, muted colours. |
| `white` | Clean white, black lines, strong colours. Bright and modern. |
| `grid` | Graph paper: pale squares, blue-grey ink. |
| `deep` | Dark navy, with gold and teal. Calm and rich. |
| `sunny` | Warm light colours, rounded fonts. For younger viewers. |

#### Changing part of a theme

```json
"theme": { "base": "night", "accent": "#58c4dd", "background": "#0e1116" }
```

| Field | Values | What it controls |
| --- | --- | --- |
| `base` | a theme name | Where missing fields come from. |
| `background` | colour, or a list of two for a soft gradient | The colour behind everything. |
| `ink` | colour | Lines, letters and shapes with no colour of their own. |
| `accent` | colour | Highlights, boxes, the spoken caption word, card bars. |
| `colors` | list of colours | Colours handed out in turn to things not given one (graphs, chips, bars). |
| `good`, `bad` | colours | Ticks and crosses, right and wrong. |
| `surface` | colour | Background of cards and boxes. |
| `on_surface` | colour | Text on cards and boxes. |
| `fonts.text` | font name | Words. |
| `fonts.title` | font name | Titles. |
| `fonts.math` | `"computer_modern"`, `"stix"`, `"fira"`, `"chalk"` | The letters of the maths. Default `computer_modern`, the classic textbook look. |
| `grid` | colour | Faint grid lines on planes and axes. |
| `grain` | 0 to 1 | Paper or film grain. |
| `vignette` | 0 to 1 | Darkened corners. |
| `glow` | 0 to 1 | How much bright lines bleed light. |

Colours are names (section 30), hex (`"#58c4dd"`) or CSS colours.

### Looks: grade and lens

These change the finished picture, as in a film.

| Key | Values | Meaning |
| --- | --- | --- |
| `grade` | `none`, `warm`, `cold`, `faded`, `mono`, `vivid` | Colour of the whole picture. |
| `glow` | 0 to 1 | Bright parts glow. |
| `depth` | 0 to 1 | In space scenes, things beyond what the camera looks at fade into the background, as distance does. |
| `camera_style` | `steady`, `drift`, `breathe` | The manner of every camera move. `steady`: exactly as asked. `drift`: a very slow sideways float. `breathe`: a very slow push in and out. Default `steady`. |

They can be set at the top of the script or on a scene.

---

## 6. Colours that mean something

Give each symbol its own colour once, and it keeps it everywhere: in every
equation, on every graph, in labels and in captions.

```json
"symbols": { "x": "blue", "y": "green", "a": "yellow", "\\pi": "gold", "f": "teal" }
```

- A key is a letter, a symbol as written in maths (`"\\pi"`, `"\\theta"`), or
  a longer piece (`"dx"`, `"\\sin"`).
- A graph whose `id` is in the list is drawn in that colour.
- A named value (section 18) in the list is shown in that colour, and so are
  its slider and its number.
- In captions, the spoken words for a symbol (`"x"`, `"pi"`, `"theta"`) take
  its colour too.

To turn it off for one thing, give that thing `"symbols": false`. To change a
colour from a scene onwards, give the scene its own `symbols`.

---

## 7. Narration, voices and languages

### Lines

What the narrator says is written once, at the top, as numbered lines. Each
line holds its words in every language of the video:

```json
"lines": [
  { "en": "Take any two numbers, {ab}a and b.",
    "hi": "कोई भी दो संख्याएँ लीजिए, {ab}a और b." },
  { "en": "Square their sum, and you get {result}more than you might expect.",
    "hi": "उनके योग का वर्ग कीजिए, और {result}जितना सोचा था उससे ज़्यादा मिलता है।" },
  { "en": "Pause here and try it with three and four.", "pause": 4 }
]
```

| Key | Values | Meaning |
| --- | --- | --- |
| `en`, `hi`, `ta` ... | text | The words in that language. One per language of the video. |
| `pause` | seconds | Silence after the line. Default 0.35. |
| `before` | seconds | Silence before the line. |
| `speed` | 0.7 to 1.3 | Speak this line faster or slower. |
| `voice` | a voice name | A different voice for this line only. |
| `id` | text | A name, so a beat can use `at_line` with the name instead of the number. |

Lines are numbered in order from 1. A line missing a language is a problem
the checker reports.

### Cue marks

A word in curly brackets, such as `{result}`, is a **cue**: an exact moment
in the speech. It is not spoken. A beat with `"at_cue": "result"` starts
exactly when the narrator reaches that point, in every language, even when
the word order is different. Put the same cues in every language.

Cue names must be unique in the whole video.

### The voice: two ways

Each language's narration comes one of two ways. A script can use either,
and different languages can use different ways.

| Way | What the creator supplies | What the engine does |
| --- | --- | --- |
| **Their own recording** | A sound file under `audio` (and, if they have one, a subtitle file) | Plays it, and times the pictures to it (below). |
| **A made voice** | A voice under `voice`, and an ElevenLabs key | Makes the narration line by line with that voice, with the exact time of every word. |

If a language has a recording under `audio`, the recording is used, even if
a `voice` is given too.

### The ElevenLabs key

The key is needed to make a voice, and to time a recording exactly. It can
be given in any of three places; the first one found is used:

1. In the script: `"voice": { "api_key": "..." }`. Simple, but anyone the
   script is shared with can use the key; the engine warns about this.
2. In a file opened with the script, whose name ends in `key.txt` (such as
   `elevenlabs_key.txt`), holding only the key.
3. Typed into the **key** box on the engine's page. **Remember the key on
   this computer** keeps it in this browser only.

The key is only ever sent to ElevenLabs.

### A made voice

```json
"voice": {
  "provider": "elevenlabs",
  "model": "eleven_multilingual_v2",
  "en": { "voice": "Narrator A", "speed": 1, "style": 0.3 },
  "hi": { "voice": "Narrator B" },
  "say": { "sin": "sine", "lim": "limit" }
}
```

| Key | Values | Meaning |
| --- | --- | --- |
| `provider` | `"elevenlabs"` | Which service makes the voice. Default `"elevenlabs"`. (Other services are coming.) |
| `api_key` | text | The key, if it is kept in the script (above). |
| `model` | an ElevenLabs model id | Default `"eleven_multilingual_v2"`, which speaks many languages. |
| a language code | object | The voice for that language. |
| `voice` | a voice name or id | Which voice: its name in the ElevenLabs account, or its id. |
| `speed` | 0.7 to 1.2 | Default 1. A line's own `speed` multiplies it. |
| `style`, `stability` | 0 to 1 | How expressive, and how even. |
| `say` | `{ word: how to say it }` | Words the voice says wrongly, and how to say them. Given at the top of `voice` for every language, or inside a language for that one. A piece of maths can be given too: `{ "$x^2$": "x squared" }`. |

Press **Make voice** on the engine's page. The engine makes each line, puts
them together with the pauses the script asks for, and keeps two files:
`voice_<language>.wav` (the sound) and `voice_<language>.json` (the time of
every line and word). In a project folder they are saved there; otherwise
they download, and are opened with the script next time. With them, the
video is timed exactly and nothing is made again.

Every line made is also kept in the browser. Making the voice again (after
changing some lines) only pays for the lines whose words or voice changed.

Maths written inside a line between dollar signs, `"so $x^2$ grows fast"`,
is read aloud in words ("x squared"), in English and Hindi; for other
languages, give how to say each piece under `say`. In the captions it is
shown as maths.

### Your own recording

```json
"audio": { "en": "narration_en.mp3", "hi": "narration_hi.mp3" },
"subtitles": { "en": "narration_en.srt" }
```

With one language, `"audio": "narration.mp3"` is enough. The `lines` are
still written in the script: they are what the captions show and where the
cue marks are. They should match what is said.

The pictures are timed to the recording, best first:

| What is opened with the script | How it is timed |
| --- | --- |
| `voice_<language>.json` made by **Time my recording** | Exactly: every word. |
| A subtitle file under `subtitles` | By its lines; words inside each line are estimated. (Its lines are used as the `lines`; cue marks can be written inside the subtitle text.) |
| Only the recording | The estimate from the words, stretched or squeezed so the last line ends with the recording. Close, not exact. |

**Time my recording** on the engine's page (it needs the key) sends the
recording and the lines to ElevenLabs, which finds when every word is said,
and keeps the result as `voice_<language>.json`.

### Words on screen in every language

Every piece of text in the script (titles, labels, cards, notes) can be
given in every language:

```json
{ "do": "title", "text": { "en": "The square of a sum", "hi": "योग का वर्ग" } }
```

Or kept in one place under `strings` and named with `@`:

```json
"strings": { "square_of_sum": { "en": "The square of a sum", "hi": "योग का वर्ग" } }
{ "do": "title", "text": "@square_of_sum" }
```

Maths itself is the same in every language and is written once. Words inside
maths, `\text{area}`, can be given per language with `@` names:
`\text{@area}`.

### Making the videos

The engine makes one video per language. Pick the language in the engine's
page and **Export MP4**, or **Export all languages** to make every one in
turn. Each language's video follows its own voice: scenes, beats and cues move to fit how long each line takes in
that language.

---

## 8. Captions

The words of the narration are drawn on the video as captions. They come
from the `lines` (or your subtitle file), so there is nothing extra to write:
captions are on unless turned off.

```json
"captions": true
"captions": false
"captions": { "style": "karaoke", "position": "bottom", "size": "medium" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `captions` | `true`, `false`, or an object | `true`: captions on, as the settings below say. `false`: no captions drawn. Default `true`. |
| `style` | `"karaoke"`, `"plain"` | `karaoke`: a few words at a time, the word being spoken lit in the accent colour. `plain`: the whole line in a dark box. Default `"karaoke"`. |
| `position` | `"bottom"`, `"top"` | Default `bottom`. |
| `size` | `"small"`, `"medium"`, `"large"` | Default `medium`. |
| `maths` | `true`, `false` | Show maths in captions as maths (`x²`), not as words. Default `true`. |

A scene can turn them off or on for itself with `"captions": false` or
`true`, such as for a title scene with no narration.

The engine's page also has a **Captions** switch, for the preview and for
export, which overrides the script. Either way, each language's video is
also exported with an `.srt` subtitle file for YouTube (section 28), so
captions can be left off the picture and still offered to viewers.

---

## 9. Scenes and transitions

```json
{
  "name": "The picture proof",
  "chapter": "Seeing it with squares",
  "world": "geometry",
  "start_line": 6,
  "transition": "fade",
  "beats": []
}
```

| Key | Values | Meaning |
| --- | --- | --- |
| `world` | `"board"`, `"graph"`, `"geometry"`, `"counting"`, `"space"` | Which of the five worlds (section 10). Default `board`. |
| `name` | text | Used in messages and the preview's list of scenes. |
| `chapter` | text, or text per language | Starts a new YouTube chapter here (section 28). |
| `chapter_card` | `true` | Show the chapter's name on screen as the scene starts, with "Chapter 2" above it in the video's language. |
| `start_line` | a line number or id | The scene begins when this line begins. |
| `start_cue` | a cue name | The scene begins at this cue. |
| `start` | seconds | The scene begins at this time. Only for videos with no narration. |
| `transition` | see below | How this scene arrives. Default `cut`. Ignored on the first scene. |
| `transition_duration` | seconds | Default 1 (`fly` 1.8, `morph` 1.5, `zoom` and `rub` 1.4, `page` 1.2). |
| `into` | an id | For the `zoom` transition: the thing in the scene before to dive into. |
| `keep` | list of ids, or `"all"` | Things from the scene before that carry over into this one, exactly as they were left (place, size, colour), so the next scene can go on working with them. Graphs, figures and counted things come as pictures of how they were left. 3D objects are not carried. |
| `style`, `theme`, `symbols`, `captions` | as at the top | For this scene only. |
| `grade`, `glow`, `depth`, `camera_style` | section 5 | For this scene only. |
| `background` | see below | What is behind everything. |
| `place` | list (section 14) | Things there from the start. |
| `beats` | list | What happens. |

| Transition | What it looks like |
| --- | --- |
| `cut` | Instant change. |
| `fade` | The new scene fades in over the old. |
| `black` | Down to the background colour, and up again. |
| `morph` | Things in both scenes with the same `id` glide and change into their new form (equations symbol by symbol, as in a step); the rest fade. The smoothest way to move on, from one world to another too. Words and pictures fade rather than morph. |
| `slide` | The old scene slides away and the new one slides in from the right (`slide_left`, `slide_up`, `slide_down` for other directions). |
| `fly` | The camera pulls back and flies across the endless sheet to where the new scene is, as if the lesson were laid out on one huge board. |
| `wipe` | A soft edge sweeps across. |
| `zoom` | The camera dives into the thing named by `into` (an id from the scene before), and the new scene opens out of it. |
| `rub` | The old scene is rubbed off in sweeps, as if from a board. Best with `chalk` and `whiteboard`. |
| `page` | The old scene turns away like a page. Best with `sketch` and `paper`. |

The first scene always starts at 0. Scenes must be in time order.

Each scene is a fresh sheet unless `keep` says otherwise.

### Background

```json
"background": "plain"
"background": { "style": "gradient", "colors": ["#14171f", "#07080b"] }
"background": { "style": "grid", "spacing": 1 }
"background": { "image": "photo.jpg", "dim": 0.6, "blur": 0.4 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `style` | `plain`, `gradient`, `grid`, `dots`, `image` | `plain`: the theme's background. `grid`: faint squares. `dots`: a faint dot grid. Default `plain`. |
| `colors` | list | For `gradient`: middle and edge. |
| `spacing` | a number | Size of grid squares, in sheet units (section 12). |
| `image` | file | A picture behind everything, filling the frame (film clips are coming). |
| `dim`, `blur` | 0 to 1 | Darken or blur the picture so the maths reads over it. |

---

## 10. The five worlds

### What every world has

**board**, **graph**, **geometry** and **counting** are flat. Each is an
endless sheet. With the camera at rest, the frame shows a part of it **16
units wide and 9 high** (on `reel`, 9 wide and 16 high), with `0, 0` in the
middle. Most of the time no numbers are needed: things are placed by words
(section 12).

The camera can move round the sheet, zoom in on any part of it, and tilt it
so it is seen at an angle, with depth (section 26). Things on the sheet can
lift off it a little with `"lift"`, so a tilted sheet shows layers.

**space** is 3D (below).

### Which actions go where

| Actions | board | graph | geometry | counting | space |
| --- | --- | --- | --- | --- | --- |
| Equations (section 15) | yes | yes | yes | yes | yes |
| Shapes (16) | yes | yes | yes | yes | |
| Moving and attention (17) | yes | yes | yes | yes | yes |
| Graphs and planes (18) | | yes | | | |
| Geometry (19) | | | yes | | |
| Counting, fractions, chance (20) | | | | yes | |
| 3D (21) | | | | | yes |
| Wonders (22): `fourier`, `simulation` | yes | yes | | | |
| Wonders (22): `fractal`, `domain_color` | | yes | | | |
| Wonders (22): `particles` | yes | yes | yes | yes | yes |
| Teaching (23), mascot (24), on-screen graphics (25) | yes | yes | yes | yes | yes |

An action used in the wrong world stops the build, with a message naming
the world it belongs to.

### board

A clean sheet for writing on.

| Key | Values | Meaning |
| --- | --- | --- |
| `paper` | `plain`, `grid`, `dots`, `lined` | The look of the sheet. `lined`: faint ruled lines, like an exercise book. Default `plain`. |

Things written with no position stack down the sheet, one under another,
as working does (section 12).

### graph

A sheet with a set of axes already on it, called `axes`. Graphs, points and
everything in section 18 go on these axes unless they name others with `on`.

```json
{ "world": "graph", "axes": { "x": [-5, 5], "y": [-3, 8], "grid": "faint" }, "beats": [] }
{ "world": "graph", "axes": { "plane": true }, "beats": [] }
{ "world": "graph", "axes": { "complex": true, "plane": true, "x": [-3, 3], "y": [-2, 2] }, "beats": [] }
```

`axes` takes every key of the `axes` action (section 18). Left out, the axes
run from −8 to 8 across and −4.5 to 4.5 up, filling the frame, so one unit
on the axes is one unit of the sheet.

`"axes": { "appear": "draw" }` draws them on at the start of the scene;
otherwise they are there from the start. `"axes": false` starts with none,
for a scene that makes its own with the `axes` action (two sets side by
side, for example).

### geometry

A sheet for figures. Points are placed by sheet numbers, or by words, and
everything built from them follows when they move (section 19).

| Key | Values | Meaning |
| --- | --- | --- |
| `grid` | `false`, `true`, `"faint"` | Squared paper behind the figure. Default `false`. |
| `numbers` | `true` | Numbers along the grid's middle lines, so points can be read off. |
| `units` | `degrees`, `radians` | How angles are shown. Default `degrees`. |
| `decimals` | number | Decimals for lengths and angles shown. Default: 1 for lengths, whole degrees for angles. |

### counting

A sheet for things that are counted, split and shared (section 20). It can
have a number line from the start, called `line`:

```json
{ "world": "counting", "number_line": { "x": [-5, 5] }, "beats": [] }
```

`number_line` takes every key of the `number_line` action. Left out, there is
no line until a `number_line` beat makes one. Actions that work on a number
line use `line` unless they name another with `on`.

| Key | Values | Meaning |
| --- | --- | --- |
| `table` | `true` | A soft table-top across the lower half, with shadows under coins and dice. Default `false`. |

### space

A 3D world, seen through a camera that can circle round. `x` runs to the
right, `y` away from the viewer, `z` up, as in maths books. Distances are in
the script's own units.

```json
{ "world": "space", "axes": { "z": [0, 4] }, "light": "studio", "camera": { "elevation": 30, "angle": -40 }, "beats": [] }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `axes` | `false`, or the keys of `axes3d` (section 21) | 3D axes from the start, called `axes`. Default `false`. |
| `light` | `"soft"`, `"studio"`, `"dramatic"`, `"flat"` | `soft`: even light from above with a gentle fill. `studio`: a key light and a fill. `dramatic`: one strong light, deep shade. `flat`: no shading at all, colours as they are. Default `soft`. |
| `floor` | `true`, `false` | A faint floor grid under everything. Default `false`. |
| `camera` | `{ "elevation", "angle", "distance", "target" }` | Where the camera starts: `elevation` in degrees above the floor (default 24), `angle` in degrees round from the front (default −32), `distance`, and `target` (`[x, y, z]`). Left out, the distance and target are chosen to show everything in the scene. |

Flat things (equations, text, titles, cards) placed in a space scene sit
on the screen in front of the 3D picture.

---

## 11. Writing maths

Maths is written in LaTeX, the way maths is typed in textbooks and papers:

```json
{ "do": "write", "id": "eq1", "tex": "(a+b)^2 = a^2 + 2ab + b^2" }
```

Inside JSON a backslash is written twice: `"\\frac{1}{2}"`, `"\\sqrt{x}"`,
`"\\pi"`.

Or in plain form, as typed in a calculator, with `math`:

```json
{ "do": "write", "id": "eq1", "math": "(a+b)^2 = a^2 + 2*a*b + b^2" }
```

Plain form understands `+ - * / ^`, brackets, `sqrt()`, `sin()`, `cos()`,
`tan()`, `log()`, `ln()`, `exp()`, `abs()`, `pi`, `e`, `<`, `<=`, `>`, `>=`,
`!=`, and writes multiplication as it is written by hand (`2*a*b` becomes
`2ab`).

### Naming parts

Name a part of an expression to point at it, colour it, or move it on its
own, with `\part{name}{...}`:

```json
"tex": "\\part{left}{(a+b)^2} = \\part{sq}{a^2} + \\part{mid}{2ab} + b^2"
```

Parts are then written `eq1.mid`, `eq1.left` and so on.

Parts can also be picked out without naming them, by the piece of maths
itself:

```json
{ "do": "highlight", "who": "eq1", "part": "2ab" }
{ "do": "highlight", "who": "eq1", "part": "b^2", "which": 2 }
```

`which` picks the second (third ...) time the piece appears. Default the
first.

### Words inside maths

`\text{...}` writes words in the text font: `"\\text{area} = \\pi r^2"`.

### Inline maths in text

In any text on screen (titles, cards, notes, labels), maths goes between
dollar signs: `"text": "so $x^2 \\geq 0$ always"`.

### Size

| Key | Values | Meaning |
| --- | --- | --- |
| `size` | `small`, `medium`, `large`, `huge`, or a number | Height of normal letters, in sheet units. 0.5 is `medium`. |

---

## 12. Where things go

Wherever a setting takes a position (`position`, `to`, `from`, `toward`, `target`),
it can be any of:

| Form | Example | Meaning |
| --- | --- | --- |
| A screen place | `"center"`, `"top"`, `"bottom_left"` | One of the nine places on the frame (below), where the camera is at rest. |
| An object | `"eq1"`, `"tri"` | Its middle. |
| A named spot | `"eq1.right"`, `"tri.A"`, `"c.center"`, `"eq1.mid"` | A spot on an object or a part (section 14). |
| A relation | `{ "below": "eq1" }`, `{ "right_of": "tri", "gap": "large" }` | Next to something. |
| A point on axes | `{ "x": 2, "y": 3 }`, or `{ "on": "ax2", "x": 2, "y": 3 }` | At those numbers on the world's axes (graph and space worlds), or on the axes named. |
| A point on a graph | `{ "on": "f", "x": 2 }` | On that graph, above that number. |
| A point on a number line | `{ "on": "line", "x": 0.75 }` | At that number. |
| Sheet numbers | `[3, -1.5]` | That far right and up from the middle of the sheet. In space: `[x, y, z]`. |

`at` is always a time (section 13). The place something goes is its
`position`.

The nine screen places:

```
top_left      top       top_right
left          center    right
bottom_left   bottom    bottom_right
```

Relations: `above`, `below`, `left_of`, `right_of`, `over` (on top of it,
covering it), `under` (exactly under it, for a line beneath an equation).
`gap` is `none`, `small`, `medium` (default), `large`, or a number of sheet
units.

`align`, with `below` or `above`: `left`, `center`, `right`, or `"="`, which
lines up the equals signs of two equations.

Things placed with no position at all go to the `center`, or below the last
thing written if the scene already has things in it (so lines of working
stack down the sheet on their own).

---

## 13. Timing: when things happen

Every beat needs a start time.

| Key | Meaning |
| --- | --- |
| `at_line` | Start when this line starts (its number, or its `id`). |
| `at_cue` | Start at this cue mark. The most exact way, and the same in every language. |
| `at_word` | With `at_line`: start when the narrator reaches this word of the line, in the main language. In other languages it falls back to the start of the line unless a cue is used. |
| `then` | `true` = start when the beat before this one in the list ends. |
| `after` | Start when the beat with this `id` ends. |
| `with` | Start at the same moment as the beat with this `id`. |
| `at` | Seconds from the start of the scene. For scenes with no narration. |
| `offset` | Seconds added to the start. May be negative. |
| `duration` | How long it lasts, in seconds. |
| `until_line` | Last until this line ends. |
| `until_cue` | Last until this cue. |
| `speed` | `slow`, `normal`, `quick`, or a number, instead of `duration`: how fast the action is done. |

If neither `duration`, `until_line`, `until_cue` nor `speed` is given, each
action takes its natural time: writing takes longer for a longer expression,
a move takes about a second.

Beats can also be given an `id` for `after` and `with` to refer to.

```json
{ "at_line": 4, "do": "write", "tex": "a^2" }
{ "at_cue": "result", "do": "box", "who": "eq1" }
{ "then": true, "do": "highlight", "who": "eq1", "part": "2ab" }
{ "at_line": 5, "offset": 0.5, "duration": 2, "do": "plot", "math": "x^2" }
```

### Several things in turn

An action that makes several things (`write` of a list, `chips`, `draw` of a
list, `construct` with several steps) can lay them out one after another
with `lag`: the seconds between one starting and the next.

### wait (pause, think): waiting for the viewer

A beat can hold the whole video still, narration included, for a moment:

```json
{ "at_cue": "try", "do": "wait", "for": 5 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `for` | seconds | How long to hold. Default 5. |
| `countdown` | `true`, `false` | A ring in the corner that empties over the wait, with the seconds left. Default `true`. |
| `text` | words | A small line under the ring, such as `"Pause and try"`. |

The wait is added to the video: everything after it, the voice, captions,
music and chapter times, comes that much later. The script's own times
(`at`, `offset`, line times) do not change, so adding or removing a wait
never moves anything else in the script. Put it at the end of a line (with
`at_cue` on a cue at the line's end, or `then` after the beat that asks), so
the voice is not cut mid-word. `question` makes its own wait (section 23).

`wait` is also called `pause` or `think`.

### How long things stay

Things put on the sheet stay until the scene ends, they are removed, or the
scene's `keep` carries them on. On-screen graphics (`title`, `text`, `card`,
`image`, `chips`, `table`, `counter`) stay only for their beat unless given
`"stay": true`.

To remove something, use `remove` (section 17), or `clear` for on-screen
graphics:

```json
{ "at_line": 9, "do": "remove", "who": ["eq1", "eq2"] }
{ "at_line": 10, "do": "clear", "who": "all" }
```

---

## 14. Objects, ids and named spots

Every thing that appears can be given an `id`. Its id must be unique in the
scene. Things with no `id` can't be referred to later.

`place` lists things that are there from the very start of a scene, not
drawn on:

```json
"place": [
  { "do": "plot", "id": "f", "math": "x^2" },
  { "do": "write", "id": "eq1", "tex": "f(x) = x^2", "position": "top_left" }
]
```

Every item in `place` is written like a beat, without a time.

### Named spots

| Object | Spots |
| --- | --- |
| Anything | `.left`, `.right`, `.top`, `.bottom`, `.center`, `.top_left`, `.top_right`, `.bottom_left`, `.bottom_right` |
| An equation | its named parts: `.mid`; also `.lhs` and `.rhs` (the two sides of `=`), and `.eq` (the `=` sign) |
| A polygon | its corners by the names given: `.A`, `.B`; its sides: `.AB` |
| A circle | `.center`, `.radius` |
| Axes | `.origin`, `.x_axis`, `.y_axis` |
| A graph | `.start`, `.end` |
| A line or arrow | `.start`, `.end`, `.middle` |
| A group | its members: `.1`, `.2`, or their ids |

### group (groups)

```json
{ "do": "group", "id": "both", "who": ["eq1", "eq2"] }
```

A group can be moved, coloured and removed as one thing.

### Common settings

Every object can take:

| Key | Values | Meaning |
| --- | --- | --- |
| `id` | text | Its name. |
| `position` | a position (section 12) | Where it goes. |
| `color` | a colour | Its colour (for an equation, everything not coloured by `symbols`). |
| `size` | as each object says | How big. |
| `opacity` | 0 to 1 | Default 1. |
| `style` | a style name (section 5) | Draw this one thing differently. |
| `lift` | 0 to 5 | How far it rises off a flat sheet, seen when the sheet is tilted. |
| `key` | `true` | A result worth remembering; it goes into the recap (section 23). |
| `hidden` | `true` | Made, but not shown, until `show`. |
| `appear` | see below | How it arrives. |

How things arrive (`appear`):

| Value | What it looks like |
| --- | --- |
| `draw` | Lines are drawn on as if by a pen; fills come up after. Default for shapes, graphs and equations. |
| `write` | Each letter's strokes are written in order, as by hand. Default for equations in `chalk`, `sketch` and `whiteboard`. |
| `fade` | Fades in. |
| `grow` | Grows from its middle. |
| `grow_from` | Grows out of a position: `{ "grow_from": "eq1.mid" }`. |
| `pop` | Springs up, a little too big, then settles. |
| `rise` | Rises a little as it fades in. |
| `type` | Letter by letter, like typing. |
| `none` | There at once. |

---

## 15. Actions: equations

### write (show_math, tex)

Writes an equation or any expression on the sheet.

```json
{ "at_line": 2, "do": "write", "id": "eq1", "tex": "(a+b)^2" }
{ "at_line": 3, "do": "write", "id": "eq2", "tex": "= a^2 + 2ab + b^2", "position": { "right_of": "eq1", "gap": "small" } }
{ "at_line": 4, "do": "write", "tex": ["x = 1", "x = 2", "x = 3"], "lag": 0.4 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `tex` or `math` | text, or a list | Required. A list writes several lines, one under another. |
| `id` | text | With a list, the lines are `id.1`, `id.2` ... |
| `position`, `size`, `color`, `appear` | section 14 | |
| `align` | `"="`, `left`, `center` | With a list: how the lines line up. Default `"="`. |

### steps (transform, then)

Changes an equation into its next form. Pieces that are the same in both
glide to their new places; pieces that only move to the other side of the
`=` swing across in an arc; pieces that change fade or melt into what they
become.

```json
{ "at_line": 5, "do": "steps", "who": "eq1", "to": "3x = 20 - 5" }
{ "at_line": 6, "do": "steps", "who": "eq1", "to": ["3x = 15", "x = 5"], "lag": 1.2 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `who` | an equation id | Required. |
| `to` | text, or a list of steps | Required. In LaTeX, or plain with `"as": "math"`. A list goes through each step in turn. |
| `match` | `"auto"`, `"parts"`, `"none"` | `auto`: the engine finds what is the same between the two. `parts`: only named parts (`\part`) are matched, by name. `none`: the old fades, the new writes. Default `auto`. |
| `pairs` | `{ old: new }` | Say yourself which piece becomes which, when `auto` guesses wrong: `{ "+5": "-5" }`, or by part name. |
| `new_line` | `true` | Keep the old line and write the new one below it, lined up on `=`, as in a column of working. The new line is a new thing: its `id` is the beat's `id`, or the old one with `_2`, `_3` ... added (`eq1_2`). Later steps name it by that id. |
| `note` | text | A short reason, written beside the step in a smaller size, such as `"subtract 5 from both sides"`. |
| `note_at` | `right`, `left` | Default `right`. |
| `check` | `true`, `false` | Check that the new step is really equal to the old (section 29). Default `true`. |
| `lag` | seconds | With a list: time between steps. |

### work (derivation, column)

A whole column of working at once: each line arrives in turn, lined up on
`=`, each with its reason.

```json
{ "at_line": 4, "do": "work", "id": "w", "position": "left", "lines": [
  { "tex": "3x + 5 = 20" },
  { "tex": "3x = 15", "note": "subtract 5", "at_cue": "sub" },
  { "tex": "x = 5", "note": "divide by 3", "at_cue": "div", "key": true }
] }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `lines` | list | Required. Each line: `tex` or `math`; optional `note`, `key`, and its own time (`at_cue`, `at_line`, `then`). Without a time, lines follow on one after another. |
| `carry` | `true`, `false` | Each new line grows out of the line above it (as `steps` would), rather than being written fresh. Default `true`. |
| `numbered` | `true` | Small step numbers down the left. |
| `fade_old` | 0 to 1 | Lines above the newest fade to this. Default 0.5. |
| `scroll` | `true`, `false` | When the column reaches the bottom of the frame, the camera moves down with it. Default `true`. |

Each line is `w.1`, `w.2` ... afterwards.

### solve (auto_steps)

Like `work`, but the engine works out the steps itself and writes each
reason, in the language of the video (English and Hindi now; other
languages use English reasons until they are added).

```json
{ "at_line": 4, "do": "solve", "id": "w", "math": "3x + 5 = 20" }
{ "at_line": 9, "do": "solve", "math": "x^2 - 5x + 6 = 0", "method": "factor" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `math` (or `tex`) | text | Required. An equation, an inequality, or an expression. |
| `for` | a letter | What to solve for. Left out when there is only one letter. |
| `method` | `auto`, `factor`, `formula`, `complete_square`, `expand`, `simplify`, `differentiate`, `integrate` | How. Default `auto`: straight working for linear equations and inequalities (the sign turns round when dividing by a negative), factorising for quadratics that factorise neatly, otherwise the formula, with exact answers such as $-1 \pm \sqrt{2}$; `simplify` for an expression. `integrate` works on polynomials. |
| `max_steps` | number | Stop after this many. |
| `id`, `position`, `size`, `color`, `numbered`, `fade_old` | | As for `work`. |

It handles equations up to $x^2$ in one letter. The engine page shows the
steps it found ("solve found: …"); copy them into a `work` beat to change
any of them. Every step it writes passes the maths check.

### highlight (indicate, emphasise, emphasize)

Draws the eye to an equation or part of one.

| Key | Values | Meaning |
| --- | --- | --- |
| `who` | id, or id with part (`"eq1.mid"`) | Required. |
| `part` | a piece of maths | Instead of a named part. |
| `how` | `glow`, `color`, `pulse`, `wiggle`, `underline`, `circle`, `flash`, `back` | `glow`: lit from behind. `color`: turns the accent colour. `pulse`: swells and returns. `wiggle`: shakes a little. `underline`: a line drawn under it. `circle`: a loop drawn round it, as by hand. `flash`: a burst of lines round it. `back`: a soft coloured block behind it, like a highlighter pen. Default `back`. |
| `color` | a colour | Default the accent. |
| `stay` | `true`, `false` | Keep the highlight after the beat. Default `false` for `pulse`, `wiggle`, `flash`; `true` for the rest. |

### box (frame, result)

A box drawn round an equation or part. Default colour: the accent.
`"key": true` puts what is boxed into the recap.

### cancel (strike, cross_out)

Strikes out a part, as when things cancel.

| Key | Values | Meaning |
| --- | --- | --- |
| `who`, `part` | as `highlight` | Required. A list cancels several at once: `["eq1.top_x", "eq1.bottom_x"]`. |
| `how` | `slash`, `cross`, `line` | Default `slash`. |
| `to` | text | Write this small above the struck part, such as `"1"` or `"0"`. |
| `vanish` | `true` | After striking, the struck parts vanish and the rest closes up. |

### brace (underbrace, overbrace)

A curly bracket under or over a part, with a note.

```json
{ "at_cue": "mid", "do": "brace", "who": "eq1", "part": "2ab", "text": "the extra piece", "side": "below" }
```

`side`: `below` (default), `above`, `left`, `right`. `text` may contain maths.

### label_part (note, annotate)

A short note pointing at a part with a thin arrow: `"text"`, `"side"`.

### substitute (plug_in)

A value lifts in and takes the place of a letter, everywhere it appears.

```json
{ "at_line": 8, "do": "substitute", "who": "eq1", "put": { "a": "3", "b": "4" } }
```

The letters lift out and fade, the values drop into their places, and the
expression spaces itself again. `"keep": true` makes a new line below
instead of changing the old one.

### evaluate (calculate)

`{ "do": "evaluate", "math": "2 + 3 * (4 + 1)", "steps": true }`: works a sum of
numbers out to its value. `"steps": true` writes each sum on the way, in the
right order (brackets first), with the sum just done as its reason;
otherwise the expression melts straight into its answer. `position`,
`size`, `color`.

### swap, rearrange

`{ "do": "swap", "who": "eq1", "parts": ["eq1.sq", "eq1.mid"] }`: two parts
change places, each travelling round the other.

`{ "do": "rearrange", "who": "eq1", "to": "b^2 + 2ab + a^2" }`: the same as
`steps` when only the order changes; pieces travel in arcs and never pass
through each other.

### pull_out (copy_part, lift)

A copy of a part lifts out of the equation and goes somewhere else, to be
worked on there:

```json
{ "at_line": 7, "do": "pull_out", "who": "eq1", "part": "2ab", "id": "piece", "to": { "below": "eq1", "gap": "large" } }
```

### color (recolor, paint)

`{ "do": "color", "who": "eq1", "part": "x", "to": "red" }`. Changes colour
over the beat. Without `part`, the whole thing.

---

## 16. Actions: shapes

### draw (shape)

Draws a shape on the sheet.

```json
{ "at_line": 3, "do": "draw", "shape": "square", "id": "big", "size": 4, "position": "left" }
{ "at_line": 4, "do": "draw", "shape": "arrow", "from": "eq1.right", "to": "eq2.left" }
{ "at_line": 5, "do": "draw", "shape": "circle", "id": "c", "radius": 2, "fill": "blue", "fill_opacity": 0.3 }
```

| Shape | Its own keys |
| --- | --- |
| `line` | `from`, `to`. `extend`: `true` to run on past both ends. |
| `arrow` | `from`, `to`. `tip`: `end` (default), `start`, `both`. `curve`: a number; bows the arrow, as for `arc`. |
| `dashed` | A dashed line: `from`, `to`. |
| `dot` | `position`, `radius`. |
| `circle` | `position`, `radius`. |
| `ellipse` | `position`, `width`, `height`. |
| `arc` | `position`, `radius`, `from_angle`, `to_angle` (degrees); or `from`, `to` and `bend`. |
| `square` | `position`, `size`. |
| `rectangle` | `position`, `width`, `height`, `corner` (rounding). |
| `polygon` | `points` (a list of positions) and optional `names` for its corners (`["A", "B", "C"]`). |
| `regular` | `sides`, `position`, `radius`. A regular polygon. |
| `star` | `points`, `position`, `radius`. |
| `brace` | `from`, `to`, `text`. A curly bracket between two points. |
| `path` | `points`: a smooth curve through them. (`file`: an svg drawing, drawn on stroke by stroke, is coming.) |
| `grid` | `position`, `rows`, `columns`, `size`. |
| `cross`, `tick` | `position`, `size`. |

Every shape also takes:

| Key | Values | Meaning |
| --- | --- | --- |
| `color` | a colour | Line colour. |
| `line_width` | a number | Line width. Default 4 (in design pixels at 1080 high). |
| `fill` | a colour, or `false` | Inside colour. |
| `fill_opacity` | 0 to 1 | Default 0.6 when a `fill` is given. |
| `dash` | `true` | Dashed line. |
| `glow` | `true` | The line glows. |
| `label` | text | A name beside it. `label_at`: a named spot. |
| `size`, `position`, `appear`, `id`, `key`, `lift` | section 14 | |

A list of shapes in `shapes` draws several, with `lag` between them.

---

## 17. Actions: moving and drawing attention

### move (shift, go)

```json
{ "at_line": 6, "do": "move", "who": "eq1", "to": "top" }
{ "at_line": 7, "do": "move", "who": "piece", "to": { "right_of": "eq2" }, "path": "arc" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `who` | an id, a list, or a part | Required. |
| `to` | a position | Where it goes. |
| `by` | `[right, up]` | Instead: move this far. |
| `path` | `straight`, `arc`, `arc_left`, `arc_right`, or a list of positions | The way it travels. Default `straight`. |
| `ease` | `smooth`, `linear`, `in`, `out`, `spring`, `there_and_back` | How it moves through its time. `spring`: overshoots a little and settles. `there_and_back`: goes and comes back. Default `smooth`. |

### turn (rotate_by), scale (resize), flip

`{ "do": "turn", "who": "tri", "by": 90, "around": "tri.A" }`: turns by
degrees (anticlockwise; negative for clockwise) round a point (default its
middle).

`{ "do": "scale", "who": "eq1", "to": 1.5 }`: grows or shrinks to that many
times its size. `"around"` as for `turn`.

`{ "do": "flip", "who": "tri", "axis": "vertical" }`: a mirror flip,
`vertical` or `horizontal`, or `"over"` a line id.

### morph (become, transform_shape)

Any shape melts into any other: a square into a circle, a graph into
another graph, a picture of dots into an equation.

```json
{ "at_line": 9, "do": "morph", "who": "big", "into": { "do": "draw", "shape": "circle", "radius": 2 } }
{ "at_line": 10, "do": "morph", "who": "dots", "into": "eq3" }
```

`into` is either an existing id (which is then shown in place of the old
thing) or a description of a new thing, written as a beat without a time.
`"keep": true` leaves the old thing where it was and morphs a copy.

### copy

`{ "do": "copy", "who": "tri", "id": "tri2", "to": "right" }`: a copy slides
out of the original to the new place.

### show (reveal), hide, remove (disappear, erase)

`show`: reveals something made `hidden`. `hide`: fades it out but keeps it
(it can be shown again). `remove`: takes it away. `how`: `fade` (default),
`shrink`, `undraw` (the lines are taken back the way they were drawn), `rub`
(rubbed off, as from a board), `fall` (drops out of the frame).

### focus (dim_others, spotlight)

Everything except the things named fades back, so the eye goes to them.

```json
{ "at_line": 5, "do": "focus", "on": ["eq1.mid", "big_square"], "until_line": 6 }
```

`dim`: how far the rest fades, 0 to 1. Default 0.75.

### pointer (tap)

A pointer moves to a thing and taps it: `"on"` (a thing, a part such as
`"eq.2ab"`, or any position), and `"as"` `arrow` (default), `hand`, `chalk`,
`dot`. A list of `on` points at each in turn. It leaves at the end of the
beat unless `"stay": true`. `color`.

### trace_path (trail)

From this beat on, something moving leaves a fading trail behind it:
`"who"`, `"length"` (seconds of trail, default 1.5), `"color"`, `"width"`.
It works with anything that moves: `move`, a dragged geometry point, a
point sliding along a graph.

### spring, wobble

`{ "do": "wobble", "who": "eq1" }`: a quick jelly-like shake, for a moment of
surprise.

---

## 18. Actions: graphs and planes

These work in the `graph` world. The world's own axes are called `axes`;
`on` can be left out wherever it would name them. Everything drawn on a
set of axes moves with them: when they are rescaled, or when the plane is
transformed.

Graphs and the sums in them are written in plain maths (section 30):
`"x^2 - 2"`, `"a * sin(k * x)"`, `"y = 3x + 1"`. Labels and titles can use
LaTeX between dollar signs.

### axes (coordinate_system)

A graph scene's own axes are set with the scene's `axes` (section 10). The
`axes` action makes another set, beside them (or the first, in a scene with
`"axes": false`).

```json
{ "at_line": 1, "do": "axes", "id": "ax2", "x": [-5, 5], "y": [-3, 8], "width": 6, "position": "right" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `x`, `y` | `[from, to]` or `[from, to, step]` | Range of each axis, and the gap between tick marks. Default step: chosen to give clear numbers. Left out: the axes fill the frame with one unit per sheet unit. |
| `width`, `height` | sheet units | Size on the sheet. Default: given ranges fill most of the frame, leaving room for captions. |
| `equal` | `true` | Keep one unit the same length across and up, so circles are round. |
| `position` | a position | Where the middle of the axes goes. |
| `numbers` | `true`, `false`, `"x"`, `"y"` | Numbers along the axes. Default `true`. |
| `labels` | `["x", "y"]`, or `false` | Names at the ends of the axes, in LaTeX. Default `x`, `y`. |
| `grid` | `true`, `false`, `"faint"` | Grid lines. Default `false`. |
| `ticks` | `"pi"` | Mark the x axis in multiples of π, for trigonometry. |
| `arrows` | `true`, `false` | Arrow tips at the axis ends. Default `true` (not on a number plane). |
| `log` | `"x"`, `"y"`, `"both"` | Log scale. |
| `polar` | `true` | Add a polar grid of circles and spokes. |
| `plane` | `true` | A full number plane: blue grid lines across the whole frame, with the main axes brighter. |
| `complex` | `true` | Label it as the complex plane (`Re`, `Im`, and `i` on the upright axis). |
| `appear` | `"draw"` | In a scene's `axes`: draw them on as the scene starts. Otherwise they are there from the start. |

### rescale

Changes the range of axes smoothly; everything drawn on them follows.

```json
{ "at_line": 7, "do": "rescale", "x": [-10, 10], "y": [-5, 20], "duration": 2 }
```

`who` names other axes. Give `x`, `y`, or both, and `ease` as for `move`.

### plot (graph, curve, function)

```json
{ "at_line": 2, "do": "plot", "id": "f", "math": "x^2 - 2" }
{ "at_line": 3, "do": "plot", "id": "g", "math": "a * sin(k * x)", "label": "$g(x)$" }
{ "do": "plot", "x_of_t": "cos(t)", "y_of_t": "sin(2*t)", "t": [0, 6.283] }
{ "do": "plot", "r_of_theta": "1 + cos(theta)" }
{ "do": "plot", "implicit": "x^2 + y^2 = 9" }
{ "do": "plot", "math": "y > x^2 - 2", "fill": "blue" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `on` | an axes id | Default the world's `axes`. |
| `math` | an expression in `x`, or `y = ...`, or an inequality in `x` and `y` | The function. An inequality shades the region where it is true, with its edge dashed when the inequality is strict. |
| `x_of_t`, `y_of_t`, `t` | expressions and a range | A curve traced by `t`. Default range 0 to 2π. |
| `r_of_theta`, `theta` | an expression and a range | A polar curve. Default range 0 to 2π. |
| `implicit` | an equation in `x` and `y` | A curve where the equation holds. |
| `x` | `[from, to]` | Draw only this part. The ends can be numbers or names of values. |
| `label` | text, maths in `$` | A name near the right end of the curve. `label_at`: `{ "x": 2 }` to put it elsewhere. |
| `color`, `line_width`, `dash`, `glow` | | As for shapes. Default colour: from `symbols` by `id`, else the next theme colour. |
| `fill`, `fill_opacity` | | For an inequality: the colour of the shaded region and how solid. Default the curve's colour, 0.35. |
| `draw` | `left_to_right`, `all` | How the curve arrives: drawn on from the left, or faded in whole. Default `left_to_right`. |
| `breaks` | `true`, `false` | Leave gaps where the function jumps or runs off to infinity, instead of joining across. Default `true`. |

Every expression can use the named values of the scene (below). A graph
drawn from `math` as a function of `x` can be named by its `id` in
positions (`{ "on": "f", "x": 2 }`), and by `point`, `tangent`, `area` and
the rest.

### value (parameter)

A named number that can change over time. Every graph, label, area or
equation that uses it changes with it.

```json
{ "at_line": 4, "do": "value", "name": "a", "start": 1, "slider": { "position": "top_right", "range": [0, 3] } }
{ "at_line": 5, "do": "set", "name": "a", "to": 2.5, "duration": 3 }
{ "at_line": 6, "do": "set", "name": "a", "to": [0.5, 2, 1], "duration": 6 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `name` | a letter or short name | Required. Not `x`, `y`, `t`, `z`, `e`, `i`, `pi` or `theta`. |
| `start` | number | Its value at first. Default 1. |
| `slider` | `{ "position", "range" }` | A small slider on screen whose knob and number show the value. |
| `show` | a position | Instead of a slider: just its number, `a = 1.25`, at that place. |
| `decimals` | number | How many decimals to show. Default 2. |
| `color` | a colour | Default: from `symbols` by name, else the accent. |

Values work in every world. Make a value before anything that uses it.

### set

Changes a value over its beat. `to` as a list goes through each value in
turn. `ease` as for `move`.

Equations can show a value's number as it changes:
`"tex": "y = \\value{a} x^2"` writes the current number in place of
`\value{a}`.

### point (dot_on)

A dot on a graph or axes, which can slide.

```json
{ "at_line": 3, "do": "point", "id": "P", "position": { "on": "f", "x": 1 }, "label": "P", "drops": true, "coords": true }
{ "at_line": 4, "do": "slide", "who": "P", "to": 3, "duration": 4 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `position` | `{ "on": a graph, "x": n }`, `{ "x": n, "y": n }`, or any position | Required. Where it is. |
| `drops` | `true`, `"x"`, `"y"` | Dashed lines down to the x axis and across to the y axis. |
| `coords` | `true` | Its coordinates written beside it, updating as it moves: `(1.00, 1.00)`. |
| `label` | maths | A name beside it. |
| `trace` | `true`, or a colour | Leaves a line behind it as it slides. |
| `color`, `radius` | | Default the accent; 0.09. |

### slide

Moves a point, a tangent or a secant along what it is on: `to` is the new
`x`. `ease` as for `move`.

### mark (feature)

Finds and marks special points of a graph:

```json
{ "at_line": 5, "do": "mark", "on": "f", "find": "roots" }
{ "at_line": 6, "do": "mark", "on": ["f", "g"], "find": "intersections", "label": "coords" }
```

`find`: `roots`, `max`, `min`, `turning`, `intersections` (of two graphs),
`y_intercept`, `inflection`. Only points inside the axes are marked.
`label`: `"coords"`, or text.

### tangent (slope_line)

```json
{ "at_line": 7, "do": "tangent", "id": "t", "on": "f", "x": 1, "length": 4, "slope": true }
{ "at_line": 8, "do": "slide", "who": "t", "to": 3, "duration": 5 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `on`, `x` | a graph, a number | Required. Where it touches. |
| `length` | sheet units | How long the line is drawn. Default 4. |
| `slope` | `true` | Shows the slope's value beside it, updating as it slides. |
| `triangle` | `true` | A rise-over-run triangle on the line, with `dx` and `dy` written on its sides. |
| `color`, `line_width` | | |

### secant (chord)

A line through two points of a graph: `on`, `x`, `dx` (default 2).
`"close_in": true` makes `dx` shrink towards nothing over the beat, so the
secant turns into the tangent: the meaning of a derivative.

### area (integral, shade)

```json
{ "at_line": 9, "do": "area", "on": "f", "x": [0, 2], "color": "blue" }
{ "at_line": 10, "do": "area", "between": ["f", "g"], "x": [-1, 1] }
{ "at_line": 11, "do": "area", "id": "A", "on": "f", "x": [0, 2], "rectangles": 4, "rule": "left" }
{ "at_line": 12, "do": "refine", "who": "A", "to": 64, "duration": 5 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `on` or `between` | a graph, or two (the upper first) | Required. |
| `x` | `[from, to]` | Required. Numbers or names of values, so the area can grow as a value changes. |
| `rectangles` | number | Fill the area with this many rectangles instead. |
| `rule` | `left`, `right`, `middle`, `trapezium` | Where each rectangle meets the curve. Default `left`. |
| `value` | `true` | Shows the area's size inside it, updating: `= 2.67`, or `≈ 2.45` for the sum of rectangles. |
| `fill_from` | `left`, `bottom` | The fill sweeps in from that side. Default `left`. |
| `color`, `fill_opacity` | | Default: the graph's colour; 0.5. |

### refine

Makes the rectangles of an area thinner and more numerous over its beat:
`who` (the area), `to` (the number of rectangles at the end).

### asymptote, limit

`{ "do": "asymptote", "x": 2 }` or `"y": 0`: a dashed line the graph
approaches. `{ "do": "limit", "on": "f", "x": 2, "from": "both" }`: dots run
along the graph towards `x` from the `left`, the `right` or `both`, with
their values shown, closing in over the beat.

### shift_graph (transform_graph)

A graph changes smoothly into another: shifted, stretched, flipped. Points,
tangents and areas on it follow.

```json
{ "at_line": 6, "do": "shift_graph", "who": "f", "to": "(x-3)^2 + 1", "ghost": true }
```

`ghost: true` leaves a faint dashed copy of the graph as it was.

### table_of_values (values_table)

A small table of `x` and `f(x)` that fills in row by row, a dot appearing on
the graph for each row: `"on": "f"`, `"x": [-2, -1, 0, 1, 2]`, `"position"`
(default `top_left`), `"lag"` (seconds between rows).

### vector (arrow_on)

`{ "do": "vector", "id": "v", "to": [2, 1], "label": "\\vec{v}" }`.
`from` defaults to the origin. `"coords": true` writes its column beside it.
Default colour: from `symbols` by id, else yellow.

### add_vectors

`{ "do": "add_vectors", "who": ["v", "w"] }`: the second slides to the tip
of the first, and the sum is drawn (`id` names it).

### field (vector_field, flow)

```json
{ "at_line": 4, "do": "field", "x_part": "-y", "y_part": "x", "as": "arrows" }
{ "at_line": 6, "do": "field", "x_part": "y", "y_part": "-sin(x)", "as": "flow" }
```

`as`: `arrows` (a grid of arrows, longer where the field is stronger),
`flow` (small specks streaming along the field), `lines` (stream lines).
`density` (default 1), `color` (default `"by_strength"`: colour shows how
strong the field is), `seed` (a different arrangement of the specks).

### transform_plane (apply_matrix, warp)

The whole plane moves, so the viewer sees what a matrix or a function does
to every point at once. Everything drawn on the axes moves with it: graphs,
points, vectors.

```json
{ "at_line": 3, "do": "transform_plane", "matrix": [[2, 1], [0, 1]], "basis": true }
{ "at_line": 7, "do": "transform_plane", "map": "z^2", "duration": 4 }
{ "at_line": 9, "do": "transform_plane", "undo": true }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `who` | axes | Default the world's `axes`. Best with `"plane": true`. |
| `matrix` | `[[a, b], [c, d]]` | A 2×2 matrix. |
| `map` | an expression in `z` | A complex function, for a complex plane. |
| `x_part`, `y_part` | expressions in `x`, `y` | Any map of the plane. |
| `basis` | `true` | Show the two basis arrows (`î` green, `ĵ` red, named `i_hat` and `j_hat`), carried along. |
| `ghost` | `true` | Keep a faint copy of the grid as it was. |
| `undo` | `true` | Go back to the plain grid. |

Transforms add up: a second one acts on the plane as the first left it.

---

## 19. Actions: geometry

These work in the `geometry` world. The sheet's units are the lengths:
`[3, 1]` is 3 across and 1 up from the middle of the frame.

Geometry is built in steps, each depending on what was made before. Every
point, line and shape is worked out afresh at every moment from what it was
built from, so when a free point moves (`drag`), everything built from it
follows, and a figure can be shown to stay true however it is changed.

Geometry is named by its `id`. Corners of a polygon or triangle are named
`tri.A`, its sides `tri.AB`, a circle's centre `c.center`, and a segment's
ends and middle `s.start`, `s.end`, `s.middle`. A point can also be named
just by its own id (`"A"`), and any of these can be used as a position by
other actions (`"position": "A"`).

### point

A free point: `{ "do": "point", "id": "A", "position": [-3, -1], "label": true }`.

| Key | Values | Meaning |
| --- | --- | --- |
| `id` | text | Required: its name. |
| `position` | a position | Required. |
| `label` | `true`, or maths | Its name written beside it (`true`: its id), on the side away from the rest of the figure. |
| `color`, `radius` | | Default the accent; 0.08. |

### segment, line, ray

```json
{ "at_line": 3, "do": "segment", "id": "AC", "from": "A", "to": "C" }
{ "at_line": 4, "do": "line", "id": "l", "through": ["A", "B"] }
{ "at_line": 5, "do": "ray", "from": "A", "through": "B" }
```

A `line` runs on past the edges of the frame; a `ray` runs on from its
start. All take `color`, `line_width` and `dash`.

### circle

By `center` and `radius` (a number, or a segment whose length it takes), by
`center` and `through` (a point on it), or `through` three points. Also
`color`, `line_width`, `dash`, `fill`, `fill_opacity`.

### polygon

`{ "do": "polygon", "id": "q", "points": ["A", "B", "C", "D"] }`: through
points (ids or positions). Its corners take the points' names (so its sides
are `q.AB`, `q.BC` ...), or the names in `names`; corners named by `names`
are labelled. Also `color`, `line_width`, `fill`, `fill_opacity`, `labels`
(`true` or `false`).

### triangle

A triangle in one go: `{ "do": "triangle", "id": "tri", "kind": "right", "size": 5 }`.
`kind`: `any` (default), `right`, `equilateral`, `isosceles`. `size` (its
width, default 4) and `position` (its middle). Its corners are free points
named `A`, `B`, `C` (or the three `names` given), labelled, and can be
dragged.

### construct (build)

Makes a new point, line or circle from others, by a rule:

```json
{ "at_line": 4, "do": "construct", "id": "M", "make": "midpoint", "of": "tri.AB", "label": true }
{ "at_line": 5, "do": "construct", "id": "h", "make": "perpendicular", "from": "C", "to": "tri.AB", "show_steps": true }
{ "at_line": 6, "do": "construct", "id": "X", "make": "intersection", "of": ["h", "l"], "label": "H" }
```

| `make` | Needs | Gives |
| --- | --- | --- |
| `midpoint` | `of`: a segment, or two points | A point. |
| `perpendicular` | `from`: a point; `to`: a line or segment | A segment from the point to the line, with its right angle marked. `"extend": true` draws the whole line instead. |
| `parallel` | `through`: a point; `to`: a line | A line. |
| `bisector` | `of`: a segment (its perpendicular bisector, a line), or `angle`: three points (the angle's bisector, a ray) | A line or ray. |
| `intersection` | `of`: two lines or circles. `which`: 1 or 2 when they meet twice | A point. |
| `foot` | `from`: a point; `to`: a line | The point where the perpendicular meets the line. |
| `reflect_point` | `of`: a point; `in`: a line or a point | A point. |
| `tangent` | `to`: a circle; `touch`: a point on it, or `from`: a point outside (`which`: 1 or 2) | A line. |
| `circumcircle`, `incircle` | `of`: a triangle | A circle. |
| `centroid`, `orthocenter`, `circumcenter`, `incenter` | `of`: a triangle | A point. |
| `on` | `on`: a line, circle or polygon; `t`: 0 to 1, how far along (or round) | A point that can be dragged along it. |

Points made this way take `label`, `color` and `radius`; lines and circles
take `color`, `line_width` and `dash`. If the parts do not meet (parallel
lines), the engine says so.

`show_steps: true` draws the construction first the way it is done with a
compass and straightedge: the compass arcs swing on, faintly, one after
another, then the result is drawn. It works for `midpoint`, `bisector`
(of a segment or an angle) and `perpendicular`.

### angle (angle_mark)

```json
{ "at_line": 7, "do": "angle", "id": "alpha", "points": ["B", "A", "C"], "show": "value" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `points` | three points: one arm, the corner, the other arm | Required. The smaller of the two angles is marked. |
| `show` | `none`, `value`, `name`, or maths | What is written in it: its size (`37°`), its id, or any text such as `"\\alpha"`. The size updates as the figure changes. |
| `arcs` | 1, 2, 3 | Several arcs, to show equal angles. |
| `right` | `true`, `false` | Draw a small square (a right angle). Done by itself when the angle is 90°. |
| `units` | `degrees`, `radians` | Default: the scene's `units`. |
| `fill` | a colour | Fill the angle's slice. |
| `color`, `radius` | | Default the accent; 0.5. |

### equal (tick_marks)

Small ticks on sides to show they are equal: `{ "do": "equal", "who":
["tri.AB", "tri.AC"], "ticks": 2 }`. For parallel lines: `"as": "arrows"`.

### measure (length, dimension)

`{ "do": "measure", "who": "tri.AB" }`: a measuring line beside a segment,
with its length, updating as the figure changes. `text` shows a name
instead (`"c"`). It sits on the side away from the figure; `side`:
`"left"` or `"right"` to choose.

### drag (wiggle_point)

Moves a free point (or a corner of a `triangle`), and the whole figure
follows:

```json
{ "at_line": 9, "do": "drag", "who": "C", "to": [-1, 3], "duration": 3 }
{ "at_line": 10, "do": "drag", "who": "C", "path": [[-1, 3], [2, 1], [1, 2.5]], "duration": 6 }
{ "at_line": 11, "do": "drag", "who": "P", "to": 0.75 }
```

A point made `on` something is dragged along it: `to` is how far along, 0
to 1. Angles, lengths and constructions change as it moves, so a viewer
sees what stays the same.

### translate, rotate, reflect, enlarge

Geometric transformations. The image grows out of the original as it moves
into place:

```json
{ "at_line": 11, "do": "rotate", "who": "tri", "by": 90, "around": "O", "ghost": true }
{ "at_line": 12, "do": "reflect", "who": "tri", "in": "l", "lines": true }
{ "at_line": 13, "do": "enlarge", "who": "tri", "by": 2, "center": "O", "rays": true }
{ "at_line": 14, "do": "translate", "who": "tri", "by": [3, 1], "arrow": true }
```

| Key | Meaning |
| --- | --- |
| `who` | A point, segment, circle or polygon. Required. |
| `by` | `rotate`: degrees, anticlockwise. `enlarge`: the scale factor. `translate`: `[right, up]`. |
| `around` (rotate), `center` (enlarge) | Default the middle of the figure. |
| `in` (reflect) | A line, or a point. |
| `id` | The image's name. Default the original's with `_2` added. Its corners keep their names with a dash: `A'`, `B'`. |
| `ghost` | `true`: the original fades back. |
| `lines` (reflect) | Dashed lines joining each point to its image. |
| `rays` (enlarge) | Lines from the centre through each corner. |
| `arrow` (translate) | The vector of the move. |
| `color`, `line_width`, `ease` | Default colour pink. |

The image depends on the original, so it moves when the original is dragged.

### cut

Cuts a shape into pieces, for proofs by rearranging:

```json
{ "at_line": 15, "do": "cut", "who": "c", "into": "sectors", "count": 16, "id": "slices" }
{ "at_line": 16, "do": "rearrange_pieces", "who": "slices", "into": "strip", "duration": 4 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `who` | a circle, a polygon, or a shape made with `draw` | Required. It is replaced by its pieces. |
| `into` | `sectors`, `strips`, `grid`, `lines` | `sectors`: a circle into equal slices. `strips`: upright strips. `grid`: `rows` × `columns` cells. `lines`: cut along the lines or segments listed in `lines`. Required. |
| `count` | 2 to 64 | How many slices or strips. Default 8. |
| `id` | text | The pieces are `id.1`, `id.2` ..., and `id` names them all together. |
| `color`, `colors` | | Pieces alternate between two colours, or take `colors` in turn. |

### rearrange_pieces (dissect)

Moves the pieces of a cut shape into a new arrangement, each setting off a
moment after the one before:

| Key | Values | Meaning |
| --- | --- | --- |
| `who` | the `id` of a cut | Required. |
| `into` | `strip`, `row`, `stack` | `strip`: slices of a circle laid tip down, tip up, side by side, making nearly a parallelogram (as in the proof of the area of a circle). `row`, `stack`: side by side, or one above another. Default `strip`. |
| `places` | a list of `{ "position", "turn" }` | Instead: where each piece goes, and how far it turns (degrees). One per piece. |
| `gap` | sheet units | Space between pieces in a row or stack. Default 0.05. |

---

## 20. Actions: number lines, counting, fractions and chance

These work in the `counting` world. Actions on a number line use the
world's `line` unless they name another with `on`.

### number_line (numberline)

```json
{ "at_line": 1, "do": "number_line", "x": [-5, 5] }
{ "at_line": 2, "do": "jump", "from": -2, "by": 5 }
{ "at_line": 3, "do": "interval", "from": 1, "to": "inf", "open_start": true }
{ "at_line": 4, "do": "zoom_line", "x": [0, 1], "duration": 3 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `x` | `[from, to]` or `[from, to, step]` | The range. Numbers may be written as fractions: `[0, 2, "1/4"]`. Default `[-5, 5]`. |
| `fractions` | `true` | Label in fractions (`¼`, `½`, `¾`), with the step given as a fraction. |
| `numbers` | `false`, or a list | No numbers, or only these. |
| `width` | sheet units | Default 13. |
| `position` | a position | Its middle. Default a little below the centre. |

Marks and numbers are chosen to fit: as the line zooms, finer marks fade in
between the old ones and numbers appear when there is room. The first line
in a scene is called `line` unless given an `id`. A place on a line is
`{ "on": "line", "x": 0.75 }` (in a counting scene `{ "x": 0.75 }` is
enough).

### jump (hop)

`{ "do": "jump", "from": -2, "by": 5 }` (or `"to": 3`): an arc hop with an
arrow tip and a label (`+5` unless `label` says otherwise). `count`: several
equal hops one after another (4 hops of 3, for 4 × 3); `label` can then be
a list. `side`: `above` (default) or `below`. `color`, `on`.

### interval (stretch)

`from`, `to` (a number, `"inf"` or `"-inf"`), `open_start`, `open_end`
(hollow ends), `color`, `on`. A bold stretch drawn from left to right, with
filled or hollow ends, and an arrow where it runs on for ever.

### point_on_line (number_point, dot_on_line)

`{ "do": "point_on_line", "x": 12, "label": true }`: a dot at a number,
with the number (`true`) or any words (`"label": "start"`) above it
(`"side": "below"` for under). It stays on its number as the line zooms.

### zoom_line (zoom_number_line)

`who` (default `line`), `x`: the new range. The line zooms smoothly; hops,
stretches and points zoom with it.

### dots (objects, array, counters)

```json
{ "at_line": 1, "do": "dots", "id": "d", "rows": 3, "columns": 4, "shape": "apple" }
{ "at_line": 2, "do": "group_items", "who": "d", "by": "row" }
{ "at_line": 3, "do": "count_items", "who": "d" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `count` | 1 to 400 | How many, in rows of ten. Or `rows` and `columns` for an array. |
| `shape` | `dot`, `square`, `star`, `apple`, `coin`, `person`, `ball`, `heart` | Default `dot`. |
| `size` | `small`, `medium`, `large`, `huge` | |
| `gap`, `color`, `position`, `lag` | | `lag`: seconds between one appearing and the next. |

Each thing is `d.1`, `d.2` ..., so any one can be highlighted, moved or
coloured; `d` is all of them.

### group_items (group_by, ring)

`who`, `by`: `row`, `column`, or a number (`5`: in fives). A ring is drawn
round each group in turn (`lag`), each in its own colour. The rings are
`d.groups`.

### count_items (count_up, count_them)

`who`. Each thing lights and grows a little in turn, with its number above
it and a tick. `from`: the first number (default 1). `lag`, or a `duration`
for the whole count.

### tally (tally_marks)

`count` (up to 200), in tally marks drawn in fives, one at a time. `size`,
`color`, `position`, `lag`.

### blocks (base_ten, place_value_blocks)

`{ "do": "blocks", "id": "b", "number": 243 }`: hundreds as flats, tens as
rods, ones as small cubes. Or `hundreds`, `tens`, `ones` for amounts as
they stand in the middle of a sum (`"tens": 1, "ones": 12`).

### regroup (exchange, trade)

`{ "do": "regroup", "who": "b", "carry": true }`: ten ones line up into a
rod and become a ten. `"borrow": true`: a ten breaks into ten ones. The
other blocks make room.

### fraction (fraction_bar, pie)

```json
{ "at_line": 4, "do": "fraction", "id": "fr", "as": "bar", "parts": 4, "shade": 3, "label": true }
{ "at_line": 5, "do": "split", "who": "fr", "into": 8 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `as` | `bar`, `pie`, `grid`, `line` | The picture. Default `bar`. |
| `parts`, `shade` | whole numbers | How many equal parts, how many shaded. |
| `label` | `true` | The fraction written beside it; it changes when the parts do. |
| `size`, `color`, `position` | | |

### split (cut_parts), combine (join_parts)

`split` cuts every part into smaller equal parts (`"into": 8` turns ¾ into
⁶⁄₈, the new cuts growing in). `combine` joins them back (`"into": 4`). The
shaded amount never changes, which is the point.

### line_up (compare_fractions)

`{ "do": "line_up", "who": ["a", "b"] }`: fractions move one above the
other, made the same length, to be compared.

### coin (flip, coins)

```json
{ "at_line": 2, "do": "coin", "results": ["H", "T", "H"] }
{ "at_line": 3, "do": "coin", "random": 50 }
```

The coin spins in the air and lands on each result in turn; the results so
far are written underneath. `random`: that many throws with results that
look random but are the same every time the video is made (`seed`: any
word, for a different set). `tally: true` (on by itself with `random`)
keeps count with bars. `lag`: seconds between throws. `size`, `position`.

### dice (die, roll)

`{ "do": "dice", "count": 2, "results": [[3, 4], [6, 6]] }`: 1 to 4 dice
tumble and settle on each result, with the total under them (`"total":
false` to leave it out). `random`, `seed`, `tally` (bars for each total),
`lag`, `size`, `position`. For one die, results can be plain numbers:
`[6, 2, 3]`.

### spinner (spin, wheel)

`{ "do": "spinner", "parts": ["red", "blue", "blue", "green"], "result": 2 }`:
the spinner turns, slows and stops with part 2 under the pointer. Parts can
be `{ "label": "A", "color": "red" }`. `results` (a list) or `random` for
several spins; `tally`, `size`, `position`.

### cards (card_draw, deal)

`{ "do": "cards", "results": ["A♠", "10♥", "KD", "7C"] }`: up to ten
playing cards turn over one by one. A card is a rank (A, 2 to 10, J, Q, K)
and a suit (♠ ♥ ♦ ♣, or S H D C).

### tree (probability_tree)

```json
{ "at_line": 5, "do": "tree", "id": "t", "outcomes": true, "levels": [
  [{ "label": "H", "p": "1/2" }, { "label": "T", "p": "1/2" }],
  [{ "label": "H", "p": "1/2" }, { "label": "T", "p": "1/2" }]
] }
{ "at_line": 6, "do": "highlight", "who": "t.HT", "how": "color" }
```

Up to four levels. Every branch of a level grows the same choices. `grow`:
`level` (default: a level at a time), `path` (one path at a time) or `all`.
`outcomes: true` writes each path and its chance (`HT ¼`) at the end.
`t.HT` names the path H then T, for `highlight`, `color` and the rest.
`width`, `height`, `position`, `color`.

### sample_space (outcome_grid)

```json
{ "do": "sample_space", "rows": 6, "columns": 6, "cell": "r + c", "light": "r + c == 7" }
```

A grid of every outcome of two things. `rows` and `columns`: lists of
labels, or a number (6 means 1 to 6). `cell`: what each cell shows, worked
out from `r` (its row's label) and `c` (its column's); left out, the pair.
`light`: a rule; the cells where it holds are lit, and "6 out of 36 = ⅙" is
written under the grid (`"count": false` to leave that out). `size`,
`position`, `color`.

### chart (in counting)

See section 25.

---

## 21. Actions: 3D

These work in the `space` world. A 3D object is a thing like any other:
`fade`, `remove`, `show`, `hide`, `color`, `highlight` and `stay` work on it,
and `appear` chooses how it arrives (`grow` for solids by default, `draw`
for the rest).

### axes3d (axes_3d, space_axes)

`{ "do": "axes3d", "x": [-3, 3], "y": [-3, 3], "z": [0, 5] }`: arrows for x,
y and z with numbered ticks and their names. `numbers: false`, `names:
false`, `grid: true` (a faint grid on the floor), `color`. The first is
called `axes`; its box is where planes, lines and surfaces are cut off.

### surface (surface3d, graph3d)

```json
{ "at_line": 2, "do": "surface", "id": "s", "math": "z = x^2 - y^2" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `math` | `z = f(x, y)` or an expression in `x`, `y` | The surface, over `x` and `y` (default the axes' ranges, or −3 to 3). Named values work, so it can change shape with `set`. |
| `x_of_uv`, `y_of_uv`, `z_of_uv`, `u`, `v` | | A surface traced by `u` and `v` (default 0 to 2π each): a sphere, a torus, anything. |
| `color` | a colour, or `"by_height"` | `by_height` (the default for `math`) shades from low to high, blue to orange. |
| `mesh` | `false` | No grid lines on it. |
| `opacity` | 0 to 1 | See-through. |
| `grow` | `rise`, `sweep`, `all` | How it arrives. `rise`: rises out of the flat floor. `sweep`: drawn across. `all`: fades in. Default `rise`. |
| `detail` | 6 to 60 | Grid squares each way. Default 30. |

### solid (shape3d, solid3d)

`{ "do": "solid", "shape": "cube", "id": "k", "size": 2 }`. Shapes: `cube`,
`cuboid` (`width`, `depth`, `height`), `sphere`, `cylinder` and `cone`
(`radius`, `height`), `prism` and `pyramid` (`sides`, default 6 and 4),
`tetrahedron`, `octahedron`, `dodecahedron`, `icosahedron`, `torus`.

`size`: a number or `small`, `medium`, `large`, `huge`. `position`: where it
stands, `[x, y, z]` (the middle of its base). `color`, `opacity`. `edges`:
drawn by default on flat-faced solids; `false` to hide, `true` on curved
ones for grid lines. `wire: true` draws edges only. 3D models from files
(`model`) are coming.

### revolve (solid_of_revolution, spin_around)

`{ "do": "revolve", "math": "sqrt(x)", "x": [0, 4], "around": "x", "duration": 4 }`:
the graph is drawn upright, the area under it shades in, and it sweeps
round the axis to become a solid. `around`: `x` (default) or `z` (the
upright axis, so the graph's `x` becomes the radius). `region: false`
leaves out the shaded area. `color`, `opacity`.

### slice (cross_section, cut3d)

`{ "do": "slice", "who": "k", "plane": "z = 1", "show": "section" }`: a
plane cuts the solid. `show`: `section` (the cut face lit, the part above
see-through) or `apart` (the two halves move apart by `gap`). `"sweep": [0, 2]`
moves the cutting plane through the solid over the beat. The plane is
`x = …`, `y = …` or `z = …`. The cut face is worked out as the outline round
every point where the plane crosses the solid, which is exact for solids
without hollows.

### stack_slices (volume_by_slices, slabs)

`{ "do": "stack_slices", "who": "k", "count": 6, "refine": [12, 24] }`: the
solid (shown faintly) is rebuilt as a stack of thin slabs, one by one, which
then get thinner: 6, then 12, then 24, sharing the beat. `axis`: `z`
(default), `x` or `y`. `color`; `"ghost": false` keeps the solid as it was.

### net (unfold, fold)

`{ "do": "net", "who": "k", "duration": 3 }`: a flat-faced solid unfolds
flat into its net, face by face round their edges, lying on its bottom
face. `"fold": true` starts flat and folds up. Works for the cube, cuboid,
prisms, pyramids and the Platonic solids.

### vector3d (arrow3d)

`{ "do": "vector3d", "to": [1, 2, 2], "label": "\\vec{v}" }`. `from`
(default the origin), `color`, `width`.

### point3d (dot3d)

`{ "do": "point3d", "position": [1, 2, 1.5], "label": true, "drop": true }`:
a dot; `label: true` writes its coordinates (or any maths); `drop` draws
dashed lines down to the floor and across to the axes.

### plane3d (plane)

`{ "do": "plane3d", "math": "x + y + z = 3" }`: a flat plane, cut to the
axes' box, see-through (`opacity`, default 0.5). `color`.

### line3d (line_3d)

`{ "do": "line3d", "through": [[0, 0, 0], [1, 1, 2]] }`: a line through two
points, across the axes' box; `"segment": true` only between them. `color`,
`width`, `dash`.

### curve3d (space_curve, helix)

`{ "do": "curve3d", "x_of_t": "cos(t)", "y_of_t": "sin(t)", "z_of_t": "t / 4", "t": [0, 18] }`:
a curve traced as `t` runs (default 0 to 2π). `color`, `width`.

### Models (coming)

```json
"models": [ { "name": "bridge", "file": "bridge.glb", "width": 40 } ]
```

| Key | Meaning |
| --- | --- |
| `name` | The name used with `solid`'s `model`. |
| `file` | `.glb`, `.gltf` or `.fbx`. |
| `height`, `width` or `length` | One real size; the model is scaled to it. |

---

## 22. Actions: wonders

Things that are hard to draw by hand and beautiful to watch. They are worked
out exactly the same way on every render. Which world each works in is in
section 10.

### fractal (fractals)

```json
{ "at_line": 3, "do": "fractal", "kind": "mandelbrot", "zoom_to": [-0.7436, 0.1318], "zoom": 10000, "duration": 20 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `kind` | `mandelbrot`, `julia`, `burning_ship`, `newton`, `sierpinski`, `koch`, `tree`, `dragon` | The first four fill the axes' box (or the frame) with colour, worked out pixel by pixel; the numbers on the axes are the plane's. The last four are drawn as lines, level by level, in any flat world. |
| `c` | `[re, im]` | `julia`: its number. Each part can be the name of a value, so the fractal shifts as the value changes. Default `[-0.8, 0.156]`. |
| `zoom_to`, `zoom` | a point, a number | Dive into that point until that many times larger (up to 10¹²), over the beat. The axes fade out as it dives. |
| `levels` | number | Line fractals: how many levels, added one after another (up to 7 for Sierpinski, 6 Koch, 11 tree, 14 dragon). |
| `palette` | a list of colours, or `"theme"` | Colouring: the first colour is the inside of the set, the rest are the bands outside. |
| `iterations` | number | How hard to look; more shows finer detail. Chosen by the zoom if left out. |
| `size`, `position`, `color` | | Line fractals. |

### domain_color (complex_colors)

`{ "do": "domain_color", "map": "(z^2 - 1) / (z^2 + 1)" }`: in a graph scene,
the axes' box coloured by where each point is sent: hue for direction,
brightness for size, with soft rings at each doubling (`"rings": false` for
none). Roots and poles show as points where all colours meet. Named values
work in the map.

### fourier (epicycles)

```json
{ "at_line": 5, "do": "fourier", "file": "outline.svg", "circles": 80, "duration": 15 }
```

Circles turning on circles, each riding the last, draw a picture: the
outline in an SVG file (its paths and polygons, joined into one loop), or
`"wave"`: `"square"`, `"saw"` or `"triangle"`. `circles`: how many (default
60). `"add_circles": [1, 80]` starts with one and adds more over the beat,
so the drawing becomes more and more like the picture. `size` (default 5),
`position`, `color`, `cycles` (times round in the beat).

### simulation (simulate)

```json
{ "at_line": 2, "do": "simulation", "kind": "pendulum", "length": 2, "angle": 40 }
{ "at_line": 4, "do": "simulation", "kind": "monte_carlo_pi", "points": 3000 }
{ "at_line": 6, "do": "simulation", "kind": "galton", "balls": 400, "rows": 12 }
```

| Kind | What it shows | Its keys |
| --- | --- | --- |
| `pendulum` | A swinging pendulum, with its arc | `length`, `angle`, `double` (`true` for a chaotic double pendulum, with its path) |
| `projectile` | A thrown thing, with its curve | `speed`, `angle`, `on` (axes, so the path is a graph) |
| `spring` | A weight bouncing on a spring | `stiffness`, `damping` |
| `random_walk` | Walkers wandering at random | `walkers`, `steps`, `dimensions` (1: drawn along time; 2: on the sheet) |
| `monte_carlo_pi` | Dots thrown into a square, those inside the circle counted, π estimated | `points`, `count` (`false` hides the sum) |
| `galton` | Balls falling through pegs into a bell shape | `balls`, `rows` |
| `orbits` | Planets round a sun, inner ones faster | `bodies` |
| `heat`, `wave` | A bar where heat spreads, or a string where a wave runs and reflects | `start`: an expression in `x` (0 to 1), or `"spike"`, `"step"` |
| `game_of_life` | Cells living and dying | `pattern` (`random`, `glider`, `blinker`, `gun`), `size` |
| `sort` | Bars being sorted step by step, the two being compared lit | `method`: `bubble`, `insertion`, `merge`, `quick`; `count` |

Simulations are worked out once when the script is opened, so they can be
jumped through and always play the same. `seed` gives a different random
run. They run for the beat's `duration` (default 6 seconds). `position`,
`size`, `color`.

### particles (sparkles, confetti)

`{ "do": "particles", "kind": "sparkle", "on": "eq1" }`. Kinds: `sparkle`
(glints round the thing named by `on`), `confetti` (falling over the whole
screen), `dust` and `stars` (drifting specks or a twinkling sky behind
everything, staying to the end of the scene unless `"stay": false`),
`gather` (specks flying in to form the thing named by `on`, which then
appears), `scatter` (the thing breaks into specks that drift away). `count`,
`color`. For moments of celebration and change.

---

## 23. Actions: teaching

These work in every world. Their panels sit on the screen, not the sheet, so
the camera can move behind them.

### question (ask, quiz, try_this)

```json
{ "at_line": 4, "do": "question", "text": "What is $\\sqrt{16}$?", "choices": ["2", "4", "8", "16"], "hint": "What times itself gives 16?", "wait": 5 }
{ "at_line": 5, "do": "answer", "choice": "B", "why": "Because 4 × 4 = 16." }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `text` | words, maths in `$` | The question. Or `tex` for a question that is only maths. |
| `choices` | 2 to 8 texts | Possible answers, labelled A, B, C, appearing in turn. A choice written as `$...$` is maths. |
| `wait` | seconds, or `false` | Hold the whole video still this long, after the narration line the question is asked in, for the viewer to try it. Default 5. |
| `countdown` | `true`, `false` | The ring that empties over the wait, with "Pause and try". Default `true`. |
| `hint` | words | Fades in half way through the wait, under the question. |
| `position` | a screen place | Default `top`. |
| `stay` | `true` | Otherwise the question stays until its `answer` is done (or for its `duration`). |

### answer (reveal_answer, solution)

Answers the last `question` in the scene.

| Key | Meaning |
| --- | --- |
| `choice` | For a question with choices: the right one, by letter (`"B"`) or number (`2`). It lights in the `good` colour with a tick and the others fade. |
| `text`, `tex` | Otherwise, the answer, on a panel under the question. |
| `why` | One line of reason underneath. |
| `stay` | `true` keeps the question and answer to the end of the scene. Otherwise they leave at the end of the answer's line (or its `duration`). |

### mistake (common_mistake, wrong_way)

```json
{ "at_line": 3, "do": "mistake", "tex": "(a+b)^2 = a^2 + b^2", "fix": "(a+b)^2 = a^2 + 2ab + b^2", "reason": "the middle term is missing", "key": true }
```

The wrong working is written (or `who` names something already shown),
then a red cross is stamped over it with the word MISTAKE, and it fades
back. `reason` writes why under it, in red. `fix` (maths) or `fix_text`
(words) writes the right version beneath, in green, with a tick. With
`"key": true` the fix goes into the recap. `position` places a new wrong
line.

### tick, cross (correct, incorrect)

`{ "do": "tick", "who": "eq3" }` or `"cross"`: a tick or a cross beside a
thing, in the theme's `good` or `bad` colour, with a chime or a low note.
`side`: `right` (default), `left`, or `over`. Or `position` for a mark
anywhere. `size`, `color`.

### definition, theorem, rule, formula, tip (define, key_formula)

```json
{ "at_line": 2, "do": "definition", "title": "Prime number", "text": "A whole number above 1 whose only factors are 1 and itself." }
{ "at_line": 9, "do": "theorem", "title": "Pythagoras", "tex": "a^2 + b^2 = c^2" }
```

A panel with a word above the heading (DEFINITION, THEOREM, RULE, FORMULA,
TIP), each kind in its own colour so viewers learn to tell them apart.
`title`, `text`, `tex`; `label` replaces the word above (`"Lemma"`);
`position` (default `top`); `width`; `stay`. Each goes into the `recap`
unless given `"key": false`.

### step_counter (step_number, progress)

`{ "at_line": 3, "do": "step_counter", "step": 1, "of": 4 }`: a small
"Step 1 / 4" tucked into a corner (`position`, default `top_left`). The next
`step_counter` takes its place, so the counter moves on through the scene.
`text` changes the word "Step" (for other languages: `"text": { "en":
"Step", "hi": "चरण" }`).

### recap (summary, sum_up)

```json
{ "at_line": 30, "do": "recap", "title": "What we found" }
```

Gathers everything marked `"key": true` so far in the video (equations,
working, definitions, mistakes put right, cards), in order, on one card;
each line rises in as the last settles (`lag`, default 0.6 seconds).
`"from_chapter": true` takes only what was marked in the present chapter.
`"items": [...]` gives the lines instead (a line written as `$...$` is
maths). Up to seven lines fit; with more, the last seven are shown.

### compare (versus, side_by_side)

```json
{ "do": "compare", "left": { "title": "Term by term", "tex": "a^2 + b^2" }, "right": { "title": "Expanded", "tex": "a^2 + 2ab + b^2" }, "better": "right" }
```

Two panels side by side with "vs" between. Each side takes `title`, `tex`,
`text` and `items` (a list of points). `better` marks one side with a tick
and the other with a cross.

---

## 24. The mascot (coming)

An optional small character who watches the maths and reacts: looking at
what is happening, blinking, and showing how a viewer might feel about it.

```json
"characters": [ { "name": "pip", "kind": "blob", "color": "blue" } ]
```

| Key | Values | Meaning |
| --- | --- | --- |
| `name` | text | Its id. |
| `kind` | `blob`, `pebble`, `owl`, `robot`, or `"parts"` | A built-in simple character, or your own cut-out drawing. |
| `parts` | file-name beginning | With `kind: "parts"`: pictures `pip_body.png`, `pip_eyes_open.png`, `pip_mouth_open.png` and so on. |
| `color` | a colour | Built-in characters only. |
| `size` | `small`, `medium`, `large` | Default `medium`. |

Its actions:

| Action | Keys | What it does |
| --- | --- | --- |
| `enter` | `who`, `position` (default `bottom_right`), `from` (`left`, `right`, `below`) | It arrives. |
| `look` | `who`, `on` | Its eyes follow a thing, even as the thing moves. By default it looks at whatever was last drawn. |
| `react` | `who`, `feel`: `happy`, `surprised`, `confused`, `thinking`, `excited`, `worried`, `proud`, `bored` | A face and a small movement. |
| `say` | `who`, `text` | A speech bubble. |
| `talk` | `who` | Its mouth moves with the narration, in time with each sound. With a made voice, this is exact. |
| `gesture` | `who`, `gesture`: `point`, `wave`, `shrug`, `jump`, `clap` | |
| `leave` | `who` | It goes. |

---

## 25. On-screen graphics

Graphics drawn on top of the picture. They stay put while the camera moves.

| Action | Use it for |
| --- | --- |
| `title` | Large headline words. |
| `text` | Any other words, in a chosen place, style and entrance. |
| `card` | A panel: heading, a sentence, a number. |
| `image` | Pictures and film clips. |
| `counter` | Numbers that tick up or down. |
| `chips` | A set of short words appearing in turn. |
| `table` | A grid of values, filling in row by row. |
| `chart` | Bars, a line or a pie, built from numbers. |
| `label` | A name attached to a thing on the sheet. It moves with the thing. |
| `credits` | Lines rolling up the screen. |
| `clear` | Removing any of these early. |

Screen positions are the nine places in section 12. Sizes: `small`,
`medium`, `large`, `huge`. Colours: `"accent"`, a colour name, or hex.

Every one takes `stay`, `id`, `appear` (`fade`, `rise`, `pop`, `slide`,
`type`, `write`), and `leave` (`fade`, `slide`, `undraw`).

### title

```json
{ "at_line": 1, "do": "title", "text": "Why $(a+b)^2 \\neq a^2 + b^2$", "kicker": "Algebra", "sub": "A picture says it all", "duration": 4 }
```

| Key | Meaning |
| --- | --- |
| `text` | Required. May contain maths. |
| `kicker` | Small line above, in the accent colour. |
| `sub` | Smaller line below. |
| `position` | `center` (default), `top`, `bottom`. |
| `size` | Default `large`. |
| `appear` | Default `write`: drawn on letter by letter. |

### text

| Key | Values | Meaning |
| --- | --- | --- |
| `text` | text, maths in `$` | Required. |
| `position` | one of nine | Default `top`. |
| `style` | `plain`, `box`, `banner`, `quote`, `note` | `note`: a slightly tilted handwritten note, as written in the margin. |
| `size`, `color`, `glow`, `by` (for quotes) | | |

### card (info, popup, fact)

```json
{ "at_line": 5, "do": "card", "kicker": "Fact", "title": "Pi", "number": 3.14159, "text": "The same for every circle." }
```

| Key | Meaning |
| --- | --- |
| `title`, `text`, `kicker` | A heading, a sentence, and a small word above in the accent colour. |
| `number`, `unit` | A large number that counts up to its value as the card arrives. |
| `tex` | A formula on the card. |
| `caption` | A small line at the bottom. |
| `side` | `right` (default) or `left`. |
| `position` | `top` (default), `middle`, `bottom`. Cards showing at the same time in the same place stack. |
| `on` | A position on the sheet (an id, a point name): a dotted line from the card to it. |
| `width` | The least width. |

### image (picture, photo, logo)

```json
{ "at_line": 7, "do": "image", "file": "bridge.jpg", "frame": "polaroid", "caption": "The Howrah Bridge", "position": "left", "motion": "in" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `file` | `png`, `jpg`, `webp`, `svg` | Required the first time. Put it beside the script. Until it is opened, a plain box with its name is drawn. |
| `position` | a screen place | Default `center`. |
| `size` | `small`, `medium`, `large`, `huge`, `full` | Default `medium`. `full` fills the frame behind everything. |
| `frame` | `none`, `rounded`, `circle`, `polaroid` | Default `rounded`. A polaroid is tilted a little, with its caption on the white card. |
| `tone` | `none`, `mono`, `faded`, `warm`, `cold` | |
| `motion` | `none`, `in`, `out`, `left`, `right` | A slow move across it while it is seen. |
| `caption` | words | Under the picture. |
| `tilt` | degrees | |
| `on_sheet` | `true` | Put the picture on the sheet instead of over it, with `position` a point on the sheet: the camera moves past it and maths can be drawn on top. |

A later `image` with the same `id` and no `file` glides it to a new place
and size. Film clips are coming.

### counter (count, ticker)

```json
{ "at_line": 5, "do": "counter", "items": [ { "to": 1200000, "label": "people" }, { "to": 98.6, "suffix": "%", "label": "right" } ], "duration": 2 }
```

`to`, `from` (default 0), `label`, `kicker`, `decimals`, `prefix`, `suffix`,
or `items` for several side by side. `"value": "a"` shows a named value
(section 18) live instead. The count takes the beat's `duration` (default
1.6 seconds) and holds for `hold` seconds (default 2). `position` (default
`center`), `size` (default `large`), `color`, `ease` (`"linear"` for an
even count).

Number grouping follows each language: `12,00,000` in Hindi and other
Indian languages, `1,200,000` in English, unless `grouping` says
`"international"` or `"indian"`; `"plain": true` has no separators.

### chips (pills)

`{ "do": "chips", "items": ["primes", "squares", "roots"], "kicker": "Today" }`:
short words in rounded outlines, each popping in `lag` seconds (default
0.35) after the last, wrapping onto more rows if needed. `position`, `size`.

### table

```json
{ "at_line": 5, "do": "table", "head": ["$x$", "$x^2$"], "rows": [["1", "1"], ["2", "4"], ["3", "9"]], "light": 2 }
```

Fills in row by row, `lag` seconds apart (default 0.45). `head` is the
heading row. `light`: a row number to light. `position`, `size`.

### chart (bars, graph_chart)

```json
{ "do": "chart", "kind": "bar", "title": "Visitors", "items": [ { "label": "Mon", "value": 3 }, { "label": "Tue", "value": 5 } ] }
```

`kind`: `bar` (default), `line`, `pie`, `dot`. `items`: `{ "label",
"value", "color" }`. `title`, `unit`, `position`, `size`. Bars and dots grow
with their numbers counting, pie slices open in turn.

### label (tag, pin)

`{ "do": "label", "on": "P", "text": "the vertex", "side": "above", "arrow": true }`:
words fixed to a thing or a point on the sheet; they move with it (a
dragged geometry point, a sliding graph point). `side`: `above` (default),
`below`, `left`, `right`. `arrow`: a thin arrow from the words to the
place. Stays to the end of the scene unless the beat has a `duration`.

### credits (roll)

`{ "do": "credits", "lines": ["# Made by", "Your name", "# Music", "..."], "duration": 10 }`:
lines rolling up the screen; a line starting with `#` is a heading.

### clear (dismiss)

`{ "do": "clear", "who": "heading" }` or `"who": "all"`.

---

## 26. Camera

The camera starts by showing the frame at rest: 16 by 9 sheet units round
the middle. A beat's `camera` is a shot name, a shot object, or a list of
shots that follow one another.

```json
"camera": { "shot": "frame", "target": "eq1" }
"camera": { "shot": "frame", "target": ["tri", "eq2"], "padding": "large" }
"camera": { "shot": "zoom", "target": "eq1.mid", "to": 3 }
"camera": { "shot": "tilt", "elevation": 55, "angle": -20 }
"camera": { "shot": "follow", "target": "P" }
"camera": [ { "shot": "frame", "target": "eq1" }, { "shot": "rest", "at": "60%" } ]
```

| Shot | What it does |
| --- | --- |
| `rest` | Back to the frame at rest. |
| `frame` | Moves and zooms so the `target` fills the frame. A list keeps all of them in view. |
| `zoom` | Zooms by `to` times on the `target` (default the middle). Below 1 zooms out. |
| `pan` | Slides to centre on the `target` without zooming. |
| `follow` | Keeps a moving thing in the middle. |
| `tilt` | Tilts the sheet away, so it is seen at an angle, in perspective: `elevation` (degrees; 90 is flat on, 15 nearly edge-on; default 55) and `angle` (turning round, default 0). Things with `lift` stand off the sheet and cast a shadow on it. `rest` lays it flat again; other shots keep the tilt. |
| `fly` | Flies the camera across the sheet to the `target`, rising up (higher the further it goes) and coming down, rather than sliding. Default `blend` 2.4 seconds. |
| `orbit` | Space scenes: circles round, `turns` times (default 1), over the beat (or `duration`). `elevation`, `distance`, `target` can change as it goes. |
| `look` | Space scenes: moves to look at the `target` (a 3D object or `[x, y, z]`) from `elevation`, `angle` (degrees) and `distance`; anything left out stays as it was. In space, `frame` fits a 3D object in view, `zoom` comes closer by `to` times, `rest` goes back to the scene's starting view. |

| Key | Values | Meaning |
| --- | --- | --- |
| `target` | a position, or a list | What to frame. |
| `padding` | `none`, `small`, `medium`, `large` | Space left round the target. |
| `blend` | seconds, or `"cut"` | How long the move takes. Default 1.2. |
| `at` | `"45%"` or seconds | In a list: when this shot starts within the beat. |
| `ease` | as for `move` | |
| `style` | `steady`, `drift`, `breathe` | |

With no camera beat, the camera stays at rest. When a column of `work`
reaches the bottom of the frame, the camera moves down with it by itself.

---

## 27. Sound

### Music

```json
"music": [
  { "file": "calm.mp3", "volume": 0.25, "loop": true, "fade_in": 2, "fade_out": 4, "duck": 0.4 },
  { "file": "bright.mp3", "start_line": 20, "volume": 0.3 }
]
```

| Key | Values | Meaning |
| --- | --- | --- |
| `file` | file name | Required. |
| `volume` | 0 to 2 | Default 0.3. |
| `start`, `start_line`, `start_cue` | | When it starts. |
| `end`, `end_line`, `end_cue` | | When it stops. |
| `loop` | `true` | Repeat to its end. |
| `fade_in`, `fade_out` | seconds | |
| `duck` | 0 to 1 | While the narrator speaks, the music drops to this share of its volume, and comes back up in the gaps. Default 0.5. 1 = no ducking. |

### Sounds made by the engine

With `"sounds": "soft"` or `"lively"`, the engine adds small sounds by
itself: a quiet pen sound while things are written or drawn (chalk on the
`board` theme), a soft pop as things pop or grow in, a gentle click when
pieces snap into place in `steps`, a whoosh on `slide` and `wipe`
transitions, a chime on a `tick`, a low note on a `cross`. They are made by
the engine, not files, and are the same on every render. `"lively"` plays
them louder; `"none"` turns them off.

Any beat can take `"sound": false` to stay silent, or `"sound": "chime"` to
pick its own: `pop`, `click`, `chime`, `whoosh`, `low`, `tick`, `chalk`,
`pen`, `swell`.

### sound (sfx, play)

`{ "at_cue": "boom", "do": "sound", "file": "drum.mp3", "volume": 0.8 }`:
plays a sound file once. `volume` 0 to 4 (default 1), `fade_in`, `fade_out`
(seconds), and `duration` to cut it off.

The preview plays the same mix as the export: narration, music, sound files
and the engine's sounds.

### sonify (hear_graph)

`{ "do": "sonify", "who": "f", "x": [-3, 3], "duration": 4 }`: in a graph
scene, a dot runs along the graph while a tone rises and falls with its
height. `low` and `high`: the lowest and highest notes in Hz (default 220
and 880). `color`.

---

## 28. Long videos: chapters, thumbnail, end screen

### Chapters

Each scene with a `chapter` starts a new chapter. On export the engine writes
`chapters_<language>.txt`, ready to paste into the YouTube description:

```
0:00 Introduction
1:42 Seeing it with squares
4:10 The algebra
```

YouTube needs the first chapter to start at 0:00, at least three chapters,
and each at least 10 seconds long. The checker warns when these are not met.

A scene can also show its chapter title on screen as it starts with
`"chapter_card": true`.

### Subtitle files for YouTube

Each language's video is exported with an `.srt` subtitle file of its
narration, to upload to YouTube, whatever `captions` says.

### Thumbnail (coming)

```json
"thumbnail": { "at_line": 6, "text": { "en": "The missing piece", "hi": "छूटा हुआ हिस्सा" }, "position": "left", "size": "huge" }
```

The frame at that moment, with big words over it, saved as a 1280×720
picture for each language. Or `"file"` to use your own picture with the
words over it.

### End screen (coming)

`"end_screen": 20` keeps the last 20 seconds clear in the places where
YouTube puts its end-screen buttons, and the checker warns if anything is
drawn there.

### Making a long video (coming)

The engine page shows the scenes in a list, with chapters. Scenes are made
separately and joined, so a change to one scene only makes that scene again.
The engine can make several scenes at once, one per worker, to finish a long
video faster.

---

## 29. Checks: maths, teaching, muted viewing

When the script is opened the engine lists every problem it finds in plain
English, with the place in the script and a suggested fix. Problems stop the
build. Warnings do not, but are worth reading.

### Maths checks

Each step of `steps` and each line of `work` is worked out at a dozen random
values and compared with the one before. An expression must give the same
values; an equation must be the same equation (both sides multiplied or
divided by the same amount is fine) or, with one unknown, have the same
solutions. A step that does not is reported as a warning:

> scenes[1].beats[3].lines[2]: "2x = 16" does not have the same solutions
> as "2x + 5 = 11" (x = 3 before, x = 8 after).

Lines with words in them (`\text`), `\value`, sums, integrals, limits,
inequalities or `±` are not checked. The wrong working in `mistake` is never
checked. Excuse one step with `"check": false` on it (or on the whole
`steps` or `work`), or all of them with `"checks": { "maths": false }`.

### Teaching checks

Warnings about how the lesson will feel to a viewer. They begin with
"teaching:" and never stop the video.

| Warning | When |
| --- | --- |
| Slow start | Nothing appears in the first 8 seconds. |
| Nothing moving | Nothing changes in a scene for more than 12 seconds. |
| Too much at once | Five or more beats start within 1.5 seconds (what a scene opens with is not counted). |
| Fast speech | With a made voice or a timed recording: a line is spoken faster than 3.6 words a second. |
| Missing reasons | A `work` of three or more lines has no `note` on any line. |
| No question | A video longer than five minutes has no `question` or `wait`. |
| No recap | A video longer than five minutes has no `recap`. |
| Off the frame | On-screen words run off the edge of the frame. |

Turn them all off with `"checks": { "teaching": false }`.

### Muted viewing

The engine's page has a **Muted preview**: the video plays with no sound and
no captions, as a viewer scrolling with the sound off would see it. A lesson
that still makes sense this way is clear. Places where the narration carries
something nothing on screen shows are hard to see any other way.

---

## 30. Names you can use

### Colours

`white`, `black`, `grey`, `light_grey`, `dark_grey`, `blue`, `light_blue`,
`dark_blue`, `teal`, `green`, `light_green`, `dark_green`, `yellow`, `gold`,
`orange`, `red`, `light_red`, `dark_red`, `pink`, `purple`, `light_purple`,
`brown`, `accent`, `ink`, `good`, `bad`. Each theme gives its own shade of
each, chosen to look right on its background. Or any hex colour.

### Languages

Written as their codes: `en` English, `hi` Hindi, `bn` Bengali, `te` Telugu,
`mr` Marathi, `ta` Tamil, `ur` Urdu, `gu` Gujarati, `kn` Kannada, `ml`
Malayalam, `or` Odia, `pa` Punjabi, `as` Assamese, `sa` Sanskrit, `ne`
Nepali, `es` Spanish, `fr` French, `de` German, `pt` Portuguese, `ar`
Arabic, `zh` Chinese, `ja` Japanese, `ko` Korean, `ru` Russian, `id`
Indonesian, and any other two-letter language code. Text in every script is
drawn with its letters joined correctly. Arabic and Urdu read right to left;
maths in them still reads left to right.

### In plain maths (`math`)

Numbers: `3`, `2.5`, `1/2`. Letters: any single letter, and Greek by name
(`alpha`, `beta`, `theta`, `pi`, `phi`, `lambda`, `sigma`, `omega`). The
constants `pi` and `e`, and `i` on a complex plane. Functions: `sin`, `cos`,
`tan`, `sec`, `csc`, `cot`, `asin`, `acos`, `atan`, `sinh`, `cosh`, `tanh`,
`sqrt`, `cbrt`, `root(x, n)`, `abs`, `floor`, `ceil`, `round`, `sign`, `exp`,
`ln`, `log` (base 10), `log(x, b)`, `min`, `max`, `factorial` or `n!`,
`nCr(n, r)`, `nPr(n, r)`. Signs: `+ - * / ^ ( ) = < > <= >= !=`.

### Sheet sizes

`small`, `medium`, `large`, `huge` mean, for maths: letters 0.35, 0.5, 0.75,
1.2 sheet units high.

---

## 31. Rules

1. The file must be valid JSON: double quotes, no trailing commas, no
   comments. Backslashes in LaTeX are written twice.
2. Every beat needs a start: `at_line`, `at_cue`, `then`, `after`, `with` or
   `at`. `at_word` only works with `at_line`.
3. Every beat needs `do` or `camera` (or both).
4. Line numbers start at 1. Cue names are unique in the whole video, and
   every language's line has the same cues.
5. Every line has words in every language of the video.
6. A thing can only be referred to after it exists in that scene (or is
   carried in with `keep`). Ids are unique in a scene.
7. There are five worlds: `board`, `graph`, `geometry`, `counting`, `space`.
   Each action works only in the worlds section 10 lists for it.
8. Things on the world's own axes or number line need no `on`; things on any
   other set name it with `on`. `transform_plane` needs axes made with
   `plane: true`.
9. Scenes are in time order, and every scene after the first needs
   `start_line`, `start_cue` or `start`.
10. `number` in a card, and `to` and `from` in a counter, are numbers, not
    text.
11. Every picture, sound, drawing, font and model named in the script must be
    opened with it, with exactly that file name.
12. Use only the words in this document. Misspelt settings are ignored with
    a warning; misspelt names stop the build with a message that suggests the
    nearest correct word.
13. Long text wraps onto more lines; it is not shrunk to fit.
14. The same script makes the same video, every time, in every language.
