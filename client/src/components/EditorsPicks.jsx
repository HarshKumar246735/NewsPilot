import SectionHeader from './SectionHeader.jsx';
import ArticleCard from './ArticleCard.jsx';
import './EditorsPicks.css';

export default function EditorsPicks({ articles }) {
  if (!articles?.length) return null;
  return (
    <section className="picks on-dark" aria-labelledby="picks-title">
      <div className="container">
        <SectionHeader title="Editor’s picks" id="picks-title" />
        <div className="picks__grid">
          {articles.map((a) => <ArticleCard key={a.slug} article={a} variant="standard" excerpt={false} />)}
        </div>
      </div>
    </section>
  );
}
