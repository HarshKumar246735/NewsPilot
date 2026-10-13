import { stripHtml } from './text.js';

const STOP = new Set(('a an and are as at be but by for from has have he her his how i in is it its of on or our she that the their ' +
  'them they this to was we were what when where which who will with you your not can also more most than then there these those ' +
  'about after all into over such only other new says said just like get gets one two may might would could should been being do does').split(' '));

function tokens(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

function ngrams(words, n) {
  const out = [];
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n);
    if (gram.some((w) => STOP.has(w))) continue;
    out.push(gram.join(' '));
  }
  return out;
}

// Lightweight, deterministic term extraction from the article's own text.
// These are *suggestions drawn from the content*, not search-volume data.
export function suggestKeywords({ title = '', excerpt = '', headings = [], contentHtml = '' }, { limit = 8 } = {}) {
  const body = stripHtml(contentHtml);
  const weighted = [
    [title, 5], [headings.join('. '), 3], [excerpt, 2], [body, 1],
  ];
  const scores = new Map();
  for (const [text, weight] of weighted) {
    const words = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(Boolean);
    const clean = tokens(text);
    for (const g of [...ngrams(words, 2), ...ngrams(words, 3)]) {
      if (g.split(' ').every((w) => w.length > 2 && !/^\d+$/.test(w))) scores.set(g, (scores.get(g) || 0) + weight * 2);
    }
    for (const w of clean) scores.set(w, (scores.get(w) || 0) + weight);
  }
  // A phrase must appear at least twice overall (or be in the title) to be suggested.
  const titleLower = title.toLowerCase();
  const ranked = [...scores.entries()]
    .filter(([term, s]) => s >= 4 || titleLower.includes(term))
    .sort((a, b) => b[1] - a[1] || b[0].split(' ').length - a[0].split(' ').length);

  const picked = [];
  for (const [term] of ranked) {
    if (picked.some((p) => p.includes(term) || term.includes(p))) continue; // drop overlaps
    picked.push(term);
    if (picked.length >= limit) break;
  }
  const [primary, ...secondary] = picked;
  return {
    primary: primary || null,
    secondary,
    longTail: picked.filter((t) => t.split(' ').length >= 3),
    note: 'Suggestions are extracted from this article\'s text. They are not search-volume or ranking data.',
  };
}
