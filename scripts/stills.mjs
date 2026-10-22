// Render frames of a project in headless Chromium and save them as pictures.
// Usage: node scripts/stills.mjs <project> <out-dir> <t1> <t2> ...   (dev server on :5190)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [project, out, ...times] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://localhost:5190/?project=${project}`);
await page.waitForFunction(() => window.engine?.movie, null, { timeout: 30000 }).catch(() => {});
await page.evaluate(() => document.fonts.ready);
const problems = await page.$eval('#problems', (e) => e.innerText);
console.log('Problems:', problems);
mkdirSync(out, { recursive: true });
for (const t of times) {
  await page.evaluate((tt) => window.engine.draw(Number(tt)), t);
  const data = await page.$eval('#view', (c) => c.toDataURL('image/png'));
  const file = resolve(out, `${project}_${String(t).replace('.', '_')}.png`);
  writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log('saved', file);
}
if (logs.length) console.log(logs.join('\n'));
await browser.close();
