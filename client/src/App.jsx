import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from './context/AppContext.js';
import { createDataSource } from './services/dataSource.js';
import { resolvePage } from './resolve.js';
import { matchRoute } from './routes.js';
import { applyHead } from './headDom.js';
// import DemoBanner from './components/DemoBanner.jsx';
import Header from './components/Header.jsx';
import BreakingTicker from './components/BreakingTicker.jsx';
import Newsletter from './components/Newsletter.jsx';
import Footer from './components/Footer.jsx';
import AdSlot from './components/AdSlot.jsx';
import ConsentBanner from './components/ConsentBanner.jsx';
import PageSkeleton from './components/Skeletons.jsx';
import Home from './pages/Home.jsx';
import ArticlePage from './pages/ArticlePage.jsx';
import { CategoryPage, AuthorPage, LatestPage, TrendingPage, SearchPage } from './pages/Listings.jsx';
import CategoriesPage from './pages/CategoriesPage.jsx';
import StaticPage from './pages/StaticPage.jsx';
import { NotFoundPage, ErrorPage } from './pages/ErrorPages.jsx';
import './styles/global.css';

// The admin app is a separate chunk: public visitors never download it.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));
const Loading = () => <div className="admin-boot" role="status">Loading…</div>;
function AdminHost({ config }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []); // server and first client render are identical; the admin UI mounts after hydration
  return ready ? <Suspense fallback={<Loading />}><AdminApp config={config} /></Suspense> : <Loading />;
}

const PAGES = {
  home: Home, article: ArticlePage, category: CategoryPage, author: AuthorPage, latest: LatestPage, trending: TrendingPage,
  search: SearchPage, categories: CategoriesPage, page: StaticPage, notFound: NotFoundPage, error: ErrorPage,
};

// `initial` = { config, shell, page, now }, produced by the server and embedded in the HTML.
export default function App({ initial }) {
  const location = useLocation();
  const navigate = useNavigate();
  const key = location.pathname + location.search;
  const [page, setPage] = useState(initial.page);
  const [slow, setSlow] = useState(false);
  const mainRef = useRef(null);
  const dsRef = useRef(null);

  useEffect(() => {
    if (key === page.key) return undefined;
    if (key.startsWith('/admin')) { setPage((p) => ({ ...p, key })); return undefined; } // admin navigation is handled inside the admin app
    let cancelled = false;
    const timer = setTimeout(() => setSlow(true), 180); // only show a skeleton if loading is noticeably slow
    (async () => {
      try {
        dsRef.current ||= await createDataSource(initial.config);
        const next = await resolvePage(key, dsRef.current, initial.shell, initial.config);
        if (cancelled) return;
        if (next.redirect) { if (/^https?:/.test(next.redirect)) window.location.assign(next.redirect); else navigate(next.redirect, { replace: true }); return; }
        applyHead(next.head);
        setPage(next);
        if (!location.hash) window.scrollTo(0, 0);
        mainRef.current?.focus({ preventScroll: true });
      } catch {
        if (!cancelled) window.location.assign(key); // let the server render it
      } finally {
        clearTimeout(timer);
        if (!cancelled) setSlow(false);
      }
    })();
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (page.name === 'admin') return <AdminHost config={initial.config} />;
  const Page = PAGES[page.name] || NotFoundPage;
  const loading = slow && key !== page.key;
  return (
    <AppContext.Provider value={{ config: initial.config, shell: initial.shell, now: initial.now }}>
      <a className="skip-link" href="#main">Skip to content</a>
      {/* <DemoBanner /> */}
      <Header />
      <BreakingTicker />
      <AdSlot placement="header" className="container" />
      <main id="main" tabIndex={-1} ref={mainRef}>
        {loading ? <PageSkeleton name={matchRoute(location.pathname)?.name} /> : <Page page={page} />}
      </main>
      <Newsletter />
      <AdSlot placement="footer" className="container" />
      <Footer />
      <ConsentBanner />
    </AppContext.Provider>
  );
}
