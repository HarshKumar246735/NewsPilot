import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchRoute } from '../src/routes.js';
import { resolvePage } from '../src/resolve.js';
import { renderHeadHtml } from '../src/head.js';
import { createDemoSource } from '../src/demo/demoSource.js';
import { CATEGORIES, buildArticles } from '../src/demo/demoData.js';
import { prepareArticleHtml } from '../src/utils/articleHtml.js';
import { responsiveImage } from '../src/utils/cloudinary.js';
import { timeAgo, formatDate, formatDateTime, formatLongDate } from '../src/utils/format.js';
import { isValidSlug } from '../src/seo.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = { demo: true, siteUrl: 'https://news.example.org', apiUrl: '' };
const prodConfig = { demo: false, siteUrl: 'https://news.example.org', apiUrl: '' };
const ds = createDemoSource(config);
const shell = await ds.shell();
const go = (u, c = config, d = ds) => resolvePage(u, d, shell, c);

test('route table matches expected URLs and rejects the rest', () => {
  assert.equal(matchRoute('/').name, 'home');
  assert.deepEqual(matchRoute('/article/x').params, { slug: 'x' });
  assert.deepEqual(matchRoute('/category/technology/artificial-intelligence').params, { a: 'technology', b: 'artificial-intelligence' });
  assert.equal(matchRoute('/privacy-policy').params.slug, 'privacy-policy');
  assert.equal(matchRoute('/nope'), null);
  assert.equal(matchRoute('/article/%E0%A4%A'), null); // malformed escape does not throw
});

test('demo data integrity: 22 unique valid slugs, real categories, images on disk', () => {
  const arts = buildArticles();
  assert.equal(arts.length, 22);
  assert.equal(new Set(arts.map((a) => a.slug)).size, 22);
  for (const a of arts) {
    assert.ok(isValidSlug(a.slug), a.slug);
    assert.ok(CATEGORIES.some((c) => c.slug === a.category.slug), a.category.slug);
    assert.ok(fs.existsSync(path.join(here, '../public', a.image.url)), a.image.url);
    assert.ok(a.image.alt.length > 10);
  }
  const slugs = CATEGORIES.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.ok(CATEGORIES.filter((c) => c.parentSlug).every((c) => slugs.includes(c.parentSlug)));
});

test('home resolves with hero, sections and no duplicate hero stories', async () => {
  const p = await go('/');
  assert.equal(p.status, 200);
  const { hero, latest } = p.data;
  assert.ok(hero.main && hero.secondary.length >= 2);
  const heroSlugs = new Set([hero.main, ...hero.secondary].map((a) => a.slug));
  assert.ok(latest.every((a) => !heroSlugs.has(a.slug)));
  assert.ok(p.data.sections.length >= 5);
});

test('article: 200 with canonical + JSON-LD built by the SEO engine; unknown slug is a real 404', async () => {
  const slug = buildArticles()[0].slug;
  const p = await go(`/article/${slug}`);
  assert.equal(p.status, 200);
  assert.equal(p.head.canonical, `https://news.example.org/article/${slug}`);
  assert.deepEqual(p.head.jsonLd.map((l) => l['@type']), ['Article', 'BreadcrumbList']);
  const miss = await go('/article/does-not-exist');
  assert.equal(miss.status, 404); assert.equal(miss.name, 'notFound');
  assert.match(miss.head.robots, /noindex/);
});

test('demo mode is always noindex; real mode is indexable', async () => {
  const slug = buildArticles()[0].slug;
  assert.equal((await go(`/article/${slug}`)).head.robots, 'noindex, nofollow');
  const real = await go(`/article/${slug}`, prodConfig);
  assert.match(real.head.robots, /^index, follow/);
});

test('redirects: trailing slash, uppercase, ?page=1, child category short URL', async () => {
  assert.deepEqual(await go('/latest/'), { redirect: '/latest', status: 301 });
  assert.equal((await go('/Latest')).redirect, '/latest');
  assert.equal((await go('/latest?page=1')).redirect, '/latest');
  assert.equal((await go('/latest?page=abc')).redirect, '/latest');
  assert.equal((await go('/category/artificial-intelligence')).redirect, '/category/technology/artificial-intelligence');
});

test('categories: nested path works, wrong parent 404s, pagination bounds 404, descendants roll up', async () => {
  const ai = await go('/category/technology/artificial-intelligence');
  assert.equal(ai.status, 200); assert.equal(ai.data.items.length, 1);
  assert.equal((await go('/category/world/artificial-intelligence')).status, 404);
  assert.equal((await go('/category/technology?page=2')).status, 404);
  const tech = await go('/category/technology');
  assert.ok(tech.data.total >= 3);
  const empty = await go('/category/entertainment/hollywood');
  assert.equal(empty.status, 200); assert.match(empty.head.robots, /noindex/); // thin page stays out of the index
});

test('pagination SEO: page 2 has self canonical and prev/next', async () => {
  const p = await go('/latest?page=2', prodConfig);
  assert.equal(p.status, 200);
  assert.equal(p.head.canonical, 'https://news.example.org/latest?page=2');
  assert.ok(p.head.links.some((l) => l.rel === 'prev' && l.href === 'https://news.example.org/latest'));
  assert.ok(p.head.links.some((l) => l.rel === 'next' && l.href.endsWith('/latest?page=3'))); // 22 items / 9 per page = 3 pages
  assert.ok(!(await go('/latest?page=3', prodConfig)).head.links.some((l) => l.rel === 'next'));
  assert.equal((await go('/latest?page=4', prodConfig)).status, 404);
  const p1 = await go('/latest', prodConfig);
  assert.ok(p1.head.links.some((l) => l.rel === 'next' && l.href.endsWith('/latest?page=2')));
});

test('search: noindex with a single canonical, matches content, empty query is safe', async () => {
  const r = await go('/search?q=monsoon', prodConfig);
  assert.equal(r.data.q, 'monsoon'); assert.ok(r.data.items.length >= 1);
  assert.equal(r.head.canonical, 'https://news.example.org/search'); assert.match(r.head.robots, /^noindex/);
  assert.equal((await go('/search')).data.items.length, 0);
  assert.equal((await go('/search?q=zzzzqqq')).data.total, 0);
});

test('static pages resolve; unknown top-level path is 404', async () => {
  for (const s of ['about', 'contact', 'privacy-policy', 'corrections-policy', 'advertise']) assert.equal((await go(`/${s}`)).status, 200, s);
  assert.equal((await go('/wp-login.php')).status, 404);
});

test('data-source failure becomes a 500 error page, not a crash', async () => {
  const broken = { ...ds, home: async () => { throw new Error('boom'); } };
  const p = await go('/', config, broken);
  assert.equal(p.status, 500); assert.equal(p.name, 'error');
  assert.ok(!JSON.stringify(p.data).includes('boom')); // internal message is not leaked
});

test('head HTML escapes content and keeps JSON-LD script-safe', async () => {
  const slug = buildArticles()[0].slug;
  const html = renderHeadHtml((await go(`/article/${slug}`, prodConfig)).head);
  assert.match(html, /<link rel="canonical" href="https:\/\/news\.example\.org\/article\//);
  assert.match(html, /property="article:published_time"/);
  assert.match(html, /<script type="application\/ld\+json" data-np-head>/);
  const h = (await go(`/article/${slug}`, prodConfig)).head; h.title = 'A "quoted" <b>title</b>';
  assert.ok(renderHeadHtml(h).includes('A &quot;quoted&quot; &lt;b&gt;title&lt;/b&gt;'));
});

test('article HTML prep adds unique heading ids, TOC and lazy images', () => {
  const { html, toc } = prepareArticleHtml('<h2>Why it matters</h2><p>x</p><h2>Why it matters</h2><h3 id="keep">Sub</h3><img src="a.jpg" alt="a">');
  assert.deepEqual(toc.map((t) => t.id), ['why-it-matters', 'why-it-matters-2', 'keep']);
  assert.match(html, /<h2 id="why-it-matters">/); assert.match(html, /<img loading="lazy" decoding="async" src/);
});

test('cloudinary helper only transforms Cloudinary URLs', () => {
  assert.equal(responsiveImage({ url: '/demo/a.svg' }).srcSet, undefined);
  const r = responsiveImage({ url: 'https://res.cloudinary.com/demo/image/upload/v1/x.jpg' });
  assert.match(r.srcSet, /f_auto,q_auto,c_limit,w_480\/v1\/x\.jpg 480w/);
});

test('date formatting is deterministic and relative times are sane', () => {
  assert.equal(formatDate('2026-10-10T08:00:00Z'), '10 Oct 2026');
  const now = '2026-10-10T12:00:00Z';
  assert.equal(timeAgo('2026-10-10T11:59:30Z', now), 'Just now');
  assert.equal(timeAgo('2026-10-10T10:00:00Z', now), '2 hr ago');
  assert.equal(timeAgo('2026-10-01T10:00:00Z', now), '1 Oct 2026');
});

test('demo sitemap lists every article and no search/admin URLs', async () => {
  const e = await ds.sitemapEntries();
  assert.equal(e.filter((x) => x.loc.includes('/article/')).length, 22);
  assert.ok(!e.some((x) => /\/(search|admin|api)/.test(x.loc)));
});

test('home never repeats a story between the hero rail and the Latest grid', async () => {
  const { hero, latest } = (await go('/')).data;
  const seen = new Set([hero.main, ...hero.secondary, ...hero.latest].map((a) => a.slug));
  assert.ok(latest.length >= 6);
  assert.ok(latest.every((a) => !seen.has(a.slug)), 'Latest grid repeats a hero story');
});

test('demo mode without the build-time flag fails loudly with a clear message (the dev server sets the flag itself)', async () => {
  const { createDataSource } = await import('../src/services/dataSource.js');
  const saved = globalThis.__ALLOW_DEMO__; delete globalThis.__ALLOW_DEMO__;
  try { await assert.rejects(createDataSource({ demo: true }), /not included in this build/); } finally { globalThis.__ALLOW_DEMO__ = saved; }
});

test('date formatting is engine-independent (no Intl) and correct across IST boundaries', () => {
  assert.equal(formatDate('2026-10-10T20:00:00Z'), '11 Oct 2026'); // 01:30 IST next day
  assert.equal(formatDateTime('2026-10-11T06:26:00Z'), '11 Oct 2026, 11:56 am IST');
  assert.equal(formatDateTime('2026-10-11T18:30:00Z'), '12 Oct 2026, 12:00 am IST');
  assert.equal(formatDateTime('2026-10-11T06:30:00Z'), '11 Oct 2026, 12:00 pm IST');
  assert.equal(formatLongDate('2026-10-12T10:00:00Z'), 'Monday, 12 October 2026');
  assert.equal(formatLongDate('2026-12-31T20:00:00Z'), 'Friday, 1 January 2027');
});
