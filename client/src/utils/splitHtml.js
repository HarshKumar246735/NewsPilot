// Splits sanitized article HTML after the Nth top-level block so an ad can sit between two parts without ever cutting
// inside a list, table, quote or figure. Returns [html] when the article is too short to carry an in-article ad.
const VOID = new Set(['br', 'hr', 'img']);
export function splitAfterBlocks(html, n = 3, minBlocks = 6) {
  let depth = 0, blocks = 0, cut = -1;
  const total = (() => { let d = 0, c = 0; for (const m of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>/gi)) { const t = m[2].toLowerCase(); if (VOID.has(t)) { if (d === 0) c++; continue; } if (m[1]) { d--; if (d === 0) c++; } else d++; } return c; })();
  if (total < minBlocks) return [html];
  for (const m of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>/gi)) {
    const t = m[2].toLowerCase();
    if (VOID.has(t)) { if (depth === 0) { blocks++; if (blocks === n) { cut = m.index + m[0].length; break; } } continue; }
    if (m[1]) { depth--; if (depth === 0) { blocks++; if (blocks === n) { cut = m.index + m[0].length; break; } } } else depth++;
  }
  return cut > 0 ? [html.slice(0, cut), html.slice(cut)] : [html];
}
