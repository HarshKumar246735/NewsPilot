import ArticleCard from '../components/ArticleCard.jsx';
import Pagination from '../components/Pagination.jsx';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import './Listing.css';

// Shared layout for category, author, latest, trending and search results.
export default function Listing({ title, lede, trail, chips, items, page = 1, totalPages = 1, basePath, extra, layout = 'grid', empty, kickerNote }) {
  return (
    <div className="container listing">
      <header className="listing__head">
        {trail ? <Breadcrumbs trail={trail} /> : null}
        {kickerNote ? <p className="listing__note">{kickerNote}</p> : null}
        <h1 className="page-title">{title}</h1>
        {lede ? <p className="page-lede">{lede}</p> : null}
        {chips}
      </header>
      {items.length ? (
        <>
          <div className={layout === 'list' ? 'listing__list' : 'listing__grid'}>
            {items.map((a, i) => (
              layout === 'list'
                ? <ArticleCard key={a.slug} article={a} variant="horizontal" />
                : <ArticleCard key={a.slug} article={a} variant={i === 0 && page === 1 ? 'lead' : 'standard'} priority={i === 0 && page === 1} className={i === 0 && page === 1 ? 'listing__first' : ''} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} basePath={basePath} extra={extra} />
        </>
      ) : empty}
    </div>
  );
}
