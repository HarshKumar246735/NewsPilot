import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { formatDate } from '../utils/format.js';
import './StaticPage.css';

export default function StaticPage({ page }) {
  const p = page.data;
  return (
    <div className="container static">
      <header className="static__head">
        <Breadcrumbs trail={[{ name: p.title, path: `/${p.slug}` }]} />
        <h1 className="page-title">{p.title}</h1>
        <p className="static__updated">Last updated <time dateTime={p.updated}>{formatDate(p.updated)}</time></p>
      </header>
      <div className="static__body prose-lite">
        {p.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((t) => <p key={t}>{t}</p>)}
          </section>
        ))}
      </div>
    </div>
  );
}
