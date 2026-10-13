// Production adapter. Same interface as memoryStore, backed by MongoDB Atlas through Mongoose.
// NOTE: this file needs `mongoose` installed and a real database; it is not exercised by the offline test suite.
import { randomId } from '../lib/crypto.js';
import { HttpError } from '../lib/http.js';
import { COLLECTIONS } from './collections.js';

export async function createMongoStore({ uri, mongoose: injected }) {
  const mongoose = injected ?? (await import('mongoose')).default;
  mongoose.set('strictQuery', false);
  // NOTE: do not enable `sanitizeFilter` here. It would rewrite this app's own $lte/$in/$regex operators into equality
  // checks. Operator injection is prevented earlier: guardInput rejects $-keys and validate() whitelists every field.

  const models = {};
  for (const [name, spec] of Object.entries(COLLECTIONS)) {
    const schema = new mongoose.Schema({ id: { type: String, required: true } }, { strict: false, versionKey: false, collection: name });
    for (const f of spec.unique) schema.index({ [f]: 1 }, { unique: true, sparse: f !== 'id' });
    for (const idx of spec.index || []) schema.index(Object.fromEntries(idx.map((f) => [f, -1])));
    models[name] = mongoose.models[name] || mongoose.model(name, schema);
  }
  const strip = (d) => { if (!d) return d; const { _id, ...rest } = d; return rest; };
  const dup = (e) => { if (e?.code === 11000) throw new HttpError(409, `A record with that ${Object.keys(e.keyPattern || {})[0] || 'value'} already exists`, { field: Object.keys(e.keyPattern || {})[0] }); throw e; };

  function col(name) {
    const M = models[name];
    if (!M) throw new Error(`Unknown collection ${name}`);
    return {
      async insert(doc) { try { const d = await M.create({ id: randomId(), ...doc }); return strip(d.toObject()); } catch (e) { return dup(e); } },
      async find(filter = {}, { sort, skip = 0, limit } = {}) { let q = M.find(filter).lean(); if (sort) q = q.sort(sort); if (skip) q = q.skip(skip); if (limit) q = q.limit(limit); return (await q).map(strip); },
      async findOne(filter) { return strip(await M.findOne(filter).lean()); },
      async count(filter = {}) { return M.countDocuments(filter); },
      async update(id, patch) { try { return strip(await M.findOneAndUpdate({ id }, { $set: patch }, { new: true }).lean()); } catch (e) { return dup(e); } },
      async inc(id, field, n = 1) { return (await M.updateOne({ id }, { $inc: { [field]: n } })).matchedCount > 0; },
      async remove(id) { return (await M.deleteOne({ id })).deletedCount > 0; },
      async removeMany(filter) { return (await M.deleteMany(filter)).deletedCount; },
    };
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await Promise.all(Object.values(models).map((m) => m.init()));
  return { driver: 'mongo', col, async connect() {}, async close() { await mongoose.disconnect(); }, async ping() { return mongoose.connection.readyState === 1; } };
}
