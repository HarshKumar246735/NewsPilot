import { verifyJwt } from '../lib/crypto.js';
import { unauthorized, forbidden } from '../lib/http.js';

const LEVEL = { author: 1, editor: 2, admin: 3 };

// Every protected request re-reads the user, so deactivating an account or bumping tokenVersion
// (password change / "sign out everywhere") takes effect immediately instead of when the JWT expires.
export function createAuth({ store, config, clock }) {
  const U = store.col('users');
  const requireAuth = async (req, res, next) => {
    try {
      const h = req.headers.authorization || '';
      const token = h.startsWith('Bearer ') ? h.slice(7) : '';
      const p = verifyJwt(token, config.jwtSecret, { now: clock().getTime() });
      if (!p) throw unauthorized();
      const u = await U.findOne({ id: p.sub });
      if (!u || !u.active || u.tokenVersion !== p.tv) throw unauthorized('Your session has expired. Please sign in again.');
      req.user = { id: u.id, email: u.email, name: u.name, role: u.role };
      next();
    } catch (e) { next(e); }
  };
  // requireRole('editor') allows editors and admins.
  const requireRole = (min) => (req, res, next) => (LEVEL[req.user?.role] >= LEVEL[min] ? next() : next(forbidden()));
  return { requireAuth, requireRole };
}
