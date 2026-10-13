import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAdmin } from './AdminContext.js';
import './ui.css';

export function useAsync(fn, deps = []) {
  const [s, setS] = useState({ loading: true, data: null, error: null });
  const run = useCallback(async () => {
    setS((p) => ({ ...p, loading: true, error: null }));
    try { setS({ loading: false, data: await fn(), error: null }); } catch (e) { setS({ loading: false, data: null, error: e }); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, [run]);
  return { ...s, reload: run };
}

export const Spinner = ({ label = 'Loading' }) => <div className="a-spin" role="status"><span className="a-spin__dot" aria-hidden="true" />{label}…</div>;
export const ErrorBox = ({ error, onRetry }) => (
  <div className="a-error" role="alert"><strong>Something went wrong.</strong> {error?.message || 'Please try again.'}{onRetry ? <button type="button" className="a-btn a-btn--sm" onClick={onRetry}>Try again</button> : null}</div>
);
export const Empty = ({ title, children }) => <div className="a-empty"><h3>{title}</h3>{children ? <p>{children}</p> : null}</div>;
export const PageHead = ({ title, children, sub }) => (<header className="a-head"><div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div><div className="a-head__actions">{children}</div></header>);
export const Badge = ({ kind = 'neutral', children }) => <span className={`a-badge a-badge--${kind}`}>{children}</span>;
const STATUS_KIND = { published: 'good', scheduled: 'info', draft: 'neutral', review: 'warn', archived: 'neutral', trashed: 'bad', approved: 'good', pending: 'warn', spam: 'bad', subscribed: 'good', unsubscribed: 'neutral' };
export const StatusBadge = ({ status }) => <Badge kind={STATUS_KIND[status] || 'neutral'}>{status}</Badge>;

export function Btn({ kind = 'default', size, busy, children, ...p }) {
  return <button type="button" {...p} disabled={p.disabled || busy} className={`a-btn a-btn--${kind}${size ? ` a-btn--${size}` : ''} ${p.className || ''}`}>{busy ? 'Working…' : children}</button>;
}

export function Field({ label, error, help, children, className = '' }) {
  const id = useId();
  const child = typeof children === 'function' ? children({ id, 'aria-invalid': !!error || undefined, 'aria-describedby': error ? `${id}-e` : help ? `${id}-h` : undefined }) : children;
  return (
    <div className={`a-field ${className}`}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      {child}
      {error ? <p className="a-field__err" id={`${id}-e`} role="alert">{typeof error === 'string' ? error : 'Invalid value'}</p> : help ? <p className="a-field__help" id={`${id}-h`}>{help}</p> : null}
    </div>
  );
}
export const Input = (p) => <input {...p} className={`a-input ${p.className || ''}`} />;
export const Textarea = (p) => <textarea {...p} className={`a-input a-textarea ${p.className || ''}`} />;
export const Select = ({ options, children, ...p }) => <select {...p} className={`a-input ${p.className || ''}`}>{children || options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
export function Check({ label, help, ...p }) { return <label className="a-check"><input type="checkbox" {...p} /><span>{label}{help ? <small>{help}</small> : null}</span></label>; }

export function Modal({ open, onClose, title, children, wide, footer }) {
  const ref = useRef(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); else if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} className={`a-modal${wide ? ' a-modal--wide' : ''}`} aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open ? <div className="a-modal__panel"><header><h2>{title}</h2><button type="button" className="a-x" aria-label="Close" onClick={onClose}>×</button></header><div className="a-modal__body">{children}</div>{footer ? <footer>{footer}</footer> : null}</div> : null}
    </dialog>
  );
}

export function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (opts) => new Promise((resolve) => setState({ ...opts, resolve }));
  const done = (v) => { state.resolve(v); setState(null); };
  const dialog = (
    <Modal open={!!state} onClose={() => done(false)} title={state?.title || 'Are you sure?'} footer={<><Btn onClick={() => done(false)}>Cancel</Btn><Btn kind={state?.danger ? 'danger' : 'primary'} onClick={() => done(true)}>{state?.confirm || 'Confirm'}</Btn></>}>
      <p>{state?.message}</p>
    </Modal>
  );
  return [ask, dialog];
}

export const useToast = () => useAdmin().toast;
export const fmtDate = (iso) => (iso ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(iso)) : '—');
export const errFields = (e) => (e?.fields && typeof e.fields === 'object' ? e.fields : {});
