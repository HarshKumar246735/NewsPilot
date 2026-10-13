import { Link } from 'react-router-dom';
import { useAdmin } from '../AdminContext.js';
import { useAsync, Spinner, ErrorBox, PageHead, StatusBadge, Empty, fmtDate } from '../ui.jsx';
import { can } from '../api.js';
import './Dashboard.css';

export default function Dashboard() {
  const { api, user } = useAdmin();
  const { data: d, loading, error, reload } = useAsync(() => api.get('/admin/dashboard'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const stat = (label, value, to) => <Link to={to} className="dash-stat"><strong>{value}</strong><span>{label}</span></Link>;
  return (
    <>
      <PageHead title={`Welcome, ${user.name.split(' ')[0]}`} sub="What needs your attention in the newsroom today.">
        <Link className="a-btn a-btn--primary" to="/admin/articles/new">Write an article</Link>
      </PageHead>
      <div className="dash-stats">
        {stat('Published', d.counts.published, '/admin/articles?status=published')}{stat('Drafts', d.counts.draft, '/admin/articles?status=draft')}
        {stat('In review', d.counts.review, '/admin/articles?status=review')}{stat('Scheduled', d.counts.scheduled, '/admin/articles?status=scheduled')}
        {stat('Sections', d.categories, '/admin/categories')}
        {can(user, 'editor') ? stat('Comments to moderate', d.comments.pending, '/admin/comments') : null}
      </div>
      <div className="a-grid a-grid--2 dash-cols">
        <section className="a-card" aria-labelledby="d-seo"><h2 id="d-seo">SEO issues needing attention</h2>
          {d.seoIssues.length ? <ul className="dash-list">{d.seoIssues.map((a) => <li key={a.id}><Link to={`/admin/articles/${a.id}`}>{a.title}</Link> <StatusBadge status={a.status} /><small>{a.issues.join(' · ')}</small></li>)}</ul> : <Empty title="No open issues">Every article that was checked passes the required items.</Empty>}
          <p className="dash-note">Based on the internal checklist. It does not predict Google rankings.</p>
        </section>
        <section className="a-card" aria-labelledby="d-recent"><h2 id="d-recent">Recently updated</h2>
          {d.recentArticles.length ? <ul className="dash-list">{d.recentArticles.map((a) => <li key={a.id}><Link to={`/admin/articles/${a.id}`}>{a.title}</Link> <StatusBadge status={a.status} /><small>{fmtDate(a.updatedAt)}</small></li>)}</ul> : <Empty title="Nothing here yet">Your articles will show up here once you start writing.</Empty>}
        </section>
        <section className="a-card" aria-labelledby="d-an"><h2 id="d-an">Analytics</h2>
          <p><strong>{d.analytics.firstParty.totalViews.toLocaleString('en-IN')}</strong> page views recorded</p>
          <p className="dash-note">{d.analytics.firstParty.note}</p>
          <p className="dash-note"><strong>Google Analytics:</strong> {d.analytics.googleAnalytics.note}</p>
          <p className="dash-note"><strong>Search Console:</strong> {d.analytics.searchConsole.note}</p>
        </section>
        {d.recentActivity.length ? (
          <section className="a-card" aria-labelledby="d-act"><h2 id="d-act">Recent activity</h2>
            <ul className="dash-list">{d.recentActivity.map((a, i) => <li key={i}><span>{a.action}</span> <small>{a.summary} · {a.userEmail} · {fmtDate(a.createdAt)}</small></li>)}</ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
