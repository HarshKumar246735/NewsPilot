// Frontend <-> API integration. The real API code (routes, services, sanitiser, SEO engine) runs in-process behind a
// stubbed fetch, and the real frontend server renderer talks to it exactly as it will in production. Not covered here:
// real Express, MongoDB/Mongoose, and real HTTP (see README "Verification").
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

globalThis.__ALLOW_DEMO__ = true;
register('./harness/loader.mjs', import.meta.url);
const { render } = await import('../src/entry-server.jsx');
const { respond } = await import('../ssr-handler.js');
const { subscribeNewsletter, fetchComments, postComment } = await import('../src/services/apiSource.js');
const { boot } = await import('../../server/test/helpers/boot.js');

const API = 'http://api.test';
const config = { demo: false, siteUrl: 'https://news.example.org', apiUrl: API };

async function world() {
  const w = await boot();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.origin !== API) throw new Error(`unexpected network call ${url}`);
    const r = await w.c[(init.method || 'GET').toLowerCase()](u.pathname + u.search, { body: init.body, headers: init.headers });
    return { ok: r.status < 400, status: r.status, json: async () => JSON.parse(r.text), text: async () => r.text, headers: new Map(Object.entries(r.headers)) };
  };
  w.restore = () => { globalThis.fetch = realFetch; };
  w.page = async (url, cfg = config) => {
    const errs = []; const o = console.error; console.error = (...a) => errs.push(a.join(' '));
    try { const r = await render(url, cfg); if (r.html) r.html = r.html.replace(/<!-- -->/g, ''); return { ...r, errs }; } finally { console.error = o; } // React separates adjacent text nodes with <!-- -->
  };
  return w;
}
const body = (n) => `<h2>First section</h2><p>${'This paragraph explains the topic in plain language. '.repeat(8)}</p><p>${'More detail follows here for the reader. '.repeat(6)}</p><ul><li>One point</li><li>Another point</li></ul><h2>Second section</h2><p>${'A closing thought that wraps up the piece. '.repeat(6)}</p><p>Paragraph four.</p><p>Paragraph five ${n}.</p><p>Paragraph six.</p>`;

test('an empty newsroom renders honest empty states and a minimal sitemap, never an error', async () => {
  const w = await world();
  try {
    const home = await w.page('/');
    assert.equal(home.status, 200); assert.match(home.html, /No stories published yet/); assert.deepEqual(home.errs, []);
    assert.equal((await w.page('/latest')).status, 200);
    const sm = (await w.page('/sitemap.xml')).body;
    assert.ok(!sm.includes('/article/')); assert.match(sm, /<loc>https:\/\/news\.example\.org\/<\/loc>/);
    assert.match((await w.page('/robots.txt')).body, /Allow: \/[\s\S]*Disallow: \/admin[\s\S]*Sitemap: https:\/\/news\.example\.org\/sitemap\.xml/);
    assert.equal((await w.page('/ads.txt')).status, 404);
  } finally { w.restore(); }
});

test('publish through the admin API, then the crawler-visible HTML is complete and correct', async () => {
  const w = await world();
  try {
    const a = (await w.mk({ title: 'How coastal wetlands protect cities', dek: 'Marshes slow water and absorb energy.', contentHtml: body(1) + '<script>alert(1)</script>', categorySlug: 'artificial-intelligence', tags: ['guide', 'coast'], image: { url: 'https://res.cloudinary.com/demo/image/upload/v1/wet.jpg', alt: 'A marsh at dusk', width: 1600, height: 1000, caption: 'Marsh', credit: 'Photographer' } })).body.item;
    assert.equal((await w.page(`/article/${a.slug}`)).status, 404); // draft
    await w.publish(a.id);
    const r = await w.page(`/article/${a.slug}`);
    assert.equal(r.status, 200); assert.deepEqual(r.errs, []);
    assert.match(r.html, /<h1[^>]*>How coastal wetlands protect cities<\/h1>/);
    assert.match(r.html, /This paragraph explains the topic in plain language/); // body text is in the initial HTML
    assert.match(r.html, /<h2 id="first-section">First section/); assert.ok(!r.html.includes('alert(1)')); assert.ok(!/<script/i.test(r.html));
    assert.match(r.html, /<a href="\/category\/technology\/artificial-intelligence">Artificial Intelligence<\/a>/);
    assert.match(r.html, /By <a href="\/author\/ada-admin">Ada Admin<\/a>/);
    assert.match(r.html, /srcSet="[^"]*f_auto,q_auto,c_limit,w_480[^"]*"/); // Cloudinary transforms applied
    assert.match(r.html, /Credit: Photographer/);
    assert.match(r.headHtml, new RegExp(`<link rel="canonical" href="https://news\\.example\\.org/article/${a.slug}"`));
    assert.match(r.headHtml, /name="robots" content="index, follow, max-image-preview:large"/);
    assert.match(r.headHtml, /<link rel="preload" as="image" fetchpriority="high" href="https:\/\/res\.cloudinary\.com[^"]*w_1152/);
    const ld = [...r.headHtml.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    assert.deepEqual(ld.map((x) => x['@type']), ['Article', 'BreadcrumbList']);
    assert.equal(ld[0].author.name, 'Ada Admin'); assert.equal(ld[0].articleSection, 'Artificial Intelligence'); assert.equal(ld[0].mainEntityOfPage['@id'], `https://news.example.org/article/${a.slug}`);
    assert.deepEqual(ld[1].itemListElement.map((i) => i.name), ['Home', 'Technology', 'Artificial Intelligence', 'How coastal wetlands protect cities']);
    assert.match(r.headHtml, /<title>How coastal wetlands protect cities \| NewsPilot<\/title>/); // generated SEO title
    // admin override wins everywhere
    await w.c.put(`/admin/articles/${a.id}`, { token: w.adminToken, body: { seoTitle: 'Custom SEO title', metaDescription: 'Custom description for search.' } });
    const r2 = await w.page(`/article/${a.slug}`);
    assert.match(r2.headHtml, /<title>Custom SEO title<\/title>/); assert.match(r2.headHtml, /name="description" content="Custom description for search\."/);
    // in-article ad slot, comment form and consent banner stay out of the HTML when not configured
    assert.ok(!/adsbygoogle|googlesyndication|googletagmanager/.test(r.html + r.headHtml));
    assert.ok(!r.html.includes('class="comments"'));
    // 404 + unpublish
    assert.equal((await w.page('/article/never-existed')).status, 404);
    await w.c.post(`/admin/articles/${a.id}/unpublish`, { token: w.adminToken });
    const gone = await w.page(`/article/${a.slug}`); assert.equal(gone.status, 404); assert.match(gone.headHtml, /noindex/);
  } finally { w.restore(); }
});

test('home, categories, authors, search, pagination and sitemap are driven by published API content', async () => {
  const w = await world();
  try {
    const slugs = [];
    for (let i = 0; i < 14; i++) slugs.push((await w.mkPub({ title: `Wetland story ${i}`, contentHtml: body(i), categorySlug: i % 2 ? 'cricket' : 'world', isFeatured: i === 5 })).slug);
    const home = await w.page('/');
    assert.equal(home.status, 200); assert.deepEqual(home.errs, []);
    assert.match(home.html, /<h2 class="hero__title"><a href="\/article\/wetland-story-5"/);
    assert.match(home.html, /class="cat-section container"/);
    assert.ok(!/Trending now|Most read/.test(home.html), 'no views recorded, so no fabricated trending lists');
    assert.equal((await w.page('/category/sports/cricket')).status, 200);
    assert.equal((await w.page('/category/cricket')).redirect, '/category/sports/cricket');
    const cat = await w.page('/category/world'); assert.match(cat.html, /Wetland story/); assert.equal((await w.page('/category/nope')).status, 404);
    assert.equal((await w.page('/author/ada-admin')).status, 200); assert.equal((await w.page('/author/ghost')).status, 404);
    const p2 = await w.page('/latest?page=2');
    assert.equal(p2.status, 200); assert.match(p2.headHtml, /<link rel="canonical" href="https:\/\/news\.example\.org\/latest\?page=2"/); assert.match(p2.headHtml, /rel="prev" href="https:\/\/news\.example\.org\/latest"/);
    assert.equal((await w.page('/latest?page=3')).status, 404); assert.equal((await w.page('/latest?page=1')).redirect, '/latest');
    const s = await w.page('/search?q=wetland'); assert.match(s.html, /14 articles found/); assert.match(s.headHtml, /noindex, follow/);
    const sm = (await w.page('/sitemap.xml')).body;
    for (const slug of slugs) assert.ok(sm.includes(`/article/${slug}</loc>`), slug);
    assert.ok(sm.includes('/category/sports/cricket') && sm.includes('/category/sports</loc>') && sm.includes('/author/ada-admin'));
    assert.ok(!/\/admin|\/search|\/api/.test(sm));
    // view beacons feed Trending and Most read, and only then do the sections appear
    for (let i = 0; i < 3; i++) await fetch(`${API}/public/articles/${slugs[2]}/view`, { method: 'POST' });
    assert.match((await w.page('/')).html, /Trending now/);
    assert.match((await w.page('/trending')).html, /Wetland story 2/);
  } finally { w.restore(); }
});

test('changed slugs and manual redirects become real 301s at the frontend', async () => {
  const w = await world();
  try {
    const a = await w.mkPub({ title: 'Old headline here', contentHtml: body(1) });
    await w.c.put(`/admin/articles/${a.id}`, { token: w.adminToken, body: { slug: 'new-headline-here' } });
    const r = await w.page(`/article/${a.slug}`);
    assert.deepEqual([r.status, r.redirect], [301, '/article/new-headline-here']);
    assert.equal((await w.page('/article/new-headline-here')).status, 200);
    await w.c.post('/admin/redirects', { token: w.adminToken, body: { from: '/old-section/page', to: '/category/world' } });
    assert.deepEqual([(await w.page('/old-section/page')).status, (await w.page('/old-section/page')).redirect], [301, '/category/world']);
    const out = await respond('/article/' + a.slug, { template: '<!--head-outlet--><!--app-html--><!--state-outlet-->', render: (u, c) => render(u, c), config });
    assert.equal(out.status, 301); assert.equal(out.headers.Location, '/article/new-headline-here');
  } finally { w.restore(); }
});

test('ads, consent and disclosures: nothing third-party renders without consent; sponsored/affiliate content is labelled', async () => {
  const w = await world();
  try {
    const a = await w.mkPub({ title: 'Sponsored feature', contentHtml: body(1), sponsoredBy: 'Acme Co', hasAffiliateLinks: true });
    await w.c.put('/admin/settings', { token: w.adminToken, body: { ads: { enabled: true, adsenseClient: 'ca-pub-123456' }, analytics: { ga4Id: 'G-TEST123' }, comments: { enabled: true } } });
    await w.c.post('/admin/ads', { token: w.adminToken, body: { name: 'Sidebar', placement: 'article-sidebar', type: 'adsense', slot: '999', enabled: true } });
    await w.c.post('/admin/ads', { token: w.adminToken, body: { name: 'Acme', placement: 'article-end', type: 'banner', imageUrl: 'https://cdn.example/acme.png', linkUrl: 'https://acme.example/?utm=x', enabled: true } });
    const r = await w.page(`/article/${a.slug}`); assert.deepEqual(r.errs, []);
    assert.ok(!/adsbygoogle|googlesyndication|googletagmanager|G-TEST123/.test(r.html + r.headHtml), 'AdSense/GA must not appear before consent');
    assert.match(r.html, /<a href="https:\/\/acme\.example\/\?utm=x" target="_blank" rel="sponsored noopener noreferrer">/);
    assert.match(r.html, /Sponsored: Acme/); assert.match(r.html, /<strong>Sponsored content<\/strong> by Acme Co/); assert.match(r.html, /contains affiliate links/);
    assert.match(r.html, /<section class="comments"/); // comments enabled globally and on the article -> the form is present
    assert.match(r.html, /<section class="consent"[^>]*>[\s\S]*Accept/); // advertising + analytics configured -> the choice is offered, nothing loads yet
  } finally { w.restore(); }
});

test('admin shell: client-only, never indexed, never cached', async () => {
  const w = await world();
  try {
    const r = await w.page('/admin/articles');
    assert.equal(r.status, 200); assert.match(r.headHtml, /name="robots" content="noindex, nofollow"/); assert.ok(!/rel="canonical"/.test(r.headHtml));
    assert.match(r.html, /Loading/);
    const out = await respond('/admin/articles', { template: '<!--head-outlet--><!--app-html--><!--state-outlet-->', render, config });
    assert.equal(out.headers['X-Robots-Tag'], 'noindex, nofollow'); assert.equal(out.headers['Cache-Control'], 'no-store');
    assert.equal((await w.page('/admin/')).redirect, '/admin');
  } finally { w.restore(); }
});

test('forms talk to the real API: newsletter, comments, and failures are reported honestly', async () => {
  const w = await world();
  try {
    const ok = await subscribeNewsletter(config, { email: 'reader@example.org', consent: true });
    assert.match(ok.message, /subscribed/);
    await assert.rejects(subscribeNewsletter(config, { email: 'bad', consent: true }), /valid email/i);
    await assert.rejects(subscribeNewsletter(config, { email: 'x@example.org', consent: false }), /consent/i);
    await assert.rejects(subscribeNewsletter({ ...config, apiUrl: '' }, { email: 'x@example.org', consent: true }), /not connected/);
    const a = await w.mkPub({ title: 'Discuss me', contentHtml: body(1) });
    await w.c.put('/admin/settings', { token: w.adminToken, body: { comments: { enabled: true } } });
    const posted = await postComment(config, a.slug, { name: 'Sam', body: 'A thoughtful note.' });
    assert.match(posted.message, /moderator/);
    assert.deepEqual(await fetchComments(config, a.slug), []);
    const [c] = await w.store.col('comments').find({}); await w.c.put(`/admin/comments/${c.id}`, { token: w.adminToken, body: { status: 'approved' } });
    assert.equal((await fetchComments(config, a.slug))[0].name, 'Sam');
    assert.match((await w.page(`/article/${a.slug}`)).html, /<section class="comments"/);
  } finally { w.restore(); }
});

test('when the API is unreachable the site returns a 500 error page, not stale or fake content', async () => {
  const w = await world();
  try {
    globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
    const out = await respond('/', { template: '<!--head-outlet--><!--app-html--><!--state-outlet-->', render, config });
    assert.equal(out.status, 503); assert.equal(out.headers['Cache-Control'], 'no-store'); assert.equal(out.headers['Retry-After'], '60');
    assert.match(out.body, /temporarily unavailable/); assert.match(out.body, /name="robots" content="noindex"/);
    assert.ok(!/hero|Trending/.test(out.body));
  } finally { w.restore(); }
});
