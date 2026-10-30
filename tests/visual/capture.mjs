// Screenshots every page (desktop + phone, light + dark) and, with --detect, runs the
// Impeccable detector against each logged-in page through Chrome's debugging port.
//
//   node tests/visual/capture.mjs --label before [--seed] [--detect] [--only dashboard,tasks]
//
// Needs the local stack, the mock AI server and the dev server (see README → Tests).
// Output: test-results/visual/<label>/<theme>-<device>/<page>.jpg and detect-*.json.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { localAdmin, PASSWORD, seedAll } from './seed.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const LABEL = opt('label', 'current');
const ONLY = opt('only', '')?.split(',').filter(Boolean) ?? [];
const THEMES = opt('themes', 'dark,light').split(',');
const DEVICES = opt('devices', 'desktop,phone').split(',');
const BASE = process.env.E2E_BASE ?? 'http://localhost:5173';
const OUT = `test-results/visual/${LABEL}`;
const CDP_PORT = Number(process.env.CDP_PORT ?? 9333);
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const USERS = { maya: 'maya@visual.local', fresh: 'newbie@visual.local', boss: 'boss-e2e@e2e.local' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every surface the design work covers. `full` captures the whole scrolling page. */
const SCREENS = [
  { name: 'landing', path: '/', full: true },
  { name: 'signup', path: '/signup' },
  { name: 'login', path: '/login' },
  { name: 'forgot-password', path: '/forgot-password' },
  { name: 'terms', path: '/terms', full: true },
  { name: 'privacy', path: '/privacy', full: true },
  { name: 'not-found', path: '/no-such-page' },
  { name: 'onboarding', user: 'fresh', path: '/app/welcome' },
  { name: 'tour', user: 'maya', path: '/app?tour=1', prep: (p) => p.getByRole('button', { name: 'Next' }).click() },
  { name: 'dashboard', user: 'maya', path: '/app', full: true },
  { name: 'capture', user: 'maya', path: '/app', prep: async (p) => (await p.keyboard.press('n'), p.locator('#capture-text').fill('Ask about the internship deadline #career')) },
  { name: 'brain-dump', user: 'maya', path: '/app/brain-dump', full: true },
  { name: 'process-inbox', user: 'maya', path: '/app/brain-dump?process=1', wait: '[role=dialog]' },
  { name: 'tasks', user: 'maya', path: '/app/tasks', full: true },
  { name: 'planner', user: 'maya', path: '/app/planner' },
  { name: 'planner-plans', user: 'maya', path: '/app/planner', prep: (p) => p.locator('#plans').scrollIntoViewIfNeeded() },
  { name: 'calendars', user: 'maya', path: '/app/calendars', full: true },
  { name: 'habits', user: 'maya', path: '/app/habits', full: true },
  { name: 'goals', user: 'maya', path: '/app/goals', full: true },
  { name: 'focus', user: 'maya', path: '/app/focus', full: true },
  { name: 'mood', user: 'maya', path: '/app/mood', full: true },
  { name: 'review', user: 'maya', path: '/app/review', full: true },
  { name: 'settings', user: 'maya', path: '/app/settings', full: true },
  { name: 'admin', user: 'boss', path: '/admin', full: true, wait: 'text=AI requests today' },
  { name: 'atlas', user: 'maya', path: '/app', prep: async (p) => (await p.keyboard.press('Control+j'), p.getByText('Stats exam revision').first().waitFor()) },
  {
    name: 'voice-hud',
    user: 'maya',
    path: '/app',
    prep: async (p) => {
      await p.keyboard.press('Control+j');
      await p.getByRole('button', { name: 'Switch to voice mode' }).click();
      await p.getByText(/Systems online/).waitFor({ timeout: 10_000 });
    },
  },
].filter((s) => !ONLY.length || ONLY.includes(s.name));

async function logIn(page, email) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: /^Log in/ }).click();
  await page.waitForURL(/\/app/);
}

async function openScreen(page, screen) {
  await page.goto(`${BASE}${screen.path}`, { waitUntil: 'networkidle' });
  if (screen.wait) await page.locator(screen.wait).first().waitFor({ timeout: 10_000 });
  else await page.locator('h1, [role=dialog]').first().waitFor({ timeout: 10_000 });
  if (screen.prep) await screen.prep(page);
  await page.evaluate(() => document.fonts.ready);
  await sleep(700);
}

function detect(target, viewport) {
  try {
    const out = execFileSync('.claude/skills/impeccable/scripts/impeccable', ['detect', '--json', '--no-design-system', '--cdp', String(CDP_PORT), '--target', target], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { viewport, findings: JSON.parse(out || '[]') };
  } catch (e) {
    // Exit code 2 = findings; stdout still holds the JSON.
    if (e.stdout) return { viewport, findings: JSON.parse(e.stdout) };
    return { viewport, error: String(e.stderr || e.message).slice(0, 500) };
  }
}

const admin = localAdmin();
if (flag('seed')) {
  await seedAll(admin);
  console.log('seeded demo accounts');
}
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const ids = Object.fromEntries(Object.entries(USERS).map(([k, email]) => [k, list.users.find((u) => u.email === email)?.id]));

const browser = await chromium.launch({ args: [`--remote-debugging-port=${CDP_PORT}`] });
const detections = {};
const errors = [];
for (const theme of THEMES) {
  for (const id of Object.values(ids)) if (id) await admin.from('profiles').update({ theme }).eq('id', id);
  for (const device of DEVICES) {
    const dir = `${OUT}/${theme}-${device}`;
    mkdirSync(dir, { recursive: true });
    const contexts = {};
    const pageFor = async (user) => {
      const key = user ?? 'anon';
      if (!contexts[key]) {
        const ctx = await browser.newContext({ ...VIEWPORTS[device], colorScheme: theme });
        await ctx.addInitScript((t) => localStorage.setItem('daybloom:theme', t), theme);
        const page = await ctx.newPage();
        page.on('pageerror', (e) => errors.push(`${theme}-${device} ${key}: ${e.message}`));
        if (user) await logIn(page, USERS[user]);
        contexts[key] = { ctx, page };
      }
      return contexts[key].page;
    };
    for (const screen of SCREENS) {
      const page = await pageFor(screen.user);
      try {
        await openScreen(page, screen);
        await page.screenshot({ path: `${dir}/${screen.name}.jpg`, type: 'jpeg', quality: 72, fullPage: !!screen.full });
        if (flag('detect')) {
          // Only this page may be open while the detector attaches.
          for (const other of Object.values(contexts)) if (other.page !== page) await other.ctx.close();
          for (const k of Object.keys(contexts)) if (contexts[k].page !== page) delete contexts[k];
          detections[`${theme}-${device}/${screen.name}`] = detect(new URL(page.url()).pathname, device);
        }
        process.stdout.write('.');
      } catch (e) {
        errors.push(`${theme}-${device} ${screen.name}: ${e.message.split('\n')[0]}`);
        process.stdout.write('x');
      }
    }
    for (const { ctx } of Object.values(contexts)) await ctx.close().catch(() => {});
    console.log(` ${theme}-${device}`);
  }
}
await browser.close();
if (flag('detect')) writeFileSync(`${OUT}/detect-pages-${THEMES.join('+')}.json`, JSON.stringify(detections, null, 2));
if (errors.length) console.log('Problems:\n  ' + errors.join('\n  '));
console.log(`Saved to ${OUT}`);
