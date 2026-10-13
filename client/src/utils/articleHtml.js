import { slugify, stripHtml } from '../seo.js';

// Input is HTML already sanitized by the API on save. This only adds heading ids (for the table of
// contents and deep links) and lazy-loading hints to inline images.
export function prepareArticleHtml(html = '') {
  const used = new Set();
  const toc = [];
  const out = html
    .replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_m, level, attrs, inner) => {
      const text = stripHtml(inner);
      const existing = /\sid=["']([^"']+)["']/.exec(attrs)?.[1];
      const base = existing || slugify(text) || 'section';
      let id = base;
      for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
      used.add(id);
      toc.push({ id, text, level: Number(level) });
      return `<h${level}${existing ? attrs : `${attrs} id="${id}"`}>${inner}</h${level}>`;
    })
    .replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"');
  return { html: out, toc };
}
