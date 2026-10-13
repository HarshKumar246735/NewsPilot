// Dependency-free text helpers used by the SEO engine.
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

export function stripHtml(html = '') {
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(text = '') {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function readingMinutes(html = '', wpm = 220) {
  return Math.max(1, Math.ceil(wordCount(stripHtml(html)) / wpm));
}

// Cut at a word boundary, never mid-word; add an ellipsis only if truncated.
export function truncate(text = '', max = 155) {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/, '') + '…';
}
