const PAGE = 12;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createPublicService({ store, settings, articles, clock }) {
  const A = store.col('articles'), C = store.col('categories'), AU = store.col('authors'), R = store.col('redirects'), ADS = store.col('ads');
  const nowIso = () => clock().toISOString();
  let lastDue = 0;
  // Public reads first flip any due scheduled posts live (throttled), so correctness never depends on a timer being awake.
  async function fresh() { const t = clock().getTime(); if (t - lastDue > 15_000) { lastDue = t; await articles.publishDue(); } }
  const pub = (extra = {}) => ({ status: 'published', publishedAt: { $lte: nowIso() }, ...extra });

  async function ctx() {
    const [cats, authors] = await Promise.all([C.find({}), AU.find({})]);
    return { cats: new Map(cats.map((c) => [c.slug, c])), authors: new Map(authors.map((a) => [a.slug, a])), catList: cats };
  }
  const catRef = (x, slug) => { const c = x.cats.get(slug); return c ? { slug: c.slug, name: c.name, parentSlug: c.parentSlug || null } : { slug: slug || 'uncategorized', name: 'News', parentSlug: null }; };
  const authorRef = (x, slug, full) => { const a = x.authors.get(slug); return a ? (full ? { slug: a.slug, name: a.name, bio: a.bio || '' } : { slug: a.slug, name: a.name }) : null; };

  function summary(a, x) {
    return {
      id: a.id, slug: a.slug, title: a.title, dek: a.dek || '', excerpt: a.excerpt || '', category: catRef(x, a.categorySlug), author: authorRef(x, a.authorSlug),
      publishedAt: a.publishedAt, updatedAt: a.updatedAt, readingMinutes: a.readingMinutes || 1, image: a.image?.url ? a.image : null,
      
    };
  }
  const paginate = async (filter, sort, page, x) => {
    const total = await A.count(filter);
    const rows = await A.find(filter, { sort, skip: (page - 1) * PAGE, limit: PAGE });
    return { items: rows.map((a) => summary(a, x)), page, total, totalPages: Math.max(1, Math.ceil(total / PAGE)) };
  };
  const byIds = async (ids = [], x) => {
    if (!ids.length) return [];
    const rows = await A.find(pub({ id: { $in: ids } }));
    return ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean).map((a) => summary(a, x));
  };
  async function categoryFamily(slug, x) { return [slug, ...x.catList.filter((c) => c.parentSlug === slug).map((c) => c.slug)]; }

  return {
    PAGE,
    async shell() {
      const [s, x, ads, breaking] = await Promise.all([settings.get(), ctx(), ADS.find({ enabled: true }), A.find(pub({ isBreaking: true }), { sort: { publishedAt: -1 }, limit: 8 })]);
      const live = breaking.filter((b) => !b.breakingUntil || b.breakingUntil > nowIso()).slice(0, 5);
      const placements = {};
      for (const ad of ads) if (s.ads.enabled || ad.type === 'banner') placements[ad.placement] = ad.type === 'adsense' ? { type: 'adsense', slot: ad.slot } : { type: 'banner', image: ad.imageUrl, link: ad.linkUrl, alt: ad.alt || ad.name, sponsor: ad.name };
      return {
        site: { name: s.name, tagline: s.tagline, url: s.url, description: s.description, contact: { email: s.contact.email }, social: Object.fromEntries(Object.entries(s.social).filter(([, v]) => v)), logoUrl: s.logoUrl || undefined, searchConsoleVerification: s.searchConsoleVerification || undefined, adsenseClient: s.ads.enabled ? s.ads.adsenseClient || undefined : undefined, ga4Id: s.analytics.ga4Id || undefined, commentsEnabled: !!s.comments.enabled },
        categories: x.catList.filter((c) => c.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => ({ slug: c.slug, name: c.name, parentSlug: c.parentSlug || null, primary: !!c.primary, description: c.description || '', seoTitle: c.seoTitle || '', seoDescription: c.seoDescription || '', order: c.order ?? 0 })),
        breaking: live.map((b) => ({ slug: b.slug, title: b.title })),
        ads: placements,
      };
    },

    async home() {
      await fresh();
      const [s, x] = await Promise.all([settings.get(), ctx()]);
      const recent = (await A.find(pub(), { sort: { publishedAt: -1 }, limit: 60 })).map((a) => ({ a, s: summary(a, x) }));
      if (!recent.length) return { hero: null, latest: [], trending: [], editorsPicks: [], sections: [], mostRead: [], guides: [] };
      const hp = s.homepage;
      const chosen = (await byIds([hp.heroId, ...hp.secondaryIds].filter(Boolean), x));
      const heroMain = chosen.find((c) => c.id === hp.heroId) || (recent.find((r) => r.a.isFeatured) || recent[0]).s;
      const used = new Set([heroMain.slug]);
      let secondary = chosen.filter((c) => c.id !== heroMain.id && hp.secondaryIds.includes(c.id)).slice(0, 3);
      if (!secondary.length) secondary = recent.filter((r) => r.a.isFeatured && !used.has(r.s.slug)).map((r) => r.s).slice(0, 3);
      if (secondary.length < 2) secondary = [...secondary, ...recent.map((r) => r.s).filter((a) => a.slug !== heroMain.slug && !secondary.some((q) => q.slug === a.slug))].slice(0, 2);
      secondary.forEach((a) => used.add(a.slug));
      const rest = recent.map((r) => r.s).filter((a) => !used.has(a.slug));
      const heroLatest = rest.slice(0, 5); heroLatest.forEach((a) => used.add(a.slug));
      const latest = rest.slice(5, 13);
      const since = new Date(clock().getTime() - 14 * 864e5).toISOString();
      const viewed = await A.find(pub({ views: { $gt: 0 }, publishedAt: { $gte: since, $lte: nowIso() } }), { sort: { views: -1 }, limit: 6 });
      const trending = hp.trendingIds.length ? await byIds(hp.trendingIds, x) : viewed.map((a) => summary(a, x));
      const most = await A.find(pub({ views: { $gt: 0 } }), { sort: { views: -1 }, limit: 5 });
      const mostRead = most.map((a) => summary(a, x)).filter((a) => !trending.slice(0, 3).some((t) => t.slug === a.slug) || most.length <= 3);
      const defs = hp.sections.length ? hp.sections.filter((q) => q.enabled !== false).map((q) => q.categorySlug) : x.catList.filter((c) => !c.parentSlug && c.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => c.slug);
      const sections = [];
      for (const slug of defs) {
        if (sections.length >= 8) break;
        const cat = x.cats.get(slug); if (!cat) continue;
        const rows = await A.find(pub({ categorySlug: { $in: await categoryFamily(slug, x) } }), { sort: { publishedAt: -1 }, limit: 8 });
        const arts = rows.map((a) => summary(a, x)).filter((a) => !used.has(a.slug)).slice(0, 4);
        if (arts.length) sections.push({ category: { slug: cat.slug, name: cat.name, parentSlug: cat.parentSlug || null, description: cat.description || '' }, articles: arts });
      }
      const guides = (await A.find(pub({ tags: 'guide' }), { sort: { publishedAt: -1 }, limit: 4 })).map((a) => summary(a, x));
      return { hero: { main: heroMain, secondary, latest: heroLatest }, latest, trending, editorsPicks: await byIds(hp.pickIds, x), sections, mostRead, guides };
    },

    async article(slug) {
      await fresh();
      const x = await ctx();
      const a = await A.findOne(pub({ slug }));
      if (!a) {
        const r = await R.findOne({ from: `/article/${slug}` });
        if (r) return { redirect: r.to };
        return null;
      }
      const s = await settings.get();
      const related = await A.find(pub({ id: { $ne: a.id }, $or: [{ categorySlug: a.categorySlug }, ...(a.tags?.length ? [{ tags: { $in: a.tags } }] : [])] }), { sort: { publishedAt: -1 }, limit: 3 });
      const prev = (await A.find(pub({ publishedAt: { $lt: a.publishedAt, $lte: nowIso() } }), { sort: { publishedAt: -1 }, limit: 1 }))[0];
      const next = (await A.find({ status: 'published', publishedAt: { $gt: a.publishedAt, $lte: nowIso() } }, { sort: { publishedAt: 1 }, limit: 1 }))[0];
      const latest = (await A.find(pub({ id: { $ne: a.id } }), { sort: { publishedAt: -1 }, limit: 3 })).map((q) => summary(q, x));
      const full = { ...summary(a, x), contentHtml: a.contentHtml, tags: a.tags || [], seoTitle: a.seoTitle || undefined, metaDescription: a.metaDescription || undefined, canonicalUrl: a.canonicalUrl || undefined, isNews: !!a.isNews, commentsEnabled: !!a.commentsEnabled && !!s.comments.enabled, hasAffiliateLinks: !!a.hasAffiliateLinks, sources: a.sources || [], author: authorRef(x, a.authorSlug, true) };
      return { article: full, related: related.map((q) => summary(q, x)), prev: prev ? summary(prev, x) : null, next: next ? summary(next, x) : null, latest };
    },

    async category(slug, page) { await fresh(); const x = await ctx(); return paginate(pub({ categorySlug: { $in: await categoryFamily(slug, x) } }), { publishedAt: -1 }, page, x); },
    async author(slug, page) { await fresh(); const x = await ctx(); const au = x.authors.get(slug); if (!au) return null; return { author: { slug: au.slug, name: au.name, bio: au.bio || '' }, ...(await paginate(pub({ authorSlug: slug }), { publishedAt: -1 }, page, x)) }; },
    async latest(page) { await fresh(); return paginate(pub(), { publishedAt: -1 }, page, await ctx()); },
    async trending(page) { await fresh(); return paginate(pub({ views: { $gt: 0 } }), { views: -1 }, page, await ctx()); },

    async search(q, page) {
      await fresh();
      const x = await ctx();
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
      const rows = await A.find(pub({ $and: terms.map((t) => ({ searchText: { $regex: esc(t), $options: 'i' } })) }), { sort: { publishedAt: -1 }, limit: 200 });
      const score = (a) => terms.reduce((n, t) => n + (a.title.toLowerCase().includes(t) ? 5 : 0) + ((a.tags || []).some((g) => g.toLowerCase() === t) ? 3 : 0), 0);
      const ranked = rows.sort((a, b) => score(b) - score(a) || (a.publishedAt < b.publishedAt ? 1 : -1));
      return { items: ranked.slice((page - 1) * PAGE, page * PAGE).map((a) => summary(a, x)), page, total: ranked.length, totalPages: Math.max(1, Math.ceil(ranked.length / PAGE)) };
    },

    async recordView(slug) { const a = await A.findOne(pub({ slug })); if (a) await A.inc(a.id, 'views', 1); return !!a; },
    async redirect(path) { const r = await R.findOne({ from: path }); return r ? { to: r.to, status: r.status || 301 } : null; },

    // Indexable URLs only: published articles, categories and authors that have content. No drafts, no private pages.
    async sitemapEntries() {
      await fresh();
      const x = await ctx();
      const arts = await A.find(pub(), { sort: { publishedAt: -1 } });
      const catCount = new Set(arts.map((a) => a.categorySlug));
      for (const c of x.catList) if (c.parentSlug && catCount.has(c.slug)) catCount.add(c.parentSlug);
      const authorSet = new Set(arts.map((a) => a.authorSlug));
      const lastmod = arts[0]?.updatedAt;
      return [
        { path: '/', lastmod },
        ...x.catList.filter((c) => c.enabled !== false && catCount.has(c.slug)).map((c) => ({ path: c.parentSlug ? `/category/${c.parentSlug}/${c.slug}` : `/category/${c.slug}` })),
        ...[...authorSet].filter((s) => x.authors.has(s)).map((s) => ({ path: `/author/${s}` })),
        ...arts.map((a) => ({ path: `/article/${a.slug}`, lastmod: a.updatedAt })),
        
      ];
    },
  };
}
