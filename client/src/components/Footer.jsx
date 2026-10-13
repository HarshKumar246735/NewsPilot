import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import { useApp } from '../context/AppContext.js';
import { categoryHref } from '../utils/urls.js';
import './Footer.css';

const SOCIAL = { x: 'X', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn' };

export default function Footer() {
  const { shell, now } = useApp();
  const { site, categories } = shell;
  const top = categories.filter((c) => !c.parentSlug && c.primary).slice(0, 8);
  const social = Object.entries(site.social || {}).filter(([k, v]) => v && SOCIAL[k]);
  const year = new Date(now).getUTCFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <Logo name={site.name} />
          <p>{site.description}</p>
          {social.length ? (
            <ul className="footer__social" aria-label="Social media">
              {social.map(([k, url]) => <li key={k}><a href={url} rel="noopener noreferrer me" target="_blank">{SOCIAL[k]}<span className="sr-only"> (opens in a new tab)</span></a></li>)}
            </ul>
          ) : null}
        </div>
        <nav aria-label="Footer sections">
          <h2 className="footer__h">Sections</h2>
          <ul>
            {top.map((c) => <li key={c.slug}><Link to={categoryHref(c)}>{c.name}</Link></li>)}
            <li><Link to="/categories">All sections</Link></li>
          </ul>
        </nav>
        <nav aria-label="About the publication">
          <h2 className="footer__h">{site.name}</h2>
          <ul>
            <li><Link to="/about">About</Link></li><li><Link to="/contact">Contact</Link></li>
            <li><Link to="/advertise">Advertise with us</Link></li><li><Link to="/latest">Latest news</Link></li><li><Link to="/trending">Trending</Link></li>
          </ul>
        </nav>
        <nav aria-label="Policies">
          <h2 className="footer__h">Policies</h2>
          <ul>
            <li><Link to="/editorial-policy">Editorial policy</Link></li><li><Link to="/corrections-policy">Corrections policy</Link></li>
            <li><Link to="/privacy-policy">Privacy policy</Link></li><li><Link to="/terms">Terms and conditions</Link></li>
            <li><Link to="/disclaimer">Disclaimer</Link></li><li><Link to="/cookie-policy">Cookie policy</Link></li>
            
          </ul>
        </nav>
      </div>
      <div className="footer__base"><div className="container"><p>© {year} {site.name}. All rights reserved.</p></div></div>
    </footer>
  );
}
