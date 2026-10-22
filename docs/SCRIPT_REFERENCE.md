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
| `scene:` | A kind of scene, a background | 9, 10 |
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
10. Flat scenes and space scenes
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
24. The mascot
25. On-screen graphics
26. Camera
27. Sound
28. Long videos: chapters, thumbnail, end screen
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
    ├── stage: "flat" or "space"                             (which kind of world)
    ├── style / background / camera_style                    (how that world looks)
    ├── place                                                (things there from the start)
    └── beats                                                (what happens, and when)
        ├── a time:   at_line / at_cue / at_word / at / then / after
        ├── do:       one action (write, steps, plot, construct ...)
        └── camera:   one shot, or a list of shots
```

Two kinds of world:

| Stage | What it is | Use it for |
| --- | --- | --- |
| `flat` | An endless flat sheet, seen from the front. Equations, graphs, shapes and geometry all live on it. The camera can pan, zoom, and tilt it into depth. | Almost everything. |
| `space` | A 3D world with axes, light and a camera that can circle round. | Surfaces, solids, 3D vectors, volumes. |

On a flat scene you add what you need: an equation, a set of axes, a number
line, a triangle. One scene can hold all of them at once.

On top of either stage sit the **on-screen graphics**: titles, text, cards,
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
| Narration audio | `voice` (made by the engine), or `audio` per language | mp3, wav, m4a, ogg. See section 7. |
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

Voices made by the engine are kept in the project as `voice_<language>.mp3`
with their timings, and made again only when a line's words change.

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
| `audio`, `subtitles` | no | a file per language | Your own recording and its subtitle file, instead of a made voice. |
| `theme` | no | a theme name, or an object (section 5) | Colours and fonts of the whole video. Default `"night"`. |
| `style` | no | a style name (section 5) | How lines and letters are drawn. Default `"vector"`. |
| `symbols` | no | `{ symbol: colour }` (section 6) | Colours that mean something, used everywhere. |
| `format` | no | `"landscape"`, `"landscape_4k"`, `"square"`, `"reel"` | Frame shape. `landscape` = 1920×1080, `landscape_4k` = 3840×2160, `square` = 1080×1080, `reel` = 1080×1920. Default `landscape`. |
| `fps` | no | 24, 30, 60 | Frames a second. Default 60. |
| `captions` | no | object (section 8) | How subtitles are shown. |
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
| `whiteboard` | Marker on a whiteboard, with a hand that draws each line as it appears. |
| `neon` | Glowing tubes of light on black. |
| `blueprint` | White lines on blue paper, with faint grid and construction marks. |
| `paper` | Shapes cut from coloured paper, with soft shadows and paper grain. |
| `solid` | Letters and shapes as solid raised objects, lit, casting shadows, seen with depth. |

A scene can have its own `style`, and one object can too:

```json
{ "stage": "flat", "style": "chalk", "beats": [] }
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

These change the finished picture, as in a film:

| Key | Values | Meaning |
| --- | --- | --- |
| `grade` | `none`, `warm`, `cold`, `faded`, `mono`, `vivid` | Colour of the whole picture. |
| `glow` | 0 to 1 | Bright parts glow. |
| `depth` | 0 to 1 | Things the camera is not looking at go out of focus (when the camera tilts or in space). |
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

### Voices

The engine makes the narration with a text-to-speech voice. Each word's exact
time comes back with the voice, so pictures land precisely on the words.

```json
"voice": {
  "provider": "elevenlabs",
  "en": { "voice": "Narrator A", "speed": 1, "style": 0.3 },
  "hi": { "voice": "Narrator B" }
}
```

| Key | Values | Meaning |
| --- | --- | --- |
| `provider` | `"elevenlabs"`, `"openai"`, `"google"`, `"azure"` | Which service makes the voice. Needs that service's key in the engine's settings. Default `"elevenlabs"`. |
| a language code | object | The voice for that language. |
| `voice` | a voice name or id | Which voice. |
| `speed` | 0.7 to 1.3 | Default 1. |
| `style`, `stability` | 0 to 1 | How expressive, and how even, if the service offers it. |
| `say` | `{ word: how to say it }` | Words the voice says wrongly, and how to say them: `{ "sin": "sine", "lim": "limit" }`. Can be given per language. |

Maths written inside a line between dollar signs, `"so $x^2$ grows fast"`,
is read aloud in words in each language ("x squared", "x का वर्ग") and shown
in the captions as maths.

### Your own recording instead

```json
"audio": { "en": "narration_en.mp3", "hi": "narration_hi.mp3" },
"subtitles": { "en": "narration_en.srt", "hi": "narration_hi.srt" }
```

The subtitle file's lines are used as the `lines`. Cue marks can be written
inside the subtitle text in the same way. Word times are then estimated from
word lengths: close, not exact.

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
page, or **Export all** to make every one. Each language's video follows its
own voice: scenes, beats and cues move to fit how long each line takes in
that language.

---

## 8. Captions

The words being said are drawn on the video:

```json
"captions": { "style": "karaoke", "position": "bottom", "size": "medium" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `style` | `"karaoke"`, `"plain"`, `"none"` | `karaoke`: a few words at a time, the word being spoken lit in the accent colour. `plain`: the whole line in a dark box. `none`: no captions drawn (YouTube subtitle files are still written, section 28). Default `"none"`. |
| `position` | `"bottom"`, `"top"` | Default `bottom`. |
| `size` | `"small"`, `"medium"`, `"large"` | Default `medium`. |
| `maths` | `true`, `false` | Show maths in captions as maths (`x²`), not as words. Default `true`. |

---

## 9. Scenes and transitions

```json
{
  "name": "The picture proof",
  "chapter": "Seeing it with squares",
  "stage": "flat",
  "start_line": 6,
  "transition": "fade",
  "beats": []
}
```

| Key | Values | Meaning |
| --- | --- | --- |
| `stage` | `"flat"`, `"space"` | Kind of world. Default `flat`. |
| `name` | text | Used in messages and the preview's list of scenes. |
| `chapter` | text, or text per language | Starts a new YouTube chapter here (section 28). |
| `start_line` | a line number or id | The scene begins when this line begins. |
| `start_cue` | a cue name | The scene begins at this cue. |
| `start` | seconds | The scene begins at this time. Only for videos with no narration. |
| `transition` | see below | How this scene arrives. Default `cut`. Ignored on the first scene. |
| `transition_duration` | seconds | Default 1. |
| `keep` | list of ids, or `"all"` | Things from the scene before that carry over into this one, in the same place. |
| `style`, `theme`, `symbols` | as at the top | For this scene only. |
| `grade`, `glow`, `depth`, `camera_style` | section 5 | For this scene only. |
| `background` | see below | What is behind everything. |
| `place` | list (section 14) | Things there from the start. |
| `beats` | list | What happens. |

| Transition | What it looks like |
| --- | --- |
| `cut` | Instant change. |
| `fade` | The new scene fades in over the old. |
| `black` | Down to the background colour, and up again. |
| `morph` | Things in both scenes with the same `id` glide and change into their new form; the rest fade. The smoothest way to move on. |
| `slide` | The old scene slides away and the new one slides in from the right (`slide_left`, `slide_up`, `slide_down` for other directions). |
| `fly` | The camera flies across the endless sheet to where the new scene is, as if the lesson were laid out on one huge board. |
| `wipe` | A soft edge sweeps across. |
| `zoom` | The camera dives into the thing named by `into` (an id from the scene before), and the new scene opens out of it. |
| `rub` | The old scene is rubbed off as if from a board. Best with `chalk` and `whiteboard`. |
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
| `image` | file | A picture or clip behind everything. |
| `dim`, `blur` | 0 to 1 | Darken or blur the picture so the maths reads over it. |

---

## 10. Flat scenes and space scenes

### Flat

The sheet is endless. With the camera at rest, the frame shows a part of it
**16 units wide and 9 high** (on `reel`, 9 wide and 16 high), with `0, 0` in
the middle. Most of the time no numbers are needed: things are placed by
words (section 12).

The camera can move round the sheet, zoom in on any part of it, and tilt it
so it is seen at an angle, with depth (section 26). Things on the sheet can
lift off it a little with `"lift"`, so a tilted sheet shows layers.

### Space

A 3D world, seen through a camera that can circle round. `x` runs to the
right, `y` away from the viewer, `z` up, as in maths books. A space scene has
`light`:

| Key | Values | Meaning |
| --- | --- | --- |
| `light` | `"soft"`, `"studio"`, `"dramatic"`, `"flat"` | `soft`: even light from above. `studio`: a key light and a fill, gentle shadows. `dramatic`: one strong light, deep shadows. `flat`: no shading at all, colours as they are. Default `soft`. |
| `floor` | `true`, `false` | A faint floor grid under everything. Default `false`. |
| `camera` | `{ "elevation", "angle", "distance" }` | Where the camera starts. |

Flat things (equations, text, labels) placed in a space scene always turn to
face the camera unless given `"face": false`.

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

Wherever a setting takes a position (`at`, `to`, `from`, `toward`, `target`),
it can be any of:

| Form | Example | Meaning |
| --- | --- | --- |
| A screen place | `"center"`, `"top"`, `"bottom_left"` | One of the nine places on the frame (below), where the camera is at rest. |
| An object | `"eq1"`, `"tri"` | Its middle. |
| A named spot | `"eq1.right"`, `"tri.A"`, `"c.center"`, `"eq1.mid"` | A spot on an object or a part (section 14). |
| A relation | `{ "below": "eq1" }`, `{ "right_of": "tri", "gap": "large" }` | Next to something. |
| A point on axes | `{ "on": "ax", "x": 2, "y": 3 }` | At those numbers on a set of axes. |
| A point on a graph | `{ "on": "f", "x": 2 }` | On that graph, above that number. |
| A point on a number line | `{ "on": "nl", "x": 0.75 }` | At that number. |
| Sheet numbers | `[3, -1.5]` | That far right and up from the middle of the sheet. In space: `[x, y, z]`. |

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
{ "at_line": 5, "offset": 0.5, "duration": 2, "do": "plot", "on": "ax", "math": "x^2" }
```

### Several things in turn

An action that makes several things (`write` of a list, `chips`, `draw` of a
list, `construct` with several steps) can lay them out one after another
with `lag`: the seconds between one starting and the next.

### Waiting for the viewer

A beat can hold the whole video still, with no narration, for a moment:

```json
{ "at_cue": "try", "do": "wait", "duration": 5, "countdown": true }
```

`wait` stops everything, voice included, for its length, then carries on. It
is how a "pause and try it" moment is made (section 23).

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
  { "do": "axes", "id": "ax", "x": [-4, 4], "y": [-2, 6] },
  { "do": "plot", "id": "f", "on": "ax", "math": "x^2" }
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

### Groups

```json
{ "do": "group", "id": "both", "who": ["eq1", "eq2"] }
```

A group can be moved, coloured and removed as one thing.

### Common settings

Every object can take:

| Key | Values | Meaning |
| --- | --- | --- |
| `id` | text | Its name. |
| `at` | a position (section 12) | Where it goes. |
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
{ "at_line": 3, "do": "write", "id": "eq2", "tex": "= a^2 + 2ab + b^2", "at": { "right_of": "eq1", "gap": "small" } }
{ "at_line": 4, "do": "write", "tex": ["x = 1", "x = 2", "x = 3"], "lag": 0.4 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `tex` or `math` | text, or a list | Required. A list writes several lines, one under another. |
| `id` | text | With a list, the lines are `id.1`, `id.2` ... |
| `at`, `size`, `color`, `appear` | section 14 | |
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
| `new_line` | `true` | Keep the old line and write the new one below it, lined up on `=`, as in a column of working. |
| `note` | text | A short reason, written beside the step in a smaller size, such as `"subtract 5 from both sides"`. |
| `note_at` | `right`, `left` | Default `right`. |
| `check` | `true`, `false` | Check that the new step is really equal to the old (section 29). Default `true`. |
| `lag` | seconds | With a list: time between steps. |

### work (derivation, column)

A whole column of working at once: each line arrives in turn, lined up on
`=`, each with its reason.

```json
{ "at_line": 4, "do": "work", "id": "w", "at": "left", "lines": [
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
reason.

```json
{ "at_line": 4, "do": "solve", "id": "w", "math": "3x + 5 = 20", "for": "x" }
{ "at_line": 9, "do": "solve", "math": "x^2 - 5x + 6 = 0", "for": "x", "method": "factor" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `tex` or `math` | text | Required. An equation, an inequality, or an expression. |
| `for` | a letter | What to solve for. |
| `method` | `auto`, `factor`, `formula`, `complete_square`, `expand`, `simplify`, `differentiate`, `integrate` | How. Default `auto`. |
| `max_steps` | number | Stop after this many. |
| `language` | | The reasons are written in each language of the video. |

When the script is opened the engine shows the steps it found. Copy them
into a `work` beat to change any of them.

### highlight (indicate, emphasise)

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

### evaluate (calculate, simplify)

Works the expression out to its value, step by step or at once:
`"steps": true` shows each sum on the way, otherwise the expression melts
straight into its answer.

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
{ "at_line": 3, "do": "draw", "shape": "square", "id": "big", "size": 4, "at": "left" }
{ "at_line": 4, "do": "draw", "shape": "arrow", "from": "eq1.right", "to": "eq2.left" }
{ "at_line": 5, "do": "draw", "shape": "circle", "id": "c", "radius": 2, "fill": "blue", "fill_opacity": 0.3 }
```

| Shape | Its own keys |
| --- | --- |
| `line` | `from`, `to`. `extend`: `true` to run on past both ends. |
| `arrow` | `from`, `to`. `tip`: `end` (default), `start`, `both`. `curve`: a number; bows the arrow, as for `arc`. |
| `dashed` | A dashed line: `from`, `to`. |
| `dot` | `at`, `radius`. |
| `circle` | `at`, `radius`. |
| `ellipse` | `at`, `width`, `height`. |
| `arc` | `at`, `radius`, `from_angle`, `to_angle` (degrees); or `from`, `to` and `bend`. |
| `square` | `at`, `size`. |
| `rectangle` | `at`, `width`, `height`, `corner` (rounding). |
| `polygon` | `points` (a list of positions) and optional `names` for its corners (`["A", "B", "C"]`). |
| `regular` | `sides`, `at`, `radius`. A regular polygon. |
| `star` | `points`, `at`, `radius`. |
| `brace` | `from`, `to`, `text`. A curly bracket between two points. |
| `path` | `file`: an svg drawing, drawn on stroke by stroke. Or `points` for a smooth curve through them. |
| `grid` | `at`, `rows`, `columns`, `size`. |
| `cross`, `tick` | `at`, `size`. |

Every shape also takes:

| Key | Values | Meaning |
| --- | --- | --- |
| `color` | a colour | Line colour. |
| `width` | a number | Line width. Default 4 (in design pixels at 1080 high). |
| `fill` | a colour, or `false` | Inside colour. |
| `fill_opacity` | 0 to 1 | Default 0.6 when a `fill` is given. |
| `dash` | `true` | Dashed line. |
| `glow` | `true` | The line glows. |
| `label` | text | A name beside it. `label_at`: a named spot. |
| `size`, `at`, `appear`, `id`, `key`, `lift` | section 14 | |

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

### turn, scale, flip

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

### show, hide, remove

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

A pointer moves to a thing and taps it: `"on"`, and `"as"` `arrow` (default),
`hand`, `chalk`, `dot`. A list of `on` points at each in turn.

### trace_path (trail)

Something moving leaves a fading trail behind it: `"who"`, `"length"`
(seconds of trail), `"color"`.

### spring, wobble

`{ "do": "wobble", "who": "eq1" }`: a quick jelly-like shake, for a moment of
surprise.

---

## 18. Actions: graphs and planes

### axes (coordinate_system)

```json
{ "at_line": 1, "do": "axes", "id": "ax", "x": [-5, 5], "y": [-3, 8], "at": "center" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `x`, `y` | `[from, to]` or `[from, to, step]` | Range of each axis, and the gap between tick marks. Default step: chosen to give clear numbers. |
| `width`, `height` | sheet units | Size on the sheet. Default: fill most of the frame. |
| `numbers` | `true`, `false`, or `"x"`, `"y"` | Numbers along the axes. Default `true`. |
| `labels` | `["x", "y"]` | Names at the ends of the axes. Default `x`, `y`. |
| `grid` | `true`, `false`, `"faint"` | Grid lines. Default `false`. |
| `ticks` | `"pi"` | Mark the x axis in multiples of π, for trigonometry. |
| `arrows` | `true`, `false` | Arrow tips at the axis ends. Default `true`. |
| `log` | `"x"`, `"y"`, `"both"` | Log scale. |
| `polar` | `true` | A polar grid of circles and spokes, instead of squares. |
| `plane` | `true` | A full number plane: grid lines across the whole frame, with the main axes brighter. Needed for `transform_plane`. |
| `complex` | `true` | Label it as the complex plane (`Re`, `Im`, and `i` on the upright axis). |

Things can be placed on axes with positions like `{ "on": "ax", "x": 2, "y": 3 }`.

The axes can grow or change range later, smoothly, with `rescale`:
`{ "do": "rescale", "who": "ax", "x": [-10, 10] }`. Everything drawn on them
follows.

### plot (graph, curve, function)

```json
{ "at_line": 2, "do": "plot", "id": "f", "on": "ax", "math": "x^2 - 2" }
{ "at_line": 3, "do": "plot", "id": "g", "on": "ax", "math": "a * sin(k * x)", "label": "$g(x)$" }
{ "do": "plot", "on": "ax", "x_of_t": "cos(t)", "y_of_t": "sin(2*t)", "t": [0, 6.283] }
{ "do": "plot", "on": "ax", "r_of_theta": "1 + cos(theta)" }
{ "do": "plot", "on": "ax", "implicit": "x^2 + y^2 = 9" }
{ "do": "plot", "on": "ax", "math": "y > x^2 - 2", "fill": "blue" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `on` | an axes id | Required. |
| `math` or `tex` | an expression in `x`, or `y = ...`, or an inequality | The function. An inequality shades the region where it is true. |
| `x_of_t`, `y_of_t`, `t` | expressions and a range | A curve traced by `t`. |
| `r_of_theta`, `theta` | an expression and a range | A polar curve. Default range 0 to 2π. |
| `implicit` | an equation in `x` and `y` | A curve where the equation holds. |
| `x` | `[from, to]` | Draw only this part. |
| `label` | text, maths in `$` | A name near the end of the curve. `label_at`: `{ "x": 2 }` to put it elsewhere. |
| `color`, `width`, `dash`, `glow` | | As for shapes. Default colour: from `symbols` by `id`, else the next theme colour. |
| `draw` | `left_to_right`, `from_middle`, `all` | How the curve is drawn on. Default `left_to_right`. |
| `breaks` | `true`, `false` | Leave gaps where the function jumps or runs off to infinity, instead of joining across. Default `true`. |

Every expression can use the named values of the scene (below).

### value (parameter, slider)

A named number that can change over time. Every graph, label, counter or
equation that uses it changes with it.

```json
{ "at_line": 4, "do": "value", "name": "a", "start": 1, "slider": { "at": "top_right", "range": [0, 3] } }
{ "at_line": 5, "do": "set", "name": "a", "to": 2.5, "duration": 3 }
{ "at_line": 6, "do": "set", "name": "a", "to": [0.5, 2, 1], "duration": 6 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `name` | a letter or short name | Required. |
| `start` | number | Its value at first. |
| `slider` | `false`, or `{ "at", "range", "label" }` | A small slider on screen whose knob shows the value. |
| `show` | a position | Instead of a slider: just its number, `a = 1.25`, at that place. |
| `decimals` | number | How many decimals to show. Default 2. |

`set` changes a value over its beat. `to` as a list goes through each value
in turn. `ease` as for `move`.

Equations can show the live value: `"tex": "y = \\value{a} x^2"` writes the
current number in place of `\value{a}`.

### point (dot_on)

A dot on a graph or axes, which can be moved.

```json
{ "at_line": 3, "do": "point", "id": "P", "at": { "on": "f", "x": 1 }, "label": "P", "drops": true, "coords": true }
{ "at_line": 4, "do": "slide", "who": "P", "to": { "on": "f", "x": 3 }, "duration": 4 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `drops` | `true`, `"x"`, `"y"` | Dashed lines down to the x axis and across to the y axis. |
| `coords` | `true` | Its coordinates written beside it, updating as it moves: `(1.00, 1.00)`. |
| `label` | text | A name beside it. |
| `trace` | `true`, or a colour | Leaves a line behind it as it moves. |

`slide` moves a point along whatever it is on: along its graph, or across
its axes.

### mark (feature)

Finds and marks a special point on a graph:

```json
{ "at_line": 5, "do": "mark", "on": "f", "find": "roots" }
{ "at_line": 6, "do": "mark", "on": ["f", "g"], "find": "intersections", "label": "coords" }
```

`find`: `roots`, `max`, `min`, `turning`, `intersections` (of two graphs),
`y_intercept`, `inflection`. `label`: `true`, `"coords"`, or text.

### tangent (slope_line)

```json
{ "at_line": 7, "do": "tangent", "id": "t", "on": "f", "x": 1, "length": 4, "slope": true }
{ "at_line": 8, "do": "slide", "who": "t", "to": 3, "duration": 5 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `on`, `x` | a graph, a number | Required. Where it touches. |
| `length` | sheet units | How long the line is drawn. |
| `slope` | `true` | Shows the slope's value beside it, updating as it slides. |
| `triangle` | `true` | A small rise-over-run triangle on the line, with `dx` and `dy` written on its sides. |

`slide` on a tangent moves where it touches to a new `x`.

### secant (chord)

A line through two points of a graph: `on`, `x`, `dx`. `"close_in": true`
over its beat makes `dx` shrink towards nothing, so the secant turns into the
tangent: the meaning of a derivative.

### area (integral, shade)

```json
{ "at_line": 9, "do": "area", "on": "f", "x": [0, 2], "color": "blue" }
{ "at_line": 10, "do": "area", "between": ["f", "g"], "x": [-1, 1] }
{ "at_line": 11, "do": "area", "on": "f", "x": [0, 2], "rectangles": 4, "rule": "left" }
{ "at_line": 12, "do": "refine", "who": "rects", "to": 64, "duration": 5 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `on` or `between` | a graph, or two | Required. |
| `x` | `[from, to]` | Required. May use named values, so the area can grow as one changes. |
| `rectangles` | number | Fill the area with this many rectangles instead. |
| `rule` | `left`, `right`, `middle`, `trapezium` | Where each rectangle meets the curve. |
| `value` | `true` | Shows the area's size beside it, updating. |
| `fill_from` | `left`, `bottom` | Fill sweeps in from that side. |

`refine` makes rectangles thinner and more numerous over its beat.

### asymptote, limit

`{ "do": "asymptote", "on": "ax", "x": 2 }` or `"y": 0`: a dashed line the
graph approaches. `{ "do": "limit", "on": "f", "x": 2, "from": "both" }`:
dots run along the graph towards `x` from one side or both, with their
values shown, closing in.

### shift_graph (transform_graph)

Moves, stretches or reflects a graph, so `y = x²` becomes `y = (x − 3)² + 1`
with a ghost of the old one left behind:

```json
{ "at_line": 6, "do": "shift_graph", "who": "f", "to": "(x-3)^2 + 1", "ghost": true }
```

Show the change with arrows between matching points with `"arrows": true`.

### table_of_values (values_table)

A small table of `x` and `f(x)` that fills in row by row, a dot appearing on
the graph for each row: `"on": "f"`, `"x": [-2, -1, 0, 1, 2]`, `"at"`.

### vector (arrow_on)

`{ "do": "vector", "id": "v", "on": "ax", "to": [2, 1], "label": "$\\vec{v}$" }`.
`from` defaults to the origin. `"coords": true` writes its column beside it.

`{ "do": "add_vectors", "who": ["v", "w"] }`: the second slides to the tip of
the first, and the sum is drawn.

### field (vector_field, flow)

```json
{ "at_line": 4, "do": "field", "on": "ax", "x_part": "-y", "y_part": "x", "as": "arrows" }
{ "at_line": 6, "do": "field", "on": "ax", "x_part": "y", "y_part": "-sin(x)", "as": "flow" }
```

`as`: `arrows` (a grid of arrows sized by strength), `flow` (thousands of
small specks streaming along the field), `lines` (stream lines drawn on).
`density`, `color`; colour can be `"by_strength"`.

### transform_plane (apply_matrix, warp)

The whole grid of a number plane moves, so the viewer sees what a matrix or a
function does to every point at once.

```json
{ "at_line": 3, "do": "axes", "id": "p", "plane": true }
{ "at_line": 4, "do": "transform_plane", "who": "p", "matrix": [[2, 1], [0, 1]], "duration": 3 }
{ "at_line": 7, "do": "transform_plane", "who": "p", "map": "z^2", "duration": 4 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `who` | axes made with `plane: true` | Required. |
| `matrix` | `[[a, b], [c, d]]` | A 2×2 matrix. |
| `map` | an expression in `z` | A complex function, for a complex plane. |
| `x_part`, `y_part` | expressions in `x`, `y` | Any map of the plane. |
| `basis` | `true` | Show the two basis arrows (`î` green, `ĵ` red by default), carried along. |
| `carry` | list of ids | Other things on the plane (vectors, shapes, points) carried along with it. |
| `ghost` | `true` | Keep a faint copy of the grid as it was. |
| `undo` | `true` | Go back to the plain grid. |

---

## 19. Actions: geometry

Geometry is built in steps, each depending on what was made before. When a
free point moves, everything built from it follows, so a figure can be
shown to stay true however it is changed.

### point, segment, line, ray, circle, polygon

```json
{ "at_line": 1, "do": "point", "id": "A", "at": [-3, -1], "label": "A" }
{ "at_line": 1, "do": "point", "id": "B", "at": [3, -1], "label": "B" }
{ "at_line": 1, "do": "point", "id": "C", "at": [1, 2.5], "label": "C" }
{ "at_line": 2, "do": "polygon", "id": "tri", "points": ["A", "B", "C"] }
{ "at_line": 3, "do": "circle", "id": "c", "center": "A", "through": "B" }
{ "at_line": 3, "do": "segment", "id": "AC", "from": "A", "to": "C" }
```

| Thing | Keys |
| --- | --- |
| `point` | `at`, `label`. A free point if `at` is a position; a dependent one if it uses `construct`. |
| `segment` | `from`, `to`. |
| `line` | `through`: two points. Runs to the edge of the frame. |
| `ray` | `from`, `through`. |
| `circle` | `center` and `radius` (a number, or a segment id), or `center` and `through`, or `through` three points. |
| `polygon` | `points`: a list of point ids. Its corners keep their names; sides are `tri.AB`. |
| `triangle` | A shortcut: `"kind"`: `any`, `right`, `equilateral`, `isosceles`, with `size` and `at`; corners named `A`, `B`, `C` unless `names` says otherwise. |

### construct (build)

Makes a new thing from others, by a rule:

```json
{ "at_line": 4, "do": "construct", "id": "M", "make": "midpoint", "of": "AB", "label": "M" }
{ "at_line": 5, "do": "construct", "id": "h", "make": "perpendicular", "from": "C", "to": "AB", "show_steps": true }
{ "at_line": 6, "do": "construct", "id": "X", "make": "intersection", "of": ["h", "AB"], "label": "H" }
```

| `make` | Needs | Gives |
| --- | --- | --- |
| `midpoint` | `of`: a segment, or two points | A point. |
| `perpendicular` | `from`: a point; `to`: a line or segment | A line, meeting at a right angle. |
| `parallel` | `through`: a point; `to`: a line | A line. |
| `bisector` | `of`: a segment (perpendicular bisector) or an angle (`"angle": ["B", "A", "C"]`) | A line. |
| `intersection` | `of`: two lines or circles. `which`: 1 or 2 when there are two | A point. |
| `foot` | `from`: a point; `to`: a line | The point where the perpendicular meets the line. |
| `reflect_point` | `of`: a point; `in`: a line or point | A point. |
| `tangent` | `to`: a circle; `at` a point on it, or `from` a point outside | A line, or two. |
| `circumcircle`, `incircle` | `of`: a triangle | A circle (and its centre, as `id.center`). |
| `centroid`, `orthocenter`, `circumcenter`, `incenter` | `of`: a triangle | A point. |
| `on` | `on`: a line, circle or polygon; `t`: 0 to 1 along it | A point that can slide along that thing. |

`show_steps: true` draws the construction the way it is done with a compass
and straightedge: the compass swings its arcs, the ruler lays its line, and
the marks stay faintly behind. `tools: true` shows the compass and ruler
themselves.

### angle (angle_mark)

```json
{ "at_line": 7, "do": "angle", "id": "a1", "at": ["B", "A", "C"], "show": "value" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `at` | three points: one arm, the corner, the other arm | Required. |
| `show` | `none`, `value`, `name`, or text | What is written in it: its size (`37°`), a letter (`"α"`), or any text. |
| `arcs` | 1, 2, 3 | Several arcs, to show equal angles. |
| `right` | `true` | Draw a small square instead (for a right angle). Done by itself when the angle is 90°. |
| `units` | `degrees`, `radians` | Default `degrees`. |
| `fill` | a colour | Fill the angle's slice. |

### equal (tick_marks)

Small ticks on sides to show they are equal: `{ "do": "equal", "who":
["tri.AB", "tri.AC"], "ticks": 2 }`. For parallel lines: `"as": "arrows"`.

### measure (length, dimension)

`{ "do": "measure", "who": "tri.AB", "show": "value" }`: a measuring line
beside a segment, with its length, updating as the figure changes. `text`
instead shows a name (`"c"`).

### drag (wiggle_point)

Moves a free point, and the whole figure follows:

```json
{ "at_line": 9, "do": "drag", "who": "C", "to": [-1, 3], "duration": 3 }
{ "at_line": 10, "do": "drag", "who": "C", "path": [[-1, 3], [2, 1], [1, 2.5]], "duration": 6 }
```

Angles, lengths and values shown with `show: "value"` change as it moves,
so a viewer sees what stays the same.

### translate, rotate, reflect, enlarge

Geometric transformations, with a ghost of the original left behind:

```json
{ "at_line": 11, "do": "rotate", "who": "tri", "by": 90, "around": "A", "id": "tri2", "ghost": true }
{ "at_line": 12, "do": "reflect", "who": "tri", "in": "l", "id": "tri3", "lines": true }
{ "at_line": 13, "do": "enlarge", "who": "tri", "by": 2, "center": "O", "id": "tri4", "rays": true }
{ "at_line": 14, "do": "translate", "who": "tri", "by": [3, 1], "id": "tri5", "arrow": true }
```

`id` names the image (corners keep their names with a dash: `A'`, `B'`).
`lines` (reflect): dashed lines joining each point to its image. `rays`
(enlarge): lines from the centre through each corner. `arrow` (translate):
the vector of the move.

### cut, rearrange_pieces (dissect)

Cuts a shape into pieces and moves them, for proofs by rearranging:

```json
{ "at_line": 15, "do": "cut", "who": "big", "into": "sectors", "count": 16, "id": "slices" }
{ "at_line": 16, "do": "rearrange_pieces", "who": "slices", "into": "strip", "duration": 4 }
```

`into` for `cut`: `sectors` (a circle into slices), `strips`, `grid`, or
`lines`: a list of segment ids to cut along. For `rearrange_pieces`:
`strip` (alternating, as for the area of a circle), `row`, `stack`, or
`places`: a list of positions and turns, one per piece.

---

## 20. Actions: number lines, counting, fractions and chance

### number_line

```json
{ "at_line": 1, "do": "number_line", "id": "nl", "x": [-5, 5], "at": "center" }
{ "at_line": 2, "do": "jump", "on": "nl", "from": -2, "by": 5, "label": "+5" }
{ "at_line": 3, "do": "interval", "on": "nl", "from": 1, "to": "inf", "open_start": true }
{ "at_line": 4, "do": "zoom_line", "who": "nl", "x": [0, 1], "duration": 3 }
```

| Action | Keys |
| --- | --- |
| `number_line` | `x` (range, and step), `numbers`, `fractions` (`true` to label in fractions), `width`. |
| `jump` | `on`, `from`, `by` (or `to`), `label`, `count` (several equal jumps, as in multiplication). An arc hop with an arrow tip. |
| `interval` | `on`, `from`, `to` (a number or `"inf"`, `"-inf"`), `open_start`, `open_end`. A bold stretch with filled or hollow ends. |
| `zoom_line` | `who`, `x`. The line smoothly zooms to a new range, new marks appearing between the old as it goes. |

A point on a number line is `{ "on": "nl", "x": 0.75 }`.

### dots, blocks, objects (array)

```json
{ "at_line": 1, "do": "dots", "id": "d", "rows": 3, "columns": 4, "color": "blue" }
{ "at_line": 2, "do": "group_items", "who": "d", "by": "row" }
{ "at_line": 3, "do": "morph", "who": "d", "into": { "do": "write", "tex": "3 \\times 4 = 12" } }
```

| Action | Keys |
| --- | --- |
| `dots` | `count`, or `rows` and `columns`; `shape`: `dot`, `square`, `star`, `apple`, `coin`, `person`, `ball`, or a picture `file`; `size`, `gap`. Each item is `d.1`, `d.2` ... |
| `blocks` | Base-ten blocks: `number` (such as 243). Hundreds as flats, tens as rods, ones as cubes. |
| `regroup` | `who`: blocks; `carry`: `true` (ten ones join into a ten) or `borrow` (a ten breaks into ones). |
| `group_items` | `who`, `by`: `row`, `column`, or a size (`5`). Rings appear round each group. |
| `count_items` | `who`. Each item lights in turn with its number beside it. |
| `tally` | `count`, in tally marks drawn in fives. |

### fraction (fraction_bar, pie)

```json
{ "at_line": 4, "do": "fraction", "id": "fr", "as": "bar", "parts": 4, "shade": 3 }
{ "at_line": 5, "do": "split", "who": "fr", "into": 8 }
{ "at_line": 6, "do": "fraction", "id": "p", "as": "pie", "parts": 6, "shade": 2, "at": "right" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `as` | `bar`, `pie`, `grid`, `line` | The picture. |
| `parts`, `shade` | numbers | How many equal parts, how many shaded. |
| `label` | `true` | The fraction written beside it. |

`split` cuts every part into smaller equal parts (showing ¾ = 6⁄8).
`combine` joins them back. `line_up`: `{ "do": "line_up", "who": ["fr",
"p"] }` lines up two fractions, one above the other, the same length.

### coin, dice, spinner, cards

Chance done visibly, always landing where the script says:

```json
{ "at_line": 2, "do": "coin", "id": "c", "results": ["H", "T", "H", "H"], "lag": 0.6 }
{ "at_line": 3, "do": "dice", "id": "d", "count": 2, "results": [[3, 4], [6, 6]] }
{ "at_line": 4, "do": "spinner", "parts": ["red", "blue", "blue", "green"], "result": 2 }
```

Coins flip, dice roll and settle, spinners spin and slow, cards turn over,
landing on the given `results`. `random: 50` instead throws 50 times with
seeded random results (the same every render), and `tally: true` keeps count
on screen.

### tree (probability_tree)

```json
{ "at_line": 5, "do": "tree", "id": "t", "levels": [
  [{ "label": "H", "p": "1/2" }, { "label": "T", "p": "1/2" }],
  [{ "label": "H", "p": "1/2" }, { "label": "T", "p": "1/2" }]
], "grow": "level" }
```

Branches grow level by level (`level`) or one path at a time (`path`), each
with its chance written on it. `{ "do": "highlight", "who": "t.HT" }` lights
one path.

### sample_space (outcome_grid)

A grid of every outcome of two things (such as two dice), with cells lit for
an event: `"rows"`, `"columns"`, `"light"`: a rule in `r` and `c` (`"r + c
== 7"`).

### chart

See section 25.

---

## 21. Actions: 3D

These need a `space` scene.

### axes3d

`{ "do": "axes3d", "id": "ax", "x": [-3, 3], "y": [-3, 3], "z": [0, 5] }`.
Keys as for `axes`, with `z`.

### surface

```json
{ "at_line": 2, "do": "surface", "id": "s", "on": "ax", "math": "x^2 + y^2", "color": "by_height" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `math` | `z = f(x, y)` or an expression in `x`, `y` | The surface. Named values work, so it can change shape. |
| `x_of_uv`, `y_of_uv`, `z_of_uv`, `u`, `v` | | A surface traced by `u` and `v` (a sphere, a torus, anything). |
| `color` | a colour, or `"by_height"` | `by_height` shades from low to high in the theme's colours. |
| `mesh` | `true` | Grid lines on the surface. |
| `opacity` | 0 to 1 | See-through. |
| `grow` | `rise`, `sweep`, `all` | How it arrives. `rise`: rises out of the flat floor. |

### solid

`{ "do": "solid", "shape": "cube", "id": "k", "size": 2 }`. Shapes: `cube`,
`cuboid` (`width`, `depth`, `height`), `sphere`, `cylinder`, `cone`, `prism`
(`sides`), `pyramid` (`sides`), `tetrahedron`, `octahedron`,
`dodecahedron`, `icosahedron`, `torus`. Or `model`: a name from `models`.

`edges: true` draws the edges. `wire: true` draws edges only.

### revolve (solid_of_revolution)

`{ "do": "revolve", "who": "f", "around": "x", "x": [0, 2], "duration": 4 }`:
the area under a graph sweeps round an axis and becomes a solid. Works with a
graph from a flat axes carried into a space scene with `keep`.

### slice (cross_section)

`{ "do": "slice", "who": "k", "plane": "z = 1", "show": "section" }`: a plane
cuts the solid; `show`: `section` (only the cut face lit), `apart` (the two
halves move apart). `"sweep": [0, 2]` moves the cutting plane through the
solid over the beat.

### stack_slices (volume_by_slices)

The solid is shown as a stack of thin discs or slabs, which can then
`refine` to thinner and thinner ones, as with rectangles under a graph.

### net (unfold, fold)

`{ "do": "net", "who": "k", "duration": 3 }`: the solid unfolds flat into its
net. `"fold": true` folds a net up into its solid.

### vector3d, plane3d, line3d

`{ "do": "vector3d", "on": "ax", "to": [1, 2, 2] }`.
`{ "do": "plane3d", "on": "ax", "math": "x + y + z = 3" }`.
`{ "do": "line3d", "on": "ax", "through": [[0, 0, 0], [1, 1, 2]] }`.

### Models

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

Things that are hard to draw by hand and beautiful to watch. They are drawn
by the graphics card, smoothly, and are the same on every render.

### fractal

```json
{ "at_line": 3, "do": "fractal", "kind": "mandelbrot", "zoom_to": [-0.7436, 0.1318], "zoom": 10000, "duration": 20 }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `kind` | `mandelbrot`, `julia`, `burning_ship`, `newton`, `sierpinski`, `koch`, `tree`, `dragon` | The first four fill the frame with colour. The last four are drawn as lines, level by level. |
| `c` | `[re, im]` | `julia`: its number. Can use named values, so the fractal shifts as one changes. |
| `zoom_to`, `zoom` | a point, a number | Dive into that point until that many times larger. |
| `levels` | number | Line fractals: how many levels, added one after another. |
| `palette` | a list of colours, or `"theme"` | Colouring. |

### domain_color (complex_colors)

`{ "do": "domain_color", "map": "(z^2 - 1) / (z^2 + 1)" }`: the complex plane
coloured by where each point is sent: hue for direction, brightness for size.
Roots and poles show as points where all colours meet.

### fourier (epicycles)

```json
{ "at_line": 5, "do": "fourier", "file": "outline.svg", "circles": 80, "duration": 15 }
```

Circles turning on circles, each riding the last, draw a picture. `circles`:
how many. `"add_circles": [1, 80]` starts with one and adds more over the
beat, so the drawing becomes more and more like the picture. A `math` square
or saw wave can be given instead of a picture: `"wave": "square"`.

### simulation (simulate)

```json
{ "at_line": 2, "do": "simulation", "kind": "pendulum", "length": 2, "angle": 40 }
{ "at_line": 4, "do": "simulation", "kind": "monte_carlo_pi", "points": 20000, "count": true }
{ "at_line": 6, "do": "simulation", "kind": "galton", "balls": 400, "rows": 12 }
```

| Kind | What it shows | Its keys |
| --- | --- | --- |
| `pendulum` | A swinging pendulum, with its path | `length`, `angle`, `double` (`true` for a chaotic double pendulum) |
| `projectile` | A thrown thing, with its curve | `speed`, `angle`, `on` (axes, so the path is a graph) |
| `spring` | A weight bouncing on a spring | `stiffness`, `damping` |
| `random_walk` | Walkers wandering at random | `walkers`, `steps`, `dimensions` (1 or 2) |
| `monte_carlo_pi` | Dots thrown into a square, those inside the circle counted, π estimated | `points`, `count` |
| `galton` | Balls falling through pegs into a bell shape | `balls`, `rows` |
| `orbits` | Planets round a sun | `bodies` |
| `heat`, `wave` | A bar or sheet where heat spreads, or a wave ripples | `start`: an expression, or `"spike"`, `"step"` |
| `game_of_life` | Cells living and dying | `pattern`, `size` |
| `sort` | Bars being sorted step by step | `method`: `bubble`, `insertion`, `merge`, `quick`; `count` |

Simulations are worked out once when the script is opened, so they can be
jumped through and always play the same. `seed` gives a different random
run.

### particles

`{ "do": "particles", "kind": "sparkle", "on": "eq1" }`. Kinds: `sparkle`,
`confetti`, `dust`, `stars`, `gather` (particles flying in to form the
thing named by `on`), `scatter` (the thing breaks into particles that drift
away). For moments of celebration and change.

---

## 23. Actions: teaching

### question (pause_and_try, try_this)

```json
{ "at_cue": "try", "do": "question", "id": "q1", "text": "What is $(3 + 4)^2$?", "wait": 5, "countdown": true }
{ "at_line": 14, "do": "answer", "who": "q1", "text": "$49$, not $9 + 16 = 25$" }
```

| Key | Values | Meaning |
| --- | --- | --- |
| `text` | text with maths | Required. |
| `wait` | seconds | Hold the video still this long, after the question appears, for the viewer to think (as `wait`). Default 0. |
| `countdown` | `true` | A ring that empties over the wait. |
| `choices` | list of texts | Possible answers, labelled A, B, C. `answer` then names the right one, which lights up as the others fade. |
| `hint` | text | A smaller line that appears half way through the wait. |
| `at` | a position | Default `center`. |

`answer` reveals the answer to a `question`, with a tick. `"choice": "B"`
for a question with choices.

### mistake (common_error)

```json
{ "at_line": 3, "do": "mistake", "tex": "(a+b)^2 = a^2 + b^2", "text": "A common slip" }
```

The wrong working is written, then a cross is stamped over it, with the
`text` beside it. `"fix": "(a+b)^2 = a^2 + 2ab + b^2"` writes the right one
beneath.

### check, tick, cross

`{ "do": "tick", "on": "eq3" }` or `"cross"`: a tick or cross drawn beside
a thing, in the theme's `good` or `bad` colour.

### definition, theorem, rule (card)

```json
{ "at_line": 2, "do": "definition", "title": "Prime number", "text": "A whole number above 1 whose only factors are 1 and itself.", "key": true }
{ "at_line": 9, "do": "theorem", "title": "Pythagoras", "tex": "a^2 + b^2 = c^2", "key": true }
```

A framed panel with a heading in the accent colour, for things to remember.
`definition`, `theorem`, `rule`, `formula` and `tip` look slightly different,
so viewers learn to tell them apart. `at`: a screen position. Default `right`.

### step_counter (progress_steps)

`{ "at_line": 3, "do": "step_counter", "steps": 4, "now": 1, "at": "top_left" }`:
"Step 1 of 4", with dots. A later beat with a new `now` moves it on.
Or `"names": ["Expand", "Collect", "Factor", "Solve"]` shows a short row of
named steps with the present one lit.

### recap (summary)

```json
{ "at_line": 30, "do": "recap", "title": "What we saw", "duration": 8 }
```

Gathers every thing marked `"key": true` in the video, in order, and lays
them out as a summary, each sliding in as the narrator reaches it.
`"only": [ids]` instead picks its own. `"from_chapter": true` takes only
what was marked in the present chapter.

### compare (side_by_side)

`{ "do": "compare", "left": "eq1", "right": "eq2", "text": ["Expected", "Actually"] }`:
moves two things side by side with a heading over each and a thin line
between.

---

## 24. The mascot

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
| `enter` | `who`, `at` (default `bottom_right`), `from` (`left`, `right`, `below`) | It arrives. |
| `look` | `who`, `at` | Its eyes follow a thing, even as the thing moves. By default it looks at whatever was last drawn. |
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

### card

`title`, `text`, `kicker`, `number`, `unit`, `caption`, `tex` (a formula on
the card), `side` (`left`, `right`), `position` (`top`, `middle`, `bottom`),
`on` (a dotted line from the card to a thing on the sheet).

### image (picture, clip)

| Key | Values | Meaning |
| --- | --- | --- |
| `file` | file name | Required the first time. |
| `position`, `size` | | `size` also `full` for the whole frame. |
| `frame` | `none`, `rounded`, `circle`, `polaroid` | Default `rounded`. |
| `tone` | `none`, `mono`, `faded`, `warm`, `cold` | |
| `motion` | `none`, `in`, `out`, `left`, `right` | A slow move across it. |
| `on_sheet` | `true` | Put the picture on the sheet instead of over it, so the camera moves past it and maths can be drawn on top (a parabola over a photo of a bridge). |
| `clip_from`, `loop` | | For film clips. |

A later `image` with the same `id` and no `file` glides it to a new place.

### counter

`to`, `from`, `label`, `kicker`, `decimals`, `prefix` (`"₹"`), `suffix`
(`"%"`), `plain` (no thousands separators), or `items` for several side by
side. Can also show a named value live: `"value": "a"`.

Number grouping follows each language (`1,00,000` in Hindi and other Indian
languages where that is the custom, `100,000` in English, unless `grouping`
says `"international"` or `"indian"`).

### chips

`items`, `kicker`, `position`, `lag`.

### table

```json
{ "at_line": 5, "do": "table", "head": ["$x$", "$x^2$"], "rows": [["1", "1"], ["2", "4"], ["3", "9"]], "lag": 0.5 }
```

Fills in row by row. `light`: a row or column number to highlight. A later
`table` beat with the same `id` and `add` adds rows.

### chart

`kind`: `bar`, `line`, `pie`, `dot`. `items`: `{ "label", "value", "color" }`.
`title`, `unit`. Bars grow, lines draw on, pie slices open in turn.

### label

`on`, `text`, `side` (`above`, `below`, `left`, `right`, `auto`), `arrow`
(`true`: a thin line from the label to the thing).

### credits

`lines`, with `#` before a heading.

### clear

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
| `tilt` | Tilts the sheet away, so it is seen at an angle, with depth: `elevation` (degrees; 90 is flat on, 30 nearly edge-on) and `angle` (turning round). Things lifted off the sheet stand out. |
| `fly` | Flies the camera across the sheet to the `target`, rising up and coming down, rather than sliding. |
| `orbit` | Space scenes: circles the `target`. `turns`: how far round. |
| `look` | Space scenes: stands still and looks at the `target`, from `elevation`, `angle`, `distance`. |

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
itself: a quiet chalk or pen sound while things are written (in the style's
own kind: chalk on `chalk`, pen on `sketch`), a soft pop as things appear, a
gentle click when pieces snap into place in `steps`, a soft whoosh on fast
camera moves, a chime on `tick` and `answer`, a low note on `cross`. They are
made by the engine, not files, and are the same on every render.

Any beat can take `"sound": false` to stay silent, or `"sound": "chime"` to
pick its own: `pop`, `click`, `chime`, `whoosh`, `low`, `tick`, `chalk`,
`pen`, `swell`.

### sound (sfx)

`{ "at_cue": "boom", "do": "sound", "file": "drum.mp3", "volume": 0.8 }`.

### sonify (hear_graph)

`{ "do": "sonify", "who": "f", "x": [-3, 3], "duration": 4 }`: a dot runs
along the graph while a tone rises and falls with its height.

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

### Thumbnail

```json
"thumbnail": { "at_line": 6, "text": { "en": "The missing piece", "hi": "छूटा हुआ हिस्सा" }, "position": "left", "size": "huge" }
```

The frame at that moment, with big words over it, saved as a 1280×720
picture for each language. Or `"file"` to use your own picture with the
words over it.

### End screen

`"end_screen": 20` keeps the last 20 seconds clear in the places where
YouTube puts its end-screen buttons, and the checker warns if anything is
drawn there.

### Making a long video

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

| Check | What it looks at |
| --- | --- |
| Steps | Each step of `steps`, `work` and `solve` is equal to the one before (or, for an equation, has the same solutions). A step that is not is reported: "Scene 2, line 3 of the working: 3x = 25 does not follow from 3x + 5 = 20." |
| Numbers | Numbers on cards, counters and answers that can be worked out from the script (an area, a root, a value) are checked. |
| Answers | The `answer` to a `question` that is maths is checked. |

A step that is meant to be wrong (in `mistake`) is not checked. One step can
be excused with `"check": false`.

### Teaching checks

Warnings about how the lesson will feel to a viewer:

| Warning | When |
| --- | --- |
| Too much at once | More than three new things appear within one second. |
| Nothing moving | The picture does not change for more than 12 seconds. |
| Fast speech | A line is spoken faster than 180 words a minute. |
| Missing reasons | A `work` or `steps` step has no `note`. |
| Colour clash | A colour given to a symbol in `symbols` is also used for something else. |
| Crowded | Things overlap, or text runs off the frame. |
| No question | A video longer than five minutes has no `question`. |
| No recap | A video longer than five minutes has no `recap`. |
| Slow start | Nothing appears in the first four seconds. |
| Missing language | A line, title or label is missing a language of the video. |

Turn any of them off:
`"checks": { "teaching": { "missing_reasons": false } }`.

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
7. Things placed on axes, graphs or number lines name them with `on`.
8. `space`-only actions (section 21) need a `space` scene. `transform_plane`
   needs axes made with `plane: true`.
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
