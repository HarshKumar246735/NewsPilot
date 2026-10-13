import { useApp } from '../context/AppContext.js';
import './DemoBanner.css';

export default function DemoBanner() {
  if (!useApp().config.demo) return null;
  return (
    <div className="demo-banner" role="note">
      <div className="container">Demonstration content for design review. These articles, authors and images are fictional placeholders and are hidden from search engines.</div>
    </div>
  );
}
