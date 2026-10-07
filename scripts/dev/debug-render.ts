import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs: string[] = [];
page.on('console', (m) => { const t = m.text(); if (!/AJAXError|Failed to load resource|vite|DevTools/.test(t)) logs.push(`[${m.type()}] ${t.slice(0, 400)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message} ${e.stack?.slice(0, 400)}`));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
const r = await page.evaluate(`(async () => {
  const m = window.__ctrl.map;
  let renders = 0; m.on('render', () => renders++);
  m.triggerRepaint();
  await new Promise(r => setTimeout(r, 3000));
  const out = { renders, canvases: document.querySelectorAll('.maplibregl-canvas').length, removed: m._removed, frame: !!m._frameRequest, painter: !!m.painter, loadedFlag: m._loaded, rafTest: 0 };
  let n = 0; await new Promise(res => { const f = () => { if (++n < 5) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  out.rafTest = n;
  try { m.redraw(); out.redraw = 'ok'; } catch (e) { out.redraw = String(e && e.stack || e).slice(0, 600); }
  out.loadedAfter = m._loaded;
  return JSON.stringify(out);
})()`);
console.log(r);
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
