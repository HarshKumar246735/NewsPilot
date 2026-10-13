import { createContext, createElement, useContext } from 'react';
const Ctx = createContext({ pathname: '/', search: '', hash: '' });
export function StaticRouter({ location, children }) {
  const u = new URL(location, 'http://local');
  return createElement(Ctx.Provider, { value: { pathname: u.pathname, search: u.search, hash: u.hash } }, children);
}
export const BrowserRouter = StaticRouter;
export const useLocation = () => useContext(Ctx);
export const useNavigate = () => () => {};
export const Link = ({ to, children, ...rest }) => createElement('a', { href: to, ...rest }, children);
export const NavLink = ({ to, className, children, ...rest }) => {
  const { pathname } = useContext(Ctx);
  const isActive = to !== '/' && pathname.startsWith(to);
  return createElement('a', { href: to, className: typeof className === 'function' ? className({ isActive }) : className, ...rest }, children);
};
