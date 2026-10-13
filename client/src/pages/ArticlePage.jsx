import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import Kicker from '../components/Kicker.jsx';
import Img from '../components/Img.jsx';
import ShareBar from '../components/ShareBar.jsx';
import TableOfContents from '../components/TableOfContents.jsx';
import ReadingProgress from '../components/ReadingProgress.jsx';
import ArticleCard from '../components/ArticleCard.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import AdSlot from '../components/AdSlot.jsx';
import Comments from '../components/Comments.jsx';
import { splitAfterBlocks } from '../utils/splitHtml.js';
import { recordView } from '../services/apiSource.js';
import { useApp } from '../context/AppContext.js';
import { articleTrail } from '../head.js';
import { prepareArticleHtml } from '../utils/articleHtml.js';
import { formatDateTime } from '../utils/format.js';
import { articleHref, authorHref } from '../utils/urls.js';
import './ArticlePage.css';

export default function ArticlePage({ page }) {
  const { shell, config } = useApp();
  const { article: a, related = [], prev, next, latest = [] } = page.data;
  const { html, toc } = useMemo(() => prepareArticleHtml(a.contentHtml), [a.contentHtml]);
  const parts = useMemo(() => splitAfterBlocks(html, 3), [html]);
  useEffect(() => { recordView(config, a.slug); }, [config, a.slug]);
  const updated = a.updatedAt && new Date(a.updatedAt) - new Date(a.publishedAt) > 60000;
  const email = shell.site.contact?.email;
  const initial = a.author?.name?.[0] || '';

  return (
    <>
      <ReadingProgress targetId="article-body" />
      <article className="article container">
        <header className="article__head">
          <Breadcrumbs trail={articleTrail(a, shell.categories)} />
          <Kicker category={a.category} />
          <h1 className="article__title">{a.title}</h1>
          {a.dek ? <p className="article__dek">{a.dek}</p> : null}
          <div className="byline">
            {a.author ? <span className="byline__author">By <Link to={authorHref(a.author)}>{a.author.name}</Link></span> : null}
            <time dateTime={a.publishedAt}>{formatDateTime(a.publishedAt)}</time>
            {updated ? <span>Updated <time dateTime={a.updatedAt}>{formatDateTime(a.updatedAt)}</time></span> : null}
            <span>{a.readingMinutes} min read</span>
          </div>
        </header>

        {a.image ? (
          <figure className="article__figure">
            <div className="article__frame"><Img image={a.image} priority sizes="(min-width: 64rem) 1100px, 100vw" /></div>
            {a.image.caption || a.image.credit ? <figcaption>{a.image.caption}{a.image.credit ? <span className="credit"> Credit: {a.image.credit}</span> : null}</figcaption> : null}
          </figure>
        ) : null}

        <div className="article__layout">
          <div className="article__main">
            <TableOfContents items={toc} variant="inline" />
            
            <div id="article-body">
              <div className="prose" dangerouslySetInnerHTML={{ __html: parts[0] }} />
              {parts[1] ? <><AdSlot placement="article-body" /><div className="prose prose--cont" dangerouslySetInnerHTML={{ __html: parts[1] }} /></> : null}
            </div>
            {a.tags?.length ? <ul className="tags" aria-label="Topics">{a.tags.map((t) => <li key={t}><Link className="chip" to={`/search?q=${encodeURIComponent(t)}`}>{t}</Link></li>)}</ul> : null}
            <div className="article__share"><ShareBar url={page.head.canonical} title={a.title} /></div>
            <AdSlot placement="article-end" />
            {a.author ? (
              <aside className="author-box" aria-label="About the author">
                <span className="author-box__avatar" aria-hidden="true">{initial}</span>
                <div>
                  <p className="author-box__name"><Link to={authorHref(a.author)}>{a.author.name}</Link></p>
                  {a.author.bio ? <p className="author-box__bio">{a.author.bio}</p> : null}
                </div>
              </aside>
            ) : null}
            {a.commentsEnabled ? <Comments slug={a.slug} /> : null}
            <p className="correction">
              Spotted an error? {email ? <a href={`mailto:${email}?subject=${encodeURIComponent(`Correction: ${a.title}`)}`}>Tell the editors</a> : <Link to="/contact">Contact the editors</Link>} or read our <Link to="/corrections-policy">corrections policy</Link>.
            </p>
          </div>
          <aside className="article__aside" aria-label="Article extras">
            <TableOfContents items={toc} variant="sidebar" />
            <AdSlot placement="article-sidebar" />
            {latest.length ? (
              <section aria-labelledby="aside-latest">
                <h2 className="aside-h" id="aside-latest">Latest</h2>
                <div className="aside-list">{latest.map((l) => <ArticleCard key={l.slug} article={l} variant="compact" />)}</div>
              </section>
            ) : null}
          </aside>
        </div>

        {related.length ? (
          <section className="article__related" aria-labelledby="related">
            <SectionHeader title="Related reading" id="related" />
            <div className="related-grid">{related.map((r) => <ArticleCard key={r.slug} article={r} variant="standard" />)}</div>
          </section>
        ) : null}

        {prev || next ? (
          <nav className="pn" aria-label="More articles">
            {prev ? <Link to={articleHref(prev)} className="pn__link" rel="prev"><span className="pn__dir"><ArrowLeft size={16} aria-hidden="true" /> Older</span><span className="pn__title">{prev.title}</span></Link> : <span />}
            {next ? <Link to={articleHref(next)} className="pn__link pn__link--next" rel="next"><span className="pn__dir">Newer <ArrowRight size={16} aria-hidden="true" /></span><span className="pn__title">{next.title}</span></Link> : <span />}
          </nav>
        ) : null}
      </article>
    </>
  );
}
