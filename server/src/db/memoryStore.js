import { randomId } from '../lib/crypto.js';
import { HttpError } from '../lib/http.js';
import { COLLECTIONS } from './collections.js';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

// Supports the Mongo operator subset the app uses: equality, $in $nin $ne $lt $lte $gt $gte $regex $exists $or $and.
function matches(doc, filter) {
  return Object.entries(filter).every(([k, cond]) => {
    if (k === '$or') return cond.some((f) => matches(doc, f));
    if (k === '$and') return cond.every((f) => matches(doc, f));
    const v = doc[k];
    if (!isObj(cond)) return Array.isArray(v) ? v.includes(cond) : v === cond || (cond === null && v === undefined);
    return Object.entries(cond).every(([op, x]) => {
      const vals = Array.isArray(v) ? v : [v];
      switch (op) {
        case '$in': return vals.some((y) => x.includes(y));
        case '$nin': return !vals.some((y) => x.includes(y));
        case '$ne': return !vals.includes(x);
        case '$lt': return v !== undefined && v !== null && v < x;
        case '$lte': return v !== undefined && v !== null && v <= x;
        case '$gt': return v !== undefined && v !== null && v > x;
        case '$gte': return v !== undefined && v !== null && v >= x;
        case '$exists': return (v !== undefined) === x;
        case '$regex': return vals.some((y) => typeof y === 'string' && new RegExp(x, cond.$options || '').test(y));
        case '$options': return true;
        default: throw new Error(`Unsupported operator ${op}`);
      }
    });
  });
}

export function createMemoryStore() {
  const data = {};
  const clone = (d) => (d ? structuredClone(d) : d);
  const rows = (name) => data[name] ?? (data[name] = []);

  function col(name) {
    const spec = COLLECTIONS[name];
    if (!spec) throw new Error(`Unknown collection ${name}`);
    const checkUnique = (doc, exceptId) => {
      for (const f of spec.unique) {
        if (doc[f] === undefined || doc[f] === null) continue;
        if (rows(name).some((r) => r.id !== exceptId && r[f] === doc[f])) throw new HttpError(409, `A record with that ${f} already exists`, { field: f });
      }
    };
    return {
      async insert(doc) { const d = { id: randomId(), ...clone(doc) }; checkUnique(d); rows(name).push(d); return clone(d); },
      async find(filter = {}, { sort, skip = 0, limit } = {}) {
        let out = rows(name).filter((d) => matches(d, filter));
        if (sort) { const s = Object.entries(sort); out = [...out].sort((a, b) => { for (const [k, dir] of s) { const c = cmp(a[k] ?? null, b[k] ?? null); if (c) return c * dir; } return 0; }); }
        return out.slice(skip, limit ? skip + limit : undefined).map(clone);
      },
      async findOne(filter) { return clone(rows(name).find((d) => matches(d, filter))) ?? null; },
      async count(filter = {}) { return rows(name).filter((d) => matches(d, filter)).length; },
      async update(id, patch) {
        const d = rows(name).find((r) => r.id === id);
        if (!d) return null;
        const next = { ...d, ...clone(patch) }; delete next.id; next.id = id;
        checkUnique(next, id);
        Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, next);
        return clone(d);
      },
      async inc(id, field, n = 1) { const d = rows(name).find((r) => r.id === id); if (d) d[field] = (d[field] || 0) + n; return !!d; },
      async remove(id) { const i = rows(name).findIndex((r) => r.id === id); if (i < 0) return false; rows(name).splice(i, 1); return true; },
      async removeMany(filter) { const before = rows(name).length; data[name] = rows(name).filter((d) => !matches(d, filter)); return before - data[name].length; },
    };
  }
  return { driver: 'memory', col, async connect() {}, async close() {}, async ping() { return true; } };
}
