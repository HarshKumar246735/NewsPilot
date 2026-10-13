import { useEffect, useState } from 'react';
import { useAdmin } from '../AdminContext.js';
import { useAsync, Spinner, ErrorBox, PageHead, Btn, Field, Input, Textarea, Check, Badge, errFields } from '../ui.jsx';

const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const setIn = (o, p, v) => { const [k, ...r] = p.split('.'); return { ...o, [k]: r.length ? setIn(o[k] || {}, r.join('.'), v) : v }; };

const SECTIONS = [
  ['Publication', [['name', 'Site name'], ['tagline', 'Tagline'], ['url', 'Production site URL', 'text', 'Your public https address, e.g. https://www.example.com. Used for canonical links, the sitemap and social cards. The SITE_URL on the frontend deployment takes priority.'], ['description', 'Site description', 'textarea'], ['publisher.name', 'Publisher name'], ['logoUrl', 'Logo URL (https)'], ['faviconUrl', 'Favicon URL (https)'], ['defaultImage', 'Default social image URL (https)', 'text', 'Used when an article has no featured image. Use a JPG or PNG, 1200×630.']]],
  ['Search defaults', [['defaultSeoTitle', 'Default SEO title'], ['defaultMetaDescription', 'Default meta description', 'textarea']]],
  ['Contact', [['contact.email', 'Public contact email', 'email'], ['contact.phone', 'Phone'], ['contact.address', 'Address', 'textarea']]],
  ['Social profiles', [['social.x', 'X (Twitter) URL'], ['social.facebook', 'Facebook URL'], ['social.instagram', 'Instagram URL'], ['social.youtube', 'YouTube URL'], ['social.linkedin', 'LinkedIn URL']]],
  ['Search Console and analytics', [['searchConsoleVerification', 'Search Console verification token', 'text', 'Only the token: the value of content="…" in the HTML-tag method. Then verify the site and submit /sitemap.xml in Search Console.'], ['analytics.ga4Id', 'Google Analytics 4 measurement ID', 'text', 'Looks like G-XXXXXXXXXX. It only loads for visitors who accept cookies.']]],
  ['Advertising', [['ads.enabled', 'Enable AdSense', 'check', 'Turn on only once Google has approved your site.'], ['ads.adsenseClient', 'AdSense publisher ID', 'text', 'Looks like ca-pub-1234567890123456.'], ['ads.adsTxt', 'ads.txt contents', 'textarea', 'Served at /ads.txt. Copy the line Google gives you.']]],
  ['Newsletter and comments', [['newsletter.enabled', 'Accept newsletter signups', 'check'], ['newsletter.doubleOptIn', 'Require email confirmation', 'check', 'Needs an email provider (see Integrations below).'], ['comments.enabled', 'Allow comments on articles', 'check', 'Comments are always held for moderation.']]],
];

export default function Settings() {
  const { api, toast } = useAdmin();
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/settings'), []);
  const [v, setV] = useState(null);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setV(data.item); }, [data]);
  if (loading || !v) return error ? <ErrorBox error={error} onRetry={reload} /> : <Spinner />;
  const err = (p) => { const x = get(errs, p); return typeof x === 'string' ? x : undefined; };
  async function save() {
    setBusy(true); setErrs({});
    const { homepage, ...rest } = v;
    try { setV((await api.put('/admin/settings', rest)).item); toast('Settings saved'); } catch (x) { setErrs(errFields(x)); toast(Object.keys(errFields(x)).length ? 'Please fix the highlighted fields' : x.message, 'bad'); }
    setBusy(false);
  }
  const ig = data.integrations;
  return (
    <>
      <PageHead title="Settings" sub="Site-wide configuration."><Btn kind="primary" busy={busy} onClick={save}>Save settings</Btn></PageHead>
      <div className="a-stack">
        {SECTIONS.map(([title, fields]) => (
          <section className="a-card" key={title} aria-labelledby={`s-${title}`}><h2 id={`s-${title}`}>{title}</h2>
            <div className="a-grid a-grid--2">{fields.map(([path, label, type, help]) => (
              <Field key={path} label={type === 'check' ? undefined : label} error={err(path)} help={help} className={type === 'textarea' ? 'a-span' : ''}>{(p) => type === 'check'
                ? <Check {...p} label={label} help={help} checked={!!get(v, path)} onChange={(e) => setV(setIn(v, path, e.target.checked))} />
                : type === 'textarea' ? <Textarea {...p} value={get(v, path) || ''} onChange={(e) => setV(setIn(v, path, e.target.value))} />
                  : <Input {...p} type={type === 'email' ? 'email' : 'text'} value={get(v, path) || ''} onChange={(e) => setV(setIn(v, path, e.target.value))} />}</Field>))}</div>
          </section>))}
        <section className="a-card" aria-labelledby="s-int"><h2 id="s-int">Integrations (set on the API server)</h2>
          <ul className="a-stack">
            <li>Database: <Badge kind={ig.database === 'mongo' ? 'good' : 'warn'}>{ig.database === 'mongo' ? 'MongoDB Atlas' : 'In-memory (data is lost on restart)'}</Badge></li>
            <li>Image uploads: <Badge kind={ig.cloudinary ? 'good' : 'warn'}>{ig.cloudinary ? 'Cloudinary connected' : 'Cloudinary not configured'}</Badge></li>
            <li>Transactional email: <Badge kind={ig.mail ? 'good' : 'neutral'}>{ig.mail ? 'Resend connected' : 'Not configured'}</Badge></li>
            <li>Site URL from environment: <code>{ig.siteUrlFromEnv || 'not set'}</code></li>
          </ul>
        </section>
      </div>
    </>
  );
}
