import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App.jsx';
import { createDataSource } from './services/dataSource.js';
import { resolvePage } from './resolve.js';
import { renderHeadHtml } from './head.js';
import { serializeJsonLd, robotsTxt, urlset, sitemapIndex, SITEMAP_LIMIT } from './seo.js';

// Returns { status, html, headHtml, stateJson } for a page, { status, redirect } for a redirect,
// or { status, type, body } for robots.txt / sitemap.xml.
export async function render(url, config) {
  const { pathname } = new URL(url, 'http://local');
  try {
    if (!config.siteUrl) throw new Error('SITE_URL is not configured.');
    const ds = await createDataSource(config);

    if (pathname === '/robots.txt') {
      // Demonstration builds are never crawlable.
      const body = config.demo ? 'User-agent: *\nDisallow: /\n' : robotsTxt(config.siteUrl);
      return { status: 200, type: 'text/plain; charset=utf-8', body };
    }
    const sm = /^\/sitemap(?:-(\d+))?\.xml$/.exec(pathname);
    if (sm) {
      if (!ds.sitemapEntries) return { status: 404, type: 'text/plain', body: 'Not found' };
      const all = await ds.sitemapEntries();
      const chunks = Math.ceil(all.length / SITEMAP_LIMIT);
      const xml = 'application/xml; charset=utf-8';
      if (!sm[1]) return { status: 200, type: xml, body: chunks > 1 ? sitemapIndex(Array.from({ length: chunks }, (_, i) => `${config.siteUrl}/sitemap-${i + 1}.xml`)) : urlset(all) };
      const n = Number(sm[1]);
      return n >= 1 && n <= chunks ? { status: 200, type: xml, body: urlset(all.slice((n - 1) * SITEMAP_LIMIT, n * SITEMAP_LIMIT)) } : { status: 404, type: 'text/plain', body: 'Not found' };
    }
    if (pathname === '/ads.txt') {
      const txt = ds.adsTxt ? await ds.adsTxt() : null;
      return txt ? { status: 200, type: 'text/plain; charset=utf-8', body: txt } : { status: 404, type: 'text/plain', body: 'Not found' };
    }

    const shell = await ds.shell();
    shell.site.url = config.siteUrl; // the deployment's canonical domain always wins over anything stored in the database
    const page = await resolvePage(url, ds, shell, config);
    if (page.redirect) return { status: page.status, redirect: page.redirect };

    const now = new Date().toISOString();
    const initial = { config: { demo: config.demo, apiUrl: config.apiUrl }, shell, page, now };
    const rendered = renderToString(
      <StaticRouter location={page.key}>
        <App initial={initial} />
      </StaticRouter>,
    );
    // React 19 prepends <link rel="preload"> tags for eager images to the body markup. The LCP image is already
    // preloaded from <head> (head.js), and the client never renders these tags into the body, so drop them.
    const html = rendered.replace(/^(?:<link rel="preload"[^>]*\/>)+/, '');
    return { status: page.status, html, headHtml: renderHeadHtml(page.head), stateJson: serializeJsonLd(initial) };
  } catch (err) {
    console.error('[render]', url, err);
    // API down or timing out: a 503 tells search engines "come back later" (it does not get a page de-indexed).
    if (err?.name === 'DataError') {
      const page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Temporarily unavailable</title></head><body style="font-family:system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 1.25rem;line-height:1.6"><h1 style="font-family:Georgia,serif">We\u2019ll be right back</h1><p>The newsroom is temporarily unavailable. Please try again in a minute.</p></body></html>';
      return { status: 503, type: 'text/html; charset=utf-8', body: page, headers: { 'Retry-After': '60' } };
    }
    return { status: 500, type: 'text/plain; charset=utf-8', body: `Server configuration error: ${err.message}` };
  }
}
