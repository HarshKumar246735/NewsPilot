import { useEffect, useState } from 'react';
import { useAdmin } from '../AdminContext.js';
import { useAsync, Spinner, ErrorBox, PageHead, Btn, Field, Select, Check, Empty } from '../ui.jsx';

export default function Homepage() {
  const { api, toast } = useAdmin();
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/homepage'), []);
  const [h, setH] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setH({ heroId: data.item.heroId || '', secondaryIds: [...data.item.secondaryIds, '', '', ''].slice(0, 3), pickIds: [...data.item.pickIds, '', '', '', ''].slice(0, 4), sections: data.item.sections.length ? data.item.sections : data.categories.map((c) => ({ categorySlug: c.slug, enabled: true })), customSections: data.item.sections.length > 0 }); }, [data]);
  if (loading || !h) return error ? <ErrorBox error={error} onRetry={reload} /> : <Spinner />;
  if (!data.candidates.length) return <><PageHead title="Homepage" /><Empty title="Publish an article first">The homepage can only feature published articles. Until you choose, it shows the newest stories automatically.</Empty></>;
  const opts = (<>{<option value="">Automatic</option>}{data.candidates.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</>);
  const setIn = (key, i, v) => setH((s) => ({ ...s, [key]: s[key].map((x, j) => (j === i ? v : x)) }));
  const move = (i, d) => setH((s) => { const a = [...s.sections]; const j = i + d; if (j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return { ...s, sections: a, customSections: true }; });
  async function save() {
    setBusy(true);
    const clean = (arr) => [...new Set(arr.filter(Boolean))];
    try { await api.put('/admin/homepage', { homepage: { heroId: h.heroId || null, secondaryIds: clean(h.secondaryIds), pickIds: clean(h.pickIds), trendingIds: data.item.trendingIds, sections: h.customSections ? h.sections : [] } }); toast('Homepage saved'); reload(); } catch (x) { toast(x.message, 'bad'); }
    setBusy(false);
  }
  const catName = (s) => data.categories.find((c) => c.slug === s)?.name || s;
  return (
    <>
      <PageHead title="Homepage" sub="Choose what leads the front page. Anything left on “Automatic” is filled with the newest or featured stories."><Btn kind="primary" busy={busy} onClick={save}>Save homepage</Btn></PageHead>
      <div className="a-grid a-grid--2">
        <section className="a-card"><h2>Lead story</h2>
          <Field label="Main story">{(p) => <Select {...p} value={h.heroId} onChange={(e) => setH({ ...h, heroId: e.target.value })}>{opts}</Select>}</Field>
          {h.secondaryIds.map((v, i) => <Field key={i} label={`Secondary story ${i + 1}`}>{(p) => <Select {...p} value={v} onChange={(e) => setIn('secondaryIds', i, e.target.value)}>{opts}</Select>}</Field>)}
        </section>
        <section className="a-card"><h2>Editor’s picks</h2>
          {h.pickIds.map((v, i) => <Field key={i} label={`Pick ${i + 1}`}>{(p) => <Select {...p} value={v} onChange={(e) => setIn('pickIds', i, e.target.value)}><option value="">None</option>{data.candidates.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</Select>}</Field>)}
          <p className="a-muted">The section is hidden when no picks are chosen.</p>
        </section>
        <section className="a-card"><h2>Category sections</h2>
          <p className="a-muted">Order and visibility of the sections below the fold. Sections with no articles are never shown.</p>
          <ul className="a-stack">{h.sections.map((s, i) => (
            <li key={s.categorySlug} className="hp-row"><Check label={catName(s.categorySlug)} checked={s.enabled !== false} onChange={(e) => setH((st) => ({ ...st, customSections: true, sections: st.sections.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)) }))} />
              <span className="a-actions"><Btn size="sm" aria-label={`Move ${catName(s.categorySlug)} up`} onClick={() => move(i, -1)}>↑</Btn><Btn size="sm" aria-label={`Move ${catName(s.categorySlug)} down`} onClick={() => move(i, 1)}>↓</Btn></span></li>))}</ul>
          {h.customSections ? <Btn size="sm" onClick={() => setH({ ...h, customSections: false, sections: data.categories.map((c) => ({ categorySlug: c.slug, enabled: true })) })}>Reset to automatic order</Btn> : null}
        </section>
        <section className="a-card"><h2>Trending and most read</h2><p>These lists are built from page views recorded on your site. They stay hidden until there are views, and nothing is invented.</p></section>
      </div>
    </>
  );
}
