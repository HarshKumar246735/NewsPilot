export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'article', 'category', 'author', 'search', 'latest', 'trending', 'about', 'contact',
  'editorial-policy', 'corrections-policy', 'privacy-policy', 'terms', 'disclaimer', 'advertise',
  'sitemap', 'robots', 'rss', 'login', 'static', 'assets',
]);

const FILLER = new Set(['a', 'an', 'the', 'in', 'at', 'on']);

export function slugify(input = '', maxLength = 80) {
  const full = String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // Drop filler words for shorter URLs, but only if enough meaningful words remain.
  const trimmed = full.split('-').filter((w) => !FILLER.has(w));
  const slug = trimmed.length >= 3 ? trimmed.join('-') : full;
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength);
  const last = cut.lastIndexOf('-');
  return (last > maxLength * 0.6 ? cut.slice(0, last) : cut).replace(/-+$/, '');
}

export function isValidSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 100 && !RESERVED_SLUGS.has(slug);
}

// `exists(candidate)` is async and returns true if the slug is taken.
export async function uniqueSlug(base, exists) {
  let slug = slugify(base) || 'article';
  if (RESERVED_SLUGS.has(slug)) slug = `${slug}-news`;
  if (!(await exists(slug))) return slug;
  for (let i = 2; i < 500; i++) {
    const candidate = `${slug}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error('Could not generate a unique slug');
}
