import { useAdmin } from '../AdminContext.js';
import { useAsync, Spinner, ErrorBox, PageHead, Empty, Btn, Input, Badge, fmtDate } from '../ui.jsx';
import { useState } from 'react';

const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export default function Breaking() {
  const { api, toast } = useAdmin();
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/articles?status=published'), []);
  const [until, setUntil] = useState({});
  async function toggle(a, on) {
    try { await api.put(`/admin/articles/${a.id}`, { isBreaking: on, breakingUntil: on && until[a.id] ? new Date(until[a.id]).toISOString() : null }); toast(on ? 'Added to the breaking-news ticker' : 'Removed from the ticker'); reload(); } catch (x) { toast(x.message, 'bad'); }
  }
  return (
    <>
      <PageHead title="Breaking news" sub="Flagged published stories appear in the ticker under the header (newest five). Leave the end time empty to keep a story until you remove it." />
      {loading ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data.items.length ? <Empty title="No published articles">Publish an article, then flag it here.</Empty> : (
        <div className="a-table-wrap"><table className="a-table"><thead><tr><th>Article</th><th>Published</th><th>Ticker until (optional)</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{data.items.map((a) => (
            <tr key={a.id}><td><strong>{a.title}</strong> {a.isBreaking ? <Badge kind="bad">In ticker</Badge> : null}</td><td>{fmtDate(a.publishedAt)}</td>
              <td><Input type="datetime-local" aria-label={`Ticker end time for ${a.title}`} value={until[a.id] ?? toLocal(a.breakingUntil)} onChange={(e) => setUntil({ ...until, [a.id]: e.target.value })} /></td>
              <td><div className="a-actions">{a.isBreaking ? <><Btn size="sm" onClick={() => toggle(a, true)}>Update</Btn><Btn size="sm" onClick={() => toggle(a, false)}>Remove</Btn></> : <Btn size="sm" kind="primary" onClick={() => toggle(a, true)}>Add to ticker</Btn>}</div></td></tr>))}</tbody></table></div>
      )}
    </>
  );
}
