// End-to-end browser run against the local stack:
//   npm run supabase:up && node tests/mock/anthropic.mjs 4010 &
//   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run dev &
//   npm run test:e2e
// Screenshots land in test-results/e2e/.
import { mkdirSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE ?? 'http://localhost:5173';
const MAIL = 'http://localhost:54324';
const OUT = 'test-results/e2e';
mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function latestEmail(to, subject) {
  for (let i = 0; i < 60; i++) {
    const list = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    const hit = list.messages?.find((m) => !subject || m.Subject.includes(subject));
    if (hit) return (await fetch(`${MAIL}/api/v1/message/${hit.ID}`)).json();
    await sleep(250);
  }
  throw new Error(`no email "${subject}" to ${to}`);
}
const linkFrom = (html) => {
  const m = html.match(/href="([^"]*\/verify[^"]*)"/);
  if (!m) throw new Error('no verify link in email');
  return m[1].replace(/&amp;/g, '&');
};

/** Polls until fn() is truthy (for writes that finish after the UI updates optimistically). */
async function eventually(fn, msg, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(150)) if (await fn()) return;
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Opens a fresh browser context and records console errors for the whole flow. */
async function withPage(browser, opts, fn) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of (400|401|403|404|409|429)/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  try {
    await fn(page, context);
  } finally {
    await context.close();
  }
  return errors;
}

async function flow(name, browser, opts, fn) {
  if (only.length && !only.includes(name)) return;
  const started = Date.now();
  try {
    const errors = await withPage(browser, opts, async (p, ctx) => {
      try {
        await fn(p, ctx);
      } catch (e) {
        await p.screenshot({ path: `${OUT}/${name}-failure.png`, fullPage: true }).catch(() => {});
        throw e;
      }
    });
    if (errors.length) throw new Error(`console errors:\n  ${errors.join('\n  ')}`);
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`✓ ${name} (${Date.now() - started}ms)`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`✗ ${name}\n  ${e.message.split('\n').join('\n  ')}`);
  }
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

/** Signs up through the UI and confirms the email via Mailpit. Returns the credentials. */
async function signUp(page, name) {
  const email = `${name.toLowerCase()}-${Date.now()}@e2e.local`;
  const password = 'bloom-e2e-pass-1';
  await page.goto(`${BASE}/signup`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Sign up free' }).click();
  await page.getByText('Check your email').waitFor();
  const mail = await latestEmail(email, 'Confirm');
  await page.goto(linkFrom(mail.HTML));
  await page.waitForURL(/\/app\/welcome/, { timeout: 15000 });
  return { email, password, mail };
}

/** Runs onboarding with a name, one brain dump, one task and one habit. */
async function onboard(page, name) {
  await page.getByLabel('What should we call you?').fill(name);
  await page.getByRole('button', { name: 'Health' }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByLabel('Your first brain dump').fill('call the dentist\nidea: a birthday picnic for Sam #family');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByLabel('Your first task').fill('Book the dentist !high');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByLabel('Your first habit').fill('Drink water');
  await page.getByRole('button', { name: /Finish/ }).click();
  await page.waitForURL(/\/app(\?tour=1)?$/);
}

const localEnv = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const admin = createClient(localEnv.SUPABASE_URL, localEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** A confirmed, already-onboarded user created through the admin API (for flows that don't test signup). */
async function makeUser(name, extra = {}) {
  const email = `${name.toLowerCase()}-${Date.now()}@e2e.local`;
  const password = 'bloom-e2e-pass-1';
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (error) throw error;
  const now = new Date().toISOString();
  await admin.from('profiles').update({ onboarded_at: now, tour_completed_at: now, timezone: 'UTC', ...extra }).eq('id', data.user.id);
  return { id: data.user.id, email, password };
}

async function logIn(page, { email, password }) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^Log in/ }).click();
  await page.waitForURL(/\/app/);
  await page.getByRole('heading', { level: 1 }).waitFor();
}

const browser = await chromium.launch();

await flow('landing', browser, {}, async (page) => {
  await page.goto(BASE);
  await page.getByRole('heading', { level: 1 }).waitFor();
  for (const s of ['Brain Dump', 'Tasks & Planner', 'Habits', 'Goals', 'Calendars', 'Focus timer', 'Mood & Weekly Review', 'Atlas', 'How it works', 'Questions']) {
    assert(await page.getByText(s, { exact: true }).first().isVisible(), `missing section ${s}`);
  }
  await page.getByText('How do the ✨ AI features work').click();
  assert(await page.getByText('resets at midnight UTC').isVisible(), 'FAQ did not expand');
  const dead = await page.$$eval('a', (as) => as.filter((a) => a.getAttribute('href') === '#' || !a.getAttribute('href')).length);
  assert(dead === 0, `${dead} dead links`);
  await shot(page, 'landing');
  await page.getByRole('link', { name: 'Privacy' }).first().click();
  await page.getByText('Placeholder — review before launch').waitFor();
});

await flow('signup-onboarding-tour', browser, {}, async (page) => {
  const { mail } = await signUp(page, 'Ada');
  assert(mail.HTML.includes('Daybloom'), 'confirmation email is not branded');
  await shot(page, 'onboarding');
  await onboard(page, 'Ada');
  // Tour starts automatically after onboarding.
  const dialog = page.locator('[role=dialog][aria-labelledby="tour-title"]');
  await dialog.waitFor({ timeout: 8000 });
  await shot(page, 'tour');
  for (let i = 0; i < 12 && (await dialog.isVisible()); i++) {
    await dialog.getByRole('button', { name: /^(Next|Done|Finish)/ }).click();
    await sleep(150);
  }
  assert(!(await dialog.isVisible()), 'tour did not close');
  await page.getByRole('heading', { name: /Ada/ }).waitFor();
  assert(await page.getByText('Getting started').isVisible(), 'checklist missing');
  assert(await page.getByText('Drink water').isVisible(), 'habit from onboarding missing on dashboard');
  assert(await page.getByText('Book the dentist').isVisible(), 'task from onboarding missing on dashboard');
  await shot(page, 'dashboard');
  // Reload: tour must not start again.
  await page.goto(`${BASE}/app`);
  await page.getByRole('heading', { name: /Ada/ }).waitFor();
  await sleep(800);
  assert(!(await dialog.isVisible()), 'tour replayed on reload');
  assert(await page.getByText('Take the quick tour').evaluate((el) => getComputedStyle(el).textDecorationLine.includes('line-through')), 'tour not ticked in checklist');
});

await flow('brain-dump', browser, {}, async (page) => {
  const user = await makeUser('Bea');
  await logIn(page, user);
  // Capture from anywhere with N.
  await page.keyboard.press('n');
  const capture = page.getByRole('dialog', { name: 'Capture' });
  await capture.waitFor();
  await page.locator('#capture-text').fill('Buy candles for the party #family\n- [ ] ask Jo');
  await page.keyboard.press('Control+Enter');
  await page.getByText('Saved to your Brain Dump inbox').waitFor();
  await page.keyboard.press('n');
  await page.locator('#capture-text').fill('Learn to make sourdough');
  await page.getByRole('button', { name: 'Save to inbox' }).click();
  await page.goto(`${BASE}/app/brain-dump`);
  await page.getByText('Learn to make sourdough').waitFor();
  assert(await page.getByRole('button', { name: '#family' }).first().isVisible(), 'tag filter missing');
  await shot(page, 'brain-dump');
  // Search.
  await page.getByLabel('Search all notes').fill('sourdough');
  await sleep(300);
  assert(!(await page.getByText('Buy candles for the party').isVisible()), 'search did not filter');
  await page.getByLabel('Clear search').click();
  // ✨ Organize
  await page.getByRole('button', { name: /Organize/ }).click();
  await page.getByRole('dialog', { name: /Suggested organization/ }).waitFor({ timeout: 10000 });
  await shot(page, 'brain-dump-organize');
  await page.keyboard.press('Escape');
  // Process inbox
  await page.goto(`${BASE}/app/brain-dump?process=1`);
  const proc = page.getByRole('dialog', { name: 'Process inbox' });
  await proc.waitFor();
  const first = (await proc.innerText()).includes('sourdough') ? 'sourdough' : 'candles';
  // newest first: sourdough → idea; candles → task
  for (let i = 0; i < 2; i++) {
    const text = await proc.innerText();
    if (text.includes('Learn to make sourdough')) {
      await proc.getByRole('button', { name: 'Keep as idea' }).click();
    } else {
      await proc.getByRole('button', { name: 'Make task' }).click();
      const conv = page.getByRole('dialog', { name: /task/i }).last();
      await conv.getByRole('button', { name: 'Create' }).click();
    }
    await sleep(400);
  }
  await proc.getByText(/You processed 2 notes/).waitFor();
  await proc.getByRole('button').first().click();
  await page.getByRole('tab', { name: /Ideas/ }).click();
  await page.getByText('Learn to make sourdough').waitFor();
  await page.goto(`${BASE}/app/tasks`);
  await page.getByText('Buy candles for the party').first().waitFor();
  assert(first, 'noop');
  // Capture drafts survive a backdrop tap and Escape until saved (brain-dump-2).
  await page.goto(`${BASE}/app/brain-dump`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.keyboard.press('n');
  const cap = page.getByRole('dialog', { name: 'Capture' });
  await page.locator('#capture-text').fill('Half a thought');
  await page.mouse.click(5, 5);
  await sleep(200);
  assert(await cap.isVisible(), 'a backdrop tap closed a capture with unsaved text');
  await page.keyboard.press('Escape');
  await cap.waitFor({ state: 'detached' });
  await page.keyboard.press('n');
  await cap.waitFor();
  assert((await page.locator('#capture-text').inputValue()) === 'Half a thought', 'capture draft was lost');
  await page.keyboard.press('Control+Enter');
  await cap.waitFor({ state: 'detached' });
  // Process inbox by keyboard: 4 keeps it as an idea, with an Undo toast, and ends at Inbox zero (brain-dump-3).
  await page.goto(`${BASE}/app/brain-dump?process=1`);
  const proc2 = page.getByRole('dialog', { name: 'Process inbox' });
  await proc2.getByText('Half a thought').waitFor();
  await page.keyboard.press('4');
  await page.locator('[role="status"][aria-live="polite"]').getByText('Kept as an idea').waitFor();
  await proc2.getByText('Inbox zero').waitFor();
});

await flow('atlas', browser, {}, async (page) => {
  const user = await makeUser('Cy');
  await logIn(page, user);
  await page.keyboard.press('Control+j');
  const panel = page.getByRole('dialog', { name: 'Atlas assistant' });
  await panel.waitFor();
  const before = await page.getByText(/left today/).first().innerText();
  await panel.getByPlaceholder('Ask Atlas…').fill('add task: Water the plants');
  await panel.getByRole('button', { name: 'Send' }).click();
  await panel.getByLabel('What Atlas did').first().waitFor({ timeout: 15000 });
  await sleep(500);
  const after = await page.getByText(/left today/).first().innerText();
  assert(before !== after, `allowance did not change (${before} → ${after})`);
  await panel.getByPlaceholder('Ask Atlas…').fill('delete Water the plants');
  await panel.getByRole('button', { name: 'Send' }).click();
  await panel.getByText(/^Delete task “Water the plants”\?$/).waitFor({ timeout: 15000 });
  await shot(page, 'atlas-confirm');
  await panel.getByRole('button', { name: 'Delete', exact: true }).click();
  await sleep(800);
  await page.getByRole('button', { name: 'Close Atlas' }).click();
  await page.goto(`${BASE}/app/tasks`);
  await page.getByRole('heading', { name: 'Tasks', exact: true }).waitFor();
  await sleep(500);
  assert(!(await page.getByText('Water the plants').isVisible()), 'task not deleted after confirm');
  // History persists.
  await page.keyboard.press('Control+j');
  await panel.getByText('add task: Water the plants').waitFor();
});

await flow('voice-hud', browser, {}, async (page) => {
  const user = await makeUser('Dee');
  await logIn(page, user);
  await page.keyboard.press('Control+j');
  await page.getByRole('button', { name: 'Switch to voice mode' }).click();
  const hud = page.getByRole('dialog', { name: 'Atlas voice mode' });
  await hud.waitFor();
  await hud.getByText(/Systems online\. Good (morning|afternoon|evening|night), Dee\./).waitFor({ timeout: 10000 });
  assert(await hud.getByText('Tasks left today').isVisible(), 'readouts missing');
  await hud.getByRole('button', { name: 'Type instead' }).click();
  await hud.getByLabel('Type to Atlas').fill("what's on today");
  await page.keyboard.press('Enter');
  await hud.getByText(/Here's your day, Dee/).waitFor({ timeout: 15000 });
  await shot(page, 'voice-hud');
  await page.keyboard.press('Escape');
  await hud.waitFor({ state: 'detached' });
});

await flow('ai-limit', browser, {}, async (page) => {
  const user = await makeUser('Eve');
  await admin.from('ai_overrides').upsert({ user_id: user.id, daily_limit: 1 });
  await logIn(page, user);
  await page.getByText('1 left today').first().waitFor();
  await page.getByRole('button', { name: /Get today’s briefing/ }).click();
  await page.getByText('Focus on').waitFor({ timeout: 15000 });
  await page.getByText('0 left today').first().waitFor();
  await page.goto(`${BASE}/app/brain-dump`);
  await page.locator('textarea').first().fill('test note');
  await page.keyboard.press('Control+Enter');
  await sleep(500);
  const organize = page.getByRole('button', { name: /Organize/ });
  assert(await organize.isDisabled(), 'AI button still enabled with 0 left');
  assert((await organize.getAttribute('title'))?.includes('used today'), 'no explanation on disabled AI button');
  // The server enforces it too, whatever the UI does.
  const status = await page.evaluate(async () => {
    const key = Object.keys(localStorage).find((k) => k.includes('auth-token'));
    const token = JSON.parse(localStorage.getItem(key)).access_token;
    const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ feature: 'organize_inbox' }) });
    return { code: r.status, body: await r.json() };
  });
  assert(status.code === 429 && /allowance/.test(status.body.error), `server allowed a request over the limit: ${JSON.stringify(status)}`);
  await shot(page, 'ai-limit');
});

await flow('password-reset', browser, {}, async (page) => {
  const user = await makeUser('Fay');
  await page.goto(`${BASE}/forgot-password`);
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button').filter({ hasText: /reset|send/i }).click();
  await page.getByText(/Check your email/i).waitFor();
  const mail = await latestEmail(user.email, 'Reset');
  await page.goto(linkFrom(mail.HTML));
  await page.waitForURL(/reset-password/);
  await page.locator('#pw').fill('a-brand-new-pass-2');
  await page.locator('#pw2').fill('a-brand-new-pass-2');
  await page.getByRole('button').filter({ hasText: /password/i }).click();
  await page.waitForURL(/\/app/);
  // Old password no longer works, new one does.
  const anon = createClient(localEnv.SUPABASE_URL, localEnv.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  assert((await anon.auth.signInWithPassword({ email: user.email, password: user.password })).error, 'old password still works');
  assert(!(await anon.auth.signInWithPassword({ email: user.email, password: 'a-brand-new-pass-2' })).error, 'new password fails');
});

await flow('settings-export-delete', browser, { acceptDownloads: true }, async (page) => {
  const user = await makeUser('Gus');
  await logIn(page, user);
  await page.keyboard.press('n');
  await page.locator('#capture-text').fill('note to export');
  await page.keyboard.press('Control+Enter');
  await page.goto(`${BASE}/app/settings`);
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
  await shot(page, 'settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download JSON' }).click()]);
  const path = await download.path();
  const data = JSON.parse(readFileSync(path, 'utf8'));
  assert(data.notes?.some((n) => n.body === 'note to export'), 'export missing note');
  assert(data.profiles?.length === 1, 'export should contain only my profile');
  await page.getByRole('button', { name: 'Delete account…' }).click();
  const dlg = page.getByRole('dialog', { name: 'Delete your account?' });
  assert(await dlg.getByRole('button', { name: 'Delete everything' }).isDisabled(), 'delete enabled before typing DELETE');
  await dlg.getByLabel('Type DELETE to confirm').fill('DELETE');
  await dlg.getByRole('button', { name: 'Delete everything' }).click();
  await page.waitForURL(`${BASE}/`);
  const { data: u } = await admin.auth.admin.getUserById(user.id);
  assert(!u?.user, 'auth user still exists');
  const { count } = await admin.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  assert(count === 0, 'notes not deleted');
});

await flow('mobile', browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async (page) => {
  const user = await makeUser('Hal');
  await logIn(page, user);
  const nav = page.getByRole('navigation', { name: /tab|mobile|main/i }).last();
  await nav.waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `horizontal overflow ${overflow}px`);
  await shot(page, 'mobile-dashboard');
  for (const path of ['brain-dump', 'tasks', 'planner', 'habits', 'goals', 'calendars', 'focus', 'mood', 'review', 'settings']) {
    await page.goto(`${BASE}/app/${path}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(o <= 0, `${path}: horizontal overflow ${o}px`);
  }
  await shot(page, 'mobile-settings');
  await page.goto(BASE + '/app/planner');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await sleep(500);
  await shot(page, 'mobile-planner');
  await page.goto(BASE + '/app');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await sleep(500);
  await shot(page, 'mobile-dashboard');
  await page.getByRole('button', { name: 'More' }).click();
  await sleep(300);
  await shot(page, 'mobile-more');
});

await flow('pages-smoke', browser, {}, async (page) => {
  const user = await makeUser('Ivy');
  await logIn(page, user);
  for (const path of ['brain-dump', 'tasks', 'planner', 'calendars', 'habits', 'goals', 'focus', 'mood', 'review', 'settings']) {
    await page.goto(`${BASE}/app/${path}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    await sleep(300);
    await shot(page, `page-${path}`);
  }
  await page.goto(`${BASE}/admin`);
  await page.getByText('Admins only').waitFor();
});

await flow('magic-link-and-email-change', browser, {}, async (page) => {
  const user = await makeUser('Jo');
  await page.goto(`${BASE}/login`);
  await page.getByRole('tab', { name: 'Email me a link' }).click();
  await page.getByLabel('Email').fill(user.email);
  await page.getByRole('button', { name: 'Send me a sign-in link' }).click();
  await page.getByText('Check your email').waitFor();
  const mail = await latestEmail(user.email, 'sign-in');
  assert(mail.HTML.includes('Daybloom'), 'magic link email not branded');
  await page.goto(linkFrom(mail.HTML));
  await page.waitForURL(/\/app/);
  await page.getByRole('heading', { name: /Jo/ }).waitFor();
  // Change email → confirmation link → new address works.
  await page.goto(`${BASE}/app/settings`);
  const newEmail = `jo-new-${Date.now()}@e2e.local`;
  await page.getByLabel('Email', { exact: true }).fill(newEmail);
  await page.getByRole('button', { name: 'Change' }).click();
  await page.getByText(/confirmation links/).waitFor();
  // Secure email change: confirm from the old address, then the new one.
  const fromOld = await latestEmail(user.email, 'new email');
  await page.goto(linkFrom(fromOld.HTML));
  await page.getByText('One more link to click').waitFor({ timeout: 15000 });
  const fromNew = await latestEmail(newEmail, 'new email');
  await page.goto(linkFrom(fromNew.HTML));
  await page.waitForURL(/\/app\/settings/, { timeout: 15000 });
  await sleep(1000);
  const { data } = await admin.auth.admin.getUserById(user.id);
  assert(data.user.email === newEmail, `email not changed (${data.user.email})`);
});

await flow('planner-ai', browser, {}, async (page) => {
  const user = await makeUser('Kit');
  await logIn(page, user);
  await page.goto(`${BASE}/app/planner`);
  await page.getByRole('heading', { name: 'Planner' }).waitFor();
  await page.getByPlaceholder(/Add…/).fill('Write the newsletter for 30m');
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'week' }).click();
  await page.getByRole('button', { name: /Plan my week/ }).click();
  await page.getByText(/suggested block/).waitFor({ timeout: 15000 });
  await shot(page, 'planner-ghosts');
  await page.getByRole('button', { name: 'Accept all' }).click();
  await page.getByText(/Scheduled \d+ block/).waitFor();
  await sleep(800);
  const { data } = await admin.from('tasks').select('sched_date, sched_start').eq('user_id', user.id).eq('title', 'Write the newsletter');
  assert(data?.[0]?.sched_date && data[0].sched_start % 15 === 0, `task not scheduled: ${JSON.stringify(data)}`);
});

await flow('goals-habits-ai', browser, {}, async (page) => {
  const user = await makeUser('Lu');
  await logIn(page, user);
  await page.goto(`${BASE}/app/goals`);
  await page.getByRole('button', { name: 'Set your first goal' }).click();
  await page.getByRole('textbox', { name: 'Goal' }).fill('Run 100 km');
  await page.getByLabel('Target').fill('100');
  await page.getByLabel('Unit').fill('km');
  await page.getByRole('button', { name: 'Add goal' }).click();
  await page.getByRole('button', { name: /Make a plan/ }).click();
  await page.getByRole('dialog', { name: /A plan for/ }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Add to my goal' }).click();
  await page.getByText(/Added \d+ milestones/).waitFor();
  await page.goto(`${BASE}/app/habits`);
  await page.getByRole('heading', { name: 'Habits', exact: true }).waitFor();
  await page.getByRole('button', { name: /Suggest from goals/ }).first().click();
  await page.getByRole('dialog').waitFor({ timeout: 15000 });
  await shot(page, 'habits-suggest');
});

await flow('admin', browser, {}, async (page) => {
  const res = await fetch(`${BASE}/api/admin`);
  assert(res.status === 401, `admin API without login returned ${res.status}`);
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  if (!adminEmail) return console.log('  (skipped admin UI: set E2E_ADMIN_EMAIL to the dev server ADMIN_EMAIL)');
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list.users.find((u) => u.email === adminEmail);
  if (existing) await admin.auth.admin.deleteUser(existing.id);
  const { data, error } = await admin.auth.admin.createUser({ email: adminEmail, password: 'bloom-e2e-pass-1', email_confirm: true, user_metadata: { name: 'Boss' } });
  if (error) throw error;
  await admin.from('profiles').update({ onboarded_at: new Date().toISOString(), tour_completed_at: new Date().toISOString() }).eq('id', data.user.id);
  await logIn(page, { email: adminEmail, password: 'bloom-e2e-pass-1' });
  await page.goto(`${BASE}/app/settings`);
  await page.getByRole('link', { name: 'Open admin' }).click();
  await page.getByText('AI requests today').waitFor();
  const target = await makeUser('Target');
  await page.getByLabel('User email').fill(target.email);
  await page.getByRole('button', { name: 'Find' }).click();
  await page.getByPlaceholder(/Default/).fill('3');
  await page.getByLabel('Block AI').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText(/Saved for/).waitFor();
  const { data: o } = await admin.from('ai_overrides').select('*').eq('user_id', target.id).single();
  assert(o.daily_limit === 3 && o.blocked, `override not saved: ${JSON.stringify(o)}`);
  await shot(page, 'admin');
});

await flow('local-import', browser, {}, async (page, context) => {
  await context.addInitScript(() => {
    if (localStorage.getItem('daybloom:tasks')) return;
    localStorage.setItem('daybloom:tasks', JSON.stringify([
      { id: 't-open-1', title: 'Seeded demo task', status: 'todo' },
      { id: 'abc123', title: 'My real old task', status: 'todo', priority: 'high', due: '2026-11-02', tags: ['work'] },
    ]));
    localStorage.setItem('daybloom:notes', JSON.stringify([{ id: 'xyz', text: 'An old brain dump note', createdAt: '2026-10-01T10:00:00.000Z' }]));
  });
  const user = await makeUser('Mo');
  await logIn(page, user);
  const dlg = page.getByRole('dialog', { name: 'Bring your local data along?' });
  await dlg.waitFor();
  await dlg.getByRole('button', { name: 'Import my data' }).click();
  await dlg.waitFor({ state: 'detached', timeout: 10000 });
  const { data: tasks } = await admin.from('tasks').select('title').eq('user_id', user.id);
  const { data: notes } = await admin.from('notes').select('body').eq('user_id', user.id);
  assert(tasks.length === 1 && tasks[0].title === 'My real old task', `tasks: ${JSON.stringify(tasks)}`);
  assert(notes.length === 1, `notes: ${JSON.stringify(notes)}`);
  await page.reload();
  await page.getByRole('heading', { level: 1 }).waitFor();
  await sleep(800);
  assert(!(await dlg.isVisible()), 'import prompt shown again');
});

await flow('plans', browser, {}, async (page) => {
  const user = await makeUser('Pia');
  const dayKey = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const start = dayKey(1);
  // An existing block on the plan's first Wednesday at 6 PM, so the plan has a conflict.
  let wed = start;
  for (let i = 1; new Date(`${wed}T00:00:00Z`).getUTCDay() !== 3; i++) wed = dayKey(1 + i);
  await admin.from('tasks').insert({ user_id: user.id, title: 'Dentist', sched_date: wed, sched_start: 1080, sched_duration: 60 });
  await logIn(page, user);
  const left = async () => Number((await page.getByText(/\d+ left today/).first().innerText()).match(/(\d+) left/)[1]);

  // 1. Ask Atlas: it asks a follow-up, then drafts the plan card.
  await page.keyboard.press('Control+j');
  const panel = page.getByRole('dialog', { name: 'Atlas assistant' });
  const say = async (text) => {
    await panel.getByPlaceholder('Ask Atlas…').fill(text);
    await panel.getByRole('button', { name: 'Send' }).click();
  };
  await say('Make me a 4-week workout plan');
  await panel.getByText(/Which days and times suit you/).waitFor({ timeout: 15000 });
  await say('Mon, Wed and Fri at 6pm, 45 minutes');
  // Regenerate may retitle the plan, so find the card by role rather than by its title.
  const card = panel.getByRole('region', { name: /^Plan: / });
  await panel.getByRole('region', { name: 'Plan: 4-week workout plan' }).waitFor({ timeout: 15000 });
  await card.getByText('Mon 6:00 PM · 45 min · Leg day: squats, lunges, calf raises').waitFor();
  assert(await card.getByText(/4 weeks · 3 sessions a week/).isVisible(), 'card missing duration');
  await sleep(500);
  const afterCreate = await left();
  assert(afterCreate === 13, `expected 13 AI actions left after two Atlas replies, got ${afterCreate}`);
  await shot(page, 'plans-card');

  // 2. Regenerate: one AI action, same days and times, new content.
  await card.getByRole('button', { name: /Regenerate/ }).click();
  await card.getByText('Mon 6:00 PM · 45 min · Intervals', { exact: false }).waitFor({ timeout: 15000 });
  await sleep(300);
  assert((await left()) === 12, 'regenerate should use exactly one AI action');

  // 3. Edit a session (no AI): Friday moves to 7 PM.
  await card.getByRole('button', { name: 'Edit' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit plan' });
  await editor.getByLabel('Session 3 time').fill('19:00');
  await editor.getByLabel('Session 3 details').fill('deadlifts, planks');
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await editor.waitFor({ state: 'detached' });
  await card.getByText('Fri 7:00 PM · 45 min · Mobility & core: deadlifts, planks').waitFor();
  assert((await left()) === 12, 'editing must not use AI');

  // 4. Add to Planner: the Wednesday conflict is previewed; shift it; also track as a habit.
  await card.getByRole('button', { name: 'Add to Planner' }).click();
  const add = page.getByRole('dialog', { name: /Add “.*” to your Planner/ });
  await add.getByText('Overlaps “Dentist” (task block').waitFor();
  assert((await add.getByRole('listitem').count()) === 1, 'expected exactly one conflict');
  await shot(page, 'plans-conflict');
  await add.getByRole('radio', { name: /Shift to/ }).click();
  await add.getByLabel(/Also track as a habit/).check();
  await add.getByRole('button', { name: 'Add 12 sessions' }).click();
  await page.getByText(/to your Planner · 12 sessions/).waitFor();
  let { data: series } = await admin.from('block_series').select('id, days, start_min').eq('user_id', user.id);
  assert(series.length === 3, `expected 3 repeating blocks, got ${series.length}`);
  const { data: shifted } = await admin.from('series_occurrences').select('day, start_min, skipped').eq('user_id', user.id);
  const moved = shifted[0]?.start_min;
  // Nearest free slot: ends by 6 PM or starts after the Dentist block ends at 7 PM.
  assert(shifted.length === 1 && shifted[0].day === wed && !shifted[0].skipped && (moved + 45 <= 1080 || moved >= 1140), `shift not saved: ${JSON.stringify(shifted)}`);
  assert((await admin.from('habits').select('id').eq('user_id', user.id)).data.length === 1, 'habit not created');

  // 5. Undo puts everything back.
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByText('Removed it from your Planner.').waitFor();
  ({ data: series } = await admin.from('block_series').select('id').eq('user_id', user.id));
  assert(series.length === 0, 'undo left repeating blocks behind');
  assert((await admin.from('habits').select('id').eq('user_id', user.id)).data.length === 0, 'undo left the habit behind');
  const { data: draft } = await admin.from('plans').select('status').eq('user_id', user.id).single();
  assert(draft.status === 'draft', `plan should be a draft again, is ${draft.status}`);

  // 6. Re-add: skip the conflict this time, and create a goal.
  await card.getByRole('button', { name: 'Add to Planner' }).click();
  await add.getByRole('radio', { name: 'Skip' }).click();
  await add.getByLabel(/Also create a goal/).check();
  await add.getByRole('button', { name: 'Add 11 sessions' }).click();
  await page.getByText(/to your Planner · 11 sessions/).waitFor();
  await card.getByText('On your Planner').waitFor();
  const { data: goal } = await admin.from('goals').select('id, target, current').eq('user_id', user.id).single();
  assert(goal.target === 11, `goal target should be 11, is ${goal.target}`);
  await page.getByRole('button', { name: 'Close Atlas' }).click();

  // 7. Planner shows the repeating blocks; edit one session "this one only".
  await page.goto(`${BASE}/app/planner`);
  await page.getByRole('heading', { name: 'Planner' }).waitFor();
  await page.getByRole('tab', { name: 'week' }).click();
  const firstBlock = page.getByRole('button', { name: /^Repeating block: / }).first();
  if (!(await firstBlock.isVisible().catch(() => false))) await page.getByRole('button', { name: 'Next week' }).first().click();
  await firstBlock.waitFor();
  await shot(page, 'plans-planner');
  await firstBlock.click();
  const occDialog = page.getByRole('dialog').filter({ hasText: 'repeats weekly' });
  await occDialog.getByLabel('Title').fill('Intervals (outdoors)');
  await occDialog.getByRole('button', { name: 'Save for this session' }).click();
  await page.getByText('Changed this session only').waitFor();
  const { data: edited } = await admin.from('series_occurrences').select('title').eq('user_id', user.id).not('title', 'is', null);
  assert(edited.length === 1 && edited[0].title === 'Intervals (outdoors)', 'this-one-only edit not saved');

  // 8. Plans section: progress and check-off.
  const progress = page.getByRole('region', { name: 'Plans' }).getByTestId('plan-progress');
  await progress.getByText(/0 of 11 sessions done/).waitFor();
  await page.getByRole('checkbox', { name: /^Mark done: / }).first().check();
  await progress.getByText(/1 of 11 sessions done/).waitFor();
  await eventually(async () => Number((await admin.from('goals').select('current').eq('id', goal.id).single()).data.current) === 1, 'checking off did not move the linked goal');
  await shot(page, 'plans-section');

  // 9. Remove the plan and its upcoming blocks.
  await page.getByRole('button', { name: 'Remove plan' }).click();
  await page.getByRole('button', { name: 'Remove plan and upcoming blocks' }).click();
  await page.getByText('Plan and its upcoming blocks removed').waitFor();
  assert((await admin.from('plans').select('id').eq('user_id', user.id)).data.length === 0, 'plan not deleted');
  assert((await admin.from('block_series').select('id').eq('user_id', user.id)).data.length === 0, 'future blocks not deleted');
  assert((await admin.from('goals').select('id').eq('user_id', user.id)).data.length === 1, 'linked goal should be kept');
});

await flow('plans-voice', browser, {}, async (page) => {
  const user = await makeUser('Vic');
  await logIn(page, user);
  await page.keyboard.press('Control+j');
  await page.getByRole('button', { name: 'Switch to voice mode' }).click();
  const hud = page.getByRole('dialog', { name: 'Atlas voice mode' });
  await hud.getByText(/Systems online/).waitFor({ timeout: 10000 });
  await hud.getByRole('button', { name: 'Type instead' }).click();
  await hud.getByLabel('Type to Atlas').fill('workout plan on Mon and Thu at 7am for 3 weeks');
  await page.keyboard.press('Enter');
  const card = hud.getByRole('region', { name: 'Plan: 3-week workout plan' });
  await card.waitFor({ timeout: 15000 });
  await card.getByText('Thu 7:00 AM · 45 min · Upper body: push-ups, rows, shoulder press').waitFor();
  await hud.getByText(/3-week workout plan, Vic/).waitFor();
  await shot(page, 'plans-voice');
  // Dialogs open above the HUD, and Escape closes the dialog, not voice mode.
  await card.getByRole('button', { name: 'Edit' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit plan' });
  await editor.getByLabel('Session 1 title').waitFor();
  assert(await editor.getByRole('button', { name: 'Save changes' }).isVisible(), 'editor hidden behind the HUD');
  await page.keyboard.press('Escape');
  await editor.waitFor({ state: 'detached' });
  assert(await hud.isVisible(), 'Escape in the editor closed voice mode');
});

await flow('overlays', browser, {}, async (page) => {
  const user = await makeUser('Ola');
  await logIn(page, user);
  // Toasts are announced through a polite live region.
  await page.keyboard.press('n');
  await page.locator('#capture-text').fill('Start running again');
  await page.keyboard.press('Control+Enter');
  const live = page.locator('[role="status"][aria-live="polite"]');
  await live.getByText('Saved to your Brain Dump inbox').waitFor();
  // Note menus open above neighbouring cards and their items are clickable (X2).
  await page.goto(`${BASE}/app/brain-dump`);
  const note = page.getByRole('article').filter({ hasText: 'Start running again' });
  await note.getByRole('button', { name: 'Convert' }).click();
  const menu = page.getByRole('menu', { name: 'Convert' });
  await menu.waitFor();
  await page.keyboard.press('ArrowDown');
  await menu.getByRole('menuitem', { name: /Make habit/ }).click();
  const habitDialog = page.getByRole('dialog').last();
  await habitDialog.waitFor();
  await page.keyboard.press('Escape');
  await habitDialog.waitFor({ state: 'detached' });
  // Typing in a dialog keeps focus and every character (X1).
  await page.goto(`${BASE}/app/tasks`);
  await page.getByPlaceholder(/Add a task/i).first().fill('Draft essay');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Open task Draft essay' }).click();
  const editor = page.getByRole('dialog', { name: 'Task' });
  await editor.waitFor();
  const title = editor.locator('#task-title');
  await title.fill('');
  await title.pressSequentially('Draft the history essay', { delay: 15 });
  await editor.getByRole('button', { name: /More details/ }).click();
  const details = editor.locator('#task-details');
  await details.click();
  await details.pressSequentially('Intro, three arguments, conclusion', { delay: 15 });
  assert((await title.inputValue()) === 'Draft the history essay', `title lost characters: ${await title.inputValue()}`);
  assert((await details.inputValue()) === 'Intro, three arguments, conclusion', 'details lost characters');
  // Tab stays inside the dialog.
  for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
  assert(await editor.evaluate((el) => el.contains(document.activeElement)), 'focus escaped the dialog');
  // Escape closes only the top layer (X3): the palette over nothing, then Atlas stays when a dialog above it closes.
  await page.keyboard.press('Escape');
  await editor.waitFor({ state: 'detached' });
  await page.getByText('Draft the history essay').first().waitFor();
  // The editor saves automatically: tags typed and then Escape are kept (tasks-2).
  await page.getByRole('button', { name: 'Open task Draft the history essay' }).click();
  await editor.waitFor();
  await editor.locator('input[placeholder="work, errands"]').fill('essay, history');
  await page.keyboard.press('Escape');
  await editor.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '#essay' }).waitFor();
  await page.keyboard.press('Control+j');
  const panel = page.getByRole('dialog', { name: 'Atlas assistant' });
  await panel.waitFor();
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: /command|jump/i });
  await palette.waitFor();
  await page.keyboard.press('Escape');
  await palette.waitFor({ state: 'detached' });
  assert(await panel.isVisible(), 'Escape in the palette also closed Atlas');
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'detached' });
});

await flow('onboarding-back-no-duplicates', browser, {}, async (page) => {
  const user = await makeUser('Kit', { onboarded_at: null, tour_completed_at: null });
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: /^Log in/ }).click();
  await page.waitForURL(/\/app\/welcome/);
  await page.getByLabel('What should we call you?').fill('Kit');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByLabel('Your first brain dump').fill('first draft of my note');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByLabel('Your first task').fill('Finish the lab report');
  await page.getByRole('button', { name: /Continue/ }).click();
  // Go back twice, edit both, continue again: edits apply, nothing is duplicated.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByLabel('Your first task').fill('Finish the lab report tomorrow');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByLabel('Your first brain dump').fill('second draft of my note');
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByLabel('Your first habit').waitFor();
  assert(await page.getByRole('group', { name: 'Habit icon' }).getByRole('button', { pressed: true }).count() === 1, 'emoji selection not exposed');
  await page.getByRole('button', { name: /Finish/ }).click();
  await page.waitForURL(/\/app(\?tour=1)?$/);
  const { data: notes } = await admin.from('notes').select('body').eq('user_id', user.id);
  const { data: tasks } = await admin.from('tasks').select('title, due_date').eq('user_id', user.id);
  assert(notes.length === 1 && notes[0].body === 'second draft of my note', `notes: ${JSON.stringify(notes)}`);
  assert(tasks.length === 1 && tasks[0].title === 'Finish the lab report' && tasks[0].due_date, `tasks: ${JSON.stringify(tasks)}`);
});

await flow('planner-keyboard', browser, {}, async (page) => {
  const user = await makeUser('Kay');
  await admin.from('tasks').insert({ user_id: user.id, title: 'Read chapter 4', estimate_min: 60 });
  await logIn(page, user);
  await page.goto(`${BASE}/app/planner`);
  await page.getByRole('heading', { name: 'Planner' }).waitFor();
  await page.getByRole('tab', { name: 'day' }).click();
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '');
  // Schedule with the keyboard: from the quick-add field, Tab to the task, then to its clock button.
  await page.getByPlaceholder(/Add…/).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert((await focused()).includes('Pick a time for “Read chapter 4”'), `expected the clock button, focus is on ${await focused()}`);
  await page.keyboard.press('Enter');
  const dlg = page.getByRole('dialog', { name: 'Schedule task' });
  await dlg.waitFor();
  // Start has focus (the day defaults to the one on screen).
  await page.keyboard.type('1000A');
  await page.keyboard.press('Enter');
  await dlg.waitFor({ state: 'detached' });
  await page.getByText(/Scheduled for .*10:00/).waitFor();
  const row = async () => (await admin.from('tasks').select('sched_date, sched_start, sched_duration').eq('user_id', user.id).single()).data;
  await eventually(async () => (await row()).sched_start === 600, 'keyboard scheduling did not save 10:00');
  assert((await row()).sched_duration === 60, `duration ${(await row()).sched_duration}`);
  // Focus lands on the new block: ↓ moves it 15 minutes, Shift+↓ makes it 15 minutes longer.
  await eventually(async () => (await focused()).startsWith('Task block: Read chapter 4'), 'focus did not move to the new block');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await page.locator('[role="status"]').filter({ hasText: /Length 1h 15m/ }).waitFor();
  await eventually(async () => {
    const r = await row();
    return r.sched_start === 615 && r.sched_duration === 75;
  }, 'keyboard nudge was not saved');
  // Escape undoes a nudge that hasn't been saved yet.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await sleep(1000);
  assert((await row()).sched_start === 615, 'Escape did not undo the nudge');
  // Enter opens the block's time; Escape closes it and focus returns to the block.
  await page.keyboard.press('Enter');
  await page.getByRole('dialog', { name: 'Change time' }).waitFor();
  await shot(page, 'planner-keyboard');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Change time' }).waitFor({ state: 'detached' });
  assert((await focused()).startsWith('Task block: Read chapter 4'), `focus after closing: ${await focused()}`);
});

await flow('honest-numbers', browser, {}, async (page) => {
  const user = await makeUser('Noor');
  await logIn(page, user);
  // Goals: milestones can be added by hand, staged until Save; delete has Undo.
  await page.goto(`${BASE}/app/goals`);
  await page.getByRole('button', { name: 'Set your first goal' }).click();
  const dialog = page.getByRole('dialog', { name: 'New goal' });
  await dialog.getByRole('textbox', { name: 'Goal' }).fill('Read 3 books');
  await dialog.getByLabel('Target').fill('3');
  await dialog.getByRole('button', { name: 'Add a milestone' }).click();
  await dialog.getByRole('textbox', { name: 'Milestone 1' }).fill('Finish book one');
  await dialog.getByRole('button', { name: 'Add goal' }).click();
  const card = page.getByRole('article', { name: 'Read 3 books' });
  await card.getByText('Finish book one').waitFor();
  // 2 of 3 is 66%, never rounded up.
  await card.getByRole('button', { name: 'Increase by 1' }).click();
  await card.getByRole('button', { name: 'Increase by 1' }).click();
  await card.getByText('66%').waitFor();
  await card.getByRole('button', { name: 'Edit goal Read 3 books' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit goal' });
  await edit.getByRole('button', { name: 'Remove milestone Finish book one' }).click();
  await page.keyboard.press('Escape');
  await edit.waitFor({ state: 'detached' });
  assert(await card.getByText('Finish book one').isVisible(), 'milestone removed without Save');
  await card.getByRole('button', { name: 'Edit goal Read 3 books' }).click();
  await edit.getByRole('button', { name: 'Delete' }).click();
  await card.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('article', { name: 'Read 3 books' }).waitFor();
  // Habits: the history grid is one Tab stop with arrow keys; past-day edits can be undone.
  await page.goto(`${BASE}/app/habits`);
  await page.getByRole('button', { name: 'Add your first habit' }).click();
  await page.getByRole('textbox', { name: 'Habit' }).fill('Stretch');
  await page.getByRole('button', { name: 'Add habit' }).click();
  const grid = page.getByRole('grid', { name: /Stretch/ });
  await grid.waitFor();
  assert((await grid.locator('button[tabindex="0"]').count()) === 1, 'grid should have exactly one tab stop');
  assert((await grid.getByRole('gridcell', { name: /before you started/ }).count()) > 0, 'days before the habit started should be marked');
  await grid.locator('button[tabindex="0"]').focus();
  await page.keyboard.press('ArrowUp'); // yesterday is before the habit started: focus stays on today
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: /^1 day streak/ }).waitFor();
  await page.getByRole('button', { name: 'Undo Stretch for today' }).waitFor();
  // Focus: lengths can be cleared and retyped.
  await page.goto(`${BASE}/app/focus`);
  const len = page.getByRole('textbox', { name: 'Focus (min)' });
  await len.fill('');
  await len.pressSequentially('45');
  await len.press('Enter');
  assert((await len.inputValue()) === '45', `focus length is ${await len.inputValue()}`);
  await len.fill('500');
  await len.press('Enter');
  await page.getByText('Max is 180 min.').waitFor();
  await len.fill('25');
  await len.press('Enter');
  // Full screen: focus moves in, Space starts, Escape leaves and focus returns.
  await page.getByRole('button', { name: 'Full screen' }).click();
  const overlay = page.getByRole('dialog', { name: 'Full-screen focus' });
  await overlay.waitFor();
  await eventually(() => overlay.evaluate((el) => el.contains(document.activeElement)), 'focus did not move into the overlay');
  await page.keyboard.press('Escape');
  await overlay.waitFor({ state: 'detached' });
  await eventually(async () => (await page.evaluate(() => document.activeElement?.textContent ?? '')).includes('Full screen'), 'focus did not return to the Full screen button');
  // Review: every number shows once all its data has loaded; the AI button is enabled.
  await page.goto(`${BASE}/app/review`);
  await page.getByText('Habit consistency').waitFor();
  await eventually(() => page.getByRole('button', { name: 'AI summary' }).isEnabled(), 'AI summary stayed disabled');
  // Stopping a focus block early asks before throwing minutes away, and Discard can be undone.
  await page.clock.install();
  await page.goto(`${BASE}/app/focus`);
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.clock.runFor(3 * 60_000);
  await page.getByRole('button', { name: 'Reset timer' }).click();
  await page.getByRole('button', { name: 'Log 3 min' }).waitFor();
  assert(await page.getByRole('button', { name: 'Break', exact: true }).isDisabled(), 'mode switch should be locked mid-block');
  await page.getByRole('button', { name: 'Discard' }).click();
  await page.getByText('Discarded 3 min of focus.').waitFor();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByText('Paused', { exact: true }).first().waitFor();
});

await flow('voice-hud-states', browser, { reducedMotion: 'reduce' }, async (page) => {
  const user = await makeUser('Rae');
  await admin.from('ai_overrides').upsert({ user_id: user.id, daily_limit: 0 });
  await logIn(page, user);
  await page.keyboard.press('Control+j');
  await page.getByRole('button', { name: 'Switch to voice mode' }).click();
  const hud = page.getByRole('dialog', { name: 'Atlas voice mode' });
  await hud.getByRole('status').getByText('AI unavailable').waitFor({ timeout: 10000 });
  // Focus starts on the orb; with no AI left it is marked unavailable and says why.
  const orb = hud.getByRole('button', { name: /Talk to Atlas/ });
  assert(await orb.evaluate((el) => el === document.activeElement), 'orb not focused on open');
  assert((await orb.getAttribute('aria-disabled')) === 'true', 'orb not marked unavailable at 0 AI uses');
  await hud.getByText(/used today's AI allowance/).first().waitFor();
  await hud.getByRole('button', { name: 'Type instead' }).click();
  assert(await hud.getByLabel('Type to Atlas').isDisabled(), 'typed input enabled at 0 AI uses');
  // Reduced motion: nothing rotates or pulses (entrance fades are fine).
  const looping = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length);
  assert(looping === 0, `${looping} looping animations under reduced motion`);
  // Space on Exit activates Exit instead of turning the mic on.
  await hud.getByRole('button', { name: /Exit voice mode/ }).focus();
  await page.keyboard.press('Space');
  await hud.waitFor({ state: 'detached' });
});

for (const reduce of [false, true]) {
  await flow(reduce ? 'motion-reduced' : 'motion', browser, reduce ? { reducedMotion: 'reduce' } : {}, async (page) => {
    const user = await makeUser(reduce ? 'Rem' : 'Mo');
    await admin.from('goals').insert({ user_id: user.id, title: 'Run 100 km', emoji: '🏃', target: 100, current: 25, unit: 'km' });
    await logIn(page, user);
    // Menus grow from their trigger; under reduced motion they only fade.
    await page.getByRole('button', { name: 'Account menu' }).click();
    const menu = page.getByRole('menu').first();
    await menu.waitFor();
    const anim = await menu.evaluate((el) => getComputedStyle(el).animationName);
    assert(anim === (reduce ? 'fade' : 'menu-pop'), `menu animation: ${anim}`);
    await page.keyboard.press('Escape');
    // Progress bars scale instead of animating width.
    await page.goto(`${BASE}/app/goals`);
    const bar = page.getByRole('progressbar', { name: /Run 100 km/ }).locator('div').first();
    await bar.waitFor();
    const t = await bar.evaluate((el) => ({ transform: getComputedStyle(el).transform, prop: getComputedStyle(el).transitionProperty }));
    assert(t.transform.startsWith('matrix(0.25'), `progress transform: ${t.transform}`);
    assert(!/width/.test(t.prop), `progress transitions ${t.prop}`);
    // Nothing loops on an ordinary page.
    const looping = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length);
    assert(looping === 0, `${looping} looping animations on Goals`);
  });
}

await flow('mobile-touch', browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async (page) => {
  const user = await makeUser('Tess');
  await admin.from('tasks').insert({ user_id: user.id, title: 'Return library books' });
  await logIn(page, user);
  // Capture lives in the tab bar; nothing floats over content except the Atlas orb.
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Capture' }).tap();
  await page.getByRole('dialog', { name: 'Capture' }).waitFor();
  await page.getByRole('button', { name: 'Close' }).first().tap();
  assert(!(await page.getByRole('button', { name: 'Capture (N)' }).isVisible()), 'floating capture button shown on a phone');
  // Small controls get a 44px hit area on touch screens.
  await page.goto(`${BASE}/app/tasks`);
  const circle = page.getByRole('button', { name: /Complete “Return library books”/ });
  await circle.waitFor();
  const hit = await circle.evaluate((el) => {
    const a = getComputedStyle(el, '::after');
    const r = el.getBoundingClientRect();
    return { h: r.height - parseFloat(a.top) - parseFloat(a.bottom), w: r.width - parseFloat(a.left) - parseFloat(a.right) };
  });
  assert(hit.h >= 44 && hit.w >= 44, `task circle hit area ${hit.w}x${hit.h}`);
  // Planner: Unscheduled is folded so the timeline is near the top; it opens on tap.
  await page.goto(`${BASE}/app/planner`);
  const toggle = page.getByRole('button', { name: /Unscheduled/ });
  await toggle.waitFor();
  assert((await toggle.getAttribute('aria-expanded')) === 'false', 'Unscheduled should start folded on phones');
  await toggle.tap();
  await page.getByText('Return library books').first().waitFor();
  // No sideways scrolling on any main page.
  for (const path of ['', '/brain-dump', '/tasks', '/planner', '/habits', '/settings']) {
    await page.goto(`${BASE}/app${path}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(over <= 0, `/app${path} scrolls sideways by ${over}px`);
  }
});


// break-ui pass on the Atlas panel: worst-case history, plan card and composer, at phone and desktop widths.
await flow('atlas-worst-case', browser, {}, async (page) => {
  const user = await makeUser('Aleksandra', { name: 'Aleksandra Wiśniewska-Kowalczyk' });
  const longUrl = `https://northwind-industries-holdings.example.com/shared/documents/${'q3-planning-retrospective-final-v12-'.repeat(8)}`.slice(0, 300);
  const sessionTitles = ['Leg day: squats, lunges and Bulgarian split squats', 'Upper body push', 'Long run along the canal', 'Mobility', 'Intervals', 'Rest & stretch', 'Swim technique drills'];
  const { data: plan, error: planErr } = await admin
    .from('plans')
    .insert({
      user_id: user.id,
      title: 'Twelve-week half-marathon build with strength, mobility and recovery sessions around a busy lecture timetable'.padEnd(120, '!').slice(0, 120),
      summary: 'Seven sessions a week, built around your lectures and part-time shifts, easing off before exams.',
      weeks: 12,
      sessions: sessionTitles.map((title, i) => ({
        day: i + 1,
        start: 6 * 60 + i * 37,
        duration: 45 + i * 10,
        title,
        details: i === 0 ? 'warm up 10 min then 4×8 each side, rest 90 s https://example.com/very/long/exercise/video/link/that/does/not/break/anywhere-at-all' : '',
      })),
    })
    .select('id')
    .single();
  if (planErr) throw planErr;
  const heavy = [
    '# Your week at a glance',
    '## Priorities',
    '1. **Finish the lab report** — due *Thursday*',
    '2. `npm run build` keeps failing; try `rm -rf node_modules && npm ci --prefer-offline --no-audit --no-fund`',
    '- [ ] email Dr. Okonkwo-Hargreaves about the extension',
    '- [x] book the library room',
    '',
    '| Day | Morning | Afternoon | Evening | Notes |',
    '| --- | --- | --- | --- | --- |',
    ...Array.from({ length: 12 }, (_, i) => `| Day ${i + 1} | Lecture: Introduction to Thermodynamics ${i} | Lab ${i} | Shift at the café 18:00–22:00 | ${'bring-the-safety-goggles-and-lab-coat-'.repeat(2)} |`),
    '',
    '```',
    'const schedule=weeks.flatMap((w)=>w.days.map((d)=>({...d,start:d.start+offset}))).filter(Boolean).sort((a,b)=>a.start-b.start);',
    `const url = "${longUrl}";`,
    '```',
    `Read more: ${longUrl}`,
    `[${'The full reading list for Organic Chemistry '.repeat(3)}](${longUrl})`,
  ].join('\n');
  const special = [
    { role: 'user', content: 'Plan my revision for exams and add the reading list. '.repeat(40).slice(0, 2000) },
    { role: 'assistant', content: `Here is the link you asked for: ${longUrl}` },
    { role: 'user', content: longUrl },
    { role: 'assistant', content: heavy },
    { role: 'user', content: '🎉🔥💪🏽👩🏾‍💻🧑‍🤝‍🧑🏳️‍🌈 '.repeat(30) + '\n' + '👨‍👩‍👧‍👦'.repeat(60) },
    { role: 'assistant', content: 'مرحبا! لقد أضفت المهمة "مراجعة الفصل الثالث من كتاب الكيمياء العضوية" إلى قائمتك ليوم الخميس. هل تريد أن أحجز لها وقتًا في المخطط؟' },
    { role: 'user', content: 'أضف مهمة: الاتصال بالبنك غدًا الساعة العاشرة' },
    {
      role: 'assistant',
      content: 'Here is your plan.',
      actions: [
        { tool: 'add_task', summary: `Added task “${'Read chapter 4 of Organic Chemistry: Structure and Function '.repeat(3)}${longUrl}”`, ok: true },
        { tool: 'complete_task', summary: 'Could not find “T999”', ok: false },
        { tool: 'create_plan', summary: 'Drafted a plan', ok: true, plan_id: plan.id },
      ],
    },
  ];
  const filler = Array.from({ length: 200 - special.length }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: i % 2 ? `Done — reply number ${i}.` : `Message number ${i}` }));
  const { error: histErr } = await admin.from('atlas_messages').insert([...filler, ...special].map((m) => ({ user_id: user.id, actions: [], ...m })));
  if (histErr) throw histErr;

  await logIn(page, user);
  await page.keyboard.press('Control+j');
  const panel = page.getByRole('dialog', { name: 'Atlas assistant' });
  await panel.getByRole('region', { name: /^Plan:/ }).waitFor({ timeout: 10000 });
  await panel.getByText(/^مرحبا!/).waitFor();

  // Nothing in the panel sticks out sideways, and the page never scrolls sideways.
  const overflow = () =>
    page.evaluate(() => {
      const aside = document.querySelector('[role=dialog][aria-label="Atlas assistant"] aside');
      const box = aside.getBoundingClientRect();
      const scroller = aside.querySelector('.overflow-y-auto');
      const out = [...aside.querySelectorAll('*')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1);
        })
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} (${Math.round(el.getBoundingClientRect().right - box.right)}px)`);
      return { page: document.documentElement.scrollWidth - window.innerWidth, scroller: scroller.scrollWidth - scroller.clientWidth, out: out.slice(0, 8) };
    });
  for (const [w, h] of [[1280, 860], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(300);
    const o = await overflow();
    assert(o.page <= 0 && o.scroller <= 0 && !o.out.length, `overflow at ${w}px: page ${o.page}px, transcript ${o.scroller}px, ${o.out.join(', ')}`);
    await shot(page, `atlas-worst-case-${w}`);
  }
  for (const [name, target] of [['markdown', panel.getByRole('heading', { name: 'Your week at a glance' })], ['rtl', panel.getByText(/^مرحبا!/)], ['long-message', panel.getByText(/^Plan my revision/)]]) {
    await target.scrollIntoViewIfNeeded();
    await shot(page, `atlas-worst-case-390-${name}`);
  }
  // RTL replies read right to left.
  assert((await panel.getByText(/^مرحبا!/).evaluate((el) => getComputedStyle(el).direction)) === 'rtl', 'Arabic reply not laid out right to left');
  // The transcript is not a live region; one sr-only status speaks for it.
  assert((await panel.locator('[aria-live]').count()) === 0, 'an element in the Atlas panel still has aria-live');

  // A 2,000-character message grows the composer (to its cap), and a failed send keeps it.
  const input = panel.getByLabel('Message Atlas');
  const long = 'Please move my thermodynamics revision to the mornings and keep evenings free for shifts. '.repeat(30).slice(0, 2000);
  await input.fill(long);
  const hgt = await input.evaluate((el) => el.getBoundingClientRect().height);
  assert(hgt > 60 && hgt <= 130, `composer height ${hgt}px for a long message`);
  await page.route('**/api/atlas', (route) =>
    route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'Easy there — try again in 30s.', reason: 'rate_limit', retryAfter: 30 }) }),
  );
  await panel.getByRole('button', { name: 'Send' }).click();
  await panel.getByText('Not sent', { exact: true }).waitFor();
  await panel.getByRole('alert').getByText(/Easy there/).waitFor();
  assert(await panel.getByText(long.slice(0, 120)).first().isVisible(), 'failed message not kept in the transcript');
  assert((await input.inputValue()) === '', 'composer not cleared after sending');
  await panel.getByRole('button', { name: 'Edit message' }).click();
  assert((await input.inputValue()) === long, 'Edit did not restore the failed message');
  await page.unroute('**/api/atlas');

  // Offline (fetch rejects, no console noise from an aborted route): Retry resends the kept message.
  await page.evaluate(() => {
    const real = window.fetch;
    window.__atlas = { mode: 'offline', aborted: false, sent: 0, calls: 0 };
    window.fetch = (url, init) => {
      if (!String(url).includes('/api/atlas') || !String(init?.body ?? '').includes('"chat"')) return real(url, init);
      window.__atlas.calls++;
      if (window.__atlas.mode === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
      const enc = new TextEncoder();
      const body = new ReadableStream({
        start(c) {
          const id = setInterval(() => {
            c.enqueue(enc.encode(JSON.stringify({ t: 'text', v: `word${window.__atlas.sent++} ` }) + '\n'));
          }, 40);
          init.signal?.addEventListener('abort', () => {
            window.__atlas.aborted = true;
            clearInterval(id);
            c.error(new DOMException('Aborted', 'AbortError'));
          });
        },
      });
      return Promise.resolve(new Response(body, { headers: { 'content-type': 'application/x-ndjson' } }));
    };
  });
  await panel.getByRole('button', { name: 'Send' }).click();
  await panel.getByRole('alert').getByText(/Can't reach Atlas/).waitFor();
  assert((await input.inputValue()) === '', 'composer not cleared after sending');
  await panel.getByRole('button', { name: 'Retry sending' }).click();
  await eventually(async () => (await page.evaluate(() => window.__atlas.calls)) === 2, 'Retry did not resend');
  await panel.getByText('Not sent', { exact: true }).waitFor();
  await panel.getByRole('button', { name: 'Edit message' }).click();
  await input.fill('');

  // Stop: Send becomes Stop while a reply streams; Stop aborts the request and keeps what arrived.
  await page.evaluate(() => (window.__atlas.mode = 'slow'));
  await input.fill('Write me a long essay');
  await panel.getByRole('button', { name: 'Send' }).click();
  await panel.getByText(/word5 /).waitFor();
  assert((await panel.getByRole('status').first().innerText()).includes('Atlas is thinking'), 'no thinking announcement');
  await panel.getByRole('button', { name: 'Stop' }).click();
  await panel.getByText(/^Stopped\. Atlas keeps/).waitFor();
  const sentAtStop = await page.evaluate(() => window.__atlas.sent);
  await sleep(400);
  const state = await page.evaluate(() => window.__atlas);
  assert(state.aborted, 'Stop did not abort the request');
  assert(state.sent === sentAtStop, 'the stream kept going after Stop');
  await panel.getByRole('button', { name: 'Send' }).waitFor();
  assert(await panel.getByText('Write me a long essay').isVisible(), 'stopped message disappeared');
  await shot(page, 'atlas-worst-case-stopped');
});

// Voice HUD screen-reader output: "Voice mode ready" once, then the whole reply once (speech output off), never per token.
await flow('voice-hud-announce', browser, { reducedMotion: 'reduce' }, async (page) => {
  const user = await makeUser('Sol', { voice: { speak: false } });
  await logIn(page, user);
  await page.keyboard.press('Control+j');
  await page.getByRole('button', { name: 'Switch to voice mode' }).click();
  const hud = page.getByRole('dialog', { name: 'Atlas voice mode' });
  const sr = hud.locator('p.sr-only[role=status]');
  await sr.getByText('Voice mode ready.').waitFor({ timeout: 10000 });
  assert((await hud.locator('[aria-live]').count()) === 0, 'an element in the voice HUD still has aria-live');
  await hud.getByRole('button', { name: 'Type instead' }).click();
  await hud.getByLabel('Type to Atlas').fill("what's on today");
  await page.keyboard.press('Enter');
  await sr.getByText(/^Atlas: Here's your day, Sol/).waitFor({ timeout: 15000 });
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} flows passed`);
process.exit(failed.length ? 1 : 0);
