import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, isValidSlug, uniqueSlug, buildSeoTitle, buildMetaDescription, absoluteUrl,
  suggestKeywords, seoChecklist, articleJsonLd, serializeJsonLd, urlset, robotsTxt, readingMinutes, truncate } from '../src/seo/index.js';

test('slugify matches the spec example', () => {
  assert.equal(slugify('Best Programming Languages for Beginners in 2026'), 'best-programming-languages-for-beginners-2026');
  assert.equal(slugify("India's GDP & Growth: What's Next?"), 'indias-gdp-and-growth-whats-next');
});
test('reserved and invalid slugs are rejected', () => {
  assert.equal(isValidSlug('admin'), false);
  assert.equal(isValidSlug('Bad Slug'), false);
  assert.equal(isValidSlug('good-slug-1'), true);
});
test('uniqueSlug appends a counter on collision', async () => {
  const taken = new Set(['hello', 'hello-2']);
  assert.equal(await uniqueSlug('Hello', async (s) => taken.has(s)), 'hello-3');
});
test('admin SEO title and description overrides are preserved', () => {
  assert.equal(buildSeoTitle({ title: 'x', seoTitle: 'Custom', siteName: 'NewsPilot' }), 'Custom');
  assert.equal(buildMetaDescription({ metaDescription: 'Mine', excerpt: 'e', contentHtml: '' }), 'Mine');
});
test('generated meta description is plain text within limit', () => {
  const d = buildMetaDescription({ contentHtml: '<p>' + 'word '.repeat(100) + '</p><script>x()</script>' });
  assert.ok(d.length <= 155); assert.ok(!d.includes('<')); assert.ok(d.endsWith('…'));
});
test('absoluteUrl strips trailing slashes and uses site origin only', () => {
  assert.equal(absoluteUrl('https://newspilot.in', '/article/a/'), 'https://newspilot.in/article/a');
  assert.equal(absoluteUrl('https://newspilot.in/', '/'), 'https://newspilot.in/');
});
test('absoluteUrl refuses localhost in production', () => {
  const prev = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  assert.throws(() => absoluteUrl('http://localhost:3000', '/'));
  process.env.NODE_ENV = prev;
});
test('keyword suggestions come from the content and carry a disclaimer', () => {
  const k = suggestKeywords({ title: 'React Hooks Tutorial for Beginners', headings: ['What are React hooks'],
    contentHtml: '<p>React hooks let you use state in function components. Learn useState and useEffect with React hooks.</p>' });
  assert.ok(k.primary); assert.match(k.primary + k.secondary.join(' '), /react/);
  assert.match(k.note, /not search-volume/);
});
test('checklist flags missing alt text and extra H1, never scores keywords', () => {
  const r = seoChecklist({ title: 'T', slug: 'good-slug', contentHtml: '<h1>x</h1><img src="a.jpg"><p>short</p>', publishedAt: new Date() });
  const by = Object.fromEntries(r.items.map((i) => [i.id, i.status]));
  assert.equal(by.h1, 'attention'); assert.equal(by.bodyAlt, 'attention'); assert.equal(by.content, 'attention');
});
test('JSON-LD uses real fields, omits missing ones, and is script-safe', () => {
  const site = { url: 'https://newspilot.in', name: 'NewsPilot' };
  const ld = articleJsonLd({ article: { title: 'A </script> title', slug: 'a', publishedAt: '2026-01-01', isNews: true }, site, seoDescription: 'd' });
  assert.equal(ld['@type'], 'NewsArticle'); assert.equal(ld.image, undefined); assert.equal(ld.publisher.logo, undefined);
  assert.ok(!serializeJsonLd(ld).includes('</script>'));
});
test('sitemap XML escapes URLs; robots blocks admin but not content', () => {
  assert.match(urlset([{ loc: 'https://x.in/a?b=1&c=2' }]), /&amp;c=2/);
  const r = robotsTxt('https://x.in/'); assert.match(r, /Disallow: \/admin/); assert.match(r, /Sitemap: https:\/\/x\.in\/sitemap\.xml/);
  assert.ok(!/Disallow: \/(assets|static|article)/.test(r));
});
test('reading time and truncate behave', () => {
  assert.equal(readingMinutes('<p>' + 'w '.repeat(441) + '</p>'), 3);
  assert.equal(truncate('short', 10), 'short');
});
