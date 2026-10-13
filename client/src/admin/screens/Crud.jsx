import { useState } from 'react';
import { useAdmin } from '../AdminContext.js';
import { useAsync, Spinner, ErrorBox, PageHead, Empty, Btn, Modal, Field, Input, Textarea, Select, Check, Badge, errFields, useConfirm } from '../ui.jsx';

// One generic list + create/edit/delete screen, configured per resource. All validation is done by the API;
// field-level errors it returns are shown next to the matching inputs.
function Crud({ title, sub, endpoint, noun, columns, fields, blank, itemsExtra, reorder, canWrite = true }) {
  const { api, toast } = useAdmin();
  const { data, loading, error, reload } = useAsync(() => api.get(endpoint), [endpoint]);
  const [form, setForm] = useState(null); // { id?, values }
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, dialog] = useConfirm();
  const items = data?.items || [];
  const open = (it) => { setErrs({}); setForm({ id: it?.id, values: { ...blank, ...(it || {}) } }); };
  const set = (k, v) => setForm((f) => ({ ...f, values: { ...f.values, [k]: v } }));

  async function save(e) {
    e.preventDefault(); setBusy(true); setErrs({});
    const body = Object.fromEntries(fields.filter((f) => !f.showIf || f.showIf(form.values)).map((f) => [f.name, f.type === 'number' ? Number(form.values[f.name] || 0) : form.values[f.name] === '' && f.nullable ? null : form.values[f.name]]).filter(([k, v]) => !(k === 'password' && !v)));
    try { await (form.id ? api.put(`${endpoint}/${form.id}`, body) : api.post(endpoint, body)); toast(`${noun} saved`); setForm(null); reload(); }
    catch (x) { setErrs(errFields(x)); if (!Object.keys(errFields(x)).length) toast(x.message, 'bad'); }
    setBusy(false);
  }
  async function remove(it) {
    if (!(await confirm({ title: `Delete ${noun.toLowerCase()}?`, message: `"${it.name || it.email || it.from}" will be deleted.`, danger: true, confirm: 'Delete' }))) return;
    try { await api.del(`${endpoint}/${it.id}`); toast(`${noun} deleted`); reload(); } catch (x) { toast(x.message, 'bad'); }
  }
  async function move(it, dir) {
    const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const i = sorted.findIndex((x) => x.id === it.id), j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    try { await Promise.all([api.put(`${endpoint}/${it.id}`, { order: j }), api.put(`${endpoint}/${sorted[j].id}`, { order: i })]); reload(); } catch (x) { toast(x.message, 'bad'); }
  }

  return (
    <>
      <PageHead title={title} sub={sub}>{canWrite ? <Btn kind="primary" onClick={() => open(null)}>Add {noun.toLowerCase()}</Btn> : null}</PageHead>
      {loading ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : !items.length ? <Empty title={`No ${noun.toLowerCase()}s yet`}>{canWrite ? `Use “Add ${noun.toLowerCase()}” to create the first one.` : ''}</Empty> : (
        <div className="a-table-wrap"><table className="a-table">
          <thead><tr>{columns.map((c) => <th key={c.label}>{c.label}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{(reorder ? [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : items).map((it) => (
            <tr key={it.id}>{columns.map((c) => <td key={c.label}>{c.render ? c.render(it, items) : it[c.key]}</td>)}
              <td><div className="a-actions">{reorder ? <><Btn size="sm" aria-label={`Move ${it.name} up`} onClick={() => move(it, -1)}>↑</Btn><Btn size="sm" aria-label={`Move ${it.name} down`} onClick={() => move(it, 1)}>↓</Btn></> : null}
                {canWrite ? <><Btn size="sm" onClick={() => open(it)}>Edit</Btn><Btn size="sm" kind="danger" onClick={() => remove(it)}>Delete</Btn></> : null}</div></td></tr>))}</tbody>
        </table></div>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? `Edit ${noun.toLowerCase()}` : `Add ${noun.toLowerCase()}`}
        footer={<><Btn onClick={() => setForm(null)}>Cancel</Btn><Btn kind="primary" busy={busy} onClick={save}>Save</Btn></>}>
        {form ? <form onSubmit={save} className="a-formgrid" noValidate>{fields.filter((f) => !f.showIf || f.showIf(form.values)).map((f) => (
          <Field key={f.name} label={f.label} error={errs[f.name]} help={f.help}>{(p) => {
            const v = form.values[f.name] ?? '';
            if (f.type === 'checkbox') return <Check {...p} label={f.checkLabel || f.label} checked={!!form.values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />;
            if (f.type === 'textarea') return <Textarea {...p} value={v} onChange={(e) => set(f.name, e.target.value)} />;
            if (f.type === 'select') return <Select {...p} value={v} onChange={(e) => set(f.name, e.target.value)}>{(typeof f.options === 'function' ? f.options(items, form) : f.options).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
            return <Input {...p} type={f.type || 'text'} value={v} autoComplete={f.type === 'password' ? 'new-password' : undefined} onChange={(e) => set(f.name, e.target.value)} />;
          }}</Field>))}
          <button type="submit" hidden />
        </form> : null}
      </Modal>
      {dialog}{itemsExtra}
    </>
  );
}

const yes = (v) => (v ? <Badge kind="good">Yes</Badge> : <Badge>No</Badge>);

export const Categories = () => (
  <Crud title="Categories" sub="Sections of the site. Sub-categories appear under their parent in the menu." endpoint="/admin/categories" noun="Category" reorder blank={{ enabled: true, primary: false, order: 0, parentSlug: '' }}
    columns={[{ label: 'Name', render: (c) => <strong>{c.parentSlug ? '— ' : ''}{c.name}</strong> }, { label: 'URL', render: (c) => <code>/category/{c.parentSlug ? `${c.parentSlug}/` : ''}{c.slug}</code> }, { label: 'In main menu', render: (c) => yes(c.primary) }, { label: 'Visible', render: (c) => yes(c.enabled !== false) }]}
    fields={[{ name: 'name', label: 'Name' }, { name: 'slug', label: 'URL slug', help: 'Leave empty to generate it from the name.' }, { name: 'parentSlug', label: 'Parent category', type: 'select', nullable: true, options: (items, f) => [{ value: '', label: 'None (top level)' }, ...items.filter((c) => !c.parentSlug && c.id !== f.id).map((c) => ({ value: c.slug, label: c.name }))] },
      { name: 'description', label: 'Description', type: 'textarea', help: 'Shown at the top of the category page and used in search results.' }, { name: 'seoTitle', label: 'SEO title (optional)' }, { name: 'seoDescription', label: 'SEO description (optional)', type: 'textarea' },
      { name: 'primary', label: 'Main menu', type: 'checkbox', checkLabel: 'Show in the main navigation bar' }, { name: 'enabled', label: 'Visibility', type: 'checkbox', checkLabel: 'Visible on the site' }]} />
);
export const Authors = () => (
  <Crud title="Authors" sub="People credited on articles. Each has a public profile page." endpoint="/admin/authors" noun="Author" blank={{}}
    columns={[{ label: 'Name', render: (a) => <strong>{a.name}</strong> }, { label: 'Profile', render: (a) => <code>/author/{a.slug}</code> }, { label: 'Bio', key: 'bio' }]}
    fields={[{ name: 'name', label: 'Name' }, { name: 'slug', label: 'URL slug', help: 'Leave empty to generate it.' }, { name: 'bio', label: 'Short bio', type: 'textarea', help: 'Shown on the article and the author page.' }, { name: 'email', label: 'Email (private)', type: 'email' }]} />
);
export const Redirects = () => (
  <Crud title="Redirects" sub="Permanent redirects keep old links working. Changing a published article's URL adds one automatically." endpoint="/admin/redirects" noun="Redirect" blank={{ status: 301 }}
    columns={[{ label: 'From', render: (r) => <code>{r.from}</code> }, { label: 'To', render: (r) => <code>{r.to}</code> }, { label: 'Type', render: (r) => <Badge>{r.status}</Badge> }, { label: 'Origin', render: (r) => (r.auto ? 'Automatic' : 'Manual') }]}
    fields={[{ name: 'from', label: 'Old path', help: 'For example /old-page' }, { name: 'to', label: 'New path or URL', help: 'For example /category/world' }, { name: 'status', label: 'Type', type: 'select', options: [{ value: 301, label: '301 Permanent' }, { value: 302, label: '302 Temporary' }] }]} />
);
const PLACEMENTS = [['header', 'Top of every page'], ['homepage-feed', 'Homepage, between sections'], ['article-body', 'Inside articles'], ['article-sidebar', 'Article sidebar (large screens)'], ['article-end', 'End of article'], ['footer', 'Above the footer']];
export const Ads = () => (
  <Crud title="Advertising" sub="Every placement is labelled “Advertisement” or “Sponsored”. Turn on AdSense and set your publisher ID in Settings first." endpoint="/admin/ads" noun="Placement" blank={{ type: 'adsense', placement: 'article-sidebar', enabled: false }} canWrite
    columns={[{ label: 'Name', render: (a) => <strong>{a.name}</strong> }, { label: 'Where', render: (a) => PLACEMENTS.find((p) => p[0] === a.placement)?.[1] || a.placement }, { label: 'Type', key: 'type' }, { label: 'Live', render: (a) => yes(a.enabled) }]}
    fields={[{ name: 'name', label: 'Name' }, { name: 'placement', label: 'Placement', type: 'select', options: PLACEMENTS.map(([value, label]) => ({ value, label })) }, { name: 'type', label: 'Type', type: 'select', options: [{ value: 'adsense', label: 'Google AdSense ad unit' }, { value: 'banner', label: 'Direct banner (image + link)' }] },
      { name: 'slot', label: 'AdSense slot ID', showIf: (v) => v.type === 'adsense', help: 'Numbers only, from your AdSense ad unit.' }, { name: 'imageUrl', label: 'Banner image URL (https)', showIf: (v) => v.type === 'banner' }, { name: 'linkUrl', label: 'Banner link (https)', showIf: (v) => v.type === 'banner' }, { name: 'alt', label: 'Image description', showIf: (v) => v.type === 'banner' },
      { name: 'enabled', label: 'Status', type: 'checkbox', checkLabel: 'Live on the site' }]} />
);
export const Users = () => (
  <Crud title="Users" sub="Admins manage everything, editors publish, authors write drafts." endpoint="/admin/users" noun="User" blank={{ role: 'author', active: true }}
    columns={[{ label: 'Name', render: (u) => <strong>{u.name}</strong> }, { label: 'Email', key: 'email' }, { label: 'Role', render: (u) => <Badge kind={u.role === 'admin' ? 'info' : 'neutral'}>{u.role}</Badge> }, { label: 'Active', render: (u) => yes(u.active) }]}
    fields={[{ name: 'name', label: 'Name' }, { name: 'email', label: 'Email', type: 'email' }, { name: 'role', label: 'Role', type: 'select', options: [{ value: 'author', label: 'Author: drafts only' }, { value: 'editor', label: 'Editor: can publish' }, { value: 'admin', label: 'Admin: everything' }] },
      { name: 'password', label: 'Password', type: 'password', help: 'At least 12 characters. Leave empty to keep the current one. Setting one signs the user out everywhere.' }, { name: 'active', label: 'Account', type: 'checkbox', checkLabel: 'Can sign in' }]} />
);
