import fs from 'node:fs';
import path from 'node:path';
import { wrap, HttpError, notFound, conflict } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { hashPassword, randomToken } from '../lib/crypto.js';
import { imageInfo } from '../lib/imageInfo.js';
import { signUpload, isCloudinaryUrl } from '../services/cloudinary.js';
import { SETTINGS_RULES } from '../services/settings.js';
import { seoChecklist, buildMetaDescription } from '../seo/index.js';
import { mountCrud } from './crud.js';
import { PASSWORD_RULE } from './auth.js';

const STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived', 'trashed'];
const FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
const slugRule = { type: 'slug', max: 100 };
const csvCell = (v) => { const s = String(v ?? ''); return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; }; // neutralise spreadsheet formula injection in exports
const csv = (rows) => rows.map((r) => r.map((c) => `"${csvCell(c).replace(/"/g, '""')}"`).join(',')).join('\n');

export function adminRoutes({ express, store, config, clock, services, auth }) {
  const r = express.Router();
  const { articles, audit, settings, newsletter } = services;
  const A = store.col('articles'), C = store.col('categories'), M = store.col('media'), U = store.col('users'), CM = store.col('comments');
  r.use(auth.requireAuth);

  // ---- Dashboard -----------------------------------------------------------------------------------------------
  r.get('/dashboard', wrap(async (req, res) => {
    const own = req.user.role === 'author' ? { createdBy: req.user.id } : {};
    const counts = {};
    for (const s of STATUSES) counts[s] = await A.count({ ...own, status: s });
    const recent = await A.find({ ...own, status: { $ne: 'trashed' } }, { sort: { updatedAt: -1 }, limit: 6 });
    const pool = await A.find({ ...own, status: { $in: ['draft', 'review', 'scheduled', 'published'] } }, { sort: { updatedAt: -1 }, limit: 100 });
    const seoIssues = pool.map((a) => ({ id: a.id, title: a.title, status: a.status, issues: seoChecklist({ ...a, autoDescription: buildMetaDescription({ metaDescription: a.metaDescription, excerpt: a.excerpt, contentHtml: a.contentHtml }) }).items.filter((i) => i.status === 'attention').map((i) => i.label) })).filter((x) => x.issues.length).slice(0, 8);
    const published = await A.find({ status: 'published' }, { limit: 2000 });
    const s = await settings.get();
    res.json({
      counts, categories: await C.count({}), comments: { pending: await CM.count({ status: 'pending' }) }, subscribers: req.user.role === 'admin' ? await newsletter.count({ status: 'subscribed' }) : undefined,
      recentArticles: recent.map((a) => ({ id: a.id, title: a.title, status: a.status, updatedAt: a.updatedAt })),
      recentActivity: req.user.role === 'author' ? [] : (await audit.recent(8)).map((a) => ({ action: a.action, summary: a.summary, userEmail: a.userEmail, createdAt: a.createdAt })),
      seoIssues,
      analytics: {
        firstParty: { totalViews: published.reduce((n, a) => n + (a.views || 0), 0), note: 'Page views recorded by NewsPilot itself. This is not Google Analytics data.' },
        googleAnalytics: s.analytics.ga4Id ? { connected: false, measurementId: s.analytics.ga4Id, note: 'The measurement ID is saved. Reporting data is not pulled into this dashboard; view it in Google Analytics.' } : { connected: false, note: 'Add a GA4 measurement ID in Settings to prepare the integration.' },
        searchConsole: { connected: false, note: 'Search Console data is not connected. Verify the site and submit the sitemap in Search Console.' },
      },
    });
  }));

  // ---- Articles ------------------------------------------------------------------------------------------------
  r.post('/articles/analyze', wrap(async (req, res) => res.json(await articles.analyze(req.body, req.user))));
  r.get('/articles', wrap(async (req, res) => {
    const q = req.query, filter = {};
    if (req.user.role === 'author') filter.createdBy = req.user.id;
    if (STATUSES.includes(q.status)) filter.status = q.status; else filter.status = { $ne: 'trashed' };
    if (typeof q.category === 'string' && q.category) filter.categorySlug = q.category;
    if (typeof q.q === 'string' && q.q.trim()) filter.title = { $regex: q.q.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const page = Math.max(1, Math.min(1000, Number(q.page) || 1)), limit = 20;
    const dir = q.sort === 'oldest' ? 1 : -1;
    const [total, rows] = await Promise.all([A.count(filter), A.find(filter, { sort: { updatedAt: dir }, skip: (page - 1) * limit, limit })]);
    res.json({ items: rows.map(({ contentHtml, searchText, ...a }) => a), total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  }));
  r.get('/articles/:id', wrap(async (req, res) => {
    const a = await articles.get(req.params.id);
    if (req.user.role === 'author' && a.createdBy !== req.user.id) throw notFound('Article not found');
    const { searchText, ...rest } = a; res.json({ item: rest });
  }));
  r.post('/articles', wrap(async (req, res) => { const a = await articles.create(req.body, req.user); res.status(201).json({ item: a }); }));
  r.put('/articles/:id', wrap(async (req, res) => res.json({ item: await articles.update(req.params.id, req.body, req.user) })));
  r.post('/articles/:id/:action', wrap(async (req, res) => {
    const d = validate(req.body, { publishedAt: { type: 'date' } }, { partial: true });
    res.json(await articles.transition(req.params.id, req.params.action, d, req.user));
  }));
  r.delete('/articles/:id', auth.requireRole('editor'), wrap(async (req, res) => { await articles.remove(req.params.id, req.user); res.status(204).end(); }));

  // ---- Categories, authors, redirects, ads, users (generic CRUD) -----------------------------------------------
  const common = { auth, audit };
  mountCrud(r, '/categories', { ...common, col: C, entity: 'category', slugFrom: 'name', sort: { order: 1 },
    rules: { name: { type: 'string', required: true, max: 80 }, slug: slugRule, parentSlug: { type: 'string', max: 100, nullable: true }, description: { type: 'string', max: 400 }, seoTitle: { type: 'string', max: 120 }, seoDescription: { type: 'string', max: 320 }, image: { type: 'string', max: 500 }, order: { type: 'number', int: true, min: 0, max: 9999, default: 0 }, enabled: { type: 'boolean', default: true }, primary: { type: 'boolean', default: false } },
    async before(d, old) {
      if (d.slug && (!old || d.slug !== old.slug)) { if (await C.findOne({ slug: d.slug })) throw conflict('That slug is already used by another category', { field: 'slug' }); }
      if (d.parentSlug) {
        const parent = await C.findOne({ slug: d.parentSlug });
        if (!parent) throw new HttpError(422, 'Validation failed', { fields: { parentSlug: 'Parent category does not exist' } });
        if (parent.parentSlug) throw new HttpError(422, 'Validation failed', { fields: { parentSlug: 'Categories can only be nested two levels deep' } });
        if (old && parent.slug === old.slug) throw new HttpError(422, 'Validation failed', { fields: { parentSlug: 'A category cannot be its own parent' } });
      }
      return d;
    },
    async beforeDelete(c) {
      if (await A.count({ categorySlug: c.slug })) throw conflict('This category still has articles. Move them first.');
      if (await C.count({ parentSlug: c.slug })) throw conflict('This category has subcategories. Delete or move them first.');
    } });
  mountCrud(r, '/authors', { ...common, col: store.col('authors'), entity: 'author', slugFrom: 'name', sort: { name: 1 },
    rules: { name: { type: 'string', required: true, max: 80 }, slug: slugRule, bio: { type: 'string', max: 600 }, email: { type: 'email', max: 200 }, avatar: { type: 'string', max: 500 } },
    async before(d, old) { if (d.slug && (!old || d.slug !== old.slug) && (await store.col('authors').findOne({ slug: d.slug }))) throw conflict('That slug is already used by another author', { field: 'slug' }); return d; },
    async beforeDelete(a) { if (await A.count({ authorSlug: a.slug })) throw conflict('This author still has articles. Reassign them first.'); } });
  mountCrud(r, '/redirects', { ...common, col: store.col('redirects'), entity: 'redirect', label: (x) => `${x.from} -> ${x.to}`,
    rules: { from: { type: 'string', required: true, max: 300, pattern: /^\/[^\s?#]*$/, patternMessage: 'Start with / and omit the query string' }, to: { type: 'string', required: true, max: 500, pattern: /^(\/[^\s]*|https:\/\/[^\s]+)$/, patternMessage: 'Use a path starting with / or a full https URL' }, status: { type: 'number', int: true, enum: undefined, min: 301, max: 308, default: 301 } },
    async before(d, old) {
      const from = d.from ?? old?.from, to = d.to ?? old?.to;
      if (from === to) throw new HttpError(422, 'Validation failed', { fields: { to: 'A redirect cannot point to itself' } });
      if (to.startsWith('/') && (await store.col('redirects').findOne({ from: to }))) throw new HttpError(422, 'Validation failed', { fields: { to: 'That target is itself redirected, which would create a chain or loop' } });
      return d;
    } });
  mountCrud(r, '/ads', { ...common, col: store.col('ads'), entity: 'ad', read: 'editor', write: 'admin', del: 'admin',
    rules: { name: { type: 'string', required: true, max: 80 }, placement: { type: 'string', required: true, enum: ['header', 'homepage-feed', 'article-body', 'article-sidebar', 'article-end', 'footer'] }, type: { type: 'string', required: true, enum: ['adsense', 'banner'] }, enabled: { type: 'boolean', default: false }, slot: { type: 'string', max: 20, pattern: /^\d*$/, patternMessage: 'AdSense slot IDs are numbers' }, imageUrl: { type: 'string', max: 500, pattern: /^(https:\/\/.+)?$/, patternMessage: 'Use an https image URL' }, linkUrl: { type: 'string', max: 500, pattern: /^(https:\/\/.+)?$/, patternMessage: 'Use an https link' }, alt: { type: 'string', max: 200 } },
    async before(d, old) {
      const x = { ...old, ...d };
      if (x.type === 'adsense' && !x.slot) throw new HttpError(422, 'Validation failed', { fields: { slot: 'An AdSense ad unit needs its slot ID' } });
      if (x.type === 'banner' && (!x.imageUrl || !x.linkUrl)) throw new HttpError(422, 'Validation failed', { fields: { imageUrl: 'A banner needs an image URL and a link URL' } });
      const clash = (await store.col('ads').find({ placement: x.placement })).find((o) => o.id !== old?.id);
      if (clash) throw conflict(`The "${x.placement}" placement already has an ad (${clash.name}). Edit that one instead.`);
      return d;
    } });
  mountCrud(r, '/users', { ...common, col: U, entity: 'user', read: 'admin', write: 'admin', del: 'admin', label: (x) => x.email,
    present: ({ passwordHash, tokenVersion, ...u }) => u,
    rules: { email: { type: 'email', required: true, max: 200 }, name: { type: 'string', required: true, max: 80 }, role: { type: 'string', required: true, enum: ['admin', 'editor', 'author'] }, active: { type: 'boolean', default: true }, password: { ...PASSWORD_RULE, required: false, trim: false } },
    async before(d, old, req) {
      if (!old && !d.password) throw new HttpError(422, 'Validation failed', { fields: { password: 'A password is required for new users' } });
      const { password, ...rest } = d;
      if (old && old.id === req.user.id && (rest.role && rest.role !== 'admin' || rest.active === false)) throw new HttpError(422, 'You cannot demote or deactivate your own account');
      const out = { ...rest, ...(old ? {} : { tokenVersion: 0 }) };
      if (password) { out.passwordHash = await hashPassword(password); out.tokenVersion = (old?.tokenVersion || 0) + 1; }
      else if (old && (rest.role !== undefined && rest.role !== old.role || rest.active === false)) out.tokenVersion = (old.tokenVersion || 0) + 1; // role/active changes sign the user out
      return out;
    },
    async beforeDelete(u, req) { if (u.id === req.user.id) throw new HttpError(422, 'You cannot delete your own account'); } });

  // ---- Media ---------------------------------------------------------------------------------------------------
  r.get('/media', wrap(async (req, res) => {
    const f = {}; const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
    if (q) f.$or = ['alt', 'caption', 'originalName'].map((k) => ({ [k]: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
    res.json({ items: await M.find(f, { sort: { createdAt: -1 }, limit: 200 }), cloudinaryEnabled: config.cloudinary.enabled, localEnabled: config.allowLocalUploads });
  }));
  r.post('/media/sign', wrap(async (req, res) => {
    if (!config.cloudinary.enabled) throw new HttpError(503, 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the API.');
    res.json(signUpload(config, { now: clock().getTime() }));
  }));
  const mediaMeta = { alt: { type: 'string', max: 300 }, caption: { type: 'string', max: 400 }, credit: { type: 'string', max: 150 } };
  r.post('/media', wrap(async (req, res) => {
    const d = validate(req.body, { url: { type: 'url', required: true, max: 600 }, publicId: { type: 'string', max: 300 }, width: { type: 'number', required: true, min: 1, max: 30000, int: true }, height: { type: 'number', required: true, min: 1, max: 30000, int: true }, bytes: { type: 'number', required: true, min: 1, max: config.maxImageBytes, int: true }, format: { type: 'string', required: true, enum: FORMATS }, originalName: { type: 'string', max: 200 }, ...mediaMeta });
    if (!isCloudinaryUrl(config, d.url)) throw new HttpError(422, 'Validation failed', { fields: { url: 'Only images hosted on your Cloudinary account can be registered' } });
    const row = await M.insert({ ...d, provider: 'cloudinary', createdBy: req.user.id, createdAt: clock().toISOString() });
    await audit.log(req.user, 'media.create', 'media', row.id, d.originalName || d.url, req.ip);
    res.status(201).json({ item: row });
  }));
  // Dev/offline uploads: the file is decoded from base64, identified by its magic bytes, given a random name and stored on disk.
  r.post('/media/local', express.json({ limit: '14mb' }), wrap(async (req, res) => {
    if (!config.allowLocalUploads) throw new HttpError(403, 'Local uploads are disabled. Use Cloudinary.');
    const d = validate(req.body, { data: { type: 'string', required: true, max: 12_000_000, trim: false }, originalName: { type: 'string', max: 200 }, ...mediaMeta });
    const buf = Buffer.from(d.data.replace(/^data:[^,]*,/, ''), 'base64');
    if (buf.length > config.maxImageBytes) throw new HttpError(413, `Images must be ${Math.round(config.maxImageBytes / 1048576)} MB or smaller`);
    const info = imageInfo(buf);
    if (!info) throw new HttpError(415, 'Only PNG, JPEG, GIF and WebP images are accepted');
    const name = `${randomToken(12)}.${info.format === 'jpeg' ? 'jpg' : info.format}`;
    fs.mkdirSync(config.uploadDir, { recursive: true });
    fs.writeFileSync(path.join(config.uploadDir, name), buf);
    const row = await M.insert({ url: `/uploads/${name}`, provider: 'local', width: info.width, height: info.height, bytes: buf.length, format: info.format, originalName: d.originalName || '', alt: d.alt || '', caption: d.caption || '', credit: d.credit || '', createdBy: req.user.id, createdAt: clock().toISOString() });
    await audit.log(req.user, 'media.create', 'media', row.id, name, req.ip);
    res.status(201).json({ item: row });
  }));
  r.put('/media/:id', wrap(async (req, res) => { const d = validate(req.body, mediaMeta, { partial: true }); const row = await M.update(req.params.id, d); if (!row) throw notFound('Media not found'); res.json({ item: row }); }));
  r.delete('/media/:id', auth.requireRole('editor'), wrap(async (req, res) => {
    const m = await M.findOne({ id: req.params.id }); if (!m) throw notFound('Media not found');
    const inUse = await A.find({ status: { $ne: 'trashed' } }, { limit: 5000 }).then((rows) => rows.filter((a) => a.image?.url === m.url || (a.contentHtml || '').includes(m.url)));
    if (inUse.length) throw conflict(`This image is used by ${inUse.length} article(s), including "${inUse[0].title}". Remove it from them first.`);
    if (m.provider === 'local') { try { fs.unlinkSync(path.join(config.uploadDir, path.basename(m.url))); } catch { /* already gone */ } }
    await M.remove(m.id); await audit.log(req.user, 'media.delete', 'media', m.id, m.originalName || m.url, req.ip);
    res.status(204).end();
  }));

  // ---- Settings and homepage ---------------------------------------------------------------------------------
  r.get('/settings', auth.requireRole('admin'), wrap(async (req, res) => res.json({ item: await settings.get(), integrations: { cloudinary: config.cloudinary.enabled, mail: config.mail.enabled, database: store.driver, siteUrlFromEnv: config.siteUrl } })));
  r.put('/settings', auth.requireRole('admin'), wrap(async (req, res) => { const { homepage, ...rest } = req.body || {}; const item = await settings.update(rest); await audit.log(req.user, 'settings.update', 'settings', 'site', Object.keys(rest).join(', '), req.ip); res.json({ item }); }));
  r.get('/homepage', auth.requireRole('editor'), wrap(async (req, res) => {
    const s = await settings.get();
    const pool = await A.find({ status: 'published' }, { sort: { publishedAt: -1 }, limit: 100 });
    res.json({ item: s.homepage, candidates: pool.map((a) => ({ id: a.id, title: a.title, slug: a.slug, categorySlug: a.categorySlug, isFeatured: !!a.isFeatured })), categories: (await C.find({ parentSlug: null }, { sort: { order: 1 } })).map((c) => ({ slug: c.slug, name: c.name })) });
  }));
  r.put('/homepage', auth.requireRole('editor'), wrap(async (req, res) => {
    const d = validate(req.body, { homepage: SETTINGS_RULES.homepage });
    const ids = [d.homepage.heroId, ...(d.homepage.secondaryIds || []), ...(d.homepage.pickIds || []), ...(d.homepage.trendingIds || [])].filter(Boolean);
    for (const id of new Set(ids)) if (!(await A.findOne({ id, status: 'published' }))) throw new HttpError(422, 'Validation failed', { fields: { homepage: 'Only published articles can be featured on the homepage' } });
    const item = await settings.update({ homepage: d.homepage });
    await audit.log(req.user, 'homepage.update', 'settings', 'homepage', '', req.ip);
    res.json({ item: item.homepage });
  }));

  // ---- Newsletter, comments, audit ---------------------------------------------------------------------------
  r.get('/subscribers', auth.requireRole('admin'), wrap(async (req, res) => res.json({ items: (await newsletter.list({}, { limit: 1000 })).map(({ token, consent, ...s }) => ({ ...s, consentAt: consent?.at })), total: await newsletter.count({}) })));
  r.get('/subscribers/export.csv', auth.requireRole('admin'), wrap(async (req, res) => {
    const rows = await newsletter.list({ status: 'subscribed' }, { limit: 50000 });
    res.type('text/csv').set('Content-Disposition', 'attachment; filename="subscribers.csv"').send(csv([['email', 'status', 'subscribed_at'], ...rows.map((s) => [s.email, s.status, s.consent?.at])]));
  }));
  r.delete('/subscribers/:id', auth.requireRole('admin'), wrap(async (req, res) => { await newsletter.remove(req.params.id); await audit.log(req.user, 'subscriber.delete', 'subscriber', req.params.id, '', req.ip); res.status(204).end(); }));
  r.get('/comments', auth.requireRole('editor'), wrap(async (req, res) => { const f = ['pending', 'approved', 'spam'].includes(req.query.status) ? { status: req.query.status } : {}; res.json({ items: await CM.find(f, { sort: { createdAt: -1 }, limit: 200 }) }); }));
  r.put('/comments/:id', auth.requireRole('editor'), wrap(async (req, res) => { const d = validate(req.body, { status: { type: 'string', required: true, enum: ['approved', 'pending', 'spam'] } }); const row = await CM.update(req.params.id, d); if (!row) throw notFound(); await audit.log(req.user, 'comment.moderate', 'comment', row.id, d.status, req.ip); res.json({ item: row }); }));
  r.delete('/comments/:id', auth.requireRole('editor'), wrap(async (req, res) => { await CM.remove(req.params.id); await audit.log(req.user, 'comment.delete', 'comment', req.params.id, '', req.ip); res.status(204).end(); }));
  r.get('/audit', auth.requireRole('admin'), wrap(async (req, res) => { const page = Math.max(1, Number(req.query.page) || 1); res.json({ items: await audit.recent(50, (page - 1) * 50), total: await audit.count(), page }); }));
  return r;
}
