import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.js';
import { fetchComments, postComment } from '../services/apiSource.js';
import { formatDate } from '../utils/format.js';
import './Comments.css';

export default function Comments({ slug }) {
  const { config } = useApp();
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', body: '', website: '' });
  const [state, setState] = useState({ status: 'idle', message: '' });
  useEffect(() => { let off = false; fetchComments(config, slug).then((c) => { if (!off) setList(c); }).catch(() => { if (!off) setList([]); }); return () => { off = true; }; }, [config, slug]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (form.name.trim().length < 1 || form.body.trim().length < 3) return setState({ status: 'error', message: 'Please add your name and a comment of at least a few words.' });
    setState({ status: 'sending', message: '' });
    try {
      const r = await postComment(config, slug, { ...form, email: form.email.trim() || undefined });
      setState({ status: 'done', message: r.message || 'Thanks. Your comment will appear once a moderator approves it.' });
      setForm({ name: '', email: '', body: '', website: '' });
    } catch (err) { setState({ status: 'error', message: err.message }); }
  }
  return (
    <section className="comments" aria-labelledby="comments-h">
      <h2 id="comments-h">Comments</h2>
      {list && list.length ? <ul className="comments__list">{list.map((c) => <li key={c.id}><p className="comments__who"><strong>{c.name}</strong> <time dateTime={c.createdAt}>{formatDate(c.createdAt)}</time></p><p>{c.body}</p></li>)}</ul> : <p className="comments__none">{list ? 'No comments yet. Be the first to add one.' : 'Loading comments…'}</p>}
      <form className="comments__form" onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="c-name">Name</label><input id="c-name" className="input" value={form.name} onChange={set('name')} maxLength={60} autoComplete="name" /></div>
        <div className="field"><label htmlFor="c-email">Email <span className="comments__opt">(optional, never shown)</span></label><input id="c-email" type="email" className="input" value={form.email} onChange={set('email')} autoComplete="email" /></div>
        <div className="field"><label htmlFor="c-body">Comment</label><textarea id="c-body" className="input comments__ta" rows={4} value={form.body} onChange={set('body')} maxLength={2000} /></div>
        <div className="comments__trap" aria-hidden="true"><label htmlFor="c-web">Leave this empty</label><input id="c-web" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></div>
        <button type="submit" className="btn btn--primary" disabled={state.status === 'sending'}>{state.status === 'sending' ? 'Posting…' : 'Post comment'}</button>
        <p className={`comments__status${state.status === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">{state.message}</p>
      </form>
    </section>
  );
}
