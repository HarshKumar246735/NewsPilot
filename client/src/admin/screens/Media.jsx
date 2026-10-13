import { useRef, useState } from 'react';
import { useAdmin } from '../AdminContext.js';
import { useAsync, Spinner, ErrorBox, PageHead, Empty, Btn, Modal, Field, Input, errFields, useConfirm } from '../ui.jsx';
import './Media.css';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const MAX = 8 * 1024 * 1024;
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

const toBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('Could not read the file')); r.readAsDataURL(file); });

export async function uploadImage(api, file, caps, meta = {}) {
  if (!TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP, GIF or AVIF image.');
  if (file.size > MAX) throw new Error('Images must be 8 MB or smaller.');
  if (caps.cloudinaryEnabled) {
    const s = await api.post('/admin/media/sign');
    const fd = new FormData();
    fd.append('file', file); fd.append('api_key', s.apiKey); fd.append('timestamp', s.params.timestamp); fd.append('signature', s.signature);
    fd.append('folder', s.params.folder); fd.append('allowed_formats', s.params.allowed_formats);
    const res = await fetch(s.uploadUrl, { method: 'POST', body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error?.message || 'Cloudinary rejected the upload.');
    return (await api.post('/admin/media', { url: j.secure_url, publicId: j.public_id, width: j.width, height: j.height, bytes: j.bytes, format: j.format, originalName: file.name, ...meta })).item;
  }
  if (caps.localEnabled) return (await api.post('/admin/media/local', { data: await toBase64(file), originalName: file.name, ...meta })).item;
  throw new Error('Image uploads are not set up. Add your Cloudinary keys to the API (see the README).');
}

export function MediaGrid({ items, onPick, onEdit, onDelete }) {
  return (
    <ul className="media-grid">{items.map((m) => (
      <li key={m.id} className="media-card">
        <button type="button" className="media-card__thumb" onClick={() => (onPick || onEdit)(m)} aria-label={`${onPick ? 'Use' : 'Edit'} ${m.alt || m.originalName || 'image'}`}><img src={m.url} alt="" width={m.width} height={m.height} loading="lazy" /></button>
        <div className="media-card__meta"><strong title={m.originalName}>{m.originalName || m.format}</strong><span>{m.width}×{m.height} · {kb(m.bytes)}</span><span className={m.alt ? '' : 'media-card__warn'}>{m.alt ? m.alt : 'No alt text'}</span></div>
        {onEdit ? <div className="a-actions"><Btn size="sm" onClick={() => onEdit(m)}>Details</Btn>{onDelete ? <Btn size="sm" kind="danger" onClick={() => onDelete(m)}>Delete</Btn> : null}</div> : null}
      </li>))}</ul>
  );
}

export function useUploader(api, caps, toast, onDone) {
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const input = <input ref={ref} type="file" accept={TYPES.join(',')} hidden onChange={async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setBusy(true);
    try { const item = await uploadImage(api, f, caps); toast('Image uploaded. Add alt text so it is accessible.'); onDone(item); } catch (x) { toast(x.message, 'bad'); }
    setBusy(false);
  }} />;
  return { busy, input, open: () => ref.current?.click() };
}

export default function Media() {
  const { api, toast } = useAdmin();
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAsync(() => api.get(`/admin/media?q=${encodeURIComponent(q)}`), [q]);
  const [edit, setEdit] = useState(null);
  const [errs, setErrs] = useState({});
  const [confirm, dialog] = useConfirm();
  const up = useUploader(api, data || {}, toast, (it) => { reload(); setEdit(it); });
  async function save() {
    try { await api.put(`/admin/media/${edit.id}`, { alt: edit.alt || '', caption: edit.caption || '', credit: edit.credit || '' }); toast('Saved'); setEdit(null); reload(); } catch (x) { setErrs(errFields(x)); toast(x.message, 'bad'); }
  }
  async function del(m) {
    if (!(await confirm({ title: 'Delete image?', message: 'This removes it from the library. Images used by articles cannot be deleted.', danger: true, confirm: 'Delete' }))) return;
    try { await api.del(`/admin/media/${m.id}`); toast('Image deleted'); reload(); } catch (x) { toast(x.message, 'bad'); }
  }
  return (
    <>
      <PageHead title="Media library" sub={data ? (data.cloudinaryEnabled ? 'Uploads go to Cloudinary.' : data.localEnabled ? 'Cloudinary is not configured: uploads are stored on the API server (development only).' : 'No upload provider is configured.') : ''}>
        <Btn kind="primary" busy={up.busy} onClick={up.open} disabled={data && !data.cloudinaryEnabled && !data.localEnabled}>Upload image</Btn>{up.input}
      </PageHead>
      <div className="a-filters"><Input aria-label="Search media" placeholder="Search by alt text, caption or file name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {loading ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data.items.length ? <Empty title="No images yet">Upload an image to start your library.</Empty> : <MediaGrid items={data.items} onEdit={(m) => { setErrs({}); setEdit(m); }} onDelete={del} />}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Image details" footer={<><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save</Btn></>}>
        {edit ? <>
          <img src={edit.url} alt="" className="media-preview" width={edit.width} height={edit.height} />
          <p className="a-muted">{edit.width}×{edit.height} px · {kb(edit.bytes)} · {edit.format}</p>
          <Field label="Alt text" error={errs.alt} help="Describe what the image shows, for people who cannot see it. Leave empty only for purely decorative images.">{(p) => <Input {...p} value={edit.alt || ''} onChange={(e) => setEdit({ ...edit, alt: e.target.value })} />}</Field>
          <Field label="Caption" error={errs.caption}>{(p) => <Input {...p} value={edit.caption || ''} onChange={(e) => setEdit({ ...edit, caption: e.target.value })} />}</Field>
          <Field label="Credit" error={errs.credit}>{(p) => <Input {...p} value={edit.credit || ''} onChange={(e) => setEdit({ ...edit, credit: e.target.value })} />}</Field>
        </> : null}
      </Modal>
      {dialog}
    </>
  );
}

// Used by the article editor: pick an existing image or upload a new one.
export function MediaPicker({ open, onClose, onPick }) {
  const { api, toast } = useAdmin();
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useAsync(() => (open ? api.get(`/admin/media?q=${encodeURIComponent(q)}`) : Promise.resolve({ items: [] })), [open, q]);
  const up = useUploader(api, data || {}, toast, (it) => onPick(it));
  return (
    <Modal open={open} onClose={onClose} title="Choose an image" wide footer={<><Btn onClick={onClose}>Cancel</Btn><Btn busy={up.busy} onClick={up.open} disabled={data && !data.cloudinaryEnabled && !data.localEnabled}>Upload new image</Btn>{up.input}</>}>
      <Input aria-label="Search images" placeholder="Search images" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <Spinner /> : error ? <ErrorBox error={error} onRetry={reload} /> : !data.items.length ? <Empty title="No images">Upload one to get started.</Empty> : <MediaGrid items={data.items} onPick={onPick} />}
    </Modal>
  );
}
