// Export a project twice in headless Chromium: the second time, unchanged scenes are reused.
// Usage: node scripts/export-cache-test.mjs <project> <out-dir>
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
const [project, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://localhost:5190/?project=${project}`);
await page.waitForFunction(() => window.engine?.movie);
const res = await page.evaluate(async () => {
  const { exportMp4 } = await import('/src/engine/export.ts');
  const run = async () => {
    let scenes = null;
    const t0 = performance.now();
    const blob = await exportMp4(window.engine.movie, { files: new Map(), captions: true, fingerprints: window.engine.fingerprints(), onScenes: (m, r) => { scenes = [m, r]; } });
    return { blob, scenes, secs: (performance.now() - t0) / 1000 };
  };
  const a = await run(), b = await run();
  const enc = async (blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(s); };
  const thumb = await window.engine.thumbnail();
  return { first: { scenes: a.scenes, secs: a.secs }, second: { scenes: b.scenes, secs: b.secs }, mp4: await enc(b.blob), png: thumb ? await enc(thumb) : null };
});
writeFileSync(`${out}/${project}.mp4`, Buffer.from(res.mp4, 'base64'));
if (res.png) writeFileSync(`${out}/${project}_thumbnail.png`, Buffer.from(res.png, 'base64'));
console.log('first:', JSON.stringify(res.first), 'second:', JSON.stringify(res.second));
await browser.close();
