import { HttpError, notFound } from '../lib/http.js';
import { validate } from '../lib/validate.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { sanitizeText } from '../lib/sanitize.js';

const CONSENT_VERSION = 'newsletter-v1';

export function createNewsletter({ store, settings, mailer, config, clock }) {
  const S = store.col('subscribers');
  const link = (req, p) => `${config.publicApiUrl || `${req.protocol || 'https'}://${req.headers?.host || ''}`}${p}`;
  return {
    async subscribe(input, req) {
      const s = await settings.get();
      if (!s.newsletter.enabled) throw new HttpError(503, 'The newsletter is not accepting signups right now');
      const d = validate(input, { email: { type: 'email', required: true, max: 254 }, consent: { type: 'boolean', required: true } });
      if (d.consent !== true) throw new HttpError(422, 'Validation failed', { fields: { consent: 'Consent is required to subscribe' } });
      const existing = await S.findOne({ email: d.email });
      const double = s.newsletter.doubleOptIn && mailer.enabled;
      const status = double ? 'pending' : 'subscribed';
      const now = clock().toISOString();
      const consent = { at: now, text: CONSENT_VERSION, ipHash: sha256(`${req.ip}|${config.jwtSecret}`).slice(0, 24) };
      let row = existing;
      if (!existing) row = await S.insert({ email: d.email, status, token: randomToken(18), createdAt: now, consent });
      else if (existing.status === 'unsubscribed') row = await S.update(existing.id, { status, consent, resubscribedAt: now });
      if (double && row.status === 'pending') {
        const r = await mailer.send({ to: d.email, subject: 'Confirm your subscription', html: `<p>Please confirm your subscription:</p><p><a href="${link(req, `/public/newsletter/confirm?token=${row.token}`)}">Confirm subscription</a></p><p>If you didn't ask for this, ignore this email.</p>` });
        if (!r.sent) throw new HttpError(502, 'We could not send the confirmation email. Please try again later.');
        return { status: 'pending', message: 'Thanks. Check your inbox to confirm your subscription.' };
      }
      // Identical response for new and existing subscribers, so the form cannot be used to discover who is subscribed.
      return { status: 'subscribed', message: 'You are subscribed. Thank you.' };
    },
    async confirm(token) { const r = await S.findOne({ token }); if (!r) throw notFound('This link is not valid'); if (r.status === 'pending') await S.update(r.id, { status: 'subscribed', confirmedAt: clock().toISOString() }); return true; },
    async unsubscribe(token) { const r = await S.findOne({ token: String(token || '') }); if (!r) throw notFound('This link is not valid'); await S.update(r.id, { status: 'unsubscribed', unsubscribedAt: clock().toISOString() }); return true; },
    list: (filter = {}, opts = {}) => S.find(filter, { sort: { createdAt: -1 }, ...opts }),
    count: (f = {}) => S.count(f),
    remove: (id) => S.remove(id),
  };
}

export function createComments({ store, settings, clock }) {
  const CM = store.col('comments'), A = store.col('articles');
  return {
    async list(slug) {
      const a = await A.findOne({ slug, status: 'published' });
      if (!a) return null;
      const rows = await CM.find({ articleId: a.id, status: 'approved' }, { sort: { createdAt: 1 }, limit: 200 });
      return rows.map((c) => ({ id: c.id, name: c.name, body: c.body, createdAt: c.createdAt }));
    },
    async submit(slug, input) {
      const s = await settings.get();
      const a = await A.findOne({ slug, status: 'published', publishedAt: { $lte: clock().toISOString() } });
      if (!a) throw notFound('Article not found');
      if (!s.comments.enabled || !a.commentsEnabled) throw new HttpError(403, 'Comments are closed on this article');
      const d = validate(input, { name: { type: 'string', required: true, max: 60 }, email: { type: 'email', max: 254 }, body: { type: 'string', required: true, min: 3, max: 2000 }, website: { type: 'string', max: 200 } });
      if (d.website) return { status: 'pending' }; // honeypot: real people never see or fill this field; bots get a fake success
      const body = sanitizeText(d.body, 2000);
      const links = (body.match(/https?:\/\//gi) || []).length;
      const status = links > 2 ? 'spam' : 'pending';
      await CM.insert({ articleId: a.id, articleSlug: a.slug, articleTitle: a.title, name: sanitizeText(d.name, 60), email: d.email || '', body, status, createdAt: clock().toISOString() });
      return { status: 'pending' };
    },
  };
}
