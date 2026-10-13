import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.js';
import { timeAgo } from '../utils/format.js';
import { authorHref } from '../utils/urls.js';

export default function ArticleMeta({ article, byline = true, linkAuthor = false }) {
  const { now } = useApp();
  return (
    <div className="meta">
      {byline && article.author ? <span>{linkAuthor ? <Link to={authorHref(article.author)}>{article.author.name}</Link> : article.author.name}</span> : null}
      <time dateTime={article.publishedAt}>{timeAgo(article.publishedAt, now)}</time>
      {article.readingMinutes ? <span>{article.readingMinutes} min read</span> : null}
    </div>
  );
}
