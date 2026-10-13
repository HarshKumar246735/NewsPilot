import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.js';
import './BreakingTicker.css';

// Content comes from shell.breaking (managed in the admin). Renders nothing when there is none.
export default function BreakingTicker() {
  const items = useApp().shell.breaking || [];
  if (!items.length) return null;
  const moving = items.length > 1;
  return (
    <section className="breaking" aria-label="Breaking news">
      <div className="container breaking__inner">
        <span className="breaking__label">Breaking</span>
        <div className={`breaking__viewport${moving ? ' is-moving' : ''}`}>
          <ul className="breaking__track">
            {items.map((i) => <li key={i.slug}><Link to={`/article/${i.slug}`}>{i.title}</Link></li>)}
            {moving ? items.map((i) => <li key={`${i.slug}-dup`} aria-hidden="true"><Link to={`/article/${i.slug}`} tabIndex={-1}>{i.title}</Link></li>) : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
