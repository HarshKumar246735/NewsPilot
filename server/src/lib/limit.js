import { HttpError } from './http.js';

// In-memory fixed-window limiter. Fine for a single Render instance; use a shared store if you scale out.
export function createLimiter({ windowMs, max, message = 'Too many requests. Please try again later.', key = (req) => req.ip, now = () => Date.now() }) {
  const hits = new Map();
  const mw = (req, res, next) => {
    const k = key(req), t = now();
    let e = hits.get(k);
    if (!e || e.reset <= t) { e = { n: 0, reset: t + windowMs }; hits.set(k, e); }
    e.n += 1;
    res.set?.('RateLimit-Remaining', String(Math.max(0, max - e.n)));
    if (e.n > max) { res.set?.('Retry-After', String(Math.ceil((e.reset - t) / 1000))); return next(new HttpError(429, message)); }
    if (hits.size > 5000) for (const [kk, v] of hits) if (v.reset <= t) hits.delete(kk);
    return next();
  };
  mw.reset = (k) => hits.delete(k);
  return mw;
}
