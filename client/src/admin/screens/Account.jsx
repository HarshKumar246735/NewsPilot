import { useState } from 'react';
import { useAdmin } from '../AdminContext.js';
import { tokenStore } from '../api.js';
import { PageHead, Btn, Field, Input, errFields } from '../ui.jsx';

export default function Account() {
  const { api, user, toast } = useAdmin();
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  async function change(e) {
    e.preventDefault(); setBusy(true); setErrs({});
    try { const r = await api.post('/auth/change-password', f); tokenStore.set(r.token); setF({ currentPassword: '', newPassword: '' }); toast('Password changed. Other devices were signed out.'); } catch (x) { setErrs(errFields(x)); toast(Object.keys(errFields(x)).length ? 'Please fix the highlighted fields' : x.message, 'bad'); }
    setBusy(false);
  }
  async function everywhere() { try { await api.post('/auth/logout-all'); api.logout(); window.dispatchEvent(new Event('np-admin-logout')); } catch (x) { toast(x.message, 'bad'); } }
  return (
    <>
      <PageHead title="Your account" sub={`${user.name} · ${user.email} · ${user.role}`} />
      <div className="a-grid a-grid--2">
        <form className="a-card a-formgrid" onSubmit={change}><h2>Change password</h2>
          <Field label="Current password" error={errs.currentPassword}>{(p) => <Input {...p} type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />}</Field>
          <Field label="New password" error={errs.newPassword} help="At least 12 characters.">{(p) => <Input {...p} type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />}</Field>
          <Btn kind="primary" type="submit" busy={busy}>Change password</Btn>
        </form>
        <section className="a-card a-formgrid"><h2>Sessions</h2><p>Sign out of every browser and device, including this one. Use it if you think someone else has your password.</p><Btn kind="danger" onClick={everywhere}>Sign out everywhere</Btn></section>
      </div>
    </>
  );
}
