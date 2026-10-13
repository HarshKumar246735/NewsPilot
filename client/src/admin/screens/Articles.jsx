import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAdmin } from '../AdminContext.js';
import { useAsync, Spinner, ErrorBox, PageHead, StatusBadge, Empty, Btn, Input, Select, fmtDate, useConfirm } from '../ui.jsx';
import { can } from '../api.js';

const STATUS = ['', 'draft', 'review', 'scheduled', 'published', 'archived', 'trashed'];

export default function Articles() {
  const { api, user, toast } = useAdmin();
  const [sp, setSp] = useSearchParams();
  const q = { q: sp.get('q') || '', status: sp.get('status') || '', category: sp.get('category') || '', page: Number(sp.get('page')) || 1, sort: sp.get('sort') || '' };
  const [text, setText] = useState(q.q);
  const [confirm, dialog] = useConfirm();
  const cats = useAsync(() => api.get('/admin/categories'), []);
  const list = useAsync(() => api.get(`/admin/articles?${new URLSearchParams(Object.entries(q).filter(([, v]) => v))}`), [q.q, q.status, q.category, q.page, q.sort]);
  const set = (patch) => { const n = new URLSearchParams(sp); Object.entries({ page: '', ...patch }).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); setSp(n); };

  async function act(a, action, label) {
    try { await api.post(`/admin/articles/${a.id}/${action}`); toast(label); list.reload(); } catch (e) { toast(e.message, 'bad'); }
  }
  async function trash(a) { if (await confirm({ title: 'Move to trash?', message: `"${a.title}" will be hidden from the site. You can restore it from the trash.`, confirm: 'Move to trash', danger: true })) act(a, 'trash', 'Moved to trash'); }
  async function destroy(a) {
    if (!(await confirm({ title: 'Delete permanently?', message: `"${a.title}" will be deleted forever. This cannot be undone.`, confirm: 'Delete forever', danger: true }))) return;
    try { await api.del(`/admin/articles/${a.id}`); toast('Deleted'); list.reload(); } catch (e) { toast(e.message, 'bad'); }
  }
  const catName = (s) => cats.data?.items.find((c) => c.slug === s)?.name || '—';

  return (
    <>
      <PageHead title="Articles" sub="Write, review and publish."><Link className="a-btn a-btn--primary" to="/admin/articles/new">New article</Link></PageHead>
      <form className="a-filters" onSubmit={(e) => { e.preventDefault(); set({ q: text.trim() }); }} role="search" aria-label="Filter articles">
        <Input aria-label="Search by title" placeholder="Search by title" value={text} onChange={(e) => setText(e.target.value)} />
        <Select aria-label="Status" value={q.status} onChange={(e) => set({ status: e.target.value })}>{STATUS.map((s) => <option key={s} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : 'All except trash'}</option>)}</Select>
        <Select aria-label="Category" value={q.category} onChange={(e) => set({ category: e.target.value })}><option value="">All categories</option>{cats.data?.items.map((c) => <option key={c.id} value={c.slug}>{c.parentSlug ? '— ' : ''}{c.name}</option>)}</Select>
        <Select aria-label="Sort" value={q.sort} onChange={(e) => set({ sort: e.target.value })}><option value="">Newest first</option><option value="oldest">Oldest first</option></Select>
        <Btn type="submit">Search</Btn>
      </form>
      {list.loading ? <Spinner /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : !list.data.items.length ? <Empty title="No articles found">Try different filters, or write a new article.</Empty> : (
        <>
          <div className="a-table-wrap"><table className="a-table">
            <caption className="sr-only">Articles</caption>
            <thead><tr><th>Title</th><th>Status</th><th>Category</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{list.data.items.map((a) => (
              <tr key={a.id}>
                <td><Link to={`/admin/articles/${a.id}`}><strong>{a.title}</strong></Link>{a.isBreaking ? <> <span className="a-badge a-badge--bad">Breaking</span></> : null}{a.isFeatured ? <> <span className="a-badge a-badge--info">Featured</span></> : null}</td>
                <td><StatusBadge status={a.status} />{a.status === 'scheduled' ? <><br /><small>{fmtDate(a.publishedAt)}</small></> : null}</td>
                <td>{catName(a.categorySlug)}</td><td>{fmtDate(a.updatedAt)}</td>
                <td><div className="a-actions">
                  <Link className="a-btn a-btn--sm" to={`/admin/articles/${a.id}`}>Edit</Link>
                  <Link className="a-btn a-btn--sm" to={`/admin/preview/${a.id}`} target="_blank">Preview</Link>
                  {a.status === 'published' ? <Btn size="sm" onClick={() => act(a, 'unpublish', 'Unpublished')} disabled={!can(user, 'editor')}>Unpublish</Btn> : null}
                  {a.status === 'trashed' ? <><Btn size="sm" onClick={() => act(a, 'restore', 'Restored')}>Restore</Btn><Btn size="sm" kind="danger" onClick={() => destroy(a)}>Delete</Btn></> : can(user, 'editor') ? <Btn size="sm" onClick={() => trash(a)}>Trash</Btn> : null}
                  {a.status === 'published' && can(user, 'editor') ? <Btn size="sm" onClick={() => act(a, 'archive', 'Archived')}>Archive</Btn> : null}
                </div></td>
              </tr>))}</tbody>
          </table></div>
          <nav className="a-pager" aria-label="Pagination"><Btn size="sm" disabled={q.page <= 1} onClick={() => set({ page: String(q.page - 1) })}>Previous</Btn><span>Page {list.data.page} of {list.data.totalPages} · {list.data.total} articles</span><Btn size="sm" disabled={q.page >= list.data.totalPages} onClick={() => set({ page: String(q.page + 1) })}>Next</Btn></nav>
        </>
      )}
      {dialog}
    </>
  );
}
