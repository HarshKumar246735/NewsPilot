// A small, faithful stand-in for the parts of Express 4 that NewsPilot uses, so the REAL route/middleware code can run
// in tests without installing Express. Like Express 4, it does NOT catch rejected promises from async handlers.
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options'];
const flat = (a) => a.flat(Infinity);

function compile(p) {
  const keys = [];
  const re = new RegExp(`^${p.replace(/\/+$/, '').replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}/?$`);
  return { re, keys };
}
function qs(search) {
  const out = {};
  for (const [k, v] of new URLSearchParams(search)) {
    const m = /^([^[\]]+)((?:\[[^\]]*\])+)$/.exec(k);
    if (!m) { out[k] = k in out ? [].concat(out[k], v) : v; continue; }
    const path = [m[1], ...[...m[2].matchAll(/\[([^\]]*)\]/g)].map((x) => x[1])];
    let o = out; path.slice(0, -1).forEach((p) => { o = o[p] = o[p] && typeof o[p] === 'object' ? o[p] : {}; }); o[path.at(-1)] = v;
  }
  return out;
}

function handle(stack, req, res, out) {
  let i = 0;
  const next = (err) => {
    if (err === 'route') err = undefined;
    const layer = stack[i++];
    if (!layer) return out(err);
    const path = req.path;
    let enter, restore = () => {};
    if (layer.use) {
      const p = layer.prefix === '/' ? '' : layer.prefix.replace(/\/$/, '');
      if (p && !(path === p || path.startsWith(`${p}/`))) return next(err);
      const saved = { path: req.path, baseUrl: req.baseUrl };
      req.baseUrl = (req.baseUrl || '') + p; req.path = path.slice(p.length) || '/';
      restore = () => { req.path = saved.path; req.baseUrl = saved.baseUrl; };
      enter = layer.handler;
    } else {
      if (layer.method !== req.method) return next(err);
      const m = layer.pattern.re.exec(path);
      if (!m) return next(err);
      req.params = Object.fromEntries(layer.pattern.keys.map((k, n) => [k, decodeURIComponent(m[n + 1])]));
      enter = layer.handlers;
    }
    const chain = flat([enter]);
    let j = 0;
    const inner = (e) => {
      if (e === 'route') e = undefined;
      const h = chain[j++];
      if (!h) { restore(); return next(e); }
      const isErr = h.length === 4;
      if (e && !isErr) return inner(e);
      if (!e && isErr) return inner();
      try { const r = isErr ? h(e, req, res, inner) : h(req, res, h.stack ? (x) => { inner(x); } : inner); void r; } catch (x) { inner(x); }
    };
    inner(err);
  };
  next();
}

function createRouter() {
  const stack = [];
  const router = (req, res, out) => handle(stack, req, res, out);
  router.stack = stack;
  for (const m of METHODS) router[m] = (path, ...hs) => { stack.push({ method: m.toUpperCase(), pattern: compile(path), handlers: flat(hs) }); return router; };
  router.use = (a, ...rest) => { const [prefix, hs] = typeof a === 'string' ? [a, rest] : ['/', [a, ...rest]]; flat(hs).forEach((handler) => stack.push({ use: true, prefix, handler })); return router; };
  router.set = () => router; router.disable = () => router; router.all = router.use;
  return router;
}

export function createExpress() {
  const express = () => {
    const app = createRouter();
    app.dispatch = (opts) => new Promise((resolve) => {
      const u = new URL(opts.url, 'http://test');
      const headers = Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      const raw = opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
      if (raw !== undefined && !headers['content-type']) headers['content-type'] = 'application/json';
      const req = { method: (opts.method || 'GET').toUpperCase(), url: u.pathname + u.search, originalUrl: u.pathname + u.search, path: u.pathname, baseUrl: '', query: qs(u.search), headers, rawBody: raw, body: undefined, ip: opts.ip || '127.0.0.1', protocol: 'https', params: {}, get: (n) => headers[n.toLowerCase()] };
      const res = { statusCode: 200, headers: {}, body: '', set(k, v) { this.headers[k.toLowerCase()] = String(v); return this; }, setHeader(k, v) { return this.set(k, v); }, get(k) { return this.headers[k.toLowerCase()]; }, status(c) { this.statusCode = c; return this; }, type(t) { return this.set('content-type', t === 'html' ? 'text/html' : t === 'json' ? 'application/json' : t); }, end(b) { if (b !== undefined) this.body = b; done(); return this; }, send(b) { if (typeof b === 'object' && !Buffer.isBuffer(b)) return this.json(b); if (!this.headers['content-type']) this.type('html'); this.body = b ?? ''; done(); return this; }, json(o) { this.set('content-type', 'application/json'); this.body = JSON.stringify(o); done(); return this; }, redirect(c, l) { this.statusCode = typeof c === 'number' ? c : 302; this.set('location', typeof c === 'number' ? l : c); done(); } };
      let finished = false;
      function done() { if (finished) return; finished = true; let json; try { json = JSON.parse(res.body); } catch { json = undefined; } resolve({ status: res.statusCode, headers: res.headers, text: String(res.body), body: json }); }
      handle(app.stack, req, res, (err) => { if (err) { res.status(500).json({ error: { message: `UNHANDLED ${err.stack || err}` } }); } else res.status(404).json({ error: { message: 'No route' } }); });
    });
    return app;
  };
  express.Router = createRouter;
  express.json = ({ limit = '100kb' } = {}) => {
    const max = /mb$/i.test(limit) ? parseFloat(limit) * 1048576 : parseFloat(limit) * 1024;
    return (req, res, next) => {
      if (req.body !== undefined) return next();
      req.body = {};
      if (req.rawBody && /json/.test(req.headers['content-type'] || '')) {
        if (req.rawBody.length > max) return next(Object.assign(new Error('too large'), { type: 'entity.too.large' }));
        try { req.body = JSON.parse(req.rawBody); } catch { return next(Object.assign(new Error('bad json'), { type: 'entity.parse.failed' })); }
      }
      return next();
    };
  };
  express.urlencoded = () => (req, res, next) => { if (req.rawBody && /urlencoded/.test(req.headers['content-type'] || '')) req.body = Object.fromEntries(new URLSearchParams(req.rawBody)); else if (req.body === undefined || Object.keys(req.body).length === 0) req.body = req.body || {}; next(); };
  express.static = () => (req, res, next) => next();
  return express;
}

export function client(app) {
  const call = (method) => (url, { token, body, headers = {}, ip } = {}) => app.dispatch({ method, url, body, ip, headers: { ...(token && { authorization: `Bearer ${token}` }), ...headers } });
  return { get: call('GET'), post: call('POST'), put: call('PUT'), delete: call('DELETE'), patch: call('PATCH'), options: call('OPTIONS') };
}
