import { useEffect, useRef, useState } from 'react';
import { useAdmin } from '../AdminContext.js';
import { Field, Input, Textarea, Btn, Badge } from '../ui.jsx';
import './SeoPanel.css';

const WARN = 'attention';
function Counter({ n, max }) { return <span className={`seo-count${n > max ? ' is-over' : ''}`} aria-live="off">{n}/{max}</span>; }

// Shows what the SEO engine generated from the article, lets the editor override any of it, and previews how it will look.
export default function SeoPanel({ form, set, articleId, errs, onInsertLink, siteName }) {
  const { api } = useAdmin();
  const [res, setRes] = useState(null);
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const body = { id: articleId || undefined, title: form.title, dek: form.dek, excerpt: form.excerpt, contentHtml: form.contentHtml, slug: form.slug || undefined, seoTitle: form.seoTitle || undefined, metaDescription: form.metaDescription || undefined, canonicalUrl: form.canonicalUrl || undefined, categorySlug: form.categorySlug || undefined, tags: form.tags.split(',').map((x) => x.trim()).filter(Boolean), isNews: form.isNews, image: form.image?.url ? { ...form.image } : undefined };
        const r = await api.post('/admin/articles/analyze', body);
        if (n === seq.current) { setRes(r); setProblem(null); }
      } catch (e) { if (n === seq.current) setProblem(e); }
      if (n === seq.current) setLoading(false);
    }, 900);
    return () => clearTimeout(t);
  }, [form.title, form.dek, form.excerpt, form.contentHtml, form.slug, form.seoTitle, form.metaDescription, form.canonicalUrl, form.categorySlug, form.tags, form.isNews, form.image?.url, form.image?.alt, articleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = res ? { attention: res.checklist.items.filter((i) => i.status === WARN), optional: res.checklist.items.filter((i) => i.status === 'optional'), passed: res.checklist.items.filter((i) => i.status === 'passed') } : null;
  const host = res?.social.domain || siteName;
  return (
    <div className="seo" aria-busy={loading}>
      <p className="seo__note">Everything below is generated from your article’s own text. Type in a field to override it; clear it to go back to automatic.</p>
      {problem ? <p className="seo__problem" role="alert">Analysis paused: {problem.fields && Object.values(problem.fields)[0] ? String(Object.values(problem.fields)[0]) : problem.message}</p> : null}

      <Field label={<>SEO title <Counter n={(form.seoTitle || res?.seoTitle.value || '').length} max={60} /></>} error={errs.seoTitle} help={!form.seoTitle && res ? 'Automatic' : 'Written by you'}>{(p) => <Input {...p} value={form.seoTitle} placeholder={res?.seoTitle.value || ''} maxLength={120} onChange={(e) => set({ seoTitle: e.target.value })} />}</Field>
      <Field label={<>Meta description <Counter n={(form.metaDescription || res?.metaDescription.value || '').length} max={155} /></>} error={errs.metaDescription} help={!form.metaDescription && res ? 'Automatic: taken from the summary or opening paragraphs. Google may choose a different snippet.' : 'Written by you. Google may choose a different snippet.'}>{(p) => <Textarea {...p} value={form.metaDescription} placeholder={res?.metaDescription.value || ''} maxLength={320} onChange={(e) => set({ metaDescription: e.target.value })} />}</Field>
      <Field label="URL slug" error={errs.slug || (res && !res.slug.available ? 'Another article already uses this slug' : res && form.slug && !res.slug.valid ? 'Use lowercase letters, numbers and hyphens (some words are reserved)' : undefined)} help={res ? `Suggested: ${res.slug.suggested || '—'}` : undefined}>{(p) => <Input {...p} value={form.slug} placeholder={res?.slug.suggested || ''} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} />}</Field>
      <Field label="Canonical URL" error={errs.canonicalUrl} help="Leave empty to use this article’s own address on your production domain.">{(p) => <Input {...p} value={form.canonicalUrl} placeholder={res?.canonical || ''} onChange={(e) => set({ canonicalUrl: e.target.value })} />}</Field>
      <p className="seo__warn-slug">{form.slug && form.published ? 'Changing the slug of a published article adds a permanent redirect from the old address.' : ''}</p>

      {res ? <>
        <section aria-labelledby="seo-prev"><h3 id="seo-prev">Search result preview</h3>
          <div className="serp"><div className="serp__url">{res.searchPreview.url}</div><div className="serp__title">{res.searchPreview.title}</div><div className="serp__desc">{res.searchPreview.description}</div></div>
          <p className="seo__note">An approximation. Google decides what to show.</p></section>
        <section aria-labelledby="seo-soc"><h3 id="seo-soc">Social sharing preview</h3>
          <div className="social">{res.social.image ? <img src={res.social.image} alt="" /> : <div className="social__none">No image: add a featured image or a default social image in Settings</div>}<div className="social__txt"><small>{host}</small><strong>{res.social.title || 'Headline'}</strong><span>{res.social.description}</span></div></div></section>

        <section aria-labelledby="seo-kw"><h3 id="seo-kw">Topic and keyword suggestions</h3>
          {res.keywords.primary ? <p><Badge kind="info">Main topic</Badge> <strong>{res.keywords.primary}</strong></p> : <p className="seo__note">Write more text to get suggestions.</p>}
          {res.keywords.secondary.length ? <ul className="seo__chips" aria-label="Related terms">{res.keywords.secondary.map((k) => <li key={k}>{k}</li>)}</ul> : null}
          {res.keywords.longTail.length ? <><p className="seo__sub">Longer phrases already in your text</p><ul className="seo__chips">{res.keywords.longTail.map((k) => <li key={k}>{k}</li>)}</ul></> : null}
          <p className="seo__note">{res.keywords.note} Use terms where they fit naturally; never force them in.</p></section>

        <section aria-labelledby="seo-il"><h3 id="seo-il">Internal link suggestions</h3>
          {res.internalLinks.length ? <ul className="seo__links">{res.internalLinks.map((l) => <li key={l.id}><strong>{l.title}</strong><small>Shares: {l.matchedTerms.join(', ')}{l.alreadyLinked ? ' · already linked' : ''}</small><Btn size="sm" onClick={() => onInsertLink(l)}>Insert link at cursor</Btn></li>)}</ul> : <p className="seo__note">No related published articles found yet. Suggestions only ever point to articles that exist.</p>}</section>

        <section aria-labelledby="seo-ck"><h3 id="seo-ck">SEO checklist</h3>
          <p className="seo__note"><strong>{groups.passed.length}</strong> passed · <strong>{groups.attention.length}</strong> need attention · <strong>{groups.optional.length}</strong> optional</p>
          {[['attention', 'Needs attention', 'bad'], ['optional', 'Optional improvements', 'warn'], ['passed', 'Passed', 'good']].map(([k, label, kind]) => groups[k].length ? (
            <details key={k} open={k !== 'passed'} className="seo__group"><summary><Badge kind={kind}>{label}</Badge> {groups[k].length}</summary><ul>{groups[k].map((i) => <li key={i.id}>{i.label}{i.detail ? <small> ({i.detail})</small> : null}</li>)}</ul></details>) : null)}
          <p className="seo__note">{res.notes[1]}</p></section>

        <details className="seo__group"><summary>Structured data (JSON-LD) preview</summary>{res.jsonLd ? <pre tabIndex={0}>{JSON.stringify(res.jsonLd, null, 2)}</pre> : <p className="seo__note">Add a headline and set the production site URL in Settings to see it.</p>}</details>
      </> : loading ? <p className="seo__note">Analysing…</p> : null}
    </div>
  );
}
