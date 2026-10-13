// Optional visual QA (needs Playwright, which is NOT a project dependency):
//   node scripts/visual-check.mjs  -> renders SSR HTML + the project's CSS in Chromium, saves screenshots to /tmp/np-shots
// Limits: no client JavaScript runs (menus/dialogs stay closed), and web fonts fall back to system fonts when offline.
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const client = path.resolve('client');
globalThis.__ALLOW_DEMO__ = true;
register(pathToFileURL(path.join(client, 'test/harness/loader.mjs')).href, import.meta.url);
const { render } = await import(pathToFileURL(path.join(client, 'src/entry-server.jsx')).href);
const { buildArticles } = await import(pathToFileURL(path.join(client, 'src/demo/demoData.js')).href);
const NM = process.env.NP_GLOBAL_NODE_MODULES || '/home/claude/.npm-global/lib/node_modules';
const { chromium } = createRequire(path.join(NM, 'x.js'))('playwright');

// Same order the app imports CSS (global first, then components/pages); variables.css is @imported by global.css.
const read = (f) => fs.readFileSync(path.join(client, 'src', f), 'utf8');
const files = fs.readdirSync(path.join(client, 'src/components')).filter((f) => f.endsWith('.css')).map((f) => `components/${f}`)
  .concat(fs.readdirSync(path.join(client, 'src/pages')).filter((f) => f.endsWith('.css')).map((f) => `pages/${f}`));
const css = read('styles/variables.css') + read('styles/global.css').replace("@import './variables.css';", '') + files.map(read).join('\n');

const out = '/tmp/np-shots'; fs.mkdirSync(out, { recursive: true });
const config = { demo: true, siteUrl: 'https://news.example.org', apiUrl: '' };
const first = buildArticles()[0].slug;
const pages = { home: '/', article: `/article/${first}`, category: '/category/technology', search: '/search?q=guide', notfound: '/nope', newsletterless: '/about' };
const sizes = { phone: 390, tablet: 820, laptop: 1280, wide: 1760 };

const browser = await chromium.launch();
const report = [];
for (const [name, url] of Object.entries(pages)) {
  const r = await render(url, config);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="file://${client}/public/"><style>${css.replaceAll('url(/', 'url(')}</style></head><body><div id="root">${r.html.replaceAll('src="/', 'src="')}</div></body></html>`;
  const file = path.join(out, `${name}.html`); fs.writeFileSync(file, html);
  for (const [sz, w] of Object.entries(sizes)) {
    if (!['phone', 'tablet', 'laptop', 'wide'].includes(sz)) continue;
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto(pathToFileURL(file).href); await page.waitForLoadState('load');
    const m = await page.evaluate(() => ({ sw: Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('main *, header *, footer *')].filter((e) => !e.closest('.breaking__viewport, .prose table')).map((e) => Math.ceil(e.getBoundingClientRect().right))), cw: document.documentElement.clientWidth,
      wide: [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 3).map((e) => e.className || e.tagName) }));
    report.push(`${name}@${w}: overflow=${m.sw > m.cw ? 'YES ' + m.sw + '>' + m.cw + ' ' + m.wide.join(',') : 'no'}`);
    if (['home', 'article'].includes(name) || sz === 'phone') await page.screenshot({ path: path.join(out, `${name}-${sz}.png`), fullPage: false });
    if (name === 'home' && sz === 'laptop') await page.screenshot({ path: path.join(out, 'home-laptop-full.png'), fullPage: true });
    if (name === 'home' && sz === 'phone') await page.screenshot({ path: path.join(out, 'home-phone-full.png'), fullPage: true });
    await page.close();
  }
}
await browser.close();
console.log(report.join('\n'));
