import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Search, Menu, ChevronDown, X } from 'lucide-react';
import Logo from './Logo.jsx';
import Dialog from './Dialog.jsx';
import SearchForm from './SearchForm.jsx';
import { useApp } from '../context/AppContext.js';
import { categoryHref } from '../utils/urls.js';
import { formatLongDate } from '../utils/format.js';
import './Header.css';

export function groupCategories(categories) {
  const top = categories.filter((c) => !c.parentSlug);
  return top.map((c) => ({ ...c, children: categories.filter((x) => x.parentSlug === c.slug) }));
}

export default function Header() {
  const { shell, now } = useApp();
  const { site, categories } = shell;
  const { pathname } = useLocation();
  const [search, setSearch] = useState(false);
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const moreRef = useRef(null);
  const groups = groupCategories(categories);
  const primary = groups.filter((c) => c.primary).slice(0, 8);

  useEffect(() => { setSearch(false); setMenu(false); setMore(false); }, [pathname]);
  useEffect(() => {
    if (!more) return undefined;
    const outside = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMore(false); };
    const esc = (e) => { if (e.key === 'Escape') setMore(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc); };
  }, [more]);

  return (
    <header className="site-header">
      <div className="utility">
        <div className="container utility__inner">
          <span>{formatLongDate(now)}</span>
          <nav aria-label="Quick links" className="utility__links">
            <Link to="/latest">Latest</Link>
            <Link to="/trending">Trending</Link>
            <Link to="/categories">All sections</Link>
            <a href="#newsletter">Newsletter</a>
          </nav>
        </div>
      </div>
      <div className="container masthead">
        <Logo name={site.name} />
        <p className="masthead__tag">{site.tagline}</p>
      </div>
      <div className="navbar">
        <div className="container navbar__inner">
          <div className="navbar__brand"><Logo name={site.name} compact /></div>
          <nav aria-label="Sections" className="primary-nav">
            <ul>
              {primary.map((c) => (
                <li key={c.slug}><NavLink to={categoryHref(c)} className={({ isActive }) => `primary-nav__link${isActive ? ' is-active' : ''}`}>{c.name}</NavLink></li>
              ))}
              <li className="primary-nav__more" ref={moreRef}>
                <button type="button" className="primary-nav__link primary-nav__btn" aria-expanded={more} aria-controls="more-sections" onClick={() => setMore((v) => !v)}>
                  More <ChevronDown size={16} aria-hidden="true" />
                </button>
                {more ? (
                  <div id="more-sections" className="mega">
                    <div className="mega__grid">
                      {groups.map((g) => (
                        <div key={g.slug} className="mega__group">
                          <Link to={categoryHref(g)} className="mega__head">{g.name}</Link>
                          {g.children.length ? <ul>{g.children.map((c) => <li key={c.slug}><Link to={categoryHref(c)}>{c.name}</Link></li>)}</ul> : null}
                        </div>
                      ))}
                    </div>
                    <Link to="/categories" className="link-arrow mega__all">Browse all sections</Link>
                  </div>
                ) : null}
              </li>
            </ul>
          </nav>
          <div className="navbar__actions">
            <button type="button" className="icon-btn" aria-label="Search" onClick={() => setSearch(true)}><Search size={22} aria-hidden="true" /></button>
            <a className="btn btn--primary btn--sm navbar__subscribe" href="#newsletter">Subscribe</a>
            <button type="button" className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={24} aria-hidden="true" /></button>
          </div>
        </div>
      </div>

      <Dialog open={search} onClose={() => setSearch(false)} label="Search" className="dialog--search">
        <div className="container search-panel">
          <div className="search-panel__row">
            <SearchForm autoFocus id="q-dialog" />
            <button type="button" className="icon-btn" aria-label="Close search" onClick={() => setSearch(false)}><X size={22} aria-hidden="true" /></button>
          </div>
          <p className="search-panel__hint">Or jump to a section</p>
          <ul className="chips">{primary.map((c) => <li key={c.slug}><Link className="chip" to={categoryHref(c)}>{c.name}</Link></li>)}</ul>
        </div>
      </Dialog>

      <Dialog open={menu} onClose={() => setMenu(false)} label="Menu" className="dialog--drawer">
        <div className="drawer">
          <div className="drawer__top">
            <Logo name={site.name} compact />
            <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setMenu(false)}><X size={22} aria-hidden="true" /></button>
          </div>
          <div className="drawer__search"><SearchForm id="q-drawer" /></div>
          <ul className="drawer__quick">
            <li><Link to="/latest">Latest news</Link></li>
            <li><Link to="/trending">Trending</Link></li>
            <li><Link to="/categories">All sections</Link></li>
          </ul>
          <nav aria-label="Sections menu" className="drawer__sections">
            {groups.map((g) => (
              g.children.length ? (
                <details key={g.slug}>
                  <summary>{g.name}<ChevronDown size={18} aria-hidden="true" /></summary>
                  <ul>
                    <li><Link to={categoryHref(g)}>All {g.name}</Link></li>
                    {g.children.map((c) => <li key={c.slug}><Link to={categoryHref(c)}>{c.name}</Link></li>)}
                  </ul>
                </details>
              ) : <Link key={g.slug} to={categoryHref(g)} className="drawer__single">{g.name}</Link>
            ))}
          </nav>
        </div>
      </Dialog>
    </header>
  );
}
