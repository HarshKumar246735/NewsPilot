const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export const SITEMAP_LIMIT = 45000; // under the 50,000-URL protocol cap

export function urlset(entries) {
  const body = entries.map((e) => `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : ''}</url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export function sitemapIndex(locs) {
  const body = locs.map((l) => `  <sitemap><loc>${esc(l)}</loc></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}

export function robotsTxt(siteUrl) {
  return ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /api/', 'Disallow: /search', '', `Sitemap: ${siteUrl.replace(/\/$/, '')}/sitemap.xml`, ''].join('\n');
}
