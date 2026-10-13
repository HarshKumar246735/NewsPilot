import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AdminCtx } from './AdminContext.js';
import { createAdminApi, can, tokenStore } from './api.js';
import { Spinner, Btn, Field, Input, ErrorBox } from './ui.jsx';
import Dashboard from './screens/Dashboard.jsx';
import Articles from './screens/Articles.jsx';
import ArticleEditor from './screens/ArticleEditor.jsx';
import Preview from './screens/Preview.jsx';
import Media from './screens/Media.jsx';
import Homepage from './screens/Homepage.jsx';
import Breaking from './screens/Breaking.jsx';
import Settings from './screens/Settings.jsx';
import Account from './screens/Account.jsx';
import { Categories, Authors, Redirects, Ads, Users } from './screens/Crud.jsx';
import { Subscribers, Comments, Audit } from './screens/Lists.jsx';
import './admin.css';

const NAV = [
  ['Overview', [['/admin', 'Dashboard', 'author']]],
  ['Content', [['/admin/articles', 'Articles', 'author'], ['/admin/categories', 'Categories', 'author'], ['/admin/authors', 'Authors', 'editor'], ['/admin/media', 'Media library', 'author']]],
  ['Front page', [['/admin/homepage', 'Homepage', 'editor'], ['/admin/breaking', 'Breaking news', 'editor']]],
  ['Audience', [['/admin/comments', 'Comments', 'editor'], ['/admin/newsletter', 'Newsletter', 'admin']]],
  ['Site', [['/admin/ads', 'Advertising', 'editor'], ['/admin/redirects', 'Redirects', 'editor'], ['/admin/users', 'Users', 'admin'], ['/admin/settings', 'Settings', 'admin'], ['/admin/audit', 'Audit log', 'admin']]],
];

function Login({ api, onLogin }) {
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setErr(null); setBusy(true);
    try { onLogin(await api.login(f.email, f.password)); } catch (x) { setErr(x); setBusy(false); }
  }
  return (
    <main className="a-login">
      <form className="a-login__card" onSubmit={submit}>
        <h1>NewsPilot</h1><p>Sign in to the newsroom</p>
        <Field label="Email">{(p) => <Input {...p} type="email" autoComplete="username" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Password">{(p) => <Input {...p} type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}</Field>
        {err ? <ErrorBox error={err} /> : null}
        <Btn kind="primary" type="submit" busy={busy}>Sign in</Btn>
      </form>
    </main>
  );
}

function route(path) {
  const seg = path.replace(/\/+$/, '').split('/').filter(Boolean).slice(1);
  const [a, b] = seg;
  if (!a) return { C: Dashboard };
  if (a === 'articles') return b === 'new' ? { C: ArticleEditor, props: { id: null } } : b ? { C: ArticleEditor, props: { id: b } } : { C: Articles };
  if (a === 'preview' && b) return { C: Preview, props: { id: b } };
  const map = { categories: Categories, authors: Authors, media: Media, homepage: Homepage, breaking: Breaking, ads: Ads, redirects: Redirects, comments: Comments, newsletter: Subscribers, users: Users, settings: Settings, audit: Audit, account: Account };
  return map[a] ? { C: map[a] } : { C: null };
}
const MIN = { authors: 'editor', homepage: 'editor', breaking: 'editor', comments: 'editor', ads: 'editor', redirects: 'editor', newsletter: 'admin', users: 'admin', settings: 'admin', audit: 'admin' };

export default function AdminApp({ config }) {
  const api = useMemo(() => createAdminApi(config), [config]);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(undefined);
  const [toasts, setToasts] = useState([]);
  const [menu, setMenu] = useState(false);
  const toast = useCallback((message, kind = 'good') => { const id = Math.random(); setToasts((t) => [...t, { id, message, kind }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500); }, []);

  useEffect(() => {
    const out = () => setUser(null);
    window.addEventListener('np-admin-logout', out);
    if (tokenStore.get()) api.get('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)); else setUser(null);
    return () => window.removeEventListener('np-admin-logout', out);
  }, [api]);
  useEffect(() => { setMenu(false); }, [pathname]);
  useEffect(() => { document.title = 'Admin · NewsPilot'; }, []);

  if (user === undefined) return <Spinner />;
  if (!user) return <Login api={api} onLogin={(u) => { setUser(u); navigate('/admin'); }} />;

  const { C, props } = route(pathname);
  const seg = pathname.split('/')[2];
  const allowed = !MIN[seg] || can(user, MIN[seg]);
  const logout = () => { api.logout(); setUser(null); navigate('/admin'); };
  const ctx = { api, user, config, toast };
  const preview = pathname.startsWith('/admin/preview/');

  return (
    <AdminCtx.Provider value={ctx}>
      {preview ? <C {...props} /> : (
        <div className="a-shell">
          <a className="skip-link" href="#a-main">Skip to content</a>
          <aside className={`a-side${menu ? ' is-open' : ''}`} aria-label="Admin navigation">
            <div className="a-side__brand"><span aria-hidden="true">N</span> NewsPilot <small>newsroom</small></div>
            <nav>
              {NAV.map(([group, items]) => {
                const vis = items.filter(([, , min]) => can(user, min));
                return vis.length ? (
                  <div key={group}><h2>{group}</h2><ul>{vis.map(([to, label]) => <li key={to}><Link to={to} aria-current={(to === '/admin' ? pathname === '/admin' : pathname === to || pathname.startsWith(`${to}/`)) ? 'page' : undefined}>{label}</Link></li>)}</ul></div>
                ) : null;
              })}
            </nav>
            <div className="a-side__foot">
              <p><strong>{user.name}</strong><br /><span>{user.role}</span></p>
              <Link to="/admin/account" className="a-btn a-btn--sm a-btn--ghost">Account</Link>
              <Btn size="sm" onClick={logout}>Sign out</Btn>
              <a className="a-side__site" href="/" target="_blank" rel="noopener noreferrer">View site<span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </aside>
          <div className="a-main">
            <div className="a-top"><button type="button" className="a-menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>Menu</button><span>NewsPilot newsroom</span></div>
            <main id="a-main" className="a-content">
              {!allowed ? <ErrorBox error={{ message: 'You do not have permission to view this page.' }} /> : C ? <C key={pathname} {...props} /> : <ErrorBox error={{ message: 'That admin page does not exist.' }} />}
            </main>
          </div>
        </div>
      )}
      <div className="a-toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`a-toast a-toast--${t.kind}`}>{t.message}</div>)}</div>
    </AdminCtx.Provider>
  );
}
