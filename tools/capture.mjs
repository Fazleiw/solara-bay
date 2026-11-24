// Captures Solara Bay's ?shot= scenes from the local server (`node serve.ts`) with headless
// system Chrome at 1280x800. A scene sets window.__shotReady once the real systems are staged and
// painted; JPEG quality steps down until the file fits the gate's 256 KiB cap. A maker's tool,
// not part of the game.
//   node tools/capture.mjs cover vault              -> .scratch/shots/<scene>.jpg
//   node tools/capture.mjs --out screenshots cover:1-heist-getaway.jpg
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import playwright from '/Users/shalmongggmeong/workspace/bellora-entry/node_modules/playwright-core/index.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8080/';
const MAX_BYTES = 256 * 1024;

const args = process.argv.slice(2);
let outDir = '.scratch/shots';
const at = args.indexOf('--out');
if (at !== -1) [, outDir] = args.splice(at, 2);
const jobs = args.map((arg) => {
  const [scene, file] = arg.split(':');
  return { scene, file: file ?? `${scene}.jpg` };
});

const browser = await playwright.chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });

mkdirSync(outDir, { recursive: true });
for (const { scene, file } of jobs) {
  problems.length = 0;
  await page.goto(`${BASE}?shot=${scene}&seed=1`);
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
  await page.waitForTimeout(400);
  const path = join(outDir, file);
  let quality = 90;
  for (;;) {
    await page.screenshot({ path, type: 'jpeg', quality });
    if (statSync(path).size <= MAX_BYTES || quality <= 40) break;
    quality -= 5;
  }
  console.log(`${scene} -> ${path} q${quality} ${(statSync(path).size / 1024).toFixed(0)} KiB`);
  for (const p of problems) console.log(`  ERROR ${p}`);
}
await browser.close();
