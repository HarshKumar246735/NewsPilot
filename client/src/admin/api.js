const KEY = 'np-admin-token';

export class ApiError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields || {}; }
}

const mem = { token: null };
export const tokenStore = {
  get() { try { return sessionStorage.getItem(KEY) || mem.token; } catch { return mem.token; } },
  set(t) { mem.token = t; try { sessionStorage.setItem(KEY, t); } catch { /* private mode: token lives in memory only */ } },
  clear() { mem.token = null; try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } },
};

// The admin talks to the API with a short-lived bearer token kept in sessionStorage (cleared when the tab closes).
export function createAdminApi(config) {
  const base = (config.apiUrl || '').replace(/\/$/, '');
  async function request(method, path, { body, raw, headers } = {}) {
    if (!base) throw new ApiError(0, 'The API is not configured. Set API_URL on the frontend.');
    const token = tokenStore.get();
    let res;
    try {
      res = await fetch(base + path, { method, headers: { Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch { throw new ApiError(0, 'Could not reach the API. Check your connection and try again.'); }
    if (raw) return res;
    if (res.status === 204) return null;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && token && !path.startsWith('/auth/login')) { tokenStore.clear(); window.dispatchEvent(new Event('np-admin-logout')); }
      throw new ApiError(res.status, json.error?.message || `Request failed (${res.status})`, json.error?.details?.fields);
    }
    return json;
  }
  return {
    base, request,
    get: (p) => request('GET', p), post: (p, b = {}) => request('POST', p, { body: b }), put: (p, b) => request('PUT', p, { body: b }), del: (p) => request('DELETE', p),
    async login(email, password) { const r = await request('POST', '/auth/login', { body: { email, password } }); tokenStore.set(r.token); return r.user; },
    logout() { tokenStore.clear(); },
    async download(path, filename) {
      const res = await request('GET', path, { raw: true });
      if (!res.ok) throw new ApiError(res.status, 'Download failed');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: filename }); document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    },
  };
}

export const ROLE_LEVEL = { author: 1, editor: 2, admin: 3 };
export const can = (user, min) => ROLE_LEVEL[user?.role] >= ROLE_LEVEL[min];
