import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const N = 16384, R = 8, P = 1, KEYLEN = 64;

// Password hashing with scrypt (memory-hard, built into Node: no native build step on Render).
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

const b64u = (x) => Buffer.from(x).toString('base64url');
const sign = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

// Minimal HS256 JWT. The algorithm is fixed (never read from the token), so "alg: none" attacks do not apply.
export function signJwt(payload, secret, { expiresInSec = 8 * 3600, now = Date.now() } = {}) {
  const iat = Math.floor(now / 1000);
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat, exp: iat + expiresInSec }));
  return `${head}.${body}.${sign(`${head}.${body}`, secret)}`;
}

export function verifyJwt(token, secret, { now = Date.now() } = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  try {
    if (JSON.parse(Buffer.from(head, 'base64url')).alg !== 'HS256') return null;
    const expected = Buffer.from(sign(`${head}.${body}`, secret));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url'));
    return payload.exp > Math.floor(now / 1000) ? payload : null;
  } catch { return null; }
}

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
export const randomId = () => crypto.randomUUID();
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const sha1 = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');
export const safeEqual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
