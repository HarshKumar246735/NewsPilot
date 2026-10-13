import { useEffect, useRef } from 'react';
import './Dialog.css';

// Thin wrapper around the native <dialog>: browser-provided focus trapping, Esc to close and inert background.
export default function Dialog({ open, onClose, label, className = '', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector('[data-autofocus]')?.focus();
    } else if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`dialog ${className}`} aria-label={label} onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open ? <div className="dialog__panel">{children}</div> : null}
    </dialog>
  );
}
