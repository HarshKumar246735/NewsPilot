import { absoluteUrl, articlePath } from './meta.js';

// Builds JSON-LD only from real fields; omits anything missing instead of inventing it.
export function articleJsonLd({ article, author, category, site, seoDescription }) {
  const url = absoluteUrl(site.url, articlePath(article.slug));
  const node = {
    '@context': 'https://schema.org',
    '@type': article.isNews ? 'NewsArticle' : 'Article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: article.title.slice(0, 110),
    description: seoDescription,
    datePublished: new Date(article.publishedAt).toISOString(),
    dateModified: new Date(article.updatedAt || article.publishedAt).toISOString(),
    author: author
      ? { '@type': 'Person', name: author.name, url: absoluteUrl(site.url, `/author/${author.slug}`) }
      : { '@type': 'Organization', name: site.name, url: absoluteUrl(site.url, '/') },
    publisher: {
      '@type': 'Organization',
      name: site.name,
      url: absoluteUrl(site.url, '/'),
      ...(site.logoUrl && { logo: { '@type': 'ImageObject', url: site.logoUrl } }),
    },
  };
  if (article.featuredImage?.url) node.image = [article.featuredImage.url];
  if (category) node.articleSection = category.name;
  return node;
}

export function breadcrumbJsonLd({ site, category, article }) {
  const items = [{ name: 'Home', url: absoluteUrl(site.url, '/') }];
  if (category) items.push({ name: category.name, url: absoluteUrl(site.url, `/category/${category.slug}`) });
  if (article) items.push({ name: article.title, url: absoluteUrl(site.url, articlePath(article.slug)) });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

export function websiteJsonLd(site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: absoluteUrl(site.url, '/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absoluteUrl(site.url, '/search')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

// Escape "<" so JSON-LD can never break out of its <script> tag.
export const serializeJsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
