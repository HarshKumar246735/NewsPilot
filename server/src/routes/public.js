import { wrap, HttpError, notFound } from '../lib/http.js';
import { createLimiter } from '../lib/limit.js';

const page = (req) => { const n = Number(req.query.page); return Number.isInteger(n) && n >= 1 && n <= 5000 ? n : 1; };
const cache = (res, s = 30) => res.set('Cache-Control', `public, s-maxage=${s}, stale-while-revalidate=${s * 4}`);
const html = (title, body) => `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.6">${body}</body>`;

export function publicRoutes({ express, services, config, clock }) {
  const r = express.Router();
  const { pub, newsletter, comments, settings } = services;
  const now = () => clock().getTime();
  const subscribeLimit = createLimiter({ windowMs: 3600_000, max: 8, now, message: 'Too many signup attempts. Please try again later.' });
  const commentLimit = createLimiter({ windowMs: 10 * 60_000, max: 5, now, message: 'You are commenting too quickly. Please wait a few minutes.' });
  const viewLimit = createLimiter({ windowMs: 60_000, max: 120, now });

  r.get('/shell', wrap(async (req, res) => { cache(res, 15); res.json(await pub.shell()); }));
  r.get('/home', wrap(async (req, res) => { cache(res, 30); res.json(await pub.home()); }));
  r.get('/articles/:slug', wrap(async (req, res) => {
    const data = await pub.article(req.params.slug);
    if (!data) throw notFound('Article not found');
    cache(res, 30); res.json(data);
  }));
  r.post('/articles/:slug/view', viewLimit, wrap(async (req, res) => { await pub.recordView(req.params.slug); res.status(204).end(); }));
  r.get('/categories/:slug', wrap(async (req, res) => {
    const c = await services.store.col('categories').findOne({ slug: req.params.slug });
    if (!c || c.enabled === false) throw notFound('Category not found');
    cache(res, 30); res.json(await pub.category(req.params.slug, page(req)));
  }));
  r.get('/authors/:slug', wrap(async (req, res) => { const d = await pub.author(req.params.slug, page(req)); if (!d) throw notFound('Author not found'); cache(res); res.json(d); }));
  r.get('/latest', wrap(async (req, res) => { cache(res); res.json(await pub.latest(page(req))); }));
  r.get('/trending', wrap(async (req, res) => { cache(res); res.json(await pub.trending(page(req))); }));
  r.get('/search', wrap(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length > 100) throw new HttpError(400, 'Enter a search term of up to 100 characters');
    res.json(await pub.search(q, page(req)));
  }));
  r.get('/sitemap-entries', wrap(async (req, res) => { cache(res, 60); res.json({ entries: await pub.sitemapEntries() }); }));
  r.get('/redirect', wrap(async (req, res) => {
    const p = typeof req.query.path === 'string' ? req.query.path : '';
    const hit = p.startsWith('/') ? await pub.redirect(p) : null;
    if (!hit) throw notFound(); cache(res); res.json(hit);
  }));
  r.get('/ads-txt', wrap(async (req, res) => { const s = await settings.get(); if (!s.ads.adsTxt) throw notFound(); res.type('text/plain').send(s.ads.adsTxt); }));

  r.get('/articles/:slug/comments', wrap(async (req, res) => { const c = await comments.list(req.params.slug); if (!c) throw notFound(); res.json({ comments: c }); }));
  r.post('/articles/:slug/comments', commentLimit, wrap(async (req, res) => { res.status(202).json({ ...(await comments.submit(req.params.slug, req.body)), message: 'Thanks. Your comment will appear once a moderator approves it.' }); }));

  r.post('/newsletter', subscribeLimit, wrap(async (req, res) => { res.status(201).json(await newsletter.subscribe(req.body, req)); }));
  r.get('/newsletter/confirm', wrap(async (req, res) => { await newsletter.confirm(String(req.query.token || '')); res.type('html').send(html('Subscription confirmed', '<h1>You are subscribed</h1><p>Thank you for confirming.</p>')); }));
  // Unsubscribe is a two-step flow (GET shows a button, POST acts) so email-security scanners that prefetch links cannot unsubscribe people.
  r.get('/newsletter/unsubscribe', (req, res) => {
    const t = String(req.query.token || '').replace(/[^\w-]/g, '');
    res.type('html').send(html('Unsubscribe', `<h1>Unsubscribe</h1><p>Stop receiving the newsletter?</p><form method="post" action="/public/newsletter/unsubscribe"><input type="hidden" name="token" value="${t}"><button style="padding:.6rem 1rem">Yes, unsubscribe me</button></form>`));
  });
  r.post('/newsletter/unsubscribe', express.urlencoded({ extended: false }), wrap(async (req, res) => {
    await newsletter.unsubscribe(req.body?.token || req.query.token);
    if ((req.headers.accept || '').includes('application/json')) return res.json({ ok: true });
    return res.type('html').send(html('Unsubscribed', '<h1>You have been unsubscribed</h1><p>You will not receive further emails.</p>'));
  }));
  return r;
}
