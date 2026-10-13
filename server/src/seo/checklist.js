import { stripHtml, wordCount } from './text.js';
import { isValidSlug } from './slug.js';
import { LIMITS } from './meta.js';

const PASS = 'passed', WARN = 'attention', OPT = 'optional';

// Internal checklist only. It does not predict Google rankings, and no keyword-density rule is applied.
export function seoChecklist(a) {
  const text = stripHtml(a.contentHtml || '');
  const words = wordCount(text);
  const h1InBody = (a.contentHtml?.match(/<h1[\s>]/gi) || []).length;
  const headings = [...(a.contentHtml || '').matchAll(/<h([1-6])[\s>]/gi)].map((m) => +m[1]);
  const skipsLevel = headings.some((lvl, i) => i > 0 && lvl - headings[i - 1] > 1);
  const desc = a.metaDescription || a.autoDescription || '';
  const imgs = [...(a.contentHtml || '').matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const missingAlt = imgs.filter((t) => !/\balt=("[^"]+"|'[^']+')/i.test(t)).length;
  const internalLinks = (a.contentHtml?.match(/href=["'](\/|https?:\/\/[^"']*newspilot)/gi) || []).length;

  const items = [
    { id: 'title', label: 'Headline is present', status: a.title?.trim() ? PASS : WARN },
    { id: 'content', label: 'Article has body content', status: words >= 150 ? PASS : WARN, detail: `${words} words` },
    { id: 'slug', label: 'URL slug is valid', status: isValidSlug(a.slug || '') ? PASS : WARN },
    { id: 'seoTitle', label: `Search title is ${LIMITS.title} characters or fewer`, status: (a.seoTitle || a.title || '').length <= LIMITS.title + 5 ? PASS : WARN },
    { id: 'desc', label: 'Meta description is present', status: desc ? PASS : WARN },
    { id: 'descLen', label: `Meta description is under ${LIMITS.description} characters`, status: desc.length <= LIMITS.description ? PASS : OPT },
    { id: 'image', label: 'Featured image is set', status: a.featuredImage?.url ? PASS : WARN },
    { id: 'alt', label: 'Featured image has alt text', status: a.featuredImage?.alt?.trim() ? PASS : a.featuredImage?.url ? WARN : OPT },
    { id: 'bodyAlt', label: 'Images in the body have alt text', status: missingAlt ? WARN : PASS, detail: missingAlt ? `${missingAlt} missing` : undefined },
    { id: 'h1', label: 'Body has no extra H1 (the headline is the H1)', status: h1InBody ? WARN : PASS },
    { id: 'headings', label: 'Headings follow a logical order', status: skipsLevel ? OPT : PASS },
    { id: 'links', label: 'Links to other NewsPilot articles', status: internalLinks ? PASS : OPT },
    { id: 'date', label: 'Publication date is valid', status: a.publishedAt && !Number.isNaN(new Date(a.publishedAt)) ? PASS : WARN },
  ];
  const passed = items.filter((i) => i.status === PASS).length;
  return {
    items,
    summary: { passed, attention: items.filter((i) => i.status === WARN).length, optional: items.filter((i) => i.status === OPT).length, total: items.length },
    note: 'Internal checklist only; it does not predict Google ranking.',
  };
}
