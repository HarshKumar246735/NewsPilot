import {
  absoluteUrl, articlePath, buildSeoTitle, buildMetaDescription, articleJsonLd, websiteJsonLd, serializeJsonLd, truncate,
} from './seo.js';
import { categoryHref, withPage } from './utils/urls.js';
import { responsiveImage } from './utils/cloudinary.js';

const INDEX = 'index, follow, max-image-preview:large';
const NOINDEX = 'noindex, follow';

export function categoryTrail(cat, categories) {
  const parent = cat.parentSlug && categories.find((c) => c.slug === cat.parentSlug);
  return [...(parent ? [{ name: parent.name, path: categoryHref(parent) }] : []), { name: cat.name, path: categoryHref(cat) }];
}

export function articleTrail(article, categories) {
  const full = categories.find((c) => c.slug === article.category.slug) || article.category;
  return [...categoryTrail(full, categories), { name: article.title, path: `/article/${article.slug}` }];
}

const breadcrumbLd = (site, trail) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [{ name: 'Home', path: '/' }, ...trail].map((t, i) => ({
    '@type': 'ListItem', position: i + 1, name: t.name, item: absoluteUrl(site.url, t.path),
  })),
});

const orgLd = (site) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: site.name,
  url: absoluteUrl(site.url, '/'),
  ...(site.logoUrl && { logo: site.logoUrl }),
  ...(site.social && Object.values(site.social).filter(Boolean).length && { sameAs: Object.values(site.social).filter(Boolean) }),
});

// Builds everything that goes in <head> for a resolved page. Admin overrides on the article
// (seoTitle, metaDescription, canonicalUrl) always win over generated values.
export function buildHead({ page, shell, config }) {
  const { site, categories } = shell;
  const abs = (p) => absoluteUrl(site.url, p);
  const pageNo = page.pageNo || 1;
  const suffix = pageNo > 1 ? ` (Page ${pageNo})` : '';
  const h = {
    title: `${site.name}: ${site.tagline}`,
    description: site.description || '',
    canonical: abs('/'),
    robots: INDEX,
    og: { type: 'website', site_name: site.name },
    twitterCard: 'summary',
    links: [],
    preload: null,
    jsonLd: [],
    verification: site.searchConsoleVerification || null,
  };
  const d = page.data;
  const preloadImage = (image, sizes) => {
    if (!image?.url) return;
    const r = responsiveImage(image);
    h.preload = { href: /^https?:/.test(r.src) ? r.src : r.src, ...(r.srcSet && { imagesrcset: r.srcSet, imagesizes: sizes }) };
  };
  const setImage = (image) => {
    if (!image?.url) return;
    h.og.image = /^https?:/.test(image.url) ? image.url : abs(image.url);
    if (image.alt) h.og.image_alt = image.alt;
    h.twitterCard = 'summary_large_image';
  };

  switch (page.name) {
    case 'home':
      preloadImage(d.hero?.main?.image, '(min-width: 64rem) 58vw, 100vw');
      h.jsonLd.push(websiteJsonLd(site), orgLd(site));
      break;
    case 'article': {
      const a = d.article;
      const path = articlePath(a.slug);
      h.title = buildSeoTitle({ title: a.title, seoTitle: a.seoTitle, siteName: site.name });
      h.description = buildMetaDescription({ metaDescription: a.metaDescription, excerpt: a.excerpt, contentHtml: a.contentHtml });
      h.canonical = a.canonicalUrl || abs(path);
      h.og = { type: 'article', site_name: site.name, title: a.ogTitle || a.title, description: a.ogDescription || h.description,
        'article:published_time': a.publishedAt, 'article:modified_time': a.updatedAt || a.publishedAt, 'article:section': a.category.name };
      setImage(a.image);
      preloadImage(a.image, '(min-width: 64rem) 1100px, 100vw');
      const image = a.image && { ...a.image, url: /^https?:/.test(a.image.url) ? a.image.url : abs(a.image.url) };
      h.jsonLd.push(
        articleJsonLd({ article: { ...a, featuredImage: image, isNews: !!a.isNews }, author: a.author, category: a.category, site, seoDescription: h.description }),
        breadcrumbLd(site, articleTrail(a, categories)),
      );
      break;
    }
    case 'category': {
      const c = d.category;
      const base = categoryHref(c);
      h.title = `${c.seoTitle || c.name}${suffix} | ${site.name}`;
      h.description = truncate(c.seoDescription || c.description || `Latest ${c.name} stories, analysis and guides from ${site.name}.`, 155);
      h.canonical = abs(withPage(base, pageNo));
      if (!d.total) h.robots = NOINDEX; // thin page: keep out of the index
      if (pageNo > 1) h.links.push({ rel: 'prev', href: abs(withPage(base, pageNo - 1)) });
      if (pageNo < d.totalPages) h.links.push({ rel: 'next', href: abs(withPage(base, pageNo + 1)) });
      h.jsonLd.push(breadcrumbLd(site, categoryTrail(c, categories)));
      break;
    }
    case 'author': {
      const au = d.author;
      const base = `/author/${au.slug}`;
      h.title = `${au.name}${suffix}: articles and reporting | ${site.name}`;
      h.description = truncate(au.bio || `Articles written by ${au.name} for ${site.name}.`, 155);
      h.canonical = abs(withPage(base, pageNo));
      if (pageNo > 1) h.links.push({ rel: 'prev', href: abs(withPage(base, pageNo - 1)) });
      if (pageNo < d.totalPages) h.links.push({ rel: 'next', href: abs(withPage(base, pageNo + 1)) });
      h.jsonLd.push({ '@context': 'https://schema.org', '@type': 'Person', name: au.name, url: abs(base), ...(au.bio && { description: au.bio }) });
      break;
    }
    case 'latest':
    case 'trending': {
      const base = `/${page.name}`;
      h.title = `${page.name === 'latest' ? 'Latest news' : 'Trending stories'}${suffix} | ${site.name}`;
      h.description = page.name === 'latest' ? `The newest stories published on ${site.name}.` : `The stories readers are opening most on ${site.name}.`;
      h.canonical = abs(withPage(base, pageNo));
      if (pageNo > 1) h.links.push({ rel: 'prev', href: abs(withPage(base, pageNo - 1)) });
      if (pageNo < (d.totalPages || 1)) h.links.push({ rel: 'next', href: abs(withPage(base, pageNo + 1)) });
      break;
    }
    case 'categories':
      h.title = `All sections | ${site.name}`;
      h.description = `Browse every section of ${site.name}, from India and world news to technology, business, sport and guides.`;
      h.canonical = abs('/categories');
      break;
    case 'search':
      h.title = `${d?.q ? `Search results for "${d.q}"` : 'Search'} | ${site.name}`;
      h.description = `Search articles on ${site.name}.`;
      h.canonical = abs('/search'); // query variations are never indexed
      h.robots = 'noindex, follow';
      break;
    case 'page':
      h.title = `${d.title} | ${site.name}`;
      h.description = d.description;
      h.canonical = abs(`/${d.slug}`);
      break;
    case 'admin':
      h.title = `Admin | ${site.name}`;
      h.description = '';
      h.robots = 'noindex, nofollow';
      h.canonical = null;
      break;
    case 'error':
      h.title = `Something went wrong | ${site.name}`;
      h.robots = 'noindex, nofollow';
      break;
    default: // notFound
      h.title = `Page not found | ${site.name}`;
      h.description = 'The page you were looking for could not be found.';
      h.robots = 'noindex, nofollow';
      h.canonical = null;
  }
  if (config.demo) h.robots = 'noindex, nofollow'; // demonstration content must never be indexed
  if (!h.og.title) { h.og.title = h.title; h.og.description = h.description; }
  if (h.canonical) h.og.url = h.canonical;
  return h;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Single description of every <head> tag for a page, used by the server renderer and by client-side navigation.
export function headTags(h) {
  const t = [];
  const meta = (attr, name, content) => { if (content) t.push({ tag: 'meta', attrs: { [attr]: name, content } }); };
  meta('name', 'description', h.description);
  meta('name', 'robots', h.robots);
  if (h.canonical) t.push({ tag: 'link', attrs: { rel: 'canonical', href: h.canonical } });
  if (h.preload) t.push({ tag: 'link', attrs: { rel: 'preload', as: 'image', fetchpriority: 'high', ...h.preload } });
  for (const l of h.links) t.push({ tag: 'link', attrs: { rel: l.rel, href: l.href } });
  for (const [k, v] of Object.entries(h.og)) meta('property', k.includes(':') ? k : `og:${k}`, v);
  meta('name', 'twitter:card', h.twitterCard);
  meta('name', 'twitter:title', h.og.title);
  meta('name', 'twitter:description', h.og.description);
  meta('name', 'twitter:image', h.og.image);
  meta('name', 'google-site-verification', h.verification);
  for (const ld of h.jsonLd) t.push({ tag: 'script', attrs: { type: 'application/ld+json' }, text: serializeJsonLd(ld) });
  return t;
}

export function renderHeadHtml(h) {
  const attrs = (a) => Object.entries(a).map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
  const tags = headTags(h).map((x) => (x.tag === 'script'
    ? `<script ${attrs(x.attrs)} data-np-head>${x.text}</script>`
    : `<${x.tag} ${attrs(x.attrs)} data-np-head>`));
  return [`<title>${esc(h.title)}</title>`, ...tags].join('\n    ');
}
