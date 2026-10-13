import { Link } from 'react-router-dom';
import { useAdmin } from '../AdminContext.js';
import { AppContext } from '../../context/AppContext.js';
import ArticlePage from '../../pages/ArticlePage.jsx';
import { useAsync, Spinner, ErrorBox } from '../ui.jsx';
import './Preview.css';

// Renders the real public article page from the saved draft, so the preview matches what readers will see.
export default function Preview({ id }) {
  const { api, config } = useAdmin();
  const { data, loading, error, reload } = useAsync(async () => {
    const [a, shell, authors] = await Promise.all([api.get(`/admin/articles/${id}`), fetch(`${api.base}/public/shell`).then((r) => r.json()), api.get('/admin/authors')]);
    return { a: a.item, shell, authors: authors.items };
  }, [id]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const { a, shell, authors } = data;
  const cat = shell.categories.find((c) => c.slug === a.categorySlug);
  const au = authors.find((x) => x.slug === a.authorSlug);
  const article = { ...a, category: cat ? { slug: cat.slug, name: cat.name, parentSlug: cat.parentSlug } : { slug: 'uncategorized', name: 'Uncategorised', parentSlug: null }, author: au ? { slug: au.slug, name: au.name, bio: au.bio } : null, dek: a.dek || '', publishedAt: a.publishedAt || a.updatedAt, tags: a.tags || [], commentsEnabled: false };
  return (
    <AppContext.Provider value={{ config, shell, now: new Date().toISOString() }}>
      <div className="preview-bar" role="note"><strong>Preview</strong> Status: {a.status}. Only people signed in to the admin can see this page. <Link to={`/admin/articles/${id}`}>Back to the editor</Link></div>
      <ArticlePage page={{ data: { article, related: [], prev: null, next: null, latest: [] }, head: { canonical: '#' } }} />
    </AppContext.Provider>
  );
}
