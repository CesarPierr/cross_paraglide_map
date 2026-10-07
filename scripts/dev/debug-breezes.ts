import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:5173/#11.2/45.33/5.93/-30/68', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.status.ok', { timeout: 120000 });
await page.waitForTimeout(2000);
const r = await page.evaluate(`(async () => {
  const e = window.__ctrl.scene.engine;
  const d = Array.from(e.breezeData.slice(0, 40)).map(v => +v.toFixed(2));
  const names = e.breezes.slice(0, 10).map(b => b.name + ' ' + JSON.stringify(b.window) + ' ' + b.speedMs.toFixed(1));
  const p = await window.__ctrl.scene.probe(5.9552, 45.2993);
  return JSON.stringify({ d, names, cur: p && p.curated, cw: p && p.curatedWeight, idx: p && p.curatedIndex, hour: e.params.hour }, null, 1);
})()`);
console.log(r);
await browser.close();
