// Writes a Markdown gallery (README.md) for a screenshot set, optionally side by side with a baseline.
//   node tests/visual/gallery.mjs <dir-with-theme-device-folders> "<title>" [relative-baseline-dir]
import { readdirSync, writeFileSync } from 'node:fs';

const [dir, title, baseRel] = process.argv.slice(2);
const variants = ['dark-desktop', 'light-desktop', 'dark-phone', 'light-phone'];
const pages = readdirSync(`${dir}/dark-desktop`).filter((f) => f.endsWith('.jpg')).map((f) => f.replace('.jpg', ''));
const out = [`# ${title}`, ''];
for (const page of pages) {
  out.push(`## ${page}`, '');
  if (baseRel) {
    out.push('| | Before | After |', '|---|---|---|');
    for (const v of variants) out.push(`| ${v} | <img src="${baseRel}/${v}/${page}.jpg" width="380"> | <img src="${v}/${page}.jpg" width="380"> |`);
  } else {
    out.push('| Dark · desktop | Light · desktop | Dark · phone | Light · phone |', '|---|---|---|---|');
    out.push('| ' + variants.map((v) => `<img src="${v}/${page}.jpg" width="${v.endsWith('phone') ? 150 : 300}">`).join(' | ') + ' |');
  }
  out.push('');
}
writeFileSync(`${dir}/README.md`, out.join('\n'));
