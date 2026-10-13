import { headTags } from './head.js';

// Keeps <title>, meta, canonical and JSON-LD correct during client-side navigation.
export function applyHead(h) {
  document.title = h.title;
  document.head.querySelectorAll('[data-np-head]').forEach((n) => n.remove());
  for (const { tag, attrs, text } of headTags(h)) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text) el.textContent = text;
    el.setAttribute('data-np-head', '');
    document.head.appendChild(el);
  }
}
