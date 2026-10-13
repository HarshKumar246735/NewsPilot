import { CATEGORIES, AUTHORS, buildArticles } from './demoData.js';
import { stripHtml } from '../seo.js';
import { NotFoundError } from '../utils/errors.js';

const PAGE_SIZE = 9;
const strip = ({ contentHtml, flags, tags, isDemo, ...summary }) => summary; // list views never carry the body

export function createDemoSource(config) {
  const all = buildArticles();
  const summaries = all.map(strip);
  const descendants = (slug) => new Set([slug, ...CATEGORIES.filter((c) => c.parentSlug === slug).map((c) => c.slug)]);
  const paginate = (items, page) => {
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    return { items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, total: items.length, totalPages };
  };
  const flagged = (flag) => summaries.filter((_, i) => all[i].flags.includes(flag));
  // Demo "popularity" is a fixed editorial order, not measured data. The real API ranks by tracked views.
  const pick = (idx) => idx.map((i) => summaries[i]).filter(Boolean);
  const popular = pick([6, 0, 4, 12, 9, 13, 2, 8]);
  const mostRead = pick([14, 3, 7, 16, 10, 18]);

  return {
    async shell() {
      return {
        site: {
          name: 'NewsPilot', tagline: 'Navigate the News. Know the World.', url: config.siteUrl,
          description: 'Original news, explainers and practical guides for readers in India and around the world.',
          contact: { email: 'editors@newspilot.example' }, social: {},
        },
        categories: CATEGORIES,
        breaking: summaries.filter((_, i) => all[i].flags.includes('hero2')).slice(0, 2).map((a) => ({ slug: a.slug, title: a.title })),
        isDemo: true,
      };
    },
    async home() {
      const main = flagged('hero')[0] || summaries[0];
      const secondary = flagged('hero2').filter((a) => a.slug !== main.slug).slice(0, 3);
      const used = new Set([main, ...secondary].map((a) => a.slug));
      const rest = summaries.filter((a) => !used.has(a.slug));
      const sectionDefs = [
        ['india', 'India'], ['world', 'World'], ['technology', 'Technology'], ['business', 'Business'], ['education', 'Education'],
        ['sports', 'Sports'], ['entertainment', 'Entertainment'], ['science', 'Science'], ['health', 'Health'],
      ];
      const sections = sectionDefs.map(([slug]) => {
        const ids = descendants(slug);
        return { category: CATEGORIES.find((c) => c.slug === slug), articles: summaries.filter((a) => ids.has(a.category.slug)).slice(0, 4) };
      }).filter((s) => s.articles.length);
      return {
        hero: { main, secondary, latest: rest.slice(0, 5) },
        latest: rest.slice(5, 13), trending: popular.slice(0, 6), editorsPicks: flagged('pick').slice(0, 4),
        sections, mostRead: mostRead.slice(0, 5), guides: flagged('guide').slice(0, 4),
      };
    },
    async article(slug) {
      const i = all.findIndex((a) => a.slug === slug);
      if (i < 0) throw new NotFoundError();
      const article = { ...all[i], author: { ...all[i].author, ...AUTHORS.find((a) => a.slug === all[i].author.slug) } };
      const related = summaries.filter((a) => a.slug !== slug && (a.category.slug === article.category.slug || a.category.parentSlug === article.category.parentSlug && a.category.parentSlug)).slice(0, 3);
      const fill = summaries.filter((a) => a.slug !== slug && !related.includes(a)).slice(0, 3 - related.length);
      return { article, related: [...related, ...fill], prev: summaries[i + 1] || null, next: summaries[i - 1] || null, latest: summaries.slice(0, 4).filter((a) => a.slug !== slug).slice(0, 3) };
    },
    async category(slug, page) {
      const ids = descendants(slug);
      return paginate(summaries.filter((a) => ids.has(a.category.slug)), page);
    },
    async author(slug, page) {
      const author = AUTHORS.find((a) => a.slug === slug);
      if (!author) throw new NotFoundError();
      return { author, ...paginate(summaries.filter((a) => a.author.slug === slug), page) };
    },
    async latest(page) { return paginate(summaries, page); },
    async trending(page) { return paginate(popular, page); },
    async search(q, page) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      const scored = all.map((a, i) => {
        const title = a.title.toLowerCase(), body = `${a.dek} ${stripHtml(a.contentHtml)} ${a.tags.join(' ')}`.toLowerCase();
        let s = 0;
        for (const t of terms) { if (title.includes(t)) s += 5; if (body.includes(t)) s += 1; else if (!title.includes(t)) return null; }
        return { s, a: summaries[i] };
      }).filter(Boolean).sort((x, y) => y.s - x.s).map((x) => x.a);
      return paginate(scored, page);
    },
    async sitemapEntries() {
      const url = (p) => `${config.siteUrl.replace(/\/$/, '')}${p}`;
      return [
        { loc: url('/') },
        ...CATEGORIES.map((c) => ({ loc: url(c.parentSlug ? `/category/${c.parentSlug}/${c.slug}` : `/category/${c.slug}`) })),
        ...AUTHORS.map((a) => ({ loc: url(`/author/${a.slug}`) })),
        ...all.map((a) => ({ loc: url(`/article/${a.slug}`), lastmod: a.updatedAt })),
      ];
    },
  };
}
