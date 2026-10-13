import { Link } from 'react-router-dom';
import { SearchX, TriangleAlert } from 'lucide-react';
import './States.css';

export function EmptyState({ title, children, action }) {
  return (
    <div className="state">
      <SearchX size={32} aria-hidden="true" />
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      {action ? <Link className="btn" to={action.to}>{action.label}</Link> : null}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', children, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <TriangleAlert size={32} aria-hidden="true" />
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
      <div className="state__actions">
        {onRetry ? <button type="button" className="btn btn--primary" onClick={onRetry}>Try again</button> : <a className="btn btn--primary" href="">Reload the page</a>}
        <Link className="btn" to="/">Go to the homepage</Link>
      </div>
    </div>
  );
}
