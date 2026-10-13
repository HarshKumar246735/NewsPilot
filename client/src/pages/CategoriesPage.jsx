import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { useApp } from '../context/AppContext.js';
import { groupCategories } from '../components/Header.jsx';
import { categoryHref } from '../utils/urls.js';
import './CategoriesPage.css';

export default function CategoriesPage() {
  const groups = groupCategories(useApp().shell.categories);
  return (
    <div className="container listing">
      <header className="listing__head">
        <Breadcrumbs trail={[{ name: 'All sections', path: '/categories' }]} />
        <h1 className="page-title">All sections</h1>
        <p className="page-lede">Every part of the publication in one place.</p>
      </header>
      <div className="directory">
        {groups.map((g) => (
          <section key={g.slug} className="directory__group">
            <h2><Link to={categoryHref(g)}>{g.name}</Link></h2>
            {g.description ? <p>{g.description}</p> : null}
            {g.children.length ? <ul>{g.children.map((c) => <li key={c.slug}><Link to={categoryHref(c)}>{c.name}</Link></li>)}</ul> : null}
          </section>
        ))}
      </div>
    </div>
  );
}
