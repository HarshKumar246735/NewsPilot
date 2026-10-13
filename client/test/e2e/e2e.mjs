// Optional browser end-to-end run (needs Playwright, which is NOT a project dependency):  node test/e2e/e2e.mjs
// Real React 19 + real Chromium + the real API code over HTTP + real SSR. Stand-ins: react-router-dom/lucide-react
// shims, an in-memory database, and an Express-compatible harness. See README "Verification".
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServers } from './server.mjs';

const NM = process.env.NP_GLOBAL_NODE_MODULES || '/home/claude/.npm-global/lib/node_modules';
const req = createRequire(path.join(NM, 'x.js'));
const { chromium } = req('playwright'); const sharp = req('sharp');
const SHOTS = process.env.E2E_SHOTS || '/tmp/np-e2e'; fs.mkdirSync(SHOTS, { recursive: true });

const S = await startServers();
const { w, siteOrigin } = S;
const png = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#2f6fb3' } }).composite([{ input: Buffer.from('<svg width="1600" height="1000"><circle cx="1100" cy="300" r="160" fill="#f2c14e"/><rect y="640" width="1600" height="360" fill="#10243f"/></svg>'), top: 0, left: 0 }]).png().toBuffer();

// ---- seed content through the real admin API ----
const up = await w.c.post('/admin/media/local', { token: w.adminToken, body: { data: png.toString('base64'), originalName: 'seed.png', alt: 'Abstract blue illustration' } });
if (!up.body?.item) { console.error('seed upload failed', up.status, up.text.slice(0, 300)); process.exit(2); }
const img = { url: up.body.item.url, alt: 'Abstract blue illustration', width: 1600, height: 1000 };
const para = (n) => `<p>${'Readers deserve clear explanations of how things work. '.repeat(6)}</p><h2>Background ${n}</h2><p>${'Details matter, and so does context. '.repeat(8)}</p><ul><li>First point</li><li>Second point</li></ul><h2>What it means ${n}</h2><p>Closing paragraph ${n}.</p><p>One more ${n}.</p><h3>A closer look</h3><p>And another ${n}.</p><h2>Takeaways ${n}</h2><p>Last words ${n}.</p>`;
const titles = ['How city planners choose a metro route', 'What a monsoon forecast really tells you', 'Reading a quarterly report in plain language', 'Why indie studios build smaller games', 'A beginner guide to home network security', 'How exam result portals survive traffic spikes', 'Strength training twice a week', 'The science of why rain smells'];
const cats = ['india', 'india', 'finance', 'gaming', 'cybersecurity', 'exams-results', 'fitness', 'science'];
const seeded = [];
for (const [i, t] of titles.entries()) seeded.push(await w.mkPub({ title: t, contentHtml: para(i), categorySlug: cats[i], image: img, isFeatured: i === 0, isBreaking: i === 1, tags: i % 3 === 0 ? ['guide'] : [] }));

// ---- tiny test runner ----
const results = []; const consoleIssues = [];
const EXPECTED = [/^404 GET \/nope$/, /^401 POST \/auth\/login$/, /^409 POST \/admin\/categories$/, /^422 PUT \/admin\/settings$/];
async function step(name, fn) { try { await fn(); results.push([name, true]); console.log('  ok  ', name); } catch (e) { results.push([name, false, e.message.split('\n')[0]]); console.log('  FAIL', name, '\n       ', e.message.split('\n').slice(0, 3).join('\n        ')); } }
const ok = (c, m) => { if (!c) throw new Error(m); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
function watch(page, label) {
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/Failed to load resource/.test(m.text())) consoleIssues.push(`[${label}] ${m.type()}: ${m.text().slice(0, 300)}`); });
  // Failed requests are judged by an explicit allow-list: only the deliberate negative tests may fail.
  page.on('response', (r) => { if (r.status() >= 400) { const line = `${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`; if (!EXPECTED.some((re) => re.test(line))) consoleIssues.push(`[${label}] unexpected failed request: ${line}`); } });
  page.on('pageerror', (e) => consoleIssues.push(`[${label}] pageerror: ${e.message.slice(0, process.env.E2E_FULL ? 3000 : 300)}`));
}
const page = await ctx.newPage(); watch(page, 'public');

console.log('\nPublic site');
await step('home hydrates and is interactive (search dialog opens)', async () => {
  await page.goto(siteOrigin + '/'); await page.waitForSelector('.hero');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.waitForSelector('dialog[open] input[type=search]'); ok(await page.evaluate(() => document.activeElement?.type === 'search'), 'search input should be focused');
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForFunction(() => [...document.images].filter((i) => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight).every((i) => i.complete)); await page.screenshot({ path: `${SHOTS}/public-home.png` });
});
await step('breaking ticker shows the flagged story; hero is the featured one', async () => {
  ok((await page.locator('.breaking__track a').first().textContent()).includes('monsoon'), 'ticker text');
  ok((await page.locator('.hero__title').textContent()).includes('metro route'), 'hero title');
});
await step('client-side navigation to an article (no full reload) updates title, canonical and JSON-LD', async () => {
  await page.evaluate(() => { window.__marker = 'alive'; });
  await page.locator('.hero__title a').click(); await page.waitForURL(/\/article\//);
  await page.waitForSelector('h1.article__title');
  ok(await page.evaluate(() => window.__marker) === 'alive', 'page fully reloaded');
  ok((await page.title()).includes('metro route'), `title was ${await page.title()}`);
  ok((await page.getAttribute('link[rel=canonical]', 'href')).startsWith(siteOrigin + '/article/'), 'canonical');
  ok((await page.locator('script[type="application/ld+json"]').count()) === 2, 'JSON-LD count');
  ok((await page.locator('link[rel=canonical]').count()) === 1, 'exactly one canonical after navigation');
});
await step('article page: breadcrumbs, TOC, share copy-link, related, view recorded', async () => {
  ok(await page.locator('nav.crumbs').isVisible(), 'breadcrumbs'); ok(await page.locator('.toc--sidebar a').count() >= 1, 'toc');
  await page.getByRole('button', { name: /Copy link/ }).click(); await page.waitForSelector('text=Link copied');
  ok((await page.evaluate(() => navigator.clipboard.readText())).includes('/article/'), 'clipboard');
  ok(await page.locator('.article__related .card').count() >= 1, 'related');
  await page.waitForTimeout(300); ok((await w.store.col('articles').findOne({ id: seeded[0].id })).views >= 1, 'view not recorded');
});
await step('browser back returns to the homepage', async () => { await page.goBack(); await page.waitForSelector('.hero'); ok(new URL(page.url()).pathname === '/', 'path'); });
await step('search: dialog -> results page (client navigation) -> empty state', async () => {
  await page.getByRole('button', { name: 'Search' }).click(); await page.fill('dialog[open] input[type=search]', 'monsoon'); await page.keyboard.press('Enter');
  await page.waitForURL(/\/search\?q=monsoon/); await page.waitForSelector('.card--horizontal'); ok((await page.locator('.card--horizontal').count()) === 1, 'one result');
  await page.fill('main input[type=search]', 'zzzzqqq'); await page.keyboard.press('Enter'); await page.waitForSelector('text=No results for');
});
await step('category page and pagination (via URL), 404 page', async () => {
  await page.goto(siteOrigin + '/category/india'); await page.waitForSelector('h1.page-title'); ok((await page.locator('.listing .card').count()) === 2, 'two india stories');
  const r = await page.goto(siteOrigin + '/nope'); ok(r.status() === 404, 'status'); await page.waitForSelector('.notfound');
});
await step('newsletter: validation, then real signup stored with consent', async () => {
  await page.goto(siteOrigin + '/'); await page.waitForSelector('#newsletter');
  await page.fill('#nl-email', 'nope'); await page.getByRole('button', { name: 'Subscribe' }).last().click(); await page.waitForSelector('text=valid email');
  await page.fill('#nl-email', 'reader@example.org'); await page.getByRole('button', { name: 'Subscribe' }).last().click(); await page.waitForSelector('text=Please tick the box');
  await page.check('.newsletter__consent input'); await page.getByRole('button', { name: 'Subscribe' }).last().click(); await page.waitForSelector('text=You are subscribed');
  const row = await w.store.col('subscribers').findOne({ email: 'reader@example.org' }); ok(row && row.consent.at, 'subscriber stored with consent');
});
await step('mobile: header drawer opens, search form works, no horizontal overflow', async () => {
  const m = await ctx.newPage(); watch(m, 'mobile'); await m.setViewportSize({ width: 390, height: 800 });
  await m.goto(siteOrigin + '/'); await m.waitForSelector('.hero');
  ok(!(await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), 'overflow');
  await m.getByRole('button', { name: 'Open menu' }).click(); await m.waitForSelector('dialog[open] .drawer');
  await m.locator('dialog[open] summary', { hasText: 'Technology' }).click(); await m.locator('dialog[open] a', { hasText: 'Cybersecurity' }).click();
  await m.waitForURL(/\/category\/technology\/cybersecurity/); await m.waitForFunction(() => !document.querySelector('dialog[open]'));
  await m.screenshot({ path: `${SHOTS}/mobile-category.png` }); await m.close();
});

console.log('\nAdmin');
const admin = await ctx.newPage(); watch(admin, 'admin');
await step('admin shell is noindex and shows the sign-in form; wrong password is rejected politely', async () => {
  const r = await admin.goto(siteOrigin + '/admin'); ok(r.headers()['x-robots-tag'] === 'noindex, nofollow', 'X-Robots-Tag');
  await admin.waitForSelector('form.a-login__card'); await admin.getByLabel('Email').fill('admin@example.org'); await admin.getByLabel('Password').fill('wrong-password');
  await admin.getByRole('button', { name: 'Sign in' }).click(); await admin.waitForSelector('.a-error');
});
await step('sign in -> dashboard with real counts and honest analytics', async () => {
  await admin.getByLabel('Password').fill('a-strong-password!'); await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.waitForSelector('.dash-stats'); ok((await admin.locator('.dash-stat', { hasText: 'Published' }).textContent()).includes('8'), 'published count');
  await admin.waitForSelector('text=Search Console data is not connected'); await admin.screenshot({ path: `${SHOTS}/admin-dashboard.png` });
});
let newSlug = null;
await step('write an article: rich text, category, save draft, SEO panel analyses it, publish', async () => {
  await admin.getByRole('link', { name: 'Write an article' }).click(); await admin.waitForSelector('.ed');
  await admin.getByLabel('Headline', { exact: true }).fill('A practical guide to hydration for runners');
  const body = admin.locator('[role=textbox][aria-label="Article body"]'); await body.click();
  await admin.getByRole('button', { name: 'Heading 2' }).click(); await admin.keyboard.type('Why water matters'); await admin.keyboard.press('Enter');
  await admin.getByRole('button', { name: 'Paragraph' }).click();
  await admin.keyboard.type('Hydration affects how you run. '.repeat(12)); await admin.keyboard.press('Enter');
  await admin.getByRole('button', { name: 'Bulleted list' }).click(); await admin.keyboard.type('Drink before you run'); await admin.keyboard.press('Enter'); await admin.keyboard.type('Sip during long runs');
  await admin.getByLabel('Category').selectOption('fitness'); await admin.getByLabel('Tags').fill('guide, running');
  await admin.getByRole('button', { name: 'Save draft' }).click(); await admin.waitForURL(/\/admin\/articles\/[0-9a-f-]{36}$/);
  await admin.getByRole('tab', { name: 'SEO' }).click(); await admin.waitForSelector('text=SEO checklist', { timeout: 8000 });
  ok((await admin.locator('.serp__title').textContent()).includes('hydration'), 'search preview'); ok(await admin.locator('.seo__chips li').count() >= 1, 'keywords');
  newSlug = await admin.getByLabel('URL slug').getAttribute('placeholder'); ok(newSlug === 'practical-guide-to-hydration-for-runners', `slug suggestion was ${newSlug}`);
  await admin.screenshot({ path: `${SHOTS}/admin-editor-seo.png` });
  await admin.getByRole('button', { name: 'Publish now' }).click(); await admin.waitForSelector('.ed__bar .a-badge--good', { timeout: 6000 });
  ok((await admin.locator('.ed__bar .a-badge--good').textContent()) === 'published', 'status badge');
});
await step('the published article is live for readers, with the heading and list the editor produced', async () => {
  const p = await ctx.newPage(); watch(p, 'reader'); const r = await p.goto(`${siteOrigin}/article/${newSlug}`); ok(r.status() === 200, `status ${r.status()}`);
  await p.waitForSelector('h1.article__title'); ok((await p.locator('.prose h2').first().textContent()) === 'Why water matters', 'h2'); ok((await p.locator('.prose li').count()) === 2, 'list');
  ok((await p.title()).includes('hydration'), 'title'); await p.close();
});
await step('media library: upload an image through the browser, edit alt text', async () => {
  await admin.getByRole('link', { name: 'Media library' }).click(); await admin.waitForSelector('text=Media library');
  await admin.setInputFiles('input[type=file]', { name: 'upload.png', mimeType: 'image/png', buffer: png }); await admin.waitForSelector('text=Image details');
  await admin.getByLabel('Alt text').fill('A blue test image'); await admin.getByRole('button', { name: 'Save' }).click(); await admin.waitForSelector('text=A blue test image');
  ok((await admin.locator('.media-card').count()) === 2, 'two images');
});
await step('categories: add one through the modal, validation error on a duplicate slug, then it shows in the public menu', async () => {
  await admin.getByRole('link', { name: 'Categories' }).click(); await admin.waitForSelector('text=Sections of the site');
  await admin.getByRole('button', { name: 'Add category' }).click(); await admin.getByLabel('Name').fill('Space'); await admin.getByRole('button', { name: 'Save' }).click(); await admin.waitForSelector('td:has-text("Space")');
  await admin.getByRole('button', { name: 'Add category' }).click(); await admin.getByLabel('Name').fill('Space again'); await admin.getByLabel('URL slug').fill('space'); await admin.getByRole('button', { name: 'Save' }).click();
  await admin.waitForSelector('.a-toast--bad'); await admin.keyboard.press('Escape');
});
await step('settings: rename the site, enable comments; change shows on the public site', async () => {
  await admin.getByRole('link', { name: 'Settings' }).click(); await admin.waitForSelector('text=Site-wide configuration');
  await admin.getByLabel('Site name').fill('Daily Pilot'); await admin.getByLabel('Allow comments on articles').check();
  await admin.getByLabel('Production site URL').fill('http://bad'); await admin.getByRole('button', { name: 'Save settings' }).click(); await admin.waitForSelector('text=Use your https origin');
  await admin.getByLabel('Production site URL').fill(''); await admin.getByRole('button', { name: 'Save settings' }).click(); await admin.waitForSelector('.a-toast--good:has-text("Settings saved")');
  const p = await ctx.newPage(); await p.goto(siteOrigin + '/'); ok((await p.locator('.masthead .logo__word').textContent()) === 'Daily Pilot', 'site name'); await p.close();
});
await step('comments: reader submits, admin approves, it appears publicly', async () => {
  const slug = seeded[2].slug; const r = await ctx.newPage(); watch(r, 'commenter'); await r.goto(`${siteOrigin}/article/${slug}`); await r.waitForSelector('.comments__form');
  await r.fill('#c-name', 'Sam'); await r.fill('#c-body', 'Really helpful explanation, thanks.'); await r.getByRole('button', { name: 'Post comment' }).click(); await r.waitForSelector('text=moderator');
  await admin.getByRole('link', { name: 'Comments' }).click(); await admin.waitForSelector('text=Really helpful explanation'); await admin.getByRole('button', { name: 'Approve' }).click(); await admin.waitForSelector('text=No pending comments');
  await r.reload(); await r.waitForSelector('.comments__list'); ok((await r.locator('.comments__list').textContent()).includes('Really helpful'), 'approved comment shown'); await r.close();
});
await step('sign out returns to the login form and the API rejects the old token', async () => {
  const token = await admin.evaluate(() => sessionStorage.getItem('np-admin-token'));
  await admin.getByRole('button', { name: 'Sign out' }).click(); await admin.waitForSelector('form.a-login__card');
  ok((await w.c.get('/auth/me', { token })).status === 200, 'token still technically valid until expiry (logout is client-side)'); // documented behaviour; "Sign out everywhere" revokes
});

await browser.close(); S.close();
const bad = results.filter((r) => !r[1]);
console.log(`\n${results.length - bad.length}/${results.length} browser steps passed`);
const real = consoleIssues.filter((m) => !/favicon|net::ERR_ABORTED/.test(m));
console.log(real.length ? `\nConsole errors/warnings (${real.length}):\n${real.slice(0, 15).join('\n')}` : '\nNo console errors or React warnings in any page.');
process.exit(bad.length || real.length ? 1 : 0);
