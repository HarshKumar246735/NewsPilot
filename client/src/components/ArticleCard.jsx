import { Link } from 'react-router-dom';
import Img from './Img.jsx';
import Kicker from './Kicker.jsx';
import ArticleMeta from './ArticleMeta.jsx';
import { articleHref } from '../utils/urls.js';
import './ArticleCard.css';

const SIZES = {
  lead: '(min-width: 64rem) 50vw, 100vw', standard: '(min-width: 64rem) 25vw, (min-width: 40rem) 50vw, 100vw',
  compact: '120px', horizontal: '(min-width: 40rem) 280px, 100vw', text: '1px',
};

// One link per card (the headline), stretched over the whole card; the category link sits above it.
export default function ArticleCard({ article, variant = 'standard', level = 3, priority = false, excerpt = true, className = '' }) {
  const H = `h${level}`;
  const withImage = variant !== 'text' && article.image;
  return (
    <article className={`card card--${variant} ${className}`}>
      {withImage ? <div className="card__media"><Img image={article.image} sizes={SIZES[variant]} priority={priority} className="card__img" /></div> : null}
      <div className="card__body">
        {variant !== 'compact' ? <Kicker category={article.category} /> : null}
        <H className="card__title"><Link to={articleHref(article)} className="card__link">{article.title}</Link></H>
        {excerpt && variant !== 'compact' && article.excerpt ? <p className="card__excerpt">{article.excerpt}</p> : null}
        <ArticleMeta article={article} byline={variant !== 'compact'} />
      </div>
    </article>
  );
}
