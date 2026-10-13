import { wrap, HttpError, unauthorized } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { hashPassword, verifyPassword, signJwt } from '../lib/crypto.js';
import { createLimiter } from '../lib/limit.js';

const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
export const PASSWORD_RULE = { type: 'string', required: true, min: 12, max: 200 };

export function authRoutes({ express, store, config, clock, audit, auth }) {
  const r = express.Router();
  const U = store.col('users');
  const byIp = createLimiter({ windowMs: 15 * 60_000, max: 20, key: (req) => `ip:${req.ip}`, now: () => clock().getTime(), message: 'Too many sign-in attempts. Try again in a few minutes.' });
  const byEmail = createLimiter({ windowMs: 15 * 60_000, max: 6, key: (req) => `em:${String(req.body?.email || '').toLowerCase()}`, now: () => clock().getTime(), message: 'Too many sign-in attempts for this account. Try again in a few minutes.' });
  const view = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

  r.post('/login', byIp, byEmail, wrap(async (req, res) => {
    const { email, password } = validate(req.body, { email: { type: 'email', required: true }, password: { type: 'string', required: true, max: 200, trim: false } });
    const u = await U.findOne({ email });
    const ok = await verifyPassword(password, u?.passwordHash || DUMMY); // same work whether or not the account exists
    if (!u || !u.active || !ok) { await audit.log({ id: 'anon', email }, 'auth.login_failed', 'user', u?.id, '', req.ip); throw unauthorized('Incorrect email or password'); }
    await U.update(u.id, { lastLoginAt: clock().toISOString() });
    await audit.log(u, 'auth.login', 'user', u.id, '', req.ip);
    res.json({ token: signJwt({ sub: u.id, role: u.role, tv: u.tokenVersion }, config.jwtSecret, { now: clock().getTime() }), user: view(u) });
  }));
  r.get('/me', auth.requireAuth, (req, res) => res.json({ user: req.user }));
  r.post('/logout-all', auth.requireAuth, wrap(async (req, res) => {
    const u = await U.findOne({ id: req.user.id });
    await U.update(u.id, { tokenVersion: (u.tokenVersion || 0) + 1 });
    await audit.log(req.user, 'auth.logout_all', 'user', u.id);
    res.json({ ok: true });
  }));
  r.post('/change-password', auth.requireAuth, wrap(async (req, res) => {
    const d = validate(req.body, { currentPassword: { type: 'string', required: true, max: 200, trim: false }, newPassword: { ...PASSWORD_RULE, trim: false } });
    const u = await U.findOne({ id: req.user.id });
    if (!(await verifyPassword(d.currentPassword, u.passwordHash))) throw new HttpError(403, 'Your current password is incorrect');
    const tv = (u.tokenVersion || 0) + 1;
    await U.update(u.id, { passwordHash: await hashPassword(d.newPassword), tokenVersion: tv });
    await audit.log(req.user, 'auth.password_changed', 'user', u.id);
    res.json({ token: signJwt({ sub: u.id, role: u.role, tv }, config.jwtSecret, { now: clock().getTime() }) });
  }));
  return r;
}
