import { Link } from 'react-router-dom';
import SectionHeader from './SectionHeader.jsx';
import Kicker from './Kicker.jsx';
import { articleHref } from '../utils/urls.js';
import './TrendingList.css';

// Ranked list. Only the rank is shown; no view counts are displayed or invented.
export default function TrendingList({ title, articles, id, href }) {
  if (!articles?.length) return null;
  return (
    <section className="ranked" aria-labelledby={id}>
      <SectionHeader title={title} id={id} href={href} level={2} />
      <ol>
        {articles.map((a, i) => (
          <li key={a.slug}>
            <span className="ranked__n" aria-hidden="true">{i + 1}</span>
            <div><Kicker category={a.category} /><h3><Link to={articleHref(a)}>{a.title}</Link></h3></div>
          </li>
        ))}
      </ol>
    </section>
  );
}
