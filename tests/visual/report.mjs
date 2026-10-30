// Summarises detector results as Markdown, optionally against a baseline.
//   node tests/visual/report.mjs <label> [baselineLabel]
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const [label, base] = process.argv.slice(2);
const dir = (l) => `test-results/visual/${l}`;

function load(l) {
  const pages = {};
  // One file per capture run: detect-pages-dark.json, detect-pages-dark+light.json, …
  for (const f of readdirSync(dir(l)).filter((n) => /^detect-pages-.+\.json$/.test(n))) {
    Object.assign(pages, JSON.parse(readFileSync(`${dir(l)}/${f}`, 'utf8')));
  }
  const src = existsSync(`${dir(l)}/detect-src.json`) ? JSON.parse(readFileSync(`${dir(l)}/detect-src.json`, 'utf8')) : [];
  return { pages, src };
}

const count = (findings, filter = () => true) => findings.filter(filter).length;
const primary = (f) => f.severity !== 'advisory';
const cur = load(label);
const old = base ? load(base) : null;

const byRule = (data) => {
  const m = new Map();
  for (const v of Object.values(data.pages)) for (const f of v.findings ?? []) if (primary(f)) m.set(f.antipattern, (m.get(f.antipattern) ?? 0) + 1);
  return m;
};
const total = (data, theme) =>
  Object.entries(data.pages)
    .filter(([k]) => !theme || k.startsWith(theme))
    .reduce((n, [, v]) => n + count(v.findings ?? [], primary), 0);

const fmt = (now, before) => (before == null ? `${now}` : `${before} → **${now}**`);
const out = [];
out.push(`| Scope | ${old ? 'Before → after' : 'Findings'} |`, '|---|---|');
out.push(`| Pages, dark theme (26 pages × desktop + phone) | ${fmt(total(cur, 'dark'), old && total(old, 'dark'))} |`);
out.push(`| Pages, light theme | ${fmt(total(cur, 'light'), old && total(old, 'light'))} |`);
out.push(`| Source scan (\`src/\`) | ${fmt(count(cur.src, primary), old && count(old.src, primary))} |`);
out.push('', '**Page findings by rule** (both themes, advisories excluded):', '', `| Rule | ${old ? 'Before → after' : 'Count'} |`, '|---|---|');
const rules = new Map([...(old ? byRule(old) : []), ...byRule(cur)].map(([k]) => [k, 0]));
const cm = byRule(cur);
const om = old ? byRule(old) : null;
for (const r of [...rules.keys()].sort((a, b) => (om?.get(b) ?? cm.get(b) ?? 0) - (om?.get(a) ?? cm.get(a) ?? 0))) out.push(`| ${r} | ${fmt(cm.get(r) ?? 0, om ? om.get(r) ?? 0 : null)} |`);
out.push('', '**By page** (dark + light, desktop + phone):', '', `| Page | ${old ? 'Before → after' : 'Findings'} |`, '|---|---|');
const pageTotals = (data) => {
  const m = new Map();
  for (const [k, v] of Object.entries(data.pages)) {
    const name = k.split('/')[1];
    m.set(name, (m.get(name) ?? 0) + count(v.findings ?? [], primary));
  }
  return m;
};
const cp = pageTotals(cur);
const op = old ? pageTotals(old) : null;
for (const [name, n] of cp) out.push(`| ${name} | ${fmt(n, op ? op.get(name) ?? 0 : null)} |`);
console.log(out.join('\n'));
