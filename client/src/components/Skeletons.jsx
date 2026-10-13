import './Skeletons.css';

const Block = ({ h, w = '100%', r }) => <span className="sk" style={{ height: h, width: w, borderRadius: r }} />;

export function CardSkeleton() {
  return (<div className="sk-card" aria-hidden="true"><span className="sk sk--media" /><Block h="0.8rem" w="30%" /><Block h="1.3rem" /><Block h="1.3rem" w="80%" /><Block h="0.8rem" w="50%" /></div>);
}

export default function PageSkeleton({ name }) {
  const article = name === 'article';
  return (
    <div className="container sk-page" role="status" aria-label="Loading">
      <span className="sr-only">Loading</span>
      {article ? (
        <div className="sk-article" aria-hidden="true">
          <Block h="0.8rem" w="40%" /><Block h="2.6rem" /><Block h="2.6rem" w="70%" /><Block h="1rem" w="35%" />
          <span className="sk sk--media" />{[0, 1, 2, 3, 4].map((i) => <Block key={i} h="1rem" w={i === 4 ? '60%' : '100%'} />)}
        </div>
      ) : (
        <div className="sk-grid" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} />)}</div>
      )}
    </div>
  );
}
