// Request handling shared by the local dev/preview server and the Vercel function.
export function configFromEnv(env = process.env) {
  return {
    siteUrl: (env.SITE_URL || '').replace(/\/$/, ''),
    apiUrl: (env.API_URL || '').replace(/\/$/, ''),
    demo: env.NP_DEMO === 'true',
  };
}

export function fillTemplate(template, { headHtml, html, stateJson }) {
  return template
    .replace('<!--head-outlet-->', () => headHtml)
    .replace('<!--app-html-->', () => html)
    .replace('<!--state-outlet-->', () => `<script id="np-state" type="application/json">${stateJson}</script>`);
}

// Returns { status, headers, body }. `render` is entry-server's render().
export async function respond(url, { template, render, config }) {
  const r = await render(url, config);
  const admin = /^\/admin(\/|\?|$)/.test(url);
  const cache = config.demo ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300';
  if (r.redirect) return { status: r.status, headers: { Location: r.redirect, 'Cache-Control': 'public, s-maxage=3600' }, body: '' };
  if (r.type) return { status: r.status, headers: { 'Content-Type': r.type, 'Cache-Control': r.status === 200 ? cache : 'no-store', ...r.headers }, body: r.body };
  return {
    status: r.status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': admin || r.status >= 500 ? 'no-store' : r.status === 404 ? 'public, s-maxage=30' : cache, ...(admin && { 'X-Robots-Tag': 'noindex, nofollow' }) },
    body: fillTemplate(template, r),
  };
}
