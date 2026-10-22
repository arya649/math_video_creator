# Math Video Engine

Turns one JSON script into a maths explainer video: equations written on and
changing step by step, shapes, camera moves, captions and narration, in any
language.

```bash
npm install
npm run dev     # then open http://localhost:5190/?project=demo
```

Sample projects: `demo`, `graphs`, `geometry`, `sound`, `teaching`,
`counting` (open `/?project=<name>`).

- Writing scripts: [`docs/SCRIPT_REFERENCE.md`](docs/SCRIPT_REFERENCE.md), and the catalogue page (`/catalog.html`).
- Working on the engine: [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md).
- What is built and what comes next: [`ROADMAP.md`](ROADMAP.md).

## Hosting on Vercel

The engine is a static site (`npm run build` makes `dist/`), set up in
`vercel.json`. Either import this GitHub repository at vercel.com (it picks
up the settings by itself), or from a computer with the Vercel CLI:
`npx vercel --prod`. On the hosted site, voices made and videos exported
are downloaded rather than saved into the project folder.
