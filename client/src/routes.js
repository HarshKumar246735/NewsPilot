// Route table shared by the server renderer and the browser. Plain JS so it is trivially testable.
export const STATIC_PAGES = [
  'about', 'contact', 'editorial-policy', 'corrections-policy', 'privacy-policy', 'terms',
  'disclaimer', 'cookie-policy',
];

const table = [
  ['home', '/'],
  ['article', '/article/:slug'],
  ['category', '/category/:a'],
  ['category', '/category/:a/:b'],
  ['author', '/author/:slug'],
  ['search', '/search'],
  ['latest', '/latest'],
  ['trending', '/trending'],
  ['categories', '/categories'],
  ...STATIC_PAGES.map((s) => ['page', `/${s}`]),
];

export function matchRoute(pathname) {
  try { return matchRouteUnsafe(pathname); } catch { return null; } // malformed %-escapes
}

function matchRouteUnsafe(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  for (const [name, pattern] of table) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    if (pp.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i]))) {
      return { name, params, ...(name === 'page' ? { params: { slug: parts[0] } } : {}) };
    }
  }
  return null;
}
