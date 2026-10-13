import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './SectionHeader.css';

export default function SectionHeader({ title, href, linkLabel, id, level = 2 }) {
  const H = `h${level}`;
  return (
    <div className="section-header">
      <H className="section-header__title" id={id}>{title}</H>
      {href ? <Link to={href} className="link-arrow" aria-label={linkLabel || `View all ${title}`}>View all <ArrowRight size={16} aria-hidden="true" /></Link> : null}
    </div>
  );
}
