import { HttpError } from '../lib/http.js';
import { hasUnsafeKeys } from '../lib/validate.js';

export function securityHeaders({ prod }) {
  return (req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Frame-Options', 'DENY');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (prod) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

// Only the configured frontend origins may call the API from a browser. Requests without an Origin header
// (server-side rendering, curl, health checks) are unaffected; CORS is a browser rule, not an authentication layer.
export function cors(origins) {
  const allowed = new Set(origins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.set('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') { res.status(origin && allowed.has(origin) ? 204 : 403).end(); return; }
    next();
  };
}

export const guardInput = (req, res, next) => {
  if (hasUnsafeKeys(req.body) || hasUnsafeKeys(req.query)) return next(new HttpError(400, 'Request contains disallowed characters in field names'));
  return next();
};

export const notFoundHandler = (req, res, next) => next(new HttpError(404, 'Not found'));

// eslint-disable-next-line no-unused-vars
export const errorHandler = ({ log = console.error } = {}) => (err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: { message: err.message, ...(err.details && { details: err.details }) } });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { message: 'Request body is not valid JSON' } });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: { message: 'Request body is too large' } });
  log('[api] unhandled error', req.method, req.originalUrl || req.url, err);
  return res.status(500).json({ error: { message: 'Something went wrong on our side' } });
};
