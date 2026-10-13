import { wrap, notFound } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { uniqueSlug } from '../seo/index.js';

// Small generic CRUD mounter used by categories, authors, redirects, ads and users.
export function mountCrud(router, path, { col, rules, entity, auth, audit, read = 'author', write = 'editor', del = 'editor', sort = { createdAt: -1 }, slugFrom, before, beforeDelete, present = (x) => x, label = (x) => x.name || x.id }) {
  const get = async (id) => { const row = await col.findOne({ id }); if (!row) throw notFound(`${entity} not found`); return row; };
  router.get(path, auth.requireRole(read), wrap(async (req, res) => res.json({ items: (await col.find({}, { sort })).map(present) })));
  router.get(`${path}/:id`, auth.requireRole(read), wrap(async (req, res) => res.json({ item: present(await get(req.params.id)) })));
  router.post(path, auth.requireRole(write), wrap(async (req, res) => {
    let d = validate(req.body, rules);
    if (slugFrom && !d.slug) d.slug = await uniqueSlug(d[slugFrom], async (s) => !!(await col.findOne({ slug: s })));
    if (before) d = await before(d, null, req);
    const row = await col.insert({ ...d, createdAt: new Date().toISOString() });
    await audit.log(req.user, `${entity}.create`, entity, row.id, label(row), req.ip);
    res.status(201).json({ item: present(row) });
  }));
  router.put(`${path}/:id`, auth.requireRole(write), wrap(async (req, res) => {
    const old = await get(req.params.id);
    let d = validate(req.body, rules, { partial: true });
    if (before) d = await before(d, old, req);
    const row = await col.update(old.id, d);
    await audit.log(req.user, `${entity}.update`, entity, row.id, label(row), req.ip);
    res.json({ item: present(row) });
  }));
  router.delete(`${path}/:id`, auth.requireRole(del), wrap(async (req, res) => {
    const old = await get(req.params.id);
    if (beforeDelete) await beforeDelete(old, req);
    await col.remove(old.id);
    await audit.log(req.user, `${entity}.delete`, entity, old.id, label(old), req.ip);
    res.status(204).end();
  }));
}
