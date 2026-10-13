import { validate } from '../lib/validate.js';
import { sanitizeHtml } from '../lib/sanitize.js';
import { HttpError, notFound, forbidden, conflict } from '../lib/http.js';
import {
  isValidSlug, uniqueSlug, stripHtml, truncate, readingMinutes, buildSeoTitle, buildMetaDescription,
  absoluteUrl, articlePath, suggestKeywords, seoChecklist, articleJsonLd, suggestInternalLinks,
} from '../seo/index.js';

const imageUrl = { type: 'string', max: 1000, pattern: /^(https:\/\/|\/uploads\/)/, patternMessage: 'Image URL must be https or an uploaded file' };
export const ARTICLE_RULES = {
  title: { type: 'string', required: true, max: 200 }, slug: { type: 'string', max: 100 }, dek: { type: 'string', max: 300 }, excerpt: { type: 'string', max: 400 },
  contentHtml: { type: 'string', max: 600000 },
  image: { type: 'object', nullable: true, shape: { url: imageUrl, alt: { type: 'string', max: 300 }, caption: { type: 'string', max: 400 }, credit: { type: 'string', max: 150 }, width: { type: 'number', min: 1, max: 20000, int: true }, height: { type: 'number', min: 1, max: 20000, int: true }, publicId: { type: 'string', max: 300 } } },
  categorySlug: { type: 'string', max: 100 }, tags: { type: 'array', max: 15, items: { type: 'string', max: 40 } }, authorSlug: { type: 'string', max: 100 },
  seoTitle: { type: 'string', max: 120 }, metaDescription: { type: 'string', max: 320 }, canonicalUrl: { type: 'url', max: 500 },
  isFeatured: { type: 'boolean' }, isBreaking: { type: 'boolean' }, breakingUntil: { type: 'date', nullable: true }, isNews: { type: 'boolean' },
  commentsEnabled: { type: 'boolean' }, sponsoredBy: { type: 'string', max: 120 }, hasAffiliateLinks: { type: 'boolean' },
  sources: { type: 'array', max: 20, items: { type: 'string', max: 500 } },
};

export const isPublishedNow = (a, now) => a.status === 'published' && a.publishedAt <= now;

export function createArticleService({ store, settings, audit, clock }) {
  const A = store.col('articles'), C = store.col('categories'), AU = store.col('authors'), R = store.col('redirects');
  const iso = () => clock().toISOString();

  async function derived(doc) {
    const html = sanitizeHtml(doc.contentHtml || '');
    const text = stripHtml(html);
    return {
      contentHtml: html,
      excerpt: doc.excerpt?.trim() || truncate(doc.dek || text, 200),
      readingMinutes: readingMinutes(html),
      searchText: `${doc.title} ${doc.dek || ''} ${(doc.tags || []).join(' ')} ${text}`.toLowerCase().slice(0, 20000),
      suggestedKeywords: suggestKeywords({ title: doc.title, excerpt: doc.excerpt, headings: [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g)].map((m) => stripHtml(m[1])), contentHtml: html }, { limit: 8 }),
    };
  }

  async function assertRefs(d) {
    if (d.categorySlug && !(await C.findOne({ slug: d.categorySlug }))) throw new HttpError(422, 'Validation failed', { fields: { categorySlug: 'That category does not exist' } });
    if (d.authorSlug && !(await AU.findOne({ slug: d.authorSlug }))) throw new HttpError(422, 'Validation failed', { fields: { authorSlug: 'That author does not exist' } });
  }

  async function get(id) { const a = await A.findOne({ id }); if (!a) throw notFound('Article not found'); return a; }

  function assertCanEdit(user, a) {
    // Once submitted for review the piece belongs to the editor; they can send it back to draft to request changes.
    if (user.role === 'author' && (a.createdBy !== user.id || a.status !== 'draft')) throw forbidden('Authors can only edit their own drafts');
  }

  async function redirectSlugChange(oldSlug, newSlug) {
    const from = articlePath(oldSlug), to = articlePath(newSlug);
    await R.removeMany({ from: to }); // a redirect pointing away from the new URL would loop
    for (const r of await R.find({ to: from })) await R.update(r.id, { to }); // collapse chains: a -> b -> c becomes a -> c
    if (!(await R.findOne({ from }))) await R.insert({ from, to, status: 301, auto: true, createdAt: iso() });
  }

  const service = {
    get,
    async create(input, user) {
      const d = validate(input, ARTICLE_RULES);
      await assertRefs(d);
      let slug;
      if (d.slug) {
        if (!isValidSlug(d.slug)) throw new HttpError(422, 'Validation failed', { fields: { slug: 'Invalid or reserved slug' } });
        if (await A.findOne({ slug: d.slug })) throw conflict('That URL slug is already used by another article', { field: 'slug' });
        slug = d.slug;
      } else slug = await uniqueSlug(d.title, async (s) => !!(await A.findOne({ slug: s })));
      const author = d.authorSlug ? null : await AU.findOne({ userId: user.id });
      const now = iso();
      const doc = {
        tags: [], isFeatured: false, isBreaking: false, isNews: false, commentsEnabled: true, views: 0, ...d, slug,
        ...(author && { authorSlug: author.slug }), ...(await derived(d)),
        status: 'draft', createdBy: user.id, createdAt: now, updatedAt: now, publishedAt: null,
      };
      if (user.role === 'author') { doc.isFeatured = false; doc.isBreaking = false; }
      const row = await A.insert(doc);
      await audit.log(user, 'article.create', 'article', row.id, row.title);
      return row;
    },

    async update(id, input, user) {
      const a = await get(id);
      assertCanEdit(user, a);
      const d = validate(input, ARTICLE_RULES, { partial: true });
      if (user.role === 'author') { delete d.isFeatured; delete d.isBreaking; delete d.canonicalUrl; }
      await assertRefs(d);
      if (d.slug && d.slug !== a.slug) {
        if (!isValidSlug(d.slug)) throw new HttpError(422, 'Validation failed', { fields: { slug: 'Invalid or reserved slug' } });
        if (await A.findOne({ slug: d.slug })) throw conflict('That URL slug is already used by another article', { field: 'slug' });
      }
      const merged = { ...a, ...d };
      const patch = { ...d, ...(await derived(merged)), updatedAt: iso() };
      const row = await A.update(id, patch);
      if (d.slug && d.slug !== a.slug && (a.status === 'published' || a.status === 'scheduled' || a.status === 'archived')) await redirectSlugChange(a.slug, d.slug);
      await audit.log(user, 'article.update', 'article', id, row.title);
      return row;
    },

    // action: publish | schedule | unpublish | archive | trash | restore | review
    async transition(id, action, { publishedAt } = {}, user) {
      const a = await get(id);
      const now = clock();
      if (user.role === 'author') {
        if (action !== 'review' || a.createdBy !== user.id || a.status !== 'draft') throw forbidden('Authors can submit their own drafts for review but cannot publish');
        const row = await A.update(id, { status: 'review', updatedAt: now.toISOString() });
        await audit.log(user, 'article.review', 'article', id, a.title);
        return { article: row, warnings: [] };
      }
      let patch, warnings = [];
      switch (action) {
        case 'publish': case 'schedule': {
          const problems = {};
          if (!a.title?.trim()) problems.title = 'A headline is required';
          if (!stripHtml(a.contentHtml || '')) problems.contentHtml = 'The article body is empty';
          if (!a.categorySlug) problems.categorySlug = 'Choose a category';
          if (!a.authorSlug) problems.authorSlug = 'Choose an author';
          if (!isValidSlug(a.slug)) problems.slug = 'The URL slug is invalid';
          if (Object.keys(problems).length) throw new HttpError(422, 'This article cannot be published yet', { fields: problems });
          let when = publishedAt ? new Date(publishedAt) : null;
          if (when && Number.isNaN(when.getTime())) throw new HttpError(422, 'Validation failed', { fields: { publishedAt: 'Enter a valid date' } });
          if (action === 'schedule' && (!when || when <= now)) throw new HttpError(422, 'Validation failed', { fields: { publishedAt: 'Pick a time in the future to schedule' } });
          when = when || (a.status === 'published' && a.publishedAt ? new Date(a.publishedAt) : now);
          patch = when > now ? { status: 'scheduled', publishedAt: when.toISOString() } : { status: 'published', publishedAt: when.toISOString() };
          const s = await settings.get();
          warnings = seoChecklist({ ...a, ...patch, autoDescription: buildMetaDescription({ metaDescription: a.metaDescription, excerpt: a.excerpt, contentHtml: a.contentHtml }) }).items.filter((i) => i.status === 'attention');
          void s; break;
        }
        case 'unpublish': patch = { status: 'draft' }; break;
        case 'archive': patch = { status: 'archived' }; break;
        case 'trash': patch = { status: 'trashed', trashedAt: now.toISOString(), statusBeforeTrash: a.status }; break;
        case 'restore': patch = { status: a.status === 'trashed' ? 'draft' : a.status, trashedAt: null }; break;
        case 'review': patch = { status: 'review' }; break;
        default: throw new HttpError(400, 'Unknown action');
      }
      const row = await A.update(id, { ...patch, updatedAt: now.toISOString() });
      await audit.log(user, `article.${action}`, 'article', id, a.title);
      return { article: row, warnings };
    },

    async remove(id, user) {
      const a = await get(id);
      if (a.status !== 'trashed') throw new HttpError(409, 'Move the article to the trash before deleting it permanently');
      await A.remove(id);
      await audit.log(user, 'article.delete', 'article', id, a.title);
    },

    // Called on a timer and lazily before public reads, so scheduled posts go live even after a sleeping host wakes.
    async publishDue() {
      const due = await A.find({ status: 'scheduled', publishedAt: { $lte: iso() } });
      for (const a of due) { await A.update(a.id, { status: 'published', updatedAt: iso() }); await audit.log(null, 'article.autopublish', 'article', a.id, a.title); }
      return due.length;
    },

    // Everything the SEO panel shows, computed from the draft with the shared SEO engine.
    async analyze(input, user) {
      const s = await settings.get();
      const site = { name: s.name, url: s.url, logoUrl: s.logoUrl };
      const d = validate(input, { ...ARTICLE_RULES, title: { type: 'string', max: 200 }, id: { type: 'string', max: 60 } }, { partial: true });
      const html = sanitizeHtml(d.contentHtml || '');
      const title = d.title || '';
      const slugFree = async (sl) => !(await A.findOne({ slug: sl, ...(d.id ? { id: { $ne: d.id } } : {}) }));
      const suggestedSlug = title ? await uniqueSlug(title, async (x) => !(await slugFree(x))) : '';
      const autoTitle = title ? buildSeoTitle({ title, siteName: site.name }) : '';
      const autoDesc = buildMetaDescription({ excerpt: d.excerpt || d.dek, contentHtml: html });
      const seoTitle = d.seoTitle || autoTitle, metaDescription = d.metaDescription || autoDesc;
      const slug = d.slug || suggestedSlug;
      const published = await A.find({ status: 'published', publishedAt: { $lte: iso() } }, { sort: { publishedAt: -1 }, limit: 300 });
      const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g)].map((m) => stripHtml(m[1]));
      const draft = { ...d, id: d.id, slug, contentHtml: html };
      const keywords = suggestKeywords({ title, excerpt: d.excerpt || d.dek, headings, contentHtml: html }, { limit: 10 });
      const canonical = d.canonicalUrl || (s.url && slug ? absoluteUrl(s.url, articlePath(slug)) : '');
      const when = new Date().toISOString();
      const jsonLd = title && s.url && slug ? articleJsonLd({ article: { ...d, slug, title, publishedAt: when, updatedAt: when, featuredImage: d.image?.url ? { ...d.image, url: /^https?:/.test(d.image.url) ? d.image.url : absoluteUrl(s.url, d.image.url) } : undefined, isNews: !!d.isNews }, author: undefined, category: undefined, site, seoDescription: metaDescription }) : null;
      return {
        seoTitle: { value: seoTitle, generated: !d.seoTitle, length: seoTitle.length, recommendedMax: 60 },
        metaDescription: { value: metaDescription, generated: !d.metaDescription, length: metaDescription.length, recommendedMax: 155 },
        slug: { value: slug, suggested: suggestedSlug, valid: isValidSlug(slug), available: slug ? await slugFree(slug) : true },
        canonical,
        keywords,
        checklist: seoChecklist({ ...draft, seoTitle, metaDescription: d.metaDescription, autoDescription: autoDesc, publishedAt: when }),
        internalLinks: suggestInternalLinks(draft, published, { siteUrl: s.url }),
        jsonLd,
        searchPreview: { title: seoTitle, url: canonical || '(set the production site URL in Settings)', description: metaDescription },
        social: { title: d.ogTitle || title, description: metaDescription, image: d.image?.url || s.defaultImage || '', domain: s.url ? new URL(s.url).hostname : '' },
        altSuggestion: d.image?.url && !d.image.alt ? { text: title ? `Image accompanying: ${title}` : '', note: 'A starting point only. Describe what the image actually shows before saving.' } : null,
        notes: ['Suggestions are generated from this article\u2019s own text. They are not search-volume or ranking data.', 'The checklist is an internal guide and does not predict Google rankings.'],
      };
    },
  };
  return service;
}
