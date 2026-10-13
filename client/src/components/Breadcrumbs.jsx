import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import './Breadcrumbs.css';

// `trail` = [{name, path}] excluding Home. The last item is the current page.
export default function Breadcrumbs({ trail }) {
  const items = [{ name: 'Home', path: '/' }, ...trail];
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((it, i) => (
          <li key={it.path}>
            {i === items.length - 1 ? <span aria-current="page">{it.name}</span> : <Link to={it.path}>{it.name}</Link>}
            {i < items.length - 1 ? <ChevronRight size={14} aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
