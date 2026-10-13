import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { withPage } from '../utils/urls.js';
import './Pagination.css';

function windowed(page, total) {
  const set = new Set([1, total, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push('gap'); out.push(n); });
  return out;
}

// `makeHref(n)` returns the URL for page n; page 1 must be the clean URL without ?page=.
export default function Pagination({ page, totalPages, basePath, extra = '' }) {
  if (totalPages <= 1) return null;
  const href = (n) => {
    const base = withPage(basePath, n);
    if (!extra) return base;
    return base.includes('?') ? `${base}&${extra}` : `${base}?${extra}`;
  };
  return (
    <nav className="pager" aria-label="Pagination">
      {page > 1 ? <Link className="pager__step" to={href(page - 1)} rel="prev"><ChevronLeft size={18} aria-hidden="true" /> Previous</Link> : <span />}
      <ul className="pager__nums">
        {windowed(page, totalPages).map((n, i) => (
          n === 'gap' ? <li key={`g${i}`} aria-hidden="true">…</li> : (
            <li key={n}>{n === page ? <span className="pager__num is-current" aria-current="page"><span className="sr-only">Page </span>{n}</span> : <Link className="pager__num" to={href(n)}><span className="sr-only">Page </span>{n}</Link>}</li>
          )
        ))}
      </ul>
      {page < totalPages ? <Link className="pager__step" to={href(page + 1)} rel="next">Next <ChevronRight size={18} aria-hidden="true" /></Link> : <span />}
    </nav>
  );
}
