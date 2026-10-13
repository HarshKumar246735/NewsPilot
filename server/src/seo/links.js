import { suggestKeywords } from './keywords.js';
import { stripHtml } from './text.js';

// Suggests existing published articles worth linking to, by overlap of the draft's own extracted terms with each
// candidate's title/tags/excerpt. Only real, published articles are ever returned; nothing is inserted automatically.
export function suggestInternalLinks(draft, candidates, { limit = 5, siteUrl } = {}) {
  const kw = suggestKeywords(draft, { limit: 12 });
  const terms = [kw.primary, ...kw.secondary].filter(Boolean).flatMap((t) => t.split(' ')).filter((t) => t.length > 3);
  const uniq = [...new Set(terms)];
  if (!uniq.length) return [];
  const alreadyLinked = new Set([...(draft.contentHtml || '').matchAll(/href="([^"]+)"/g)].map((m) => m[1]));
  return candidates
    .filter((c) => c.slug !== draft.slug && c.id !== draft.id)
    .map((c) => {
      const hay = `${c.title} ${(c.tags || []).join(' ')} ${c.excerpt || ''} ${stripHtml(c.contentHtml || '').slice(0, 600)}`.toLowerCase();
      const titleHay = c.title.toLowerCase();
      const hits = uniq.filter((t) => hay.includes(t));
      const score = hits.length + uniq.filter((t) => titleHay.includes(t)).length * 2 + (c.categorySlug && c.categorySlug === draft.categorySlug ? 1 : 0);
      return { c, hits, score };
    })
    .filter((x) => x.hits.length >= 1 && x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ c, hits }) => ({ id: c.id, title: c.title, path: `/article/${c.slug}`, url: siteUrl ? `${siteUrl.replace(/\/$/, '')}/article/${c.slug}` : undefined, matchedTerms: hits.slice(0, 4), alreadyLinked: alreadyLinked.has(`/article/${c.slug}`) }));
}
