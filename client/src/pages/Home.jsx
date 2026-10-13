import Hero from '../components/Hero.jsx';
import ArticleCard from '../components/ArticleCard.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import TrendingList from '../components/TrendingList.jsx';
import CategorySection from '../components/CategorySection.jsx';
import EditorsPicks from '../components/EditorsPicks.jsx';
import { EmptyState } from '../components/States.jsx';
import AdSlot from '../components/AdSlot.jsx';
import { useApp } from '../context/AppContext.js';
import './Home.css';

export default function Home({ page }) {
  const { site } = useApp().shell;
  const d = page.data;
  if (!d.hero?.main) {
    return <div className="container"><EmptyState title="No stories published yet">Fresh reporting will appear here as soon as the first article is published.</EmptyState></div>;
  }
  const [firstSections, laterSections] = [d.sections.slice(0, 3), d.sections.slice(3)];
  return (
    <>
      <h1 className="sr-only">{site.name}: {site.tagline}</h1>
      <Hero main={d.hero.main} secondary={d.hero.secondary} latest={d.hero.latest} />

      {d.latest?.length || d.trending?.length ? (
        <div className="container home-feed">
          {d.latest?.length ? (
            <section aria-labelledby="latest-news">
              <SectionHeader title="Latest news" id="latest-news" href="/latest" linkLabel="View all latest news" />
              <div className="home-feed__grid">
                {d.latest.slice(0, 6).map((a) => <ArticleCard key={a.slug} article={a} variant="standard" />)}
              </div>
            </section>
          ) : null}
          <aside className="home-feed__side" aria-label="Most popular">
            <TrendingList title="Trending now" articles={d.trending} id="trending-now" href="/trending" />
            <TrendingList title="Most read" articles={d.mostRead} id="most-read" />
          </aside>
        </div>
      ) : null}

      <AdSlot placement="homepage-feed" className="container" />
      {firstSections.map((s) => <CategorySection key={s.category.slug} category={s.category} articles={s.articles} />)}
      <EditorsPicks articles={d.editorsPicks} />
      {d.guides?.length ? (
        <section className="container home-guides" aria-labelledby="guides">
          <SectionHeader title="Popular guides" id="guides" />
          <div className="home-guides__grid">{d.guides.map((a) => <ArticleCard key={a.slug} article={a} variant="standard" excerpt={false} />)}</div>
        </section>
      ) : null}
      {laterSections.map((s) => <CategorySection key={s.category.slug} category={s.category} articles={s.articles} />)}
    </>
  );
}
