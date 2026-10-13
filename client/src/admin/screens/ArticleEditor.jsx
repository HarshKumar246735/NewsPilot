import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../AdminContext.js';
import { can } from '../api.js';
import { useAsync, Spinner, ErrorBox, StatusBadge, Btn, Field, Input, Textarea, Select, Check, errFields, useConfirm, fmtDate } from '../ui.jsx';
import RichText from './RichText.jsx';
import SeoPanel from './SeoPanel.jsx';
import { MediaPicker } from './Media.jsx';
import './ArticleEditor.css';

const BLANK = { title: '', dek: '', excerpt: '', contentHtml: '', slug: '', categorySlug: '', authorSlug: '', tags: '', image: null, seoTitle: '', metaDescription: '', canonicalUrl: '', isFeatured: false, isBreaking: false, isNews: false, commentsEnabled: true, sponsoredBy: '', hasAffiliateLinks: false };
const FIELDS = Object.keys(BLANK);
const fromApi = (a) => ({ ...BLANK, ...Object.fromEntries(FIELDS.filter((k) => a[k] !== undefined && a[k] !== null).map((k) => [k, a[k]])), tags: (a.tags || []).join(', ') });
const toApi = (f) => ({ ...f, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), image: f.image?.url ? f.image : null, slug: f.slug || undefined, seoTitle: f.seoTitle || undefined, metaDescription: f.metaDescription || undefined, canonicalUrl: f.canonicalUrl || undefined });
const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

export default function ArticleEditor({ id }) {
  const { api, user, toast } = useAdmin();
  const navigate = useNavigate();
  const editor = useRef(null);
  const [form, setForm] = useState(BLANK);
  const [meta, setMeta] = useState({ id, status: 'draft' });
  const [saved, setSaved] = useState(JSON.stringify(BLANK));
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState('publish');
  const [picker, setPicker] = useState(null); // 'body' | 'featured'
  const [warnings, setWarnings] = useState(null);
  const [when, setWhen] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const [confirm, dialog] = useConfirm();

  const lists = useAsync(async () => { const [c, a] = await Promise.all([api.get('/admin/categories'), api.get('/admin/authors')]); return { cats: c.items, authors: a.items }; }, []);
  const loaded = useAsync(async () => {
    if (!id) return null;
    const { item } = await api.get(`/admin/articles/${id}`);
    const f = fromApi(item);
    setForm(f); setSaved(JSON.stringify(f)); setMeta({ id: item.id, status: item.status, publishedAt: item.publishedAt, updatedAt: item.updatedAt }); setWhen(toLocalInput(item.publishedAt)); setResetKey((k) => k + 1);
    return item;
  }, [id]);

  // New article: default the author to the signed-in user's own author profile.
  useEffect(() => { if (!id && lists.data) { const mine = lists.data.authors.find((a) => a.userId === user.id); if (mine) setForm((f) => (f.authorSlug ? f : { ...f, authorSlug: mine.slug })); } }, [id, lists.data, user.id]);
  useEffect(() => { if (!id) setResetKey((k) => k + 1); }, [id]);

  const set = useCallback((patch) => setForm((f) => ({ ...f, ...patch })), []);
  const dirty = useMemo(() => JSON.stringify(form) !== saved, [form, saved]);
  useEffect(() => { const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);

  const isAuthor = !can(user, 'editor');
  const locked = isAuthor && meta.status !== 'draft' && !!meta.id;

  async function save({ quiet } = {}) {
    setBusy('save'); setErrs({});
    try {
      const body = toApi(form);
      const { item } = meta.id ? await api.put(`/admin/articles/${meta.id}`, body) : await api.post('/admin/articles', body);
      const f = fromApi(item); setForm((cur) => ({ ...cur, slug: f.slug, excerpt: f.excerpt })); setSaved(JSON.stringify({ ...form, slug: f.slug, excerpt: f.excerpt }));
      setMeta({ id: item.id, status: item.status, publishedAt: item.publishedAt, updatedAt: item.updatedAt });
      if (!quiet) toast('Saved');
      if (!meta.id) navigate(`/admin/articles/${item.id}`, { replace: true });
      setBusy(''); return item;
    } catch (e) { const fe = errFields(e); setErrs(fe); toast(Object.keys(fe).length ? 'Please fix the highlighted fields' : e.message, 'bad'); setBusy(''); return null; }
  }
  useEffect(() => { const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!locked) save(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }); // eslint-disable-line

  async function transition(action, body, msg) {
    const item = await save({ quiet: true }); if (!item) return;
    setBusy(action);
    try {
      const r = await api.post(`/admin/articles/${item.id}/${action}`, body || {});
      setMeta((m) => ({ ...m, status: r.article.status, publishedAt: r.article.publishedAt })); setWarnings(r.warnings?.length ? r.warnings : null); toast(msg);
      if (action === 'trash') navigate('/admin/articles');
    } catch (e) { const fe = errFields(e); setErrs(fe); toast(Object.keys(fe).length ? `Cannot continue: ${Object.values(fe)[0]}` : e.message, 'bad'); }
    setBusy('');
  }
  async function toTrash() { if (await confirm({ title: 'Move to trash?', message: 'It will be hidden from the site and can be restored from the trash.', confirm: 'Move to trash', danger: true })) transition('trash', {}, 'Moved to trash'); }

  if (lists.loading || loaded.loading) return <Spinner />;
  if (lists.error || loaded.error) return <ErrorBox error={lists.error || loaded.error} onRetry={() => { lists.reload(); loaded.reload(); }} />;
  const { cats, authors } = lists.data;
  const live = meta.status === 'published';
  const scheduled = meta.status === 'scheduled';

  return (
    <div className="ed">
      <div className="ed__bar">
        <Link to="/admin/articles" className="a-btn a-btn--sm a-btn--ghost">← Articles</Link>
        <span className="ed__state">{meta.id ? <StatusBadge status={meta.status} /> : <span className="a-badge">new</span>} <span aria-live="polite">{dirty ? 'Unsaved changes' : meta.updatedAt ? `Saved ${fmtDate(meta.updatedAt)}` : ''}</span></span>
        <span className="ed__actions">
          {meta.id ? <a className="a-btn a-btn--sm" href={`/admin/preview/${meta.id}`} target="_blank" rel="noopener noreferrer">Preview<span className="sr-only"> (opens in a new tab)</span></a> : null}
          <Btn size="sm" onClick={() => save()} busy={busy === 'save'} disabled={locked}>Save draft</Btn>
          {isAuthor ? <Btn size="sm" kind="primary" busy={busy === 'review'} disabled={locked || !meta.id && !form.title} onClick={() => transition('review', {}, 'Sent to an editor for review')}>Submit for review</Btn>
            : live ? <Btn size="sm" kind="primary" busy={busy === 'publish'} onClick={() => transition('publish', {}, 'Changes published')}>Update published article</Btn>
              : <Btn size="sm" kind="primary" busy={busy === 'publish'} onClick={() => transition('publish', {}, 'Published')}>Publish now</Btn>}
        </span>
      </div>

      {warnings ? <div className="ed__warn" role="status"><strong>Published, with {warnings.length} suggestion{warnings.length > 1 ? 's' : ''} from the SEO checklist:</strong><ul>{warnings.map((w) => <li key={w.id}>{w.label}</li>)}</ul><Btn size="sm" onClick={() => setWarnings(null)}>Dismiss</Btn></div> : null}
      {locked ? <div className="ed__warn" role="note">This article was sent for review, so it is read-only. An editor can return it to you as a draft.</div> : null}

      <div className="ed__grid">
        <div className="ed__main">
          <Field label="Headline" error={errs.title}>{(p) => <Input {...p} className="ed__title" value={form.title} placeholder="Write a clear, accurate headline" maxLength={200} disabled={locked} onChange={(e) => set({ title: e.target.value })} />}</Field>
          <Field label="Subheadline (optional)" error={errs.dek}>{(p) => <Input {...p} value={form.dek} maxLength={300} disabled={locked} onChange={(e) => set({ dek: e.target.value })} />}</Field>
          <div className="ed__body">
            <span className="a-label" id="body-l">Article</span>
            <RichText ref={editor} initialHtml={form.contentHtml} resetKey={resetKey} onChange={(html) => set({ contentHtml: html })} onPickImage={() => setPicker('body')} />
            {errs.contentHtml ? <p className="a-field__err" role="alert">{errs.contentHtml}</p> : null}
          </div>
          <Field label="Summary" error={errs.excerpt} help="Shown on cards and used for the meta description. Leave empty to generate it from the subheadline or opening text.">{(p) => <Textarea {...p} value={form.excerpt} maxLength={400} disabled={locked} onChange={(e) => set({ excerpt: e.target.value })} />}</Field>
        </div>

        <aside className="ed__side" aria-label="Article settings">
          <div className="a-tabs" role="tablist">{[['publish', 'Publish'], ['image', 'Image'], ['seo', 'SEO']].map(([k, l]) => <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} className="a-tab" onClick={() => setTab(k)}>{l}</button>)}</div>

          <div role="tabpanel" id="panel-publish" aria-labelledby="tab-publish" hidden={tab !== 'publish'} className="ed__panel">
            <Field label="Category" error={errs.categorySlug}>{(p) => <Select {...p} value={form.categorySlug} disabled={locked} onChange={(e) => set({ categorySlug: e.target.value })}><option value="">Choose a category</option>{cats.map((c) => <option key={c.id} value={c.slug}>{c.parentSlug ? '— ' : ''}{c.name}</option>)}</Select>}</Field>
            <Field label="Author" error={errs.authorSlug}>{(p) => <Select {...p} value={form.authorSlug} disabled={locked} onChange={(e) => set({ authorSlug: e.target.value })}><option value="">Choose an author</option>{authors.map((a) => <option key={a.id} value={a.slug}>{a.name}</option>)}</Select>}</Field>
            <Field label="Tags" error={errs.tags} help="Separate with commas. Tag “guide” to list it under Popular guides.">{(p) => <Input {...p} value={form.tags} disabled={locked} onChange={(e) => set({ tags: e.target.value })} />}</Field>
            {!isAuthor ? <>
              <Check label="Featured story" help="Eligible for the homepage lead." checked={form.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} />
              <Check label="Breaking news" help="Shows in the ticker once published." checked={form.isBreaking} onChange={(e) => set({ isBreaking: e.target.checked })} />
            </> : null}
            <Check label="Original news reporting" help="Marks the structured data as NewsArticle. Leave off for explainers and guides." checked={form.isNews} disabled={locked} onChange={(e) => set({ isNews: e.target.checked })} />
            <Check label="Allow comments" checked={form.commentsEnabled} disabled={locked} onChange={(e) => set({ commentsEnabled: e.target.checked })} />
           
            {!isAuthor ? (
              <fieldset className="ed__sched"><legend>Schedule</legend>
                <Field label="Publish at" error={errs.publishedAt}>{(p) => <Input {...p} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />}</Field>
                <div className="a-actions"><Btn size="sm" disabled={!when} busy={busy === 'schedule'} onClick={() => transition('schedule', { publishedAt: new Date(when).toISOString() }, 'Scheduled')}>{scheduled ? 'Reschedule' : 'Schedule'}</Btn>
                  {live || scheduled ? <Btn size="sm" onClick={() => transition('unpublish', {}, 'Moved back to draft')}>Unpublish</Btn> : null}
                  {live ? <Btn size="sm" onClick={() => transition('archive', {}, 'Archived')}>Archive</Btn> : null}
                  {meta.id ? <Btn size="sm" kind="danger" onClick={toTrash}>Trash</Btn> : null}</div>
                <p className="a-muted">Times are in your browser’s time zone.{scheduled ? ` Goes live ${fmtDate(meta.publishedAt)}.` : ''}</p>
              </fieldset>) : null}
          </div>

          <div role="tabpanel" id="panel-image" aria-labelledby="tab-image" hidden={tab !== 'image'} className="ed__panel">
            {form.image?.url ? <img className="ed__img" src={form.image.url} alt="" width={form.image.width} height={form.image.height} /> : <p className="a-muted">No featured image yet. Articles with a good image are more engaging in lists and when shared.</p>}
            <div className="a-actions"><Btn size="sm" disabled={locked} onClick={() => setPicker('featured')}>{form.image?.url ? 'Change image' : 'Choose image'}</Btn>{form.image?.url ? <Btn size="sm" disabled={locked} onClick={() => set({ image: null })}>Remove</Btn> : null}</div>
            {form.image?.url ? <>
              <Field label="Alt text" error={errs.image?.alt || errs.image} help="Describe what the image shows, for people using screen readers and for search engines.">{(p) => <Input {...p} value={form.image.alt || ''} disabled={locked} onChange={(e) => set({ image: { ...form.image, alt: e.target.value } })} />}</Field>
              <Field label="Caption"><Input value={form.image.caption || ''} disabled={locked} onChange={(e) => set({ image: { ...form.image, caption: e.target.value } })} /></Field>
              <Field label="Credit"><Input value={form.image.credit || ''} disabled={locked} onChange={(e) => set({ image: { ...form.image, credit: e.target.value } })} /></Field>
            </> : null}
          </div>

          <div role="tabpanel" id="panel-seo" aria-labelledby="tab-seo" hidden={tab !== 'seo'} className="ed__panel">
            <SeoPanel form={{ ...form, published: live || scheduled }} set={set} articleId={meta.id} errs={errs} siteName="NewsPilot" onInsertLink={(l) => editor.current?.insertLink(l.path, l.title)} />
          </div>
        </aside>
      </div>

      <MediaPicker open={!!picker} onClose={() => setPicker(null)} onPick={(m) => { if (picker === 'featured') set({ image: { url: m.url, alt: m.alt || '', caption: m.caption || '', credit: m.credit || '', width: m.width, height: m.height, publicId: m.publicId } }); else editor.current?.insertImage(m); if (!m.alt) toast('This image has no alt text yet. Add some in the media library.', 'bad'); setPicker(null); }} />
      {dialog}
    </div>
  );
}
