import { useState } from 'react';
import { useAdmin } from '../AdminContext.js';
import { useAsync, Spinner, ErrorBox, PageHead, StatusBadge, Empty, Btn, fmtDate, useConfirm } from '../ui.jsx';

export function Subscribers() {
  const { api, toast } = useAdmin();
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/subscribers'), []);
  const [confirm, dialog] = useConfirm();
  async function remove(s) { if (await confirm({ title: 'Delete subscriber?', message: `${s.email} will be removed permanently.`, danger: true, confirm: 'Delete' })) { try { await api.del(`/admin/subscribers/${s.id}`); toast('Subscriber deleted'); reload(); } catch (e) { toast(e.message, 'bad'); } } }
  return (
    <>
      <PageHead title="Newsletter subscribers" sub={data ? `${data.total} people have signed up.` : ''}><Btn onClick={() => api.download('/admin/subscribers/export.csv', 'subscribers.csv').catch((e) => toast(e.message, 'bad'))}>Export CSV</Btn></PageHead>
      {loading ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data.items.length ? <Empty title="No subscribers yet">Signups from the website form appear here, with the time consent was given.</Empty> : (
        <div className="a-table-wrap"><table className="a-table"><thead><tr><th>Email</th><th>Status</th><th>Consent given</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{data.items.map((s) => <tr key={s.id}><td>{s.email}</td><td><StatusBadge status={s.status} /></td><td>{fmtDate(s.consentAt)}</td><td className="a-actions"><Btn size="sm" kind="danger" onClick={() => remove(s)}>Delete</Btn></td></tr>)}</tbody></table></div>
      )}
      {dialog}
    </>
  );
}

export function Comments() {
  const { api, toast } = useAdmin();
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/comments?status=${status}`), [status]);
  async function set(c, st) { try { await api.put(`/admin/comments/${c.id}`, { status: st }); toast(st === 'approved' ? 'Comment approved' : 'Marked as spam'); reload(); } catch (e) { toast(e.message, 'bad'); } }
  async function del(c) { try { await api.del(`/admin/comments/${c.id}`); toast('Comment deleted'); reload(); } catch (e) { toast(e.message, 'bad'); } }
  return (
    <>
      <PageHead title="Comments" sub="Nothing is shown publicly until you approve it. Turn comments on in Settings." />
      <div className="a-tabs" role="tablist">{['pending', 'approved', 'spam'].map((s) => <button key={s} type="button" role="tab" aria-selected={status === s} className="a-tab" onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div>
      {loading ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data.items.length ? <Empty title={`No ${status} comments`} /> : (
        <ul className="a-stack">{data.items.map((c) => (
          <li key={c.id} className="a-card"><p><strong>{c.name}</strong> on <em>{c.articleTitle}</em> <small>{fmtDate(c.createdAt)}</small></p><p className="a-quote">{c.body}</p>
            <div className="a-actions">{c.status !== 'approved' ? <Btn size="sm" kind="primary" onClick={() => set(c, 'approved')}>Approve</Btn> : null}{c.status !== 'spam' ? <Btn size="sm" onClick={() => set(c, 'spam')}>Spam</Btn> : null}<Btn size="sm" kind="danger" onClick={() => del(c)}>Delete</Btn></div></li>))}</ul>
      )}
    </>
  );
}

export function Audit() {
  const { api } = useAdmin();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/audit?page=${page}`), [page]);
  return (
    <>
      <PageHead title="Audit log" sub="Who changed what, newest first." />
      {loading ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : (
        <>
          <div className="a-table-wrap"><table className="a-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>{data.items.map((a) => <tr key={a.id}><td>{fmtDate(a.createdAt)}</td><td>{a.userEmail}</td><td><code>{a.action}</code></td><td>{a.summary}</td></tr>)}</tbody></table></div>
          <nav className="a-pager" aria-label="Pagination"><Btn size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</Btn><span>Page {page} · {data.total} entries</span><Btn size="sm" disabled={page * 50 >= data.total} onClick={() => setPage(page + 1)}>Older</Btn></nav>
        </>
      )}
    </>
  );
}
