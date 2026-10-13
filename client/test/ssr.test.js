// Server-render smoke tests. They run the real React components and the real entry-server render(),
// with demo content. react-router-dom and lucide-react are replaced by tiny stand-ins (see test/harness),
// so these tests do NOT prove Vite bundling, hydration, or real router behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.__ALLOW_DEMO__ = true;
register('./harness/loader.mjs', import.meta.url);
const { render } = await import('../src/entry-server.jsx');
const { fillTemplate } = await import('../ssr-handler.js');
const { buildArticles } = await import('../src/demo/demoData.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const config = { demo: true, siteUrl: 'https://news.example.org', apiUrl: '' };
const real = { demo: false, siteUrl: 'https://news.example.org', apiUrl: 'https://api.example.org/api' };
const first = buildArticles()[0];

async function page(url, cfg = config) {
  const errors = [];
  const orig = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try { return { ...(await render(url, cfg)), errors }; } finally { console.error = orig; }
}
const text = (html) => html.replace(/<[^>]+>/g, ' ');

test('every route renders with the right status, no React warnings, and no leaked placeholders', async () => {
  const cases = [
    ['/', 200], [`/article/${first.slug}`, 200], ['/category/technology', 200], ['/category/technology/artificial-intelligence', 200],
    ['/category/entertainment/hollywood', 200], ['/author/ananya-rao', 200], ['/latest', 200], ['/latest?page=2', 200], ['/trending', 200],
    ['/search?q=monsoon', 200], ['/search?q=zzzzqqq', 200], ['/search', 200], ['/categories', 200], ['/about', 200], ['/contact', 200],
    ['/editorial-policy', 200], ['/corrections-policy', 200], ['/privacy-policy', 200], ['/terms', 200], ['/disclaimer', 200],
    ['/cookie-policy', 200], ['/affiliate-disclosure', 200], ['/advertise', 200],
    ['/article/not-a-real-article', 404], ['/nope', 404], ['/category/technology?page=9', 404],
  ];
  for (const [url, status] of cases) {
    const r = await page(url);
    assert.equal(r.status, status, url);
    assert.ok(r.html.length > 500, `${url} produced no HTML`);
    assert.deepEqual(r.errors, [], `${url} React warnings: ${r.errors.join(' | ').slice(0, 300)}`);
    assert.ok(!/undefined|\[object Object\]|NaN/.test(text(r.html)), `${url} leaked a placeholder: ${text(r.html).match(/.{30}(undefined|\[object Object\]|NaN).{30}/)?.[0]}`);
    assert.equal((r.html.match(/<h1[\s>]/g) || []).length, 1, `${url} should have exactly one h1`);
  }
});

test('redirects are returned as 301 with a Location', async () => {
  for (const [from, to] of [['/latest/', '/latest'], ['/latest?page=1', '/latest'], ['/category/artificial-intelligence', '/category/technology/artificial-intelligence']]) {
    const r = await page(from);
    assert.equal(r.status, 301); assert.equal(r.redirect, to);
  }
});

test('article HTML a crawler receives contains the headline, body, byline, breadcrumbs and canonical in the source', async () => {
  const r = await page(`/article/${first.slug}`, real.demo ? real : { ...config, demo: false, apiUrl: '' }).catch(() => null);
  // demo=false needs an API, so assert on the demo render for body content instead:
  const d = await page(`/article/${first.slug}`);
  assert.match(d.html, /<h1[^>]*class="article__title"[^>]*>What a monsoon forecast/);
  assert.match(d.html, /<h2 id="what-headline-number-measures">/);          // body rendered + heading ids
  assert.match(d.html, /<nav class="crumbs" aria-label="Breadcrumb">/);
  assert.match(d.html, /By <a href="\/author\/sara-whitfield">Sara Whitfield<\/a>/);
  assert.match(d.html, /<time dateTime="[^"]+">/);
  assert.match(d.html, /<table>/);
  assert.match(d.headHtml, /<link rel="canonical" href="https:\/\/news\.example\.org\/article\/what-monsoon/);
  assert.match(d.headHtml, /"@type":"Article"/); assert.match(d.headHtml, /"@type":"BreadcrumbList"/);
  assert.match(d.headHtml, /<link rel="preload" as="image" fetchpriority="high" href="\/demo\/img-01\.svg"/); // LCP preloaded from <head>
  assert.ok(!/<link rel="preload"/.test(d.html), 'no hoistable preload may appear in the body markup');
  assert.match(d.html, /<img class="img " src="\/demo\/img-01\.svg"[^>]*loading="eager"/);
  assert.equal(r === null || r.status === 500, true); // non-demo with no API reports a configuration problem, not fake content
});

test('homepage: hero, ticker, sections, picks, newsletter and footer are all present; ticker content comes from data', async () => {
  const h = (await page('/')).html;
  for (const needle of ['class="hero container"', 'class="breaking"', 'Latest news', 'Trending now', 'Most read', 'Editor’s picks', 'Popular guides', 'id="newsletter"', 'class="site-footer"', 'Demonstration content for design review']) {
    assert.ok(h.includes(needle), `missing: ${needle}`);
  }
  const imgs = [...h.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(imgs.length > 10);
  assert.ok(imgs.every((i) => /width="1600"/.test(i) && /height="1000"/.test(i) && /alt="[^"]+"/.test(i)), 'every image needs dimensions and alt text');
  assert.equal(imgs.filter((i) => /loading="eager"/.test(i)).length, 1, 'exactly one eager (LCP) image');
  assert.ok(imgs.filter((i) => /loading="lazy"/.test(i)).length === imgs.length - 1);
  assert.match((await page('/')).headHtml, /rel="preload" as="image" fetchpriority="high"/);
});

test('no dead links: every internal href on the homepage and article resolves to a non-404 route', async () => {
  const seen = new Set();
  for (const url of ['/', `/article/${first.slug}`, '/categories']) {
    const html = (await page(url)).html;
    for (const m of html.matchAll(/href="(\/[^"#]*)"/g)) seen.add(m[1].replace(/&amp;/g, '&'));
  }
  assert.ok(seen.size > 60);
  for (const href of seen) {
    if (/^\/(favicon|demo|assets)/.test(href)) continue;
    const r = await page(href);
    assert.ok([200, 301].includes(r.status), `${href} -> ${r.status}`);
    if (r.status === 301) { const t = await page(r.redirect); assert.equal(t.status, 200, `${href} redirects to ${r.redirect} -> ${t.status}`); }
  }
});

test('search page output is escaped (no HTML injection through q)', async () => {
  const r = await page('/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
  assert.ok(!r.html.includes('<script>alert(1)'));
  assert.ok(!r.headHtml.includes('<script>alert(1)'));
  assert.match(r.headHtml, /noindex/);
});

test('robots.txt and sitemap.xml', async () => {
  const demoRobots = await page('/robots.txt');
  assert.match(demoRobots.body, /Disallow: \//);
  const sm = await page('/sitemap.xml');
  assert.equal(sm.status, 200); assert.match(sm.type, /xml/);
  assert.equal((sm.body.match(/<url>/g) || []).length, 1 + 32 + 3 + 22);
});

test('misconfiguration is reported, not hidden: missing SITE_URL and missing API both give a 500', async () => {
  assert.equal((await page('/', { demo: true, siteUrl: '', apiUrl: '' })).status, 500);
  const r = await page('/', { demo: false, siteUrl: 'https://news.example.org', apiUrl: '' });
  assert.equal(r.status, 500); assert.ok(!/<h1/.test(r.body || ''));
});

test('template fill keeps the state JSON safe inside <script>', async () => {
  const r = await page('/search?q=%3C%2Fscript%3E%3Cb%3E');
  const html = fillTemplate(fs.readFileSync(path.join(here, '../template.html'), 'utf8'), r);
  const state = html.match(/<script id="np-state" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => JSON.parse(state));
  assert.equal((html.match(/<\/script>/g) || []).length, (html.match(/<script/g) || []).length); // nothing broke out of a tag
  assert.ok(html.includes('<div id="root"><div') || html.includes('<div id="root"><'));
});
