// Allowlist HTML sanitizer for article bodies. Default-deny: unknown tags are removed (their text is kept
// and escaped), dangerous containers are removed with their content, attributes are allowlisted per tag,
// and URLs are checked AFTER entity decoding and control-character stripping.
const VOID = new Set(['br', 'hr', 'img']);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'noscript', 'template', 'textarea', 'title', 'svg', 'math', 'object', 'embed', 'applet', 'select', 'option', 'form', 'button', 'head']);
const ALLOWED = {
  p: [], br: [], hr: [], h2: ['id'], h3: ['id'], h4: ['id'], strong: [], b: [], em: [], i: [], u: [], sup: [], sub: [], code: [], pre: [],
  ul: [], ol: [], li: [], blockquote: [], figure: [], figcaption: [],
  table: [], thead: [], tbody: [], tfoot: [], tr: [], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
  a: ['href', 'title', 'rel', 'target'], img: ['src', 'alt', 'width', 'height', 'title'],
};
const REL_OK = new Set(['nofollow', 'sponsored', 'ugc', 'noopener', 'noreferrer']);
const YT = /^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/[\w-]{6,20}(?:\?[\w=&%-]*)?$/;
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', colon: ':', tab: '\t', newline: '\n', lpar: '(', rpar: ')' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function decode(s) {
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));?/gi, (m, hex, dec, name) => {
    if (hex || dec) { const cp = parseInt(hex || dec, hex ? 16 : 10); return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : ''; }
    return NAMED[name.toLowerCase()] ?? m;
  });
}

// Text nodes: keep valid entities, escape everything else.
const text = (s) => s.replace(/&(?![a-z]+;|#\d+;|#x[0-9a-f]+;)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function safeUrl(raw, { img = false } = {}) {
  const v = decode(raw).replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, '');
  if (!v) return null;
  if (img) return /^https:\/\//i.test(v) || /^\/(?!\/)/.test(v) ? decode(raw).trim() : null;
  if (/^(https?:|mailto:|tel:)/i.test(v)) return decode(raw).trim();
  if (/^(#|\/(?!\/)|\?)/.test(v) || !/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.startsWith('//')) return decode(raw).trim();
  return null;
}

function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(src))) { const k = m[1].toLowerCase(); if (!(k in attrs)) attrs[k] = m[2] ?? m[3] ?? m[4] ?? ''; }
  return attrs;
}

function buildTag(name, attrs) {
  const allowed = ALLOWED[name];
  const out = [];
  if (name === 'a') {
    const href = attrs.href !== undefined ? safeUrl(attrs.href) : null;
    if (href) {
      out.push(`href="${esc(href)}"`);
      if (attrs.title) out.push(`title="${esc(decode(attrs.title))}"`);
      const external = /^https?:/i.test(href);
      const rel = new Set((attrs.rel || '').toLowerCase().split(/\s+/).filter((t) => REL_OK.has(t)));
      if (external || decode(attrs.target || '') === '_blank') { rel.add('noopener'); rel.add('noreferrer'); }
      if (rel.size) out.push(`rel="${[...rel].join(' ')}"`);
      if (decode(attrs.target || '') === '_blank') out.push('target="_blank"');
    }
    return out.join(' ');
  }
  for (const k of allowed) {
    if (attrs[k] === undefined) continue;
    const v = decode(attrs[k]);
    if (name === 'img' && k === 'src') { const u = safeUrl(attrs.src, { img: true }); if (!u) return null; out.push(`src="${esc(u)}"`); }
    else if (['width', 'height', 'colspan', 'rowspan'].includes(k)) { if (/^\d{1,4}$/.test(v)) out.push(`${k}="${v}"`); }
    else if (k === 'id') { if (/^[a-z][\w-]{0,80}$/i.test(v)) out.push(`id="${esc(v)}"`); }
    else out.push(`${k}="${esc(v.slice(0, 500))}"`);
  }
  if (name === 'img' && !out.some((x) => x.startsWith('src='))) return null;
  return out.join(' ');
}

export function sanitizeHtml(input, { maxLength = 600_000 } = {}) {
  const html = String(input ?? '').slice(0, maxLength);
  let out = '';
  const stack = [];
  let i = 0, skipUntil = null;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { if (!skipUntil) out += text(html.slice(i)); break; }
    if (!skipUntil && lt > i) out += text(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) { const e = html.indexOf('-->', lt + 4); i = e === -1 ? html.length : e + 3; continue; }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/.exec(html.slice(lt, lt + 4000));
    if (!m) {
      // Not a well-formed tag (e.g. "<<script", "<!doctype", "a < b"): drop a declaration, otherwise treat "<" as text.
      if (/^<[!?]/.test(html.slice(lt, lt + 2))) { const e = html.indexOf('>', lt); i = e === -1 ? html.length : e + 1; continue; }
      if (!skipUntil) out += '&lt;';
      i = lt + 1; continue;
    }
    i = lt + m[0].length;
    const closing = m[1] === '/', name = m[2].toLowerCase();
    if (skipUntil) { if (closing && name === skipUntil) skipUntil = null; continue; }
    if (DROP_WITH_CONTENT.has(name)) { if (!closing && !m[0].endsWith('/>')) skipUntil = name; continue; }
    if (name === 'iframe') {
      if (!closing) {
        const src = decode(parseAttrs(m[3]).src || '').trim();
        if (YT.test(src)) out += `<iframe src="${esc(src)}" title="Embedded video" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
        skipUntil = 'iframe'; // never keep anything inside an iframe tag
      }
      continue;
    }
    if (!(name in ALLOWED)) continue;
    if (closing) {
      const at = stack.lastIndexOf(name);
      if (at === -1 || VOID.has(name)) continue;
      while (stack.length > at) out += `</${stack.pop()}>`;
      continue;
    }
    const attrs = buildTag(name, parseAttrs(m[3]));
    if (attrs === null) continue;
    out += `<${name}${attrs ? ` ${attrs}` : ''}${VOID.has(name) ? '>' : '>'}`;
    if (!VOID.has(name)) stack.push(name);
  }
  while (stack.length) out += `</${stack.pop()}>`;
  return out;
}

// Plain text for comments and other user-submitted strings: no markup survives.
export function sanitizeText(input, max = 2000) {
  return String(input ?? '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
}
