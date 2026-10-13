import SectionHeader from './SectionHeader.jsx';
import ArticleCard from './ArticleCard.jsx';
import { categoryHref } from '../utils/urls.js';
import './CategorySection.css';

export default function CategorySection({ category, articles }) {
  if (!articles?.length) return null;
  const [lead, ...rest] = articles;
  const id = `sec-${category.slug}`;
  return (
    <section className="cat-section container" aria-labelledby={id}>
      <SectionHeader title={category.name} id={id} href={categoryHref(category)} linkLabel={`View all ${category.name} stories`} />
      <div className="cat-section__grid">
        <ArticleCard article={lead} variant="lead" />
        {rest.length ? <div className="cat-section__rest">{rest.map((a) => <ArticleCard key={a.slug} article={a} variant="compact" />)}</div> : null}
      </div>
    </section>
  );
}
