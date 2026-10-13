import { Link } from 'react-router-dom';
import SearchForm from '../components/SearchForm.jsx';
import { ErrorState } from '../components/States.jsx';
import { useApp } from '../context/AppContext.js';
import { categoryHref } from '../utils/urls.js';
import './ErrorPages.css';

export function NotFoundPage() {
  const top = useApp().shell.categories.filter((c) => !c.parentSlug && c.primary);
  return (
    <div className="container notfound">
      <p className="notfound__code" aria-hidden="true">404</p>
      <h1 className="page-title">We couldn’t find that page</h1>
      <p className="page-lede">The link may be out of date, or the story may have been moved. Try a search, or head back to the front page.</p>
      <div className="notfound__search"><SearchForm id="q-404" /></div>
      <ul className="subcats">{top.map((c) => <li key={c.slug}><Link className="chip" to={categoryHref(c)}>{c.name}</Link></li>)}</ul>
      <Link to="/" className="btn btn--primary notfound__home">Back to the homepage</Link>
    </div>
  );
}

export function ErrorPage({ page }) {
  return (
    <div className="container">
      <ErrorState title="This page couldn’t be loaded">{page?.data?.message || 'Please try again in a moment.'}</ErrorState>
    </div>
  );
}
