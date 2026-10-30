// Usage: npx vite build && npx vite preview --port 4173 &
//        RUNS=7 node tests/perf/measure.mjs http://localhost:4173 <label>   (needs the seeded visual accounts: node tests/visual/seed.mjs)
// Cold loads with 4x CPU throttle + "fast 4G" network; reports JS/CSS bytes on the wire, FCP, LCP and load.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [base, label] = process.argv.slice(2);
const pages = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/app', login: true },
  { name: 'planner', path: '/app/planner', login: true },
  { name: 'review', path: '/app/review', login: true },
];
const browser = await chromium.launch();
const out = {};
for (const p of pages) {
  const runs = [];
  for (let i = 0; i < Number(process.env.RUNS ?? 3); i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    if (p.login) {
      await page.goto(`${base}/login`);
      await page.getByLabel('Email').fill('maya@visual.local');
      await page.getByLabel('Password', { exact: true }).fill('bloom-visual-pass-1');
      await page.getByRole('button', { name: /^Log in/ }).click();
      await page.waitForURL(/\/app/);
      await page.waitForTimeout(500);
    }
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let js = 0, css = 0;
    const types = new Map();
    cdp.on('Network.responseReceived', (e) => types.set(e.requestId, e.type));
    cdp.on('Network.loadingFinished', (e) => { const t = types.get(e.requestId); if (t === 'Script') js += e.encodedDataLength; if (t === 'Stylesheet') css += e.encodedDataLength; });
    await page.addInitScript(() => {
      window.__lcp = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    const t0 = Date.now();
    await page.goto(`${base}${p.path}`, { waitUntil: 'load' });
    await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 30000 });
    const ready = Date.now() - t0;
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
      const nav = performance.getEntriesByType('navigation')[0];
      return { fcp: Math.round(fcp), lcp: Math.round(window.__lcp), load: Math.round(nav.loadEventEnd) };
    });
    runs.push({ ...m, h1: ready, jsKB: Math.round(js / 1024), cssKB: Math.round(css / 1024) });
    await ctx.close();
  }
  const med = (k) => runs.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(runs.length / 2)];
  out[p.name] = { fcp: med('fcp'), lcp: med('lcp'), h1: med('h1'), load: med('load'), jsKB: med('jsKB'), cssKB: med('cssKB') };
  console.log(label, p.name, JSON.stringify(out[p.name]));
}
await browser.close();
require('node:fs').mkdirSync('test-results/perf', { recursive: true });
require('node:fs').writeFileSync(`test-results/perf/${label}.json`, JSON.stringify(out, null, 2));
