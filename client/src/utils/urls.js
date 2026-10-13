export const articleHref = (a) => `/article/${a.slug}`;
export const authorHref = (a) => `/author/${a.slug}`;
export const categoryHref = (c) => (c.parentSlug ? `/category/${c.parentSlug}/${c.slug}` : `/category/${c.slug}`);
export const withPage = (path, page) => (page > 1 ? `${path}?page=${page}` : path);
