// Browser stand-in for react-router-dom (history API based). Used ONLY by the optional e2e harness.
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
const Ctx = createContext(null);
const nav = { listeners: new Set() };
const here = () => ({ pathname: location.pathname, search: location.search, hash: location.hash });

export function BrowserRouter({ children }) {
  const [loc, setLoc] = useState(here());
  useEffect(() => { const f = () => setLoc(here()); window.addEventListener('popstate', f); nav.listeners.add(f); return () => { window.removeEventListener('popstate', f); nav.listeners.delete(f); }; }, []);
  return createElement(Ctx.Provider, { value: loc }, children);
}
export const StaticRouter = BrowserRouter;
export const useLocation = () => useContext(Ctx);
export function useNavigate() {
  return useCallback((to, opts = {}) => { history[opts.replace ? 'replaceState' : 'pushState'](null, '', to); nav.listeners.forEach((f) => f()); }, []);
}
export function Link({ to, children, replace, onClick, ...rest }) {
  const navigate = useNavigate();
  return createElement('a', { href: to, ...rest, onClick: (e) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || rest.target === '_blank') return;
    if (/^https?:|^mailto:/.test(to)) return;
    e.preventDefault(); navigate(to, { replace });
  } }, children);
}
export function NavLink({ to, className, children, ...rest }) {
  const { pathname } = useLocation();
  const isActive = to !== '/' && pathname.startsWith(to);
  return createElement(Link, { to, className: typeof className === 'function' ? className({ isActive }) : className, ...rest }, children);
}
export function useSearchParams() {
  const loc = useLocation(); const navigate = useNavigate();
  const sp = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  return [sp, (next) => navigate(`${loc.pathname}${next.toString() ? `?${next}` : ''}`)];
}
