import { stripHtml, truncate } from './text.js';

export const LIMITS = { title: 60, description: 155 };

export function buildSeoTitle({ title, seoTitle, siteName }) {
  if (seoTitle?.trim()) return seoTitle.trim(); // admin override is always preserved
  const base = title.trim();
  const suffix = ` | ${siteName}`;
  return base.length + suffix.length <= LIMITS.title + 5 ? base + suffix : truncate(base, LIMITS.title);
}

export function buildMetaDescription({ metaDescription, excerpt, contentHtml }) {
  if (metaDescription?.trim()) return metaDescription.trim();
  const source = excerpt?.trim() || stripHtml(contentHtml);
  return truncate(source, LIMITS.description);
}

// Canonicals are always built from the configured production domain, never from the request host.
export function absoluteUrl(siteUrl, path = '/') {
  if (!siteUrl) throw new Error('SITE_URL is not configured');
  const u = new URL(siteUrl);
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(u.hostname) && process.env.NODE_ENV === 'production') {
    throw new Error('SITE_URL must be a production domain, not localhost');
  }
  const clean = ('/' + path.replace(/^\/+/, '')).replace(/\/{2,}/g, '/');
  const normalized = clean.length > 1 ? clean.replace(/\/+$/, '') : clean; // no trailing slash
  return u.origin + normalized;
}

export function articlePath(slug) { return `/article/${slug}`; }
export function categoryPath(slug, page = 1) { return page > 1 ? `/category/${slug}?page=${page}` : `/category/${slug}`; }
