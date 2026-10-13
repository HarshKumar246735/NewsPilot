import './TableOfContents.css';

// `variant="inline"` is a collapsible block shown on small screens; `"sidebar"` is shown from 64rem up.
export default function TableOfContents({ items, variant }) {
  if (!items || items.length < 3) return null;
  const list = (
    <ol>{items.map((i) => <li key={i.id} className={i.level === 3 ? 'toc__sub' : undefined}><a href={`#${i.id}`}>{i.text}</a></li>)}</ol>
  );
  return variant === 'inline' ? (
    <details className="toc toc--inline" open>
      <summary>In this article</summary>
      {list}
    </details>
  ) : (
    <nav className="toc toc--sidebar" aria-label="Table of contents">
      <h2 className="toc__h">In this article</h2>
      {list}
    </nav>
  );
}
