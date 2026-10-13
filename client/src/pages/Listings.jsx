import { Link } from 'react-router-dom';
import Listing from './Listing.jsx';
import SearchForm from '../components/SearchForm.jsx';
import { EmptyState } from '../components/States.jsx';
import { useApp } from '../context/AppContext.js';
import { categoryTrail } from '../head.js';
import { categoryHref } from '../utils/urls.js';

export function CategoryPage({ page }) {
  const { categories } = useApp().shell;
  const { category: c, items, totalPages } = page.data;
  const children = categories.filter((x) => x.parentSlug === c.slug);
  const chips = children.length ? (
    <ul className="subcats" aria-label={`${c.name} subsections`}>
      {children.map((x) => <li key={x.slug}><Link className="chip" to={categoryHref(x)}>{x.name}</Link></li>)}
    </ul>
  ) : null;
  return (
    <Listing title={c.name} lede={c.description} trail={categoryTrail(c, categories)} chips={chips} items={items}
      page={page.pageNo || 1} totalPages={totalPages} basePath={categoryHref(c)}
      empty={<EmptyState title={`No ${c.name} stories yet`} action={{ to: '/latest', label: 'See the latest news' }}>Nothing has been published in this section so far. Check back soon, or browse the latest stories.</EmptyState>} />
  );
}

export function AuthorPage({ page }) {
  const { author, items, totalPages } = page.data;
  return (
    <Listing
      title={<span className="author-hero"><span className="author-hero__avatar" aria-hidden="true">{author.name[0]}</span><span>{author.name}</span></span>}
      lede={author.bio} trail={[{ name: author.name, path: `/author/${author.slug}` }]} items={items}
      page={page.pageNo || 1} totalPages={totalPages} basePath={`/author/${author.slug}`}
      empty={<EmptyState title="No articles yet">This author has not published any articles.</EmptyState>} />
  );
}

export function LatestPage({ page }) {
  return (
    <Listing title="Latest news" lede="Every story in the order it was published." trail={[{ name: 'Latest news', path: '/latest' }]}
      items={page.data.items} page={page.pageNo || 1} totalPages={page.data.totalPages} basePath="/latest"
      empty={<EmptyState title="No stories yet">Fresh reporting will appear here as soon as it is published.</EmptyState>} />
  );
}

export function TrendingPage({ page }) {
  return (
    <Listing title="Trending stories" lede="What readers are opening most right now." trail={[{ name: 'Trending', path: '/trending' }]}
      items={page.data.items} page={page.pageNo || 1} totalPages={page.data.totalPages} basePath="/trending"
      empty={<EmptyState title="Nothing is trending yet">Trending stories appear once there is enough reader activity to rank them.</EmptyState>} />
  );
}

export function SearchPage({ page }) {
  const { categories } = useApp().shell;
  const { q, items, total, totalPages } = page.data;
  const top = categories.filter((c) => !c.parentSlug && c.primary);
  const empty = !q ? (
    <EmptyState title="Search NewsPilot">Type a topic, a name or a question to find articles. Or start from a section:</EmptyState>
  ) : (
    <EmptyState title={`No results for “${q}”`} action={{ to: '/latest', label: 'Browse the latest news' }}>Check the spelling, try fewer or more general words, or browse a section instead.</EmptyState>
  );
  return (
    <Listing title={q ? `Results for “${q}”` : 'Search'} lede={undefined}
      chips={(
        <div className="search-page__form">
          <SearchForm initial={q} id="q-page" />
          {q && total ? <p className="search-page__count" role="status">{total} {total === 1 ? 'article' : 'articles'} found</p> : null}
        </div>
      )}
      items={items} page={page.pageNo || 1} totalPages={totalPages} basePath="/search" extra={`q=${encodeURIComponent(q)}`} layout="list"
      empty={(
        <>
          {empty}
          {!q ? <ul className="subcats" style={{ justifyContent: 'center' }}>{top.map((c) => <li key={c.slug}><Link className="chip" to={categoryHref(c)}>{c.name}</Link></li>)}</ul> : null}
        </>
      )} />
  );
}
