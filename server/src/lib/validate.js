import { HttpError } from './http.js';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const bad = (v) => v && typeof v === 'object' && !Array.isArray(v);

// rules: { field: { type, required, min, max, enum, items, pattern, trim, default, nullable } }
// Returns ONLY the fields named in the rules (unknown keys are dropped). `partial` skips required/default.
export function validate(input, rules, { partial = false } = {}) {
  const src = bad(input) ? input : {};
  const out = {}, errors = {};
  for (const [key, r] of Object.entries(rules)) {
    let v = src[key];
    if (v === undefined || v === null || v === '') {
      if (v === null && r.nullable) { out[key] = null; continue; }
      if (partial && v === undefined) continue;
      if (r.required && !(r.type === 'boolean' && typeof v === 'boolean')) { errors[key] = 'This field is required'; continue; }
      if (r.default !== undefined && !partial) out[key] = typeof r.default === 'function' ? r.default() : r.default;
      else if (v === '' && r.type === 'string') out[key] = '';
      continue;
    }
    switch (r.type) {
      case 'string': case 'email': case 'url': case 'slug': {
        if (typeof v !== 'string') { errors[key] = 'Must be text'; break; }
        if (r.trim !== false) v = v.trim();
        if (r.type === 'email' && !EMAIL.test(v)) { errors[key] = 'Enter a valid email address'; break; }
        if (r.type === 'url') { try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { errors[key] = 'Enter a valid http(s) URL'; break; } }
        if (r.type === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) { errors[key] = 'Use lowercase letters, numbers and hyphens'; break; }
        if (r.min && v.length < r.min) { errors[key] = `Must be at least ${r.min} characters`; break; }
        if (r.max && v.length > r.max) { errors[key] = `Must be at most ${r.max} characters`; break; }
        if (r.pattern && !r.pattern.test(v)) { errors[key] = r.patternMessage || 'Invalid format'; break; }
        if (r.enum && !r.enum.includes(v)) { errors[key] = `Must be one of: ${r.enum.join(', ')}`; break; }
        out[key] = r.type === 'email' ? v.toLowerCase() : v; break;
      }
      case 'number': {
        const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
        if (typeof n !== 'number' || !Number.isFinite(n)) { errors[key] = 'Must be a number'; break; }
        if ((r.min !== undefined && n < r.min) || (r.max !== undefined && n > r.max)) { errors[key] = `Must be between ${r.min ?? '-∞'} and ${r.max ?? '∞'}`; break; }
        out[key] = r.int ? Math.trunc(n) : n; break;
      }
      case 'boolean':
        if (typeof v !== 'boolean') { errors[key] = 'Must be true or false'; break; }
        out[key] = v; break;
      case 'date': {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) { errors[key] = 'Enter a valid date'; break; }
        out[key] = d.toISOString(); break;
      }
      case 'array': {
        if (!Array.isArray(v)) { errors[key] = 'Must be a list'; break; }
        if (r.max && v.length > r.max) { errors[key] = `At most ${r.max} items`; break; }
        const items = [];
        for (const it of v) {
          if (r.items) { try { items.push(validate({ x: it }, { x: { ...r.items, required: true } }).x); } catch (e) { errors[key] = e.details?.fields?.x || 'Invalid item'; break; } } else items.push(it);
        }
        if (!errors[key]) out[key] = items;
        break;
      }
      case 'object': {
        if (!bad(v)) { errors[key] = 'Must be an object'; break; }
        if (r.shape) { try { out[key] = validate(v, r.shape, { partial: true }); } catch (e) { errors[key] = e.details?.fields || 'Invalid'; } } else out[key] = v;
        break;
      }
      default: out[key] = v;
    }
  }
  if (Object.keys(errors).length) throw new HttpError(422, 'Validation failed', { fields: errors });
  return out;
}

// Reject MongoDB operator injection ({"$gt": ""}) and prototype pollution keys anywhere in a payload.
export function hasUnsafeKeys(value, depth = 0) {
  if (depth > 12) return true;
  if (Array.isArray(value)) return value.some((x) => hasUnsafeKeys(x, depth + 1));
  if (bad(value)) return Object.keys(value).some((k) => k.startsWith('$') || k.includes('.') || k === '__proto__' || k === 'constructor' || hasUnsafeKeys(value[k], depth + 1));
  return false;
}
