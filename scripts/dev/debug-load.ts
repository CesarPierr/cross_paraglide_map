import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs: string[] = [];
page.on('console', (m) => { const t = m.text(); if (!/AJAXError|Failed to load resource/.test(t)) logs.push(`[${m.type()}] ${t.slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(5000);
  const st = await page.evaluate(`(() => { const c = window.__ctrl; if (!c) return 'no ctrl'; const m = c.map; return JSON.stringify({ _loaded: m._loaded, listeners: Object.keys(m._listeners || {}).join(','), oneTime: Object.keys(m._oneTimeListeners||{}).join(','), ready: c.ready, gpu: c.gpu, atlas: !!c.atlas, scene: !!c.scene, loaded: m.loaded(), style: m.isStyleLoaded(), tiles: m.areTilesLoaded(), status: document.querySelector('.status')?.textContent, gl: !!m.getCanvas().getContext('webgl2') }); })()`);
  console.log(i, st);
  if (String(st).includes('modèle à jour')) break;
}
console.log(logs.slice(0, 40).join('\n'));
await browser.close();
