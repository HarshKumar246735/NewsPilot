import { NotFoundError, DataError } from '../utils/errors.js';

// Talks to the Express API (built in the next phase). Endpoint contract:
//   GET /public/shell | /public/home | /public/articles/:slug | /public/categories/:slug?page=
//   GET /public/authors/:slug?page= | /public/search?q=&page= | /public/latest?page= | /public/trending?page=
//   POST /public/newsletter {email, consent}
export function createApiSource(config) {
  const base = (config.apiUrl || '').replace(/\/$/, '');

  async function request(path, { params, method = 'GET', body, text = false } = {}) {
    if (!base) throw Object.assign(new Error('The news service is not configured: API_URL is empty.'), { name: 'ConfigError' }); // a deployment mistake, not an outage
    const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''))}` : '';
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const res = await fetch(`${base}${path}${qs}`, {
        method, signal: ctl.signal,
        headers: { Accept: 'application/json', ...(body && { 'Content-Type': 'application/json' }) },
        body: body && JSON.stringify(body),
      });
      if (res.status === 404) throw new NotFoundError();
      if (!res.ok) throw new DataError(`The news service responded with ${res.status}.`);
      return text ? await res.text() : await res.json();
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof DataError) throw e;
      throw new DataError('The news service could not be reached.');
    } finally { clearTimeout(timer); }
  }

  return {
    shell: () => request('/public/shell'),
    home: () => request('/public/home'),
    article: (slug) => request(`/public/articles/${encodeURIComponent(slug)}`),
    category: (slug, page) => request(`/public/categories/${encodeURIComponent(slug)}`, { params: { page } }),
    author: (slug, page) => request(`/public/authors/${encodeURIComponent(slug)}`, { params: { page } }),
    search: (q, page) => request('/public/search', { params: { q, page } }),
    latest: (page) => request('/public/latest', { params: { page } }),
    trending: (page) => request('/public/trending', { params: { page } }),
    // Redirects managed in the admin (and automatic slug-change redirects). Resolves to null when there is none.
    redirect: (path) => request('/public/redirect', { params: { path } }).catch((e) => (e instanceof NotFoundError ? null : Promise.reject(e))),
    async sitemapEntries() {
      const { entries } = await request('/public/sitemap-entries');
      return entries.map((e) => ({ loc: `${config.siteUrl}${e.path === '/' ? '/' : e.path}`, lastmod: e.lastmod }));
    },
    adsTxt: () => request('/public/ads-txt', { text: true }).catch((e) => (e instanceof NotFoundError ? null : Promise.reject(e))),
  };
}

export async function subscribeNewsletter(config, payload) {
  const base = (config.apiUrl || '').replace(/\/$/, '');
  if (!base) throw new DataError('Newsletter signup is not connected yet.');
  const res = await fetch(`${base}/public/newsletter`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new DataError(json.error?.details?.fields?.consent || json.error?.details?.fields?.email || json.error?.message || 'Subscription failed. Please try again.');
  return json;
}

export async function fetchComments(config, slug) {
  const base = (config.apiUrl || '').replace(/\/$/, '');
  if (!base) return [];
  const res = await fetch(`${base}/public/articles/${encodeURIComponent(slug)}/comments`, { headers: { Accept: 'application/json' } });
  return res.ok ? (await res.json()).comments : [];
}

export async function postComment(config, slug, payload) {
  const base = (config.apiUrl || '').replace(/\/$/, '');
  if (!base) throw new DataError('Comments are not connected yet.');
  const res = await fetch(`${base}/public/articles/${encodeURIComponent(slug)}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new DataError(json.error?.message || 'Your comment could not be posted. Please try again.');
  return json;
}

// Fire-and-forget view count used for the Trending and Most read lists. No personal data is sent.
export function recordView(config, slug) {
  const base = (config.apiUrl || '').replace(/\/$/, '');
  if (!base || config.demo) return;
  try { fetch(`${base}/public/articles/${encodeURIComponent(slug)}/view`, { method: 'POST', keepalive: true }).catch(() => {}); } catch { /* ignore */ }
}
