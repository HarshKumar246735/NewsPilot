import { Link } from 'react-router-dom';
import Img from './Img.jsx';
import Kicker from './Kicker.jsx';
import ArticleMeta from './ArticleMeta.jsx';
import ArticleCard from './ArticleCard.jsx';
import SectionHeader from './SectionHeader.jsx';
import { articleHref } from '../utils/urls.js';
import './Hero.css';

export default function Hero({ main, secondary = [], latest = [] }) {
  return (
    <section className="hero container" aria-label="Top stories">
      <article className="hero__main">
        <Link to={articleHref(main)} className="hero__media" tabIndex={-1} aria-hidden="true">
          <Img image={main.image} priority sizes="(min-width: 64rem) 58vw, 100vw" className="hero__img" />
        </Link>
        <div className="hero__body">
          <Kicker category={main.category} />
          <h2 className="hero__title"><Link to={articleHref(main)}>{main.title}</Link></h2>
          {main.excerpt ? <p className="hero__dek">{main.excerpt}</p> : null}
          <ArticleMeta article={main} linkAuthor />
        </div>
      </article>
      {secondary.length ? (
        <div className="hero__secondary">
          {secondary.map((a) => <ArticleCard key={a.slug} article={a} variant="standard" excerpt={false} className="hero__side" />)}
        </div>
      ) : null}
      {latest.length ? (
        <aside className="hero__latest" aria-labelledby="hero-latest">
          <SectionHeader title="Latest" id="hero-latest" href="/latest" linkLabel="View all latest news" />
          <ul>{latest.map((a) => <li key={a.slug}><ArticleCard article={a} variant="text" excerpt={false} level={3} /></li>)}</ul>
        </aside>
      ) : null}
    </section>
  );
}
