import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { boot, ADMIN } from './helpers/boot.js';
import { loadConfig } from '../src/config/env.js';
import { signUpload } from '../src/services/cloudinary.js';
import { sha1 } from '../src/lib/crypto.js';

const png = (w, h) => { const b = Buffer.alloc(40); b.writeUInt32BE(0x89504e47, 0); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };

test('health check, JSON 404, security headers and CORS allow-list', async () => {
  const { c } = await boot();
  const h = await c.get('/health'); assert.equal(h.status, 200); assert.equal(h.body.status, 'ok');
  const nf = await c.get('/nope'); assert.equal(nf.status, 404); assert.ok(nf.body.error.message);
  assert.equal(h.headers['x-content-type-options'], 'nosniff'); assert.equal(h.headers['x-frame-options'], 'DENY');
  const ok = await c.get('/public/shell', { headers: { origin: 'https://news.example.org' } });
  assert.equal(ok.headers['access-control-allow-origin'], 'https://news.example.org');
  const bad = await c.get('/public/shell', { headers: { origin: 'https://evil.example' } });
  assert.equal(bad.headers['access-control-allow-origin'], undefined);
  assert.equal((await c.options('/admin/articles', { headers: { origin: 'https://news.example.org' } })).status, 204);
  assert.equal((await c.options('/admin/articles', { headers: { origin: 'https://evil.example' } })).status, 403);
});

test('auth: login, generic failures, protected routes, token tampering, lockout, sign-out-everywhere, password change', async () => {
  const { c, login, adminToken } = await boot();
  assert.equal((await c.get('/admin/dashboard')).status, 401);
  assert.equal((await c.get('/admin/dashboard', { token: 'garbage' })).status, 401);
  assert.equal((await c.get('/admin/dashboard', { token: adminToken.slice(0, -2) + 'xx' })).status, 401);
  const me = await c.get('/auth/me', { token: adminToken }); assert.equal(me.body.user.role, 'admin');
  const wrong = await c.post('/auth/login', { body: { email: ADMIN.email, password: 'nope' } });
  const ghost = await c.post('/auth/login', { body: { email: 'ghost@example.org', password: 'nope' } });
  assert.equal(wrong.status, 401); assert.equal(wrong.body.error.message, ghost.body.error.message); // no account enumeration
  assert.ok(!JSON.stringify(wrong.body).includes('passwordHash'));
  // change password: old token dies, new one works
  const ch = await c.post('/auth/change-password', { token: adminToken, body: { currentPassword: ADMIN.password, newPassword: 'a-brand-new-password' } });
  assert.equal(ch.status, 200);
  assert.equal((await c.get('/auth/me', { token: adminToken })).status, 401);
  assert.equal((await c.get('/auth/me', { token: ch.body.token })).status, 200);
  assert.equal((await c.post('/auth/change-password', { token: ch.body.token, body: { currentPassword: 'wrong', newPassword: 'another-new-password' } })).status, 403);
  assert.equal((await c.post('/auth/change-password', { token: ch.body.token, body: { currentPassword: 'a-brand-new-password', newPassword: 'short' } })).status, 422);
  const t2 = await login(ADMIN.email, 'a-brand-new-password');
  await c.post('/auth/logout-all', { token: t2 });
  assert.equal((await c.get('/auth/me', { token: t2 })).status, 401);
});

test('auth: repeated failures are rate-limited per account', async () => {
  const { c } = await boot();
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await c.post('/auth/login', { body: { email: 'victim@example.org', password: `bad${i}` } })).status);
  assert.deepEqual(codes.slice(0, 6), Array(6).fill(401)); assert.equal(codes[6], 429); assert.equal(codes[7], 429);
  assert.equal((await c.post('/auth/login', { body: { email: 'victim@example.org', password: 'whatever-else' } })).status, 429);
  assert.equal((await c.post('/auth/login', { body: { email: ADMIN.email, password: ADMIN.password } })).status, 200); // other accounts are unaffected
});

test('input hardening: NoSQL operators, malformed JSON, oversized bodies, unknown fields', async () => {
  const { c, adminToken } = await boot();
  assert.equal((await c.post('/auth/login', { body: { email: { $gt: '' }, password: { $gt: '' } } })).status, 400);
  assert.equal((await c.get('/public/search?q[$ne]=x')).status, 400);
  assert.equal((await c.post('/auth/login', { body: '{bad json', headers: { 'content-type': 'application/json' } })).status, 400);
  assert.equal((await c.post('/admin/articles', { token: adminToken, body: { title: 'x', contentHtml: 'y'.repeat(1_100_000) } })).status, 413);
  const r = await c.post('/admin/articles', { token: adminToken, body: { title: 'Mass assignment', role: 'admin', status: 'published', views: 99999, createdBy: 'someone' } });
  assert.equal(r.status, 201); assert.equal(r.body.item.status, 'draft'); assert.equal(r.body.item.views, 0); assert.notEqual(r.body.item.createdBy, 'someone');
});

test('roles: admin > editor > author are enforced on the server', async () => {
  const { c, mkUser, adminToken } = await boot();
  const editor = await mkUser('editor'), author = await mkUser('author');
  assert.ok(editor && author);
  for (const [tok, path, want] of [[author, '/admin/users', 403], [editor, '/admin/users', 403], [adminToken, '/admin/users', 200], [editor, '/admin/settings', 403], [adminToken, '/admin/settings', 200],
    [author, '/admin/categories', 200], [author, '/admin/media', 200], [author, '/admin/comments', 403], [editor, '/admin/comments', 200], [editor, '/admin/audit', 403], [adminToken, '/admin/audit', 200], [editor, '/admin/subscribers', 403], [editor, '/admin/ads', 200]]) {
    assert.equal((await c.get(path, { token: tok })).status, want, `${path} as ${tok === author ? 'author' : tok === editor ? 'editor' : 'admin'}`);
  }
  assert.equal((await c.post('/admin/categories', { token: author, body: { name: 'Nope' } })).status, 403);
  assert.equal((await c.post('/admin/ads', { token: editor, body: { name: 'a', placement: 'footer', type: 'adsense', slot: '123' } })).status, 403);
  const users = (await c.get('/admin/users', { token: adminToken })).body.items;
  assert.ok(users.every((u) => !('passwordHash' in u)));
  // an admin cannot lock themselves out
  const me = users.find((u) => u.email === ADMIN.email);
  assert.equal((await c.put(`/admin/users/${me.id}`, { token: adminToken, body: { role: 'editor' } })).status, 422);
  assert.equal((await c.delete(`/admin/users/${me.id}`, { token: adminToken })).status, 422);
  // deactivating a user kills their session immediately
  const ed = users.find((u) => u.email === 'editor@example.org');
  await c.put(`/admin/users/${ed.id}`, { token: adminToken, body: { active: false } });
  assert.equal((await c.get('/auth/me', { token: editor })).status, 401);
});

test('article lifecycle: draft -> publish -> public, with sanitising, auto slug, auto excerpt, manual SEO preserved', async () => {
  const { c, mk, publish, adminToken } = await boot();
  const r = await mk({ title: 'Best Programming Languages for Beginners in 2026', contentHtml: '<p>Learning to code starts with a good first language and a clear goal.</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">bad</a>' });
  assert.equal(r.status, 201);
  const a = r.body.item;
  assert.equal(a.slug, 'best-programming-languages-for-beginners-2026'); assert.equal(a.status, 'draft');
  assert.ok(!/script|onerror|javascript:/i.test(a.contentHtml)); assert.ok(a.excerpt.length > 10); assert.ok(a.readingMinutes >= 1);
  assert.equal((await c.get(`/public/articles/${a.slug}`)).status, 404); // drafts are invisible
  assert.equal((await c.get('/public/latest')).body.total, 0);
  // publish
  const p = await publish(a.id); assert.equal(p.status, 200); assert.equal(p.body.article.status, 'published');
  const pubA = await c.get(`/public/articles/${a.slug}`);
  assert.equal(pubA.status, 200); assert.equal(pubA.body.article.category.name, 'Technology'); assert.equal(pubA.body.article.author.name, 'Ada Admin');
  assert.equal(pubA.body.article.seoTitle, undefined); // generated by the SEO engine at render time unless overridden
  // manual SEO values are stored and served untouched
  await c.put(`/admin/articles/${a.id}`, { token: adminToken, body: { seoTitle: 'My custom title', metaDescription: 'My custom description.', canonicalUrl: 'https://news.example.org/article/custom' } });
  const again = (await c.get(`/public/articles/${a.slug}`)).body.article;
  assert.deepEqual([again.seoTitle, again.metaDescription, again.canonicalUrl], ['My custom title', 'My custom description.', 'https://news.example.org/article/custom']);
  // edits keep the URL, bump updatedAt only
  assert.equal(again.slug, a.slug);
  // unpublish hides it
  await c.post(`/admin/articles/${a.id}/unpublish`, { token: adminToken });
  assert.equal((await c.get(`/public/articles/${a.slug}`)).status, 404);
});

test('publishing requires the essentials and reports SEO warnings without inventing problems', async () => {
  const { c, mk, publish, adminToken } = await boot();
  const bare = (await c.post('/admin/articles', { token: adminToken, body: { title: 'Only a headline' } })).body.item;
  const fail = await publish(bare.id);
  assert.equal(fail.status, 422); assert.ok(fail.body.error.details.fields.contentHtml && fail.body.error.details.fields.categorySlug);
  const a = (await mk({ title: 'Short piece' })).body.item;
  const ok = await publish(a.id);
  assert.equal(ok.status, 200);
  const labels = ok.body.warnings.map((w) => w.label);
  assert.ok(labels.some((l) => /Featured image/i.test(l))); // no image -> a real, specific warning
  assert.ok(!labels.some((l) => /slug/i.test(l)));
});

test('slugs: unique, reserved words rejected, and changing a published URL creates a working 301 (chains collapse)', async () => {
  const { c, mk, publish, adminToken } = await boot();
  const a = (await mk({ title: 'Same Headline' })).body.item, b = (await mk({ title: 'Same Headline' })).body.item;
  assert.equal(a.slug, 'same-headline'); assert.equal(b.slug, 'same-headline-2');
  assert.equal((await mk({ title: 'x', slug: 'same-headline' })).status, 409);
  assert.equal((await mk({ title: 'x', slug: 'admin' })).status, 422);
  assert.equal((await mk({ title: 'x', slug: 'Bad Slug!' })).status, 422);
  await publish(a.id);
  await c.put(`/admin/articles/${a.id}`, { token: adminToken, body: { slug: 'renamed-once' } });
  assert.equal((await c.get('/public/articles/same-headline')).body.redirect, '/article/renamed-once');
  assert.equal((await c.get('/public/articles/renamed-once')).status, 200);
  await c.put(`/admin/articles/${a.id}`, { token: adminToken, body: { slug: 'renamed-twice' } });
  assert.equal((await c.get('/public/articles/same-headline')).body.redirect, '/article/renamed-twice'); // collapsed, not a chain
  assert.equal((await c.get('/public/articles/renamed-once')).body.redirect, '/article/renamed-twice');
  await c.put(`/admin/articles/${a.id}`, { token: adminToken, body: { slug: 'same-headline' } }); // renaming back must not loop
  assert.equal((await c.get('/public/articles/same-headline')).status, 200);
  assert.equal((await c.get('/public/articles/renamed-twice')).body.redirect, '/article/same-headline');
});

test('scheduling: future posts stay private, go live when due (even on a lazy public read), past dates are rejected', async () => {
  const { c, mk, publish, adminToken, t } = await boot();
  const a = (await mk({ title: 'Scheduled piece' })).body.item;
  assert.equal((await c.post(`/admin/articles/${a.id}/schedule`, { token: adminToken, body: { publishedAt: '2026-10-01T00:00:00Z' } })).status, 422);
  assert.equal((await c.post(`/admin/articles/${a.id}/schedule`, { token: adminToken, body: {} })).status, 422);
  const when = new Date(t.now + 2 * 3600e3).toISOString();
  const s = await c.post(`/admin/articles/${a.id}/schedule`, { token: adminToken, body: { publishedAt: when } });
  assert.equal(s.body.article.status, 'scheduled');
  assert.equal((await c.get(`/public/articles/${a.slug}`)).status, 404);
  assert.ok(!(await c.get('/public/sitemap-entries')).body.entries.some((e) => e.path.includes(a.slug)));
  t.now += 3 * 3600e3;
  assert.equal((await c.get(`/public/articles/${a.slug}`)).status, 200); // no timer needed
  assert.equal((await c.get(`/admin/articles/${a.id}`, { token: adminToken })).body.item.status, 'published');
  void publish;
});

test('trash, restore, archive and permanent delete rules', async () => {
  const { c, mkPub, adminToken } = await boot();
  const a = await mkPub({ title: 'To be removed' });
  assert.equal((await c.delete(`/admin/articles/${a.id}`, { token: adminToken })).status, 409); // not in trash yet
  await c.post(`/admin/articles/${a.id}/trash`, { token: adminToken });
  assert.equal((await c.get(`/public/articles/${a.slug}`)).status, 404);
  assert.equal((await c.get('/admin/articles', { token: adminToken })).body.total, 0); // hidden from the default list
  assert.equal((await c.get('/admin/articles?status=trashed', { token: adminToken })).body.total, 1);
  await c.post(`/admin/articles/${a.id}/restore`, { token: adminToken });
  assert.equal((await c.get(`/admin/articles/${a.id}`, { token: adminToken })).body.item.status, 'draft');
  await c.post(`/admin/articles/${a.id}/trash`, { token: adminToken });
  assert.equal((await c.delete(`/admin/articles/${a.id}`, { token: adminToken })).status, 204);
  assert.equal((await c.get(`/admin/articles/${a.id}`, { token: adminToken })).status, 404);
  const b = await mkPub({ title: 'To archive' });
  await c.post(`/admin/articles/${b.id}/archive`, { token: adminToken });
  assert.equal((await c.get(`/public/articles/${b.slug}`)).status, 404);
});

test('author role: own drafts only, cannot publish, cannot flag breaking, cannot see others', async () => {
  const { c, mkUser, mk, adminToken } = await boot();
  const author = await mkUser('author');
  const mine = (await c.post('/admin/articles', { token: author, body: { title: 'Author draft', isBreaking: true, isFeatured: true } })).body.item;
  assert.equal(mine.isBreaking, false); assert.equal(mine.isFeatured, false);
  assert.equal((await c.post(`/admin/articles/${mine.id}/publish`, { token: author })).status, 403);
  assert.equal((await c.post(`/admin/articles/${mine.id}/review`, { token: author })).body.article.status, 'review');
  assert.equal((await c.put(`/admin/articles/${mine.id}`, { token: author, body: { title: 'Edit after review' } })).status, 403);
  const other = (await mk({ title: 'Admin article' })).body.item;
  assert.equal((await c.get(`/admin/articles/${other.id}`, { token: author })).status, 404);
  assert.equal((await c.put(`/admin/articles/${other.id}`, { token: author, body: { title: 'hijack' } })).status, 403);
  assert.equal((await c.get('/admin/articles', { token: author })).body.items.length, 1);
  assert.equal((await c.post(`/admin/articles/${mine.id}/publish`, { token: adminToken, body: {} })).status, 422); // editor must assign author first
});

test('public API: shell, home without repeats, categories roll up children, authors, search, pagination, 404s', async () => {
  const { c, mkPub, adminToken } = await boot();
  const slugs = [];
  const cats = ['technology', 'artificial-intelligence', 'cricket', 'world', 'india', 'business', 'health', 'science'];
  for (let i = 0; i < 16; i++) { const a = await mkPub({ title: `Story number ${i} about ${cats[i % 8]}`, categorySlug: cats[i % 8], isFeatured: i === 3, tags: i % 5 === 0 ? ['guide'] : [] }); slugs.push(a.slug); }
  const shell = (await c.get('/public/shell')).body;
  assert.equal(shell.site.name, 'NewsPilot'); assert.equal(shell.site.url, 'https://news.example.org'); assert.ok(shell.categories.length >= 30); assert.deepEqual(shell.breaking, []);
  const home = (await c.get('/public/home')).body;
  assert.equal(home.hero.main.slug, slugs[3]); // featured story leads
  const heroSlugs = [home.hero.main, ...home.hero.secondary, ...home.hero.latest].map((a) => a.slug);
  assert.equal(new Set(heroSlugs).size, heroSlugs.length);
  assert.ok(home.latest.every((a) => !heroSlugs.includes(a.slug)), 'latest grid repeats a hero story');
  assert.deepEqual(home.trending, []); assert.deepEqual(home.mostRead, []); // no views recorded: nothing fabricated
  assert.ok(home.sections.length >= 3); assert.ok(home.guides.length >= 1);
  assert.ok(!('contentHtml' in home.hero.main)); // list views never carry the body
  const tech = (await c.get('/public/categories/technology')).body; // includes the child category's stories
  assert.equal(tech.total, 4); assert.equal(tech.totalPages, 1);
  assert.equal((await c.get('/public/categories/artificial-intelligence')).body.total, 2);
  assert.equal((await c.get('/public/categories/nope')).status, 404);
  const latest2 = (await c.get('/public/latest?page=2')).body; assert.equal(latest2.items.length, 4); assert.equal(latest2.totalPages, 2);
  assert.equal((await c.get('/public/latest?page=abc')).body.page, 1);
  assert.equal((await c.get('/public/authors/ada-admin')).body.total, 16); assert.equal((await c.get('/public/authors/nobody')).status, 404);
  const s = (await c.get('/public/search?q=cricket')).body; assert.equal(s.total, 2);
  assert.equal((await c.get('/public/search?q=(.*')).status, 200); // regex metacharacters are escaped, not executed
  assert.equal((await c.get('/public/search?q=zzzzqqq')).body.total, 0);
  assert.equal((await c.get('/public/search')).status, 400);
  // breaking news comes from flagged published articles and respects expiry
  const b = await mkPub({ title: 'Breaking flagged', isBreaking: true });
  assert.equal((await c.get('/public/shell')).body.breaking[0].slug, b.slug);
  await c.put(`/admin/articles/${b.id}`, { token: adminToken, body: { breakingUntil: '2026-10-11T09:00:00Z' } });
  assert.deepEqual((await c.get('/public/shell')).body.breaking, []);
});

test('trending and most-read come only from recorded views', async () => {
  const { c, mkPub } = await boot();
  const a = await mkPub({ title: 'Popular one' }), b = await mkPub({ title: 'Quiet one' });
  for (let i = 0; i < 3; i++) assert.equal((await c.post(`/public/articles/${a.slug}/view`)).status, 204);
  await c.post(`/public/articles/${b.slug}/view`);
  const home = (await c.get('/public/home')).body;
  assert.equal(home.trending[0].slug, a.slug); assert.equal((await c.get('/public/trending')).body.items[0].slug, a.slug);
  assert.equal((await c.post('/public/articles/does-not-exist/view')).status, 204); // no error oracle, no counter
});

test('sitemap entries include only indexable public URLs', async () => {
  const { c, mk, mkPub } = await boot();
  const live = await mkPub({ title: 'Live story', categorySlug: 'cricket' });
  const draft = (await mk({ title: 'Secret draft' })).body.item;
  const paths = (await c.get('/public/sitemap-entries')).body.entries.map((e) => e.path);
  assert.ok(paths.includes(`/article/${live.slug}`)); assert.ok(!paths.some((p) => p.includes(draft.slug)));
  assert.ok(paths.includes('/category/sports/cricket') && paths.includes('/category/sports')); // parent included because a child has content
  assert.ok(!paths.includes('/category/world')); // empty sections are not advertised
  assert.ok(!paths.some((p) => /^\/(admin|search|api)(\/|$)/.test(p)));
});

test('categories: CRUD, duplicate slugs, depth limit, deletion safety', async () => {
  const { c, adminToken, mkPub } = await boot();
  const mkc = (b) => c.post('/admin/categories', { token: adminToken, body: b });
  const r = await mkc({ name: 'Space Travel', description: 'Rockets' });
  assert.equal(r.status, 201); assert.equal(r.body.item.slug, 'space-travel');
  assert.equal((await mkc({ name: 'Another', slug: 'space-travel' })).status, 409);
  assert.equal((await mkc({ name: 'Child', parentSlug: 'space-travel' })).status, 201);
  assert.equal((await mkc({ name: 'Grandchild', parentSlug: 'child' })).status, 422); // two levels only
  assert.equal((await mkc({ name: 'Orphan', parentSlug: 'missing' })).status, 422);
  assert.equal((await c.delete(`/admin/categories/${r.body.item.id}`, { token: adminToken })).status, 409); // has a child
  await mkPub({ title: 'In technology' });
  const tech = (await c.get('/admin/categories', { token: adminToken })).body.items.find((x) => x.slug === 'technology');
  assert.equal((await c.delete(`/admin/categories/${tech.id}`, { token: adminToken })).status, 409);
  await c.put(`/admin/categories/${r.body.item.id}`, { token: adminToken, body: { enabled: false } });
  assert.ok(!(await c.get('/public/shell')).body.categories.some((x) => x.slug === 'space-travel'));
  assert.equal((await c.get('/public/categories/space-travel')).status, 404);
});

test('media: local upload reads real dimensions, rejects non-images and oversize, protects used images', async () => {
  const { c, adminToken, mk, config, uploadDir } = await boot();
  const up = (data, extra = {}) => c.post('/admin/media/local', { token: adminToken, body: { data: data.toString('base64'), originalName: 'photo.png', alt: 'A test', ...extra } });
  const ok = await up(png(640, 480));
  assert.equal(ok.status, 201); assert.deepEqual([ok.body.item.width, ok.body.item.height, ok.body.item.format], [640, 480, 'png']);
  assert.match(ok.body.item.url, /^\/uploads\/[\w-]+\.png$/); assert.ok(fs.existsSync(path.join(uploadDir, path.basename(ok.body.item.url))));
  assert.ok(!ok.body.item.url.includes('photo')); // never trust the client's filename
  assert.equal((await up(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'.padEnd(60)))).status, 415);
  assert.equal((await up(Buffer.from('MZ'.padEnd(60)))).status, 415);
  const big = Buffer.concat([png(10, 10), Buffer.alloc(config.maxImageBytes)]);
  assert.equal((await up(big)).status, 413);
  assert.equal((await c.post('/admin/media/local', { token: 'bad', body: { data: 'x' } })).status, 401);
  // used images cannot be deleted
  await mk({ title: 'With image', image: { url: ok.body.item.url, alt: 'A test' } });
  assert.equal((await c.delete(`/admin/media/${ok.body.item.id}`, { token: adminToken })).status, 409);
  const free = await up(png(10, 10)); assert.equal((await c.delete(`/admin/media/${free.body.item.id}`, { token: adminToken })).status, 204);
  assert.equal((await c.put(`/admin/media/${ok.body.item.id}`, { token: adminToken, body: { alt: 'Updated alt', caption: 'Cap', credit: 'Me' } })).body.item.alt, 'Updated alt');
  assert.equal((await c.get('/admin/media?q=updated', { token: adminToken })).body.items.length, 1);
});

test('media: Cloudinary signing is correct, secret never leaves the API, only your Cloudinary URLs register', async () => {
  const off = await boot();
  assert.equal((await off.c.post('/admin/media/sign', { token: off.adminToken })).status, 503);
  const env = { CLOUDINARY_CLOUD_NAME: 'democloud', CLOUDINARY_API_KEY: '12345', CLOUDINARY_API_SECRET: 'topsecret' };
  const { c, adminToken, config } = await boot({ env });
  const s = await c.post('/admin/media/sign', { token: adminToken });
  assert.equal(s.status, 200); assert.ok(!JSON.stringify(s.body).includes('topsecret'));
  const { params, signature } = s.body;
  const expected = sha1(`allowed_formats=${params.allowed_formats}&folder=${params.folder}&timestamp=${params.timestamp}topsecret`);
  assert.equal(signature, expected);
  assert.equal(signUpload(config, { now: 1_700_000_000_000 }).params.timestamp, 1_700_000_000);
  const reg = (url) => c.post('/admin/media', { token: adminToken, body: { url, width: 800, height: 600, bytes: 1000, format: 'jpg', alt: 'x' } });
  assert.equal((await reg('https://res.cloudinary.com/democloud/image/upload/v1/a.jpg')).status, 201);
  assert.equal((await reg('https://res.cloudinary.com/othercloud/image/upload/v1/a.jpg')).status, 422);
  assert.equal((await reg('https://evil.example/a.jpg')).status, 422);
});

test('newsletter: consent + validation, duplicate-safe, unsubscribe is two-step, CSV export neutralises formulas', async () => {
  const { c, adminToken, store } = await boot();
  const sub = (body) => c.post('/public/newsletter', { body });
  assert.equal((await sub({ email: 'not-an-email', consent: true })).status, 422);
  assert.equal((await sub({ email: 'a@example.org', consent: false })).status, 422);
  assert.equal((await sub({ email: 'a@example.org' })).status, 422);
  const first = await sub({ email: 'A@Example.org', consent: true }), second = await sub({ email: 'a@example.org', consent: true });
  assert.equal(first.status, 201); assert.deepEqual(first.body, second.body); // identical response: no enumeration
  assert.equal(await store.col('subscribers').count({}), 1);
  const row = await store.col('subscribers').findOne({ email: 'a@example.org' });
  assert.ok(row.consent.at && row.consent.text && row.consent.ipHash && !row.consent.ipHash.includes('127'));
  const form = await c.get(`/public/newsletter/unsubscribe?token=${row.token}`);
  assert.match(form.text, /<form method="post"/); assert.equal((await store.col('subscribers').findOne({ email: 'a@example.org' })).status, 'subscribed'); // GET alone changes nothing
  const done = await c.post('/public/newsletter/unsubscribe', { body: `token=${row.token}`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(done.status, 200); assert.equal((await store.col('subscribers').findOne({ email: 'a@example.org' })).status, 'unsubscribed');
  assert.equal((await c.post('/public/newsletter/unsubscribe', { body: { token: 'nope' }, headers: { accept: 'application/json' } })).status, 404);
  await store.col('subscribers').insert({ email: '=cmd@example.org', status: 'subscribed', token: 't2', consent: { at: 'x' }, createdAt: 'x' });
  const exp = await c.get('/admin/subscribers/export.csv', { token: adminToken });
  assert.match(exp.text, /"'=cmd@example.org"/); assert.ok(!/"=cmd/.test(exp.text));
  for (let i = 0; i < 10; i++) await sub({ email: `x${i}@example.org`, consent: true });
  assert.equal((await sub({ email: 'late@example.org', consent: true })).status, 429);
});

test('comments: off by default, moderated, honeypot, spam heuristics, text-only output', async () => {
  const { c, adminToken, mkPub, store } = await boot();
  const a = await mkPub({ title: 'Commentable' });
  let n = 0;
  const post = (body) => c.post(`/public/articles/${a.slug}/comments`, { body, ip: `10.0.0.${++n}` });
  assert.equal((await post({ name: 'Sam', body: 'Nice piece' })).status, 403); // globally disabled
  await c.put('/admin/settings', { token: adminToken, body: { comments: { enabled: true } } });
  assert.equal((await c.get(`/public/articles/${a.slug}`)).body.article.commentsEnabled, true);
  assert.equal((await post({ name: 'Sam', body: 'hi' })).status, 422);
  assert.equal((await post({ name: 'Sam', body: '<b>Great</b> read <script>alert(1)</script> thanks' })).status, 202);
  assert.equal((await post({ name: 'Bot', body: 'Cheap pills', website: 'http://spam.example' })).status, 202); // fake success
  await post({ name: 'Spammer', body: 'http://a.example http://b.example http://c.example' });
  const all = await store.col('comments').find({});
  assert.equal(all.length, 2); assert.ok(!all.some((x) => x.name === 'Bot'));
  assert.equal(all.find((x) => x.name === 'Spammer').status, 'spam');
  const mine = all.find((x) => x.name === 'Sam'); assert.ok(!/[<>]/.test(mine.body));
  assert.deepEqual((await c.get(`/public/articles/${a.slug}/comments`)).body.comments, []); // pending is not public
  await c.put(`/admin/comments/${mine.id}`, { token: adminToken, body: { status: 'approved' } });
  const pubC = (await c.get(`/public/articles/${a.slug}/comments`)).body.comments;
  assert.equal(pubC.length, 1); assert.ok(!('email' in pubC[0]));
  await c.put(`/admin/articles/${a.id}`, { token: adminToken, body: { commentsEnabled: false } });
  assert.equal((await post({ name: 'Late', body: 'Too late now' })).status, 403);
});

test('settings and homepage management: validated, merged, reflected publicly, only published stories can be featured', async () => {
  const { c, adminToken, mkPub, mk } = await boot();
  assert.equal((await c.put('/admin/settings', { token: adminToken, body: { url: 'http://insecure.example' } })).status, 422);
  assert.equal((await c.put('/admin/settings', { token: adminToken, body: { analytics: { ga4Id: 'bad' } } })).status, 422);
  const ok = await c.put('/admin/settings', { token: adminToken, body: { name: 'Daily Pilot', contact: { email: 'desk@example.org' }, searchConsoleVerification: 'abc123_-XYZ', url: 'https://www.dailypilot.example' } });
  assert.equal(ok.status, 200);
  const shell = (await c.get('/public/shell')).body.site;
  assert.deepEqual([shell.name, shell.contact.email, shell.searchConsoleVerification, shell.url], ['Daily Pilot', 'desk@example.org', 'abc123_-XYZ', 'https://www.dailypilot.example']);
  assert.equal((await c.put('/admin/settings', { token: adminToken, body: { searchConsoleVerification: '"><script>' } })).status, 422);
  const a = await mkPub({ title: 'Pick me' }), b = await mkPub({ title: 'Pick me too' }), draft = (await mk({ title: 'Not live' })).body.item;
  assert.equal((await c.put('/admin/homepage', { token: adminToken, body: { homepage: { heroId: draft.id } } })).status, 422);
  assert.equal((await c.put('/admin/homepage', { token: adminToken, body: { homepage: { heroId: a.id, pickIds: [b.id], secondaryIds: [] } } })).status, 200);
  const home = (await c.get('/public/home')).body;
  assert.equal(home.hero.main.id, a.id); assert.equal(home.editorsPicks[0].id, b.id);
});

test('ads: validated, one per placement, only enabled placements reach the public shell', async () => {
  const { c, adminToken } = await boot();
  const mkad = (b) => c.post('/admin/ads', { token: adminToken, body: b });
  assert.equal((await mkad({ name: 'No slot', placement: 'footer', type: 'adsense' })).status, 422);
  assert.equal((await mkad({ name: 'No image', placement: 'footer', type: 'banner' })).status, 422);
  assert.equal((await mkad({ name: 'Bad placement', placement: 'popup', type: 'adsense', slot: '1' })).status, 422);
  assert.equal((await mkad({ name: 'Bad link', placement: 'footer', type: 'banner', imageUrl: 'javascript:x', linkUrl: 'https://a.example' })).status, 422);
  const ad = await mkad({ name: 'Sidebar AdSense', placement: 'article-sidebar', type: 'adsense', slot: '1234567890', enabled: false });
  assert.equal(ad.status, 201); assert.equal((await mkad({ name: 'Dup', placement: 'article-sidebar', type: 'adsense', slot: '5' })).status, 409);
  assert.deepEqual((await c.get('/public/shell')).body.ads, {}); // disabled: nothing public
  await c.put(`/admin/settings`, { token: adminToken, body: { ads: { enabled: true, adsenseClient: 'ca-pub-1234567890' } } });
  await c.put(`/admin/ads/${ad.body.item.id}`, { token: adminToken, body: { enabled: true } });
  const shell = (await c.get('/public/shell')).body;
  assert.deepEqual(shell.ads['article-sidebar'], { type: 'adsense', slot: '1234567890' }); assert.equal(shell.site.adsenseClient, 'ca-pub-1234567890');
  await c.put('/admin/settings', { token: adminToken, body: { ads: { adsTxt: 'google.com, pub-1234567890, DIRECT, f08c47fec0942fa0' } } });
  assert.match((await c.get('/public/ads-txt')).text, /^google\.com, pub-1234567890/);
});

test('redirect manager rejects self-redirects and chains, and serves lookups', async () => {
  const { c, adminToken } = await boot();
  const mkr = (b) => c.post('/admin/redirects', { token: adminToken, body: b });
  assert.equal((await mkr({ from: '/a', to: '/a' })).status, 422);
  assert.equal((await mkr({ from: 'no-slash', to: '/b' })).status, 422);
  assert.equal((await mkr({ from: '/old', to: 'javascript:alert(1)' })).status, 422);
  assert.equal((await mkr({ from: '/old', to: '/new' })).status, 201);
  assert.equal((await mkr({ from: '/old', to: '/other' })).status, 409);
  assert.equal((await mkr({ from: '/x', to: '/old' })).status, 422); // would chain
  assert.deepEqual((await c.get('/public/redirect?path=/old')).body, { to: '/new', status: 301 });
  assert.equal((await c.get('/public/redirect?path=/missing')).status, 404);
});

test('SEO analysis endpoint uses the engine: generated vs manual values, keywords, checklist, JSON-LD, real internal links only', async () => {
  const { c, adminToken, mkPub, mk } = await boot();
  await mkPub({ title: 'React hooks explained for beginners', contentHtml: '<p>' + 'React hooks let components use state. '.repeat(30) + '</p>', tags: ['react'] });
  await mk({ title: 'React hooks draft that is private', contentHtml: '<p>' + 'React hooks private draft. '.repeat(30) + '</p>' });
  const body = { title: 'A tutorial on React hooks', contentHtml: '<h2>Why hooks matter</h2><p>' + 'React hooks let you use state in function components. '.repeat(25) + '</p>', categorySlug: 'technology' };
  const r = (await c.post('/admin/articles/analyze', { token: adminToken, body })).body;
  assert.equal(r.seoTitle.generated, true); assert.match(r.seoTitle.value, /A tutorial on React hooks/);
  assert.equal(r.slug.value, 'tutorial-react-hooks'); assert.equal(r.slug.valid, true); assert.equal(r.slug.available, true);
  assert.equal(r.canonical, 'https://news.example.org/article/tutorial-react-hooks');
  assert.ok(r.keywords.primary && /react|hooks/.test(r.keywords.primary)); assert.match(r.keywords.note, /not search-volume/);
  assert.equal(r.jsonLd['@type'], 'Article'); assert.equal(r.jsonLd.mainEntityOfPage['@id'], r.canonical);
  assert.ok(r.checklist.items.length >= 10); assert.match(r.notes.join(' '), /do not predict|does not predict|not .*ranking/i);
  assert.equal(r.internalLinks.length, 1); assert.match(r.internalLinks[0].title, /explained for beginners/); // the private draft is never suggested
  const manual = (await c.post('/admin/articles/analyze', { token: adminToken, body: { ...body, seoTitle: 'Hand written', metaDescription: 'Hand written description' } })).body;
  assert.deepEqual([manual.seoTitle.value, manual.seoTitle.generated, manual.metaDescription.value, manual.metaDescription.generated], ['Hand written', false, 'Hand written description', false]);
  const img = (await c.post('/admin/articles/analyze', { token: adminToken, body: { ...body, image: { url: 'https://res.cloudinary.com/x/image/upload/a.jpg' } } })).body;
  assert.match(img.altSuggestion.note, /Describe what the image actually shows/);
});

test('dashboard shows real counts, SEO issues and honest analytics states; audit log records actions', async () => {
  const { c, adminToken, mkPub, mk } = await boot();
  await mkPub({ title: 'Live one' }); await mk({ title: 'Draft one' });
  const d = (await c.get('/admin/dashboard', { token: adminToken })).body;
  assert.equal(d.counts.published, 1); assert.equal(d.counts.draft, 1); assert.equal(d.counts.scheduled, 0);
  assert.ok(d.seoIssues.length >= 1); assert.equal(d.analytics.firstParty.totalViews, 0);
  assert.equal(d.analytics.googleAnalytics.connected, false); assert.match(d.analytics.searchConsole.note, /not connected/i);
  const audit = (await c.get('/admin/audit', { token: adminToken })).body.items.map((a) => a.action);
  for (const want of ['auth.login', 'article.create', 'article.publish']) assert.ok(audit.includes(want), want);
});

test('errors: unexpected failures return a generic 500 without leaking internals; health degrades honestly', async () => {
  const { c, store, logs, adminToken, services } = await boot();
  const orig = services.pub.shell; services.pub.shell = async () => { throw new Error('secret db detail /var/lib/x'); };
  const r = await c.get('/public/shell');
  assert.equal(r.status, 500); assert.ok(!JSON.stringify(r.body).includes('secret')); assert.ok(logs.length >= 1);
  services.pub.shell = orig; store.ping = async () => false;
  assert.equal((await c.get('/health')).status, 503);
  void adminToken;
});

test('production config refuses unsafe settings and never defaults a secret', () => {
  const { problems } = loadConfig({ NODE_ENV: 'production' });
  assert.ok(problems.length >= 4);
  const ok = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'z'.repeat(40), MONGODB_URI: 'mongodb+srv://u:p@c.example/db', SITE_URL: 'https://www.example.org', CLIENT_ORIGINS: 'https://www.example.org' });
  assert.deepEqual(ok.problems, []); assert.equal(ok.config.dbDriver, 'mongo');
  assert.ok(loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'z'.repeat(40), MONGODB_URI: 'x', SITE_URL: 'https://a.example', CLIENT_ORIGINS: 'http://localhost:5173' }).problems.some((p) => /localhost/.test(p)));
  assert.equal(loadConfig({ NODE_ENV: 'production' }).config.jwtSecret, '');
});
