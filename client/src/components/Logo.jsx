import { Link } from 'react-router-dom';
import './Logo.css';

export default function Logo({ name = 'NewsPilot', compact = false }) {
  return (
    <Link to="/" className={`logo${compact ? ' logo--compact' : ''}`} aria-label={`${name} home`}>
      <svg className="logo__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="4" fill="currentColor" />
        <path d="M9 24V9l14 15V9" fill="none" stroke="var(--np-paper)" strokeWidth="3" strokeLinejoin="round" />
        <path d="M23 3.5l3.5 6h-7z" fill="var(--np-accent)" />
      </svg>
      <span className="logo__word">{name}</span>
    </Link>
  );
}
