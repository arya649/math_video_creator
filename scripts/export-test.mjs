// Export the first seconds of a project in headless Chromium to check the MP4 path.
// Usage: node scripts/export-test.mjs <project> <seconds> <out.mp4>
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [project, secs, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://localhost:5190/?project=${project}`);
await page.waitForFunction(() => window.engine?.movie);
const b64 = await page.evaluate(async (s) => {
  const { exportMp4 } = await import('/src/engine/export.ts');
  const blob = await exportMp4(window.engine.movie, { files: new Map(), captions: true, until: Number(s) });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}, secs);
writeFileSync(out, Buffer.from(b64, 'base64'));
console.log('wrote', out, Buffer.from(b64, 'base64').length, 'bytes');
await browser.close();
