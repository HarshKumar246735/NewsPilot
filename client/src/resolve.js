import { matchRoute } from './routes.js';
import { buildHead } from './head.js';
import { NotFoundError, DataError } from './utils/errors.js';
import { getStaticPage } from './content/pages.js';

const PAGE_SIZE_ROUTES = new Set(['category', 'author', 'latest', 'trending', 'search']);

function redirectTo(location, status = 301) { return { redirect: location, status }; }

// Reads ?page=. Returns { page } or { canonicalRedirect } when the value is "1" or malformed,
// so there is exactly one URL per page of results.
function readPage(url) {
  if (!url.searchParams.has('page')) return { page: 1 };
  const raw = url.searchParams.get('page');
  if (/^[2-9]\d*$|^1\d+$/.test(raw)) return { page: Number(raw) };
  url.searchParams.delete('page');
  return { canonicalRedirect: url.pathname + (url.search || '') };
}

// A 404 first checks the redirect table (manual redirects and automatic slug-change redirects).
async function notFound(shell, config, key, ds) {
  const path = key.split('?')[0];
  const hit = ds?.redirect ? await ds.redirect(path).catch(() => null) : null;
  if (hit?.to && hit.to !== path) return redirectTo(hit.to, [301, 302, 307, 308].includes(hit.status) ? hit.status : 301);
  return finish({ name: 'notFound', status: 404, data: null, key, params: {}, query: {} }, shell, config);
}
const failure = (shell, config, key, err) => finish({ name: 'error', status: 500, data: { message: err?.message || 'Unexpected error' }, key, params: {}, query: {} }, shell, config);

function finish(page, shell, config) {
  return { ...page, head: buildHead({ page, shell, config }) };
}

// Resolves a URL to { status, name, data, head } or a redirect. Never throws.
export async function resolvePage(rawUrl, ds, shell, config) {
  const url = new URL(rawUrl, 'http://local');
  const key = url.pathname + url.search;
  try {
    // One canonical form per URL: lowercase, no trailing slash.
    let path = url.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '') || '/';
    if (path !== path.toLowerCase() && !path.startsWith('/search')) path = path.toLowerCase();
    if (path !== url.pathname) return redirectTo(path + url.search);

    if (path === '/admin' || path.startsWith('/admin/')) return finish({ name: 'admin', status: 200, data: null, key, params: {}, query: {} }, shell, config);

    const m = matchRoute(path);
    if (!m) return notFound(shell, config, key, ds);
    const base = { name: m.name, params: m.params, key, query: Object.fromEntries(url.searchParams) };

    let pageNo = 1;
    if (PAGE_SIZE_ROUTES.has(m.name)) {
      const r = readPage(url);
      if (r.canonicalRedirect) return redirectTo(r.canonicalRedirect);
      pageNo = r.page;
    }

    switch (m.name) {
      case 'home':
        return finish({ ...base, status: 200, data: await ds.home() }, shell, config);
      case 'article': {
        const data = await ds.article(m.params.slug);
        if (data.redirect) return redirectTo(data.redirect);
        return finish({ ...base, status: 200, data }, shell, config);
      }
      case 'category': {
        const { a, b } = m.params;
        const cat = shell.categories.find((c) => c.slug === (b || a));
        if (!cat || (b && cat.parentSlug !== a)) return notFound(shell, config, key, ds);
        if (!b && cat.parentSlug) return redirectTo(`/category/${cat.parentSlug}/${cat.slug}${pageNo > 1 ? `?page=${pageNo}` : ''}`);
        const list = await ds.category(cat.slug, pageNo);
        if (pageNo > 1 && pageNo > list.totalPages) return notFound(shell, config, key, ds);
        return finish({ ...base, status: 200, pageNo, data: { category: cat, ...list } }, shell, config);
      }
      case 'author': {
        const data = await ds.author(m.params.slug, pageNo);
        if (pageNo > 1 && pageNo > data.totalPages) return notFound(shell, config, key, ds);
        return finish({ ...base, status: 200, pageNo, data }, shell, config);
      }
      case 'latest': {
        const data = await ds.latest(pageNo);
        if (pageNo > 1 && pageNo > data.totalPages) return notFound(shell, config, key, ds);
        return finish({ ...base, status: 200, pageNo, data }, shell, config);
      }
      case 'trending':
        return finish({ ...base, status: 200, pageNo, data: await ds.trending(pageNo) }, shell, config);
      case 'search': {
        const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
        const data = q ? await ds.search(q, pageNo) : { items: [], total: 0, totalPages: 0, page: 1 };
        return finish({ ...base, status: 200, pageNo, data: { ...data, q } }, shell, config);
      }
      case 'categories':
        return finish({ ...base, status: 200, data: null }, shell, config);
      case 'page': {
        const data = getStaticPage(m.params.slug, shell.site);
        return data ? finish({ ...base, status: 200, data }, shell, config) : notFound(shell, config, key, ds);
      }
      default:
        return notFound(shell, config, key, ds);
    }
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(shell, config, key, ds);
    return failure(shell, config, key, err instanceof DataError ? err : new DataError('The page could not be loaded.'));
  }
}
