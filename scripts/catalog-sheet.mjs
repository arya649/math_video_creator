// Render every catalogue entry and save contact sheets of them.
// Usage: node scripts/catalog-sheet.mjs <out-dir> [filter]   (dev server on :5190)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [out, filter = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
await page.goto('http://localhost:5190/catalog.html');
await page.waitForFunction(() => window.catalogue, null, { timeout: 30000 });
await page.waitForTimeout(500);
const failed = await page.evaluate(() => window.catalogue.all());
console.log('failed:', JSON.stringify(failed, null, 1));
const sheets = await page.evaluate((filter) => {
  const cards = [...document.querySelectorAll('.card')].filter((c) => c.querySelector('.id').textContent.includes(filter));
  const per = 12, cols = 3, w = 480, h = 270, lab = 26;
  const out = [];
  for (let s = 0; s < cards.length; s += per) {
    const group = cards.slice(s, s + per);
    const rows = Math.ceil(group.length / cols);
    const c = document.createElement('canvas');
    c.width = cols * w; c.height = rows * (h + lab);
    const g = c.getContext('2d');
    g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height);
    group.forEach((card, i) => {
      const x = (i % cols) * w, y = Math.floor(i / cols) * (h + lab);
      g.drawImage(card.querySelector('canvas'), x, y, w - 4, h);
      g.fillStyle = '#ffd84d'; g.font = '16px monospace';
      g.fillText(card.querySelector('.id').textContent, x + 6, y + h + 18);
    });
    out.push(c.toDataURL('image/png'));
  }
  return out;
}, filter);
mkdirSync(out, { recursive: true });
sheets.forEach((d, i) => writeFileSync(resolve(out, `sheet_${i}.png`), Buffer.from(d.split(',')[1], 'base64')));
console.log(`${sheets.length} sheets`);
if (logs.length) console.log(logs.slice(0, 20).join('\n'));
await browser.close();
